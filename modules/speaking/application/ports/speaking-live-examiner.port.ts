/**
 * Connectivity state for the realtime speaking examiner provider connection.
 * Kept strictly separate from IELTS business progression (Part 1/2/3, preparation phase, etc.).
 */
export type SpeakingLiveConnectionState =
  "idle" | "connecting" | "connected" | "reconnecting" | "failed";

/**
 * Input options required to start a realtime speaking examiner connection.
 */
export interface StartSpeakingLiveExaminerInput {
  /**
   * Transitional technical input: provider system prompt for the examiner.
   * Not a domain/business contract.
   * Expected to be removed when Part1PracticeCoordinator owns progression.
   */
  systemInstruction?: string;
  applicationControlled?: boolean;
}

/**
 * Realtime candidate audio payload passed to the examiner provider.
 */
export interface SendCandidateAudioInput {
  /** Base64-encoded realtime audio chunk from the candidate microphone. */
  audioBase64: string;
  /** MIME type of the audio encoding (e.g. "audio/pcm;rate=16000"). */
  mimeType: string;
}

/**
 * Client text turn payload sent to the examiner provider.
 */
export interface SendSpeakingExaminerTextInput {
  text: string;
}

/**
 * Semantic actions requested by the examiner provider during the session.
 * Provider-neutral domain/application representations — zero Gemini tool names or raw schemas.
 */
export type SpeakingLiveExaminerAction =
  | {
      type: "display_cue_card_requested";
      /**
       * Opaque provider request ID for acknowledgement.
       * Optional: provider tool call ID may be absent; response is sent only when present.
       */
      requestId?: string;
      topicTitle: string;
      cueCardPrompt: string;
      bulletPoints: readonly string[];
    }
  | {
      type: "part_3_start_requested";
      requestId?: string;
      topicTitle?: string;
      introComment?: string;
    }
  | {
      type: "practice_end_requested";
      requestId?: string;
      closingRemarks?: string;
    };

/**
 * Response payload acknowledging or satisfying a requested examiner action.
 */
export interface SpeakingLiveExaminerActionResponse {
  /**
   * Must match the `requestId` from the originating SpeakingLiveExaminerAction.
   * If the action had no requestId, do not invoke respondToExaminerAction.
   */
  requestId: string;
  /**
   * Provider-neutral status string.
   * The adapter translates this back into the provider-specific tool response payload.
   */
  status: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Provider-neutral realtime events emitted by the speaking examiner provider interface.
 */
export type SpeakingLiveExaminerEvent =
  | { type: "connected" }
  | { type: "resumed" }
  | { type: "reconnecting" }
  | { type: "connection_failed"; reason: string }
  /**
   * Normal/observed socket close (not an error).
   */
  | { type: "disconnected" }
  /**
   * Examiner audio chunk for playback.
   */
  | { type: "examiner_audio_chunk"; audioBase64: string; mimeType: string }
  /**
   * Incremental examiner speech transcription text chunk.
   */
  | { type: "examiner_transcript_updated"; text: string }
  /**
   * Incremental candidate speech transcription text chunk.
   */
  | { type: "candidate_transcript_updated"; text: string }
  /**
   * Candidate barged in during examiner speech.
   */
  | { type: "candidate_interrupted_examiner" }
  /**
   * Provider-generic live turn boundary signal (turnComplete).
   * Does NOT imply candidate or examiner turn completion.
   */
  | { type: "live_turn_completed" }
  /**
   * Provider has requested a semantic examiner action.
   */
  | { type: "examiner_action_requested"; action: SpeakingLiveExaminerAction };

/**
 * Application-layer port representing the realtime speaking examiner capability.
 * Completely provider-neutral (no Gemini, WebSocket, or Google SDK types exposed).
 */
export interface SpeakingLiveExaminerPort {
  connect(input: StartSpeakingLiveExaminerInput): Promise<void>;
  sendCandidateAudio(input: SendCandidateAudioInput): void;
  endCandidateAudio(): void;
  startCandidateActivity?(): void;
  endCandidateActivity?(): void;
  sendText(input: SendSpeakingExaminerTextInput): void;
  presentPrompt?(input: { questionId: string; text: string }): void;
  respondToExaminerAction(response: SpeakingLiveExaminerActionResponse): void;
  subscribe(listener: (event: SpeakingLiveExaminerEvent) => void): () => void;
  disconnect(): Promise<void>;
  dispose(): void;
}
