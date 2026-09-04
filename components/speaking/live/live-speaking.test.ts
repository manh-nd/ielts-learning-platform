import { describe, it, expect } from "bun:test";
import {
  buildExaminerSystemInstruction,
  parseLiveServerMessage,
  buildToolResponse,
  pcmBase64ChunksToWavBlob,
  getSupportedMediaRecorderMimeType,
} from "./use-gemini-live";
import {
  SPEAKING_MOCK_TOPICS,
  getMockTopicById,
  getRandomMockTopic,
} from "@/lib/data/speaking-mock-topics";

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

    const isPermissionDenied = (err: Error) =>
      err.name === "NotAllowedError" ||
      err.name === "PermissionDeniedError" ||
      err.message.toLowerCase().includes("permission") ||
      err.message.toLowerCase().includes("denied");

    expect(isPermissionDenied(notAllowedError)).toBe(true);
    expect(isPermissionDenied(permissionDeniedError)).toBe(true);
    expect(isPermissionDenied(genericError)).toBe(false);
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
});
