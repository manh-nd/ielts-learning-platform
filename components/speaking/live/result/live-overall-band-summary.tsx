"use client";

import {
  SpeakingCriteriaScores,
  SpeakingCriteriaScorecard,
  SpeakingScorecardTraceInfo,
} from "@/components/speaking/review/speaking-criteria-scorecard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, FileCheck, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiveOverallBandSummaryProps {
  scores: SpeakingCriteriaScores;
  executiveSummary?: string;
  keyStrengths?: string[];
  priorityImprovements?: string[];
  candidateName?: string;
  testTitle?: string;
  traceMetadata?: SpeakingScorecardTraceInfo;
  className?: string;
}

export function getCefrMapping(band: number): {
  level: string;
  label: string;
  description: string;
} {
  if (band >= 8.5) {
    return {
      level: "C2",
      label: "Thành thạo tối ưu (Mastery)",
      description:
        "Có khả năng hiểu và diễn đạt một cách tự nhiên, cực kỳ lưu loát và chính xác.",
    };
  }
  if (band >= 7.0) {
    return {
      level: "C1",
      label: "Cao cấp (Effective Operational Proficiency)",
      description:
        "Sử dụng ngôn ngữ linh hoạt, diễn đạt tự nhiên không gượng ép trong môi trường học thuật.",
    };
  }
  if (band >= 5.5) {
    return {
      level: "B2",
      label: "Độc lập (Vantage)",
      description:
        "Có thể giao tiếp tương đối lưu loát với người bản ngữ, duy trì lập luận tốt.",
    };
  }
  if (band >= 4.0) {
    return {
      level: "B1",
      label: "Trung cấp (Threshold)",
      description:
        "Hiểu được các ý chính của lời nói chuẩn mực, tự tin xử lý hầu hết tình huống quen thuộc.",
    };
  }
  return {
    level: "A2",
    label: "Sơ cấp (Waystage)",
    description: "Giao tiếp trong các tình huống đơn giản hàng ngày.",
  };
}

export function LiveOverallBandSummary({
  scores,
  executiveSummary,
  keyStrengths = [],
  priorityImprovements = [],
  candidateName = "Thí sinh",
  testTitle = "IELTS Speaking Full Mock Test",
  traceMetadata,
  className,
}: LiveOverallBandSummaryProps) {
  const avg =
    (scores.fluencyAndCoherence +
      scores.lexicalResource +
      scores.grammaticalRangeAndAccuracy +
      scores.pronunciation) /
    4;
  const whole = Math.floor(avg);
  const frac = avg - whole;
  const overallBand =
    frac < 0.25 ? whole : frac < 0.75 ? whole + 0.5 : whole + 1.0;
  const cefr = getCefrMapping(overallBand);

  return (
    <div
      data-testid="live-overall-band-summary"
      className={cn("space-y-5", className)}
    >
      {/* Top Banner with CEFR Level */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border bg-gradient-to-r from-primary/10 via-primary/5 to-muted/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary font-bold text-xs"
            >
              {testTitle}
            </Badge>
            <Badge
              variant="secondary"
              className="text-xs font-semibold font-mono"
            >
              CEFR: {cefr.level}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Đánh giá tổng quát cho {candidateName} &bull; {cefr.label}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
              Khung Châu Âu
            </span>
            <p className="text-sm font-bold text-foreground">
              Level {cefr.level} ({cefr.label.split(" ")[0]})
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Criteria Scorecard */}
      <SpeakingCriteriaScorecard
        scores={scores}
        editable={false}
        traceMetadata={traceMetadata}
      />

      {/* Executive Summary Card */}
      {executiveSummary && (
        <Card className="shadow-xs border py-0 gap-0 overflow-hidden">
          <CardHeader className="p-4 border-b bg-muted/20 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>Nhận xét Tổng quan từ Giám khảo AI</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs text-foreground/90 leading-relaxed">
            {executiveSummary}
          </CardContent>
        </Card>
      )}

      {/* Strengths & Priority Improvements Grid */}
      {(keyStrengths.length > 0 || priorityImprovements.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Key Strengths */}
          {keyStrengths.length > 0 && (
            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs py-0 gap-0 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Điểm mạnh nổi bật (Key Strengths)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-foreground/90">
                  {keyStrengths.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Priority Improvements */}
          {priorityImprovements.length > 0 && (
            <Card className="border-rose-500/30 bg-rose-500/5 shadow-xs py-0 gap-0 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Điểm cần cải thiện (Priority Improvements)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-foreground/90">
                  {priorityImprovements.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
