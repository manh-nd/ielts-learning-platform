import { describe, it, expect, mock, beforeEach } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { LiveSpeakingClientView } from "@/app/(protected)/learner/speaking/live/live-speaking-client-view";
import {
  SPEAKING_PRACTICE_TOPICS,
  SpeakingPracticeTopic,
  getRandomPracticeTopic,
  getPracticeTopicById,
} from "@/lib/data/speaking-practice-topics";
import {
  SPEAKING_MOCK_TOPICS,
  SpeakingMockTopic,
} from "@/lib/data/speaking-mock-topics";
import { type LiveSpeakingExaminerRoomProps } from "./live-speaking-examiner-room";
import { CANONICAL_SPEAKING_PRACTICE_SCOPE } from "@/modules/speaking/domain";

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
    back: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/learner/speaking/live",
}));

describe("Issue #83: SpeakingPractice UI Isolation from Full Mock Prototype", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      delete (global as Record<string, unknown>).window;
    }
    if (typeof sessionStorage !== "undefined") {
      delete (global as Record<string, unknown>).sessionStorage;
    }
  });

  it("Seam 1: Practice route renders without Full Mock switch or Full Mock CTA", () => {
    const html = renderToString(
      React.createElement(LiveSpeakingClientView, {
        candidateName: "Nguyen Van A",
        userId: "user_learner_123",
        initialHasConsent: true,
      })
    );

    // Strict Negative Checks: Full Mock must NOT be present in shipped Practice UI
    expect(html).not.toContain("Full Mock Test");
    expect(html).not.toContain("Vào Phòng Thi Toàn Diện");
    expect(html).not.toContain("Full Test (Part 1 - 3)");
    expect(html).not.toContain("Part 2 Cue Card");
    expect(html).not.toContain("Part 3 Discussion");
    expect(html).not.toContain("Bắt đầu thi đề này");

    // Positive Checks: Shipped SpeakingPractice Part 1 content
    expect(html).toContain(
      "Phòng Luyện Tập IELTS Speaking Part 1 Trực Tiếp AI"
    );
    expect(html).toContain("Luyện tập Part 1 (~3-5 câu)");
    expect(html).toContain("Bắt đầu Luyện Part 1");
    expect(html).toContain("Chọn Chủ Đề Luyện Tập Part 1");
    expect(html).toContain("Chủ đề Part 1:");
    expect(html).toContain("Số câu hỏi phỏng vấn:");
    expect(html).toContain("Bắt đầu luyện tập");
  });

  it("Seam 2: Practice topics data shape is strictly scoped to Part 1 (SpeakingPractice != MockTest)", () => {
    expect(SPEAKING_PRACTICE_TOPICS.length).toBeGreaterThanOrEqual(4);

    for (const practiceTopic of SPEAKING_PRACTICE_TOPICS) {
      expect(practiceTopic.id).toBeDefined();
      expect(practiceTopic.title).toBeDefined();
      expect(practiceTopic.category).toBeDefined();
      expect(practiceTopic.difficulty).toBeDefined();
      expect(practiceTopic.part1).toBeDefined();
      expect(practiceTopic.part1.theme).toBeDefined();
      expect(practiceTopic.part1.questions.length).toBeGreaterThanOrEqual(3);

      // Verify no Part 2/3 mock test properties exist on practice topic
      const raw = practiceTopic as unknown as Record<string, unknown>;
      expect(raw.part2).toBeUndefined();
      expect(raw.part3).toBeUndefined();
    }

    const topic = getPracticeTopicById("tech-ai-future");
    expect(topic.id).toBe("tech-ai-future");
    expect(topic.part1.questions[0]).toContain("technological devices");

    const random = getRandomPracticeTopic();
    expect(random.part1.questions.length).toBeGreaterThanOrEqual(3);
  });

  it("Seam 3: LiveSpeakingExaminerRoomProps takes SpeakingPracticeTopic and does not expose targetPart", () => {
    const practiceTopic: SpeakingPracticeTopic = SPEAKING_PRACTICE_TOPICS[0];

    // Compile-time & runtime type verification:
    // LiveSpeakingExaminerRoomProps must accept SpeakingPracticeTopic directly without requiring targetPart
    const props: LiveSpeakingExaminerRoomProps = {
      candidateName: "Test Learner",
      topic: practiceTopic,
      hasConsent: true,
      mockMode: true,
    };

    expect(props.topic?.id).toBe(practiceTopic.id);
    expect(props.topic?.part1.theme).toBe(practiceTopic.part1.theme);

    // Verify props object does not define or require targetPart
    const rawProps = props as Record<string, unknown>;
    expect(rawProps.targetPart).toBeUndefined();
  });

  it("Seam 4: Full Mock prototype remains isolated in speaking-mock-topics.ts", () => {
    // Verify Full Mock mock data exists separately and has 3 parts
    expect(SPEAKING_MOCK_TOPICS.length).toBeGreaterThanOrEqual(4);

    const mockTopic: SpeakingMockTopic = SPEAKING_MOCK_TOPICS[0];
    expect(mockTopic.part1).toBeDefined();
    expect(mockTopic.part2).toBeDefined();
    expect(mockTopic.part3).toBeDefined();
    expect(mockTopic.part2.cueCardPrompt).toBeDefined();
    expect(mockTopic.part3.questions.length).toBeGreaterThanOrEqual(3);

    // Verify canonical scope distinction
    expect(CANONICAL_SPEAKING_PRACTICE_SCOPE).toBe("part_1");
  });
});
