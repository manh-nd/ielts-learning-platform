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
