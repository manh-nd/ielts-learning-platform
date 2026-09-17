/**
 * Pure, framework-agnostic SpeakingPractice domain model and lifecycle policies.
 *
 * Canonical Domain Invariants (ADR-0009, CONTEXT.md):
 * - SpeakingPractice != MockTest (Learner self-practice coaching vs exam simulation).
 * - SpeakingPractice can end successfully before PracticeEvaluation completes.
 * - PracticeEnded != PracticeEvaluated: A practice ends when recording completes and
 *   authoritative OriginalAudio is committed; evaluation completion or failure
 *   never alters the validity of an ended SpeakingPractice.
 * - Evaluation failure preserves the completed status of an ended SpeakingPractice.
 * - Retry evaluation reuses the same practice identity and authoritative OriginalAudio.
 * - OriginalAudio is authoritative evidence; transcript is derived evidence.
 * - Practice feedback is learner-facing PracticeFeedback, not teacher grading.
 *
 * Strict boundary rule: Zero imports of React, Next.js, browser APIs, Drizzle,
 * Gemini SDK, storage SDKs, telemetry, or fetch.
 */

/**
 * Canonical lifecycle status of a SpeakingPractice aggregate.
 * A practice ends when recording completes and authoritative OriginalAudio is committed.
 * Practice completion is strictly decoupled from AI evaluation (PracticeEnded != PracticeEvaluated).
 */
export type SpeakingPracticeStatus =
  "in_progress" | "completed" | "abandoned" | "audio_purged";

/**
 * Lifecycle status of an asynchronous PracticeEvaluation aggregate.
 */
export type PracticeEvaluationStatus = "pending" | "ready" | "failed";

/**
 * Canonical scope for the currently shipped Speaking Practice mode.
 * Part 1 is the single supported practice mode in MVP.
 */
export type SpeakingPracticeScope = "part_1";

export const CANONICAL_SPEAKING_PRACTICE_SCOPE: SpeakingPracticeScope =
  "part_1";

/**
 * Normalizes legacy or wire representation of speaking practice scope
 * (e.g. "part1", "part_1", "part-1", "Part 1") into the canonical domain scope.
 * Rejects unrecognized scopes and Full Mock values (e.g. "full", "part2", "part3"),
 * preserving the strict distinction SpeakingPractice != MockTest.
 */
export function normalizeSpeakingPracticeScope(
  rawScope: unknown
): SpeakingPracticeScope | null {
  if (typeof rawScope !== "string") {
    return null;
  }

  const normalized = rawScope
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "part_1" || normalized === "part1") {
    return CANONICAL_SPEAKING_PRACTICE_SCOPE;
  }

  return null;
}

/**
 * Type guard for canonical SpeakingPracticeScope.
 */
export function isSpeakingPracticeScope(
  value: unknown
): value is SpeakingPracticeScope {
  return value === CANONICAL_SPEAKING_PRACTICE_SCOPE;
}

/**
 * Evaluates whether a SpeakingPractice session has ended.
 * PracticeEnded != PracticeEvaluated: A practice session ends when recording completes,
 * independent of whether AI evaluation has run, is pending, ready, or failed.
 */
export function hasPracticeEnded(status: SpeakingPracticeStatus): boolean {
  return status === "completed" || status === "audio_purged";
}

/**
 * Evaluates whether PracticeFeedback is available to the learner.
 * Feedback is strictly available only when AI evaluation is ready.
 */
export function isFeedbackAvailable(
  evaluationStatus: PracticeEvaluationStatus
): boolean {
  return evaluationStatus === "ready";
}

export interface PracticeEvaluationRetryInput {
  practiceStatus: SpeakingPracticeStatus;
  evaluationStatus: PracticeEvaluationStatus;
  hasAuthoritativeOriginalAudio: boolean;
}

export interface PracticeEvaluationRetryEligibility {
  eligible: boolean;
  reason?:
    | "PRACTICE_NOT_ENDED"
    | "AUDIO_UNAVAILABLE"
    | "EVALUATION_PENDING"
    | "EVALUATION_ALREADY_READY"
    | "PRACTICE_ABANDONED";
}

