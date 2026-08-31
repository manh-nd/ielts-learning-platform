"use client";

import {
  UnifiedCriteriaScorecard,
  UnifiedScorecardTraceInfo,
} from "@/components/shared/assessment/unified-criteria-scorecard";

export type SpeakingCriterionKey =
  | "fluencyAndCoherence"
  | "lexicalResource"
  | "grammaticalRangeAndAccuracy"
  | "pronunciation";

export interface SpeakingCriteriaScores {
  fluencyAndCoherence: number;
  lexicalResource: number;
  grammaticalRangeAndAccuracy: number;
  pronunciation: number;
}

export interface SpeakingCriterionMeta {
  key: SpeakingCriterionKey;
  label: string;
  short: string;
  vietnameseLabel: string;
  color: "emerald" | "blue" | "amber" | "purple";
  bgLight: string;
  border: string;
  text: string;
  badgeBg: string;
}

export const SPEAKING_CRITERIA_META: Record<
  SpeakingCriterionKey,
  SpeakingCriterionMeta
> = {
  fluencyAndCoherence: {
    key: "fluencyAndCoherence",
    label: "Fluency & Coherence",
    short: "FC",
    vietnameseLabel: "Độ trôi chảy & Mạch lạc",
    color: "emerald",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-700 text-white",
  },
  lexicalResource: {
    key: "lexicalResource",
    label: "Lexical Resource",
    short: "LR",
    vietnameseLabel: "Vốn từ vựng & Độ chuẩn xác",
    color: "blue",
    bgLight: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-700 text-white",
  },
  grammaticalRangeAndAccuracy: {
    key: "grammaticalRangeAndAccuracy",
    label: "Grammatical Range & Accuracy",
    short: "GRA",
    vietnameseLabel: "Ngữ pháp & Cấu trúc đa dạng",
    color: "amber",
    bgLight: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-700 text-white",
  },
  pronunciation: {
    key: "pronunciation",
    label: "Pronunciation",
    short: "PR",
    vietnameseLabel: "Phát âm & Ngữ điệu sóng âm",
    color: "purple",
    bgLight: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-500",
    text: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-700 text-white",
  },
};

export const SPEAKING_CRITERIA_ORDER: SpeakingCriterionKey[] = [
  "fluencyAndCoherence",
  "lexicalResource",
  "grammaticalRangeAndAccuracy",
  "pronunciation",
];

export type SpeakingScorecardTraceInfo = UnifiedScorecardTraceInfo;

export interface SpeakingCriteriaScorecardProps {
  scores: SpeakingCriteriaScores;
  aiProposalScores?: SpeakingCriteriaScores;
  traceMetadata?: SpeakingScorecardTraceInfo;
  editable?: boolean;
  showCefrBadge?: boolean;
  onScoresChange?: (
    newScores: SpeakingCriteriaScores,
    overallBand: number
  ) => void;
  onCriterionChange?: (criterion: SpeakingCriterionKey, score: number) => void;
  onAcceptAllAi?: () => void;
  onResetCriterionToAi?: (criterion: SpeakingCriterionKey) => void;
  className?: string;
  "data-testid"?: string;
}

export function SpeakingCriteriaScorecard({
  scores,
  aiProposalScores,
  traceMetadata,
  editable = false,
  showCefrBadge = false,
  onScoresChange,
  onCriterionChange,
  onAcceptAllAi,
  onResetCriterionToAi,
  className,
  "data-testid": testId = "speaking-criteria-scorecard",
}: SpeakingCriteriaScorecardProps) {
  return (
    <UnifiedCriteriaScorecard
      preset="speaking"
      scores={scores as unknown as Record<string, number>}
      aiProposalScores={aiProposalScores as unknown as Record<string, number>}
      traceMetadata={traceMetadata}
      editable={editable}
      showCefrBadge={showCefrBadge}
      onScoresChange={
        onScoresChange
          ? (s, o) => onScoresChange(s as unknown as SpeakingCriteriaScores, o)
          : undefined
      }
      onCriterionChange={
        onCriterionChange
          ? (k, val) => onCriterionChange(k as SpeakingCriterionKey, val)
          : undefined
      }
      onAcceptAllAi={onAcceptAllAi}
      onResetCriterionToAi={
        onResetCriterionToAi
          ? (k) => onResetCriterionToAi(k as SpeakingCriterionKey)
          : undefined
      }
      className={className}
      data-testid={testId}
    />
  );
}
