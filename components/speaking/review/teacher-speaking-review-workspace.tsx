"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  SpeakingCriteriaScorecard,
  SpeakingCriteriaScores,
  SpeakingScorecardTraceInfo,
  SpeakingCriterionKey,
} from "./speaking-criteria-scorecard";
import { AudioWaveformVisualizer } from "@/components/speaking/audio-waveform-visualizer";
import { calculateIeltsOverallBand } from "@/lib/gemini/speaking-schema";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import {
  Play,
  Pause,
  RotateCcw,
  BookmarkPlus,
  CheckCircle2,
  Sparkles,
  Award,
  Mic,
  FileText,
  AlertCircle,
  TrendingUp,
  Tag,
  Trash2,
  ThumbsUp,
  Target,
} from "lucide-react";

export type SpeakingReviewStatus =
  "ai_proposal_available" | "in_review" | "approved" | "published";

export interface StudentReviewInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  classroomName: string;
  targetBand: number;
  submittedAt: string;
}

export interface SpeakingReviewAnnotationItem {
  id: string;
  partNumber: number;
  timestampSeconds: number;
  category: "pronunciation" | "grammar" | "lexical" | "fluency" | "general";
  originalQuote?: string;
  teacherComment: string;
  createdAt: string;
}

export interface SpeakingPartReviewData {
  partNumber: number;
  itemIndex: number;
  promptQuestion: string;
  cueCardBulletPoints?: string[];
  candidateTranscript: string;
  durationSeconds: number;
  audioUrl?: string;
  pronunciationNotes: Array<{
    word: string;
    expectedIpa: string;
    detectedIssue: string;
    timestampSeconds?: number;
    recommendation: string;
  }>;
  lexicalUpgrades: Array<{
    originalExpression: string;
    betterAlternative: string;
    bandLevel: string;
    contextExample: string;
  }>;
  grammarCorrections: Array<{
    originalPhrase: string;
    correctedPhrase: string;
    ruleViolated: string;
    explanation: string;
  }>;
}

export interface TeacherSpeakingReviewWorkspaceProps {
  student: StudentReviewInfo;
  assignmentTitle: string;
  parts: SpeakingPartReviewData[];
  aiScores: SpeakingCriteriaScores;
  traceMetadata?: SpeakingScorecardTraceInfo;
  initialAnnotations?: SpeakingReviewAnnotationItem[];
  initialExaminerSummary?: string;
  initialStrengths?: string[];
  initialImprovements?: string[];
  initialActionPlan?: string[];
  initialStatus?: SpeakingReviewStatus;
  onApprove?: (scores: SpeakingCriteriaScores, overallBand: number) => void;
  onPublish?: () => void;
  className?: string;
  "data-testid"?: string;
}

