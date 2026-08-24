import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { IeltsWritingSuite } from "./ielts-writing-suite";
import { WritingPrompt, WritingDraft } from "./types";

const mockTask2Prompt: WritingPrompt = {
  id: "prompt-task2-ai-education",
  taskType: "TASK_2",
  title: "Artificial Intelligence in Education & The Future of Teaching",
  promptText:
    "Some people believe that advancements in Artificial Intelligence will eventually replace human teachers in schools and universities.\n\nTo what extent do you agree or disagree with this statement? Give reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  minWords: 250,
  targetWordsMax: 350,
  timeLimitMinutes: 40,
};

const mockTask1Prompt: WritingPrompt = {
  id: "prompt-task1-internet-access",
  taskType: "TASK_1_ACADEMIC",
  title: "Internet Access Rates Across Three Countries (2010–2020)",
  promptText:
    "The bar chart illustrates the percentage of households with access to high-speed internet in Country A, Country B, and Country C between 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
  imageUrl:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
  imageAlt: "Bar chart illustrating internet access trends",
  minWords: 150,
  targetWordsMax: 220,
  timeLimitMinutes: 20,
};

const mockSampleDraft: WritingDraft = {
  contentHtml:
    "<p>In recent years, the rapid advancement of artificial intelligence has sparked intense debate regarding the role of educators in modern academia.</p><p>While technological tools offer personalized learning paths, human teachers remain indispensable for cultivating critical thinking, emotional empathy, and moral guidance.</p>",
  contentText:
    "In recent years, the rapid advancement of artificial intelligence has sparked intense debate regarding the role of educators in modern academia.\n\nWhile technological tools offer personalized learning paths, human teachers remain indispensable for cultivating critical thinking, emotional empathy, and moral guidance.",
  wordCount: 42,
  scratchpadHtml:
    "<p><strong>Essay Outline:</strong></p><ul><li>Introduction: Paraphrase AI development & state thesis (disagree).</li><li>Body 1: AI efficiency & customized practice.</li><li>Body 2: Irreplaceable human qualities (empathy, mentorship).</li><li>Conclusion: AI as powerful assistant, not replacement.</li></ul>",
  scratchpadText:
    "Essay Outline:\n• Introduction: Paraphrase AI development & state thesis (disagree).\n• Body 1: AI efficiency & customized practice.\n• Body 2: Irreplaceable human qualities (empathy, mentorship).\n• Conclusion: AI as powerful assistant, not replacement.",
  lastSavedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  secondsRemaining: 1800,
};

