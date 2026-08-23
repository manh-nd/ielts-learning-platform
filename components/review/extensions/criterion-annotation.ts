import { Mark, mergeAttributes } from "@tiptap/core";
import type { Criterion, ErrorSeverity } from "../types";

export interface CriterionAnnotationAttributes {
  errorId: string;
  criterion: Criterion;
  category?: string;
  severity?: ErrorSeverity;
  explanation?: string;
  suggestedCorrection?: string;
  source?: "ai" | "teacher";
  isResolved?: boolean;
}

export interface CriterionAnnotationOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    criterionAnnotation: {
      /**
       * Set a criterion annotation mark on current selection
       */
      setCriterionAnnotation: (
        attributes: CriterionAnnotationAttributes
      ) => ReturnType;
      /**
       * Remove criterion annotation with given errorId
       */
      unsetCriterionAnnotation: (errorId: string) => ReturnType;
      /**
       * 1-Click apply suggested correction: replaces the text range with suggestedCorrection
       * and sets isResolved to true in an atomic transaction
       */
      applyAnnotationCorrection: (errorId: string) => ReturnType;
      /**
       * Toggle or set the isResolved flag on an annotation
       */
      toggleAnnotationResolved: (
        errorId: string,
        isResolved?: boolean
      ) => ReturnType;
      /**
       * Update attributes of an existing annotation mark
       */
      updateCriterionAnnotation: (
        errorId: string,
        attributes: Partial<CriterionAnnotationAttributes>
      ) => ReturnType;
    };
  }
}

