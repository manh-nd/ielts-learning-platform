export type IeltsTaskType = "TASK_1_ACADEMIC" | "TASK_1_GENERAL" | "TASK_2";

export interface WritingPrompt {
  id: string;
  taskType: IeltsTaskType;
  title: string;
  promptText: string;
  imageUrl?: string;
  imageAlt?: string;
  minWords?: number;
  targetWordsMax?: number;
  timeLimitMinutes?: number;
}

export interface WritingDraft {
  contentHtml: string;
  contentText: string;
  wordCount: number;
  scratchpadHtml?: string;
  scratchpadText?: string;
  lastSavedAt: string;
  secondsRemaining?: number;
}

export interface WritingSubmissionPayload {
  promptId: string;
  taskType: IeltsTaskType;
  plainText: string;
  wordCount: number;
  durationSeconds: number;
  scratchpadText?: string;
  submittedAt: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
