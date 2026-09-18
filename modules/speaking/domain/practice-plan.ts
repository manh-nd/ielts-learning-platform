import type { SpeakingPracticeScope } from "./speaking-practice";

export interface PracticePrompt {
  readonly id: string;
  readonly text: string;
}
export interface PracticePlan {
  readonly version: 1;
  readonly scope: SpeakingPracticeScope;
  readonly topicId: string;
  readonly title: string;
  readonly questions: readonly PracticePrompt[];
  readonly cueCard?: {
    readonly id: string;
    readonly text: string;
    readonly bulletPoints: readonly string[];
  };
}

export function validatePracticePlan(plan: PracticePlan): boolean {
  if (
    plan.version !== 1 ||
    !["part_1", "part_2", "part_3"].includes(plan.scope) ||
    !plan.topicId ||
    !plan.title ||
    !Array.isArray(plan.questions)
  )
    return false;
  if (
    plan.scope === "part_2" &&
    (!plan.cueCard?.id ||
      !plan.cueCard.text ||
      !Array.isArray(plan.cueCard.bulletPoints))
  )
    return false;
  if (plan.scope !== "part_2" && !plan.questions.length) return false;
  const prompts = [...plan.questions, ...(plan.cueCard ? [plan.cueCard] : [])];
  return (
    prompts.every(
      (p) =>
        typeof p.id === "string" &&
        !!p.id.trim() &&
        typeof p.text === "string" &&
        !!p.text.trim()
    ) && new Set(prompts.map((p) => p.id)).size === prompts.length
  );
}

export interface PracticeAnswer {
  readonly completed?: boolean;
  readonly id: string;
  readonly questionId: string;
  readonly promptQuestion: string;
  readonly turnKind: "identity_check" | "practice_answer";
  readonly partNumber: number;
  readonly itemIndex: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly liveTranscript: string;
}

export function practicePlanCompleted(
  plan: PracticePlan,
  answers: readonly PracticeAnswer[]
): boolean {
  const ids = [
    ...plan.questions.map((q) => q.id),
    ...(plan.cueCard ? [plan.cueCard.id] : []),
  ];
  return ids.every((id) =>
    answers.some(
      (a) =>
        a.completed !== false &&
        a.turnKind === "practice_answer" &&
        a.questionId === id &&
        a.endMs > a.startMs
    )
  );
}
