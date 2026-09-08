import { describe, it, expect } from "vitest";
import { SPEAKING_CRITERIA_META } from "@/components/speaking/review/speaking-criteria-scorecard";
import { CRITERION_META as WRITING_CRITERION_META } from "@/components/assessment/types";
import { ANNOTATION_CATEGORY_TO_CRITERION } from "@/components/homework/teacher-review-cockpit";
import { bandScoreBadgeVariants } from "@/components/ui/band-score-badge";

describe("Issue #103 Semantic Token Consolidation", () => {
  describe("Fluency & Coherence (FC) Criterion Independence", () => {
    it("should assign distinct semantic CSS classes to FC that differ from CC (Coherence & Cohesion)", () => {
      const fcMeta = SPEAKING_CRITERIA_META.fluencyAndCoherence;
      const ccMeta = WRITING_CRITERION_META.COHERENCE_COHESION;

      expect(fcMeta.short).toBe("FC");
      expect(ccMeta.short).toBe("CC");

      // FC must use criterion-fc tokens, not criterion-cc tokens
      expect(fcMeta.bgLight).toContain("criterion-fc-bg");
      expect(fcMeta.bgLight).not.toContain("criterion-cc");
      expect(fcMeta.border).toContain("criterion-fc");
      expect(fcMeta.border).not.toContain("criterion-cc");
      expect(fcMeta.badgeClassName).toContain("criterion-fc");
      expect(fcMeta.badgeClassName).not.toContain("criterion-cc");
    });
  });

  describe("Speaking Review Annotation Category to Criterion Mapping", () => {
    it("should correctly map all 4 annotation categories to corresponding Speaking criteria", () => {
      expect(ANNOTATION_CATEGORY_TO_CRITERION.fluency).toBe(
        "fluencyAndCoherence"
      );
      expect(ANNOTATION_CATEGORY_TO_CRITERION.lexical).toBe("lexicalResource");
      expect(ANNOTATION_CATEGORY_TO_CRITERION.grammar).toBe(
        "grammaticalRangeAndAccuracy"
      );
      expect(ANNOTATION_CATEGORY_TO_CRITERION.pronunciation).toBe(
        "pronunciation"
      );
    });

    it("should provide valid badge class names for each mapped criterion", () => {
      for (const [, criterionKey] of Object.entries(
        ANNOTATION_CATEGORY_TO_CRITERION
      )) {
        const meta = SPEAKING_CRITERIA_META[criterionKey];
        expect(meta).toBeDefined();
        expect(meta.badgeClassName).toBeDefined();
        expect(meta.badgeClassName.length).toBeGreaterThan(0);
      }
    });
  });

  describe("BandScoreBadge Scale Sizes", () => {
    it("should support the xl size variant alongside sm, md, and lg", () => {
      const xlVariant = bandScoreBadgeVariants({ size: "xl" });
      const lgVariant = bandScoreBadgeVariants({ size: "lg" });
      const mdVariant = bandScoreBadgeVariants({ size: "md" });
      const smVariant = bandScoreBadgeVariants({ size: "sm" });

      expect(xlVariant).toBeDefined();
      expect(lgVariant).toBeDefined();
      expect(mdVariant).toBeDefined();
      expect(smVariant).toBeDefined();

      expect(xlVariant).toContain("h-9");
      expect(xlVariant).toContain("text-base");
    });
  });
});
