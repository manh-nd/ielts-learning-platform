import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AssessmentScorecardNode } from "./extensions/assessment-scorecard-node";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

function EmbeddedTiptapEditorDemo() {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, AssessmentScorecardNode],
    content: `
      <h2>IELTS Writing Task 2 Evaluation Report</h2>
      <p>This document demonstrates embedding the <strong>AssessmentScorecard</strong> directly inside a TipTap v3 document via <code>AssessmentScorecardNode</code>.</p>
      <div data-type="assessment-scorecard" data-scores='{"TASK_ACHIEVEMENT":7.0,"COHERENCE_COHESION":6.5,"LEXICAL_RESOURCE":7.5,"GRAMMATICAL_RANGE_ACCURACY":7.0}' data-overall-band="7.0"></div>
      <p>Further remarks from examiner: The student demonstrates solid analytical ability and strong paragraph organization.</p>
    `,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none p-6 min-h-[350px] focus:outline-none",
      },
    },
  });

  const handleInsertNewScorecard = () => {
    if (!editor) return;
    editor.commands.insertAssessmentScorecard({
      scores: {
        TASK_ACHIEVEMENT: 6.5,
        COHERENCE_COHESION: 6.5,
        LEXICAL_RESOURCE: 6.0,
        GRAMMATICAL_RANGE_ACCURACY: 6.0,
      },
      aiProposalScores: {
        TASK_ACHIEVEMENT: 6.0,
        COHERENCE_COHESION: 6.0,
        LEXICAL_RESOURCE: 6.0,
        GRAMMATICAL_RANGE_ACCURACY: 6.0,
      },
      taskType: "TASK_2",
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-xl">
        <span className="text-xs font-medium text-muted-foreground">
          TipTap v3 Editor với Embedded AssessmentScorecardNode
        </span>
        <Button
          type="button"
          size="sm"
          onClick={handleInsertNewScorecard}
          className="gap-1.5 h-8 text-xs font-semibold"
          data-testid="insert-scorecard-btn"
        >
          <PlusCircle className="h-3.5 w-3.5" /> Chèn Scorecard Mới
        </Button>
      </div>

      <div className="border rounded-2xl bg-card shadow-sm overflow-hidden">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

const meta: Meta<typeof EmbeddedTiptapEditorDemo> = {
  title: "IELTS/Assessment/AssessmentScorecardNode (TipTap Extension)",
  component: EmbeddedTiptapEditorDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Custom TipTap v3 Block Node Extension (AssessmentScorecardNode) bọc ReactNodeViewRenderer cho phép nhúng thẻ điểm AssessmentScorecard trực tiếp vào tài liệu bài viết và xuất bản in/PDF.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmbeddedTiptapEditorDemo>;

export const EmbeddedInEditor: Story = {
  render: () => <EmbeddedTiptapEditorDemo />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step(
      "1. Kiểm tra Scorecard Node được nhúng và render trong Tiptap",
      async () => {
        const node = canvasElement.querySelector(
          '[data-testid="tiptap-assessment-scorecard-node"]'
        );
        await expect(node).toBeInTheDocument();

        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("7.0");
      }
    );

    await step(
      "2. Tương tác với slider bên trong Scorecard Node của Editor",
      async () => {
        const plusBtn = canvas.getByTestId("stepper-plus-ta");
        await userEvent.click(plusBtn);

        const taBadge = canvas.getByTestId("current-score-badge-ta");
        await expect(taBadge).toHaveTextContent("7.5");
      }
    );
  },
};
