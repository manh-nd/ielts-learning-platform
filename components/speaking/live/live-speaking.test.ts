import { describe, it, expect } from "bun:test";
import {
  buildExaminerSystemInstruction,
  parseLiveServerMessage,
  buildToolResponse,
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
});
