import { evaluateSpeakingPracticePart1 } from "@/lib/gemini/speaking-evaluator";
import type { SpeakingPracticeEvaluatorPort } from "../application/ports/speaking-practice-evaluator.port";
export const geminiPracticeEvaluator: SpeakingPracticeEvaluatorPort = {
  evaluate: evaluateSpeakingPracticePart1,
};
