import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "@storybook/test";
import { TeacherReviewAnnotator } from "./teacher-review-annotator";
import type { ReviewAnnotation } from "./types";

const mockAnnotations: ReviewAnnotation[] = [
  {
    errorId: "err-lr",
    criterion: "LEXICAL_RESOURCE",
    category: "Word Choice / Repetition",
    severity: "systematic_error",
    explanation:
      "The word 'effective' is repeatedly used in the paragraph. Consider using a richer vocabulary item such as 'impactful' or 'beneficial'.",
    suggestedCorrection: "more impactful in reducing",
    originalQuote: "more effective in reducing",
    source: "ai",
    isResolved: false,
  },
  {
    errorId: "err-gra",
    criterion: "GRAMMATICAL_RANGE_ACCURACY",
    category: "Noun Collocation & Article",
    severity: "minor_slip",
    explanation:
      "Missing context noun or pluralization when discussing crime statistics.",
    suggestedCorrection: "reduce crime rates",
    originalQuote: "reduce crime",
    source: "ai",
    isResolved: false,
  },
  {
    errorId: "err-cc",
    criterion: "COHERENCE_COHESION",
    category: "Discourse Markers",
    severity: "minor_slip",
    explanation:
      "The phrase 'On the other hand' is standard but overly predictable. Using advanced transitional adverbs improves coherence score.",
    suggestedCorrection: "Conversely",
    originalQuote: "On the other hand",
    source: "ai",
    isResolved: false,
  },
  {
    errorId: "err-ta",
    criterion: "TASK_ACHIEVEMENT",
    category: "Development of Supporting Ideas",
    severity: "minor_slip",
    explanation:
      "The first main body paragraph provides a valid point but could be bolstered with specific statistics from international penal systems.",
    suggestedCorrection: "",
    originalQuote: "seen some reduction in repeat offenses",
    source: "ai",
    isResolved: false,
  },
];

const mockEssayHtml = `<p>In modern society, criminal activity remains a pressing challenge that governments worldwide must address. While proponents of strict sentencing argue for longer incarceration to <mark data-criterion="GRAMMATICAL_RANGE_ACCURACY" data-error-id="err-gra" data-category="Noun Collocation & Article" data-severity="minor_slip" data-explanation="Missing context noun" data-suggested-correction="reduce crime rates" data-source="ai" data-is-resolved="false">reduce crime</mark>, others propose educational rehabilitation programs.</p><p><mark data-criterion="COHERENCE_COHESION" data-error-id="err-cc" data-category="Discourse Markers" data-severity="minor_slip" data-explanation="Overly predictable transition" data-suggested-correction="Conversely" data-source="ai" data-is-resolved="false">On the other hand</mark>, empirical studies show that community-based initiatives are <mark data-criterion="LEXICAL_RESOURCE" data-error-id="err-lr" data-category="Word Choice / Repetition" data-severity="systematic_error" data-explanation="Word effective repeated" data-suggested-correction="more impactful in reducing" data-source="ai" data-is-resolved="false">more effective in reducing</mark> recidivism rates among young offenders.</p><p>Furthermore, prisons that implement vocational workshops have <mark data-criterion="TASK_ACHIEVEMENT" data-error-id="err-ta" data-category="Development of Supporting Ideas" data-severity="minor_slip" data-explanation="Needs concrete statistics" data-suggested-correction="" data-source="ai" data-is-resolved="false">seen some reduction in repeat offenses</mark> over the last decade.</p>`;

