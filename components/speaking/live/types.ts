export type LiveSessionStatus =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export type VoiceActivityState = "idle" | "user_speaking" | "ai_speaking";

export interface TranscriptItem {
  id: string;
  sender: "user" | "examiner";
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export type GeminiLiveVoice = "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";

export interface LiveSpeakingConfig {
  /**
   * Candidate name to address in conversation
   */
  candidateName?: string;
  /**
   * Test segment target
   */
  targetPart?: "part1" | "part2" | "part3" | "full";
  /**
   * Custom system instruction for the IELTS Examiner persona
   */
  systemInstruction?: string;
  /**
   * Native voice output persona
   */
  voiceName?: GeminiLiveVoice;
  /**
   * Custom token endpoint (defaults to /api/speaking/live-token)
   */
  tokenEndpoint?: string;
  /**
   * Runs in synthetic mock simulation mode for Storybook and offline development
   */
  mockMode?: boolean;
  /**
   * Callback fired on session lifecycle changes
   */
  onStatusChange?: (status: LiveSessionStatus) => void;
  /**
   * Callback fired on errors
   */
  onError?: (error: Error) => void;
  /**
   * Enable real-time WASM/DSP background noise suppression filter
   * @default true
   */
  enableNoiseSuppression?: boolean;
  /**
   * Callback fired whenever transcripts update
   */
  onTranscriptUpdate?: (transcripts: TranscriptItem[]) => void;
}

export interface UseGeminiLiveReturn {
  status: LiveSessionStatus;
  voiceActivity: VoiceActivityState;
  transcripts: TranscriptItem[];
  isMuted: boolean;
  isNoiseSuppressionActive: boolean;
  error: Error | null;
  inputVolume: number; // 0.0 to 1.0 for live amplitude metering
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleNoiseSuppression: (enabled?: boolean) => void;
  sendTextMessage: (text: string) => void;
  clearTranscripts: () => void;
}
