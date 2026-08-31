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
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import { db } from "@/lib/db";
import {
  speakingSessions,
  speakingResponses,
  speakingReviewAnnotations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { PracticeEvaluationResult } from "@/lib/gemini/speaking-schema";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ForbiddenError } from "@/lib/errors";

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

const globalForSessionCache = globalThis as unknown as {
  devSessionCache?: Map<string, DevSessionRecord>;
  devResponseCache?: Map<string, DevResponseRecord[]>;
};

export const devSessionCache =
  globalForSessionCache.devSessionCache || new Map<string, DevSessionRecord>();

export const devResponseCache =
  globalForSessionCache.devResponseCache ||
  new Map<string, DevResponseRecord[]>();

if (process.env.NODE_ENV !== "production") {
  globalForSessionCache.devSessionCache = devSessionCache;
  globalForSessionCache.devResponseCache = devResponseCache;
}

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
      // Require existingSession.userId === authenticated session.user.id
      // Reject if userId is null (legacy) or belongs to another learner
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

    // 1. Resolve & Verify Audio Payload (Strict verification: no phantom storageKey bypass)
    let audioBuffer: Buffer | undefined;
    let isAudioPersisted = false;

    // 1a. Try to load from provided storageKey
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

    // 1b. If not yet loaded from storage, check if this is an existing session retry (resolve server-side)
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

    // 1c. If not yet persisted, resolve audioBuffer from audioBase64 and durably persist it
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

    // 1d. Final invariant validation: must be truly persisted and non-null
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

    // 2. Check if this is a Part 1 Practice Evaluation
    const isPart1Practice =
      body.practiceMode === "part_1" ||
      body.practiceMode === "part1" ||
      body.targetPart === "part1" ||
      body.targetPart === "part_1";

    if (isPart1Practice) {
      const typedTurnMarkers = (turnMarkers ||
        []) as CandidateTurnMarkerInput[];
      // Check existing session for fallback metadata if this is a retry
      const existingCachedSession = devSessionCache.get(sessionId);
      if (
        existingCachedSession &&
        (!existingCachedSession.userId ||
          existingCachedSession.userId !== authenticatedUserId)
      ) {
        throw new ForbiddenError(
          "Cannot access speaking practice belonging to another user."
        );
      }
      const existingEvidence = existingCachedSession?.evidenceJson as
        | {
            turnMarkers?: CandidateTurnMarkerInput[];
            liveTranscript?: string;
          }
        | undefined;

      const effectiveTopicTitle =
        body.topicTitle || existingCachedSession?.topicTitle || topicTitle;

      const effectiveCandidateName =
        candidateName ||
        existingCachedSession?.candidateName ||
        session.user.name ||
        "Học viên";

      const effectiveTurnMarkers =
        typedTurnMarkers.length > 0
          ? typedTurnMarkers
          : existingEvidence?.turnMarkers || [];

      const part1Questions: string[] =
        body.questions ||
        (effectiveTurnMarkers.length > 0
          ? effectiveTurnMarkers.map(
              (m: CandidateTurnMarkerInput) => m.promptQuestion
            )
          : [part1Question]);

      const userTranscripts =
        transcripts.length > 0
          ? (transcripts as Array<{ sender: string; text: string }>)
              .filter((t) => t.sender === "user")
              .map((t) => t.text)
              .join(" ")
          : existingEvidence?.liveTranscript || "";

      const effectiveDuration =
        body.durationSeconds ||
        existingCachedSession?.durationSeconds ||
        durationSeconds;

      // STEP A: Commit completed Practice to DB before AI evaluation (PracticeEnded != PracticeEvaluated)
      const audioUrl = effectiveStorageKey
        ? `/api/speaking/upload-direct?key=${encodeURIComponent(effectiveStorageKey)}`
        : null;

      // Always commit to in-memory dev cache
      const now = new Date();
      const createdAt = existingCachedSession?.createdAt || now;
      devSessionCache.set(sessionId, {
        id: sessionId,
        userId: authenticatedUserId,
        candidateName: effectiveCandidateName,
        topicTitle: effectiveTopicTitle,
        status: "completed",
        targetPart: "part_1",
        durationSeconds: effectiveDuration,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: {
          turnMarkers: effectiveTurnMarkers,
          liveTranscript: userTranscripts,
        },
        createdAt,
        updatedAt: now,
      });

      devResponseCache.set(sessionId, [
        {
          id: `resp_${sessionId}_p1_0`,
          sessionId,
          partNumber: 1,
          itemIndex: 0,
          promptQuestion: effectiveTopicTitle,
          storageKey: effectiveStorageKey,
          audioUrl,
          mimeType,
          startMs: 0,
          endMs: effectiveDuration * 1000,
          durationSeconds: effectiveDuration,
          liveTranscript: userTranscripts,
          verifiedTranscript: null,
          createdAt,
        },
      ]);

      if (process.env.DATABASE_URL) {
        try {
          await db
            .insert(speakingSessions)
            .values({
              id: sessionId,
              userId: authenticatedUserId,
              candidateName: effectiveCandidateName,
              topicTitle: effectiveTopicTitle,
              status: "completed",
              targetPart: "part_1",
              durationSeconds: effectiveDuration,
              overallBand: null,
              scorecardJson: null,
              evidenceJson: {
                turnMarkers: effectiveTurnMarkers,
                liveTranscript: userTranscripts,
              },
            })
            .onConflictDoUpdate({
              target: speakingSessions.id,
              set: {
                status: "completed",
                durationSeconds: effectiveDuration,
                updatedAt: new Date(),
              },
              where: eq(speakingSessions.userId, authenticatedUserId),
            });

          await db
            .insert(speakingResponses)
            .values({
              id: `resp_${sessionId}_p1_0`,
              sessionId,
              partNumber: 1,
              itemIndex: 0,
              promptQuestion: effectiveTopicTitle,
              storageKey: effectiveStorageKey,
              audioUrl,
              mimeType,
              startMs: 0,
              endMs: effectiveDuration * 1000,
              durationSeconds: effectiveDuration,
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
          topicTitle: effectiveTopicTitle,
          questions: part1Questions,
          audioBuffer,
          audioBase64: !audioBuffer ? audioBase64 : undefined,
          mimeType,
          durationSeconds: effectiveDuration,
          liveTranscript: userTranscripts,
          turnMarkers: effectiveTurnMarkers,
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
              .where(
                and(
                  eq(speakingSessions.id, sessionId),
                  eq(speakingSessions.userId, authenticatedUserId)
                )
              );
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
            .where(
              and(
                eq(speakingSessions.id, sessionId),
                eq(speakingSessions.userId, authenticatedUserId)
              )
            );

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

    if (process.env.DATABASE_URL) {
      try {
        const sessionList = await db
          .select()
          .from(speakingSessions)
          .where(eq(speakingSessions.id, sessionId));

        if (sessionList.length > 0) {
          const foundSession = sessionList[0];
          if (foundSession.userId !== authenticatedUserId) {
            return NextResponse.json(
              { error: "Session not found" },
              { status: 404 }
            );
          }

          const responses = await db
            .select()
            .from(speakingResponses)
            .where(eq(speakingResponses.sessionId, sessionId));

          return NextResponse.json({
            success: true,
            session: foundSession,
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
      if (cachedSession.userId !== authenticatedUserId) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      const cachedResponses = devResponseCache.get(sessionId) || [];
      return NextResponse.json({
        success: true,
        session: cachedSession,
        responses: cachedResponses,
      });
    }

    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
