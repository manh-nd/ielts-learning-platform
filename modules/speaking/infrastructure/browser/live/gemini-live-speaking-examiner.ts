import type {
  SpeakingLiveExaminerPort,
  SpeakingLiveExaminerEvent,
  StartSpeakingLiveExaminerInput,
  SendCandidateAudioInput,
  SendSpeakingExaminerTextInput,
  SpeakingLiveExaminerActionResponse,
  SpeakingLiveExaminerAction,
} from "@/modules/speaking/application/ports/speaking-live-examiner.port";
import {
  GeminiLiveTokenProvider,
  DefaultGeminiLiveTokenProvider,
} from "./gemini-live-token-provider";
import {
  GeminiLiveTransport,
  DefaultGeminiLiveTransport,
} from "./gemini-live-transport";
import { mapGeminiLiveMessage } from "./gemini-live-message-mapper";

export interface GeminiLiveSpeakingExaminerOptions {
  tokenEndpoint?: string;
  voiceName?: string;
  onMetric?: (name: string, durationMs?: number) => void | Promise<unknown>;
  tokenProvider?: GeminiLiveTokenProvider;
  transport?: GeminiLiveTransport;
}

interface ActionCorrelation {
  geminiFunctionName: string;
  actionType: SpeakingLiveExaminerAction["type"];
}

/**
 * Infrastructure implementation of SpeakingLiveExaminerPort for Gemini Multimodal Live API.
 *
 * Translates:
 *   Application Port capabilities -> Gemini WebSocket wire payloads
 *   Gemini wire messages -> provider-neutral SpeakingLiveExaminerEvent[]
 */
export class GeminiLiveSpeakingExaminerAdapter implements SpeakingLiveExaminerPort {
  private tokenProvider: GeminiLiveTokenProvider;
  private transport: GeminiLiveTransport;
  private voiceName: string;
  private eventListeners: Set<(event: SpeakingLiveExaminerEvent) => void> =
    new Set();
  private actionCorrelationMap: Map<string, ActionCorrelation> = new Map();
  private latestResumptionHandle: string | null = null;
  private isConnecting = false;
  private readonly onMetric?: GeminiLiveSpeakingExaminerOptions["onMetric"];
  private connectedAt = 0;
  private answerEndedAt: number | null = null;
  private applicationControlled = false;
  private stopped = false;
  private ready = false;
  private recovering = false;
  private epoch = 0;
  private recoveryAttempt = 0;
  private recoveryDeadline = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private setupTimer: ReturnType<typeof setTimeout> | null = null;
  private token: Awaited<
    ReturnType<GeminiLiveTokenProvider["fetchToken"]>
  > | null = null;
  private setup: Record<string, unknown> | null = null;

  private unsubscribeRawMessages: (() => void) | null = null;
  private unsubscribeClose: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;

  getResumptionHandle(): string | null {
    return this.latestResumptionHandle;
  }

  constructor(options: GeminiLiveSpeakingExaminerOptions = {}) {
    this.onMetric = options.onMetric;
    this.voiceName = options.voiceName || "Puck";
    this.tokenProvider =
      options.tokenProvider ||
      new DefaultGeminiLiveTokenProvider(options.tokenEndpoint);
    this.transport = options.transport || new DefaultGeminiLiveTransport();
  }

