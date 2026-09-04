import { describe, it, expect, beforeEach } from "bun:test";
import { runPurgeExpiredAudioCli } from "./purge-expired-audio";
import {
  speakingPracticeRepository,
  devSessionCache,
  devResponseCache,
} from "@/modules/speaking/infrastructure/speaking-practice-repository";
import { clearDevTelemetryCache } from "@/modules/telemetry/infrastructure/telemetry-repository";

describe("purge-expired-audio CLI script", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
    clearDevTelemetryCache();
  });

  it("should run CLI in dry-run mode and return summary without modifying records", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await speakingPracticeRepository.createInProgress({
      sessionId: "ses_cli_abandoned",
      userId: "user_cli",
      createdAt: oldDate,
    });
    devSessionCache.get("ses_cli_abandoned")!.updatedAt = oldDate;

    const result = await runPurgeExpiredAudioCli(["--dry-run"]);
    expect(result.abandonedPurgedCount).toBe(1);
    expect(result.abandonedSessionIds).toContain("ses_cli_abandoned");

    // Session remains in_progress due to dry-run
    const found =
      await speakingPracticeRepository.findById("ses_cli_abandoned");
    expect(found.practice?.status).toBe("in_progress");
  });

  it("should respect custom --abandoned-hours and --retention-days arguments", async () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    await speakingPracticeRepository.createInProgress({
      sessionId: "ses_cli_12h",
      userId: "user_cli_12h",
      createdAt: twelveHoursAgo,
    });
    devSessionCache.get("ses_cli_12h")!.updatedAt = twelveHoursAgo;

    // With --abandoned-hours=10, 12h-old session should be identified
    const result = await runPurgeExpiredAudioCli([
      "--dry-run",
      "--abandoned-hours=10",
    ]);
    expect(result.abandonedPurgedCount).toBe(1);
    expect(result.abandonedSessionIds).toContain("ses_cli_12h");
  });
});
