/**
 * Telemetry Domain Taxonomy & Contracts (Acceptance Contract §7.1, §7.2)
 */

export const SPEAKING_PRACTICE_EVENT_NAMES = [
  "practice_started",
  "practice_audio_recorded",
  "practice_submitted_for_feedback",
  "practice_feedback_ready",
  "practice_again_started",
  "practice_audio_error",
  "practice_purged",
] as const;

export const SPEAKING_HOMEWORK_EVENT_NAMES = [
  "homework_viewed",
  "homework_record_completed",
  "homework_submitted",
  "homework_resubmitted",
  "homework_submit_conflict_rejected",
  "teacher_review_opened",
  "teacher_ai_proposal_accepted",
  "teacher_ai_proposal_rejected",
  "teacher_assessment_published",
] as const;

export const TELEMETRY_EVENT_NAMES = [
  ...SPEAKING_PRACTICE_EVENT_NAMES,
  ...SPEAKING_HOMEWORK_EVENT_NAMES,
] as const;

export type TelemetrySpeakingPracticeEventName =
  (typeof SPEAKING_PRACTICE_EVENT_NAMES)[number];
export type TelemetrySpeakingHomeworkEventName =
  (typeof SPEAKING_HOMEWORK_EVENT_NAMES)[number];
export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];

export const TELEMETRY_USER_ROLES = ["learner", "teacher", "system"] as const;
export type TelemetryUserRole = (typeof TELEMETRY_USER_ROLES)[number];

export const TELEMETRY_CONTEXT_TYPES = [
  "practice",
  "homework",
  "system",
] as const;
export type TelemetryContextType = (typeof TELEMETRY_CONTEXT_TYPES)[number];

export function isValidTelemetryEventName(
  name: unknown
): name is TelemetryEventName {
  return (
    typeof name === "string" &&
    (TELEMETRY_EVENT_NAMES as readonly string[]).includes(name)
  );
}

export function isValidTelemetryContextType(
  type: unknown
): type is TelemetryContextType {
  return (
    typeof type === "string" &&
    (TELEMETRY_CONTEXT_TYPES as readonly string[]).includes(type)
  );
}

export function isValidTelemetryUserRole(
  role: unknown
): role is TelemetryUserRole {
  return (
    typeof role === "string" &&
    (TELEMETRY_USER_ROLES as readonly string[]).includes(role)
  );
}

export const ROLE_ALLOWED_EVENTS: Record<
  TelemetryUserRole,
  readonly TelemetryEventName[]
> = {
  learner: [
    "practice_started",
    "practice_audio_recorded",
    "practice_submitted_for_feedback",
    "practice_feedback_ready",
    "practice_again_started",
    "practice_audio_error",
    "homework_viewed",
    "homework_record_completed",
    "homework_submitted",
    "homework_resubmitted",
  ],
  teacher: [
    "homework_viewed",
    "teacher_review_opened",
    "teacher_ai_proposal_accepted",
    "teacher_ai_proposal_rejected",
    "teacher_assessment_published",
  ],
  system: [...TELEMETRY_EVENT_NAMES],
} as const;

export function isRoleAuthorizedForEvent(
  role: TelemetryUserRole,
  eventName: TelemetryEventName
): boolean {
  const allowed = ROLE_ALLOWED_EVENTS[role];
  return Boolean(allowed && allowed.includes(eventName));
}

export interface TelemetryEventInput {
  userId?: string;
  userRole?: TelemetryUserRole;
  eventName: TelemetryEventName;
  contextType: TelemetryContextType;
  contextId?: string | null;
  durationMs?: number | null;
  properties?: Record<string, unknown> | null;
}

export interface TelemetryEventRecord {
  id: string;
  userId: string;
  userRole: TelemetryUserRole;
  eventName: TelemetryEventName;
  contextType: TelemetryContextType;
  contextId: string | null;
  durationMs: number | null;
  properties: Record<string, unknown>;
  createdAt: Date;
}
