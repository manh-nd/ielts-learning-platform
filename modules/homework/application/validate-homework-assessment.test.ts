import { expect, it } from "bun:test";
import { validateHomeworkAssessment } from "./validate-homework-assessment";
import type { PublishAssessmentInput } from "./homework-inputs";

const input: PublishAssessmentInput = {
  fluencyCoherence: 7,
  lexicalResource: 6.5,
  grammaticalRangeAccuracy: 7,
  pronunciation: 6.5,
  overallFeedback: "  Teacher feedback  ",
  activeReviewDurationMs: 1000,
};

it("derives the official overall band and trims required Teacher feedback", () => {
  expect(validateHomeworkAssessment(input)).toMatchObject({
    overallBand: 7,
    overallFeedback: "Teacher feedback",
  });
  expect(
    validateHomeworkAssessment({
      ...input,
      fluencyCoherence: 6,
      grammaticalRangeAccuracy: 6,
    })
  ).toMatchObject({ overallBand: 6.5 });
});

it("rejects invalid input for every criterion using application validation errors", () => {
  for (const criterion of [
    "fluencyCoherence",
    "lexicalResource",
    "grammaticalRangeAccuracy",
    "pronunciation",
  ]) {
    for (const score of [
      undefined,
      null,
      "7",
      NaN,
      Infinity,
      -0.5,
      9.5,
      6.25,
    ]) {
      expect(() =>
        validateHomeworkAssessment({ ...input, [criterion]: score })
      ).toThrow(
        expect.objectContaining({ statusCode: 400, code: "VALIDATION_ERROR" })
      );
    }
  }
});

it("rejects missing, blank and non-string required feedback", () => {
  for (const overallFeedback of [undefined, null, "", "   ", 123]) {
    expect(() =>
      validateHomeworkAssessment({
        ...input,
        overallFeedback,
      } as PublishAssessmentInput)
    ).toThrow(expect.objectContaining({ statusCode: 400 }));
  }
});
