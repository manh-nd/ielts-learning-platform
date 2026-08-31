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

/**
 * Normalized State Machine for Live Speaking Session
 */
export type LiveSpeakingState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "listening" }
  | { kind: "user-speaking" }
  | { kind: "waiting-for-model" }
  | { kind: "model-speaking" }
  | { kind: "reconnecting" }
  | { kind: "ended" }
  | { kind: "failed"; reason: string };

/**
 * Candidate Turn Marker for Audio as Source of Truth
 */
export interface CandidateTurnMarker {
  partNumber: number;
  itemIndex: number;
  promptQuestion: string;
  startMs: number;
  endMs: number;
  liveTranscript?: string;
  verifiedTranscript?: string;
}

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
  storageKey?: string;
}

export type GeminiLiveVoice = "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";

export interface LiveSpeakingConfig {
  candidateName?: string;
  topic?: SpeakingMockTopic;
  targetPart?: "part1" | "part2" | "part3" | "full" | "part_1";
  systemInstruction?: string;
  voiceName?: GeminiLiveVoice;
  tokenEndpoint?: string;
  mockMode?: boolean;
  onStatusChange?: (status: LiveSessionStatus) => void;
  onStageChange?: (stage: ExamStage) => void;
  onError?: (error: Error) => void;
  enableNoiseSuppression?: boolean;
  onTranscriptUpdate?: (transcripts: TranscriptItem[]) => void;
  onExamCompleted?: () => void;
}

export interface UseGeminiLiveReturn {
  status: LiveSessionStatus;
  speakingState: LiveSpeakingState;
  voiceActivity: VoiceActivityState;
  examStage: ExamStage;
  part2Phase: Part2Phase;
  cueCardData: CueCardData | null;
  prepTimeRemaining: number;
  scratchpadNotes: string;
  transcripts: TranscriptItem[];
  turnMarkers: CandidateTurnMarker[];
  isMuted: boolean;
  isNoiseSuppressionActive: boolean;
  error: Error | null;
  inputVolume: number;
  recordedAudio: RecordedAudioData | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<RecordedAudioData | null>;
  toggleMute: () => void;
  toggleNoiseSuppression: (enabled?: boolean) => void;
  sendTextMessage: (text: string) => void;
  clearTranscripts: () => void;
  setScratchpadNotes: (notes: string) => void;
  finishPart2PrepEarly: () => void;
  triggerMockStageChange: (stage: ExamStage) => void;
}
