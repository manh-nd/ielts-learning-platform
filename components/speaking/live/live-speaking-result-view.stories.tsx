import type { Meta, StoryObj } from "@storybook/react";
import { LiveSpeakingResultView } from "./live-speaking-result-view";
import { fn, expect, userEvent, within } from "storybook/test";
import { IeltsSpeakingEvaluationResult } from "@/lib/gemini/speaking-schema";

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
            recommendation: "Ensure final /ɪz/ suffix is audibly articulated.",
            timestampSeconds: 15,
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
      actionPlan: [
        "Practice mixed conditional structures with timed drilling.",
        "Focus on phoneme clarity for final consonant clusters /ts/, /dz/, /ks/.",
        "Incorporate more C1 transition markers in Part 3 abstract reasoning.",
      ],
      practiceMonologue:
        "Technological advancements have fundamentally reshaped how we navigate our professional and academic lives. I heavily rely upon my laptop and smartphone as indispensable assets for in-depth research and seamless communication. While digital tools foster unprecedented efficiency, maintaining digital well-being is vital to ensure our productivity remains sustainable without inducing cognitive overload.",
    },
  },
  partEvaluations: [
    {
      partNumber: 1,
      itemIndex: 0,
      promptQuestion:
        "What kind of technological devices do you use most frequently every day?",
      candidateTranscript:
        "I frequently use my smartphone and laptop. They allow me to organize my daily schedule and conduct in-depth research.",
      partSummary:
        "Candidate responded directly and expanded with relevant details.",
      lexicalUpgrades: [
        {
          originalExpression: "frequently use",
          betterAlternative: "heavily rely upon",
          bandLevel: "Band 8.0+",
          contextExample:
            "I heavily rely upon my laptop for both academic research and development.",
        },
      ],
      grammarCorrections: [],
      pronunciationNotes: [
        {
          word: "smartphone",
          expectedIpa: "/ˈsmɑːrt.foʊn/",
          detectedIssue: "Clean vowel articulation and correct primary stress.",
          recommendation: "Maintain natural rhythm when linking.",
          timestampSeconds: 5,
        },
      ],
    },
    {
      partNumber: 2,
      itemIndex: 0,
      promptQuestion:
        "Describe a technological device or software that significantly changed your life.",
      candidateTranscript:
        "I would like to talk about modern AI development tools. When I first adopted them, my productivity increased dramatically...",
      partSummary:
        "Well-structured individual long turn with clear narrative flow.",
      lexicalUpgrades: [
        {
          originalExpression: "increased dramatically",
          betterAlternative: "surged exponentially",
          bandLevel: "Band 8.5+",
          contextExample:
            "My coding efficiency surged exponentially after integrating AI copilots.",
        },
      ],
      grammarCorrections: [
        {
          originalPhrase: "If I would have known about it earlier",
          correctedPhrase:
            "Had I known about it earlier / If I had known about it earlier",
          ruleViolated: "Third conditional past perfect",
          explanation:
            "Use third conditional past perfect in the condition clause.",
        },
      ],
      pronunciationNotes: [],
    },
  ],
  trace: {
    modelUsed: "gemini-3.7-flash",
    isFallback: false,
    fallbackReason: null,
    durationMs: 3420,
    tokensUsed: {
      promptTokens: 1250,
      candidatesTokens: 640,
      totalTokens: 1890,
    },
    keyFingerprint: "key_***mock",
    timestamp: new Date().toISOString(),
  },
};

const meta = {
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
      blob: new Blob([], { type: "audio/webm" }),
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      durationSeconds: 165,
      mimeType: "audio/webm",
    },
    transcripts: [
      {
        id: "tr-1",
        sender: "examiner",
        text: "Good day. What kind of technological devices do you use most frequently every day?",
        timestamp: Date.now() - 100000,
        isFinal: true,
      },
      {
        id: "tr-2",
        sender: "user",
        text: "I frequently use my smartphone and laptop to organize my schedule and conduct research.",
        timestamp: Date.now() - 80000,
        isFinal: true,
      },
    ],
    onRestartTest: fn(),
    onBackToDashboard: fn(),
    onRetryEvaluation: fn(),
  },
} satisfies Meta<typeof LiveSpeakingResultView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EvaluationSuccess: Story = {};

export const LoadingEvaluation: Story = {
  args: {
    isLoading: true,
    evaluationResult: null,
  },
};

export const EvaluationError: Story = {
  args: {
    isLoading: false,
    evaluationResult: null,
    error:
      "Không thể kết nối đến máy chủ chấm điểm Gemini. Vui lòng kiểm tra API Key hoặc kết nối mạng.",
  },
};

export const InteractiveAudioWaveformTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Click Audio tab
    const audioTabBtn = canvas.getByRole("tab", {
      name: /Ghi âm & Gỡ băng/i,
    });
    await userEvent.click(audioTabBtn);

    // 2. Check recorded audio card & waveform player are present
    const audioCard = await canvas.findByTestId("recorded-audio-card");
    await expect(audioCard).toBeInTheDocument();
    await expect(
      canvas.getByText(/File Ghi âm Toàn Bộ Buổi Thi/i)
    ).toBeInTheDocument();

    // 3. Check play button exists
    const playBtn = canvas.getByTestId("play-full-audio-btn");
    await expect(playBtn).toBeInTheDocument();
    await userEvent.click(playBtn);
  },
};
