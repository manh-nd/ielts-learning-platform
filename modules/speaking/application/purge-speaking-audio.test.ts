import { describe, it, expect, beforeEach } from "bun:test";
import {
  purgeExpiredAudio,
  purgeAbandonedSessions,
  purgeCompletedAudioBinaries,
} from "./purge-speaking-audio";
import {
  speakingPracticeRepository,
  devSessionCache,
  devResponseCache,
} from "../infrastructure/speaking-practice-repository";
import {
  devTelemetryCache,
  clearDevTelemetryCache,
} from "@/modules/telemetry/infrastructure/telemetry-repository";
import {
  saveDirectAudioDevFallback,
  getDirectAudioDevFallback,
} from "@/lib/storage/s3-client";

describe("Speaking Audio Auto-Purge & Retention Policy (ADR-0010)", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
    clearDevTelemetryCache();
  });

  it("should purge abandoned sessions (> 24 hours) and delete audio while keeping recent sessions", async () => {
    const now = Date.now();
    const twentySixHoursAgo = new Date(now - 26 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

    // 1. Abandoned session with audio
    const oldSessionId = "ses_abandoned_26h";
    const oldAudioKey = `speaking/user_a/${oldSessionId}/candidate.webm`;
    await speakingPracticeRepository.createInProgress({
      sessionId: oldSessionId,
      userId: "user_a",
      createdAt: twentySixHoursAgo,
    });
    devSessionCache.get(oldSessionId)!.updatedAt = twentySixHoursAgo;
    await saveDirectAudioDevFallback(
      oldAudioKey,
      Buffer.from("abandoned-audio"),
      "audio/webm"
    );

    // 2. Fresh session (< 24h) with audio
    const freshSessionId = "ses_active_2h";
    const freshAudioKey = `speaking/user_b/${freshSessionId}/candidate.webm`;
    await speakingPracticeRepository.createInProgress({
      sessionId: freshSessionId,
      userId: "user_b",
      createdAt: twoHoursAgo,
    });
    devSessionCache.get(freshSessionId)!.updatedAt = twoHoursAgo;
    await saveDirectAudioDevFallback(
      freshAudioKey,
      Buffer.from("fresh-audio"),
      "audio/webm"
    );

    // Run abandoned purge
    const purgedIds = await purgeAbandonedSessions(24 * 60 * 60 * 1000);
    expect(purgedIds).toContain(oldSessionId);
    expect(purgedIds).not.toContain(freshSessionId);

    // Old session marked abandoned, audio purged
    const oldFound = await speakingPracticeRepository.findById(oldSessionId);
    expect(oldFound.practice?.status).toBe("abandoned");
    expect(await getDirectAudioDevFallback(oldAudioKey)).toBeNull();

    // Fresh session remains in_progress, audio intact
    const freshFound =
      await speakingPracticeRepository.findById(freshSessionId);
    expect(freshFound.practice?.status).toBe("in_progress");
    expect(await getDirectAudioDevFallback(freshAudioKey)).not.toBeNull();

    // Telemetry event recorded
    const abandonedEvents = devTelemetryCache.filter(
      (e) => e.eventName === "practice_purged" && e.contextId === oldSessionId
    );
    expect(abandonedEvents.length).toBe(1);
    expect(abandonedEvents[0].properties.reason).toBe("abandoned_24h");
  });

  it("should purge completed audio (> 14 days), transition to audio_purged, and retain score metadata", async () => {
    const now = Date.now();
    const fifteenDaysAgo = new Date(now - 15 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

    // 1. Session completed 15 days ago
    const oldCompletedId = "ses_completed_15d";
    const oldAudioKey = `speaking/user_c/${oldCompletedId}/candidate.webm`;
    await speakingPracticeRepository.commitCompleted({
      sessionId: oldCompletedId,
      userId: "user_c",
      candidateName: "Learner C",
      topicTitle: "Environment",
      durationSeconds: 110,
      storageKey: oldAudioKey,
      audioUrl: `/api/speaking/upload-direct?key=${encodeURIComponent(oldAudioKey)}`,
    });
    await speakingPracticeRepository.markEvaluated({
      sessionId: oldCompletedId,
      userId: "user_c",
      scorecardJson: { overallBand: 8.0, lexicalResource: 8.5 },
      evidenceJson: { trace: {} },
      verifiedTranscript: "Climate change is a pressing global challenge.",
    });
    devSessionCache.get(oldCompletedId)!.createdAt = fifteenDaysAgo;
    devSessionCache.get(oldCompletedId)!.updatedAt = fifteenDaysAgo;
    await saveDirectAudioDevFallback(
      oldAudioKey,
      Buffer.from("candidate-audio-15d"),
      "audio/webm"
    );

    // 2. Session completed 3 days ago (< 14d)
    const recentCompletedId = "ses_completed_3d";
    const recentAudioKey = `speaking/user_d/${recentCompletedId}/candidate.webm`;
    await speakingPracticeRepository.commitCompleted({
      sessionId: recentCompletedId,
      userId: "user_d",
      candidateName: "Learner D",
      topicTitle: "Sports",
      durationSeconds: 95,
      storageKey: recentAudioKey,
      audioUrl: `/api/speaking/upload-direct?key=${encodeURIComponent(recentAudioKey)}`,
    });
    devSessionCache.get(recentCompletedId)!.createdAt = threeDaysAgo;
    devSessionCache.get(recentCompletedId)!.updatedAt = threeDaysAgo;
    await saveDirectAudioDevFallback(
      recentAudioKey,
      Buffer.from("candidate-audio-3d"),
      "audio/webm"
    );

    // Run 14-day completed audio purge
    const purgedIds = await purgeCompletedAudioBinaries(
      14 * 24 * 60 * 60 * 1000
    );
    expect(purgedIds).toContain(oldCompletedId);
    expect(purgedIds).not.toContain(recentCompletedId);

    // Old session transitioned to audio_purged; audio binary deleted
    const oldFound = await speakingPracticeRepository.findById(oldCompletedId);
    expect(oldFound.practice?.status).toBe("audio_purged");
    // Candidate name scrubbed for score anonymization per ADR-0010
    expect(oldFound.practice?.candidateName).toBeNull();
    // User ID preserved so learner can see past evaluation on dashboard
    expect(oldFound.practice?.userId).toBe("user_c");
    expect(await getDirectAudioDevFallback(oldAudioKey)).toBeNull();

    // Invariant: Scores and metadata are preserved!
    expect(oldFound.practice?.overallBand).toBeNull(); // overallBand in commitCompleted
    expect(oldFound.practice?.scorecardJson).toEqual({
      overallBand: 8.0,
      lexicalResource: 8.5,
    });
    expect(oldFound.responses[0].verifiedTranscript).toBe(
      "Climate change is a pressing global challenge."
    );
    expect(oldFound.responses[0].audioUrl).toBeNull();

    // Recent session remains evaluated/completed with audio intact
    const recentFound =
      await speakingPracticeRepository.findById(recentCompletedId);
    expect(recentFound.practice?.status).toBe("completed");
    expect(recentFound.practice?.candidateName).toBe("Learner D");
    expect(await getDirectAudioDevFallback(recentAudioKey)).not.toBeNull();

    // Telemetry event recorded
    const purge14dEvents = devTelemetryCache.filter(
      (e) => e.eventName === "practice_purged" && e.contextId === oldCompletedId
    );
    expect(purge14dEvents.length).toBe(1);
    expect(purge14dEvents[0].properties.reason).toBe("retention_14d");
  });

  it("should support dryRun mode without modifying sessions or deleting audio", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionId = "ses_dry_run";
    const audioKey = `speaking/user_e/${sessionId}/candidate.webm`;

    await speakingPracticeRepository.commitCompleted({
      sessionId,
      userId: "user_e",
      candidateName: "Dry Run",
      topicTitle: "Books",
      durationSeconds: 60,
      storageKey: audioKey,
    });
    devSessionCache.get(sessionId)!.createdAt = thirtyDaysAgo;
    devSessionCache.get(sessionId)!.updatedAt = thirtyDaysAgo;
    await saveDirectAudioDevFallback(
      audioKey,
      Buffer.from("dry-run-audio"),
      "audio/webm"
    );

    const result = await purgeExpiredAudio({
      retentionThresholdMs: 14 * 24 * 60 * 60 * 1000,
      dryRun: true,
    });

    expect(result.completedPurgedCount).toBe(1);
    expect(result.completedSessionIds).toContain(sessionId);

    // Verify session was NOT updated
    const found = await speakingPracticeRepository.findById(sessionId);
    expect(found.practice?.status).toBe("completed");

    // Verify audio was NOT deleted
    expect(await getDirectAudioDevFallback(audioKey)).not.toBeNull();
  });
});
