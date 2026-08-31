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
import type { PracticeEvaluationResult } from "@/lib/gemini/speaking-schema";

export const runtime = "nodejs";

export interface CandidateTurnMarkerInput {
  partNumber: number;
  itemIndex: number;
  promptQuestion: string;
  startMs: number;
  endMs: number;
  liveTranscript?: string;
}

// In-memory dev/test fallback cache for sessions and responses when PostgreSQL is unconfigured
export interface DevSessionRecord {
  id: string;
  userId: string | null;
  candidateName: string | null;
  topicTitle: string;
  status: "in_progress" | "completed" | "evaluated" | "abandoned";
  targetPart: string;
  durationSeconds: number;
  overallBand: number | null;
  scorecardJson: unknown | null;
  evidenceJson: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevResponseRecord {
  id: string;
  sessionId: string;
  partNumber: number;
  itemIndex: number;
  promptQuestion: string;
  storageKey: string | null;
  audioUrl: string | null;
  mimeType: string | null;
  startMs: number;
  endMs: number;
  durationSeconds: number;
  liveTranscript: string | null;
  verifiedTranscript: string | null;
  createdAt: Date;
}

export const devSessionCache = new Map<string, DevSessionRecord>();
export const devResponseCache = new Map<string, DevResponseRecord[]>();

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
      body.practiceMode === "part1" ||
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

      const resolvedCandidateName =
        candidateName ||
        (userId !== "anonymous" ? userId : "Anonymous Candidate");

