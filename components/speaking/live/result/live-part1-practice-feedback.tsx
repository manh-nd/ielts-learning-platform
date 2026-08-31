"use client";

import { useRef, useCallback } from "react";
import {
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import {
  LiveWaveformAudioPlayer,
  LiveWaveformAudioPlayerHandle,
} from "./live-waveform-audio-player";
import {
  LiveInteractiveTranscript,
  InteractiveTranscriptItem,
} from "./live-interactive-transcript";
import { RecordedAudioData } from "../types";
import { cn } from "@/lib/utils";

export interface LivePart1PracticeFeedbackProps {
  practiceFeedback: PracticeFeedback;
  recordedAudio: RecordedAudioData | null;
  transcripts?: InteractiveTranscriptItem[];
  traceMetadata?: SpeakingEvaluationTrace | null;
  candidateName?: string;
  onRestartTest?: () => void;
  onBackToDashboard?: () => void;
  className?: string;
}

export function LivePart1PracticeFeedback({
  practiceFeedback,
  recordedAudio,
  transcripts = [],
  traceMetadata,
  candidateName = "Thí sinh",
  onRestartTest,
  onBackToDashboard,
  className,
}: LivePart1PracticeFeedbackProps) {
  const audioPlayerRef = useRef<LiveWaveformAudioPlayerHandle | null>(null);

  const {
    evidenceSufficiency,
    estimatedPerformance,
    strengths = [],
    priorities = [],
    summary,
  } = practiceFeedback;

  const handleSeekToTranscriptTime = useCallback((timeSeconds: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seekTo(timeSeconds, true);
    }
  }, []);

  return (
    <div
      data-testid="live-part1-practice-feedback"
      className={cn("w-full max-w-4xl mx-auto space-y-6", className)}
    >
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        {onBackToDashboard && (
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
        )}

        {onRestartTest && (
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={onRestartTest}
              data-testid="restart-test-btn"
              className="gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Luyện đề khác</span>
            </Button>
          </div>
        )}
      </div>

      {/* Practice Feedback Header Banner */}
      <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-background to-muted/20 p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground text-xs font-bold">
              Luyện tập Speaking Part 1
            </Badge>
            <Badge variant="outline" className="text-xs font-semibold">
              Formative Coaching Feedback
            </Badge>
          </div>
          {traceMetadata && (
            <span className="text-[11px] font-mono text-muted-foreground">
              Mô hình: {traceMetadata.modelUsed} ({traceMetadata.durationMs}ms)
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Nhận xét phân tích câu trả lời IELTS Speaking Part 1 của bạn nhằm hỗ
          trợ cải thiện độ trôi chảy, từ vựng và ngữ pháp.
        </p>
      </div>

      {/* Estimated Criteria Performance if sufficient evidence */}
      {evidenceSufficiency === "sufficient_for_practice_feedback" &&
        estimatedPerformance && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 text-center border shadow-xs">
              <div className="text-[11px] text-muted-foreground font-semibold">
                Fluency & Coherence
              </div>
              <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                {estimatedPerformance.fluencyAndCoherence?.toFixed(1) || "N/A"}
              </div>
            </Card>
            <Card className="p-3 text-center border shadow-xs">
              <div className="text-[11px] text-muted-foreground font-semibold">
                Lexical Resource
              </div>
              <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1">
                {estimatedPerformance.lexicalResource?.toFixed(1) || "N/A"}
              </div>
            </Card>
            <Card className="p-3 text-center border shadow-xs">
              <div className="text-[11px] text-muted-foreground font-semibold">
                Grammar Range & Acc.
              </div>
              <div className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-1">
                {estimatedPerformance.grammaticalRangeAndAccuracy?.toFixed(1) ||
                  "N/A"}
              </div>
            </Card>
            <Card className="p-3 text-center border shadow-xs">
              <div className="text-[11px] text-muted-foreground font-semibold">
                Pronunciation
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                {estimatedPerformance.pronunciation?.toFixed(1) || "N/A"}
              </div>
            </Card>
          </div>
        )}

      {evidenceSufficiency === "limited" && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 text-xs text-amber-950 dark:text-amber-200">
          ⚠ <strong>Bằng chứng câu trả lời còn ngắn:</strong> Hãy kéo dài câu
          trả lời từ 2-3 câu có dẫn chứng để AI đánh giá chính xác hơn nhé!
        </Card>
      )}

      {/* Audio Waveform Player with Real Waveform & Seek */}
      {recordedAudio && (
        <LiveWaveformAudioPlayer
          ref={audioPlayerRef}
          audioUrl={recordedAudio.url}
          audioBlob={recordedAudio.blob}
          durationSeconds={recordedAudio.durationSeconds}
          title="Bản ghi âm Part 1 của bạn"
          subtitle="Sóng âm thực tế theo giọng nói & tua nghe lại từng câu"
        />
      )}

      {/* Coaching Summary Card */}
      <Card className="shadow-xs border overflow-hidden py-0 gap-0">
        <CardHeader className="p-4 border-b bg-muted/20 pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-primary" />
            <span>Nhận xét Hướng dẫn Sư phạm (Coaching Summary)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-xs text-foreground/90 leading-relaxed">
          {summary}
        </CardContent>
      </Card>

      {/* Strengths & Priorities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs overflow-hidden py-0 gap-0 h-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Điểm mạnh ghi nhận ({strengths.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2.5">
            {strengths.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Chưa ghi nhận điểm mạnh rõ nét do câu trả lời quá ngắn.
              </p>
            ) : (
              strengths.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-background/80 border space-y-1 text-xs"
                >
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono font-bold"
                  >
                    {pt.criterion}
                  </Badge>
                  <p className="font-medium text-foreground">
                    {pt.observation}
                  </p>
                  {pt.suggestion && (
                    <p className="text-[11px] text-muted-foreground">
                      💡 {pt.suggestion}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Priorities */}
        <Card className="border-rose-500/30 bg-rose-500/5 shadow-xs overflow-hidden py-0 gap-0 h-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-700 dark:text-rose-400" />
              <span>Ưu tiên cần khắc phục ({priorities.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2.5">
            {priorities.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Rất tốt! Không có lỗi nghiêm trọng cần khắc phục ngay.
              </p>
            ) : (
              priorities.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-background/80 border space-y-1 text-xs"
                >
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400"
                  >
                    {pt.criterion}
                  </Badge>
                  <p className="font-medium text-foreground">
                    {pt.observation}
                  </p>
                  {pt.suggestion && (
                    <p className="text-[11px] text-muted-foreground">
                      🎯 {pt.suggestion}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Interactive Transcript */}
      {transcripts.length > 0 && (
        <LiveInteractiveTranscript
          transcripts={transcripts}
          candidateName={candidateName}
          onSeekToTime={handleSeekToTranscriptTime}
        />
      )}
    </div>
  );
}
