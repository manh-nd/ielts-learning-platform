"use client";

import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { AssessmentScorecard } from "../assessment-scorecard";
import {
  AssessmentScores,
  WritingCriterion,
  calculateOverallBand,
} from "../types";

export interface AssessmentScorecardNodeAttributes {
  scores: AssessmentScores;
  aiProposalScores?: AssessmentScores | null;
  overallBand: number;
  taskType: "TASK_1" | "TASK_2" | "SPEAKING";
  mode: "interactive" | "readonly";
  examinerFeedback?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    assessmentScorecard: {
      insertAssessmentScorecard: (
        options?: Partial<AssessmentScorecardNodeAttributes>
      ) => ReturnType;
    };
  }
}

function AssessmentScorecardNodeComponent(props: NodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const attrs = node.attrs as AssessmentScorecardNodeAttributes;

  const handleScoresChange = (
    newScores: AssessmentScores,
    overallBand: number
  ) => {
    if (!editor.isEditable) return;
    updateAttributes({
      scores: newScores,
      overallBand,
    });
  };

  const handleCriterionChange = (
    criterion: WritingCriterion,
    newScore: number
  ) => {
    if (!editor.isEditable) return;
    const nextScores = {
      ...attrs.scores,
      [criterion]: newScore,
    };
    const nextOverall = calculateOverallBand(nextScores);
    updateAttributes({
      scores: nextScores,
      overallBand: nextOverall,
    });
  };

  return (
    <NodeViewWrapper
      className="my-6 block not-prose"
      data-testid="tiptap-assessment-scorecard-node"
    >
      <AssessmentScorecard
        scores={attrs.scores}
        aiProposalScores={attrs.aiProposalScores || undefined}
        mode={editor.isEditable ? attrs.mode : "readonly"}
        taskType={attrs.taskType}
        examinerFeedback={attrs.examinerFeedback}
        onScoresChange={handleScoresChange}
        onCriterionChange={handleCriterionChange}
      />
    </NodeViewWrapper>
  );
}

export const AssessmentScorecardNode = Node.create({
  name: "assessmentScorecard",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      scores: {
        default: {
          TASK_ACHIEVEMENT: 6.5,
          COHERENCE_COHESION: 6.5,
          LEXICAL_RESOURCE: 6.5,
          GRAMMATICAL_RANGE_ACCURACY: 6.5,
        },
        parseHTML: (el) => {
          const raw = el.getAttribute("data-scores");
          try {
            return raw ? JSON.parse(raw) : undefined;
          } catch {
            return undefined;
          }
        },
        renderHTML: (attrs) => ({
          "data-scores": JSON.stringify(attrs.scores),
        }),
      },
      aiProposalScores: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-ai-scores");
          try {
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        renderHTML: (attrs) =>
          attrs.aiProposalScores
            ? { "data-ai-scores": JSON.stringify(attrs.aiProposalScores) }
            : {},
      },
      overallBand: {
        default: 6.5,
        parseHTML: (el) => {
          const val = el.getAttribute("data-overall-band");
          return val ? parseFloat(val) : 6.5;
        },
        renderHTML: (attrs) => ({
          "data-overall-band": attrs.overallBand,
        }),
      },
      taskType: {
        default: "TASK_2",
        parseHTML: (el) => el.getAttribute("data-task-type") || "TASK_2",
        renderHTML: (attrs) => ({
          "data-task-type": attrs.taskType,
        }),
      },
      mode: {
        default: "interactive",
        parseHTML: (el) => el.getAttribute("data-mode") || "interactive",
        renderHTML: (attrs) => ({
          "data-mode": attrs.mode,
        }),
      },
      examinerFeedback: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-examiner-feedback") || "",
        renderHTML: (attrs) => ({
          "data-examiner-feedback": attrs.examinerFeedback,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="assessment-scorecard"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "assessment-scorecard",
        class:
          "assessment-scorecard-embed rounded-2xl border p-4 my-4 bg-muted/10",
      }),
      [
        "div",
        { class: "font-bold text-sm mb-2 text-foreground" },
        `IELTS Overall Band: ${HTMLAttributes["data-overall-band"] || "6.5"}`,
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AssessmentScorecardNodeComponent);
  },

  addCommands() {
    return {
      insertAssessmentScorecard:
        (options = {}) =>
        ({ commands }) => {
          const defaultScores: AssessmentScores = {
            TASK_ACHIEVEMENT: 6.5,
            COHERENCE_COHESION: 6.5,
            LEXICAL_RESOURCE: 6.5,
            GRAMMATICAL_RANGE_ACCURACY: 6.5,
          };
          const scores = options.scores || defaultScores;
          const overallBand =
            options.overallBand || calculateOverallBand(scores);

          return commands.insertContent({
            type: this.name,
            attrs: {
              scores,
              aiProposalScores: options.aiProposalScores || null,
              overallBand,
              taskType: options.taskType || "TASK_2",
              mode: options.mode || "interactive",
              examinerFeedback: options.examinerFeedback || "",
            },
          });
        },
    };
  },
});
