import { describe, it, expect, beforeEach } from "bun:test";
import { resolveTeacherReviewAudioClip } from "./resolve-teacher-review-audio-clip";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  createTeacherHomeworkReviewFixture,
  teacherId,
  otherTeacherId,
} from "@/tests/fixtures/teacher-homework-review";

describe("resolveTeacherReviewAudioClip application use case (Issue #100)", () => {
  let submissionId: string;

  beforeEach(async () => {
    ({ submissionId } = await createTeacherHomeworkReviewFixture());
  });

  it("should resolve the prompt clip and storage key for authorized teacher", async () => {
    const clip = await resolveTeacherReviewAudioClip(
      teacherId,
      submissionId,
      "prompt_p1_1"
    );

    expect(clip).toBeDefined();
    expect(clip.promptId).toBe("prompt_p1_1");
    expect(clip.storageKey).toContain("p1.webm");
  });

  it("should reject a teacher who does not own the submission with ForbiddenError (403)", async () => {
    await expect(
      resolveTeacherReviewAudioClip(otherTeacherId, submissionId, "prompt_p1_1")
    ).rejects.toThrow(ForbiddenError);
  });

  it("should reject with NotFoundError (404) when submission does not exist", async () => {
    await expect(
      resolveTeacherReviewAudioClip(
        teacherId,
        "sub_non_existent",
        "prompt_p1_1"
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("should reject with NotFoundError (404) when promptId does not exist in the attempt", async () => {
    await expect(
      resolveTeacherReviewAudioClip(
        teacherId,
        submissionId,
        "invalid_prompt_id"
      )
    ).rejects.toThrow(NotFoundError);
  });
});
