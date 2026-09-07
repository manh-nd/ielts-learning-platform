import { describe, it, expect, beforeEach } from "bun:test";
import { saveHomeworkReviewDraft } from "./save-homework-review-draft";
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
} from "@/modules/homework/infrastructure/homework-submission-repository";
import { clearDevHomeworkAssessmentCache } from "@/modules/homework/infrastructure/homework-assessment-repository";
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

  it("should save draft annotations and recover them through getTeacherReviewCockpit", async () => {
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

  it("should accept valid annotation at timestamp 0 and near audio duration end", async () => {
    const draft = await saveHomeworkReviewDraft(teacherId, submissionId, {
      fluencyCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAccuracy: 6.0,
      pronunciation: 6.0,
      overallFeedback: "",
      annotations: [
        {
          id: "ann_start",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 0,
          category: "fluency",
          teacherComment: "Khởi đầu câu trả lời hơi chậm",
          createdAt: new Date().toISOString(),
        },
        {
          id: "ann_end",
          promptId: "p_part1_1",
          partNumber: 1,
          timestampSeconds: 29.8,
          category: "lexical",
          teacherComment: "Kết bài tốt",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    expect(draft.annotations).toHaveLength(2);
    expect(draft.annotations[0].timestampSeconds).toBe(0);
    expect(draft.annotations[1].timestampSeconds).toBe(29.8);
  });

  it("should reject negative timestamp", async () => {
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

  it("should reject timestamp beyond known audio duration", async () => {
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
