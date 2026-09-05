import { NextRequest, NextResponse } from "next/server";
import {
  evaluateSpeakingAudio,
  SpeakingAudioInput,
} from "@/lib/gemini/speaking-evaluator";
import {
  getSpeakingAudioBuffer,
  buildSpeakingAudioStorageKey,
  persistSpeakingAudioBuffer,
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import { db } from "@/lib/db";
import {
  speakingSessions,
  speakingResponses,
  speakingReviewAnnotations,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/authorization";
import {
  toErrorResponse,
  AppError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { finishSpeakingPractice } from "@/modules/speaking/application/finish-speaking-practice";
import { restoreSpeakingPractice } from "@/modules/speaking/application/restore-speaking-practice";
import { normalizeSpeakingPracticeScope } from "@/modules/speaking/domain";
import {
  devSessionCache,
  devResponseCache,
} from "@/modules/speaking/infrastructure/speaking-practice-repository";
import type { CandidateTurnMarkerInput } from "@/modules/speaking/application/retry-practice-evaluation";

export const runtime = "nodejs";

export {
  devSessionCache,
  devResponseCache,
  type DevSessionRecord,
  type DevResponseRecord,
} from "@/modules/speaking/infrastructure/speaking-practice-repository";
export type { CandidateTurnMarkerInput } from "@/modules/speaking/application/retry-practice-evaluation";

export async function POST(req: NextRequest) {
  let sessionId = `ses_${Date.now()}`;
  let topicTitle = "IELTS Speaking Examination";
  let durationSeconds = 120;
  let effectiveStorageKey: string | undefined;
  let mimeType = "audio/webm;codecs=opus";

  try {
    const session = await requireRole("learner", req.headers);
    const authenticatedUserId = session.user.id;

    const body = await req.json();
    const {
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

    // Check if this is a Part 1 Practice Evaluation
    const normalizedScope =
      normalizeSpeakingPracticeScope(body.practiceMode) ||
      normalizeSpeakingPracticeScope(body.targetPart);
    const isPart1Practice = normalizedScope !== null;

    if (isPart1Practice) {
      const practiceResult = await finishSpeakingPractice({
        authenticatedUserId,
        sessionId,
        topicTitle: body.topicTitle || topicTitle,
        candidateName,
        questions: body.questions,
        part1Question,
        durationSeconds: body.durationSeconds || durationSeconds,
        transcripts,
        turnMarkers,
        audioBase64,
        storageKey: effectiveStorageKey,
        mimeType,
      });

      if (!practiceResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: practiceResult.error,
            message: practiceResult.message,
            sessionId: practiceResult.sessionId,
            isPractice: true,
            practiceMode: "part_1",
            status: practiceResult.status,
          },
          { status: practiceResult.httpStatus }
        );
      }

      return NextResponse.json({
        success: true,
        isPractice: true,
        practiceMode: "part_1",
        result: practiceResult.result,
        transcripts: practiceResult.transcripts,
        trace: practiceResult.trace,
        sessionId: practiceResult.sessionId,
      });
    }

    // Full Mock Examination Evaluation Flow
    // 0. Resolve & verify existing SpeakingPractice owner before loading audio or evaluating
    let existingSessionUserId: string | null = null;
    let sessionExists = false;

    if (process.env.DATABASE_URL) {
      try {
        const existingSessionRow = await db
          .select({ userId: speakingSessions.userId })
          .from(speakingSessions)
          .where(eq(speakingSessions.id, sessionId));
        if (existingSessionRow.length > 0) {
          sessionExists = true;
          existingSessionUserId = existingSessionRow[0].userId;
        }
      } catch {
        // ignore lookup error
      }
    }

    if (!sessionExists) {
      const cached = devSessionCache.get(sessionId);
      if (cached) {
        sessionExists = true;
        existingSessionUserId = cached.userId;
      }
    }

    if (sessionExists) {
      if (
        !existingSessionUserId ||
        existingSessionUserId !== authenticatedUserId
      ) {
        throw new ForbiddenError(
          "Cannot retry, mutate, or access a speaking practice belonging to another user."
        );
      }
    }

    // Verify storageKey ownership if client supplied one (must match user and session namespace)
    if (
      effectiveStorageKey &&
      !isSpeakingAudioStorageKeyOwnedBy(
        effectiveStorageKey,
        authenticatedUserId,
        sessionId
      )
    ) {
      throw new ForbiddenError(
        "Cannot evaluate audio with a storage key outside the session namespace."
      );
    }

    // 1. Resolve & Verify Audio Payload
    let audioBuffer: Buffer | undefined;
    let isAudioPersisted = false;

    if (effectiveStorageKey) {
      const audioData = await getSpeakingAudioBuffer(effectiveStorageKey);
      if (audioData && audioData.buffer && audioData.buffer.length > 0) {
        audioBuffer = audioData.buffer;
        mimeType = audioData.mimeType;
        isAudioPersisted = true;
      } else {
        console.warn(
          `[EvaluateSpeakingAPI] Storage lookup for key "${effectiveStorageKey}" failed. Treating as unpersisted.`
        );
        isAudioPersisted = false;
      }
    }

    if (!isAudioPersisted && sessionId) {
      let existingStorageKey: string | null = null;
      if (process.env.DATABASE_URL) {
        try {
          const existingResp = await db
            .select({ storageKey: speakingResponses.storageKey })
            .from(speakingResponses)
            .where(eq(speakingResponses.sessionId, sessionId));
          if (existingResp.length > 0 && existingResp[0].storageKey) {
            existingStorageKey = existingResp[0].storageKey;
          }
        } catch {
          // ignore lookup error
        }
      }

      if (!existingStorageKey) {
        const cachedResp = devResponseCache.get(sessionId);
        if (cachedResp && cachedResp.length > 0 && cachedResp[0].storageKey) {
          existingStorageKey = cachedResp[0].storageKey;
        }
      }

      if (existingStorageKey) {
        if (
          !isSpeakingAudioStorageKeyOwnedBy(
            existingStorageKey,
            authenticatedUserId,
            sessionId
          )
        ) {
          throw new ForbiddenError(
            "Cannot retry evaluation using audio outside the session namespace."
          );
        }
        const audioData = await getSpeakingAudioBuffer(existingStorageKey);
        if (audioData && audioData.buffer && audioData.buffer.length > 0) {
          audioBuffer = audioData.buffer;
          mimeType = audioData.mimeType;
          effectiveStorageKey = existingStorageKey;
          isAudioPersisted = true;
        }
      }
    }

    if (!isAudioPersisted && audioBase64) {
      audioBuffer = Buffer.from(audioBase64, "base64");
      const targetStorageKey =
        effectiveStorageKey ||
        buildSpeakingAudioStorageKey(
          authenticatedUserId,
          sessionId,
          "candidate.webm"
        );

      const persistRes = await persistSpeakingAudioBuffer(
        targetStorageKey,
        audioBuffer,
        mimeType
      );
      if (persistRes.success) {
        effectiveStorageKey = targetStorageKey;
        isAudioPersisted = true;
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

    if (!isAudioPersisted || !audioBuffer || !effectiveStorageKey) {
      return NextResponse.json(
        {
          error: "ORIGINAL_AUDIO_MISSING",
          message:
            "OriginalAudio evidence is missing or unverified. Cannot evaluate practice.",
        },
        { status: 400 }
      );
    }

    // Prepare items for full test evaluation
    let items: SpeakingAudioInput[] = [];
    const typedTurnMarkers = (turnMarkers || []) as CandidateTurnMarkerInput[];
    if (typedTurnMarkers.length > 0) {
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

    // Execute 2-Stage Evaluation Engine
    const result = await evaluateSpeakingAudio(items);

    // Persist to Database via Drizzle ORM
    try {
      if (process.env.DATABASE_URL) {
        await db
          .insert(speakingSessions)
          .values({
            id: sessionId,
            userId: authenticatedUserId,
            candidateName:
              candidateName || session.user.name || "Anonymous Candidate",
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
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
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
    const session = await requireRole("learner", req.headers);
    const authenticatedUserId = session.user.id;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required sessionId query parameter" },
        { status: 400 }
      );
    }

    try {
      const {
        session: practiceSession,
        responses,
        restoredState,
      } = await restoreSpeakingPractice({
        authenticatedUserId,
        sessionId,
      });

      return NextResponse.json({
        success: true,
        session: practiceSession,
        responses,
        ...(restoredState ? { restoredState } : {}),
      });
    } catch (practiceErr) {
      if (practiceErr instanceof NotFoundError) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      throw practiceErr;
    }
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
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
