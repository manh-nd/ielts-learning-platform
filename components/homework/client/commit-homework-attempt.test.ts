import { describe, it, expect, mock } from "bun:test";
import { commitHomeworkAttempt } from "./commit-homework-attempt";
import type {
  HomeworkSubmission,
  SubmissionAttempt,
} from "@/modules/homework/domain/homework-types";

describe("commitHomeworkAttempt client workflow seam (Issue #96)", () => {
  const assignmentId = "asg_123";
  const prompts = [
    { promptId: "p_1", partNumber: 1 },
    { promptId: "p_2", partNumber: 2 },
  ];

  const mockSubmission: HomeworkSubmission = {
    id: "sub_1",
    assignmentId,
    learnerId: "lrn_1",
    status: "submitted",
    currentAttemptNumber: 1,
    reviewedAttemptNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAttempt: SubmissionAttempt = {
    id: "att_1",
    submissionId: "sub_1",
    attemptNumber: 1,
    audioResponses: [
      {
        promptId: "p_1",
        storageKey: "homework/mock/p_1.webm",
        durationMs: 30000,
        audioBytes: 50000,
      },
      {
        promptId: "p_2",
        storageKey: "homework/mock/p_2.webm",
        durationMs: 60000,
        audioBytes: 100000,
      },
    ],
    submittedAt: new Date(),
  };

  it("1. returns explicit incomplete result and performs no upload/submit when recordings are missing", async () => {
    const fetchFn = mock(async () => new Response());

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts,
      recordedClips: {
        p_1: {
          blob: new Blob(["audio-data"], { type: "audio/webm" }),
          durationSeconds: 30,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("incomplete");
    if (result.kind === "incomplete") {
      expect(result.missingPromptCount).toBe(1);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("2. requests presigned URL for Blob without storageKey", async () => {
    const fetchCalls: Array<{ url: string; method?: string }> = [];

    const fetchFn = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        fetchCalls.push({ url, method: init?.method });

        if (url.includes("/upload-url")) {
          return new Response(
            JSON.stringify({
              uploadUrl: "https://storage.example.com/upload-target",
              storageKey: "homework/audio/key_p1.webm",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url === "https://storage.example.com/upload-target") {
          return new Response(null, { status: 200 });
        }
        if (url.includes("/submit")) {
          return new Response(
            JSON.stringify({
              success: true,
              submission: mockSubmission,
              attempt: mockAttempt,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(null, { status: 404 });
      }
    );

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          blob: new Blob(["blob-content"], { type: "audio/webm" }),
          durationSeconds: 25,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("committed");
    expect(
      fetchCalls.some(
        (c) => c.url.includes("/upload-url") && c.method === "POST"
      )
    ).toBe(true);
  });

  it("3. uploads Blob via PUT to the returned presigned upload URL", async () => {
    let putCalledWithHeaders: HeadersInit | undefined;
    let putCalledWithBody: BodyInit | null | undefined;

    const testBlob = new Blob(["test-audio-bytes"], { type: "audio/wav" });

    const fetchFn = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/upload-url")) {
          return new Response(
            JSON.stringify({
              uploadUrl: "https://s3.amazonaws.com/test-bucket/put-target",
              storageKey: "homework/storage/key.wav",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (url === "https://s3.amazonaws.com/test-bucket/put-target") {
          putCalledWithHeaders = init?.headers;
          putCalledWithBody = init?.body;
          return new Response(null, { status: 200 });
        }
        if (url.includes("/submit")) {
          return new Response(
            JSON.stringify({
              success: true,
              submission: mockSubmission,
              attempt: mockAttempt,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(null, { status: 404 });
      }
    );

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          blob: testBlob,
          durationSeconds: 15,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("committed");
    expect(putCalledWithHeaders).toEqual({ "Content-Type": "audio/wav" });
    expect(putCalledWithBody).toBe(testBlob);
  });

  it("4. skips presign and PUT when storageKey already exists", async () => {
    const fetchCalls: string[] = [];

    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchCalls.push(url);

      if (url.includes("/submit")) {
        return new Response(
          JSON.stringify({
            success: true,
            submission: mockSubmission,
            attempt: mockAttempt,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          storageKey: "homework/existing/p1.webm",
          durationSeconds: 20,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("committed");
    expect(fetchCalls.some((u) => u.includes("/upload-url"))).toBe(false);
    expect(fetchCalls.some((u) => u.includes("/submit"))).toBe(true);
  });

  it("5. preserves storageKey-only clips without Blob (hydrated attempt), uses audioBytes fallback, and submits successfully", async () => {
    let submitPayload: { audioResponses?: unknown[] } | undefined;

    const fetchFn = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/submit")) {
          submitPayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              success: true,
              submission: mockSubmission,
              attempt: mockAttempt,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(null, { status: 404 });
      }
    );

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          storageKey: "homework/hydrated/p1.webm",
          durationSeconds: 42,
          // No blob!
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("committed");
    expect(submitPayload?.audioResponses).toEqual([
      {
        promptId: "p_1",
        storageKey: "homework/hydrated/p1.webm",
        durationMs: 42000,
        audioBytes: 45000, // shipped fallback preserved
      },
    ]);
  });

  it("6. mockMode === true generates mock storage keys and performs NO presign or PUT requests", async () => {
    const fetchCalls: string[] = [];
    let submitPayload: { audioResponses?: unknown[] } | undefined;

    const fetchFn = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        fetchCalls.push(url);

        if (url.includes("/submit")) {
          submitPayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              success: true,
              submission: mockSubmission,
              attempt: mockAttempt,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(null, { status: 404 });
      }
    );

    const result = await commitHomeworkAttempt({
      assignmentId: "asg_mock_99",
      prompts: [{ promptId: "p_mock_1", partNumber: 1 }],
      recordedClips: {
        p_mock_1: {
          blob: new Blob(["mock-data"], { type: "audio/webm" }),
          durationSeconds: 10,
        },
      },
      mockMode: true,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("committed");
    expect(fetchCalls.some((u) => u.includes("/upload-url"))).toBe(false);
    expect(
      submitPayload?.audioResponses?.[0] as { storageKey: string }
    ).toMatchObject({
      promptId: "p_mock_1",
      storageKey: "homework/mock_learner/asg_mock_99/p_mock_1/response.webm",
    });
  });

  it("7. constructs correct AudioResponseClip[] payload sent to /submit", async () => {
    let capturedBody: { audioResponses?: unknown[] } | undefined;

    const fetchFn = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/submit")) {
          capturedBody = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              success: true,
              submission: mockSubmission,
              attempt: mockAttempt,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(null, { status: 404 });
      }
    );

    const blob1 = new Blob(["12345678"], { type: "audio/webm" }); // size 8
    const blob2 = new Blob(["1234567890"], { type: "audio/webm" }); // size 10

    await commitHomeworkAttempt({
      assignmentId,
      prompts,
      recordedClips: {
        p_1: {
          storageKey: "homework/key1.webm",
          blob: blob1,
          durationSeconds: 12.3,
        },
        p_2: {
          storageKey: "homework/key2.webm",
          blob: blob2,
          durationSeconds: 45.8,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(capturedBody?.audioResponses).toEqual([
      {
        promptId: "p_1",
        storageKey: "homework/key1.webm",
        durationMs: 12300,
        audioBytes: 8,
      },
      {
        promptId: "p_2",
        storageKey: "homework/key2.webm",
        durationMs: 45800,
        audioBytes: 10,
      },
    ]);
  });

  it("8. halts workflow and performs NO submit request when upload fails", async () => {
    const fetchCalls: string[] = [];

    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchCalls.push(url);

      if (url.includes("/upload-url")) {
        return new Response(
          JSON.stringify({ error: { message: "S3 quota exceeded" } }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          blob: new Blob(["content"], { type: "audio/webm" }),
          durationSeconds: 15,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("upload_failed");
    if (result.kind === "upload_failed") {
      expect(result.message).toContain("S3 quota exceeded");
    }
    expect(fetchCalls.some((u) => u.includes("/submit"))).toBe(false);
  });

  it("9. maps successful initial attempt to committed result and dispatches submitted telemetry", async () => {
    const telemetryCalls: string[] = [];

    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/submit")) {
        return new Response(
          JSON.stringify({
            success: true,
            submission: { ...mockSubmission, currentAttemptNumber: 1 },
            attempt: { ...mockAttempt, attemptNumber: 1 },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/telemetry/events")) {
        telemetryCalls.push("telemetry_dispatched");
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(null, { status: 404 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          storageKey: "homework/existing.webm",
          durationSeconds: 10,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("committed");
    if (result.kind === "committed") {
      expect(result.submission.id).toBe("sub_1");
      expect(result.attempt.attemptNumber).toBe(1);
    }
  });

  it("10. maps successful resubmission to committed result and dispatches resubmitted telemetry", async () => {
    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/submit")) {
        return new Response(
          JSON.stringify({
            success: true,
            submission: { ...mockSubmission, currentAttemptNumber: 2 },
            attempt: { ...mockAttempt, attemptNumber: 2 },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          storageKey: "homework/existing.webm",
          durationSeconds: 10,
        },
      },
      currentAttemptNumber: 1,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("committed");
    if (result.kind === "committed") {
      expect(result.submission.currentAttemptNumber).toBe(2);
      expect(result.attempt.attemptNumber).toBe(2);
    }
  });

  it("11. maps HTTP 409 to explicit conflict_locked result with message", async () => {
    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/submit")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "SUBMISSION_UNDER_REVIEW",
              message:
                "Bài làm đã được Giáo viên tiếp nhận chấm, không thể nộp lại.",
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          storageKey: "homework/existing.webm",
          durationSeconds: 10,
        },
      },
      currentAttemptNumber: 1,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("conflict_locked");
    if (result.kind === "conflict_locked") {
      expect(result.message).toContain(
        "Bài làm đã được Giáo viên tiếp nhận chấm, không thể nộp lại."
      );
    }
  });

  it("12. maps server validation/deadline rejection (!ok) to recoverable rejected result with message", async () => {
    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/submit")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message:
                "Đã hết hạn nộp bài. Hệ thống không tiếp nhận thêm bài làm sau thời hạn chót.",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          storageKey: "homework/existing.webm",
          durationSeconds: 10,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.message).toContain("Đã hết hạn nộp bài");
    }
  });

  it("13. telemetry failure does not alter committed result", async () => {
    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/submit")) {
        return new Response(
          JSON.stringify({
            success: true,
            submission: mockSubmission,
            attempt: mockAttempt,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/telemetry/events")) {
        // Telemetry network failure!
        throw new Error("Telemetry service unavailable");
      }
      return new Response(null, { status: 404 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts: [{ promptId: "p_1", partNumber: 1 }],
      recordedClips: {
        p_1: {
          storageKey: "homework/existing.webm",
          durationSeconds: 10,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Workflow outcome is unaffected by telemetry error
    expect(result.kind).toBe("committed");
  });

  it("14. upload failure after earlier success returns partial uploadedStorageKeys for retries", async () => {
    let p1Uploaded = false;

    const fetchFn = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/upload-url")) {
        if (!p1Uploaded) {
          p1Uploaded = true;
          return new Response(
            JSON.stringify({
              uploadUrl: "https://storage.example.com/p1",
              storageKey: "homework/audio/p1_uploaded.webm",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } else {
          // p2 fails
          return new Response(
            JSON.stringify({ error: { message: "Network timeout on p2" } }),
            { status: 504, headers: { "Content-Type": "application/json" } }
          );
        }
      }
      if (url === "https://storage.example.com/p1") {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await commitHomeworkAttempt({
      assignmentId,
      prompts,
      recordedClips: {
        p_1: {
          blob: new Blob(["p1"], { type: "audio/webm" }),
          durationSeconds: 10,
        },
        p_2: {
          blob: new Blob(["p2"], { type: "audio/webm" }),
          durationSeconds: 15,
        },
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.kind).toBe("upload_failed");
    if (result.kind === "upload_failed") {
      expect(result.uploadedStorageKeys).toEqual({
        p_1: "homework/audio/p1_uploaded.webm",
      });
    }
  });
});
