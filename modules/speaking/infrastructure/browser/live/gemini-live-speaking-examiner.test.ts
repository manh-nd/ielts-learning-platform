import { describe, it, expect } from "bun:test";
import { GeminiLiveSpeakingExaminerAdapter } from "./gemini-live-speaking-examiner";
import type {
  GeminiLiveTokenProvider,
  GeminiLiveTokenDto,
} from "./gemini-live-token-provider";
import type { GeminiLiveTransport } from "./gemini-live-transport";
import type { SpeakingLiveExaminerEvent } from "@/modules/speaking/application/ports/speaking-live-examiner.port";

class FakeTokenProvider implements GeminiLiveTokenProvider {
  async fetchToken(): Promise<GeminiLiveTokenDto> {
    return {
      token: "fake_token_123",
      model: "gemini-3.8-live",
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    };
  }
}

class FakeTransport implements GeminiLiveTransport {
  public isOpen = false;
  public connectUrl: string | null = null;
  public setupPayloadSent: unknown = null;
  public sentPayloads: unknown[] = [];
  private rawMessageListeners: Set<(msg: string) => void> = new Set();
  private closeListeners: Set<
    (evt: { code: number; reason: string; wasClean: boolean }) => void
  > = new Set();
  private errorListeners: Set<(err: Error | Event) => void> = new Set();

  async connect(wsUrl: string, setupPayload?: unknown): Promise<void> {
    this.connectUrl = wsUrl;
    this.setupPayloadSent = setupPayload;
    this.isOpen = true;
  }

  send(payload: unknown): void {
    this.sentPayloads.push(payload);
  }

  onRawMessage(listener: (msg: string) => void): () => void {
    this.rawMessageListeners.add(listener);
    return () => this.rawMessageListeners.delete(listener);
  }

  onClose(
    listener: (evt: { code: number; reason: string; wasClean: boolean }) => void
  ): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  onError(listener: (err: Error | Event) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  close(): void {
    this.isOpen = false;
  }

  // Test triggers
  simulateIncomingRawMessage(msg: string): void {
    for (const l of this.rawMessageListeners) l(msg);
  }

  simulateClose(code = 1000, reason = ""): void {
    this.isOpen = false;
    for (const l of this.closeListeners)
      l({ code, reason, wasClean: code === 1000 });
  }

  simulateError(errMessage: string): void {
    for (const l of this.errorListeners) l(new Error(errMessage));
  }
}

describe("GeminiLiveSpeakingExaminerAdapter", () => {
  it("connects via token provider and transport, emitting connected on setupComplete", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
      voiceName: "Puck",
    });

    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((evt) => events.push(evt));

    await adapter.connect({ systemInstruction: "You are Harrison." });

    expect(transport.isOpen).toBe(true);
    expect(transport.connectUrl).toContain("access_token=fake_token_123");

    // Simulate setupComplete message from Gemini
    transport.simulateIncomingRawMessage(JSON.stringify({ setupComplete: {} }));

    expect(events).toContainEqual({ type: "connected" });
  });

  it("maps incoming audio chunks, transcriptions, interruptions, and turnComplete", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
    });

    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((evt) => events.push(evt));

    await adapter.connect();

    transport.simulateIncomingRawMessage(
      JSON.stringify({
        serverContent: {
          interrupted: true,
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm;rate=24000",
                  data: "AUDIO_BASE64_DATA",
                },
              },
            ],
          },
          outputTranscription: { text: "Hello learner." },
          inputTranscription: { text: "Hello teacher." },
          turnComplete: true,
        },
      })
    );

    expect(events).toContainEqual({ type: "candidate_interrupted_examiner" });
    expect(events).toContainEqual({
      type: "examiner_audio_chunk",
      audioBase64: "AUDIO_BASE64_DATA",
      mimeType: "audio/pcm;rate=24000",
    });
    expect(events).toContainEqual({
      type: "examiner_transcript_updated",
      text: "Hello learner.",
    });
    expect(events).toContainEqual({
      type: "candidate_transcript_updated",
      text: "Hello teacher.",
    });
    expect(events).toContainEqual({ type: "live_turn_completed" });
  });

  it("translates tool calls to examiner_action_requested and responds using correlation map", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
    });

    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((evt) => events.push(evt));

    await adapter.connect();

    // Gemini tool call message
    transport.simulateIncomingRawMessage(
      JSON.stringify({
        toolCall: {
          functionCalls: [
            {
              id: "call_cue_card_99",
              name: "display_cue_card",
              args: {
                topicTitle: "Technology",
                cueCardPrompt: "Describe your laptop.",
                bulletPoints: ["What it is", "Why you like it"],
              },
            },
          ],
        },
      })
    );

    expect(events).toHaveLength(1);
    const actionEvent = events[0];
    expect(actionEvent.type).toBe("examiner_action_requested");
    if (actionEvent.type === "examiner_action_requested") {
      expect(actionEvent.action).toEqual({
        type: "display_cue_card_requested",
        requestId: "call_cue_card_99",
        topicTitle: "Technology",
        cueCardPrompt: "Describe your laptop.",
        bulletPoints: ["What it is", "Why you like it"],
      });
    }

    // Respond to action
    adapter.respondToExaminerAction({
      requestId: "call_cue_card_99",
      status: "cue_card_displayed_prep_started",
      message: "Countdown started",
    });

    expect(transport.sentPayloads).toHaveLength(1);
    const sent = transport.sentPayloads[0] as {
      toolResponse: {
        functionResponses: Array<{
          id: string;
          name: string;
          response: { output: unknown };
        }>;
      };
    };
    expect(sent.toolResponse.functionResponses[0].id).toBe("call_cue_card_99");
    expect(sent.toolResponse.functionResponses[0].name).toBe(
      "display_cue_card"
    );
    expect(sent.toolResponse.functionResponses[0].response.output).toEqual({
      status: "cue_card_displayed_prep_started",
      message: "Countdown started",
    });

    // Subsequent call for handled requestId is no-op because key was removed from correlation map
    adapter.respondToExaminerAction({
      requestId: "call_cue_card_99",
      status: "cue_card_displayed_prep_started",
    });
    expect(transport.sentPayloads).toHaveLength(1);
  });

  it("sends candidate audio over transport with correct realtimeInput format", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
    });

    await adapter.connect();

    adapter.sendCandidateAudio({
      audioBase64: "MIC_AUDIO_PCM",
      mimeType: "audio/pcm;rate=16000",
    });

    expect(transport.sentPayloads).toContainEqual({
      realtimeInput: {
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: "MIC_AUDIO_PCM",
        },
      },
    });

    adapter.endCandidateAudio();
    expect(transport.sentPayloads).toContainEqual({
      realtimeInput: {
        audioStreamEnd: true,
      },
    });
  });

  it("emits disconnected on normal socket close", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
    });
    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((evt) => events.push(evt));

    await adapter.connect();
    transport.simulateClose(1000, "Normal closure");
    expect(events).toContainEqual({
      type: "connection_failed",
      reason:
        "Live conversation unavailable. Save your recording and start a new practice.",
    });
  });

  it("emits disconnected on abnormal socket close without WebSocket error", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
    });
    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((evt) => events.push(evt));

    await adapter.connect();
    transport.simulateClose(1006, "Abnormal closure");
    expect(events).toContainEqual({
      type: "connection_failed",
      reason:
        "Live conversation unavailable. Save your recording and start a new practice.",
    });
  });

  it("emits connection_failed on WebSocket error", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
    });
    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((evt) => events.push(evt));

    await adapter.connect();
    transport.simulateError("WebSocket network failure");
    expect(events).toContainEqual({
      type: "connection_failed",
      reason:
        "Live conversation unavailable. Save your recording and start a new practice.",
    });
  });

  it("emits connection_failed then disconnected when connected socket encounters runtime error then closes", async () => {
    const tokenProvider = new FakeTokenProvider();
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      tokenProvider,
      transport,
    });
    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((evt) => events.push(evt));

    await adapter.connect();

    transport.simulateError("Connection reset");
    transport.simulateClose(1006, "Connection lost");

    expect(events).toEqual([
      {
        type: "connection_failed",
        reason:
          "Live conversation unavailable. Save your recording and start a new practice.",
      },
    ]);
  });
});