  async connect(input: StartSpeakingLiveExaminerInput = {}): Promise<void> {
    if (this.isConnecting || this.transport.isOpen) {
      console.warn(
        "[GeminiLiveAdapter] Connection already open or in progress."
      );
      return;
    }

    this.applicationControlled = input.applicationControlled === true;
    this.connectedAt = Date.now();
    this.stopped = false;
    const epoch = ++this.epoch;
    this.isConnecting = true;
    try {
      // 1. Fetch ephemeral session token
      const tokenDto = await this.tokenProvider.fetchToken();
      if (this.stopped || epoch !== this.epoch) return;
      this.token = tokenDto;

      const targetModel = tokenDto.model || "gemini-3.8-live";
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenDto.token)}`;

      // 2. Build Gemini setup payload
      const setupPayload = {
        setup: {
          model: `models/${targetModel}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: this.voiceName,
                },
              },
            },
          },
          systemInstruction: {
            parts: [
              {
                text: this.applicationControlled
                  ? "You are a supportive IELTS practice examiner. Speak only the prompt authorized by the application. Never choose another question, change parts, or end practice independently. Do not score the learner. Wait silently between authorized prompts."
                  : input.systemInstruction || "",
              },
            ],
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "display_cue_card",
                  description:
                    "Display the Part 2 Cue Card topic and bullet points to the candidate and begin their 1-minute preparation countdown.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      topicTitle: {
                        type: "STRING",
                        description: "Title of the cue card topic",
                      },
                      cueCardPrompt: {
                        type: "STRING",
                        description: "The main task description",
                      },
                      bulletPoints: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                        description: "3-4 bullet points guiding the candidate",
                      },
                    },
                    required: ["topicTitle", "cueCardPrompt", "bulletPoints"],
                  },
                },
                {
                  name: "start_part_3",
                  description:
                    "Transition the exam into IELTS Speaking Part 3 for in-depth abstract discussion.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      topicTitle: {
                        type: "STRING",
                        description: "Topic theme for Part 3",
                      },
                      introComment: {
                        type: "STRING",
                        description: "Introductory transition sentence",
                      },
                    },
                    required: ["topicTitle"],
                  },
                },
                {
                  name: "end_exam",
                  description:
                    "Conclude the entire IELTS Speaking examination session.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      closingRemarks: {
                        type: "STRING",
                        description: "Closing remarks from the examiner",
                      },
                    },
                  },
                },
              ],
            },
          ],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          sessionResumption: {},
          contextWindowCompression: {
            slidingWindow: {},
          },
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              silenceDurationMs: 1200,
              prefixPaddingMs: 100,
            },
          },
        },
      };

      // 3. Setup transport subscriptions before connecting
      if (this.applicationControlled) {
        setupPayload.setup.tools = [];
        setupPayload.setup.realtimeInputConfig.automaticActivityDetection.disabled = true;
      }
      this.setup = setupPayload.setup;
      this.bindTransportEvents();
      this.armSetupTimeout();

      // 4. Connect WebSocket
      await this.transport.connect(wsUrl, setupPayload);
    } catch (err: unknown) {
      if (epoch === this.epoch && !this.stopped)
        this.fail("Failed to establish live connection");
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  sendCandidateAudio(input: SendCandidateAudioInput): void {
    if (!this.transport.isOpen || this.recovering || this.stopped) return;

    this.transport.send({
      realtimeInput: {
        audio: {
          mimeType: input.mimeType,
          data: input.audioBase64,
        },
      },
    });
  }

  startCandidateActivity(): void {
    if (this.ready && !this.recovering)
      this.transport.send({ realtimeInput: { activityStart: {} } });
  }
  endCandidateActivity(): void {
    this.answerEndedAt = Date.now();
    if (this.ready && !this.recovering)
      this.transport.send({ realtimeInput: { activityEnd: {} } });
  }
  endCandidateAudio(): void {
    if (this.applicationControlled) return this.endCandidateActivity();
    if (!this.transport.isOpen || this.recovering || this.stopped) return;

    this.transport.send({
      realtimeInput: {
        audioStreamEnd: true,
      },
    });
  }

  presentPrompt(input: { questionId: string; text: string }): void {
    this.sendText({
      text: `Authorized prompt ${input.questionId}. Read only this prompt and then wait silently: ${input.text}`,
    });
  }

  sendText(input: SendSpeakingExaminerTextInput): void {
    if (!this.transport.isOpen || this.recovering || this.stopped) return;

    this.transport.send({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: input.text }],
          },
        ],
        turnComplete: true,
      },
    });
  }

  respondToExaminerAction(response: SpeakingLiveExaminerActionResponse): void {
    if (!this.transport.isOpen || !response.requestId) return;

    const correlation = this.actionCorrelationMap.get(response.requestId);
    if (!correlation) return;

    const functionName = correlation.geminiFunctionName;

    const toolResponsePayload = {
      toolResponse: {
        functionResponses: [
          {
            id: response.requestId,
            name: functionName,
            response: {
              output: {
                status: response.status,
                message: response.message,
                ...response.metadata,
              },
            },
          },
        ],
      },
    };

    this.transport.send(toolResponsePayload);
    this.actionCorrelationMap.delete(response.requestId);
  }

  subscribe(listener: (event: SpeakingLiveExaminerEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    this.epoch++;
    this.ready = false;
    this.recovering = false;
    this.clearTimers();
    this.unbindTransportEvents();
    this.transport.close();
    this.actionCorrelationMap.clear();
    this.latestResumptionHandle = null;
    this.token = null;
    this.setup = null;
  }

  dispose(): void {
    void this.disconnect();
    this.eventListeners.clear();
  }

  private metric(name: string, durationMs?: number) {
    try {
      void Promise.resolve(this.onMetric?.(name, durationMs)).catch(() => {});
    } catch {
      /* Best effort. */
    }
  }
  private emitEvent(event: SpeakingLiveExaminerEvent): void {
    if (event.type === "connected")
      this.metric("connection_ready", Date.now() - this.connectedAt);
    if (
      event.type === "reconnecting" ||
      event.type === "resumed" ||
      event.type === "connection_failed" ||
      event.type === "candidate_interrupted_examiner"
    )
      this.metric(event.type);
    if (event.type === "examiner_audio_chunk" && this.answerEndedAt !== null) {
      this.metric("answer_to_examiner", Date.now() - this.answerEndedAt);
      this.answerEndedAt = null;
    }
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[GeminiLiveAdapter] Error in event listener:", err);
      }
    }
  }

  private bindTransportEvents(): void {
    this.unbindTransportEvents();

    this.unsubscribeRawMessages = this.transport.onRawMessage((rawText) => {
      this.handleRawMessage(rawText);
    });

    this.unsubscribeClose = this.transport.onClose((event) => {
      if ([1008, 1007, 1003].includes(event.code)) {
        this.fail(
          "Live conversation could not be restored. Save your recording and start a new practice."
        );
      } else this.recover();
    });
    this.unsubscribeError = this.transport.onError(() => this.recover());
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.setupTimer) clearTimeout(this.setupTimer);
    this.retryTimer = null;
    this.setupTimer = null;
  }

  private fail(reason: string): void {
    if (this.stopped) return;
    this.stopped = true;
    this.ready = false;
    this.recovering = false;
    this.clearTimers();
    this.unbindTransportEvents();
    this.transport.close();
    this.emitEvent({ type: "connection_failed", reason });
  }

  private armSetupTimeout(): void {
    if (this.setupTimer) clearTimeout(this.setupTimer);
    const remaining = this.recovering
      ? this.recoveryDeadline - Date.now()
      : 10000;
    this.setupTimer = setTimeout(
      () => {
        if (this.recovering) this.scheduleRecovery();
        else this.fail("Live connection setup timed out.");
      },
      Math.max(0, Math.min(5000, remaining))
    );
  }

  private recover(): void {
    if (this.stopped || this.recovering) return;
    if (
      !this.ready ||
      !this.latestResumptionHandle ||
      !this.token ||
      Date.parse(this.token.expiresAt) <= Date.now()
    ) {
      this.fail(
        "Live conversation unavailable. Save your recording and start a new practice."
      );
      return;
    }
    this.ready = false;
    this.recovering = true;
    this.recoveryAttempt = 0;
    this.recoveryDeadline = Date.now() + 20000;
    this.emitEvent({ type: "reconnecting" });
    this.scheduleRecovery();
  }

  private scheduleRecovery(): void {
    if (this.stopped) return;
    this.clearTimers();
    this.unbindTransportEvents();
    this.transport.close();
    if (
      ++this.recoveryAttempt > 3 ||
      Date.now() >= this.recoveryDeadline ||
      !this.token ||
      Date.parse(this.token.expiresAt) <= Date.now()
    ) {
      this.fail(
        "Live recovery failed. Save your recording and start a new practice."
      );
      return;
    }
    const epoch = this.epoch;
    this.retryTimer = setTimeout(
      () => {
        if (this.stopped || epoch !== this.epoch || !this.token) return;
        this.bindTransportEvents();
        this.armSetupTimeout();
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(this.token.token)}`;
        void this.transport
          .connect(url, {
            setup: {
              ...this.setup,
              sessionResumption: { handle: this.latestResumptionHandle },
            },
          })
          .catch(() => {
            if (!this.stopped && epoch === this.epoch) this.scheduleRecovery();
          });
      },
      [0, 500, 1500][this.recoveryAttempt - 1]
    );
  }

  private unbindTransportEvents(): void {
    if (this.unsubscribeRawMessages) {
      this.unsubscribeRawMessages();
      this.unsubscribeRawMessages = null;
    }
    if (this.unsubscribeClose) {
      this.unsubscribeClose();
      this.unsubscribeClose = null;
    }
    if (this.unsubscribeError) {
      this.unsubscribeError();
      this.unsubscribeError = null;
    }
  }

  private handleRawMessage(rawText: string): void {
    const events = mapGeminiLiveMessage(rawText);

    for (const event of events) {
      switch (event.type) {
        case "setup_complete":
          if (this.stopped || this.ready) break;
          this.clearTimers();
          this.ready = true;
          this.emitEvent({ type: this.recovering ? "resumed" : "connected" });
          this.recovering = false;
          break;

        case "session_resumption_update":
          this.latestResumptionHandle = event.resumable
            ? event.resumptionHandle
            : null;
          break;

        case "go_away":
          this.recover();
          break;

        case "tool_call":
          for (const call of event.calls) {
            this.handleToolCall(call);
          }
          break;

        case "server_content":
          if (event.interrupted) {
            this.emitEvent({ type: "candidate_interrupted_examiner" });
          }

          if (event.modelTurnAudioParts) {
            for (const part of event.modelTurnAudioParts) {
              this.emitEvent({
                type: "examiner_audio_chunk",
                audioBase64: part.data,
                mimeType: part.mimeType,
              });
            }
          }

          if (event.outputTranscription) {
            this.emitEvent({
              type: "examiner_transcript_updated",
              text: event.outputTranscription,
            });
          }

          if (event.inputTranscription) {
            this.emitEvent({
              type: "candidate_transcript_updated",
              text: event.inputTranscription,
            });
          }

          if (event.turnComplete) {
            this.emitEvent({ type: "live_turn_completed" });
          }
          break;

        case "unknown":
          break;
      }
    }
  }

  private handleToolCall(call: {
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  }): void {
    if (this.applicationControlled) return;
    const requestId = call.id;

    if (call.name === "display_cue_card") {
      if (requestId) {
        this.actionCorrelationMap.set(requestId, {
          geminiFunctionName: "display_cue_card",
          actionType: "display_cue_card_requested",
        });
      }
      this.emitEvent({
        type: "examiner_action_requested",
        action: {
          type: "display_cue_card_requested",
          requestId,
          topicTitle: (call.args?.topicTitle as string) || "",
          cueCardPrompt: (call.args?.cueCardPrompt as string) || "",
          bulletPoints: (call.args?.bulletPoints as string[]) || [],
        },
      });
    } else if (call.name === "start_part_3") {
      if (requestId) {
        this.actionCorrelationMap.set(requestId, {
          geminiFunctionName: "start_part_3",
          actionType: "part_3_start_requested",
        });
      }
      this.emitEvent({
        type: "examiner_action_requested",
        action: {
          type: "part_3_start_requested",
          requestId,
          topicTitle: call.args?.topicTitle as string | undefined,
          introComment: call.args?.introComment as string | undefined,
        },
      });
    } else if (call.name === "end_exam") {
      if (requestId) {
        this.actionCorrelationMap.set(requestId, {
          geminiFunctionName: "end_exam",
          actionType: "practice_end_requested",
        });
      }
      this.emitEvent({
        type: "examiner_action_requested",
        action: {
          type: "practice_end_requested",
          requestId,
          closingRemarks: call.args?.closingRemarks as string | undefined,
        },
      });
    }
  }
}
