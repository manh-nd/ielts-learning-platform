import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, fn } from "storybook/test";
import {
  TeacherSpeakingReviewWorkspace,
  StudentReviewInfo,
  SpeakingPartReviewData,
} from "./teacher-speaking-review-workspace";
import { SpeakingCriteriaScores } from "./speaking-criteria-scorecard";

const mockStudent: StudentReviewInfo = {
  id: "student-101",
  name: "Nguyễn Hoàng Nam",
  classroomName: "IELTS Intensive Master 04",
  targetBand: 7.0,
  submittedAt: "23/08/2026 14:30",
};

const mockSpeakingParts: SpeakingPartReviewData[] = [
  {
    partNumber: 1,
    itemIndex: 0,
    promptQuestion: "Do you currently work or are you studying at university?",
    candidateTranscript:
      "Currently, I am a sophomore majoring in software engineering at Hanoi University. I have chosen this field because of my deep passion for coding and building impactful digital products.",
    durationSeconds: 28,
    pronunciationNotes: [
      {
        word: "software",
        expectedIpa: "/ˈsɒftweə(r)/",
        detectedIssue: "Slightly flat vowel on /ɒ/",
        timestampSeconds: 6.2,
        recommendation:
          "Open mouth slightly wider for the open-mid back rounded vowel.",
      },
    ],
    lexicalUpgrades: [
      {
        originalExpression: "deep passion",
        betterAlternative: "profound fascination / keen aptitude for",
        bandLevel: "Band 7.5+ collocation",
        contextExample:
          "I developed a profound fascination with artificial intelligence.",
      },
    ],
    grammarCorrections: [],
  },
  {
    partNumber: 2,
    itemIndex: 0,
    promptQuestion:
      "Describe an environmental problem that your country or hometown is currently facing.",
    cueCardBulletPoints: [
      "What the environmental problem is",
      "What the primary causes and contributors are",
      "How this issue directly affects people's daily health and routine",
      "And explain what practical steps the government or citizens can take to mitigate it",
    ],
    candidateTranscript:
      "Today I would like to talk about air pollution, which is becoming a pressing issue in Hanoi. The surge in private motor vehicles and uncontrolled construction activities have heavily contributed to fine particulate matter in the atmosphere. Consequently, many citizens suffer from respiratory ailments.",
    durationSeconds: 112,
    pronunciationNotes: [
      {
        word: "vehicles",
        expectedIpa: "/ˈviːəklz/",
        detectedIssue: "Misplaced stress on 2nd syllable",
        timestampSeconds: 18.4,
        recommendation: "Stress the first syllable: VEE-uh-klz.",
      },
      {
        word: "respiratory",
        expectedIpa: "/rəˈspɪrətri/",
        detectedIssue: "Dropped /p/ and unclear weak vowel",
        timestampSeconds: 42.0,
        recommendation:
          "Articulate the bilabial plosive /p/ clearly before /ɪ/.",
      },
    ],
    lexicalUpgrades: [
      {
        originalExpression: "surge in private motor vehicles",
        betterAlternative: "exponential proliferation of private transport",
        bandLevel: "Band 8.0+ collocation",
        contextExample:
          "The exponential proliferation of private transport has exacerbated traffic congestion.",
      },
    ],
    grammarCorrections: [
      {
        originalPhrase: "have heavily contributed to",
        correctedPhrase: "has heavily contributed to",
        ruleViolated: "Subject-verb agreement",
        explanation:
          "The compound subject 'surge' is singular, so use 'has' instead of 'have'.",
      },
    ],
  },
  {
    partNumber: 3,
    itemIndex: 0,
    promptQuestion:
      "In what ways can international cooperation help resolve global environmental crises?",
    candidateTranscript:
      "From my perspective, transboundary environmental threats like global warming cannot be tackled by a single nation in isolation. Developed nations should provide financial aid and green technology transfer to emerging economies to foster sustainable industrialization.",
    durationSeconds: 52,
    pronunciationNotes: [
      {
        word: "threats",
        expectedIpa: "/θrets/",
        detectedIssue: "Substituted dental fricative /θ/ with alveolar /t/",
        timestampSeconds: 8.5,
        recommendation:
          "Place tongue between teeth to articulate the voiceless /θ/ sound.",
      },
    ],
    lexicalUpgrades: [
      {
        originalExpression: "green technology transfer",
        betterAlternative: "bilateral dissemination of sustainable innovations",
        bandLevel: "Band 8.0+ collocation",
        contextExample:
          "Bilateral dissemination of sustainable innovations accelerates renewable adoption.",
      },
    ],
    grammarCorrections: [],
  },
];

const mockAiScores: SpeakingCriteriaScores = {
  fluencyAndCoherence: 6.5,
  lexicalResource: 7.0,
  grammaticalRangeAndAccuracy: 6.0,
  pronunciation: 6.5,
};

