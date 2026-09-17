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
  createPart1PracticePlan,
  isPart1PracticePlan,
  createIdentityCheckTurn,
  createPracticeAnswerTurn,
  isPracticeTurn,
  checkPart1PracticeCompletion,
  canCompletePart1Practice,
  resolvePart1TurnLineage,
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

    it("should maintain question identity even if order changes", () => {
      const qOrder1 = createPart1Question({
        id: "hometown-location",
        text: "Where is your hometown?",
        order: 1,
      });
      const qOrder3 = createPart1Question({
        id: "hometown-location",
        text: "Where is your hometown?",
        order: 3,
      });

      expect(qOrder1.id).toBe(qOrder3.id);
      expect(qOrder1.order).toBe(1);
      expect(qOrder3.order).toBe(3);
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

  describe("Part1PracticePlan Domain Invariants", () => {
    it("should represent a plan with explicit topic identity and theme", () => {
      const q1 = createPart1Question({
        id: "hometown-loc",
        text: "Where?",
        order: 1,
      });
      const plan = createPart1PracticePlan({
        topicId: "hometown-v1",
        theme: "Hometown and Living",
        questions: [q1],
      });

      expect(plan.topicId).toBe("hometown-v1");
      expect(plan.theme).toBe("Hometown and Living");
      expect(isPart1PracticePlan(plan)).toBe(true);
    });

    it("should contain explicit Part1Question identities", () => {
      const q1 = createPart1Question({
        id: "hometown-loc",
        text: "Where is your hometown?",
        order: 1,
      });
      const q2 = createPart1Question({
        id: "hometown-like",
        text: "What do you like about it?",
        order: 2,
      });
      const plan = createPart1PracticePlan({
        topicId: "hometown-v1",
        theme: "Hometown",
        questions: [q1, q2],
      });

      expect(plan.questions).toHaveLength(2);
      expect(plan.questions[0].id).toBe("hometown-loc");
      expect(plan.questions[1].id).toBe("hometown-like");
    });

    it("should represent question ordering independently from identity", () => {
      const q1 = createPart1Question({
        id: "hometown-loc",
        text: "Where is your hometown?",
        order: 2,
      });
      const q2 = createPart1Question({
        id: "hometown-like",
        text: "What do you like about it?",
        order: 1,
      });
      const plan = createPart1PracticePlan({
        topicId: "hometown-v1",
        theme: "Hometown",
        questions: [q1, q2],
      });

      // Identity is derived from question.id, order from question.order
      expect(plan.questions[0].id).toBe("hometown-loc");
      expect(plan.questions[0].order).toBe(2);
      expect(plan.questions[1].id).toBe("hometown-like");
      expect(plan.questions[1].order).toBe(1);
    });

    it("should reject plan creation with invalid inputs", () => {
      const q1 = createPart1Question({ id: "q1", text: "Text", order: 1 });

      expect(() =>
        createPart1PracticePlan({
          topicId: "",
          theme: "Theme",
          questions: [q1],
        })
      ).toThrow("Part1PracticePlan requires a non-empty topicId");

      expect(() =>
        createPart1PracticePlan({ topicId: "top1", theme: "", questions: [q1] })
      ).toThrow("Part1PracticePlan requires a non-empty theme");

      expect(() =>
        createPart1PracticePlan({
          topicId: "top1",
          theme: "Theme",
          questions: [],
        })
      ).toThrow("Part1PracticePlan requires at least one question");
    });

    it("should reject plan creation with duplicate question ids", () => {
      const q1 = createPart1Question({ id: "dup-id", text: "Q1", order: 1 });
      const q2 = createPart1Question({ id: "dup-id", text: "Q2", order: 2 });

      expect(() =>
        createPart1PracticePlan({
          topicId: "top1",
          theme: "Theme",
          questions: [q1, q2],
        })
      ).toThrow('Part1PracticePlan contains duplicate question id: "dup-id"');

      expect(
        isPart1PracticePlan({
          topicId: "top1",
          theme: "Theme",
          questions: [q1, q2],
        })
      ).toBe(false);
    });

    it("should reject plan creation with duplicate question orders", () => {
      const q1 = createPart1Question({ id: "q1", text: "Q1", order: 1 });
      const q2 = createPart1Question({ id: "q2", text: "Q2", order: 1 });

      expect(() =>
        createPart1PracticePlan({
          topicId: "top1",
          theme: "Theme",
          questions: [q1, q2],
        })
      ).toThrow("Part1PracticePlan contains duplicate question order: 1");

      expect(
        isPart1PracticePlan({
          topicId: "top1",
          theme: "Theme",
          questions: [q1, q2],
        })
      ).toBe(false);
    });
  });

  describe("resolvePart1TurnLineage Domain Helper", () => {
    const q1 = createPart1Question({
      id: "hometown-location",
      text: "Where is your hometown?",
      order: 1,
    });
    const q2 = createPart1Question({
      id: "hometown-likes",
      text: "What do you like about it?",
      order: 2,
    });

    it("should resolve turn 0 as identity_check with undefined questionId", () => {
      const result = resolvePart1TurnLineage({
        turnIndex: 0,
        questions: [q1, q2],
      });
      expect(result.turnKind).toBe("identity_check");
      expect(result.promptQuestion).toBe(
        "Could you please tell me your full name?"
      );
      expect(result.questionId).toBeUndefined();
    });

    it("should resolve turn 1+ as practice_answer with authored question id and text", () => {
      const turn1 = resolvePart1TurnLineage({
        turnIndex: 1,
        questions: [q1, q2],
      });
      expect(turn1.turnKind).toBe("practice_answer");
      expect(turn1.promptQuestion).toBe("Where is your hometown?");
      expect(turn1.questionId).toBe("hometown-location");

      const turn2 = resolvePart1TurnLineage({
        turnIndex: 2,
        questions: [q1, q2],
      });
      expect(turn2.turnKind).toBe("practice_answer");
      expect(turn2.promptQuestion).toBe("What do you like about it?");
      expect(turn2.questionId).toBe("hometown-likes");
    });

    it("should preserve questionId even if question order is changed", () => {
      const reordered = [q2, q1];
      const turn1Reordered = resolvePart1TurnLineage({
        turnIndex: 1,
        questions: reordered,
      });
      expect(turn1Reordered.questionId).toBe("hometown-likes");

      const turn2Reordered = resolvePart1TurnLineage({
        turnIndex: 2,
        questions: reordered,
      });
      expect(turn2Reordered.questionId).toBe("hometown-location");
    });
  });

  describe("PracticeTurn Domain Invariants", () => {
    it("should model identity_check turn with no questionId", () => {
      const turn = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 3200,
        transcript: "My name is John Doe",
      });

      expect(turn.kind).toBe("identity_check");
      expect(turn.startedAtMs).toBe(0);
      expect(turn.endedAtMs).toBe(3200);
      expect("questionId" in turn).toBe(false);
      expect(isPracticeTurn(turn)).toBe(true);
    });

    it("should model practice_answer turn requiring explicit questionId", () => {
      const turn = createPracticeAnswerTurn({
        questionId: "hometown-location-q1",
        startedAtMs: 3500,
        endedAtMs: 15200,
        transcript: "I live in Hanoi",
      });

      expect(turn.kind).toBe("practice_answer");
      expect(turn.questionId).toBe("hometown-location-q1");
      expect(turn.startedAtMs).toBe(3500);
      expect(turn.endedAtMs).toBe(15200);
      expect(isPracticeTurn(turn)).toBe(true);
    });

    it("should reject practice_answer creation without explicit questionId", () => {
      expect(() =>
        createPracticeAnswerTurn({
          questionId: "",
          startedAtMs: 1000,
          endedAtMs: 3000,
        })
      ).toThrow("PracticeAnswerTurn requires a non-empty questionId");
    });

    it("should reject invalid timestamp ranges (endedAtMs < startedAtMs)", () => {
      expect(() =>
        createIdentityCheckTurn({
          startedAtMs: 5000,
          endedAtMs: 4000,
        })
      ).toThrow(
        "PracticeTurn endedAtMs must be greater than or equal to startedAtMs"
      );

      expect(() =>
        createPracticeAnswerTurn({
          questionId: "q1",
          startedAtMs: 10000,
          endedAtMs: 2000,
        })
      ).toThrow(
        "PracticeTurn endedAtMs must be greater than or equal to startedAtMs"
      );
    });

    it("should validate practice turns using isPracticeTurn type guard", () => {
      const validIdentity = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 1000,
      });
      const validAnswer = createPracticeAnswerTurn({
        questionId: "q1",
        startedAtMs: 1000,
        endedAtMs: 2000,
      });

      expect(isPracticeTurn(validIdentity)).toBe(true);
      expect(isPracticeTurn(validAnswer)).toBe(true);
      expect(isPracticeTurn({ kind: "invalid_kind" })).toBe(false);
      expect(
        isPracticeTurn({
          kind: "practice_answer",
          questionId: "",
          startedAtMs: 0,
          endedAtMs: 1000,
        })
      ).toBe(false);
      expect(
        isPracticeTurn({
          kind: "identity_check",
          questionId: "should_not_exist",
          startedAtMs: 0,
          endedAtMs: 1000,
        })
      ).toBe(false);
    });
  });

  describe("Part1 Practice Completion Policy Domain Invariants", () => {
    const q1 = createPart1Question({
      id: "hometown-loc",
      text: "Where is your hometown?",
      order: 1,
    });
    const q2 = createPart1Question({
      id: "hometown-like",
      text: "What do you like about it?",
      order: 2,
    });
    const plan = createPart1PracticePlan({
      topicId: "hometown-v1",
      theme: "Hometown",
      questions: [q1, q2],
    });

    it("should evaluate identity-only flow as NOT complete", () => {
      const identityTurn = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 3000,
        transcript: "My name is John",
      });

      const result = checkPart1PracticeCompletion(plan, [identityTurn]);
      expect(result.canComplete).toBe(false);
      expect(result.answeredQuestionCount).toBe(0);
      expect(result.missingQuestionIds).toEqual([
        "hometown-loc",
        "hometown-like",
      ]);
      expect(canCompletePart1Practice(plan, [identityTurn])).toBe(false);
    });

    it("should evaluate partial flow with missing required answers as NOT complete", () => {
      const identityTurn = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 3000,
      });
      const ans1 = createPracticeAnswerTurn({
        questionId: "hometown-loc",
        startedAtMs: 3500,
        endedAtMs: 10000,
      });

      const result = checkPart1PracticeCompletion(plan, [identityTurn, ans1]);
      expect(result.canComplete).toBe(false);
      expect(result.answeredQuestionCount).toBe(1);
      expect(result.missingQuestionIds).toEqual(["hometown-like"]);
      expect(canCompletePart1Practice(plan, [identityTurn, ans1])).toBe(false);
    });

    it("should evaluate flow with all required questions answered as ELIGIBLE for completion", () => {
      const identityTurn = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 3000,
      });
      const ans1 = createPracticeAnswerTurn({
        questionId: "hometown-loc",
        startedAtMs: 3500,
        endedAtMs: 10000,
      });
      const ans2 = createPracticeAnswerTurn({
        questionId: "hometown-like",
        startedAtMs: 10500,
        endedAtMs: 18000,
      });

      const result = checkPart1PracticeCompletion(plan, [
        identityTurn,
        ans1,
        ans2,
      ]);
      expect(result.canComplete).toBe(true);
      expect(result.answeredQuestionCount).toBe(2);
      expect(result.missingQuestionIds).toEqual([]);
      expect(canCompletePart1Practice(plan, [identityTurn, ans1, ans2])).toBe(
        true
      );
    });

    it("should ignore answer for unknown questionId and not incorrectly complete practice", () => {
      const identityTurn = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 3000,
      });
      const ans1 = createPracticeAnswerTurn({
        questionId: "hometown-loc",
        startedAtMs: 3500,
        endedAtMs: 10000,
      });
      const unknownAns = createPracticeAnswerTurn({
        questionId: "unknown-q99",
        startedAtMs: 10500,
        endedAtMs: 15000,
      });

      const result = checkPart1PracticeCompletion(plan, [
        identityTurn,
        ans1,
        unknownAns,
      ]);
      expect(result.canComplete).toBe(false);
      expect(result.missingQuestionIds).toEqual(["hometown-like"]);
    });

    it("should evaluate completion correctly regardless of turn ordering", () => {
      const identityTurn = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 3000,
      });
      const ans1 = createPracticeAnswerTurn({
        questionId: "hometown-loc",
        startedAtMs: 3500,
        endedAtMs: 10000,
      });
      const ans2 = createPracticeAnswerTurn({
        questionId: "hometown-like",
        startedAtMs: 10500,
        endedAtMs: 18000,
      });

      // Out-of-order turns (e.g. q2 answered before q1)
      const outOfOrderTurns = [ans2, identityTurn, ans1];

      expect(canCompletePart1Practice(plan, outOfOrderTurns)).toBe(true);
    });

    it("should handle duplicate answers to same question cleanly", () => {
      const identityTurn = createIdentityCheckTurn({
        startedAtMs: 0,
        endedAtMs: 3000,
      });
      const ans1 = createPracticeAnswerTurn({
        questionId: "hometown-loc",
        startedAtMs: 3500,
        endedAtMs: 10000,
      });
      const ans1Repeat = createPracticeAnswerTurn({
        questionId: "hometown-loc",
        startedAtMs: 10500,
        endedAtMs: 18000,
      });

      const result = checkPart1PracticeCompletion(plan, [
        identityTurn,
        ans1,
        ans1Repeat,
      ]);
      expect(result.canComplete).toBe(false);
      expect(result.answeredQuestionCount).toBe(1);
      expect(result.missingQuestionIds).toEqual(["hometown-like"]);
    });
  });
});