      let registeredUserId: string | null = null;
      if (userId && userId !== "anonymous" && process.env.DATABASE_URL) {
        try {
          const userRecord = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, userId));
          if (userRecord.length > 0) {
            registeredUserId = userRecord[0].id;
          }
        } catch {
          // Ignore user lookup failure
        }
      }

      // STEP A: Commit completed Practice to DB before AI evaluation (PracticeEnded != PracticeEvaluated)
      const audioUrl = effectiveStorageKey
        ? `/api/speaking/upload-direct?key=${encodeURIComponent(effectiveStorageKey)}`
        : null;

      // Always commit to in-memory dev cache
      const now = new Date();
      devSessionCache.set(sessionId, {
        id: sessionId,
        userId: registeredUserId,
        candidateName: resolvedCandidateName,
        topicTitle,
        status: "completed",
        targetPart: "part_1",
        durationSeconds,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: {
          turnMarkers: typedTurnMarkers,
          liveTranscript: userTranscripts,
        },
        createdAt: now,
        updatedAt: now,
      });

      devResponseCache.set(sessionId, [
        {
          id: `resp_${sessionId}_p1_0`,
          sessionId,
          partNumber: 1,
          itemIndex: 0,
          promptQuestion: topicTitle,
          storageKey: effectiveStorageKey,
          audioUrl,
          mimeType,
          startMs: 0,
          endMs: durationSeconds * 1000,
          durationSeconds,
          liveTranscript: userTranscripts,
          verifiedTranscript: null,
          createdAt: now,
        },
      ]);

      if (process.env.DATABASE_URL) {
        try {
          await db
            .insert(speakingSessions)
            .values({
              id: sessionId,
              userId: registeredUserId,
              candidateName: resolvedCandidateName,
              topicTitle,
              status: "completed",
              targetPart: "part_1",
              durationSeconds,
              overallBand: null,
              scorecardJson: null,
              evidenceJson: {
                turnMarkers: typedTurnMarkers,
                liveTranscript: userTranscripts,
              },
            })
            .onConflictDoUpdate({
              target: speakingSessions.id,
              set: {
                status: "completed",
                durationSeconds,
                updatedAt: new Date(),
              },
            });

          await db
            .insert(speakingResponses)
            .values({
              id: `resp_${sessionId}_p1_0`,
              sessionId,
              partNumber: 1,
              itemIndex: 0,
              promptQuestion: topicTitle,
              storageKey: effectiveStorageKey,
              audioUrl,
              mimeType,
              startMs: 0,
              endMs: durationSeconds * 1000,
              durationSeconds,
              liveTranscript: userTranscripts,
              verifiedTranscript: null,
            })
            .onConflictDoUpdate({
              target: speakingResponses.id,
              set: {
                storageKey: effectiveStorageKey,
                audioUrl,
                liveTranscript: userTranscripts,
              },
            });
        } catch (dbErr) {
          console.error(
            "[EvaluateSpeakingAPI] Database commit failure for completed practice:",
            dbErr
          );
          return NextResponse.json(
            {
              error: "PRACTICE_PERSISTENCE_FAILED",
              message:
                "Failed to commit completed practice session to database.",
            },
            { status: 500 }
          );
        }
      }

      // STEP B: Run AI evaluation
      let practiceResult: PracticeEvaluationResult | null = null;
      let evaluationError: string | null = null;

      try {
        practiceResult = await evaluateSpeakingPracticePart1({
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
      } catch (evalErr) {
        evaluationError =
          (evalErr as Error)?.message ||
          "Practice AI evaluation failed to complete";
        console.error(
          "[EvaluateSpeakingAPI] Practice AI evaluation failed:",
          evaluationError
        );
      }

      // STEP C: If AI evaluation failed, practice remains 'completed' with error recorded
      if (!practiceResult) {
        const failedEvidence = {
          turnMarkers: typedTurnMarkers,
          liveTranscript: userTranscripts,
          evaluationStatus: "failed",
          evaluationError,
        };

        const existingSession = devSessionCache.get(sessionId);
        if (existingSession) {
          existingSession.evidenceJson = failedEvidence;
          existingSession.updatedAt = new Date();
        }

        if (process.env.DATABASE_URL) {
          try {
            await db
              .update(speakingSessions)
              .set({
                evidenceJson: failedEvidence,
                updatedAt: new Date(),
              })
              .where(eq(speakingSessions.id, sessionId));
          } catch (updateErr) {
            console.warn(
              "[EvaluateSpeakingAPI] Failed to update error evidence in DB:",
              updateErr
            );
          }
        }

        return NextResponse.json(
          {
            success: false,
            error: "EVALUATION_FAILED",
            message: evaluationError,
            sessionId,
            isPractice: true,
            practiceMode: "part_1",
            status: "completed",
          },
          { status: 502 }
        );
      }

      // STEP D: If AI evaluation succeeded, transition Practice to 'evaluated'
      const existingSession = devSessionCache.get(sessionId);
      if (existingSession) {
        existingSession.status = "evaluated";
        existingSession.scorecardJson = practiceResult.practiceFeedback;
        existingSession.evidenceJson = {
          transcripts: practiceResult.transcripts,
          trace: practiceResult.trace,
        };
        existingSession.updatedAt = new Date();
      }

      const existingResponses = devResponseCache.get(sessionId);
      if (existingResponses && existingResponses[0]) {
        existingResponses[0].verifiedTranscript =
          practiceResult.transcripts.bestTranscript || null;
      }

      if (process.env.DATABASE_URL) {
        try {
          await db
            .update(speakingSessions)
            .set({
              status: "evaluated",
              scorecardJson: practiceResult.practiceFeedback,
              evidenceJson: {
                transcripts: practiceResult.transcripts,
                trace: practiceResult.trace,
              },
              updatedAt: new Date(),
            })
            .where(eq(speakingSessions.id, sessionId));

          await db
            .update(speakingResponses)
            .set({
              verifiedTranscript:
                practiceResult.transcripts.bestTranscript || null,
            })
            .where(eq(speakingResponses.id, `resp_${sessionId}_p1_0`));
        } catch (dbUpdateErr) {
          console.error(
            "[EvaluateSpeakingAPI] Database update to evaluated status failed:",
            dbUpdateErr
          );
          return NextResponse.json(
            {
              error: "PRACTICE_PERSISTENCE_FAILED",
              message:
                "Failed to update evaluated practice feedback in database.",
            },
            { status: 500 }
          );
        }
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

    if (process.env.DATABASE_URL) {
      try {
        const sessionList = await db
          .select()
          .from(speakingSessions)
          .where(eq(speakingSessions.id, sessionId));

        if (sessionList.length > 0) {
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
        }
      } catch (dbErr) {
        console.warn("[EvaluateSpeakingAPI] Database GET fallback:", dbErr);
      }
    }

    // Check dev in-memory cache
    const cachedSession = devSessionCache.get(sessionId);
    if (cachedSession) {
      const cachedResponses = devResponseCache.get(sessionId) || [];
      return NextResponse.json({
        success: true,
        session: cachedSession,
        responses: cachedResponses,
      });
    }

    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
