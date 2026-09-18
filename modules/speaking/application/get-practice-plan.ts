import { SPEAKING_PRACTICE_CONTENT } from "@/lib/data/speaking-practice-content";
import { SPEAKING_PRACTICE_TOPICS } from "@/lib/data/speaking-practice-topics";
import type { SpeakingPracticeScope } from "../domain";
import type { PracticePlan } from "../domain/practice-plan";

export function getPracticePlan(
  topicId: string,
  scope: SpeakingPracticeScope
): PracticePlan | null {
  const topic = SPEAKING_PRACTICE_CONTENT.find((t) => t.id === topicId);
  const part1 = SPEAKING_PRACTICE_TOPICS.find((t) => t.id === topicId);
  if (scope === "part_1" && part1)
    return {
      version: 1,
      scope,
      topicId,
      title: part1.title,
      questions: part1.part1.questions.map((q) => ({ id: q.id, text: q.text })),
    };
  if (!topic) return null;
  if (scope === "part_2")
    return {
      version: 1,
      scope,
      topicId,
      title: topic.title,
      cueCard: {
        id: `${topicId}-cue`,
        text: topic.part2.cueCardPrompt,
        bulletPoints: [...topic.part2.bulletPoints],
      },
      questions: topic.part2.followUpQuestion
        ? [{ id: `${topicId}-followup`, text: topic.part2.followUpQuestion }]
        : [],
    };
  return {
    version: 1,
    scope,
    topicId,
    title: topic.title,
    questions: topic.part3.questions.map((text, i) => ({
      id: `${topicId}-discussion-${i + 1}`,
      text,
    })),
  };
}
