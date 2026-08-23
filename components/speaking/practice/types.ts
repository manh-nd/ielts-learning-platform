export type SpeakingPart = "part1" | "part2" | "part3";

export type SpeakingSuiteStep = "part1" | "part2" | "part3" | "summary";

export type Part2State =
  | "ready" // Ready to start 1-min preparation
  | "preparing" // 1-minute prep countdown running
  | "speaking" // 2-minute recording running
  | "reviewing"; // Long turn finished, reviewing recording

export interface SpeakingQuestionItem {
  id: string;
  part: SpeakingPart;
  order: number;
  topic?: string;
  questionText: string;
  audioPromptUrl?: string;
  cueCardBullets?: string[];
  prepTimeSeconds?: number;
  maxDurationSeconds?: number;
  suggestedDurationSeconds?: number;
}

export interface SpeakingTestConfig {
  id: string;
  title: string;
  subtitle?: string;
  targetMode?: "full" | "part1" | "part2" | "part3";
  part1Questions: SpeakingQuestionItem[];
  part2Question: SpeakingQuestionItem;
  part3Questions: SpeakingQuestionItem[];
}

export interface RecordedAnswerItem {
  questionId: string;
  part: SpeakingPart;
  blob: Blob;
  audioUrl: string;
  durationSeconds: number;
  recordedAt: Date;
}

export interface SpeakingPracticeSubmissionData {
  testId: string;
  answers: Record<string, RecordedAnswerItem>;
  part2Notes?: string;
  totalDurationSeconds: number;
  submittedAt: Date;
}
