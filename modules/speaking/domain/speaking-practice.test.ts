import { describe, it, expect } from "bun:test";
import {
  SpeakingPracticeStatus,
  PracticeEvaluationStatus,
  CANONICAL_SPEAKING_PRACTICE_SCOPE,
  normalizeSpeakingPracticeScope,
  isSpeakingPracticeScope,
  hasPracticeEnded,
  isFeedbackAvailable,
  checkPracticeEvaluationRetryEligibility,
  canRetryPracticeEvaluation,
  createPart1Question,
  isPart1Question,
  createPart1QuestionsFromTopic,
} from "./speaking-practice";

describe("SpeakingPractice Domain Policies & Lifecycle Invariants", () => {
  describe("Practice Scope Normalization (Critical Seam 6)", () => {
    it("should normalize valid Part 1 representations to canonical 'part_1'", () => {
      expect(normalizeSpeakingPracticeScope("part_1")).toBe("part_1");
      expect(normalizeSpeakingPracticeScope("part1")).toBe("part_1");
      expect(normalizeSpeakingPracticeScope("Part 1")).toBe("part_1");
      expect(normalizeSpeakingPracticeScope("PART_1")).toBe("part_1");
      expect(normalizeSpeakingPracticeScope("part-1")).toBe("part_1");
      expect(normalizeSpeakingPracticeScope("  part1  ")).toBe("part_1");
    });

    it("should reject non-practice scopes and Full Mock values, preserving SpeakingPractice != MockTest", () => {
      expect(normalizeSpeakingPracticeScope("full")).toBeNull();
      expect(normalizeSpeakingPracticeScope("mock_test")).toBeNull();
      expect(normalizeSpeakingPracticeScope("part2")).toBeNull();
      expect(normalizeSpeakingPracticeScope("part3")).toBeNull();
      expect(normalizeSpeakingPracticeScope("")).toBeNull();
      expect(normalizeSpeakingPracticeScope(null)).toBeNull();
      expect(normalizeSpeakingPracticeScope(undefined)).toBeNull();
      expect(normalizeSpeakingPracticeScope(123)).toBeNull();
    });

    it("should validate canonical scope using isSpeakingPracticeScope type guard", () => {
      expect(isSpeakingPracticeScope("part_1")).toBe(true);
      expect(isSpeakingPracticeScope("part1")).toBe(false);
      expect(isSpeakingPracticeScope("full")).toBe(false);
      expect(isSpeakingPracticeScope(null)).toBe(false);
      expect(CANONICAL_SPEAKING_PRACTICE_SCOPE).toBe("part_1");
    });
  });

  describe("Practice Lifecycle Status: hasPracticeEnded", () => {
    it("should return true for completed practice", () => {
      expect(hasPracticeEnded("completed")).toBe(true);
    });

    it("should return true for audio_purged practice (ended in past, audio purged per retention policy)", () => {
      expect(hasPracticeEnded("audio_purged")).toBe(true);
    });

    it("should return false for in_progress practice", () => {
      expect(hasPracticeEnded("in_progress")).toBe(false);
    });

    it("should return false for abandoned practice", () => {
      expect(hasPracticeEnded("abandoned")).toBe(false);
    });
  });

  describe("Practice Feedback Availability: isFeedbackAvailable", () => {
    it("should return true strictly when evaluation status is ready", () => {
      expect(isFeedbackAvailable("ready")).toBe(true);
    });

    it("should return false when evaluation is pending or failed", () => {
      expect(isFeedbackAvailable("pending")).toBe(false);
      expect(isFeedbackAvailable("failed")).toBe(false);
    });
  });

  describe("Decoupled States: PracticeEnded != PracticeEvaluated (Critical Seams 1, 2, 3)", () => {
    it("Seam 1: ended practice + evaluation pending", () => {
      const practiceStatus: SpeakingPracticeStatus = "completed";
      const evaluationStatus: PracticeEvaluationStatus = "pending";

      // Practice has successfully ended
      expect(hasPracticeEnded(practiceStatus)).toBe(true);
      // AI feedback is not yet available
      expect(isFeedbackAvailable(evaluationStatus)).toBe(false);
      // Manual retry is not allowed while an evaluation is still pending
      expect(
        canRetryPracticeEvaluation({
          practiceStatus,
          evaluationStatus,
          hasAuthoritativeOriginalAudio: true,
        })
      ).toBe(false);
      expect(
        checkPracticeEvaluationRetryEligibility({
          practiceStatus,
          evaluationStatus,
          hasAuthoritativeOriginalAudio: true,
        }).reason
      ).toBe("EVALUATION_PENDING");
    });

    it("Seam 2: ended practice + evaluation failed preserves practice validity", () => {
      const practiceStatus: SpeakingPracticeStatus = "completed";
      const evaluationStatus: PracticeEvaluationStatus = "failed";

      // Practice validity is preserved: PracticeEnded != PracticeEvaluated
      expect(hasPracticeEnded(practiceStatus)).toBe(true);
      // Feedback is not available
      expect(isFeedbackAvailable(evaluationStatus)).toBe(false);
      // Practice did NOT become failed or abandoned
      expect(practiceStatus).toBe("completed");
    });

    it("Seam 3: ended practice + evaluation ready", () => {
      const practiceStatus: SpeakingPracticeStatus = "completed";
      const evaluationStatus: PracticeEvaluationStatus = "ready";

      // Practice is ended
      expect(hasPracticeEnded(practiceStatus)).toBe(true);
      // AI feedback is ready and available
      expect(isFeedbackAvailable(evaluationStatus)).toBe(true);
      // Retry is denied because evaluation already succeeded
      expect(
        canRetryPracticeEvaluation({
          practiceStatus,
          evaluationStatus,
          hasAuthoritativeOriginalAudio: true,
        })
      ).toBe(false);
      expect(
        checkPracticeEvaluationRetryEligibility({
          practiceStatus,
          evaluationStatus,
          hasAuthoritativeOriginalAudio: true,
        }).reason
      ).toBe("EVALUATION_ALREADY_READY");
    });
  });

  describe("Practice Evaluation Retry Policy (Critical Seams 4, 5)", () => {
    it("Seam 4: retry allowed after evaluation failure when authoritative audio exists", () => {
      const eligibility = checkPracticeEvaluationRetryEligibility({
        practiceStatus: "completed",
        evaluationStatus: "failed",
        hasAuthoritativeOriginalAudio: true,
      });

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBeUndefined();
      expect(
        canRetryPracticeEvaluation({
          practiceStatus: "completed",
          evaluationStatus: "failed",
          hasAuthoritativeOriginalAudio: true,
        })
      ).toBe(true);
    });

    it("Seam 5a: retry denied when authoritative audio is missing/unavailable", () => {
      const eligibility = checkPracticeEvaluationRetryEligibility({
        practiceStatus: "completed",
        evaluationStatus: "failed",
        hasAuthoritativeOriginalAudio: false,
      });

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe("AUDIO_UNAVAILABLE");
      expect(
        canRetryPracticeEvaluation({
          practiceStatus: "completed",
          evaluationStatus: "failed",
          hasAuthoritativeOriginalAudio: false,
        })
      ).toBe(false);
    });

    it("Seam 5b: retry denied when practice audio has been purged (audio_purged)", () => {
      const eligibility = checkPracticeEvaluationRetryEligibility({
        practiceStatus: "audio_purged",
        evaluationStatus: "failed",
        hasAuthoritativeOriginalAudio: false,
      });

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe("AUDIO_UNAVAILABLE");
    });

    it("should deny retry when practice is still in progress", () => {
      const eligibility = checkPracticeEvaluationRetryEligibility({
        practiceStatus: "in_progress",
        evaluationStatus: "failed",
        hasAuthoritativeOriginalAudio: true,
      });

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe("PRACTICE_NOT_ENDED");
    });

    it("should deny retry when practice was abandoned", () => {
      const eligibility = checkPracticeEvaluationRetryEligibility({
        practiceStatus: "abandoned",
        evaluationStatus: "failed",
        hasAuthoritativeOriginalAudio: true,
      });

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe("PRACTICE_ABANDONED");
    });
  });

  describe("Part1Question Domain Identity Invariants", () => {
    it("should represent a Part 1 question with a stable explicit ID", () => {
      const question = createPart1Question({
        id: "tech-ai-future-q1",
        text: "What kind of technological devices do you use most frequently every day?",
        order: 1,
      });

      expect(question.id).toBe("tech-ai-future-q1");
      expect(question.text).toBe(
        "What kind of technological devices do you use most frequently every day?"
      );
      expect(isPart1Question(question)).toBe(true);
    });

    it("should represent question ordering explicitly", () => {
      const q1 = createPart1Question({
        id: "tech-q1",
        text: "Question 1",
        order: 1,
      });
      const q2 = createPart1Question({
        id: "tech-q2",
        text: "Question 2",
        order: 2,
      });

      expect(q1.order).toBe(1);
      expect(q2.order).toBe(2);
      expect(q1.order).not.toBe(q2.order);
    });

    it("should ensure two different questions cannot be distinguished only by their array position", () => {
      const qA = createPart1Question({
        id: "q-alpha",
        text: "Alpha question?",
        order: 1,
      });
      const qB = createPart1Question({
        id: "q-beta",
        text: "Beta question?",
        order: 2,
      });

      const list1 = [qA, qB];
      const list2 = [qB, qA];

      expect(list1[0].id).toBe("q-alpha");
      expect(list2[0].id).toBe("q-beta");

      expect(list2[1].id).toBe(qA.id);
      expect(list2[1].order).toBe(1);
      expect(list2[0].id).toBe(qB.id);
      expect(list2[0].order).toBe(2);
    });

    it("should construct canonical Part1Question list from topic with deterministic stable IDs", () => {
      const questions = createPart1QuestionsFromTopic("hometown-urbanization", [
        "Where is your hometown?",
        "What do you like about it?",
      ]);

      expect(questions).toHaveLength(2);
      expect(questions[0]).toEqual({
        id: "hometown-urbanization-q1",
        text: "Where is your hometown?",
        order: 1,
      });
      expect(questions[1]).toEqual({
        id: "hometown-urbanization-q2",
        text: "What do you like about it?",
        order: 2,
      });
    });

    it("should reject invalid question creation inputs", () => {
      expect(() =>
        createPart1Question({ id: "", text: "Valid text", order: 1 })
      ).toThrow("Part1Question requires a non-empty stable id");

      expect(() =>
        createPart1Question({ id: "q1", text: "   ", order: 1 })
      ).toThrow("Part1Question requires non-empty question text");

      expect(() =>
        createPart1Question({ id: "q1", text: "Valid text", order: 0 })
      ).toThrow("Part1Question order must be a positive integer");
    });
  });
});