export function TeacherSpeakingReviewWorkspace({
  student,
  assignmentTitle,
  parts,
  aiScores,
  traceMetadata,
  initialAnnotations = [],
  initialExaminerSummary = "",
  initialStrengths = [],
  initialImprovements = [],
  initialActionPlan = [],
  initialStatus = "ai_proposal_available",
  onApprove,
  onPublish,
  className,
  "data-testid": testId = "teacher-speaking-review-workspace",
}: TeacherSpeakingReviewWorkspaceProps) {
  // Navigation & playback state
  const [activePartNumber, setActivePartNumber] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Review & scoring state
  const [status, setStatus] = useState<SpeakingReviewStatus>(initialStatus);
  const [teacherScores, setTeacherScores] = useState<SpeakingCriteriaScores>({
    ...aiScores,
  });
  const [annotations, setAnnotations] =
    useState<SpeakingReviewAnnotationItem[]>(initialAnnotations);

  // New annotation input form state
  const [newCommentText, setNewCommentText] = useState<string>("");
  const [newCommentCategory, setNewCommentCategory] = useState<
    "pronunciation" | "grammar" | "lexical" | "fluency" | "general"
  >("pronunciation");

  // Feedback form state
  const [examinerSummary, setExaminerSummary] = useState<string>(
    initialExaminerSummary
  );
  const [strengths] = useState<string[]>(initialStrengths);
  const [improvements] = useState<string[]>(initialImprovements);
  const [actionPlan] = useState<string[]>(initialActionPlan);

  const activePart = useMemo(() => {
    return (
      parts.find((p) => p.partNumber === activePartNumber) ||
      parts[0] || {
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "",
        candidateTranscript: "",
        durationSeconds: 0,
        pronunciationNotes: [],
        lexicalUpgrades: [],
        grammarCorrections: [],
      }
    );
  }, [parts, activePartNumber]);

  const activePartAnnotations = useMemo(() => {
    return annotations.filter((a) => a.partNumber === activePartNumber);
  }, [annotations, activePartNumber]);

  // Overall Band calculation
  const overallBand = useMemo(() => {
    return calculateIeltsOverallBand(
      teacherScores.fluencyAndCoherence,
      teacherScores.lexicalResource,
      teacherScores.grammaticalRangeAndAccuracy,
      teacherScores.pronunciation
    );
  }, [teacherScores]);

  // Handlers
  const handleSeek = useCallback((timeSeconds: number) => {
    setCurrentTime(timeSeconds);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handlePartChange = useCallback((partNumStr: string) => {
    setActivePartNumber(Number(partNumStr));
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleAddAnnotation = useCallback(() => {
    if (!newCommentText.trim()) return;
    const newAnnotation: SpeakingReviewAnnotationItem = {
      id: `annot_${Date.now()}`,
      partNumber: activePartNumber,
      timestampSeconds: Number(currentTime.toFixed(1)),
      category: newCommentCategory,
      teacherComment: newCommentText.trim(),
      createdAt: new Date().toISOString(),
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setNewCommentText("");
    if (status === "ai_proposal_available") {
      setStatus("in_review");
    }
  }, [
    newCommentText,
    newCommentCategory,
    activePartNumber,
    currentTime,
    status,
  ]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleAcceptAllAi = useCallback(() => {
    setTeacherScores({ ...aiScores });
  }, [aiScores]);

  const handleResetCriterionToAi = useCallback(
    (key: SpeakingCriterionKey) => {
      setTeacherScores((prev) => ({
        ...prev,
        [key]: aiScores[key],
      }));
    },
    [aiScores]
  );

  const handleApproveReview = useCallback(() => {
    setStatus("approved");
    onApprove?.(teacherScores, overallBand);
  }, [teacherScores, overallBand, onApprove]);

  const handlePublishReview = useCallback(() => {
    setStatus("published");
    onPublish?.();
  }, [onPublish]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, "0")}:${remainingSecs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground flex flex-col antialiased",
        className
      )}
      data-testid={testId}
    >
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
              {student.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  {student.name}
                </h1>
                <Badge variant="outline" className="text-xs font-normal">
                  {student.classroomName}
                </Badge>
                <Badge
                  className={cn(
                    "text-[11px] font-semibold",
                    status === "published"
                      ? "bg-emerald-700 text-white"
                      : status === "approved"
                        ? "bg-blue-700 text-white"
                        : "bg-amber-700 text-white"
                  )}
                >
                  {status === "published"
                    ? "Đã Công Bố"
                    : status === "approved"
                      ? "Đã Phê Duyệt"
                      : "Đang Chấm Bài"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assignmentTitle} • Mục tiêu: Band{" "}
                {student.targetBand.toFixed(1)} • Nộp lúc: {student.submittedAt}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {status !== "published" && (
              <Button
                variant={status === "approved" ? "outline" : "default"}
                onClick={handleApproveReview}
                className="gap-1.5 text-xs h-9 font-semibold"
                data-testid="approve-review-button"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {status === "approved" ? "Đã Phê Duyệt" : "Phê Duyệt Điểm"}
                </span>
              </Button>
            )}

            <Button
              variant={status === "published" ? "secondary" : "default"}
              onClick={handlePublishReview}
              disabled={status === "published"}
              className="gap-1.5 text-xs h-9 font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
              data-testid="publish-review-button"
            >
              <Award className="h-4 w-4" />
              <span>
                {status === "published"
                  ? "Đã Công Bố Kết Quả"
                  : "Công Bố Kết Quả Cho Học Viên"}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content: 2-Column Split Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Audio Waveform Player, Part Navigator, and Interactive Transcript */}
        <div className="lg:col-span-7 space-y-5">
          {/* Speaking Part Switcher */}
          <Card className="border shadow-xs py-0 gap-0 overflow-hidden">
            <CardHeader className="p-3.5 pb-3 border-b bg-muted/10">
              <Tabs
                value={activePartNumber.toString()}
                onValueChange={handlePartChange}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 w-full h-10">
                  <TabsTrigger
                    value="1"
                    className="text-xs font-semibold"
                    data-testid="tab-part-1"
                  >
                    Part 1: Introduction
                  </TabsTrigger>
                  <TabsTrigger
                    value="2"
                    className="text-xs font-semibold"
                    data-testid="tab-part-2"
                  >
                    Part 2: Cue Card
                  </TabsTrigger>
                  <TabsTrigger
                    value="3"
                    className="text-xs font-semibold"
                    data-testid="tab-part-3"
                  >
                    Part 3: Discussion
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Question / Prompt Info */}
              <div className="p-3.5 rounded-lg bg-muted/40 border text-sm space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5 text-primary font-semibold">
                    <Mic className="h-3.5 w-3.5" />
                    Part {activePart.partNumber} Prompt
                  </span>
                  <span>Thời lượng: {activePart.durationSeconds}s</span>
                </div>
                <p className="font-semibold text-foreground">
                  {activePart.promptQuestion}
                </p>
                {activePart.cueCardBulletPoints &&
                  activePart.cueCardBulletPoints.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-muted-foreground pt-1 space-y-0.5">
                      {activePart.cueCardBulletPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  )}
              </div>

              {/* Interactive Audio Waveform Player */}
              <div className="p-4 rounded-xl border bg-card/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">
                    {formatTime(currentTime)} /{" "}
                    {formatTime(activePart.durationSeconds)}
                  </span>

                  {/* Playback speed controls */}
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md text-[11px] font-mono">
                    {[0.8, 1.0, 1.2, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={cn(
                          "px-2 py-0.5 rounded transition-colors",
                          playbackSpeed === speed
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Waveform Canvas */}
                <div className="relative">
                  <AudioWaveformVisualizer
                    isLive={false}
                    audioDuration={activePart.durationSeconds}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    barCount={48}
                    height={56}
                    className="cursor-pointer rounded-lg bg-muted/30 border"
                  />

                  {/* Timestamp Pins on Waveform */}
                  {activePart.pronunciationNotes.map((note, idx) => {
                    const sec = note.timestampSeconds || 0;
                    const leftPct =
                      (sec / (activePart.durationSeconds || 1)) * 100;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSeek(sec)}
                        style={{
                          left: `${Math.min(95, Math.max(2, leftPct))}%`,
                        }}
                        aria-label={`Lỗi phát âm: ${note.word} tại ${formatTime(sec)}`}
                        className="absolute -top-2.5 -translate-x-1/2 p-1 rounded-full bg-purple-700 text-white shadow-md hover:scale-125 transition-transform"
                        title={`Lỗi phát âm: "${note.word}" tại ${formatTime(sec)}`}
                      >
                        <Tag className="h-2.5 w-2.5" />
                      </button>
                    );
                  })}
                </div>

                {/* Audio Controls (Play/Pause, Rewind, Quick Pin) */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleTogglePlay}
                      aria-label={isPlaying ? "Tạm dừng audio" : "Phát audio"}
                      className="h-9 w-9 p-0 rounded-full bg-primary text-primary-foreground"
                      data-testid="audio-play-pause-button"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSeek(0)}
                      aria-label="Phát lại từ đầu"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Phát lại từ đầu"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Add Pin Button */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById(
                          "annotation-input-box"
                        );
                        input?.focus();
                      }}
                      className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                      data-testid="pin-timestamp-button"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      <span>Ghim tại {formatTime(currentTime)}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Interactive Transcript */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Transcript & Phân Tích Lỗi Từng Câu
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Click vào từ có gạch chân để nghe lại mốc giây đó
                  </span>
                </div>

                <div className="p-4 rounded-lg border bg-muted/20 text-sm leading-relaxed space-y-3 font-sans">
                  <p className="text-foreground">
                    {activePart.candidateTranscript}
                  </p>
                </div>
              </div>

              {/* Specific AI Pronunciation & Grammar Highlights */}
              {activePart.pronunciationNotes.length > 0 && (
                <div className="p-3.5 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Lưu Ý Phát Âm Từ AI (Pronunciation Notes):
                  </span>
                  <div className="space-y-1.5">
                    {activePart.pronunciationNotes.map((note, idx) => (
                      <div
                        key={idx}
                        className="text-xs flex items-start justify-between bg-card/80 p-2 rounded border border-purple-100 dark:border-purple-900/30"
                      >
                        <div>
                          <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                            {note.word}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            (IPA: {note.expectedIpa})
                          </span>
                          <p className="text-foreground mt-0.5">
                            {note.detectedIssue} — {note.recommendation}
                          </p>
                        </div>
                        {note.timestampSeconds !== undefined && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleSeek(note.timestampSeconds || 0)
                            }
                            aria-label={`Nghe lại từ ${note.word} tại ${formatTime(note.timestampSeconds)}`}
                            className="h-6 px-1.5 text-[11px] font-mono text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                          >
                            {formatTime(note.timestampSeconds)}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form: Add Teacher Annotation */}
              <div className="p-3.5 rounded-lg border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BookmarkPlus className="h-3.5 w-3.5 text-primary" />
                    Ghim Nhận Xét của Giáo Viên Tại Mốc{" "}
                    {formatTime(currentTime)}
                  </span>
                  <select
                    value={newCommentCategory}
                    aria-label="Loại nhận xét"
                    onChange={(e) =>
                      setNewCommentCategory(
                        e.target
                          .value as SpeakingReviewAnnotationItem["category"]
                      )
                    }
                    className="text-xs bg-muted/50 border rounded px-2 py-1"
                    data-testid="annotation-category-select"
                  >
                    <option value="pronunciation">
                      Phát âm (Pronunciation)
                    </option>
                    <option value="lexical">Từ vựng (Lexical Resource)</option>
                    <option value="grammar">Ngữ pháp (Grammar)</option>
                    <option value="fluency">Lưu loát (Fluency)</option>
                    <option value="general">Khác (General)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    id="annotation-input-box"
                    type="text"
                    placeholder={`Nhập nhận xét cho mốc ${formatTime(currentTime)} (ví dụ: phát âm chưa chuẩn âm đuôi /s/)...`}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddAnnotation();
                    }}
                    className="flex-1 text-xs border rounded-md px-3 py-1.5 bg-background"
                    data-testid="annotation-input"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddAnnotation}
                    className="h-8 text-xs font-semibold"
                    data-testid="add-annotation-button"
                  >
                    Thêm Ghim
                  </Button>
                </div>

                {/* List of Teacher Annotations for this Part */}
                {activePartAnnotations.length > 0 && (
                  <div className="pt-2 space-y-1.5 border-t">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Các ghim đã tạo trong Part {activePartNumber}:
                    </span>
                    {activePartAnnotations.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs p-2 rounded bg-muted/30 border"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {formatTime(item.timestampSeconds)}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {item.teacherComment}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteAnnotation(item.id)}
                          aria-label="Xóa ghim"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Speaking 4-Criteria Scorecard & General Examiner Feedback */}
        <div className="lg:col-span-5 space-y-5">
          {/* 4-Criteria Assessment Scorecard */}
          <SpeakingCriteriaScorecard
            scores={teacherScores}
            aiProposalScores={aiScores}
            traceMetadata={traceMetadata}
            onScoresChange={(newScores) => setTeacherScores(newScores)}
            onAcceptAllAi={handleAcceptAllAi}
            onResetCriterionToAi={handleResetCriterionToAi}
            data-testid="speaking-scorecard-section"
          />

          {/* Examiner General Feedback & Action Plan */}
          <Card className="border shadow-xs py-0 gap-0 overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b bg-muted/20">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Nhận Xét Tổng Quan & Lộ Trình Luyện Tập
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Executive Summary */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Đánh giá tổng quan của Giám khảo:
                </label>
                <Textarea
                  value={examinerSummary}
                  onChange={(e) => setExaminerSummary(e.target.value)}
                  placeholder="Nhập nhận xét tổng quan về trình độ phản xạ và ngôn ngữ của học viên..."
                  className="text-xs min-h-[80px] resize-y"
                  data-testid="examiner-summary-textarea"
                />
              </div>

              {/* Strengths & Improvements */}
              {strengths.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Điểm mạnh nổi bật (Strengths):
                  </label>
                  <ul className="text-xs space-y-1.5 list-disc list-inside text-foreground bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                    {strengths.map((s, i) => (
                      <li key={i} className="leading-relaxed">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {improvements.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Điểm cần ưu tiên cải thiện (Priority Improvements):
                  </label>
                  <ul className="text-xs space-y-1.5 list-disc list-inside text-foreground bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40">
                    {improvements.map((imp, i) => (
                      <li key={i} className="leading-relaxed">
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Plan */}
              {actionPlan.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Lộ trình hành động 2 tuần đề xuất (AI Action Plan):
                  </label>
                  <ul className="text-xs space-y-1.5 list-disc list-inside text-foreground bg-muted/40 p-3 rounded-lg border">
                    {actionPlan.map((plan, i) => (
                      <li key={i} className="leading-relaxed">
                        {plan}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
