import { useState, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { LiveSpeakingResultView } from "./live-speaking-result-view";
import { fn, expect, userEvent, within, waitFor } from "storybook/test";
import { IeltsSpeakingEvaluationResult } from "@/lib/gemini/speaking-schema";
import { createSteppedEnvelopeWavBlob } from "@/test/fixtures/audio-fixtures";
import {
  restoreNativeAudioApis,
  resetAudioMocks,
} from "../../../.storybook/mocks/audio-api.mock";

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
  evidence: {
    fluency: {
      longPauses: [
        {
          startMs: 500,
          endMs: 1500,
          durationMs: 1000,
          transcriptSnippet: "uhm... let me think",
          reason: "Hesitation before Part 1 answer",
        },
      ],
      fillers: [],
      repetitions: [],
      selfCorrections: [],
    },
    grammar: {
      errors: [],
      complexStructures: [],
    },
    vocabulary: {
      strongUsage: [],
      inappropriateUsage: [],
    },
    pronunciation: {
      unclearSegments: [],
      stressIssues: [],
    },
  },
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

const sampleAudioBlob = createSteppedEnvelopeWavBlob(2);

const meta = {
  title: "Product/Speaking/LiveSpeakingResultView",
  component: LiveSpeakingResultView,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  beforeEach: () => {
    restoreNativeAudioApis();
  },
  afterEach: () => {
    resetAudioMocks();
  },
  decorators: [
    (Story, context) => {
      const [blobUrl] = useState(() => {
        const blob = createSteppedEnvelopeWavBlob(2);
        return URL.createObjectURL(blob);
      });

      useEffect(() => {
        return () => {
          URL.revokeObjectURL(blobUrl);
        };
      }, [blobUrl]);

      const recordedAudio = context.args.recordedAudio
        ? {
            ...context.args.recordedAudio,
            url: blobUrl,
          }
        : context.args.recordedAudio;

      return <Story args={{ ...context.args, recordedAudio }} />;
    },
  ],
  args: {
    evaluationResult: mockEvaluationResult,
    isLoading: false,
    recordedAudio: {
      blob: sampleAudioBlob,
      url: "",
      durationSeconds: 2,
      mimeType: "audio/wav",
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
      "Không thể kết nối đến máy chủ chấm điểm tự động. Vui lòng thử lại sau.",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/Không thể tải kết quả chấm điểm/i)
    ).toBeInTheDocument();
    const retryBtn = canvas.getByRole("button", {
      name: /Thử chấm điểm lại/i,
    });
    await expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    await expect(args.onRetryEvaluation).toHaveBeenCalled();
  },
};

export const InteractiveAudioWaveformTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Click Audio tab
    const audioTabBtn = canvas.getByRole("tab", {
      name: /Ghi âm & Bản chép lời/i,
    });
    await userEvent.click(audioTabBtn);

    // 2. Check recorded audio card & waveform player are present
    const audioCard = await canvas.findByTestId("recorded-audio-card");
    await expect(audioCard).toBeInTheDocument();
    await expect(
      canvas.getByText(/File Ghi âm Toàn Bộ Buổi Thi/i)
    ).toBeInTheDocument();

    // 3. Check play button exists in AudioReviewPlayer
    const playBtn = await canvas.findByTestId("audio-player-play-pause");
    await expect(playBtn).toBeInTheDocument();
    await waitFor(() => expect(playBtn).not.toBeDisabled(), { timeout: 5000 });
    await userEvent.click(playBtn);
  },
};

export const InteractiveEvidenceClipAndHiddenTabMount: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify 0 light-DOM hidden audio tags and exactly one canonical WaveSurfer shadow-root audio owner
    const lightAudioTags = canvasElement.querySelectorAll("audio");
    expect(lightAudioTags.length).toBe(0);

    const initialWaveformEl = canvasElement.querySelector(
      '[data-testid="audio-waveform-canvas-container"]'
    );
    expect(initialWaveformEl).not.toBeNull();
    const initialShadowHost = initialWaveformEl?.querySelector("div");
    expect(initialShadowHost?.shadowRoot).not.toBeNull();
    const shadowAudioTags =
      initialShadowHost?.shadowRoot?.querySelectorAll("audio") || [];
    expect(shadowAudioTags.length).toBe(1);

    // 2. Start on overview tab: AudioReviewPlayer is mounted in DOM (via keepMounted) but hidden
    const playPauseBtn = canvasElement.querySelector(
      '[data-testid="audio-player-play-pause"]'
    ) as HTMLButtonElement | null;
    expect(playPauseBtn).not.toBeNull();
    // Wait for the hidden player to decode audio and become ready
    await waitFor(
      () => {
        expect(playPauseBtn).not.toBeDisabled();
      },
      { timeout: 5000 }
    );

    // 3. Locate pause evidence playback button in the default Overview tab
    const listenBtn = await canvas.findByRole("button", {
      name: /Nghe/i,
    });
    await expect(listenBtn).toBeInTheDocument();

    // 4. Start snippet playback
    await userEvent.click(listenBtn);
    // Button state should transition to playing
    await waitFor(() => {
      expect(canvas.getByText(/Dừng/i)).toBeInTheDocument();
    });

    // 5. Switch to Audio tab -> cancels snippet playback and clears snippet timeout
    const audioTabBtn = canvas.getByRole("tab", {
      name: /Ghi âm & Bản chép lời/i,
    });
    await userEvent.click(audioTabBtn);

    // 7. Verify waveform container has non-zero rendered dimensions after tab switch
    const waveformContainer = await canvas.findByTestId(
      "audio-waveform-canvas-container"
    );
    expect(waveformContainer).toBeInTheDocument();
    await waitFor(() => {
      const shadowHost = waveformContainer.querySelector("div");
      const canvasEl =
        shadowHost?.shadowRoot?.querySelector("canvas") ||
        waveformContainer.querySelector("canvas");
      expect(canvasEl).not.toBeNull();
      expect(canvasEl?.width).toBeGreaterThan(0);
    });

    // 8. Player controls remain ready and can start full playback without overlapping audio
    expect(playPauseBtn).not.toBeDisabled();
    await userEvent.click(playPauseBtn!);
  },
};
