import { SpeakingMockTopic } from "@/lib/data/speaking-mock-topics";

export type LiveSessionStatus =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export type VoiceActivityState = "idle" | "user_speaking" | "ai_speaking";

export type ExamStage = 1 | 2 | 3 | "completed";

export type Part2Phase = "idle" | "prep_countdown" | "speaking";

export interface CueCardData {
  topicTitle: string;
  cueCardPrompt: string;
  bulletPoints: string[];
  followUpQuestion?: string;
}

export interface TranscriptItem {
  id: string;
  sender: "user" | "examiner";
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface DisplayCueCardArgs {
  topicTitle: string;
  cueCardPrompt: string;
  bulletPoints: string[];
}

export interface StartPart3Args {
  topicTitle: string;
  introComment?: string;
}

export interface EndExamArgs {
  closingRemarks?: string;
}

export interface RecordedAudioData {
  blob: Blob;
  url: string;
  durationSeconds: number;
  mimeType: string;
}

export type GeminiLiveVoice = "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";

export interface LiveSpeakingConfig {
  /**
   * Candidate name to address in conversation
   */
  candidateName?: string;
  /**
   * Selected Mock Topic specification
   */
  topic?: SpeakingMockTopic;
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
   * Callback fired on stage changes (Part 1, 2, 3, completed)
   */
  onStageChange?: (stage: ExamStage) => void;
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
  examStage: ExamStage;
  part2Phase: Part2Phase;
  cueCardData: CueCardData | null;
  prepTimeRemaining: number;
  scratchpadNotes: string;
  transcripts: TranscriptItem[];
  isMuted: boolean;
  isNoiseSuppressionActive: boolean;
  error: Error | null;
  inputVolume: number; // 0.0 to 1.0 for live amplitude metering
  recordedAudio: RecordedAudioData | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleNoiseSuppression: (enabled?: boolean) => void;
  sendTextMessage: (text: string) => void;
  clearTranscripts: () => void;
  setScratchpadNotes: (notes: string) => void;
  finishPart2PrepEarly: () => void;
  triggerMockStageChange: (stage: ExamStage) => void;
}
