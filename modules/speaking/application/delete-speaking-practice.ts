import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { recordTelemetryEvent } from "@/modules/telemetry/infrastructure/telemetry-repository";

export interface DeleteSpeakingPracticeInput {
  authenticatedUserId: string;
  sessionId: string;
}

export interface DeleteSpeakingPracticeResult {
  success: boolean;
  sessionId: string;
}

/**
 * Permanently deletes a SpeakingPractice session, its response records, and original audio files.
 * Enforces strict Learner ownership:
 * - 404 NotFound if session does not exist.
 * - 403 Forbidden if session belongs to another user.
 * - Records 'practice_purged' telemetry event with reason 'learner_hard_delete'.
 */
export async function deleteSpeakingPractice(
  input: DeleteSpeakingPracticeInput
): Promise<DeleteSpeakingPracticeResult> {
  const { authenticatedUserId, sessionId } = input;

  if (!sessionId) {
    throw new ValidationError("Missing required sessionId parameter");
  }

  if (!authenticatedUserId) {
    throw new ForbiddenError(
      "Authentication required to delete practice session"
    );
  }

  const { practice, responses } =
    await speakingPracticeRepository.findById(sessionId);

  if (!practice) {
    throw new NotFoundError("Session not found");
  }

  if (!practice.userId || practice.userId !== authenticatedUserId) {
    throw new ForbiddenError(
      "Cannot delete a practice session belonging to another user"
    );
  }

  await speakingPracticeRepository.hardDeleteSession(
    sessionId,
    authenticatedUserId,
    practice,
    responses
  );

  // Record telemetry event for compliance & data governance audit
  try {
    await recordTelemetryEvent({
      userId: authenticatedUserId,
      userRole: "learner",
      eventName: "practice_purged",
      contextType: "practice",
      contextId: sessionId,
      properties: {
        reason: "learner_hard_delete",
        topicTitle: practice.topicTitle,
      },
    });
  } catch (err) {
    console.warn(
      "[deleteSpeakingPractice] Non-blocking telemetry dispatch warning:",
      err
    );
  }

  return {
    success: true,
    sessionId,
  };
}
