"use client";

import { useState, useRef } from "react";
import {
  CheckCircle2,
  Clock,
  ArrowLeft,
  RotateCcw,
  Volume2,
  Play,
  Pause,
  GraduationCap,
  Sparkles,
  HelpCircle,
  FileCheck2,
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
import { SpeakingTestConfig, SpeakingPracticeSubmissionData } from "./types";
import { formatDuration } from "../speaking-audio-recorder";

export interface SpeakingSubmissionConfirmedViewProps {
  config: SpeakingTestConfig;
  submissionData: SpeakingPracticeSubmissionData;
  classroomName?: string;
  teacherName?: string;
  onBackToDashboard?: () => void;
  onPracticeAgain?: () => void;
  className?: string;
}

export function SpeakingSubmissionConfirmedView({
  config,
  submissionData,
  classroomName = "IELTS Intensive Mastery",
  teacherName = "Giảng viên IELTS",
  onBackToDashboard,
  onPracticeAgain,
  className,
}: SpeakingSubmissionConfirmedViewProps) {
  const [playingQuestionId, setPlayingQuestionId] = useState<string | null>(
    null
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const allQuestions = [
    ...config.part1Questions,
    config.part2Question,
    ...config.part3Questions,
  ];

  const totalAnswered = Object.keys(submissionData.answers).length;

  const handleTogglePlayAudio = (questionId: string, audioUrl: string) => {
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

      audio.onended = () => setPlayingQuestionId(null);
      audio.onpause = () => setPlayingQuestionId(null);
    }
  };

  return (
    <Card
      data-testid="speaking-submission-confirmed-view"
      className={cn(
        "w-full max-w-4xl mx-auto shadow-md border py-0 gap-0 overflow-hidden",
        className
      )}
    >
      {/* Header Banner */}
      <CardHeader className="p-6 sm:p-8 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-muted/20 border-b space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold"
                >
                  <FileCheck2 className="w-3.5 h-3.5 mr-1" />
                  Đã nộp bài tập
                </Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  Homework Submission
                </Badge>
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1.5">
                Nộp Bài Tập Speaking Thành Công!
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                Bài làm của bạn đã được chuyển đến Giảng viên phụ trách để chấm
                điểm 4 tiêu chí và sửa lỗi chi tiết.
              </CardDescription>
            </div>
          </div>

          <Badge
            variant="outline"
            className="self-start sm:self-center bg-background/80 border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs py-1.5 px-3 font-medium shrink-0"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
            <span>Đang chờ Giáo viên chấm</span>
          </Badge>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-border/60">
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[11px] block">
              Bài tập / Chủ đề:
            </span>
            <span className="font-semibold text-foreground truncate block">
              {config.title}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[11px] block">
              Lớp học:
            </span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
              {classroomName}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[11px] block">
              Giáo viên chấm bài:
            </span>
            <span className="font-semibold text-foreground">{teacherName}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[11px] block">
              Tổng thời lượng nói:
            </span>
            <span className="font-mono font-semibold text-foreground">
              {formatDuration(submissionData.totalDurationSeconds)} (
              {totalAnswered}/{allQuestions.length} câu)
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Next Steps & Explanation Notice */}
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Quy trình Chấm điểm & Trả bài (Teacher-in-the-loop)</span>
          </div>
          <p className="text-foreground/90 leading-relaxed">
            Hệ thống AI đang tạo đề xuất chấm điểm sơ bộ bao gồm bảng điểm 4
            tiêu chí (FC, LR, GRA, PR) và ghi nhận các mốc thời gian phát âm cần
            lưu ý. Giáo viên phụ trách ({teacherName}) sẽ trực tiếp nghe lại bài
            nói, điều chỉnh điểm số và công bố kết quả chính thức.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-foreground/80 pt-1 font-medium">
            <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              Bạn sẽ nhận được thông báo ngay khi Giáo viên hoàn tất chấm bài và
              công bố kết quả trên Bảng điều khiển Học viên.
            </span>
          </div>
        </div>

        {/* Submitted Audio Responses Review List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              <span>Bản Ghi Âm Đã Nộp ({totalAnswered} file âm thanh)</span>
            </h4>
            <span className="text-xs text-muted-foreground">
              Bạn có thể nghe lại các câu trả lời của mình
            </span>
          </div>

          <div className="space-y-2">
            {allQuestions.map((q, idx) => {
              const answer = submissionData.answers[q.id];
              const isRecorded = !!answer;
              const isPlaying = playingQuestionId === q.id;

              return (
                <div
                  key={q.id}
                  data-testid={`submitted-audio-row-${q.id}`}
                  className={cn(
                    "p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all",
                    isRecorded ? "bg-card" : "bg-muted/30 border-dashed"
                  )}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-mono"
                      >
                        Part{" "}
                        {q.part === "part1" ? 1 : q.part === "part2" ? 2 : 3}
                      </Badge>
                      <span className="font-medium text-foreground line-clamp-1">
                        #{idx + 1}. {q.questionText}
                      </span>
                    </div>
                    {q.topic && (
                      <span className="text-xs text-muted-foreground font-medium block pl-1">
                        Chủ đề: {q.topic}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isRecorded ? (
                      <>
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs text-foreground"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(answer.durationSeconds)}
                        </Badge>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleTogglePlayAudio(q.id, answer.audioUrl)
                          }
                          className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
                          data-testid={`play-submitted-${q.id}`}
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="w-3 h-3 text-primary" />
                              <span>Dừng</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current text-primary" />
                              <span>Nghe lại</span>
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        Chưa ghi âm
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scratchpad Notes if Part 2 had notes */}
        {submissionData.part2Notes && (
          <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5 text-xs">
            <span className="font-semibold text-muted-foreground block">
              Ghi chú dàn ý Part 2 của bạn:
            </span>
            <pre className="p-2.5 rounded bg-background border font-mono text-[11px] whitespace-pre-wrap text-foreground">
              {submissionData.part2Notes}
            </pre>
          </div>
        )}
      </CardContent>

      {/* Footer Navigation */}
      <CardFooter className="p-4 sm:p-6 border-t bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        {onBackToDashboard && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onBackToDashboard}
            className="gap-1.5 text-xs font-semibold cursor-pointer w-full sm:w-auto"
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Bảng điều khiển Học viên</span>
          </Button>
        )}

        {onPracticeAgain && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPracticeAgain}
            className="gap-1.5 text-xs font-medium cursor-pointer w-full sm:w-auto"
            data-testid="practice-again-btn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Luyện thêm bài thi khác</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
