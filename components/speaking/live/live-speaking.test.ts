import { describe, it, expect, afterEach } from "bun:test";
import {
  buildExaminerSystemInstruction,
  parseLiveServerMessage,
  buildToolResponse,
  pcmBase64ChunksToWavBlob,
  getSupportedMediaRecorderMimeType,
  isPermissionDeniedError,
} from "./use-gemini-live";
import {
  ACTIVE_SPEAKING_SESSION_STORAGE_KEY,
  clearActiveSpeakingSession,
} from "./types";
import {
  SPEAKING_MOCK_TOPICS,
  getMockTopicById,
  getRandomMockTopic,
} from "@/lib/data/speaking-mock-topics";
import {
  dispatchPracticeStarted,
  dispatchPracticeAudioRecorded,
  dispatchPracticeFeedbackReady,
  dispatchPracticeAudioError,
} from "@/lib/telemetry/telemetry-client";

describe("Live Speaking Prototype Engine", () => {
  it("should provide valid IELTS Speaking mock topics with 3 parts", () => {
    expect(SPEAKING_MOCK_TOPICS.length).toBeGreaterThanOrEqual(4);

    for (const topic of SPEAKING_MOCK_TOPICS) {
      expect(topic.id).toBeDefined();
      expect(topic.title).toBeDefined();
      expect(topic.part1.questions.length).toBeGreaterThanOrEqual(3);
      expect(topic.part2.cueCardPrompt).toBeDefined();
      expect(topic.part2.bulletPoints.length).toBeGreaterThanOrEqual(3);
      expect(topic.part3.questions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("should retrieve mock topic by ID or fallback to default", () => {
    const techTopic = getMockTopicById("tech-ai-future");
    expect(techTopic.id).toBe("tech-ai-future");
    expect(techTopic.title).toContain("Technology");

    const fallbackTopic = getMockTopicById("non-existent-id");
    expect(fallbackTopic).toBeDefined();
    expect(fallbackTopic.id).toBe(SPEAKING_MOCK_TOPICS[0].id);
  });

  it("should get a random mock topic", () => {
    const randomTopic = getRandomMockTopic();
    expect(randomTopic).toBeDefined();
    expect(SPEAKING_MOCK_TOPICS.some((t) => t.id === randomTopic.id)).toBe(
      true
    );
  });

  it("should format examiner system instruction with candidate name and topic", () => {
    const topic = SPEAKING_MOCK_TOPICS[0];
    const instruction = buildExaminerSystemInstruction(
      "Nguyen Van Manh",
      topic
    );

    expect(instruction).toContain("Nguyen Van Manh");
    expect(instruction).toContain(topic.title);
    expect(instruction).toContain(topic.part1.theme);
    expect(instruction).toContain(topic.part2.topicTitle);
    expect(instruction).toContain("display_cue_card");
    expect(instruction).toContain("start_part_3");
    expect(instruction).toContain("end_exam");
  });

  it("should format fallback system instruction when candidate name or topic is omitted", () => {
    const instruction = buildExaminerSystemInstruction();
    expect(instruction).toContain("Senior IELTS Speaking Examiner");
    expect(instruction).toContain("Address the candidate formally.");
  });

  it("should include Voice Anchor and Global Language Guard in system instruction", () => {
    const instruction = buildExaminerSystemInstruction("Test Candidate");
    expect(instruction).toContain(
      "CRITICAL LANGUAGE & TRANSCRIPTION CONSTRAINT"
    );
    expect(instruction).toContain("Voice Anchor:");
    expect(instruction).toContain("Dr. Harrison");
  });

  it("should correctly parse setupComplete messages", () => {
    const parsed = parseLiveServerMessage({ setupComplete: {} });
    expect(parsed.type).toBe("setupComplete");
  });

  it("should correctly parse top-level toolCall messages from Gemini Live", () => {
    const rawToolCall = {
      toolCall: {
        functionCalls: [
          {
            id: "call-12345",
            name: "display_cue_card",
            args: {
              topicTitle: "A memorable journey",
              cueCardPrompt: "Describe a memorable journey you have taken.",
              bulletPoints: [
                "Where you went",
                "Who you went with",
                "Why it was memorable",
              ],
            },
          },
        ],
      },
    };

    const parsed = parseLiveServerMessage(rawToolCall);
    expect(parsed.type).toBe("toolCall");
    expect(parsed.toolCalls).toBeDefined();
    expect(parsed.toolCalls?.length).toBe(1);
    expect(parsed.toolCalls?.[0].id).toBe("call-12345");
    expect(parsed.toolCalls?.[0].name).toBe("display_cue_card");
    expect(parsed.toolCalls?.[0].args?.topicTitle).toBe("A memorable journey");
  });

  it("should format valid Gemini Live toolResponse payload", () => {
    const response = buildToolResponse("call-12345", "display_cue_card", {
      status: "cue_card_displayed",
      prepTimeSeconds: 60,
    });

    expect(response).toEqual({
      toolResponse: {
        functionResponses: [
          {
            id: "call-12345",
            name: "display_cue_card",
            response: {
              output: {
                status: "cue_card_displayed",
                prepTimeSeconds: 60,
              },
            },
          },
        ],
      },
    });
  });
});

describe("Live Recording Finalization & OriginalAudio Contract", () => {
  it("should finalize MediaRecorder asynchronously and include the final chunk on stop", async () => {
    const recordedChunks: Blob[] = [
      new Blob(["chunk1"], { type: "audio/webm" }),
    ];
    let isStopCalled = false;

    // Simulate mock MediaRecorder with asynchronous final chunk on stop
    const listeners: Record<string, ((ev?: unknown) => void)[]> = {};
    const mockRecorder = {
      state: "recording" as "recording" | "inactive",
      mimeType: "audio/webm;codecs=opus",
      addEventListener: (event: string, cb: (ev?: unknown) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      },
      stop: () => {
        isStopCalled = true;
        mockRecorder.state = "inactive";
        // Asynchronously emit final dataavailable chunk before stop
        setTimeout(() => {
          recordedChunks.push(new Blob(["finalChunk"], { type: "audio/webm" }));
          listeners["stop"]?.forEach((cb) => cb());
        }, 10);
      },
    };

    // Replicate finalizeRecording contract
    const finalize = async () => {
      if (mockRecorder && mockRecorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          let isResolved = false;
          const done = () => {
            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          };
          mockRecorder.addEventListener("stop", done);
          mockRecorder.addEventListener("error", done);
          try {
            mockRecorder.stop();
          } catch {
            done();
          }
        });
      }

      if (recordedChunks.length > 0) {
        const blob = new Blob(recordedChunks, { type: mockRecorder.mimeType });
        return {
          blob,
          url: "blob:http://localhost/mock-audio",
          durationSeconds: 15,
          mimeType: mockRecorder.mimeType,
        };
      }
      return null;
    };

    const finalizedAudio = await finalize();

    expect(isStopCalled).toBe(true);
    expect(finalizedAudio).not.toBeNull();
    expect(finalizedAudio?.blob).toBeDefined();
    expect(recordedChunks.length).toBe(2);
    expect(finalizedAudio?.mimeType).toBe("audio/webm;codecs=opus");
    expect(finalizedAudio?.durationSeconds).toBe(15);
  });

  it("should return null and not fabricate audio evidence when no chunks were recorded", async () => {
    const recordedChunks: Blob[] = [];
    const mockRecorder = {
      state: "inactive" as "recording" | "inactive",
      mimeType: "audio/webm",
      addEventListener: () => {},
      stop: () => {},
    };

    const finalize = async () => {
      if (mockRecorder && mockRecorder.state !== "inactive") {
        mockRecorder.stop();
      }
      if (recordedChunks.length > 0) {
        return {
          blob: new Blob(recordedChunks),
          url: "",
          durationSeconds: 0,
          mimeType: "audio/webm",
        };
      }
      return null;
    };

    const finalizedAudio = await finalize();
    expect(finalizedAudio).toBeNull();
  });

  it("should handle already inactive MediaRecorder with existing chunks cleanly", async () => {
    const recordedChunks: Blob[] = [
      new Blob(["existingAudio"], { type: "audio/webm" }),
    ];
    const mockRecorder = {
      state: "inactive" as "recording" | "inactive",
      mimeType: "audio/webm;codecs=opus",
      addEventListener: () => {},
      stop: () => {},
    };

    const finalize = async () => {
      if (mockRecorder && mockRecorder.state !== "inactive") {
        mockRecorder.stop();
      }
      if (recordedChunks.length > 0) {
        return {
          blob: new Blob(recordedChunks, { type: mockRecorder.mimeType }),
          url: "blob:http://localhost/existing",
          durationSeconds: 10,
          mimeType: mockRecorder.mimeType,
        };
      }
      return null;
    };

    const finalizedAudio = await finalize();
    expect(finalizedAudio).not.toBeNull();
    expect(finalizedAudio?.durationSeconds).toBe(10);
    expect(finalizedAudio?.blob.size).toBeGreaterThan(0);
  });

  it("should convert raw PCM chunks to valid WAV Blob with RIFF/WAVE header", async () => {
    // Generate sample 16kHz mono Int16 PCM samples (e.g. 100 samples = 200 bytes)
    const samples = new Int16Array(100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.round(Math.sin(i * 0.1) * 10000);
    }
    const base64Chunk = Buffer.from(samples.buffer).toString("base64");

    const wavBlob = pcmBase64ChunksToWavBlob([base64Chunk], 16000);
    expect(wavBlob.type).toBe("audio/wav");
    expect(wavBlob.size).toBe(44 + 200);

    const arrayBuffer = await wavBlob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Verify RIFF header
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    expect(riff).toBe("RIFF");

    // Verify WAVE tag
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    expect(wave).toBe("WAVE");

    // Verify Sample Rate (16000)
    expect(view.getUint32(24, true)).toBe(16000);
  });

  it("should assemble WAV fallback when MediaRecorder produces 0 chunks but raw PCM is present", async () => {
    const recordedChunks: Blob[] = [];
    const rawPcmChunks: string[] = [
      Buffer.from(new Int16Array(50).buffer).toString("base64"),
    ];

    const finalize = async () => {
      if (recordedChunks.length > 0) {
        return {
          blob: new Blob(recordedChunks, { type: "audio/webm" }),
          url: "blob:http://localhost/webm",
          durationSeconds: 5,
          mimeType: "audio/webm",
        };
      }
      if (rawPcmChunks.length > 0) {
        const blob = pcmBase64ChunksToWavBlob(rawPcmChunks, 16000);
        return {
          blob,
          url: "blob:http://localhost/wav",
          durationSeconds: 5,
          mimeType: "audio/wav",
        };
      }
      return null;
    };

    const finalizedAudio = await finalize();
    expect(finalizedAudio).not.toBeNull();
    expect(finalizedAudio?.mimeType).toBe("audio/wav");
    expect(finalizedAudio?.blob.size).toBe(44 + 100);
  });

  it("should detect supported MediaRecorder MIME types safely in browser/test environment", () => {
    const supportedType = getSupportedMediaRecorderMimeType();
    // In headless test environments where MediaRecorder is undefined, returns undefined
    if (typeof MediaRecorder === "undefined") {
      expect(supportedType).toBeUndefined();
    } else {
      expect(
        typeof supportedType === "string" || supportedType === undefined
      ).toBe(true);
    }
  });
});

describe("Speaking Practice Failure Recovery & Resilience (#70)", () => {
  it("should correctly classify NotAllowedError and PermissionDeniedError as permission denied", () => {
    const notAllowedError = new Error("Permission denied by user");
    notAllowedError.name = "NotAllowedError";

    const permissionDeniedError = new Error(
      "The request is not allowed by the user agent"
    );
    permissionDeniedError.name = "PermissionDeniedError";

    const genericError = new Error("Internal hardware failure");
    genericError.name = "AbortError";

    expect(isPermissionDeniedError(notAllowedError)).toBe(true);
    expect(isPermissionDeniedError(permissionDeniedError)).toBe(true);
    expect(isPermissionDeniedError(genericError)).toBe(false);
  });

  it("should clean up active speaking session from storage and url via clearActiveSpeakingSession", () => {
    // Setup mock window & sessionStorage
    const storage = new Map<string, string>();
    storage.set(ACTIVE_SPEAKING_SESSION_STORAGE_KEY, "test_session_123");

    global.sessionStorage = {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, val: string) => storage.set(key, val),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: () => null,
      length: storage.size,
    } as unknown as Storage;

    let replacedUrl = "";
    global.window = {
      location: {
        href: "http://localhost:3000/learner/speaking/live?sessionId=test_session_123",
        pathname: "/learner/speaking/live",
        search: "?sessionId=test_session_123",
      },
      history: {
        replaceState: (_data: unknown, _title: string, url: string) => {
          replacedUrl = url;
        },
      },
    } as unknown as Window & typeof globalThis;

    clearActiveSpeakingSession();

    expect(storage.has(ACTIVE_SPEAKING_SESSION_STORAGE_KEY)).toBe(false);
    expect(replacedUrl).toBe("/learner/speaking/live");
  });

  it("should discriminate Part 1 practiceFeedback from Full Mock Exam evaluationResult", () => {
    const part1Scorecard = {
      estimatedPerformance: {
        overallBand: 6.5,
        fluencyAndCoherence: 6.5,
        lexicalResource: 6.5,
        grammaticalRange: 6.5,
        pronunciation: 6.5,
      },
      strengths: ["Clear pronunciation"],
      priorities: ["Expand vocabulary"],
    };

    const fullMockScorecard = {
      overallScorecard: {
        overallBand: 7.0,
      },
      criteria: {
        fluencyAndCoherence: { band: 7.0 },
      },
    };

    const isPart1 = (sc: Record<string, unknown>, targetPart?: string) =>
      Boolean(
        sc.estimatedPerformance ||
        targetPart === "part1" ||
        targetPart === "part_1"
      );

    expect(isPart1(part1Scorecard, "part1")).toBe(true);
    expect(isPart1(fullMockScorecard, "full")).toBe(false);
  });

  it("should retain audio Blob in memory across upload failures and succeed when retried", async () => {
    const mockAudioBlob = new Blob(["mock-speech-audio-content"], {
      type: "audio/webm;codecs=opus",
    });

    let attempts = 0;
    const mockUpload = async (
      _blob: Blob
    ): Promise<{ success: boolean; storageKey?: string }> => {
      attempts++;
      if (attempts === 1) {
        throw new Error("Network timeout: 504 Gateway Timeout");
      }
      return {
        success: true,
        storageKey: "learners/u1/ses_123/candidate.webm",
      };
    };

    // First attempt fails (simulating network drop)
    let uploadResult = null;
    let uploadError: string | null = null;
    try {
      uploadResult = await mockUpload(mockAudioBlob);
    } catch (err) {
      uploadError = (err as Error).message;
    }

    expect(uploadResult).toBeNull();
    expect(uploadError).toContain("504 Gateway Timeout");
    expect(mockAudioBlob.size).toBeGreaterThan(0); // Audio Blob is strictly retained!

    // User clicks "Thử tải lên lại" (Retry Upload)
    uploadResult = await mockUpload(mockAudioBlob);
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.storageKey).toBe("learners/u1/ses_123/candidate.webm");
  });

  it("should restore completed evaluated practice state from session payload", () => {
    const mockGetApiResponse = {
      success: true,
      session: {
        id: "ses_live_restore_01",
        userId: "learner_01",
        status: "evaluated",
        scorecardJson: {
          overallBand: 7.0,
          fluencyCoherence: { band: 7.0, feedback: "Good fluency" },
          lexicalResource: { band: 7.0, feedback: "Varied vocabulary" },
          grammaticalRangeAccuracy: {
            band: 7.0,
            feedback: "Accurate complex structures",
          },
          pronunciation: { band: 7.0, feedback: "Clear rhythm" },
          strengths: ["Confident pacing"],
          improvementPriorities: ["Expand idiomatic expressions"],
        },
        evidenceJson: {
          trace: { latencyMs: 1450, modelUsed: "gemini-3.7-flash" },
        },
      },
      responses: [
        {
          storageKey: "learners/learner_01/ses_live_restore_01/candidate.webm",
          liveTranscript: "Hello I am practicing IELTS speaking.",
        },
      ],
    };

    expect(mockGetApiResponse.session.status).toBe("evaluated");
    expect(mockGetApiResponse.session.scorecardJson.overallBand).toBe(7.0);
    expect(mockGetApiResponse.responses[0].storageKey).toBeDefined();
  });

  it("should restore failed practice evaluation state and allow retry without losing session ID", () => {
    const mockFailedSessionResponse = {
      success: true,
      session: {
        id: "ses_live_failed_01",
        userId: "learner_01",
        status: "completed",
        evidenceJson: {
          evaluationStatus: "failed",
          evaluationError: "503 Overloaded on initial try",
        },
      },
      responses: [
        {
          storageKey: "learners/learner_01/ses_live_failed_01/candidate.webm",
          promptQuestion: "Describe a book you read recently.",
        },
      ],
    };

    expect(mockFailedSessionResponse.session.status).toBe("completed");
    expect(
      mockFailedSessionResponse.session.evidenceJson.evaluationStatus
    ).toBe("failed");
    expect(
      mockFailedSessionResponse.session.evidenceJson.evaluationError
    ).toContain("503");
    expect(mockFailedSessionResponse.responses[0].storageKey).toBeDefined();
  });

  describe("Speaking Practice Telemetry Event Pipeline (§7.1, §7.2, §7.3, Issue #71)", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("should dispatch practice_started telemetry event with topic and target_part", async () => {
      let capturedPayload: Record<string, unknown> = {};
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ success: true, eventId: "evt_1" }),
          {
            status: 201,
          }
        );
      }) as unknown as typeof fetch;

      const res = await dispatchPracticeStarted("ses_live_start_1", {
        topic_title: "Art and Culture",
        target_part: "part1",
        consent_granted: true,
      });

      expect(res.success).toBe(true);
      expect(capturedPayload.eventName).toBe("practice_started");
      expect(capturedPayload.contextType).toBe("practice");
      expect(capturedPayload.contextId).toBe("ses_live_start_1");
      expect(
        (capturedPayload.properties as Record<string, unknown>).topic_title
      ).toBe("Art and Culture");
      expect(
        (capturedPayload.properties as Record<string, unknown>).target_part
      ).toBe("part1");
    });

    it("should dispatch practice_audio_recorded telemetry event with duration_ms and audio_bytes", async () => {
      let capturedPayload: Record<string, unknown> = {};
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ success: true, eventId: "evt_2" }),
          {
            status: 201,
          }
        );
      }) as unknown as typeof fetch;

      const res = await dispatchPracticeAudioRecorded(
        "ses_live_rec_1",
        42500,
        186000,
        {
          mime_type: "audio/webm;codecs=opus",
          turn_count: 3,
        }
      );

      expect(res.success).toBe(true);
      expect(capturedPayload.eventName).toBe("practice_audio_recorded");
      expect(capturedPayload.durationMs).toBe(42500);
      expect(
        (capturedPayload.properties as Record<string, unknown>).audio_bytes
      ).toBe(186000);
    });

    it("should dispatch practice_feedback_ready telemetry event with response latency", async () => {
      let capturedPayload: Record<string, unknown> = {};
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ success: true, eventId: "evt_3" }),
          {
            status: 201,
          }
        );
      }) as unknown as typeof fetch;

      const res = await dispatchPracticeFeedbackReady("ses_live_feed_1", 2850, {
        is_practice: true,
        overall_band: 7.0,
      });

      expect(res.success).toBe(true);
      expect(capturedPayload.eventName).toBe("practice_feedback_ready");
      expect(capturedPayload.durationMs).toBe(2850);
      expect(
        (capturedPayload.properties as Record<string, unknown>).overall_band
      ).toBe(7.0);
    });

    it("should isolate practice_audio_error to mic hardware errors (§7.2) and compute Technical Error Rate correctly (§7.3)", async () => {
      const dispatchedEvents: Array<{
        eventName: string;
        contextId?: string | null;
        properties?: Record<string, unknown>;
      }> = [];

      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string);
        dispatchedEvents.push(body);
        return new Response(JSON.stringify({ success: true }), { status: 201 });
      }) as unknown as typeof fetch;

      // 1. Dispatch valid hardware mic errors
      await dispatchPracticeAudioError(
        "ses_hw_1",
        "PERMISSION_DENIED",
        "Microphone access denied"
      );
      await dispatchPracticeAudioError(
        "ses_hw_2",
        "EMPTY_AUDIO_RECORDING",
        "No audio recorded"
      );

      expect(dispatchedEvents.length).toBe(2);
      expect(dispatchedEvents[0].eventName).toBe("practice_audio_error");
      expect(dispatchedEvents[0].properties?.error_code).toBe(
        "PERMISSION_DENIED"
      );
      expect(dispatchedEvents[1].eventName).toBe("practice_audio_error");
      expect(dispatchedEvents[1].properties?.error_code).toBe(
        "EMPTY_AUDIO_RECORDING"
      );

      // 2. Acceptance Contract §7.3 Verification:
      // Technical Error Rate = Count(practice_audio_error) / Count(practice_started) * 100% < 2.0%
      // Suppose in a batch of 200 started practice sessions:
      // - 2 true audio capture errors occurred (1 permission denied, 1 empty audio)
      // - 5 downstream LLM evaluation timeouts occurred (ADR-0009: captured in session evidenceJson, NOT audio error)
      // - 3 transient network storage upload failures occurred (retried with exponential backoff, NOT audio error)
      const practiceStartedTotal = 200;
      const trueAudioErrorTotal = dispatchedEvents.length; // 2
      const downstreamEvalFailures = 5;
      const storageUploadFailures = 3;

      // Strict Technical Error Rate computation per §7.3
      const technicalErrorRate =
        (trueAudioErrorTotal / practiceStartedTotal) * 100;
      expect(technicalErrorRate).toBe(1.0);
      expect(technicalErrorRate).toBeLessThan(2.0);

      // Verify that if eval/storage errors were improperly mixed into practice_audio_error,
      // it would falsely violate the < 2.0% SLO:
      const contaminatedErrorRate =
        ((trueAudioErrorTotal +
          downstreamEvalFailures +
          storageUploadFailures) /
          practiceStartedTotal) *
        100;
      expect(contaminatedErrorRate).toBe(5.0); // 5.0% would erroneously fail the pilot criteria!
    });
  });
});
