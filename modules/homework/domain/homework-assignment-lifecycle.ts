import type { HomeworkAssignmentStatus } from "./homework-types";

/**
 * Pure, framework-agnostic lifecycle policies for Homework Assignments (Issue #95, ADR-0009).
 *
 * Canonical Domain Invariants:
 * - HomeworkAssignmentStatus = draft | published | archived
 * - Archived assignments are frozen and cannot be edited or reopened.
 * - Prompts are immutable once published or archived (editable only in draft status).
 * - Only draft assignments may be permanently deleted.
 * - Published assignments cannot transition back to draft status.
 * - Same-state transitions (draft -> draft, published -> published) are explicitly supported.
 *
 * Strict boundary rule: Zero imports of React, Next.js, database/Drizzle,
 * storage SDKs, Gemini SDK, telemetry, or fetch.
 */

/**
 * Checks whether an assignment can be edited based on its current status.
 * Archived assignments are frozen and cannot be modified.
 */
export function canEditHomeworkAssignment(
  status: HomeworkAssignmentStatus
): boolean {
  return status !== "archived";
}

/**
 * Checks whether prompts can be modified.
 * Prompts are immutable once published or archived; only draft status allows editing prompts.
 */
export function canEditHomeworkPrompts(
  status: HomeworkAssignmentStatus
): boolean {
  return status === "draft";
}

/**
 * Checks whether an assignment can be permanently deleted.
 * Only draft assignments may be deleted; published assignments must use archive.
 */
export function canDeleteHomeworkAssignment(
  status: HomeworkAssignmentStatus
): boolean {
  return status === "draft";
}

/**
 * Evaluates whether a transition from currentStatus to targetStatus is valid.
 * - Archived assignments are terminal and cannot transition to any status (including archived).
 * - Same-state transitions for non-archived (draft -> draft, published -> published) are permitted.
 * - draft -> published: permitted (future deadline enforced separately).
 * - draft -> archived: permitted.
 * - published -> archived: permitted.
 * - published -> draft: rejected (published cannot return to draft).
 */
export function canTransitionAssignmentStatus(
  currentStatus: HomeworkAssignmentStatus,
  targetStatus: HomeworkAssignmentStatus
): boolean {
  if (currentStatus === "archived") return false;
  if (currentStatus === targetStatus) return true;
  if (currentStatus === "published" && targetStatus === "draft") return false;
  return true;
}
