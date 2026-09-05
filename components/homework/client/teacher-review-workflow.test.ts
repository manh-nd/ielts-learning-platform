import { describe, it, expect, mock } from "bun:test";
import {
  mapInitialSubmissionStatusToWorkflowState,
  claimTeacherReview,
  publishTeacherAssessment,
} from "./teacher-review-workflow";
import type { PublishAssessmentInput } from "@/modules/homework/application/homework-inputs";

describe("teacher-review-workflow client seam (Issue #97)", () => {
  const submissionId = "sub_test_123";

  const samplePublishInput: PublishAssessmentInput = {
    fluencyCoherence: 7.0,
    lexicalResource: 7.5,
    grammaticalRangeAccuracy: 6.5,
    pronunciation: 7.0,
    overallFeedback: "Bài nói lưu loát và tự nhiên.",
    criteriaFeedback: {
      fluencyAndCoherence: "Phản xạ nhanh",
      lexicalResource: "Từ vựng đa dạng",
      grammaticalRangeAndAccuracy: "Cần chú ý thì quá khứ",
      pronunciation: "Ngữ điệu tốt",
    },
    activeReviewDurationMs: 45000,
  };

  describe("mapInitialSubmissionStatusToWorkflowState", () => {
    it("maps 'submitted' status to 'claimable' workflow state", () => {
      expect(mapInitialSubmissionStatusToWorkflowState("submitted")).toBe(
        "claimable"
      );
    });

    it("maps 'in_review' status to 'in_review' workflow state", () => {
      expect(mapInitialSubmissionStatusToWorkflowState("in_review")).toBe(
        "in_review"
      );
    });

    it("maps 'published' status to 'published' workflow state", () => {
      expect(mapInitialSubmissionStatusToWorkflowState("published")).toBe(
        "published"
      );
    });
  });

  describe("claimTeacherReview", () => {
    it("1. successful claim calls start-review endpoint and returns 'claimed'", async () => {
      let calledUrl = "";
      let calledMethod = "";

      const fetchFn = mock(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          calledUrl = typeof input === "string" ? input : input.toString();
          calledMethod = init?.method || "";
          return new Response(
            JSON.stringify({
              success: true,
              submission: { id: submissionId, status: "in_review" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      );

      const result = await claimTeacherReview({
        submissionId,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(calledUrl).toBe(
        `/api/teacher/submissions/${submissionId}/start-review`
      );
      expect(calledMethod).toBe("POST");
      expect(result.kind).toBe("claimed");
    });

    it("2. claim returning 409 with SUBMISSION_ALREADY_PUBLISHED maps to 'terminal'", async () => {
      const fetchFn = mock(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "SUBMISSION_ALREADY_PUBLISHED",
              message: "Bài nộp đã được xuất bản kết quả đánh giá chính thức.",
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      });

      const result = await claimTeacherReview({
        submissionId,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("terminal");
      if (result.kind === "terminal") {
        expect(result.message).toBe(
          "Bài nộp đã được xuất bản kết quả đánh giá chính thức."
        );
      }
    });

    it("3. claim returning 409 without SUBMISSION_ALREADY_PUBLISHED maps to 'rejected'", async () => {
      const fetchFn = mock(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "SUBMISSION_LOCKED_BY_ANOTHER",
              message: "Bài nộp đang được giáo viên khác mở chấm.",
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      });

      const result = await claimTeacherReview({
        submissionId,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.message).toBe(
          "Bài nộp đang được giáo viên khác mở chấm."
        );
      }
    });

    it("4. claim returning 500 maps to 'rejected' preserving server error message", async () => {
      const fetchFn = mock(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "Lỗi hệ thống máy chủ.",
            },
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      });

      const result = await claimTeacherReview({
        submissionId,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.message).toBe("Lỗi hệ thống máy chủ.");
      }
    });

    it("5. claim network failure maps safely to 'rejected' without throwing", async () => {
      const fetchFn = mock(async () => {
        throw new Error("Network request failed");
      });

      const result = await claimTeacherReview({
        submissionId,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.message).toBe("Network request failed");
      }
    });

    it("6. mockMode returns 'claimed' immediately without calling fetch", async () => {
      const fetchFn = mock(async () => new Response());

      const result = await claimTeacherReview({
        submissionId,
        mockMode: true,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("claimed");
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("7. onStartReview callback executes and maps success/rejection", async () => {
      let callbackInvoked = false;
      const onStartReviewSuccess = async () => {
        callbackInvoked = true;
      };

      const result = await claimTeacherReview({
        submissionId,
        onStartReview: onStartReviewSuccess,
      });

      expect(callbackInvoked).toBe(true);
      expect(result.kind).toBe("claimed");

      const onStartReviewFail = async () => {
        throw new Error("Custom callback failed");
      };

      const failResult = await claimTeacherReview({
        submissionId,
        onStartReview: onStartReviewFail,
      });

      expect(failResult.kind).toBe("rejected");
      if (failResult.kind === "rejected") {
        expect(failResult.message).toBe("Custom callback failed");
      }
    });
  });

  describe("publishTeacherAssessment", () => {
    it("8. valid publish sends POST to /publish with PublishAssessmentInput", async () => {
      let calledUrl = "";
      let calledMethod = "";
      let parsedBody: unknown = null;

      const fetchFn = mock(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          calledUrl = typeof input === "string" ? input : input.toString();
          calledMethod = init?.method || "";
          parsedBody = JSON.parse((init?.body as string) || "{}");
          return new Response(
            JSON.stringify({
              success: true,
              submission: { id: submissionId, status: "published" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      );

      const result = await publishTeacherAssessment({
        submissionId,
        input: samplePublishInput,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(calledUrl).toBe(
        `/api/teacher/submissions/${submissionId}/publish`
      );
      expect(calledMethod).toBe("POST");
      expect(parsedBody).toEqual(samplePublishInput);
      expect(result.kind).toBe("published");
    });

    it("9. publish payload includes activeReviewDurationMs", async () => {
      let parsedBody: Record<string, unknown> = {};

      const fetchFn = mock(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          parsedBody = JSON.parse((init?.body as string) || "{}");
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      );

      await publishTeacherAssessment({
        submissionId,
        input: { ...samplePublishInput, activeReviewDurationMs: 123456 },
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(parsedBody.activeReviewDurationMs).toBe(123456);
    });

    it("10. conflicting publish (HTTP 409) maps to 'conflict'", async () => {
      const fetchFn = mock(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "SUBMISSION_ALREADY_PUBLISHED",
              message:
                "Bài nộp này đã được xuất bản kết quả chính thức trước đó.",
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      });

      const result = await publishTeacherAssessment({
        submissionId,
        input: samplePublishInput,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("conflict");
      if (result.kind === "conflict") {
        expect(result.message).toBe(
          "Bài nộp này đã được xuất bản kết quả chính thức trước đó."
        );
      }
    });

    it("11. validation error (HTTP 400) maps to 'rejected' preserving server message", async () => {
      const fetchFn = mock(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Điểm tiêu chí Fluency & Coherence không hợp lệ.",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      });

      const result = await publishTeacherAssessment({
        submissionId,
        input: samplePublishInput,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.message).toBe(
          "Điểm tiêu chí Fluency & Coherence không hợp lệ."
        );
      }
    });

    it("12. publish network error maps safely to 'rejected' without throwing", async () => {
      const fetchFn = mock(async () => {
        throw new Error("Failed to fetch");
      });

      const result = await publishTeacherAssessment({
        submissionId,
        input: samplePublishInput,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.message).toBe("Failed to fetch");
      }
    });

    it("13. mockMode publish returns 'published' without calling fetch", async () => {
      const fetchFn = mock(async () => new Response());

      const result = await publishTeacherAssessment({
        submissionId,
        input: samplePublishInput,
        mockMode: true,
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(result.kind).toBe("published");
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("14. onPublish callback receives input and maps outcome", async () => {
      let receivedInput: PublishAssessmentInput | null = null;
      const onPublishSuccess = async (input: PublishAssessmentInput) => {
        receivedInput = input;
      };

      const result = await publishTeacherAssessment({
        submissionId,
        input: samplePublishInput,
        onPublish: onPublishSuccess,
      });

      expect(receivedInput as PublishAssessmentInput | null).toEqual(
        samplePublishInput
      );
      expect(result.kind).toBe("published");

      const onPublishFail = async () => {
        throw new Error("Custom publish callback error");
      };

      const failResult = await publishTeacherAssessment({
        submissionId,
        input: samplePublishInput,
        onPublish: onPublishFail,
      });

      expect(failResult.kind).toBe("rejected");
      if (failResult.kind === "rejected") {
        expect(failResult.message).toBe("Custom publish callback error");
      }
    });
  });
});
