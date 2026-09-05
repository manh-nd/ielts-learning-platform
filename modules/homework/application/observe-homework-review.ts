import { recordTelemetryEvent } from "@/modules/telemetry/infrastructure/telemetry-repository";

/** Observation must never invalidate a committed review command, even on a synchronous throw. */
export function observeHomeworkReview(
  event: Parameters<typeof recordTelemetryEvent>[0]
): void {
  try {
    void recordTelemetryEvent(event).catch(() => {});
  } catch {
    // Best-effort telemetry.
  }
}
