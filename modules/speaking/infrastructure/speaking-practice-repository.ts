import { db } from "@/lib/db";
import { speakingSessions, speakingResponses } from "./speaking-schema";
import { eq, and } from "drizzle-orm";

export interface SpeakingPracticeRecord {
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

export interface SpeakingResponseRecord {
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

// Backward-compatible type aliases
export type DevSessionRecord = SpeakingPracticeRecord;
export type DevResponseRecord = SpeakingResponseRecord;

const globalForSessionCache = globalThis as unknown as {
  devSessionCache?: Map<string, SpeakingPracticeRecord>;
  devResponseCache?: Map<string, SpeakingResponseRecord[]>;
};

export const devSessionCache =
  globalForSessionCache.devSessionCache ||
  new Map<string, SpeakingPracticeRecord>();

export const devResponseCache =
  globalForSessionCache.devResponseCache ||
  new Map<string, SpeakingResponseRecord[]>();

export const speakingPracticeCache = devSessionCache;
export const speakingResponseCache = devResponseCache;

if (process.env.NODE_ENV !== "production") {
  globalForSessionCache.devSessionCache = devSessionCache;
  globalForSessionCache.devResponseCache = devResponseCache;
}

export interface CommitCompletedPracticeParams {
  sessionId: string;
  userId: string;
  candidateName: string;
  topicTitle: string;
  durationSeconds: number;
  targetPart?: string;
  turnMarkers?: unknown[];
  liveTranscript?: string;
  storageKey?: string | null;
  audioUrl?: string | null;
  mimeType?: string;
}

export interface MarkEvaluatedPracticeParams {
  sessionId: string;
  userId: string;
  scorecardJson: unknown;
  evidenceJson: unknown;
  verifiedTranscript?: string | null;
}

export interface MarkEvaluationFailedPracticeParams {
  sessionId: string;
  userId: string;
  failedEvidence: unknown;
}

export class SpeakingPracticeRepository {
  async findById(sessionId: string): Promise<{
    practice: SpeakingPracticeRecord | null;
    responses: SpeakingResponseRecord[];
  }> {
    if (process.env.DATABASE_URL) {
      try {
        const sessionRows = await db
          .select()
          .from(speakingSessions)
          .where(eq(speakingSessions.id, sessionId));

        if (sessionRows.length > 0) {
          const responseRows = await db
            .select()
            .from(speakingResponses)
            .where(eq(speakingResponses.sessionId, sessionId));

          return {
            practice: sessionRows[0] as unknown as SpeakingPracticeRecord,
            responses: responseRows as unknown as SpeakingResponseRecord[],
          };
        }
      } catch (dbErr) {
        console.warn(
          "[SpeakingPracticeRepository] Database findById lookup failed, checking cache:",
          dbErr
        );
      }
    }

    const cachedPractice = devSessionCache.get(sessionId) || null;
    const cachedResponses = devResponseCache.get(sessionId) || [];
    return {
      practice: cachedPractice,
      responses: cachedResponses,
    };
  }

  async commitCompleted(params: CommitCompletedPracticeParams): Promise<void> {
    const {
      sessionId,
      userId,
      candidateName,
      topicTitle,
      durationSeconds,
      targetPart = "part_1",
      turnMarkers = [],
      liveTranscript = "",
      storageKey = null,
      audioUrl = null,
      mimeType = "audio/webm;codecs=opus",
    } = params;

    const now = new Date();
    const existingCached = devSessionCache.get(sessionId);
    const createdAt = existingCached?.createdAt || now;

    // 1. Commit to in-memory dev cache
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName,
      topicTitle,
      status: "completed",
      targetPart,
      durationSeconds,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: {
        turnMarkers,
        liveTranscript,
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
        promptQuestion: topicTitle,
        storageKey,
        audioUrl,
        mimeType,
        startMs: 0,
        endMs: durationSeconds * 1000,
        durationSeconds,
        liveTranscript: liveTranscript || null,
        verifiedTranscript: null,
        createdAt,
      },
    ]);

    // 2. Commit to PostgreSQL if configured
    if (process.env.DATABASE_URL) {
      try {
        await db
          .insert(speakingSessions)
          .values({
            id: sessionId,
            userId,
            candidateName,
            topicTitle,
            status: "completed",
            targetPart,
            durationSeconds,
            overallBand: null,
            scorecardJson: null,
            evidenceJson: {
              turnMarkers,
              liveTranscript,
            },
          })
          .onConflictDoUpdate({
            target: speakingSessions.id,
            set: {
              status: "completed",
              durationSeconds,
              updatedAt: new Date(),
            },
            where: eq(speakingSessions.userId, userId),
          });

        await db
          .insert(speakingResponses)
          .values({
            id: `resp_${sessionId}_p1_0`,
            sessionId,
            partNumber: 1,
            itemIndex: 0,
            promptQuestion: topicTitle,
            storageKey,
            audioUrl,
            mimeType,
            startMs: 0,
            endMs: durationSeconds * 1000,
            durationSeconds,
            liveTranscript: liveTranscript || null,
            verifiedTranscript: null,
          })
          .onConflictDoUpdate({
            target: speakingResponses.id,
            set: {
              storageKey,
              audioUrl,
              liveTranscript: liveTranscript || null,
            },
          });
      } catch (dbErr) {
        console.error(
          "[SpeakingPracticeRepository] Database commit failure for completed practice:",
          dbErr
        );
        throw dbErr;
      }
    }
  }

  async markEvaluated(params: MarkEvaluatedPracticeParams): Promise<void> {
    const {
      sessionId,
      userId,
      scorecardJson,
      evidenceJson,
      verifiedTranscript = null,
    } = params;

    // 1. Update in-memory dev cache
    const existingSession = devSessionCache.get(sessionId);
    if (existingSession) {
      existingSession.status = "evaluated";
      existingSession.scorecardJson = scorecardJson;
      existingSession.evidenceJson = evidenceJson;
      existingSession.updatedAt = new Date();
    }

    const existingResponses = devResponseCache.get(sessionId);
    if (existingResponses && existingResponses[0]) {
      existingResponses[0].verifiedTranscript = verifiedTranscript;
    }

    // 2. Update PostgreSQL if configured
    if (process.env.DATABASE_URL) {
      try {
        await db
          .update(speakingSessions)
          .set({
            status: "evaluated",
            scorecardJson,
            evidenceJson,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(speakingSessions.id, sessionId),
              eq(speakingSessions.userId, userId)
            )
          );

        await db
          .update(speakingResponses)
          .set({
            verifiedTranscript,
          })
          .where(eq(speakingResponses.id, `resp_${sessionId}_p1_0`));
      } catch (dbErr) {
        console.error(
          "[SpeakingPracticeRepository] Database update to evaluated status failed:",
          dbErr
        );
        throw dbErr;
      }
    }
  }

  async markEvaluationFailed(
    params: MarkEvaluationFailedPracticeParams
  ): Promise<void> {
    const { sessionId, userId, failedEvidence } = params;

    // 1. Update in-memory dev cache
    const existingSession = devSessionCache.get(sessionId);
    if (existingSession) {
      existingSession.evidenceJson = failedEvidence;
      existingSession.updatedAt = new Date();
    }

    // 2. Update PostgreSQL if configured
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
              eq(speakingSessions.userId, userId)
            )
          );
      } catch (dbErr) {
        console.warn(
          "[SpeakingPracticeRepository] Failed to update error evidence in DB:",
          dbErr
        );
      }
    }
  }
}

export const speakingPracticeRepository = new SpeakingPracticeRepository();
