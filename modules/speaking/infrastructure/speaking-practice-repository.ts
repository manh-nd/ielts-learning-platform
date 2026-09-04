import { db } from "@/lib/db";
import {
  speakingSessions,
  speakingResponses,
  SpeakingSessionStatus,
} from "./speaking-schema";
import { eq, and, or, lte } from "drizzle-orm";
import {
  deleteSpeakingAudioObject,
  deleteSpeakingAudioSession,
} from "@/lib/storage/s3-client";

export interface SpeakingPracticeRecord {
  id: string;
  userId: string | null;
  candidateName: string | null;
  topicTitle: string;
  status: SpeakingSessionStatus;
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

export function clearDevPracticeCache(): void {
  devSessionCache.clear();
  devResponseCache.clear();
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

  async createInProgress(params: {
    sessionId: string;
    userId: string;
    candidateName?: string | null;
    topicTitle?: string;
    targetPart?: string;
    createdAt?: Date;
  }): Promise<SpeakingPracticeRecord> {
    const {
      sessionId,
      userId,
      candidateName = null,
      topicTitle = "IELTS Speaking Examination",
      targetPart = "part_1",
      createdAt = new Date(),
    } = params;

    const existing = await this.findById(sessionId);
    if (existing.practice) {
      return existing.practice;
    }

    const sessionRecord: SpeakingPracticeRecord = {
      id: sessionId,
      userId,
      candidateName,
      topicTitle,
      status: "in_progress",
      targetPart,
      durationSeconds: 0,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt,
      updatedAt: createdAt,
    };

    devSessionCache.set(sessionId, sessionRecord);

    if (process.env.DATABASE_URL) {
      try {
        await db
          .insert(speakingSessions)
          .values({
            id: sessionId,
            userId,
            candidateName,
            topicTitle,
            status: "in_progress",
            targetPart,
            durationSeconds: 0,
            createdAt,
            updatedAt: createdAt,
          })
          .onConflictDoNothing();
      } catch (dbErr) {
        console.warn(
          "[SpeakingPracticeRepository] Failed to insert in_progress session:",
          dbErr
        );
      }
    }

    return sessionRecord;
  }

  async findAbandonedSessions(
    olderThanMs: number = 24 * 60 * 60 * 1000
  ): Promise<
    Array<{
      practice: SpeakingPracticeRecord;
      responses: SpeakingResponseRecord[];
    }>
  > {
    const cutoff = new Date(Date.now() - olderThanMs);
    const resultMap = new Map<
      string,
      { practice: SpeakingPracticeRecord; responses: SpeakingResponseRecord[] }
    >();

    // 1. Check in-memory dev cache (anchored to createdAt per ADR-0010 & §5.1)
    for (const session of devSessionCache.values()) {
      if (session.status === "in_progress" && session.createdAt <= cutoff) {
        const responses = devResponseCache.get(session.id) || [];
        resultMap.set(session.id, { practice: session, responses });
      }
    }

    // 2. Query PostgreSQL if configured
    if (process.env.DATABASE_URL) {
      try {
        const rows = await db
          .select()
          .from(speakingSessions)
          .where(
            and(
              eq(speakingSessions.status, "in_progress"),
              lte(speakingSessions.createdAt, cutoff)
            )
          );

        for (const row of rows) {
          const respRows = await db
            .select()
            .from(speakingResponses)
            .where(eq(speakingResponses.sessionId, row.id));

          resultMap.set(row.id, {
            practice: row as unknown as SpeakingPracticeRecord,
            responses: respRows as unknown as SpeakingResponseRecord[],
          });
        }
      } catch (dbErr) {
        console.warn(
          "[SpeakingPracticeRepository] Query abandoned sessions failed:",
          dbErr
        );
      }
    }

    return Array.from(resultMap.values());
  }

  async findCompletedSessionsForAudioPurge(
    olderThanMs: number = 14 * 24 * 60 * 60 * 1000
  ): Promise<
    Array<{
      practice: SpeakingPracticeRecord;
      responses: SpeakingResponseRecord[];
    }>
  > {
    const cutoff = new Date(Date.now() - olderThanMs);
    const resultMap = new Map<
      string,
      { practice: SpeakingPracticeRecord; responses: SpeakingResponseRecord[] }
    >();

    // 1. Check in-memory dev cache (anchored to createdAt so subsequent retries/modifications do not postpone purge)
    for (const session of devSessionCache.values()) {
      if (
        (session.status === "completed" || session.status === "evaluated") &&
        session.createdAt <= cutoff
      ) {
        const responses = devResponseCache.get(session.id) || [];
        resultMap.set(session.id, { practice: session, responses });
      }
    }

    // 2. Query PostgreSQL if configured
    if (process.env.DATABASE_URL) {
      try {
        const rows = await db
          .select()
          .from(speakingSessions)
          .where(
            and(
              or(
                eq(speakingSessions.status, "completed"),
                eq(speakingSessions.status, "evaluated")
              ),
              lte(speakingSessions.createdAt, cutoff)
            )
          );

        for (const row of rows) {
          const respRows = await db
            .select()
            .from(speakingResponses)
            .where(eq(speakingResponses.sessionId, row.id));

          resultMap.set(row.id, {
            practice: row as unknown as SpeakingPracticeRecord,
            responses: respRows as unknown as SpeakingResponseRecord[],
          });
        }
      } catch (dbErr) {
        console.warn(
          "[SpeakingPracticeRepository] Query completed sessions for purge failed:",
          dbErr
        );
      }
    }

    return Array.from(resultMap.values());
  }

  /**
   * Internal helper consolidating audio binary deletion from S3/devCache and status update.
   * If scrubCandidateName is true, candidateName is cleared (score anonymization).
   */
  private async purgeSessionAudioAndSetStatus(
    sessionId: string,
    targetStatus: SpeakingSessionStatus,
    scrubCandidateName: boolean = false
  ): Promise<void> {
    const { practice, responses } = await this.findById(sessionId);
    if (!practice) return;

    // 1. Purge audio files from S3 / dev cache
    if (practice.userId) {
      await deleteSpeakingAudioSession(practice.userId, sessionId);
    }
    for (const resp of responses) {
      if (resp.storageKey) {
        await deleteSpeakingAudioObject(resp.storageKey);
      }
    }

    const now = new Date();

    // 2. Update dev cache
    const cachedPractice = devSessionCache.get(sessionId);
    if (cachedPractice) {
      cachedPractice.status = targetStatus;
      cachedPractice.updatedAt = now;
      if (scrubCandidateName) {
        cachedPractice.candidateName = null;
      }
    }
    const cachedResponses = devResponseCache.get(sessionId);
    if (cachedResponses) {
      for (const r of cachedResponses) {
        r.audioUrl = null;
        r.storageKey = null;
      }
    }

    // 3. Update PostgreSQL if configured
    if (process.env.DATABASE_URL) {
      try {
        await db
          .update(speakingSessions)
          .set({
            status: targetStatus,
            updatedAt: now,
            ...(scrubCandidateName ? { candidateName: null } : {}),
          })
          .where(eq(speakingSessions.id, sessionId));

        await db
          .update(speakingResponses)
          .set({
            audioUrl: null,
            storageKey: null,
          })
          .where(eq(speakingResponses.sessionId, sessionId));
      } catch (err) {
        console.warn(
          `[SpeakingPracticeRepository] purgeSessionAudioAndSetStatus failed for ${sessionId}:`,
          err
        );
        throw err;
      }
    }
  }

  async markAbandonedAndPurgeAudio(sessionId: string): Promise<void> {
    await this.purgeSessionAudioAndSetStatus(sessionId, "abandoned", false);
  }

  async purgeCompletedSessionAudio(sessionId: string): Promise<void> {
    await this.purgeSessionAudioAndSetStatus(sessionId, "audio_purged", true);
  }

  async hardDeleteSession(
    sessionId: string,
    userId: string,
    preResolvedPractice?: SpeakingPracticeRecord,
    preResolvedResponses?: SpeakingResponseRecord[]
  ): Promise<boolean> {
    const practice =
      preResolvedPractice || (await this.findById(sessionId)).practice;
    const responses =
      preResolvedResponses || (await this.findById(sessionId)).responses;

    if (!practice) return false;
    if (practice.userId !== userId) return false;

    // 1. Purge audio files
    await deleteSpeakingAudioSession(userId, sessionId);
    for (const resp of responses) {
      if (resp.storageKey) {
        await deleteSpeakingAudioObject(resp.storageKey);
      }
    }

    // 2. Delete from dev cache
    devSessionCache.delete(sessionId);
    devResponseCache.delete(sessionId);

    // 3. Delete from DB if configured (cascade takes care of responses and review annotations)
    if (process.env.DATABASE_URL) {
      try {
        await db
          .delete(speakingSessions)
          .where(
            and(
              eq(speakingSessions.id, sessionId),
              eq(speakingSessions.userId, userId)
            )
          );
      } catch (err) {
        console.error(
          "[SpeakingPracticeRepository] Database hard delete failed:",
          err
        );
        throw err;
      }
    }

    return true;
  }
}

export const speakingPracticeRepository = new SpeakingPracticeRepository();
