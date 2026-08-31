"use client";

import { useRef, useCallback, useState } from "react";
import {
  IeltsSpeakingEvaluationResult,
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";
import { RecordedAudioData, TranscriptItem } from "./types";
import {
  LiveWaveformAudioPlayer,
  LiveWaveformAudioPlayerHandle,
  LiveOverallBandSummary,
  LiveCriteriaBreakdown,
  LiveInteractiveTranscript,
  LivePart1PracticeFeedback,
} from "./result";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiveSpeakingResultViewProps {
  evaluationResult?: IeltsSpeakingEvaluationResult | null;
  practiceFeedback?: PracticeFeedback | null;
  traceMetadata?: SpeakingEvaluationTrace | null;
  isPracticeMode?: boolean;
  isLoading: boolean;
  error?: string | null;
  recordedAudio: RecordedAudioData | null;
  transcripts: TranscriptItem[];
  candidateName?: string;
  onRetryEvaluation?: () => void;
  onRestartTest: () => void;
  onBackToDashboard: () => void;
  className?: string;
}

export function LiveSpeakingResultView({
  evaluationResult,
  practiceFeedback,
  traceMetadata,
  isPracticeMode = false,
  isLoading,
  error,
  recordedAudio,
  transcripts,
  candidateName = "Thí sinh",
  onRetryEvaluation,
  onRestartTest,
  onBackToDashboard,
  className,
}: LiveSpeakingResultViewProps) {
  const audioPlayerRef = useRef<LiveWaveformAudioPlayerHandle | null>(null);
  const [currentAudioTime, setCurrentAudioTime] = useState<number>(0);

  // Synchronize click-to-seek from transcripts to audio player
  const handleSeekFromChild = useCallback((timeSeconds: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(timeSeconds, true);
    }
  }, []);

  // 1. Loading State
  if (isLoading) {
    return (
      <Card
        data-testid="live-speaking-result-loading"
        className={cn(
          "w-full max-w-4xl mx-auto p-12 text-center shadow-md",
          className
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-bounce" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-foreground">
              Đang phân tích & Chấm điểm...
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Hệ thống đang chuyển giọng nói thành văn bản và phân tích chi tiết
              4 tiêu chí chấm điểm IELTS (FC, LR, GRA, PR).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/30 px-3 py-1.5 rounded-md border">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>
              Mô hình: {traceMetadata?.modelUsed || "Gemini 2.5 Flash"}
            </span>
          </div>
        </div>
      </Card>
    );
  }

  // 2. Error / Empty State
  if (error || (!evaluationResult && !practiceFeedback)) {
    return (
      <Card
        data-testid="live-speaking-result-error"
        className={cn(
          "w-full max-w-4xl mx-auto p-8 shadow-md border-rose-500/30",
          className
        )}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">
              Không thể tải kết quả chấm điểm
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md">
              {error ||
                "Đã xảy ra sự cố khi xử lý chấm điểm tự động. Vui lòng thử lại."}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            {onRetryEvaluation && (
              <Button
                size="sm"
                onClick={onRetryEvaluation}
                data-testid="retry-evaluation-btn"
                className="gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử chấm điểm lại</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onRestartTest}
              className="cursor-pointer"
            >
              <span>Thi lại bài mới</span>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // 3. Part 1 Practice Feedback View
  if ((isPracticeMode || !evaluationResult) && practiceFeedback) {
    return (
      <LivePart1PracticeFeedback
        practiceFeedback={practiceFeedback}
        recordedAudio={recordedAudio}
        transcripts={transcripts}
        traceMetadata={traceMetadata}
        candidateName={candidateName}
        onRestartTest={onRestartTest}
        onBackToDashboard={onBackToDashboard}
        className={className}
      />
    );
  }

  // 4. Full Mock Test Result View
  if (!evaluationResult) return null;

  const { overallScorecard } = evaluationResult;
  const criteriaScores = overallScorecard.criteriaScores;
  const generalFeedback = overallScorecard.generalFeedback;
  const executiveSummary =
    generalFeedback?.executiveSummary ||
    overallScorecard.criteria.fluencyAndCoherence.summary;

  const keyStrengths =
    generalFeedback?.keyStrengths && generalFeedback.keyStrengths.length > 0
      ? generalFeedback.keyStrengths
      : [
          ...overallScorecard.criteria.fluencyAndCoherence.strengths,
          ...overallScorecard.criteria.lexicalResource.strengths,
        ].slice(0, 4);

  const priorityImprovements =
    generalFeedback?.priorityImprovements &&
    generalFeedback.priorityImprovements.length > 0
      ? generalFeedback.priorityImprovements
      : [
          ...overallScorecard.criteria.fluencyAndCoherence.weaknesses,
          ...overallScorecard.criteria.grammaticalRangeAndAccuracy.weaknesses,
        ].slice(0, 3);

  return (
    <div
      data-testid="live-speaking-result-view"
      className={cn("w-full max-w-4xl mx-auto space-y-6", className)}
    >
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          onClick={onBackToDashboard}
          data-testid="back-to-dashboard-btn"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Bảng điều khiển</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRestartTest}
            data-testid="restart-test-btn"
            className="gap-1.5 text-xs font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Luyện đề thi khác</span>
          </Button>
        </div>
      </div>

      {/* 1. Overall Scorecard & Band Summary */}
      <LiveOverallBandSummary
        scores={criteriaScores}
        executiveSummary={executiveSummary}
        keyStrengths={keyStrengths}
        priorityImprovements={priorityImprovements}
        candidateName={candidateName}
        testTitle="IELTS Speaking Full Mock Test"
        traceMetadata={traceMetadata || undefined}
      />

      {/* 2. Interactive Audio Waveform Player */}
      {recordedAudio && (
        <LiveWaveformAudioPlayer
          ref={audioPlayerRef}
          audioUrl={recordedAudio.url}
          audioBlob={recordedAudio.blob}
          durationSeconds={recordedAudio.durationSeconds}
          title="File Ghi âm Toàn Bộ Buổi Thi"
          subtitle="Sóng âm tương tác & nghe lại âm thanh giọng nói nguyên bản của bạn"
          onTimeUpdate={setCurrentAudioTime}
        />
      )}

      {/* 3. Detailed Criteria & Part Evaluations */}
      <LiveCriteriaBreakdown
        evaluationResult={evaluationResult}
        onSeekToTime={handleSeekFromChild}
      />

      {/* 4. Interactive Transcript Stream */}
      {transcripts.length > 0 && (
        <LiveInteractiveTranscript
          transcripts={transcripts}
          currentTimeSeconds={currentAudioTime}
          onSeekToTime={handleSeekFromChild}
          candidateName={candidateName}
        />
      )}
    </div>
  );
}
