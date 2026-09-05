/**
 * Pure, framework-agnostic submission deadline policies for Homework Assignments (Issue #95, ADR-0009).
 *
 * Domain Invariants:
 * - Creation and publishing from draft require a deadline strictly in the future relative to the given clock instant.
 * - For published assignments, the deadline may be extended (or maintained), but cannot be shortened retroactively.
 * - Time-sensitive domain functions must receive an explicit clock instant (`now: Date`).
 *
 * Strict boundary rule: Zero imports of React, Next.js, database/Drizzle,
 * storage SDKs, Gemini SDK, telemetry, or fetch.
 */

/**
 * Evaluates whether a submission deadline is strictly in the future relative to `now`.
 */
export function isSubmissionDeadlineInFuture(
  deadline: Date,
  now: Date
): boolean {
  return deadline.getTime() > now.getTime();
}

/**
 * Evaluates whether a new deadline extends or maintains an existing published deadline.
 * Published deadlines cannot be shortened retroactively.
 */
export function canExtendSubmissionDeadline(
  existingDeadline: Date,
  newDeadline: Date
): boolean {
  return newDeadline.getTime() >= existingDeadline.getTime();
}