export const CriterionAnnotationMark = Mark.create<CriterionAnnotationOptions>({
  name: "criterionAnnotation",

  // Allow co-existing with other formatting marks (bold, italic, etc.)
  excludes: "",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      errorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-error-id"),
        renderHTML: (attributes) => {
          if (!attributes.errorId) return {};
          return { "data-error-id": attributes.errorId };
        },
      },
      criterion: {
        default: "TASK_ACHIEVEMENT",
        parseHTML: (element) =>
          (element.getAttribute("data-criterion") as Criterion) ||
          "TASK_ACHIEVEMENT",
        renderHTML: (attributes) => ({
          "data-criterion": attributes.criterion || "TASK_ACHIEVEMENT",
        }),
      },
      category: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-category") || "",
        renderHTML: (attributes) => {
          if (!attributes.category) return {};
          return { "data-category": attributes.category };
        },
      },
      severity: {
        default: "minor_slip",
        parseHTML: (element) =>
          (element.getAttribute("data-severity") as ErrorSeverity) ||
          "minor_slip",
        renderHTML: (attributes) => ({
          "data-severity": attributes.severity || "minor_slip",
        }),
      },
      explanation: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-explanation") || "",
        renderHTML: (attributes) => {
          if (!attributes.explanation) return {};
          return { "data-explanation": attributes.explanation };
        },
      },
      suggestedCorrection: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-suggested-correction") || "",
        renderHTML: (attributes) => {
          if (!attributes.suggestedCorrection) return {};
          return {
            "data-suggested-correction": attributes.suggestedCorrection,
          };
        },
      },
      source: {
        default: "ai",
        parseHTML: (element) =>
          (element.getAttribute("data-source") as "ai" | "teacher") || "ai",
        renderHTML: (attributes) => ({
          "data-source": attributes.source || "ai",
        }),
      },
      isResolved: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute("data-is-resolved") === "true",
        renderHTML: (attributes) => ({
          "data-is-resolved": attributes.isResolved ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "mark[data-criterion]",
      },
      {
        tag: "mark[data-error-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const criterion = (
      HTMLAttributes["data-criterion"] || "TASK_ACHIEVEMENT"
    ).toLowerCase();
    const isResolved = HTMLAttributes["data-is-resolved"] === "true";
    const source = HTMLAttributes["data-source"] || "ai";

    const classNames = [
      "criterion-mark",
      `criterion-${criterion}`,
      isResolved ? "is-resolved" : "",
      `source-${source}`,
    ]
      .filter(Boolean)
      .join(" ");

    return [
      "mark",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: classNames,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCriterionAnnotation:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },

      unsetCriterionAnnotation:
        (errorId: string) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          let hasMatched = false;
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type === markType && mark.attrs.errorId === errorId) {
                hasMatched = true;
                tr.removeMark(pos, pos + node.nodeSize, markType);
              }
            });
          });

          if (hasMatched && dispatch) {
            dispatch(tr);
            return true;
          }
          return hasMatched;
        },

      applyAnnotationCorrection:
        (errorId: string) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          let targetFrom = -1;
          let targetTo = -1;
          let targetAttrs: CriterionAnnotationAttributes | null = null;

          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type === markType && mark.attrs.errorId === errorId) {
                if (targetFrom === -1) {
                  targetFrom = pos;
                  targetAttrs = mark.attrs as CriterionAnnotationAttributes;
                }
                targetTo = pos + node.nodeSize;
              }
            });
          });

          if (targetFrom === -1 || targetTo === -1 || !targetAttrs) {
            return false;
          }

          const attrs: CriterionAnnotationAttributes = targetAttrs;
          const correction = attrs.suggestedCorrection;
          if (correction === undefined) {
            return false;
          }

          if (dispatch) {
            const updatedAttrs: CriterionAnnotationAttributes = {
              ...attrs,
              isResolved: true,
            };

            if (correction.length > 0) {
              // 1. Replace text in range with correction
              tr.insertText(correction, targetFrom, targetTo);
              // 2. Apply resolved mark to the newly inserted correction
              const newMark = markType.create(updatedAttrs);
              tr.addMark(targetFrom, targetFrom + correction.length, newMark);
            } else {
              // If correction is empty, update the mark to resolved
              const newMark = markType.create(updatedAttrs);
              tr.addMark(targetFrom, targetTo, newMark);
            }

            dispatch(tr);
          }

          return true;
        },

      toggleAnnotationResolved:
        (errorId: string, isResolved?: boolean) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          let targetFrom = -1;
          let targetTo = -1;
          let targetAttrs: CriterionAnnotationAttributes | null = null;

          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type === markType && mark.attrs.errorId === errorId) {
                if (targetFrom === -1) {
                  targetFrom = pos;
                  targetAttrs = mark.attrs as CriterionAnnotationAttributes;
                }
                targetTo = pos + node.nodeSize;
              }
            });
          });

          if (targetFrom === -1 || targetTo === -1 || !targetAttrs) {
            return false;
          }

          const attrs: CriterionAnnotationAttributes = targetAttrs;
          const nextResolved =
            isResolved !== undefined ? isResolved : !attrs.isResolved;

          if (dispatch) {
            const updatedMark = markType.create({
              ...attrs,
              isResolved: nextResolved,
            });
            tr.removeMark(targetFrom, targetTo, markType);
            tr.addMark(targetFrom, targetTo, updatedMark);
            dispatch(tr);
          }

          return true;
        },

      updateCriterionAnnotation:
        (errorId: string, attributes: Partial<CriterionAnnotationAttributes>) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          let targetFrom = -1;
          let targetTo = -1;
          let targetAttrs: CriterionAnnotationAttributes | null = null;

          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type === markType && mark.attrs.errorId === errorId) {
                if (targetFrom === -1) {
                  targetFrom = pos;
                  targetAttrs = mark.attrs as CriterionAnnotationAttributes;
                }
                targetTo = pos + node.nodeSize;
              }
            });
          });

          if (targetFrom === -1 || targetTo === -1 || !targetAttrs) {
            return false;
          }

          const attrs: CriterionAnnotationAttributes = targetAttrs;
          if (dispatch) {
            const updatedMark = markType.create({
              ...attrs,
              ...attributes,
            });
            tr.removeMark(targetFrom, targetTo, markType);
            tr.addMark(targetFrom, targetTo, updatedMark);
            dispatch(tr);
          }

          return true;
        },
    };
  },
});