describe("live resumption", () => {
  it("reuses credentials and restores the handle without emitting another connected event", async () => {
    let tokens = 0;
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      transport,
      tokenProvider: {
        fetchToken: async () => {
          tokens++;
          return new FakeTokenProvider().fetchToken();
        },
      },
    });
    const events: SpeakingLiveExaminerEvent[] = [];
    adapter.subscribe((event) => events.push(event));
    await adapter.connect({ applicationControlled: true });
    transport.simulateIncomingRawMessage(JSON.stringify({ setupComplete: {} }));
    transport.simulateIncomingRawMessage(
      JSON.stringify({
        sessionResumptionUpdate: {
          resumable: true,
          newHandle: "resume-handle",
        },
      })
    );
    transport.simulateIncomingRawMessage(
      JSON.stringify({ goAway: { timeLeft: "10s" } })
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(transport.setupPayloadSent).toMatchObject({
      setup: { sessionResumption: { handle: "resume-handle" } },
    });
    transport.simulateIncomingRawMessage(JSON.stringify({ setupComplete: {} }));
    expect(events.map((e) => e.type)).toEqual([
      "connected",
      "reconnecting",
      "resumed",
    ]);
    expect(tokens).toBe(1);
    await adapter.disconnect();
  });
  it("cancels recovery on disposal", async () => {
    const transport = new FakeTransport();
    const adapter = new GeminiLiveSpeakingExaminerAdapter({
      transport,
      tokenProvider: new FakeTokenProvider(),
    });
    await adapter.connect();
    transport.simulateIncomingRawMessage(
      JSON.stringify({
        setupComplete: {},
        sessionResumptionUpdate: { resumable: true, newHandle: "h" },
      })
    );
    transport.simulateClose(1006);
    adapter.dispose();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(transport.isOpen).toBe(false);
    expect(adapter.getResumptionHandle()).toBeNull();
  });
});