/**
 * Evaluates whether an evaluation retry may be initiated on a SpeakingPractice.
 *
 * Pure domain policy:
 * - Practice must have ended (`completed` status).
 * - Authoritative OriginalAudio must be present and not purged.
 * - Evaluation must have failed (`failed` status).
 * - Denied if practice is in-progress, abandoned, audio is missing/purged,
 *   evaluation is still pending, or evaluation is already ready.
 */
export function checkPracticeEvaluationRetryEligibility(
  input: PracticeEvaluationRetryInput
): PracticeEvaluationRetryEligibility {
  if (input.practiceStatus === "abandoned") {
    return { eligible: false, reason: "PRACTICE_ABANDONED" };
  }

  if (!hasPracticeEnded(input.practiceStatus)) {
    return { eligible: false, reason: "PRACTICE_NOT_ENDED" };
  }

  if (
    input.practiceStatus === "audio_purged" ||
    !input.hasAuthoritativeOriginalAudio
  ) {
    return { eligible: false, reason: "AUDIO_UNAVAILABLE" };
  }

  if (input.evaluationStatus === "ready") {
    return { eligible: false, reason: "EVALUATION_ALREADY_READY" };
  }

  if (input.evaluationStatus === "pending") {
    return { eligible: false, reason: "EVALUATION_PENDING" };
  }

  return { eligible: true };
}

/**
 * Predicate helper for retry eligibility.
 */
export function canRetryPracticeEvaluation(
  input: PracticeEvaluationRetryInput
): boolean {
  return checkPracticeEvaluationRetryEligibility(input).eligible;
}

export interface ConversationReplayAttachmentEligibility {
  eligible: boolean;
  reason?: "PRACTICE_NOT_ENDED" | "PRACTICE_ABANDONED" | "AUDIO_PURGED";
}

/**
 * Pure domain policy evaluating whether a SpeakingPractice session is currently eligible
 * to attach a new derived ConversationReplay audio artifact.
 *
 * Invariant:
 * - "completed"  -> ALLOW (session ended, authoritative audio committed)
 * - "evaluated"  -> ALLOW (legacy persistence status, session ended & feedback ready)
 * - "in_progress" -> REJECT (session still active, cannot attach premature replay)
 * - "abandoned"   -> REJECT (session abandoned, cannot attach replay)
 * - "audio_purged" -> REJECT (audio retention window expired or user hard-deleted;
 *                            cannot resurrect audio after purge)
 */
export function canAttachConversationReplay(
  persistenceStatus: string
): ConversationReplayAttachmentEligibility {
  if (persistenceStatus === "completed" || persistenceStatus === "evaluated") {
    return { eligible: true };
  }
  if (persistenceStatus === "audio_purged") {
    return { eligible: false, reason: "AUDIO_PURGED" };
  }
  if (persistenceStatus === "abandoned") {
    return { eligible: false, reason: "PRACTICE_ABANDONED" };
  }
  return { eligible: false, reason: "PRACTICE_NOT_ENDED" };
}

/**
 * Canonical Part 1 Speaking Practice question entity with explicit, stable identity.
 *
 * Invariant:
 * - Every Part 1 practice question has a stable questionId (`id`).
 * - Identity does NOT depend on array position, current turn index, transcript order,
 *   React state, or Gemini state.
 */
export interface Part1Question {
  /** Explicit, stable question identifier */
  id: string;
  /** The question prompt text */
  text: string;
  /** Explicit 1-based order within the topic / practice set */
  order: number;
}

/**
 * Creates a domain Part1Question ensuring domain invariants are satisfied.
 */
export function createPart1Question(params: {
  id: string;
  text: string;
  order: number;
}): Part1Question {
  const trimmedId = params.id?.trim();
  if (!trimmedId) {
    throw new Error("Part1Question requires a non-empty stable id");
  }
  const trimmedText = params.text?.trim();
  if (!trimmedText) {
    throw new Error("Part1Question requires non-empty question text");
  }
  if (
    typeof params.order !== "number" ||
    !Number.isInteger(params.order) ||
    params.order < 1
  ) {
    throw new Error("Part1Question order must be a positive integer");
  }
  return {
    id: trimmedId,
    text: trimmedText,
    order: params.order,
  };
}

