import { expect, it } from "bun:test";
import { calibrateHomeworkAssessment } from "./calibrate-homework-assessment";

it("accepts an exact Teacher and AI score match without modifications", () => {
  const result = calibrateHomeworkAssessment(
    {
      fluencyCoherence: 7,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 7,
      pronunciation: 7,
      overallBand: 7,
    },
    {
      status: "ready",
      scores: {
        fluencyAndCoherence: 7,
        lexicalResource: 7,
        grammaticalRangeAndAccuracy: 7,
        pronunciation: 7,
      },
      overallBand: 7,
    }
  );
  expect(result).toEqual({
    aiProposalAccepted: true,
    scoreDeltas: {
      fluencyCoherence: 0,
      lexicalResource: 0,
      grammaticalRangeAccuracy: 0,
      pronunciation: 0,
      overallBand: 0,
    },
    modifiedCriteria: [],
  });
});

const teacherScores = {
  fluencyCoherence: 7,
  lexicalResource: 7,
  grammaticalRangeAccuracy: 7,
  pronunciation: 7,
  overallBand: 7,
};
const proposal = {
  status: "ready" as const,
  scores: {
    fluencyAndCoherence: 7,
    lexicalResource: 7,
    grammaticalRangeAndAccuracy: 7,
    pronunciation: 7,
  },
  overallBand: 7,
};

it("accepts the overall boundary with one large criterion delta", () => {
  const result = calibrateHomeworkAssessment(teacherScores, {
    ...proposal,
    overallBand: 6.5,
    scores: { ...proposal.scores, fluencyAndCoherence: 6 },
  });
  expect(result.aiProposalAccepted).toBe(true);
  expect(result.scoreDeltas.fluencyCoherence).toBe(1);
  expect(result.scoreDeltas.overallBand).toBe(0.5);
  expect(result.modifiedCriteria).toEqual(["fluencyCoherence"]);
});

it("rejects two large deltas even when their signs cancel", () => {
  const result = calibrateHomeworkAssessment(teacherScores, {
    ...proposal,
    scores: { ...proposal.scores, fluencyAndCoherence: 6, lexicalResource: 8 },
  });
  expect(result.aiProposalAccepted).toBe(false);
  expect(result.scoreDeltas.lexicalResource).toBe(-1);
  expect(result.modifiedCriteria).toEqual([
    "fluencyCoherence",
    "lexicalResource",
  ]);
});

it("rejects an overall delta beyond the threshold in either direction", () => {
  for (const overallBand of [6, 8]) {
    expect(
      calibrateHomeworkAssessment(teacherScores, { ...proposal, overallBand })
        .aiProposalAccepted
    ).toBe(false);
  }
});

it("rounds signed deltas to one decimal without modifying the AI proposal", () => {
  const aiProposal = Object.freeze({
    ...proposal,
    overallBand: 7.26,
    scores: Object.freeze({ ...proposal.scores, pronunciation: 6.76 }),
  });
  const result = calibrateHomeworkAssessment(teacherScores, aiProposal);
  expect(result.scoreDeltas.pronunciation).toBe(0.2);
  expect(result.scoreDeltas.overallBand).toBe(-0.3);
  expect(aiProposal.scores.pronunciation).toBe(6.76);
});

it("uses manual calibration defaults for missing and non-ready AI proposals", () => {
  for (const aiProposal of [
    null,
    ...(["pending", "processing", "failed"] as const).map((status) => ({
      ...proposal,
      status,
    })),
  ]) {
    expect(calibrateHomeworkAssessment(teacherScores, aiProposal)).toEqual({
      aiProposalAccepted: false,
      scoreDeltas: {
        fluencyCoherence: 0,
        lexicalResource: 0,
        grammaticalRangeAccuracy: 0,
        pronunciation: 0,
        overallBand: 0,
      },
      modifiedCriteria: [],
    });
  }
});
