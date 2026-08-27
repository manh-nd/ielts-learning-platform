"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Volume2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  SpeakingTestConfig,
  SpeakingSuiteStep,
  SpeakingQuestionItem,
  RecordedAnswerItem,
  SpeakingPracticeSubmissionData,
  Part2State,
} from "./types";
import { SpeakingPartNavigator } from "./speaking-part-navigator";
import { SpeakingCueCard } from "./speaking-cue-card";
import { SpeakingScratchpad } from "./speaking-scratchpad";
import { SpeakingSummaryView } from "./speaking-summary-view";
import { AudioWaveformVisualizer } from "../audio-waveform-visualizer";
import { useAudioRecorder } from "../use-audio-recorder";
import { formatDuration } from "../speaking-audio-recorder";

export interface SpeakingPracticeSuiteProps {
  config: SpeakingTestConfig;
  initialStep?: SpeakingSuiteStep;
  mockMode?: boolean;
  fastPrepTimer?: boolean; // For testing, 5s instead of 60s
  onSubmit?: (data: SpeakingPracticeSubmissionData) => void;
  className?: string;
}

export function SpeakingPracticeSuite({
  config,
  initialStep = "part1",
  mockMode = false,
  fastPrepTimer = false,
  onSubmit,
  className,
}: SpeakingPracticeSuiteProps) {
  // Navigation State
  const [currentStep, setCurrentStep] =
    useState<SpeakingSuiteStep>(initialStep);
  const [part1Index, setPart1Index] = useState(0);
  const [part3Index, setPart3Index] = useState(0);

  // Stored Answers
  const [answers, setAnswers] = useState<Record<string, RecordedAnswerItem>>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Part 2 Specific State
  const [part2State, setPart2State] = useState<Part2State>("ready");
  const defaultPrepSeconds = fastPrepTimer
    ? 5
    : config.part2Question.prepTimeSeconds || 60;
  const [prepSecondsRemaining, setPrepSecondsRemaining] =
    useState(defaultPrepSeconds);
  const [part2Notes, setPart2Notes] = useState("");
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Prompt Player (Examiner voice)
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);
  const promptAudioRef = useRef<HTMLAudioElement | null>(null);

  // Active question resolution
  const getCurrentQuestion = (): SpeakingQuestionItem => {
    if (currentStep === "part1") {
      return config.part1Questions[part1Index] || config.part1Questions[0];
    }
    if (currentStep === "part2") {
      return config.part2Question;
    }
    if (currentStep === "part3") {
      return config.part3Questions[part3Index] || config.part3Questions[0];
    }
    return config.part1Questions[0];
  };

  const currentQuestion = getCurrentQuestion();
  const maxDurationSeconds =
    currentStep === "part2" ? 120 : currentQuestion?.maxDurationSeconds || 45;

  // Real Audio Recorder Hook (for non-mock or fallback)
  const {
    status: realRecorderStatus,
    duration: realDuration,
    analyserNode,
    startRecording: startRealRecording,
    stopRecording: stopRealRecording,
    resetRecording: resetRealRecording,
  } = useAudioRecorder({
    maxDurationSeconds,
    onRecordingComplete: (blob, duration) => {
      const url = URL.createObjectURL(blob);
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          part: currentQuestion.part,
          blob,
          audioUrl: url,
          durationSeconds: duration,
          recordedAt: new Date(),
        },
      }));
      if (currentStep === "part2") {
        setPart2State("reviewing");
      }
    },
    onMaxDurationReached: () => {
      handleStopRecording();
    },
  });

  // Mock Recording Simulation State (for Storybook & tests)
  const [mockRecordingDuration, setMockRecordingDuration] = useState(0);
  const [isMockRecording, setIsMockRecording] = useState(false);
  const mockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isRecording = mockMode
    ? isMockRecording
    : realRecorderStatus === "recording";
  const activeDuration = mockMode ? mockRecordingDuration : realDuration;

  // Reviewing audio for current question
  const currentAnswer = answers[currentQuestion.id];
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to stop recording and capture blob
  const handleStopRecording = () => {
    if (mockMode) {
      if (mockTimerRef.current) {
        clearInterval(mockTimerRef.current);
        mockTimerRef.current = null;
      }
      setIsMockRecording(false);
      const mockBlob = new Blob(["mock-ielts-audio-data"], {
        type: "audio/webm",
      });
      const mockUrl = URL.createObjectURL(mockBlob);
      const recordedDuration = Math.max(1, mockRecordingDuration || 15);

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          part: currentQuestion.part,
          blob: mockBlob,
          audioUrl: mockUrl,
          durationSeconds: recordedDuration,
          recordedAt: new Date(),
        },
      }));

      if (currentStep === "part2") {
        setPart2State("reviewing");
      }
    } else {
      stopRealRecording();
    }
  };

  // Helper to start recording
  const handleStartRecording = async () => {
    if (mockMode) {
      setIsMockRecording(true);
      setMockRecordingDuration(0);
      mockTimerRef.current = setInterval(() => {
        setMockRecordingDuration((prev) => {
          if (prev + 1 >= maxDurationSeconds) {
            handleStopRecording();
            return maxDurationSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      await startRealRecording();
    }
  };

  // Keep ref to handleStartRecording for timer transitions
  const startRecordingRef = useRef(handleStartRecording);
  useEffect(() => {
    startRecordingRef.current = handleStartRecording;
  });

  // Part 2 Prep Countdown Logic
  useEffect(() => {
    if (currentStep === "part2" && part2State === "preparing") {
      prepTimerRef.current = setInterval(() => {
        setPrepSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (prepTimerRef.current) clearInterval(prepTimerRef.current);
            // Transition directly to speaking
            setPart2State("speaking");
            startRecordingRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (prepTimerRef.current) {
        clearInterval(prepTimerRef.current);
        prepTimerRef.current = null;
      }
    };
  }, [currentStep, part2State]);

  const handleStartPart2Prep = () => {
    setPrepSecondsRemaining(defaultPrepSeconds);
    setPart2State("preparing");
  };

  const handleSkipPart2Prep = () => {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    setPart2State("speaking");
    handleStartRecording();
  };

  const handleReRecordPart2 = () => {
    setPart2State("ready");
    setPrepSecondsRemaining(defaultPrepSeconds);
    if (!mockMode) {
      resetRealRecording();
    }
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[config.part2Question.id];
      return next;
    });
  };

  // Re-record for Part 1 or Part 3
  const handleReRecordCurrent = () => {
    if (!mockMode) {
      resetRealRecording();
    }
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
  };

  // Navigation handlers
  const handleNextQuestion = () => {
    if (currentStep === "part1") {
      if (part1Index < config.part1Questions.length - 1) {
        setPart1Index((prev) => prev + 1);
        if (!mockMode) resetRealRecording();
      } else {
        setCurrentStep("part2");
      }
    } else if (currentStep === "part2") {
      setCurrentStep("part3");
    } else if (currentStep === "part3") {
      if (part3Index < config.part3Questions.length - 1) {
        setPart3Index((prev) => prev + 1);
        if (!mockMode) resetRealRecording();
      } else {
        setCurrentStep("summary");
      }
    }
  };

  const handlePrevQuestion = () => {
    if (currentStep === "part1" && part1Index > 0) {
      setPart1Index((prev) => prev - 1);
    } else if (currentStep === "part3" && part3Index > 0) {
      setPart3Index((prev) => prev - 1);
    }
  };

  const handleTogglePromptAudio = () => {
    if (!promptAudioRef.current) return;
    if (isPlayingPrompt) {
      promptAudioRef.current.pause();
      setIsPlayingPrompt(false);
    } else {
      promptAudioRef.current.play().catch(() => {});
      setIsPlayingPrompt(true);
    }
  };

  const handleTogglePreviewAudio = (audioUrl: string) => {
    if (previewPlaying) {
      previewAudioRef.current?.pause();
      setPreviewPlaying(false);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.play().catch(() => {});
      setPreviewPlaying(true);
      audio.onended = () => setPreviewPlaying(false);
      audio.onpause = () => setPreviewPlaying(false);
    }
  };

  const handleSubmitAll = async (data: SpeakingPracticeSubmissionData) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="speaking-practice-suite"
      className={cn("w-full max-w-4xl mx-auto space-y-4", className)}
    >
      {/* Header Navigator */}
      <SpeakingPartNavigator
        currentStep={currentStep}
        onStepChange={(step) => {
          if (!isRecording) {
            setCurrentStep(step);
          }
        }}
        config={config}
        answers={answers}
        isRecording={isRecording}
      />

      {/* Main Content Area */}
      {currentStep === "summary" ? (
        <SpeakingSummaryView
          config={config}
          answers={answers}
          part2Notes={part2Notes}
          onNavigateToQuestion={(step, idx) => {
            setCurrentStep(step);
            if (step === "part1" && typeof idx === "number") setPart1Index(idx);
            if (step === "part3" && typeof idx === "number") setPart3Index(idx);
          }}
          onSubmit={handleSubmitAll}
          isSubmitting={isSubmitting}
        />
      ) : currentStep === "part2" ? (
        /* PART 2 CUE CARD WORKFLOW */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Cue Card Display (Left / Full) */}
            <div className="md:col-span-7 space-y-4">
              <SpeakingCueCard question={config.part2Question} />

              {/* Part 2 Action Control Card */}
              <Card className="border shadow-sm overflow-hidden p-0 py-0 gap-0">
                <CardHeader className="px-5 py-3.5 [.border-b]:pb-3.5 bg-muted/20 border-b flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-xs font-bold text-foreground">
                      Trạng thái Part 2
                    </CardTitle>
                    <Badge
                      variant={
                        part2State === "speaking"
                          ? "destructive"
                          : part2State === "preparing"
                            ? "default"
                            : part2State === "reviewing"
                              ? "secondary"
                              : "outline"
                      }
                      className="text-xs uppercase font-semibold"
                    >
                      {part2State === "ready" && "Chưa bắt đầu"}
                      {part2State === "preparing" && "Đang chuẩn bị"}
                      {part2State === "speaking" && "Đang ghi âm (2 phút)"}
                      {part2State === "reviewing" && "Đã hoàn thành nói"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* State 1: Ready to start prep */}
                  {part2State === "ready" && (
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          Bạn có 1 phút để chuẩn bị & ghi chú
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                          Sử dụng bảng ghi chú bên cạnh để lập dàn ý. Sau khi
                          hết 1 phút, hệ thống sẽ tự động bắt đầu ghi âm bài nói
                          2 phút của bạn.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <Button
                          type="button"
                          variant="default"
                          onClick={handleStartPart2Prep}
                          className="font-semibold"
                          data-testid="start-part2-prep-btn"
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          Bắt đầu 1 Phút Chuẩn Bị
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSkipPart2Prep}
                          data-testid="skip-part2-prep-btn"
                        >
                          Bỏ qua, nói ngay
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* State 2: 1-min Preparing Countdown */}
                  {part2State === "preparing" && (
                    <div className="text-center space-y-3">
                      <div
                        className={cn(
                          "w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center mx-auto font-mono transition-colors",
                          prepSecondsRemaining <= 10
                            ? "border-destructive text-destructive bg-destructive/10 animate-pulse"
                            : "border-primary text-primary bg-primary/5"
                        )}
                      >
                        <span className="text-2xl font-black">
                          {prepSecondsRemaining}s
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          Chuẩn bị
                        </span>
                      </div>

                      <Progress
                        value={
                          (1 - prepSecondsRemaining / defaultPrepSeconds) * 100
                        }
                        className="h-2 max-w-xs mx-auto"
                      />

                      <p className="text-xs text-muted-foreground">
                        {prepSecondsRemaining <= 10
                          ? "Sắp hết thời gian chuẩn bị! Chuẩn bị bật mic..."
                          : "Hãy ghi chú nhanh các ý chính vào bảng bên phải."}
                      </p>

                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={handleSkipPart2Prep}
                          data-testid="start-part2-speaking-now-btn"
                        >
                          <Mic className="w-3.5 h-3.5 mr-1.5" />
                          Bắt đầu nói ngay ({prepSecondsRemaining}s còn lại)
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* State 3: Speaking Long Turn (2 minutes) */}
                  {part2State === "speaking" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                          </span>
                          <span className="text-xs font-bold text-destructive uppercase tracking-wider">
                            Đang ghi âm IELTS Part 2 (Tối đa 2:00)
                          </span>
                        </div>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {formatDuration(activeDuration)} / 02:00
                        </span>
                      </div>

                      <Progress
                        value={(activeDuration / 120) * 100}
                        className="h-2"
                      />

                      <AudioWaveformVisualizer
                        analyserNode={analyserNode}
                        isLive={isRecording}
                        height={60}
                      />

                      <div className="flex items-center justify-center pt-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="default"
                          onClick={handleStopRecording}
                          className="font-semibold"
                          data-testid="stop-part2-speaking-btn"
                        >
                          <Square className="w-4 h-4 mr-2 fill-current" />
                          Dừng & Hoàn thành bài nói
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* State 4: Reviewing recording */}
                  {part2State === "reviewing" && currentAnswer && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              Đã thu âm xong IELTS Part 2
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Thời lượng bài nói:{" "}
                              {formatDuration(currentAnswer.durationSeconds)}
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleTogglePreviewAudio(currentAnswer.audioUrl)
                          }
                          data-testid="play-part2-preview-btn"
                        >
                          {previewPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5 mr-1" />
                              Dừng nghe
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 mr-1" />
                              Nghe lại
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleReRecordPart2}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          data-testid="rerecord-part2-btn"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Thu âm lại Part 2
                        </Button>

                        <Button
                          type="button"
                          variant="default"
                          onClick={() => setCurrentStep("part3")}
                          className="font-semibold"
                          data-testid="advance-to-part3-btn"
                        >
                          Chuyển sang Part 3
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Scratchpad (Right column) */}
            <div className="md:col-span-5 flex flex-col">
              <SpeakingScratchpad
                value={part2Notes}
                onChange={setPart2Notes}
                isPrepPhase={part2State === "preparing"}
                className="h-full min-h-[320px]"
              />
            </div>
          </div>
        </div>
      ) : (
        /* PART 1 & PART 3 QUESTION-BY-QUESTION WORKFLOW */
        <div className="space-y-4">
          <Card className="border shadow-sm overflow-hidden p-0 py-0 gap-0">
            <CardHeader className="bg-muted/10 border-b px-5 py-3.5 [.border-b]:pb-3.5 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold uppercase"
                  >
                    {currentStep === "part1" ? "IELTS Part 1" : "IELTS Part 3"}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    Câu hỏi{" "}
                    {currentStep === "part1"
                      ? `${part1Index + 1} / ${config.part1Questions.length}`
                      : `${part3Index + 1} / ${config.part3Questions.length}`}
                  </span>
                </div>

                {currentQuestion.topic && (
                  <Badge variant="secondary" className="text-[11px]">
                    Chủ đề: {currentQuestion.topic}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Question Text & Prompt Player */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                    {currentQuestion.questionText}
                  </h3>

                  {currentQuestion.audioPromptUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTogglePromptAudio}
                      className="shrink-0 text-xs"
                      data-testid="play-examiner-prompt-btn"
                    >
                      <Volume2
                        className={cn(
                          "w-4 h-4 mr-1",
                          isPlayingPrompt && "text-primary animate-pulse"
                        )}
                      />
                      {isPlayingPrompt ? "Đang phát..." : "Nghe đề"}
                    </Button>
                  )}
                </div>

                {currentQuestion.audioPromptUrl && (
                  <audio
                    ref={promptAudioRef}
                    src={currentQuestion.audioPromptUrl}
                    onEnded={() => setIsPlayingPrompt(false)}
                    className="hidden"
                  />
                )}
              </div>

              {/* Recording Station */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
                {/* Visualizer & Timer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isRecording ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                        <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-ping" />
                        Đang ghi âm...
                      </span>
                    ) : currentAnswer ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Đã thu âm (
                        {formatDuration(currentAnswer.durationSeconds)})
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sẵn sàng ghi âm câu trả lời (Gợi ý: 20 - 40 giây)
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-xs font-semibold text-foreground">
                    {formatDuration(activeDuration)} /{" "}
                    {formatDuration(maxDurationSeconds)}
                  </span>
                </div>

                <AudioWaveformVisualizer
                  analyserNode={analyserNode}
                  isLive={isRecording}
                  height={56}
                />

                {/* Recorder Control Buttons */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  {!isRecording && !currentAnswer && (
                    <Button
                      type="button"
                      variant="default"
                      size="default"
                      onClick={handleStartRecording}
                      className="font-semibold shadow-sm"
                      data-testid="start-question-record-btn"
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Bắt đầu Ghi âm
                    </Button>
                  )}

                  {isRecording && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="default"
                      onClick={handleStopRecording}
                      className="font-semibold shadow-sm animate-pulse"
                      data-testid="stop-question-record-btn"
                    >
                      <Square className="w-4 h-4 mr-2 fill-current" />
                      Dừng ghi âm
                    </Button>
                  )}

                  {!isRecording && currentAnswer && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleTogglePreviewAudio(currentAnswer.audioUrl)
                        }
                        data-testid="play-question-preview-btn"
                      >
                        {previewPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5 mr-1" />
                            Dừng nghe
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Nghe lại (
                            {formatDuration(currentAnswer.durationSeconds)})
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleReRecordCurrent}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        data-testid="rerecord-question-btn"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Ghi âm lại
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="px-5 py-3.5 [.border-t]:pt-3.5 border-t bg-muted/10 flex flex-row items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrevQuestion}
                disabled={
                  (currentStep === "part1" && part1Index === 0) ||
                  (currentStep === "part3" && part3Index === 0) ||
                  isRecording
                }
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Câu trước
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleNextQuestion}
                  disabled={isRecording}
                  data-testid="next-speaking-question-btn"
                >
                  {currentStep === "part1" &&
                  part1Index === config.part1Questions.length - 1
                    ? "Chuyển sang Part 2 (Cue Card)"
                    : currentStep === "part3" &&
                        part3Index === config.part3Questions.length - 1
                      ? "Xem Tổng Kết & Nộp Bài"
                      : "Câu tiếp theo"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
