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

export interface PublicSpeakingPracticeDto {
  id: string;
  userId: string | null;
  candidateName: string | null;
  topicTitle: string;
  status: string;
  targetPart: string;
  durationSeconds: number;
  overallBand: number | null;
  scorecardJson: unknown | null;
  evidenceJson: unknown | null;
  conversationReplayAvailable: boolean;
  conversationReplayUrl?: string;
  conversationReplayDurationSeconds?: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicSpeakingPracticeDto(
  record: SpeakingPracticeRecord
): PublicSpeakingPracticeDto {
  const replayAvailable = Boolean(
    record.conversationReplayStorageKey && record.status !== "audio_purged"
  );

  return {
    id: record.id,
    userId: record.userId,
    candidateName: record.candidateName,
    topicTitle: record.topicTitle,
    status: record.status,
    targetPart: record.targetPart,
    durationSeconds: record.durationSeconds,
    overallBand: record.overallBand,
    scorecardJson: record.scorecardJson,
    evidenceJson: record.evidenceJson,
    conversationReplayAvailable: replayAvailable,
    ...(replayAvailable
      ? {
          conversationReplayUrl: `/api/speaking/practices/${encodeURIComponent(record.id)}/conversation-audio`,
          conversationReplayDurationSeconds:
            record.conversationReplayDurationSeconds ?? undefined,
        }
      : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export interface GetSpeakingPracticeResult {
  session: PublicSpeakingPracticeDto;
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
 * Guarantees server-internal storage metadata (like conversationReplayStorageKey) is never leaked.
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

  const publicSession = toPublicSpeakingPracticeDto(practice);

  return {
    session: publicSession,
    responses,
    conversationReplay: {
      available: publicSession.conversationReplayAvailable,
      ...(publicSession.conversationReplayAvailable
        ? {
            url: publicSession.conversationReplayUrl,
            durationSeconds: publicSession.conversationReplayDurationSeconds,
          }
        : {}),
    },
  };
}
