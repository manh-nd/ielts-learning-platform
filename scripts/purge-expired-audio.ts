import { client } from "@/lib/db";
import { purgeExpiredAudio } from "@/modules/speaking/application/purge-speaking-audio";

export async function runPurgeExpiredAudioCli(
  args: string[] = process.argv.slice(2)
) {
  const isDryRun = args.includes("--dry-run");

  let abandonedThresholdMs: number | undefined;
  let retentionThresholdMs: number | undefined;

  for (const arg of args) {
    if (arg.startsWith("--abandoned-hours=")) {
      const hours = parseFloat(arg.split("=")[1]);
      if (!isNaN(hours)) {
        abandonedThresholdMs = hours * 60 * 60 * 1000;
      }
    }
    if (arg.startsWith("--retention-days=")) {
      const days = parseFloat(arg.split("=")[1]);
      if (!isNaN(days)) {
        retentionThresholdMs = days * 24 * 60 * 60 * 1000;
      }
    }
  }

  console.log("============================================================");
  console.log("🧹 [Retention] Starting IELTS Speaking Audio Purge Routine");
  console.log("============================================================");
  console.log(`Mode: ${isDryRun ? "DRY RUN (No deletions)" : "LIVE PURGE"}`);
  console.log(
    `Abandoned Practice Threshold: ${
      abandonedThresholdMs ? abandonedThresholdMs / (60 * 60 * 1000) : 24
    } hours`
  );
  console.log(
    `Completed Practice Audio Retention: ${
      retentionThresholdMs ? retentionThresholdMs / (24 * 60 * 60 * 1000) : 14
    } days`
  );
  console.log("------------------------------------------------------------");

  const startTime = Date.now();
  const result = await purgeExpiredAudio({
    abandonedThresholdMs,
    retentionThresholdMs,
    dryRun: isDryRun,
  });
  const durationMs = Date.now() - startTime;

  console.log("\n============================================================");
  console.log("✅ [Retention] Purge Execution Summary");
  console.log("============================================================");
  console.table([
    {
      Workflow: "Abandoned Practice (> 24h)",
      Count: result.abandonedPurgedCount,
      "Target IDs":
        result.abandonedSessionIds.slice(0, 5).join(", ") +
        (result.abandonedSessionIds.length > 5 ? "..." : ""),
    },
    {
      Workflow: "Completed Audio Binaries (> 14d)",
      Count: result.completedPurgedCount,
      "Target IDs":
        result.completedSessionIds.slice(0, 5).join(", ") +
        (result.completedSessionIds.length > 5 ? "..." : ""),
    },
  ]);
  console.log(`Elapsed Time: ${durationMs}ms`);

  if (result.errors.length > 0) {
    console.error("⚠️ Errors encountered during purge execution:");
    for (const err of result.errors) {
      console.error(`- ${err}`);
    }
  }
  console.log("============================================================\n");

  return result;
}

if (import.meta.main) {
  runPurgeExpiredAudioCli()
    .then(async () => {
      if (process.env.DATABASE_URL) {
        await client.end();
      }
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ [Retention] Purge routine failed with error:", err);
      if (process.env.DATABASE_URL) {
        await client.end();
      }
      process.exit(1);
    });
}
