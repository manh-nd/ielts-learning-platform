import { describe, it, expect, afterEach } from "bun:test";
import {
  dispatchTelemetryEvent,
  dispatchPracticeStarted,
  dispatchPracticeAudioRecorded,
  dispatchPracticeSubmittedForFeedback,
  dispatchPracticeFeedbackReady,
  dispatchPracticeAgainStarted,
  dispatchPracticeAudioError,
} from "./telemetry-client";

describe("Telemetry Client Helper (Non-Blocking & Invariant Preservation)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should format and POST telemetry event payload successfully", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;

    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ success: true, eventId: "evt_test_123" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const res = await dispatchTelemetryEvent({
      eventName: "practice_started",
      contextType: "practice",
      contextId: "ses_abc_1",
      properties: { topic: "Art" },
    });

    expect(capturedUrl).toBe("/api/telemetry/events");
    expect(capturedBody).toEqual({
      eventName: "practice_started",
      contextType: "practice",
      contextId: "ses_abc_1",
      durationMs: null,
      properties: { topic: "Art" },
    });
    expect(res.success).toBe(true);
    expect(res.eventId).toBe("evt_test_123");
  });

  it("should never throw when fetch throws a network exception (fire-and-forget invariant)", async () => {
    globalThis.fetch = (() => {
      throw new Error("Failed to fetch (DNS / Network down)");
    }) as unknown as typeof fetch;

    // Must resolve cleanly without throwing
    const res = await dispatchTelemetryEvent({
      eventName: "practice_started",
      contextType: "practice",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Failed to fetch (DNS / Network down)");
  });

  it("should handle HTTP 500 or HTTP 400 server errors gracefully without throwing", async () => {
    globalThis.fetch = (async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as unknown as typeof fetch;

    const res = await dispatchTelemetryEvent({
      eventName: "practice_audio_recorded",
      contextType: "practice",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("HTTP_500");
  });

  it("should invoke dispatchPracticeAudioRecorded with durationMs and audio_bytes", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string) as Record<
        string,
        unknown
      >;
      return new Response(
        JSON.stringify({ success: true, eventId: "evt_rec_456" }),
        { status: 201 }
      );
    }) as unknown as typeof fetch;

    const res = await dispatchPracticeAudioRecorded(
      "ses_rec_1",
      30500,
      245000,
      {
        codec: "opus",
      }
    );

    expect(res.success).toBe(true);
    expect(capturedBody.eventName).toBe("practice_audio_recorded");
    expect(capturedBody.contextId).toBe("ses_rec_1");
    expect(capturedBody.durationMs).toBe(30500);
    const props = (capturedBody.properties as Record<string, unknown>) || {};
    expect(props.audio_bytes).toBe(245000);
    expect(props.codec).toBe("opus");
  });

  it("should invoke dispatchPracticeFeedbackReady with latency durationMs", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string) as Record<
        string,
        unknown
      >;
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    }) as unknown as typeof fetch;

    const res = await dispatchPracticeFeedbackReady("ses_feed_1", 2150, {
      overall_band: 7.0,
    });

    expect(res.success).toBe(true);
    expect(capturedBody.eventName).toBe("practice_feedback_ready");
    expect(capturedBody.durationMs).toBe(2150);
    const props = (capturedBody.properties as Record<string, unknown>) || {};
    expect(props.overall_band).toBe(7.0);
  });

  it("should invoke dispatchPracticeAudioError with error_code and error_message", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string) as Record<
        string,
        unknown
      >;
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    }) as unknown as typeof fetch;

    const res = await dispatchPracticeAudioError(
      "ses_err_1",
      "PERMISSION_DENIED",
      "User denied microphone access"
    );

    expect(res.success).toBe(true);
    expect(capturedBody.eventName).toBe("practice_audio_error");
    const props = (capturedBody.properties as Record<string, unknown>) || {};
    expect(props.error_code).toBe("PERMISSION_DENIED");
    expect(props.error_message).toBe("User denied microphone access");
  });

  it("should invoke dispatchPracticeStarted, dispatchPracticeAgainStarted, and dispatchPracticeSubmittedForFeedback", async () => {
    const events: string[] = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const b = JSON.parse(init?.body as string);
      events.push(b.eventName);
      return new Response(JSON.stringify({ success: true }), { status: 201 });
    }) as unknown as typeof fetch;

    await dispatchPracticeStarted("ses_0");
    await dispatchPracticeSubmittedForFeedback("ses_1");
    await dispatchPracticeAgainStarted("ses_2");

    expect(events).toEqual([
      "practice_started",
      "practice_submitted_for_feedback",
      "practice_again_started",
    ]);
  });
});
