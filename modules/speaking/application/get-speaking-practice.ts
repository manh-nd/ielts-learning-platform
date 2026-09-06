import {
  speakingPracticeRepository,
  SpeakingPracticeRecord,
  SpeakingResponseRecord,
} from "../infrastructure/speaking-practice-repository";
import { NotFoundError, ValidationError } from "@/lib/errors";

export interface GetSpeakingPracticeInput {
  authenticatedUserId: string;
  sessionId: string;
}

export interface GetSpeakingPracticeResult {
  session: SpeakingPracticeRecord;
  responses: SpeakingResponseRecord[];
  conversationReplay?: {
    available: boolean;
    url?: string;
    durationSeconds?: number;
  };
}

/**
 * Retrieves a SpeakingPractice session strictly owned by the authenticated Learner.
 * Returns 404 NotFound if the practice does not exist or belongs to another user.
 */
export async function getSpeakingPractice(
  input: GetSpeakingPracticeInput
): Promise<GetSpeakingPracticeResult> {
  const { authenticatedUserId, sessionId } = input;

  if (!sessionId) {
    throw new ValidationError("Missing required sessionId query parameter");
  }

  const { practice, responses } =
    await speakingPracticeRepository.findById(sessionId);

  if (!practice || practice.userId !== authenticatedUserId) {
    throw new NotFoundError("Session not found");
  }

  const replayAvailable = Boolean(
    practice.conversationReplayStorageKey && practice.status !== "audio_purged"
  );

  return {
    session: practice,
    responses,
    conversationReplay: {
      available: replayAvailable,
      ...(replayAvailable
        ? {
            url: `/api/speaking/practices/${encodeURIComponent(sessionId)}/conversation-audio`,
            durationSeconds:
              practice.conversationReplayDurationSeconds ?? undefined,
          }
        : {}),
    },
  };
}
