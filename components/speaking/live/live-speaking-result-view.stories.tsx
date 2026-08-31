import type { Meta, StoryObj } from "@storybook/react";
import { LiveSpeakingResultView } from "./live-speaking-result-view";
import { fn, expect, userEvent, within } from "storybook/test";
import {
  IeltsSpeakingEvaluationResult,
  PracticeFeedback,
} from "@/lib/gemini/speaking-schema";

const mockEvaluationResult: IeltsSpeakingEvaluationResult = {
  overallScorecard: {
    overallBand: 7.5,
    criteriaScores: {
      fluencyAndCoherence: 7.5,
      lexicalResource: 8.0,
      grammaticalRangeAndAccuracy: 7.0,
      pronunciation: 7.5,
    },
    criteria: {
      fluencyAndCoherence: {
        score: 7.5,
        summary:
          "Candidate spoke at length without noticeable effort or loss of coherence.",
        strengths: ["Natural flow", "Appropriate discourse markers"],
        weaknesses: ["Occasional minor self-correction"],
        estimatedWpm: 135,
        hesitationFrequency: "low",
        tips: ["Practice complex abstract topics with minimal pauses"],
      },
      lexicalResource: {
        score: 8.0,
        summary:
          "Wide range of vocabulary used flexibly with precise collocations.",
        strengths: ["Idiomatic collocations", "Rich topic-specific vocabulary"],
        weaknesses: ["Occasional minor collocation slip"],
        upgrades: [
          {
            originalExpression: "very useful",
            betterAlternative: "indispensable asset",
            bandLevel: "Band 8.0+",
            contextExample:
              "Smart devices have become an indispensable asset in modern education.",
          },
        ],
        tips: ["Continue using nuanced academic collocations"],
      },
      grammaticalRangeAndAccuracy: {
        score: 7.0,
        summary:
          "Good mix of simple and complex sentence structures with frequent error-free sentences.",
        strengths: [
          "Subordinate clauses and relative pronouns used effectively",
        ],
        weaknesses: ["Minor slip in third conditional"],
        complexStructuresCount: 12,
        errors: [
          {
            originalPhrase: "If I would have known",
            correctedPhrase: "Had I known / If I had known",
            ruleViolated: "Third conditional past perfect condition",
            explanation:
              "Use past perfect in the if-clause of past hypothetical statements.",
          },
        ],
        tips: ["Drill mixed conditional structures under time pressure"],
      },
      pronunciation: {
        score: 7.5,
        summary:
          "Easy to understand throughout; natural sentence intonation and word stress.",
        strengths: ["Accurate word stress", "Connected speech and rhythm"],
        weaknesses: ["Slight drop of final consonant /s/ on plural nouns"],
        intonationQuality: "natural",
        specificErrors: [
          {
            word: "devices",
            expectedIpa: "/dɪˈvaɪsɪz/",
            detectedIssue: "Weak final /ɪz/ syllable ending",
            recommendation: "Articulate the final /ɪz/ sound clearly",
          },
        ],
        tips: ["Practice final consonant clusters /ts/, /dz/, /ks/"],
      },
    },
    generalFeedback: {
      executiveSummary:
        "The candidate displayed excellent fluency, speaking at length with natural cadence and minimal hesitation. Vocabulary demonstrated idiomatic flexibility with accurate collocations. Pronunciation was clear with good sentence stress and connected speech.",
      keyStrengths: [
        "Natural and spontaneous discourse flow with effective cohesive devices.",
        "Sophisticated lexical resource with appropriate idiomatic collocations.",
        "Accurate syllable stress and intonation patterns.",
      ],
      priorityImprovements: [
        "Occasional minor slip in subject-verb agreement during complex past conditional structures.",
        "Slight tendency to omit final consonant /s/ on plural nouns in fast delivery.",
      ],
      actionPlan: ["Practice complex abstract topics with minimal pauses"],
      practiceMonologue:
        "Technological advancements have fundamentally reshaped how we navigate our professional and academic lives. I heavily rely upon my laptop and smartphone as indispensable assets for in-depth research and seamless communication.",
    },
  },
  partEvaluations: [
    {
      partNumber: 1,
      itemIndex: 0,
      promptQuestion:
        "What kind of technological devices do you use most frequently every day?",
      candidateTranscript:
        "I frequently use my smartphone and laptop to organize my schedule and conduct research.",
      verifiedTranscript:
        "I frequently use my smartphone and laptop to organize my schedule and conduct research.",
      partSummary:
        "Candidate responded with clear examples and fluent delivery.",
      pronunciationNotes: [],
      lexicalUpgrades: [],
      grammarCorrections: [],
    },
  ],
  trace: {
    modelUsed: "gemini-2.5-flash",
    isFallback: false,
    fallbackReason: null,
    durationMs: 3200,
    tokensUsed: {
      promptTokens: 450,
      candidatesTokens: 850,
      totalTokens: 1300,
    },
    keyFingerprint: "fp-test",
    timestamp: "2026-08-31T00:00:00.000Z",
  },
};

