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
  private unsubscribeRawMessages: (() => void) | null = null;
  private unsubscribeClose: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;

  getResumptionHandle(): string | null {
    return this.latestResumptionHandle;
  }

  constructor(options: GeminiLiveSpeakingExaminerOptions = {}) {
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

    this.isConnecting = true;
    try {
      // 1. Fetch ephemeral session token
      const tokenDto = await this.tokenProvider.fetchToken();

      const targetModel = tokenDto.model || "gemini-3.8-live";
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${tokenDto.token}`;

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
            parts: [{ text: input.systemInstruction || "" }],
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
      this.bindTransportEvents();

      // 4. Connect WebSocket
      await this.transport.connect(wsUrl, setupPayload);
    } catch (err: unknown) {
      this.emitEvent({
        type: "connection_failed",
        reason:
          (err as Error)?.message || "Failed to establish live connection",
      });
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  sendCandidateAudio(input: SendCandidateAudioInput): void {
    if (!this.transport.isOpen) return;

    this.transport.send({
      realtimeInput: {
        audio: {
          mimeType: input.mimeType,
          data: input.audioBase64,
        },
      },
    });
  }

  endCandidateAudio(): void {
    if (!this.transport.isOpen) return;

    this.transport.send({
      realtimeInput: {
        audioStreamEnd: true,
      },
    });
  }

  sendText(input: SendSpeakingExaminerTextInput): void {
    if (!this.transport.isOpen) return;

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
    this.unbindTransportEvents();
    this.transport.close();
    this.actionCorrelationMap.clear();
  }

  dispose(): void {
    void this.disconnect();
    this.eventListeners.clear();
  }

  private emitEvent(event: SpeakingLiveExaminerEvent): void {
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

    this.unsubscribeClose = this.transport.onClose(() => {
      this.emitEvent({ type: "disconnected" });
    });

    this.unsubscribeError = this.transport.onError((err) => {
      this.emitEvent({
        type: "connection_failed",
        reason: (err as Error)?.message || "WebSocket error",
      });
    });
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
          this.emitEvent({ type: "connected" });
          break;

        case "session_resumption_update":
          this.latestResumptionHandle = event.resumptionHandle;
          break;

        case "go_away":
          // Stored internally; recovery deferred
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
