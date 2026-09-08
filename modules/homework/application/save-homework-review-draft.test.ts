import { describe, it, expect, beforeEach } from "bun:test";
import { saveHomeworkReviewDraft } from "./save-homework-review-draft";
import { claimHomeworkReview } from "./claim-homework-review";
import { getTeacherReviewCockpit } from "./get-teacher-review-cockpit";
import type { SpeakingReviewAnnotationCategory } from "../domain/homework-types";
import {
  clearDevClassroomCache,
  createClassroom,
  addMembership,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  clearDevHomeworkCache,
  createAssignment,
} from "@/modules/homework/infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  createInitialSubmissionWithAttempt,
  devSubmissionCache,
  devAttemptCache,
} from "@/modules/homework/infrastructure/homework-submission-repository";
import {
  clearDevHomeworkAssessmentCache,
  devTeacherAssessmentCache,
} from "@/modules/homework/infrastructure/homework-assessment-repository";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/errors";

describe("saveHomeworkReviewDraft Application Use Case (Issue #102)", () => {
  const teacherId = "teacher_alice";
  const otherTeacherId = "teacher_mallory";
  const learnerId = "learner_bob";

  let classroomId: string;
  let assignmentId: string;
  let submissionId: string;

  beforeEach(async () => {
    clearDevClassroomCache();
    clearDevHomeworkCache();
    clearDevHomeworkSubmissionCache();
    clearDevHomeworkAssessmentCache();

    const classroom = await createClassroom(teacherId, {
      name: "IELTS Advanced Masterclass",
    });
    classroomId = classroom.id;
    await addMembership(classroomId, learnerId);

    const assignment = await createAssignment({
      classroomId,
      teacherId,
      title: "Speaking Test 1",
      prompts: [
        {
          promptId: "p_part1_1",
          partNumber: 1,
          text: "Where are you from?",
        },
        {
          promptId: "p_part1_2",
          partNumber: 1,
          text: "What do you like about your hometown?",
        },
      ],
      submissionDeadline: new Date(Date.now() + 86400000),
    });
    assignmentId = assignment.id;

    const { submission } = await createInitialSubmissionWithAttempt({
      assignmentId,
      learnerId,
      audioResponses: [
        {
          promptId: "p_part1_1",
          storageKey: "sub_1/attempt_1/audio_1.webm",
          durationMs: 30000,
          audioBytes: 30000,
        },
        {
          promptId: "p_part1_2",
          storageKey: "sub_1/attempt_1/audio_2.webm",
          durationMs: 45000,
          audioBytes: 45000,
        },
      ],
    });
    submissionId = submission.id;
  });

  it("Test A: cannot save draft before review claim (Finding 1A)", async () => {
    // submission status = submitted, reviewedAttemptNumber = null
    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "Draft before claim",
        annotations: [],
      })
    ).rejects.toMatchObject({
      name: "ConflictError",
      code: "REVIEW_NOT_STARTED",
    });

    // Verify no TeacherAssessment draft was persisted
    const cockpit = await getTeacherReviewCockpit(teacherId, submissionId);
    expect(cockpit.teacherDraft).toBeNull();
  });

  it("Test B: claim review then save draft succeeds with locked attemptNumber (Finding 1A & 1B)", async () => {
    // Claim review first
    const claimed = await claimHomeworkReview(teacherId, submissionId);
    expect(claimed.status).toBe("in_review");
    expect(claimed.reviewedAttemptNumber).toBe(1);

    const draft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 6.5,
      lexicalResource: 7.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.5,
      overallFeedback: "Nháp sau khi đã nhận bài chấm",
      annotations: [
        {
          id: "ann_b",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 10.0,
          category: "pronunciation",
          teacherComment: "Phát âm tốt",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(draft.status).toBe("draft");
    expect(draft.attemptNumber).toBe(1);
    expect(draft.annotations).toHaveLength(1);
  });

  it("Test C: learner resubmit race is prevented once review is claimed (Finding 1 - Invariant)", async () => {
    // Before claim: draft save is rejected
    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [],
      })
    ).rejects.toMatchObject({ code: "REVIEW_NOT_STARTED" });

    // Claim review locks the attempt
    await claimHomeworkReview(teacherId, submissionId);

    // Now draft save succeeds
    const draft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.0,
      overallFeedback: "Locked attempt draft",
      annotations: [],
    });
    expect(draft.attemptNumber).toBe(1);
  });

  it("Test D: read-side defense in depth ignores stale attempt draft (Finding 1C)", async () => {
    // Authoritative review is attempt 2
    const sub = devSubmissionCache.get(submissionId)!;
    devSubmissionCache.set(submissionId, {
      ...sub,
      status: "in_review",
      currentAttemptNumber: 2,
      reviewedAttemptNumber: 2,
    });

    // Seed a teacher assessment whose attemptNumber = 1 (stale)
    devTeacherAssessmentCache.set(submissionId, {
      id: "stale_draft_01",
      submissionId,
      assignmentId,
      teacherId,
      attemptNumber: 1, // Mismatched attempt!
      status: "draft",
      fluencyCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.0,
      overallBand: 6.0,
      overallFeedback: "Stale draft from attempt 1",
      criteriaFeedback: null,
      annotations: [
        {
          id: "stale_ann_1",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 5.0,
          category: "lexical",
          teacherComment: "Stale comment",
          createdAt: new Date().toISOString(),
        },
      ],
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Also add attempt 2 in attempt cache so findAttemptByNumber succeeds
    const attempts = devAttemptCache.get(submissionId) || [];
    devAttemptCache.set(submissionId, [
      ...attempts,
      {
        id: "sub_1_attempt_2",
        submissionId,
        attemptNumber: 2,
        audioResponses: [
          {
            promptId: "p_part1_1",
            storageKey: "sub_1/attempt_2/audio_1.webm",
            durationMs: 30000,
            audioBytes: 30000,
          },
        ],
        submittedAt: new Date(),
      },
    ]);

    const cockpit = await getTeacherReviewCockpit(teacherId, submissionId);
    expect(cockpit.reviewAttempt.attemptNumber).toBe(2);
    // Stale draft from attempt 1 MUST be ignored (null)
    expect(cockpit.teacherDraft).toBeNull();
  });

  it("creates a new TeacherAssessment when an existing draft belongs to another attempt", async () => {
    // 1. Arrange submission whose authoritative ReviewedAttempt is attempt #2
    const sub = devSubmissionCache.get(submissionId)!;
    devSubmissionCache.set(submissionId, {
      ...sub,
      status: "in_review",
      currentAttemptNumber: 2,
      reviewedAttemptNumber: 2,
    });

    // 2. Ensure attempt #2 exists in cache
    const attempts = devAttemptCache.get(submissionId) || [];
    devAttemptCache.set(submissionId, [
      ...attempts,
      {
        id: "sub_1_attempt_2",
        submissionId,
        attemptNumber: 2,
        audioResponses: [
          {
            promptId: "p_part1_1",
            storageKey: "sub_1/attempt_2/audio_1.webm",
            durationMs: 30000,
            audioBytes: 30000,
          },
          {
            promptId: "p_part1_2",
            storageKey: "sub_1/attempt_2/audio_2.webm",
            durationMs: 45000,
            audioBytes: 45000,
          },
        ],
        submittedAt: new Date(),
      },
    ]);

    // 3. Seed an existing stale TeacherAssessment for attempt 1
    const staleId = "stale_draft_attempt_1";
    devTeacherAssessmentCache.set(submissionId, {
      id: staleId,
      submissionId,
      assignmentId,
      teacherId,
      attemptNumber: 1,
      status: "draft",
      fluencyCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.0,
      overallBand: 6.0,
      overallFeedback: "Stale draft from attempt 1",
      criteriaFeedback: null,
      annotations: [],
      publishedAt: null,
      createdAt: new Date(Date.now() - 100000),
      updatedAt: new Date(Date.now() - 100000),
    });

    // 4. Call saveHomeworkReviewDraft for ReviewedAttempt #2
    const draft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 7.0,
      lexicalResource: 7.0,
      grammaticalRangeAccuracy: 7.0,
      pronunciation: 7.0,
      overallFeedback: "Fresh draft for attempt 2",
      annotations: [
        {
          id: "ann_attempt_2",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 15.0,
          category: "pronunciation",
          teacherComment: "Attempt 2 pronunciation feedback",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    // 5. Assert returned draft:
    expect(draft.attemptNumber).toBe(2);
    expect(draft.id).not.toBe(staleId);
    expect(draft.status).toBe("draft");

    // 6. Assert the new draft can be retrieved as current Teacher draft in cockpit
    const cockpit = await getTeacherReviewCockpit(teacherId, submissionId);
    expect(cockpit.teacherDraft).not.toBeNull();
    expect(cockpit.teacherDraft?.attemptNumber).toBe(2);
    expect(cockpit.teacherDraft?.id).toBe(draft.id);
    expect(cockpit.teacherDraft?.id).not.toBe(staleId);
    expect(cockpit.teacherDraft?.overallFeedback).toBe(
      "Fresh draft for attempt 2"
    );
  });

  it("should save draft annotations and recover them through getTeacherReviewCockpit", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    const draft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 6.5,
      lexicalResource: 7.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.5,
      overallFeedback: "Nhận xét bản nháp ban đầu",
      annotations: [
        {
          id: "ann_1",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 12.4,
          category: "pronunciation",
          teacherComment: "Phát âm từ 'hometown' chưa chuẩn",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(draft.status).toBe("draft");
    expect(draft.annotations).toHaveLength(1);
    expect(draft.annotations[0].promptId).toBe("p_part1_1");
    expect(draft.annotations[0].partNumber).toBe(1);
    expect(draft.annotations[0].timestampSeconds).toBe(12.4);
    expect(draft.annotations[0].teacherComment).toBe(
      "Phát âm từ 'hometown' chưa chuẩn"
    );

    // Recover via getTeacherReviewCockpit
    const cockpit = await getTeacherReviewCockpit(teacherId, submissionId);
    expect(cockpit.teacherDraft).not.toBeNull();
    expect(cockpit.teacherDraft?.annotations).toHaveLength(1);
    expect(cockpit.teacherDraft?.annotations[0].id).toBe("ann_1");
    expect(cockpit.teacherDraft?.annotations[0].promptId).toBe("p_part1_1");
  });

  it("should enforce exact response identity: prompt A annotation does not validate or belong to prompt B even in the same IELTS part", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    // Save annotation for prompt 1
    await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.0,
      overallFeedback: "",
      annotations: [
        {
          id: "ann_prompt_1",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 5.0,
          category: "grammar",
          teacherComment: "Lỗi thì quá khứ đơn",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const cockpit = await getTeacherReviewCockpit(teacherId, submissionId);
    const annotations = cockpit.teacherDraft?.annotations || [];

    // Filter for prompt 1
    const p1Annots = annotations.filter((a) => a.promptId === "p_part1_1");
    expect(p1Annots).toHaveLength(1);

    // Filter for prompt 2 (same part 1!)
    const p2Annots = annotations.filter((a) => a.promptId === "p_part1_2");
    expect(p2Annots).toHaveLength(0);
  });

  it("should accept valid annotation at timestamp 0, 29.9, and exactly at audio duration end (30.0s) (Finding 2)", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    const draft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.0,
      overallFeedback: "",
      annotations: [
        {
          id: "ann_0",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 0,
          category: "fluency",
          teacherComment: "Khởi đầu câu trả lời",
          createdAt: new Date().toISOString(),
        },
        {
          id: "ann_29_9",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 29.9,
          category: "lexical",
          teacherComment: "Gần cuối câu trả lời",
          createdAt: new Date().toISOString(),
        },
        {
          id: "ann_30_0",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 30.0,
          category: "lexical",
          teacherComment: "Đúng thời lượng ghi âm",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(draft.annotations).toHaveLength(3);
    expect(draft.annotations[0].timestampSeconds).toBe(0);
    expect(draft.annotations[1].timestampSeconds).toBe(29.9);
    expect(draft.annotations[2].timestampSeconds).toBe(30.0);
  });

  it("should reject timestamp 30.1 when audio duration is 30.0s (Finding 2)", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    // p_part1_1 duration is 30,000ms = 30.0s. 30.1 > 30.0 must be rejected
    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [
          {
            id: "ann_30_1",
            promptId: "p_part1_1",
            partNumber: 1,
            timestampSeconds: 30.1,
            category: "pronunciation",
            teacherComment: "Beyond audio duration by 0.1s",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject negative timestamp", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [
          {
            id: "ann_neg",
            promptId: "p_part1_1",
            partNumber: 1,
            timestampSeconds: -1.5,
            category: "fluency",
            teacherComment: "Invalid timestamp",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject timestamp far beyond known audio duration", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    // p_part1_1 duration is 30,000ms = 30s
    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [
          {
            id: "ann_beyond",
            promptId: "p_part1_1",
            partNumber: 1,
            timestampSeconds: 35.0,
            category: "pronunciation",
            teacherComment: "Beyond audio duration",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject unknown promptId", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [
          {
            id: "ann_unknown_prompt",
            promptId: "unknown_prompt_999",
            partNumber: 1,
            timestampSeconds: 10.0,
            category: "pronunciation",
            teacherComment: "Unknown prompt",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject blank teacher comment", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [
          {
            id: "ann_blank",
            promptId: "p_part1_1",
            partNumber: 1,
            timestampSeconds: 10.0,
            category: "pronunciation",
            teacherComment: "   ",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject unsupported category (including old 'general')", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [
          {
            id: "ann_invalid_cat",
            promptId: "p_part1_1",
            partNumber: 1,
            timestampSeconds: 10.0,
            category: "general" as unknown as SpeakingReviewAnnotationCategory,
            teacherComment: "General comment",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should update existing draft rather than creating parallel draft records", async () => {
    await claimHomeworkReview(teacherId, submissionId);

    const firstDraft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.0,
      overallFeedback: "",
      annotations: [
        {
          id: "ann_first",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 5.0,
          category: "lexical",
          teacherComment: "Comment 1",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const secondDraft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 7.0,
      lexicalResource: 6.5,
      grammaticalRangeAccuracy: 6.5,
      pronunciation: 7.0,
      overallFeedback: "Updated draft feedback",
      annotations: [
        {
          id: "ann_second",
          promptId: "p_part1_2",
          partNumber: 1,
          timestampSeconds: 15.0,
          category: "fluency",
          teacherComment: "Comment 2",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    // ID and createdAt must be preserved
    expect(secondDraft.id).toBe(firstDraft.id);
    expect(secondDraft.overallBand).toBe(7.0);
    expect(secondDraft.annotations).toHaveLength(1);
    expect(secondDraft.annotations[0].id).toBe("ann_second");
  });

  it("should reject saving draft once submission is published", async () => {
    const existing = devSubmissionCache.get(submissionId)!;
    devSubmissionCache.set(submissionId, {
      ...existing,
      status: "published",
    });

    await expect(
      saveHomeworkReviewDraft(teacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [],
      })
    ).rejects.toThrow(ConflictError);
  });

  it("should reject non-owner teacher", async () => {
    await expect(
      saveHomeworkReviewDraft(otherTeacherId, submissionId, {
        fluencyCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 6.0,
        overallFeedback: "",
        annotations: [],
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