/**
 * Type guard for Part1Question object.
 */
export function isPart1Question(value: unknown): value is Part1Question {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.text === "string" &&
    candidate.text.trim().length > 0 &&
    typeof candidate.order === "number" &&
    Number.isInteger(candidate.order) &&
    candidate.order >= 1
  );
}

/**
 * Pure domain representation of a Part 1 Speaking Practice Plan.
 *
 * Invariants:
 * - Explicit topic identity (`topicId`).
 * - Part 1 theme / context (`theme`).
 * - Ordered Part1Question entities where order is defined by question metadata, not array position.
 */
export interface Part1PracticePlan {
  /** Explicit topic identifier */
  topicId: string;
  /** Part 1 theme / topic title */
  theme: string;
  /** Ordered list of Part1Question domain entities */
  questions: readonly Part1Question[];
}

/**
 * Creates a domain Part1PracticePlan ensuring invariants are satisfied.
 */
export function createPart1PracticePlan(params: {
  topicId: string;
  theme: string;
  questions: readonly Part1Question[];
}): Part1PracticePlan {
  const trimmedTopicId = params.topicId?.trim();
  if (!trimmedTopicId) {
    throw new Error("Part1PracticePlan requires a non-empty topicId");
  }
  const trimmedTheme = params.theme?.trim();
  if (!trimmedTheme) {
    throw new Error("Part1PracticePlan requires a non-empty theme");
  }
  if (!Array.isArray(params.questions) || params.questions.length === 0) {
    throw new Error("Part1PracticePlan requires at least one question");
  }
  for (const q of params.questions) {
    if (!isPart1Question(q)) {
      throw new Error(
        "Part1PracticePlan questions must be valid Part1Question entities"
      );
    }
  }

  return {
    topicId: trimmedTopicId,
    theme: trimmedTheme,
    questions: Object.freeze([...params.questions]),
  };
}

/**
 * Type guard for Part1PracticePlan object.
 */
export function isPart1PracticePlan(
  value: unknown
): value is Part1PracticePlan {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.topicId === "string" &&
    candidate.topicId.trim().length > 0 &&
    typeof candidate.theme === "string" &&
    candidate.theme.trim().length > 0 &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length > 0 &&
    candidate.questions.every(isPart1Question)
  );
}

/**
 * Pure domain representation of learner turns in a speaking practice session.
 *
 * Invariants:
 * - Distinguishes identity_check (learner name/intro) from practice_answer (response to prompt question).
 * - identity_check MUST NOT reference a questionId.
 * - practice_answer MUST reference an explicit questionId.
 * - endedAtMs >= startedAtMs for valid duration.
 * - OriginalAudio is authoritative evidence; transcript is optional derived text.
 */
export type PracticeTurnKind = "identity_check" | "practice_answer";

export interface BasePracticeTurn {
  kind: PracticeTurnKind;
  startedAtMs: number;
  endedAtMs: number;
  /** Optional derived transcript text */
  transcript?: string;
}

export interface IdentityCheckTurn extends BasePracticeTurn {
  kind: "identity_check";
}

export interface PracticeAnswerTurn extends BasePracticeTurn {
  kind: "practice_answer";
  questionId: string;
}

export type PracticeTurn = IdentityCheckTurn | PracticeAnswerTurn;

/**
 * Creates an identity_check domain turn (e.g. learner responding to full name prompt).
 */
export function createIdentityCheckTurn(params: {
  startedAtMs: number;
  endedAtMs: number;
  transcript?: string;
}): IdentityCheckTurn {
  if (
    typeof params.startedAtMs !== "number" ||
    typeof params.endedAtMs !== "number" ||
    Number.isNaN(params.startedAtMs) ||
    Number.isNaN(params.endedAtMs)
  ) {
    throw new Error("PracticeTurn timestamps must be valid numbers");
  }
  if (params.startedAtMs < 0 || params.endedAtMs < 0) {
    throw new Error("PracticeTurn timestamps must be non-negative");
  }
  if (params.endedAtMs < params.startedAtMs) {
    throw new Error(
      "PracticeTurn endedAtMs must be greater than or equal to startedAtMs"
    );
  }
  return {
    kind: "identity_check",
    startedAtMs: params.startedAtMs,
    endedAtMs: params.endedAtMs,
    ...(params.transcript !== undefined
      ? { transcript: params.transcript }
      : {}),
  };
}