const meta: Meta<typeof TeacherReviewAnnotator> = {
  title: "IELTS/Review/TeacherReviewAnnotator",
  component: TeacherReviewAnnotator,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof TeacherReviewAnnotator>;

/**
 * 1. AI Pre-Graded Essay with 4 Criterion Highlights
 */
export const AIPreGraded: Story = {
  args: {
    initialContent: mockEssayHtml,
    initialAnnotations: mockAnnotations,
    editable: true,
    showFilterBar: true,
    showStatsBar: true,
    onContentChange: fn(),
    onAnnotationsChange: fn(),
    onApplyCorrection: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify all 4 criterion filter buttons are rendered
    const filterAllBtn = canvas.getByTestId("filter-all-btn");
    await expect(filterAllBtn).toHaveTextContent("Tất cả (4)");

    const filterLrBtn = canvas.getByTestId("filter-lr-btn");
    await expect(filterLrBtn).toHaveTextContent("LR (1)");

    const filterGraBtn = canvas.getByTestId("filter-gra-btn");
    await expect(filterGraBtn).toHaveTextContent("GRA (1)");

    // 2. Verify highlight marks exist in the editor
    const lrMark = canvasElement.querySelector('mark[data-error-id="err-lr"]');
    await expect(lrMark).toBeInTheDocument();
    await expect(lrMark).toHaveTextContent("more effective in reducing");
  },
};

/**
 * 2. Filter Highlights by IELTS Criterion (e.g. Lexical Resource)
 */
export const FilterByCriterion: Story = {
  args: {
    initialContent: mockEssayHtml,
    initialAnnotations: mockAnnotations,
    editable: true,
    showFilterBar: true,
    showStatsBar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Click filter Lexical Resource
    const filterLrBtn = canvas.getByTestId("filter-lr-btn");
    await userEvent.click(filterLrBtn);

    // 2. Verify container gets filter-active class
    const container = canvas.getByTestId("teacher-review-annotator");
    await expect(container).toHaveClass("filter-active");

    // 3. Verify LR mark is NOT filtered out while GRA mark IS filtered out
    const lrMark = canvasElement.querySelector('mark[data-error-id="err-lr"]');
    const graMark = canvasElement.querySelector(
      'mark[data-error-id="err-gra"]'
    );
    await expect(lrMark).not.toHaveClass("is-filtered-out");
    await expect(graMark).toHaveClass("is-filtered-out");

    // 4. Reset back to ALL
    const filterAllBtn = canvas.getByTestId("filter-all-btn");
    await userEvent.click(filterAllBtn);
    await expect(container).not.toHaveClass("filter-active");
  },
};

/**
 * 3. Diagnostic Popover and 1-Click Apply Correction Interaction Test
 */
export const DiagnosticAndApplyCorrectionTest: Story = {
  args: {
    initialContent: mockEssayHtml,
    initialAnnotations: mockAnnotations,
    editable: true,
    onApplyCorrection: fn(),
    onAnnotationsChange: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Step 1: Find the Lexical Resource error mark
    const lrMark = canvasElement.querySelector(
      'mark[data-error-id="err-lr"]'
    ) as HTMLElement;
    await expect(lrMark).toBeInTheDocument();
    await expect(lrMark).toHaveTextContent("more effective in reducing");

    // Step 2: Click on the error mark to trigger Diagnostic Popover
    await userEvent.click(lrMark);

    // Step 3: Verify the Diagnostic Popover appears with correction details
    const popover = canvas.getByTestId("diagnostic-popover-err-lr");
    await expect(popover).toBeInTheDocument();

    const criterionBadge = canvas.getByTestId("diagnostic-criterion-badge");
    await expect(criterionBadge).toHaveTextContent("LR · Lexical Resource");

    const explanation = canvas.getByTestId("diagnostic-explanation");
    await expect(explanation).toHaveTextContent(
      "The word 'effective' is repeatedly used"
    );

    const correctionText = canvas.getByTestId("suggested-correction-text");
    await expect(correctionText).toHaveTextContent(
      "more impactful in reducing"
    );

    // Step 4: Click the 1-Click "Apply Correction" button
    const applyBtn = canvas.getByTestId("apply-correction-btn-err-lr");
    await userEvent.click(applyBtn);

    // Step 5: Verify the editor content is updated and mark is resolved
    const editor = canvas.getByTestId("tiptap-editor-content");
    await expect(editor).toHaveTextContent("more impactful in reducing");

    const resolvedMark = canvasElement.querySelector(
      'mark[data-error-id="err-lr"][data-is-resolved="true"]'
    );
    await expect(resolvedMark).toBeInTheDocument();
  },
};

/**
 * 4. Read-Only Mode (Student View)
 */
export const ReadOnlyStudentView: Story = {
  args: {
    initialContent: mockEssayHtml,
    initialAnnotations: mockAnnotations,
    editable: false,
    showFilterBar: true,
    showStatsBar: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId("teacher-review-annotator");
    await expect(container).toBeInTheDocument();
  },
};
