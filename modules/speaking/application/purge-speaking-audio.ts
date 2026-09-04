import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import { recordTelemetryEvent } from "@/modules/telemetry/infrastructure/telemetry-repository";

export interface PurgeExpiredAudioOptions {
  /**
   * Threshold for incomplete/in_progress sessions with no activity.
   * Default: 24 hours (86,400,000 ms) per ADR-0010 & Acceptance Contract §5.1.
   */
  abandonedThresholdMs?: number;

  /**
   * Retention window for completed practice audio binaries.
   * Default: 14 days (1,209,600,000 ms) per ADR-0010 & Acceptance Contract §5.1.
   */
  retentionThresholdMs?: number;

  /**
   * If true, identifies target sessions without mutating database or deleting storage objects.
   */
  dryRun?: boolean;
}

export interface PurgeExpiredAudioResult {
  abandonedPurgedCount: number;
  completedPurgedCount: number;
  abandonedSessionIds: string[];
  completedSessionIds: string[];
  errors: string[];
}

const DEFAULT_ABANDONED_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_RETENTION_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Shared batch runner executing the purge action and emitting audit telemetry for each session.
 */
async function purgeSessionBatch(
  sessions: Array<{
    practice: {
      id: string;
      userId?: string | null;
      topicTitle?: string | null;
      overallBand?: number | null;
    };
  }>,
  dryRun: boolean,
  action: (sessionId: string) => Promise<void>,
  telemetryProps: (practice: {
    topicTitle?: string | null;
    overallBand?: number | null;
  }) => Record<string, unknown>
): Promise<string[]> {
  const purgedIds: string[] = [];

  for (const item of sessions) {
    const sessionId = item.practice.id;
    if (!dryRun) {
      await action(sessionId);

      if (item.practice.userId) {
        try {
          await recordTelemetryEvent({
            userId: item.practice.userId,
            userRole: "system",
            eventName: "practice_purged",
            contextType: "practice",
            contextId: sessionId,
            properties: telemetryProps(item.practice),
          });
        } catch (err) {
          console.warn(
            `[purgeSessionBatch] Telemetry dispatch warning for ${sessionId}:`,
            err
          );
        }
      }
    }
    purgedIds.push(sessionId);
  }

  return purgedIds;
}

/**
 * Identifies and purges incomplete/abandoned practice sessions (> 24h inactivity).
 * Transitions status to 'abandoned' and deletes temporary audio objects.
 */
export async function purgeAbandonedSessions(
  olderThanMs: number = DEFAULT_ABANDONED_THRESHOLD_MS,
  dryRun: boolean = false
): Promise<string[]> {
  const abandonedList =
    await speakingPracticeRepository.findAbandonedSessions(olderThanMs);
  return purgeSessionBatch(
    abandonedList,
    dryRun,
    (sessionId) =>
      speakingPracticeRepository.markAbandonedAndPurgeAudio(sessionId),
    (practice) => ({
      reason: "abandoned_24h",
      topicTitle: practice.topicTitle,
    })
  );
}

/**
 * Identifies completed/evaluated practice sessions (> 14 days) and purges audio binaries.
 * Transitions status to 'audio_purged' while preserving scores, metrics, and transcripts.
 */
export async function purgeCompletedAudioBinaries(
  olderThanMs: number = DEFAULT_RETENTION_THRESHOLD_MS,
  dryRun: boolean = false
): Promise<string[]> {
  const completedList =
    await speakingPracticeRepository.findCompletedSessionsForAudioPurge(
      olderThanMs
    );
  return purgeSessionBatch(
    completedList,
    dryRun,
    (sessionId) =>
      speakingPracticeRepository.purgeCompletedSessionAudio(sessionId),
    (practice) => ({
      reason: "retention_14d",
      overallBand: practice.overallBand,
      topicTitle: practice.topicTitle,
    })
  );
}

/**
 * Unified maintenance orchestrator for Speaking audio retention policies (ADR-0010).
 * Executable via CLI or scheduled cron runner.
 */
export async function purgeExpiredAudio(
  options: PurgeExpiredAudioOptions = {}
): Promise<PurgeExpiredAudioResult> {
  const {
    abandonedThresholdMs = DEFAULT_ABANDONED_THRESHOLD_MS,
    retentionThresholdMs = DEFAULT_RETENTION_THRESHOLD_MS,
    dryRun = false,
  } = options;

  const errors: string[] = [];
  let abandonedSessionIds: string[] = [];
  let completedSessionIds: string[] = [];

  try {
    abandonedSessionIds = await purgeAbandonedSessions(
      abandonedThresholdMs,
      dryRun
    );
  } catch (err) {
    const msg = `Failed to purge abandoned sessions: ${(err as Error)?.message || err}`;
    console.error(`[purgeExpiredAudio] ${msg}`);
    errors.push(msg);
  }

  try {
    completedSessionIds = await purgeCompletedAudioBinaries(
      retentionThresholdMs,
      dryRun
    );
  } catch (err) {
    const msg = `Failed to purge completed audio binaries: ${(err as Error)?.message || err}`;
    console.error(`[purgeExpiredAudio] ${msg}`);
    errors.push(msg);
  }

  return {
    abandonedPurgedCount: abandonedSessionIds.length,
    completedPurgedCount: completedSessionIds.length,
    abandonedSessionIds,
    completedSessionIds,
    errors,
  };
}