/**
 * Creates a practice_answer domain turn for a specific Part 1 question.
 */
export function createPracticeAnswerTurn(params: {
  questionId: string;
  startedAtMs: number;
  endedAtMs: number;
  transcript?: string;
}): PracticeAnswerTurn {
  const trimmedQuestionId = params.questionId?.trim();
  if (!trimmedQuestionId) {
    throw new Error("PracticeAnswerTurn requires a non-empty questionId");
  }
  if (
    typeof params.startedAtMs !== "number" ||
    typeof params.endedAtMs !== "number" ||
    Number.isNaN(params.startedAtMs) ||
    Number.isNaN(params.endedAtMs)
  ) {
    throw new Error("PracticeTurn timestamps must be valid numbers");
  }
  if (params.startedAtMs < 0 || params.endedAtMs < 0) {
    throw new Error("PracticeTurn timestamps must be non-negative");
  }
  if (params.endedAtMs < params.startedAtMs) {
    throw new Error(
      "PracticeTurn endedAtMs must be greater than or equal to startedAtMs"
    );
  }
  return {
    kind: "practice_answer",
    questionId: trimmedQuestionId,
    startedAtMs: params.startedAtMs,
    endedAtMs: params.endedAtMs,
    ...(params.transcript !== undefined
      ? { transcript: params.transcript }
      : {}),
  };
}

/**
 * Type guard for PracticeTurn object.
 */
export function isPracticeTurn(value: unknown): value is PracticeTurn {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.startedAtMs !== "number" ||
    typeof candidate.endedAtMs !== "number" ||
    candidate.startedAtMs < 0 ||
    candidate.endedAtMs < candidate.startedAtMs
  ) {
    return false;
  }
  if (candidate.kind === "identity_check") {
    return !("questionId" in candidate) || candidate.questionId === undefined;
  }
  if (candidate.kind === "practice_answer") {
    return (
      typeof candidate.questionId === "string" &&
      candidate.questionId.trim().length > 0
    );
  }
  return false;
}

export interface Part1PracticeCompletionResult {
  canComplete: boolean;
  totalRequiredQuestions: number;
  answeredQuestionCount: number;
  missingQuestionIds: string[];
}

/**
 * Pure domain policy evaluating whether a Part 1 speaking practice session has satisfied
 * its required question-answer progression.
 *
 * Invariants:
 * - identity_check turns do NOT count as answered Part 1 questions.
 * - Each required question in the practice plan must have at least one practice_answer turn.
 * - Completion relies strictly on domain identity (`questionId`), independent of turn order or array position.
 * - Answers for unknown questions or duplicate answers do not improperly affect completion.
 * - Domain completion policy is framework-agnostic and strictly decoupled from LLM/Gemini tool calls.
 */
export function checkPart1PracticeCompletion(
  plan: Part1PracticePlan,
  turns: readonly PracticeTurn[]
): Part1PracticeCompletionResult {
  const requiredQuestionIds = plan.questions.map((q) => q.id);
  const answeredQuestionIds = new Set<string>();

  for (const turn of turns) {
    if (turn.kind === "practice_answer" && turn.questionId) {
      if (requiredQuestionIds.includes(turn.questionId)) {
        answeredQuestionIds.add(turn.questionId);
      }
    }
  }

  const missingQuestionIds = requiredQuestionIds.filter(
    (id) => !answeredQuestionIds.has(id)
  );

  return {
    canComplete:
      missingQuestionIds.length === 0 && requiredQuestionIds.length > 0,
    totalRequiredQuestions: requiredQuestionIds.length,
    answeredQuestionCount: answeredQuestionIds.size,
    missingQuestionIds,
  };
}

/**
 * Predicate helper for Part 1 practice completion.
 */
export function canCompletePart1Practice(
  plan: Part1PracticePlan,
  turns: readonly PracticeTurn[]
): boolean {
  return checkPart1PracticeCompletion(plan, turns).canComplete;
}
