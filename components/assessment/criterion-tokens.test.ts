import { describe, it, expect } from "vitest";
import { SPEAKING_CRITERIA_META } from "@/components/speaking/review/speaking-criteria-scorecard";
import { CRITERION_META as WRITING_CRITERION_META } from "@/components/assessment/types";
import { CRITERION_META as REVIEW_CRITERION_META } from "@/components/review/types";
import { ANNOTATION_CATEGORY_TO_CRITERION } from "@/components/homework/teacher-review-cockpit";
import { bandScoreBadgeVariants } from "@/components/ui/band-score-badge";

describe("Issue #103 Semantic Token Consolidation", () => {
  describe("Writing Criterion Metadata Semantic Token Consolidation", () => {
    it("should ensure Writing criteria metadata consumes semantic criterion tokens without raw palette utilities", () => {
      const rawPaletteKeywords = ["emerald-", "amber-", "blue-", "rose-"];

      const ta = WRITING_CRITERION_META.TASK_ACHIEVEMENT;
      expect(ta.badgeBg).toContain("criterion-ta");
      expect(ta.bgLight).toContain("criterion-ta");
      expect(ta.border).toContain("criterion-ta");
      expect(ta.text).toContain("criterion-ta");

      const cc = WRITING_CRITERION_META.COHERENCE_COHESION;
      expect(cc.badgeBg).toContain("criterion-cc");
      expect(cc.bgLight).toContain("criterion-cc");
      expect(cc.border).toContain("criterion-cc");
      expect(cc.text).toContain("criterion-cc");

      const lr = WRITING_CRITERION_META.LEXICAL_RESOURCE;
      expect(lr.badgeBg).toContain("criterion-lr");
      expect(lr.bgLight).toContain("criterion-lr");
      expect(lr.border).toContain("criterion-lr");
      expect(lr.text).toContain("criterion-lr");

      const gra = WRITING_CRITERION_META.GRAMMATICAL_RANGE_ACCURACY;
      expect(gra.badgeBg).toContain("criterion-gra");
      expect(gra.bgLight).toContain("criterion-gra");
      expect(gra.border).toContain("criterion-gra");
      expect(gra.text).toContain("criterion-gra");

      // Verify no raw palette utilities exist across any Writing criterion metadata
      for (const info of Object.values(WRITING_CRITERION_META)) {
        const visualClasses = `${info.badgeBg} ${info.bgLight} ${info.bgDark} ${info.border} ${info.text} ${info.accentColor}`;
        for (const raw of rawPaletteKeywords) {
          expect(visualClasses).not.toContain(raw);
        }
      }
    });

    it("should ensure Review criteria metadata consumes semantic criterion tokens without raw palette utilities", () => {
      const rawPaletteKeywords = ["emerald-", "amber-", "blue-", "rose-"];

      const ta = REVIEW_CRITERION_META.TASK_ACHIEVEMENT;
      expect(ta.badgeBg).toContain("criterion-ta");
      expect(ta.bgLight).toContain("criterion-ta");
      expect(ta.border).toContain("criterion-ta");
      expect(ta.text).toContain("criterion-ta");

      const cc = REVIEW_CRITERION_META.COHERENCE_COHESION;
      expect(cc.badgeBg).toContain("criterion-cc");
      expect(cc.bgLight).toContain("criterion-cc");
      expect(cc.border).toContain("criterion-cc");
      expect(cc.text).toContain("criterion-cc");

      const lr = REVIEW_CRITERION_META.LEXICAL_RESOURCE;
      expect(lr.badgeBg).toContain("criterion-lr");
      expect(lr.bgLight).toContain("criterion-lr");
      expect(lr.border).toContain("criterion-lr");
      expect(lr.text).toContain("criterion-lr");

      const gra = REVIEW_CRITERION_META.GRAMMATICAL_RANGE_ACCURACY;
      expect(gra.badgeBg).toContain("criterion-gra");
      expect(gra.bgLight).toContain("criterion-gra");
      expect(gra.border).toContain("criterion-gra");
      expect(gra.text).toContain("criterion-gra");

      // Verify no raw palette utilities exist across any Review criterion metadata
      for (const info of Object.values(REVIEW_CRITERION_META)) {
        const visualClasses = `${info.badgeBg} ${info.bgLight} ${info.bgDark} ${info.border} ${info.text}`;
        for (const raw of rawPaletteKeywords) {
          expect(visualClasses).not.toContain(raw);
        }
      }
    });
  });

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
