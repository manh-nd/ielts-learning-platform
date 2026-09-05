import type {
  AiAssessmentProposal,
  TeacherAssessment,
  EvaluationFeedback,
} from "./homework-types";

export interface HomeworkAssessmentCalibration {
  aiProposalAccepted: boolean;
  scoreDeltas: EvaluationFeedback["scoreDeltas"];
  modifiedCriteria: string[];
}

/** Teacher-minus-AI calibration under the pilot acceptance contract (§7.3). */
export function calibrateHomeworkAssessment(
  teacherScores: Readonly<
    Pick<
      TeacherAssessment,
      | "fluencyCoherence"
      | "lexicalResource"
      | "grammaticalRangeAccuracy"
      | "pronunciation"
      | "overallBand"
    >
  >,
  aiProposal: Readonly<
    Pick<AiAssessmentProposal, "status" | "scores" | "overallBand">
  > | null
): HomeworkAssessmentCalibration {
  let aiProposalAccepted = false;
  let scoreDeltas = {
    fluencyCoherence: 0,
    lexicalResource: 0,
    grammaticalRangeAccuracy: 0,
    pronunciation: 0,
    overallBand: 0,
  };
  const modifiedCriteria: string[] = [];

  if (aiProposal && aiProposal.status === "ready") {
    const aiScores = aiProposal.scores;
    const diffFc = Number(
      (teacherScores.fluencyCoherence - aiScores.fluencyAndCoherence).toFixed(1)
    );
    const diffLr = Number(
      (teacherScores.lexicalResource - aiScores.lexicalResource).toFixed(1)
    );
    const diffGra = Number(
      (
        teacherScores.grammaticalRangeAccuracy -
        aiScores.grammaticalRangeAndAccuracy
      ).toFixed(1)
    );
    const diffPr = Number(
      (teacherScores.pronunciation - aiScores.pronunciation).toFixed(1)
    );
    const diffOverall = Number(
      (teacherScores.overallBand - aiProposal.overallBand).toFixed(1)
    );

    scoreDeltas = {
      fluencyCoherence: diffFc,
      lexicalResource: diffLr,
      grammaticalRangeAccuracy: diffGra,
      pronunciation: diffPr,
      overallBand: diffOverall,
    };

    if (diffFc !== 0) modifiedCriteria.push("fluencyCoherence");
    if (diffLr !== 0) modifiedCriteria.push("lexicalResource");
    if (diffGra !== 0) modifiedCriteria.push("grammaticalRangeAccuracy");
    if (diffPr !== 0) modifiedCriteria.push("pronunciation");

    // Acceptance formula from speaking-pilot-acceptance-contract.md (§7.3):
    // |Teacher Overall - AI Overall| <= 0.5 AND at most 1 criterion has |delta| >= 1.0
    const largeDeltaCount = [diffFc, diffLr, diffGra, diffPr].filter(
      (d) => Math.abs(d) >= 1.0
    ).length;

    aiProposalAccepted = Math.abs(diffOverall) <= 0.5 && largeDeltaCount <= 1;
  }

  return { aiProposalAccepted, scoreDeltas, modifiedCriteria };
}