const meta: Meta<typeof TeacherSpeakingReviewWorkspace> = {
  title: "Speaking/Review/TeacherSpeakingReviewWorkspace",
  component: TeacherSpeakingReviewWorkspace,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Không gian chấm bài IELTS Speaking toàn diện cho Giáo viên với Audio Waveform Player đa Part, cờ timestamp lỗi phát âm, tương tác click-to-seek transcript, bảng điểm 4 tiêu chí (FC, LR, GRA, PR), và đối sánh điểm AI vs Giáo viên.",
      },
    },
  },
  tags: ["autodocs"],
  args: {
    student: mockStudent,
    assignmentTitle: "Speaking Assignment #03 - Environment & Modern Society",
    parts: mockSpeakingParts,
    aiScores: mockAiScores,
    initialExaminerSummary:
      "Học viên có độ trôi chảy khá tốt (WPM ~125), vốn từ vựng phong phú ở chủ đề môi trường (Band 7.0). Cần chú ý một số lỗi chia động từ số ít/số nhiều và phát âm các âm đuôi /θ/, /ks/.",
    initialStrengths: [
      "Vốn từ vựng chuyên ngành môi trường tốt (particulate matter, respiratory ailments)",
      "Tốc độ nói đều, duy trì được mạch ý tưởng liên tục",
    ],
    initialImprovements: [
      "Sửa lỗi chia động từ 'surge ... has contributed' ở Part 2",
      "Luyện tập phát âm âm /θ/ trong từ 'threats' và trọng âm từ 'vehicles'",
    ],
    initialActionPlan: [
      "Tuần 1: Luyện tập 15 phút/ngày phát âm các cặp từ âm /θ/ vs /t/",
      "Tuần 2: Thực hành mở rộng cấu trúc câu chẻ (cleft sentences) trong Part 3",
    ],
    onApprove: fn(),
    onPublish: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TeacherSpeakingReviewWorkspace>;

/**
 * Phiên chấm bài mặc định với đề xuất từ model chính Gemini 3.7 Flash
 */
export const DefaultWithAiProposal: Story = {
  args: {
    traceMetadata: {
      modelUsed: "gemini-3.7-flash",
      isFallback: false,
      fallbackReason: null,
      durationMs: 2350,
      tokensUsed: {
        promptTokens: 1450,
        candidatesTokens: 820,
        totalTokens: 2270,
      },
    },
    initialStatus: "ai_proposal_available",
  },
};

/**
 * Phiên chấm bài sử dụng kết quả fallback từ Gemini 3.5 Flash Lite khi hết quota
 */
export const FallbackModelProposal: Story = {
  args: {
    traceMetadata: {
      modelUsed: "gemini-3.5-flash-lite",
      isFallback: true,
      fallbackReason: "ALL_KEYS_DAILY_QUOTA_EXHAUSTED",
      durationMs: 1150,
      tokensUsed: {
        promptTokens: 1450,
        candidatesTokens: 820,
        totalTokens: 2270,
      },
    },
    initialStatus: "ai_proposal_available",
  },
};

/**
 * Trạng thái bài chấm đã được giáo viên phê duyệt (Approved)
 */
export const TeacherApproved: Story = {
  args: {
    initialStatus: "approved",
    aiScores: mockAiScores,
    traceMetadata: {
      modelUsed: "gemini-3.7-flash",
      isFallback: false,
      durationMs: 2100,
    },
  },
};

/**
 * Kịch bản kiểm thử tương tác tự động (CSF3 Play function)
 */
export const InteractiveSeekingAndScoring: Story = {
  args: {
    traceMetadata: {
      modelUsed: "gemini-3.7-flash",
      isFallback: false,
      durationMs: 2200,
    },
    initialStatus: "in_review",
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("Chuyển sang Part 2: Cue Card", async () => {
      const part2Tab = canvas.getByTestId("tab-part-2");
      await userEvent.click(part2Tab);
      expect(
        canvas.getByText(/Describe an environmental problem/i)
      ).toBeInTheDocument();
    });

    await step("Bật phát Audio Waveform Player", async () => {
      const playBtn = canvas.getByTestId("audio-play-pause-button");
      await userEvent.click(playBtn);
    });

    await step("Thêm ghim nhận xét của Giáo viên tại timestamp", async () => {
      const annotInput = canvas.getByTestId("annotation-input");
      await userEvent.type(
        annotInput,
        "Lưu ý phát âm từ 'vehicles': nhấn âm 1 thay vì âm 2"
      );
      const addBtn = canvas.getByTestId("add-annotation-button");
      await userEvent.click(addBtn);

      expect(
        canvas.getByText(/Lưu ý phát âm từ 'vehicles'/i)
      ).toBeInTheDocument();
    });

    await step("Chỉnh sửa nhận xét tổng quan của giám khảo", async () => {
      const summaryTextarea = canvas.getByTestId("examiner-summary-textarea");
      await userEvent.clear(summaryTextarea);
      await userEvent.type(
        summaryTextarea,
        "Đánh giá hoàn thiện: Học viên có tiến bộ rõ rệt ở Part 2."
      );
    });

    await step("Thực hiện Phê duyệt bài chấm (Approve)", async () => {
      const approveBtn = canvas.getByTestId("approve-review-button");
      await userEvent.click(approveBtn);
      expect(canvas.getAllByText(/Đã Phê Duyệt/i)[0]).toBeInTheDocument();
    });
  },
};
