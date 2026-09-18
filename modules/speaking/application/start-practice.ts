import { getLearnerConsentDate } from "@/modules/identity/application/learner-consent";
import { getPracticePlan } from "./get-practice-plan";
import { normalizeSpeakingPracticeScope } from "../domain";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import {
  admitBetaPractice,
  assertBetaAccess,
} from "../infrastructure/speaking-beta-access";

export async function startPractice(input: {
  userId: string;
  candidateName: string;
  sessionId: string;
  topicId?: string;
  topicTitle?: string;
  targetPart?: unknown;
}) {
  const scope =
    input.targetPart == null
      ? "part_1"
      : normalizeSpeakingPracticeScope(input.targetPart);
  if (!scope)
    throw new ValidationError(
      "Invalid practice scope. Choose Part 1, Part 2, or Part 3. Full Mock is not SpeakingPractice."
    );
  assertBetaAccess(input.userId, scope);
  if (
    process.env.SPEAKING_BETA_ENABLED === "true" &&
    !(await getLearnerConsentDate(input.userId))
  )
    throw new ForbiddenError(
      "Accept the audio processing notice before starting practice."
    );
  const plan = input.topicId ? getPracticePlan(input.topicId, scope) : null;
  if (input.topicId && !plan)
    throw new ValidationError("Unknown practice topic.");
  if (process.env.SPEAKING_BETA_ENABLED === "true") {
    if (!plan) throw new ValidationError("A practice plan is required.");
    return admitBetaPractice({ ...input, targetPart: scope, plan });
  }
  const existing = await speakingPracticeRepository.findById(input.sessionId);
  if (existing.practice && existing.practice.userId !== input.userId)
    throw new ForbiddenError("Practice belongs to another learner.");
  return speakingPracticeRepository.createInProgress({
    ...input,
    targetPart: scope,
    plan: plan ?? undefined,
  });
}
