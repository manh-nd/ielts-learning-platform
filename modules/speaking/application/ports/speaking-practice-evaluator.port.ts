import type { SpeakingPracticeScope } from "../../domain";
import type { PracticeEvaluationResult } from "../practice-feedback";
export interface SpeakingPracticeEvaluationInput {
  practiceId?: string;
  scope?: SpeakingPracticeScope;
  topicTitle: string;
  questions: string[];
  audioBuffer?: Uint8Array;
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
  liveTranscript?: string;
  turnMarkers?: Array<{
    partNumber?: number;
    itemIndex?: number;
    promptQuestion: string;
    startMs: number;
    endMs: number;
    liveTranscript?: string;
  }>;
}
export interface SpeakingPracticeEvaluatorPort {
  evaluate(
    input: SpeakingPracticeEvaluationInput
  ): Promise<PracticeEvaluationResult>;
}