const meta: Meta<typeof IeltsWritingSuite> = {
  title: "IELTS/Writing/IeltsWritingSuite",
  component: IeltsWritingSuite,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof IeltsWritingSuite>;

/**
 * 1. Standard IELTS Writing Task 2 in Practice Mode
 */
export const DefaultTask2Practice: Story = {
  args: {
    prompt: mockTask2Prompt,
    userId: "student_demo_01",
    submissionId: "task2_practice_session",
    isMockTest: false,
    onSubmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify Prompt header rendered
    const taskBadge = canvas.getByTestId("task-type-badge");
    await expect(taskBadge).toHaveTextContent("IELTS Writing Task 2 (Essay)");

    // 2. Type essay content
    const editor = canvas.getByTestId("tiptap-editor-content");
    await userEvent.click(editor);
    await userEvent.type(
      editor,
      "Technological progress in machine learning has revolutionized modern education."
    );

    // 3. Verify Word count badge updates
    const wordBadge = canvas.getByTestId("word-count-badge");
    await expect(wordBadge).toBeInTheDocument();

    // 4. Test Collapsible Prompt Toggle
    const collapseBtn = canvas.getByTestId("toggle-prompt-collapse-btn");
    await userEvent.click(collapseBtn);

    const collapsedView = await canvas.findByTestId("prompt-body-collapsed");
    await expect(collapsedView).toBeInTheDocument();

    // Expand again
    await userEvent.click(collapsedView);
    const expandedView = await canvas.findByTestId("prompt-body-expanded");
    await expect(expandedView).toBeInTheDocument();
  },
};

/**
 * 2. IELTS Writing Task 1 Academic with Chart Image & Scratchpad interaction
 */
export const Task1AcademicWithChart: Story = {
  args: {
    prompt: mockTask1Prompt,
    userId: "student_demo_02",
    submissionId: "task1_chart_session",
    isMockTest: false,
    onSubmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify Task 1 prompt & chart image
    const taskBadge = canvas.getByTestId("task-type-badge");
    await expect(taskBadge).toHaveTextContent(
      "IELTS Writing Task 1 (Academic Report)"
    );

    const imageContainer = canvas.getByTestId("prompt-image-container");
    await expect(imageContainer).toBeInTheDocument();

    // 2. Open Outline Scratchpad Drawer
    const scratchpadToggleBtn = canvas.getByTestId("toggle-scratchpad-btn");
    await userEvent.click(scratchpadToggleBtn);

    // 3. Verify Scratchpad drawer opens
    const scratchpadDrawer = await canvas.findByTestId(
      "writing-scratchpad-drawer"
    );
    await expect(scratchpadDrawer).toBeInTheDocument();

    // 4. Test Copy Scratchpad Button
    const copyBtn = canvas.getByTestId("copy-scratchpad-btn");
    await userEvent.click(copyBtn);

    // 5. Close Scratchpad Drawer
    const closeBtn = canvas.getByTestId("close-scratchpad-btn");
    await userEvent.click(closeBtn);
  },
};

/**
 * 3. Strict Mock Test Mode with Countdown Timer & Paste Prevention
 */
export const StrictExamMode: Story = {
  args: {
    prompt: mockTask2Prompt,
    userId: "student_demo_exam",
    submissionId: "exam_mock_session",
    isMockTest: true,
    timeLimitMinutes: 40,
    onSubmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify Exam Mode Badge & Countdown Timer
    const examBadge = canvas.getByTestId("exam-mode-badge");
    await expect(examBadge).toHaveTextContent("Strict Exam Mode");

    const timer = canvas.getByTestId("countdown-timer");
    await expect(timer).toBeInTheDocument();

    // 2. Type some manual text
    const editor = canvas.getByTestId("tiptap-editor-content");
    await userEvent.click(editor);
    await userEvent.type(
      editor,
      "Genuine candidate response under test conditions."
    );

    // 3. Dispatch simulated paste event
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    editor.dispatchEvent(pasteEvent);

    // 4. Verify red warning banner appears
    const blockedBanner = await canvas.findByTestId("paste-blocked-banner");
    await expect(blockedBanner).toBeInTheDocument();
    await expect(blockedBanner).toHaveTextContent(
      "Tính năng Copy-Paste bị vô hiệu hóa"
    );
  },
};

/**
 * 4. Underlength Warning State and Confirmation Dialog Flow
 */
export const UnderlengthAndOverlengthStates: Story = {
  args: {
    prompt: mockTask2Prompt,
    userId: "student_demo_underlength",
    submissionId: "underlength_test_session",
    initialDraft: {
      contentHtml:
        "<p>This is a very brief response with only a few words written so far.</p>",
      contentText:
        "This is a very brief response with only a few words written so far.",
      wordCount: 13,
      lastSavedAt: new Date().toISOString(),
    },
    onSubmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify word count badge displays underlength status
    const wordBadge = canvas.getByTestId("word-count-badge");
    await expect(wordBadge).toHaveTextContent("Thiếu");

    // 2. Click Submit button while underlength
    const submitBtn = canvas.getByTestId("submit-essay-btn");
    await userEvent.click(submitBtn);

    // 3. Verify underlength warning dialog is triggered
    const dialogTitle = await within(document.body).findByText(
      "Cảnh Báo Số Từ Chưa Đạt Chuẩn"
    );
    await expect(dialogTitle).toBeInTheDocument();

    // 4. Click Cancel button to continue editing
    const cancelBtn = within(document.body).getByTestId(
      "cancel-underlength-submit-btn"
    );
    await userEvent.click(cancelBtn);
  },
};

/**
 * 5. Restored Draft State with Pre-existing Content & Scratchpad Notes
 */
export const RestoredDraftState: Story = {
  args: {
    prompt: mockTask2Prompt,
    userId: "student_demo_restored",
    submissionId: "restored_draft_session",
    initialDraft: mockSampleDraft,
    onSubmit: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify restored text in editor
    const editor = canvas.getByTestId("tiptap-editor-content");
    await expect(editor).toHaveTextContent(
      "rapid advancement of artificial intelligence"
    );

    // 2. Verify auto-save status reflects saved state
    const autoSaveStatus = canvas.getByTestId("autosave-status");
    await expect(autoSaveStatus).toHaveTextContent("Đã lưu nháp");

    // 3. Open scratchpad and verify outline is restored
    const scratchpadToggleBtn = canvas.getByTestId("toggle-scratchpad-btn");
    await userEvent.click(scratchpadToggleBtn);

    const scratchpadEditor = await canvas.findByTestId(
      "scratchpad-tiptap-editor"
    );
    await expect(scratchpadEditor).toHaveTextContent("Essay Outline");
  },
};

/**
 * 6. Full Zen Focus Mode State
 */
export const FullZenMode: Story = {
  args: {
    prompt: mockTask2Prompt,
    userId: "student_demo_zen",
    submissionId: "zen_mode_session",
    isMockTest: false,
    onSubmit: fn(),
  },
};