const mockPracticeFeedback: PracticeFeedback = {
  evidenceScope: {
    mode: "part_1",
    responseCount: 2,
  },
  estimatedPerformance: {
    fluencyAndCoherence: 7.0,
    lexicalResource: 7.5,
    grammaticalRangeAndAccuracy: 6.5,
    pronunciation: 7.0,
  },
  evidenceSufficiency: "sufficient_for_practice_feedback",
  summary:
    "Thí sinh trả lời Part 1 tự tin và trôi chảy. Ngữ điệu tự nhiên, từ vựng phong phú theo chủ đề.",
  strengths: [
    {
      criterion: "FC",
      observation: "Tốc độ nói đều đặn, không ngập ngừng kéo dài.",
    },
  ],
  priorities: [
    {
      criterion: "GRA",
      observation: "Cần bổ sung thêm câu phức với mệnh đề quan hệ.",
    },
  ],
};

const meta: Meta<typeof LiveSpeakingResultView> = {
  title: "Speaking/Live/LiveSpeakingResultView",
  component: LiveSpeakingResultView,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    evaluationResult: mockEvaluationResult,
    isLoading: false,
    recordedAudio: {
      blob: new Blob(["test audio content"], { type: "audio/webm" }),
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      durationSeconds: 165,
      mimeType: "audio/webm",
    },
    transcripts: [
      {
        id: "tr-1",
        sender: "examiner",
        text: "Good day. What kind of technological devices do you use most frequently every day?",
        timestamp: 0,
        isFinal: true,
      },
      {
        id: "tr-2",
        sender: "user",
        text: "I frequently use my smartphone and laptop to organize my schedule and conduct research.",
        timestamp: 6000,
        isFinal: true,
      },
    ],
    candidateName: "Thí sinh Nguyễn An",
    onRestartTest: fn(),
    onBackToDashboard: fn(),
    onRetryEvaluation: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const EvaluationSuccess: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify Overall Band Scorecard
    expect(
      canvas.getByText("IELTS Speaking Full Mock Test")
    ).toBeInTheDocument();
    expect(canvas.getByText(/CEFR: C1/i)).toBeInTheDocument();

    // 2. Verify Audio Player is present
    expect(
      canvas.getByText(/File Ghi âm Toàn Bộ Buổi Thi/i)
    ).toBeInTheDocument();
    expect(canvas.getByTestId("player-toggle-play-btn")).toBeInTheDocument();

    // 3. Verify Criteria Breakdown
    expect(canvas.getByText("Fluency & Coherence (FC)")).toBeInTheDocument();
    expect(canvas.getByText("Lexical Resource (LR)")).toBeInTheDocument();

    // 4. Verify Interactive Transcript
    expect(canvas.getByText(/Gỡ băng Tương tác Buổi thi/i)).toBeInTheDocument();
  },
};

export const Part1PracticeMode: Story = {
  args: {
    evaluationResult: null,
    isPracticeMode: true,
    practiceFeedback: mockPracticeFeedback,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Luyện tập Speaking Part 1")).toBeInTheDocument();
    expect(canvas.getByText(/Nhận xét Hướng dẫn Sư phạm/i)).toBeInTheDocument();
    expect(canvas.getByText("Bản ghi âm Part 1 của bạn")).toBeInTheDocument();
  },
};

export const LoadingEvaluation: Story = {
  args: {
    isLoading: true,
    evaluationResult: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Đang phân tích & Chấm điểm/i)).toBeInTheDocument();
  },
};

export const EvaluationError: Story = {
  args: {
    isLoading: false,
    evaluationResult: null,
    error:
      "Không thể kết nối đến máy chủ chấm điểm tự động. Vui lòng thử lại sau.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText(/Không thể tải kết quả chấm điểm/i)
    ).toBeInTheDocument();
    expect(canvas.getByTestId("retry-evaluation-btn")).toBeInTheDocument();
  },
};

export const InteractiveAudioAndTranscriptSeeking: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Click skip forward (+5s) in player
    const forwardBtn = canvas.getByTestId("player-skip-forward-btn");
    await userEvent.click(forwardBtn);
    expect(canvas.getByTestId("player-current-time")).toHaveTextContent(
      "00:05"
    );

    // 2. Click timestamp in transcript to seek (turn 1 timestamp: 00:06)
    const transcriptSeekBtn = canvas.getByTestId("seek-timestamp-btn-1");
    await userEvent.click(transcriptSeekBtn);
    expect(canvas.getByTestId("player-current-time")).toHaveTextContent(
      "00:06"
    );
  },
};
