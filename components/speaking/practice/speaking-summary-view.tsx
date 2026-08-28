"use client";

import { useState, useRef } from "react";
import {
  FileCheck,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Clock,
  Send,
  Loader2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SpeakingTestConfig,
  RecordedAnswerItem,
  SpeakingSuiteStep,
  SpeakingPracticeSubmissionData,
} from "./types";
import { formatDuration } from "../speaking-audio-recorder";

export interface SpeakingSummaryViewProps {
  config: SpeakingTestConfig;
  answers: Record<string, RecordedAnswerItem>;
  part2Notes?: string;
  onNavigateToQuestion: (
    step: SpeakingSuiteStep,
    questionIndex?: number
  ) => void;
  onSubmit: (data: SpeakingPracticeSubmissionData) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function SpeakingSummaryView({
  config,
  answers,
  part2Notes,
  onNavigateToQuestion,
  onSubmit,
  isSubmitting = false,
  className,
}: SpeakingSummaryViewProps) {
  const [playingQuestionId, setPlayingQuestionId] = useState<string | null>(
    null
  );
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Collect all questions
  const allQuestions = [
    ...config.part1Questions,
    config.part2Question,
    ...config.part3Questions,
  ];

  const totalAnswered = allQuestions.filter((q) => !!answers[q.id]).length;
  const isAllAnswered = totalAnswered === allQuestions.length;

  const totalSpeakingSeconds = Object.values(answers).reduce(
    (acc, cur) => acc + (cur.durationSeconds || 0),
    0
  );

  const handlePlayAudio = (questionId: string, audioUrl: string) => {
    if (playingQuestionId === questionId) {
      audioRef.current?.pause();
      setPlayingQuestionId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.play().catch(() => {});
      setPlayingQuestionId(questionId);

      audio.onended = () => {
        setPlayingQuestionId(null);
      };
      audio.onpause = () => {
        setPlayingQuestionId(null);
      };
    }
  };

  const handleFinalSubmit = () => {
    setIsConfirmSubmitOpen(false);
    onSubmit({
      testId: config.id,
      answers,
      part2Notes,
      totalDurationSeconds: totalSpeakingSeconds,
      submittedAt: new Date(),
    });
  };

  const renderPartGroup = (
    title: string,
    partStep: SpeakingSuiteStep,
    questions: typeof allQuestions
  ) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>{title}</span>
            <Badge variant="outline" className="text-[10px]">
              {questions.filter((q) => !!answers[q.id]).length}/
              {questions.length} Đã ghi âm
            </Badge>
          </h4>
        </div>

        <div className="space-y-2">
          {questions.map((q, idx) => {
            const answer = answers[q.id];
            const isRecorded = !!answer;
            const isPlaying = playingQuestionId === q.id;

            return (
              <div
                key={q.id}
                data-testid={`summary-question-row-${q.id}`}
                className={cn(
                  "p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                  isRecorded
                    ? "bg-card border-border/80"
                    : "bg-muted/30 border-dashed border-amber-500/40"
                )}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <p className="text-xs font-medium text-foreground line-clamp-1">
                      {q.questionText}
                    </p>
                  </div>
                  {q.topic && (
                    <span className="text-[10px] text-muted-foreground">
                      Chủ đề: {q.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isRecorded ? (
                    <>
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300"
                      >
                        <Clock className="w-3 h-3" />
                        {formatDuration(answer.durationSeconds)}
                      </Badge>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlayAudio(q.id, answer.audioUrl)}
                        className="h-7 px-2 text-xs"
                        data-testid={`play-summary-${q.id}`}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3 h-3 mr-1 text-primary" />
                            Dừng
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            Nghe
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigateToQuestion(partStep, idx)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Làm lại
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge
                        variant="outline"
                        className="text-amber-800 dark:text-amber-300 font-semibold border-amber-500/30 bg-amber-500/10 text-xs"
                      >
                        Chưa ghi âm
                      </Badge>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => onNavigateToQuestion(partStep, idx)}
                        className="h-7 px-2.5 text-xs"
                      >
                        Thu âm ngay
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card
      data-testid="speaking-summary-view"
      className={cn(
        "w-full shadow-sm border overflow-hidden py-0 gap-0",
        className
      )}
    >
      <CardHeader className="bg-muted/10 border-b p-4 sm:p-5 pb-4 sm:pb-5 sm:[.border-b]:pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-bold text-foreground">
                Tổng Kết Bài Thi Speaking
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Kiểm tra lại toàn bộ file ghi âm các phần trước khi gửi chấm điểm
              AI & Giáo viên
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-mono py-1 px-2.5 bg-background"
            >
              <Clock className="w-3.5 h-3.5 mr-1 text-primary" />
              Tổng thời lượng: {formatDuration(totalSpeakingSeconds)}
            </Badge>
            <Badge
              className={cn(
                "text-xs py-1 px-2.5 font-semibold",
                isAllAnswered
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-amber-700 hover:bg-amber-800 text-white"
              )}
            >
              {totalAnswered}/{allQuestions.length} Câu hoàn thành
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-6">
        {!isAllAnswered && (
          <Alert variant="warning" className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <AlertTitle className="font-semibold text-xs text-amber-900 dark:text-amber-200">
                Bạn còn câu hỏi chưa hoàn thành ghi âm!
              </AlertTitle>
              <AlertDescription className="text-amber-900/90 dark:text-amber-200/90 font-medium">
                Hãy thu âm đầy đủ các câu hỏi để bài thi được đánh giá trọn vẹn
                4 tiêu chí IELTS Speaking.
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Part 1 Group */}
        {renderPartGroup(
          "Part 1: Phỏng Vấn Chung",
          "part1",
          config.part1Questions
        )}

        {/* Part 2 Group */}
        {renderPartGroup("Part 2: Cue Card (Long Turn)", "part2", [
          config.part2Question,
        ])}

        {/* Part 2 Scratchpad Notes Summary */}
        {part2Notes && part2Notes.trim().length > 0 && (
          <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              Ghi chú nháp Part 2 của bạn:
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground bg-background p-2.5 rounded border">
              {part2Notes}
            </pre>
          </div>
        )}

        {/* Part 3 Group */}
        {renderPartGroup(
          "Part 3: Thảo Luận Mở Rộng",
          "part3",
          config.part3Questions
        )}
      </CardContent>

      <CardFooter className="p-4 sm:p-5 pt-3.5 sm:pt-4 sm:[.border-t]:pt-4 border-t bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Sẵn sàng nộp bài để nhận band score chi tiết và sửa lỗi phát âm từ AI.
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={() => setIsConfirmSubmitOpen(true)}
            disabled={isSubmitting || totalAnswered === 0}
            className="w-full sm:w-auto font-semibold"
            data-testid="submit-speaking-test-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang nộp bài...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Nộp bài Chấm điểm ({totalAnswered}/{allQuestions.length})
              </>
            )}
          </Button>
        </div>
      </CardFooter>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmSubmitOpen} onOpenChange={setIsConfirmSubmitOpen}>
        <DialogContent data-testid="confirm-submit-dialog">
          <DialogHeader>
            <DialogTitle>Xác nhận nộp bài thi IELTS Speaking?</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ tải lên {totalAnswered} file ghi âm (
              {formatDuration(totalSpeakingSeconds)}) và kích hoạt chấm điểm tự
              động 4 tiêu chí chuẩn IELTS.
              {!isAllAnswered && (
                <span className="block mt-2 font-medium text-amber-600 dark:text-amber-400">
                  Lưu ý: Bạn còn {allQuestions.length - totalAnswered} câu chưa
                  thu âm.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmSubmitOpen(false)}
            >
              Hủy, xem lại tiếp
            </Button>
            <Button
              variant="default"
              onClick={handleFinalSubmit}
              data-testid="confirm-final-submit-btn"
            >
              Xác nhận nộp bài
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
