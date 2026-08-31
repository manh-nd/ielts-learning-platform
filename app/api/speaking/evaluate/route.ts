import { NextRequest, NextResponse } from "next/server";
import {
  evaluateSpeakingAudio,
  evaluateSpeakingPracticePart1,
  SpeakingAudioInput,
} from "@/lib/gemini/speaking-evaluator";
import {
  getSpeakingAudioBuffer,
  buildSpeakingAudioStorageKey,
  persistSpeakingAudioBuffer,
} from "@/lib/storage/s3-client";
import { db } from "@/lib/db";
import {
  speakingSessions,
  speakingResponses,
  speakingReviewAnnotations,
  user,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export interface CandidateTurnMarkerInput {
  partNumber: number;
  itemIndex: number;
  promptQuestion: string;
  startMs: number;
  endMs: number;
  liveTranscript?: string;
}

export async function POST(req: NextRequest) {
  let sessionId = `ses_${Date.now()}`;
  let topicTitle = "IELTS Speaking Examination";
  let durationSeconds = 120;
  let effectiveStorageKey: string | undefined;
  let mimeType = "audio/webm;codecs=opus";

  try {
    const body = await req.json();
    const {
      userId = "anonymous",
      candidateName,
      part1Question = "Part 1 Introduction and Interview",
      part2Topic = "Part 2 Individual Long Turn Cue Card",
      part3Theme = "Part 3 Two-Way Discussion",
      transcripts = [],
      turnMarkers = [] as CandidateTurnMarkerInput[],
      audioBase64,
      storageKey,
    } = body;

    if (body.sessionId) sessionId = body.sessionId;
    if (body.topicTitle) topicTitle = body.topicTitle;
    if (body.durationSeconds) durationSeconds = body.durationSeconds;
    effectiveStorageKey = storageKey;

    // 1. Resolve Audio Payload from S3 storageKey or direct base64
    let audioBuffer: Buffer | undefined;

    if (effectiveStorageKey) {
      const audioData = await getSpeakingAudioBuffer(effectiveStorageKey);
      if (audioData) {
        audioBuffer = audioData.buffer;
        mimeType = audioData.mimeType;
      }
    }

    if (!audioBuffer && audioBase64) {
      audioBuffer = Buffer.from(audioBase64, "base64");
    }

    // P0-4: Enforce OriginalAudio persistence invariant
    if (!effectiveStorageKey && audioBuffer) {
      const autoKey = buildSpeakingAudioStorageKey(
        userId,
        sessionId,
        "candidate.webm"
      );
      const persistRes = await persistSpeakingAudioBuffer(
        autoKey,
        audioBuffer,
        mimeType
      );
      if (persistRes.success) {
        effectiveStorageKey = autoKey;
      } else {
        console.error(
          "[EvaluateSpeakingAPI] Audio persistence failure: cannot commit practice."
        );
        return NextResponse.json(
          {
            error: "AUDIO_PERSISTENCE_FAILED",
            message:
              "OriginalAudio could not be durably persisted. Practice cannot be committed.",
          },
          { status: 500 }
        );
      }
    }

    if (!audioBuffer || !effectiveStorageKey) {
      return NextResponse.json(
        {
          error: "ORIGINAL_AUDIO_MISSING",
          message:
            "OriginalAudio evidence is missing or failed to persist. Cannot evaluate practice.",
        },
        { status: 400 }
      );
    }

    // 2. Check if this is a Part 1 Practice Evaluation
    const isPart1Practice =
      body.practiceMode === "part_1" ||
      body.targetPart === "part1" ||
      body.targetPart === "part_1";

    if (isPart1Practice) {
      const typedTurnMarkers = (turnMarkers ||
        []) as CandidateTurnMarkerInput[];
      const part1Questions: string[] =
        body.questions ||
        (typedTurnMarkers.length > 0
          ? typedTurnMarkers.map(
              (m: CandidateTurnMarkerInput) => m.promptQuestion
            )
          : [part1Question]);

      const userTranscripts = (
        transcripts as Array<{ sender: string; text: string }>
      )
        .filter((t) => t.sender === "user")
        .map((t) => t.text)
        .join(" ");

      const practiceResult = await evaluateSpeakingPracticePart1({
        practiceId: sessionId,
        topicTitle,
        questions: part1Questions,
        audioBuffer,
        audioBase64: !audioBuffer ? audioBase64 : undefined,
        mimeType,
        durationSeconds,
        liveTranscript: userTranscripts,
        turnMarkers: typedTurnMarkers,
      });

      // Persist Practice Session to DB
      try {
        if (process.env.DATABASE_URL) {
          let registeredUserId: string | null = null;
          if (userId && userId !== "anonymous") {
            try {
              const userRecord = await db
                .select({ id: user.id })
                .from(user)
                .where(eq(user.id, userId));
              if (userRecord.length > 0) {
                registeredUserId = userRecord[0].id;
              }
            } catch {
              // Ignore lookup failure
            }
          }

          await db
            .insert(speakingSessions)
            .values({
              id: sessionId,
              userId: registeredUserId,
              candidateName:
                candidateName ||
                (userId !== "anonymous" ? userId : "Anonymous Candidate"),
              topicTitle,
              status: "evaluated",
              targetPart: "part_1",
              durationSeconds,
              overallBand: null, // Formative practice does NOT output certified overall band
              scorecardJson: practiceResult.practiceFeedback,
              evidenceJson: {
                transcripts: practiceResult.transcripts,
                trace: practiceResult.trace,
              },
            })
            .onConflictDoNothing();

          await db
            .insert(speakingResponses)
            .values({
              id: `resp_${sessionId}_p1_0`,
              sessionId,
              partNumber: 1,
              itemIndex: 0,
              promptQuestion: topicTitle,
              storageKey: effectiveStorageKey || null,
              audioUrl: effectiveStorageKey
                ? `/api/speaking/upload-direct?key=${encodeURIComponent(effectiveStorageKey)}`
                : null,
              mimeType,
              startMs: 0,
              endMs: durationSeconds * 1000,
              durationSeconds,
              liveTranscript: practiceResult.transcripts.liveTranscript || "",
              verifiedTranscript:
                practiceResult.transcripts.bestTranscript || null,
            })
            .onConflictDoNothing();
        }
      } catch (dbErr) {
        console.warn(
          "[EvaluateSpeakingAPI] Practice DB persistence non-fatal warning:",
          dbErr
        );
      }

      return NextResponse.json({
        success: true,
        isPractice: true,
        practiceMode: "part_1",
        result: practiceResult.practiceFeedback,
        transcripts: practiceResult.transcripts,
        trace: practiceResult.trace,
        sessionId,
      });
    }

    // 3. Prepare items for full test evaluation
    let items: SpeakingAudioInput[] = [];

    const typedTurnMarkers = (turnMarkers || []) as CandidateTurnMarkerInput[];
    if (typedTurnMarkers.length > 0) {
      // Use exact candidate turn markers captured during the live session
      items = typedTurnMarkers.map((marker: CandidateTurnMarkerInput) => ({
        partNumber: marker.partNumber,
        itemIndex: marker.itemIndex,
        promptQuestion: marker.promptQuestion,
        startMs: marker.startMs,
        endMs: marker.endMs,
        liveTranscript: marker.liveTranscript,
        audioBuffer,
        mimeType,
        durationSeconds: Math.max(
          1,
          Math.round((marker.endMs - marker.startMs) / 1000)
        ),
      }));
    } else {
      // Fallback default 3-part split
      const userTranscripts = (
        transcripts as Array<{ sender: string; text: string }>
      )
        .filter((t) => t.sender === "user")
        .map((t) => t.text)
        .join(" ");

      items = [
        {
          partNumber: 1,
          itemIndex: 0,
          promptQuestion: `${topicTitle} - Part 1: ${part1Question}`,
          audioBuffer,
          audioBase64: !audioBuffer ? audioBase64 : undefined,
          mimeType,
          liveTranscript: userTranscripts.slice(0, 300),
          durationSeconds: Math.round(durationSeconds / 3),
        },
        {
          partNumber: 2,
          itemIndex: 0,
          promptQuestion: `${topicTitle} - Part 2 Cue Card: ${part2Topic}`,
          audioBuffer,
          audioBase64: !audioBuffer ? audioBase64 : undefined,
          mimeType,
          liveTranscript: userTranscripts.slice(300, 700),
          durationSeconds: Math.round(durationSeconds / 3),
        },
        {
          partNumber: 3,
          itemIndex: 0,
          promptQuestion: `${topicTitle} - Part 3 Discussion: ${part3Theme}`,
          audioBuffer,
          audioBase64: !audioBuffer ? audioBase64 : undefined,
          mimeType,
          liveTranscript: userTranscripts.slice(700),
          durationSeconds: Math.round(durationSeconds / 3),
        },
      ];
    }

    // 4. Execute 2-Stage Evaluation Engine
    const result = await evaluateSpeakingAudio(items);

    // 5. Persist to Database via Drizzle ORM (fail-safe for dev/test)
    try {
      if (process.env.DATABASE_URL) {
        // Resolve registered user ID if user exists in database
        let registeredUserId: string | null = null;
        if (userId && userId !== "anonymous") {
          try {
            const userRecord = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.id, userId));
            if (userRecord.length > 0) {
              registeredUserId = userRecord[0].id;
            }
          } catch {
            // Ignore lookup failure
          }
        }

        await db
          .insert(speakingSessions)
          .values({
            id: sessionId,
            userId: registeredUserId,
            candidateName:
              candidateName ||
              (userId !== "anonymous" ? userId : "Anonymous Candidate"),
            topicTitle,
            status: "evaluated",
            targetPart: "full",
            durationSeconds,
            overallBand: result.overallScorecard.overallBand,
            scorecardJson: result.overallScorecard,
            evidenceJson: result.evidence || null,
            practiceMonologue:
              result.overallScorecard.generalFeedback.practiceMonologue,
          })
          .onConflictDoNothing();

        for (let i = 0; i < result.partEvaluations.length; i++) {
          const partEval = result.partEvaluations[i];
          const responseId = `resp_${sessionId}_p${partEval.partNumber}_${partEval.itemIndex}`;
          const correspondingItem = items[i];

          await db
            .insert(speakingResponses)
            .values({
              id: responseId,
              sessionId,
              partNumber: partEval.partNumber,
              itemIndex: partEval.itemIndex,
              promptQuestion: partEval.promptQuestion,
              storageKey: storageKey || null,
              audioUrl: storageKey
                ? `/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`
                : null,
              mimeType,
              startMs: correspondingItem?.startMs || 0,
              endMs: correspondingItem?.endMs || 0,
              durationSeconds: correspondingItem?.durationSeconds || 0,
              liveTranscript: partEval.candidateTranscript,
              verifiedTranscript: partEval.verifiedTranscript || null,
            })
            .onConflictDoNothing();

          // Save timestamped pronunciation annotations
          for (const pr of partEval.pronunciationNotes) {
            await db
              .insert(speakingReviewAnnotations)
              .values({
                id: `ann_${responseId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                sessionId,
                responseId,
                category: "pronunciation",
                timestampSeconds:
                  pr.timestampSeconds || (pr.startMs ? pr.startMs / 1000 : 0),
                audioClipStartMs: pr.startMs || null,
                audioClipEndMs: pr.endMs || null,
                originalQuote: pr.word,
                comment: `${pr.detectedIssue}. Recommendation: ${pr.recommendation}`,
              })
              .onConflictDoNothing();
          }
        }
      }
    } catch (dbErr) {
      console.warn(
        "[EvaluateSpeakingAPI] Database persistence non-fatal warning:",
        dbErr
      );
    }

    return NextResponse.json({
      success: true,
      result,
      sessionId,
    });
  } catch (error: unknown) {
    console.error("[EvaluateSpeakingAPI] Evaluation error:", error);
    return NextResponse.json(
      {
        error: "Failed to evaluate speaking session",
        message:
          (error as Error)?.message ||
          "Internal error during speaking assessment",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required sessionId query parameter" },
        { status: 400 }
      );
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        sessionId,
        status: "in_memory_or_unconfigured",
      });
    }

    const sessionList = await db
      .select()
      .from(speakingSessions)
      .where(eq(speakingSessions.id, sessionId));

    if (sessionList.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = sessionList[0];
    const responses = await db
      .select()
      .from(speakingResponses)
      .where(eq(speakingResponses.sessionId, sessionId));

    return NextResponse.json({
      success: true,
      session,
      responses,
    });
  } catch (error: unknown) {
    console.error("[EvaluateSpeakingAPI] Session query error:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve session",
        message: (error as Error)?.message,
      },
      { status: 500 }
    );
  }
}
