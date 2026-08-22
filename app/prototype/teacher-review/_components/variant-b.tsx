"use client";

import React, { useState, useRef, Fragment } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  MOCK_ESSAY,
  MOCK_ESSAY_WORD_COUNT,
  MOCK_AI_SCORES,
  MOCK_AI_OVERALL,
  MOCK_AI_FEEDBACK,
  MOCK_AI_ERRORS,
  MOCK_AI_CRITERIA_DETAIL,
  MOCK_STUDENT,
  MOCK_HOMEWORK,
  CRITERION_META,
  CRITERIA_ORDER,
  BAND_OPTIONS,
  calculateOverallBand,
  type Criterion,
} from "../_data/mock";

const STEPS = [
  { id: "doc-bai", label: "Đọc bài" },
  { id: "xem-ai", label: "Xem AI" },
  { id: "cham-diem", label: "Chấm điểm" },
  { id: "duyet", label: "Duyệt" },
  { id: "cong-bo", label: "Công bố" },
];

export default function VariantB() {
  const [currentStep, setCurrentStep] = useState(0);

  // Teacher Assessment State
  const [teacherScores, setTeacherScores] =
    useState<Record<Criterion, number>>(MOCK_AI_SCORES);
  const [teacherNotes, setTeacherNotes] = useState<Record<Criterion, string>>({
    TASK_ACHIEVEMENT: "",
    COHERENCE_COHESION: "",
    LEXICAL_RESOURCE: "",
    GRAMMATICAL_RANGE_ACCURACY: "",
  });
  const [generalFeedback, setGeneralFeedback] = useState("");
  const [agreedErrors, setAgreedErrors] = useState<Record<string, boolean>>({});
  const [isApproved, setIsApproved] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const scrollToSection = (index: number) => {
    setCurrentStep(index);
    sectionRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Handle Accept All AI Scores
  const handleAcceptAllAIScores = () => {
    setTeacherScores({ ...MOCK_AI_SCORES });
    scrollToSection(2); // go to Chấm điểm
  };

  const teacherOverallBand = calculateOverallBand(teacherScores);

  // Highlight Essay
  const renderHighlightedEssay = () => {
    let lastIdx = 0;
    const elements: React.ReactNode[] = [];

    // sort errors by offsetStart
    const sortedErrors = [...MOCK_AI_ERRORS].sort(
      (a, b) => a.offsetStart - b.offsetStart
    );

    sortedErrors.forEach((error, idx) => {
      if (error.offsetStart >= lastIdx) {
        elements.push(
          <span key={`text-${idx}`}>
            {MOCK_ESSAY.slice(lastIdx, error.offsetStart)}
          </span>
        );
        const meta = CRITERION_META[error.criterion];

        elements.push(
          <Popover key={`error-${idx}`}>
            <PopoverTrigger render={<span />}>
              <span
                className={cn(
                  "cursor-pointer border-b-2 bg-opacity-30",
                  meta.bgLight,
                  meta.border
                )}
              >
                {MOCK_ESSAY.slice(error.offsetStart, error.offsetEnd)}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn(meta.bgLight)}>
                    {meta.short}
                  </Badge>
                  <span className="font-semibold">{error.category}</span>
                </div>
                <p className="text-sm">{error.explanation}</p>
                {error.suggestedCorrection && (
                  <div className="bg-muted p-2 rounded text-sm">
                    Gợi ý:{" "}
                    <span className="font-semibold text-emerald-600">
                      {error.suggestedCorrection}
                    </span>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
        lastIdx = error.offsetEnd;
      }
    });

    elements.push(<span key="text-end">{MOCK_ESSAY.slice(lastIdx)}</span>);

    return (
      <div className="text-base leading-relaxed whitespace-pre-wrap">
        {elements}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      {/* Sticky Stepper Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b shadow-sm p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-8 overflow-x-auto w-full justify-between">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === idx;
              const isCompleted =
                currentStep > idx ||
                (idx === 3 && isApproved) ||
                (idx === 4 && isPublished);

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap",
                    isActive
                      ? "text-primary font-medium"
                      : isCompleted
                        ? "text-primary/70"
                        : "text-muted-foreground"
                  )}
                  onClick={() => scrollToSection(idx)}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className="text-sm hidden sm:inline-block">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-12">
        {/* SECTION 1: Student Essay ("Đọc bài") */}
        <section
          ref={(el) => {
            sectionRefs.current[0] = el;
          }}
          className="scroll-mt-24 space-y-4"
        >
          <div className="flex items-center gap-2 text-2xl font-semibold mb-4">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded flex items-center justify-center text-lg">
              1
            </span>
            Đọc bài
          </div>
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {MOCK_HOMEWORK.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {MOCK_STUDENT.name} • {MOCK_STUDENT.class}
                  </CardDescription>
                </div>
                <Badge variant="outline">{MOCK_ESSAY_WORD_COUNT} words</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-6 relative">
                {/* Main Essay Area */}
                <div className="flex-1">
                  <div className="bg-muted/50 p-4 rounded-md mb-6 text-sm text-muted-foreground italic border-l-4 border-primary">
                    {MOCK_HOMEWORK.prompt}
                  </div>
                  {renderHighlightedEssay()}
                </div>

                {/* Gutter */}
                <div className="w-12 border-l pl-2 hidden md:flex flex-col gap-4 sticky top-24 h-[calc(100vh-200px)] overflow-y-auto">
                  {MOCK_AI_ERRORS.map((err, i) => {
                    const meta = CRITERION_META[err.criterion];
                    return (
                      <TooltipProvider key={i}>
                        <Tooltip>
                          <TooltipTrigger render={<div />}>
                            <div
                              className={cn(
                                "w-3 h-3 rounded-full cursor-pointer",
                                meta.bgLight,
                                meta.border,
                                "border"
                              )}
                            ></div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {err.category} ({meta.short})
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t flex justify-between text-xs text-muted-foreground">
              <span>Nộp lúc: 2026-08-20 14:30</span>
              <span>Lần nộp: 1</span>
            </CardFooter>
          </Card>
        </section>

        <Separator />

        {/* SECTION 2: AI Assessment Proposal ("Xem AI") */}
        <section
          ref={(el) => {
            sectionRefs.current[1] = el;
          }}
          className="scroll-mt-24 space-y-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-2xl font-semibold">
              <span className="bg-primary text-primary-foreground w-8 h-8 rounded flex items-center justify-center text-lg">
                2
              </span>
              Xem AI Đề Xuất
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Criteria Grid */}
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {CRITERIA_ORDER.map((crit) => {
                const meta = CRITERION_META[crit];
                const detail = MOCK_AI_CRITERIA_DETAIL[crit];
                const score = MOCK_AI_SCORES[crit];

                return (
                  <Card
                    key={crit}
                    className="border-l-4"
                    style={{ borderLeftColor: `var(--${meta.color}-500)` }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              meta.bgLight
                            )}
                          >
                            {meta.short}
                          </span>
                          {meta.label}
                        </CardTitle>
                        <span className="text-lg font-bold">
                          {score.toFixed(1)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3 pb-4">
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {detail.justification}
                      </p>

                      <div className="space-y-1">
                        <div className="font-medium text-xs flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" />{" "}
                          Strengths
                        </div>
                        <ul className="text-xs text-muted-foreground pl-4 list-disc space-y-0.5">
                          {detail.strengths.slice(0, 2).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium text-xs flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-500" />{" "}
                          Improvements
                        </div>
                        <ul className="text-xs text-muted-foreground pl-4 list-disc space-y-0.5">
                          {detail.improvements.slice(0, 2).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Right: Summary & Accept */}
            <div className="col-span-1 flex flex-col gap-4">
              <Card className="bg-primary/5 border-primary/20 flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Sparkles className="w-4 h-4" /> Tổng quan AI
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg border">
                    <span className="text-sm text-muted-foreground uppercase font-semibold">
                      Overall Band
                    </span>
                    <span className="text-5xl font-bold text-primary mt-1">
                      {MOCK_AI_OVERALL.toFixed(1)}
                    </span>
                  </div>

                  <div className="text-sm">
                    <p className="leading-relaxed">
                      {MOCK_AI_FEEDBACK.examiner_summary}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Lỗi phát hiện ({MOCK_AI_ERRORS.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CRITERIA_ORDER.map((crit) => {
                        const count = MOCK_AI_ERRORS.filter(
                          (e) => e.criterion === crit
                        ).length;
                        if (count === 0) return null;
                        const meta = CRITERION_META[crit];
                        return (
                          <Badge
                            key={crit}
                            variant="outline"
                            className={cn(meta.bgLight, "text-xs")}
                          >
                            {meta.short}: {count}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleAcceptAllAIScores}
                size="lg"
                className="w-full gap-2 text-md"
              >
                <Check className="w-4 h-4" /> Chấp nhận & Chấm điểm
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* SECTION 3: Teacher Assessment ("Chấm điểm") */}
        <section
          ref={(el) => {
            sectionRefs.current[2] = el;
          }}
          className="scroll-mt-24 space-y-6"
        >
          <div className="flex items-center gap-2 text-2xl font-semibold mb-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded flex items-center justify-center text-lg">
              3
            </span>
            Giáo Viên Chấm Điểm
          </div>
          <p className="text-muted-foreground">
            Kiểm tra và điều chỉnh điểm số, chọn các lỗi để thêm vào nhận xét.
          </p>

          <div className="space-y-6">
            {CRITERIA_ORDER.map((crit) => {
              const meta = CRITERION_META[crit];
              const aiScore = MOCK_AI_SCORES[crit];
              const currentScore = teacherScores[crit];
              const critErrors = MOCK_AI_ERRORS.filter(
                (e) => e.criterion === crit
              );

              return (
                <Card key={crit} className="overflow-hidden border">
                  <div className={cn("h-1.5 w-full", meta.bgLight)}></div>
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Left: Info & AI */}
                      <div className="flex-1 p-6 border-b md:border-b-0 md:border-r bg-muted/10">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className={meta.bgLight}>
                            {meta.short}
                          </Badge>
                          <h3 className="font-semibold text-lg">
                            {meta.label}
                          </h3>
                        </div>
                        <div className="bg-background border rounded p-3 text-sm space-y-2 mb-4">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>AI Đề xuất</span>
                            <span className="font-bold text-foreground">
                              {aiScore.toFixed(1)}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed">
                            {MOCK_AI_CRITERIA_DETAIL[crit].justification}
                          </p>
                        </div>

                        {critErrors.length > 0 && (
                          <div className="space-y-2 mt-4">
                            <span className="text-xs font-medium uppercase text-muted-foreground">
                              Lỗi phát hiện
                            </span>
                            <div className="space-y-2">
                              {critErrors.map((err) => (
                                <label
                                  key={err.errorId}
                                  className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={agreedErrors[err.errorId] || false}
                                    onChange={(e) =>
                                      setAgreedErrors((prev) => ({
                                        ...prev,
                                        [err.errorId]: e.target.checked,
                                      }))
                                    }
                                  />
                                  <div className="text-sm">
                                    <div className="font-medium text-xs">
                                      {err.category}
                                    </div>
                                    <div className="text-muted-foreground text-xs line-clamp-2">
                                      &quot;{err.originalQuote}&quot; -{" "}
                                      {err.explanation}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Teacher Input */}
                      <div className="w-full md:w-80 p-6 flex flex-col gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">
                            Điểm của bạn
                          </label>
                          <Select
                            value={currentScore.toString()}
                            onValueChange={(val) => {
                              if (val !== null)
                                setTeacherScores((prev) => ({
                                  ...prev,
                                  [crit]: parseFloat(val),
                                }));
                            }}
                          >
                            <SelectTrigger className="w-full h-10 text-base">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BAND_OPTIONS.map((b) => (
                                <SelectItem key={b} value={b.toString()}>
                                  {b.toFixed(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentScore !== aiScore && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3" /> Đã thay đổi so
                              với AI
                            </p>
                          )}
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col">
                          <label className="text-sm font-semibold">
                            Nhận xét riêng (Tùy chọn)
                          </label>
                          <Textarea
                            className="flex-1 min-h-[100px] text-sm resize-none"
                            placeholder={`Thêm nhận xét riêng cho tiêu chí ${meta.short}...`}
                            value={teacherNotes[crit]}
                            onChange={(e) =>
                              setTeacherNotes((prev) => ({
                                ...prev,
                                [crit]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 bg-primary/5 border border-primary/20 rounded-lg p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground uppercase font-semibold">
                  Overall Band Dự Kiến
                </p>
                <p className="text-5xl font-bold text-primary mt-1">
                  {teacherOverallBand.toFixed(1)}
                </p>
              </div>
              <div className="flex-1 w-full space-y-2">
                <label className="text-sm font-semibold">
                  Nhận xét chung toàn bài
                </label>
                <Textarea
                  className="min-h-[100px] w-full bg-background"
                  placeholder="Viết nhận xét tổng quan cho học viên..."
                  value={generalFeedback}
                  onChange={(e) => setGeneralFeedback(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => scrollToSection(3)} size="lg">
              Hoàn tất chấm & Tiếp tục
            </Button>
          </div>
        </section>

        <Separator />

        {/* SECTION 4: Approve ("Duyệt") */}
        <section
          ref={(el) => {
            sectionRefs.current[3] = el;
          }}
          className="scroll-mt-24 space-y-4"
        >
          <div className="flex items-center gap-2 text-2xl font-semibold mb-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded flex items-center justify-center text-lg">
              4
            </span>
            Duyệt Đánh Giá
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tổng kết điểm</CardTitle>
              <CardDescription>
                So sánh giữa AI và Giáo viên trước khi duyệt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Tiêu chí</th>
                      <th className="px-4 py-3 text-center">AI</th>
                      <th className="px-4 py-3 text-center">Giáo viên</th>
                      <th className="px-4 py-3 text-center rounded-tr-lg">
                        Chênh lệch
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {CRITERIA_ORDER.map((crit) => {
                      const meta = CRITERION_META[crit];
                      const ai = MOCK_AI_SCORES[crit];
                      const tc = teacherScores[crit];
                      const diff = tc - ai;

                      return (
                        <tr key={crit} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium flex items-center gap-2">
                            <Badge variant="outline" className={meta.bgLight}>
                              {meta.short}
                            </Badge>
                            {meta.label}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ai.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-center font-bold">
                            {tc.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {diff > 0 ? (
                              <span className="text-emerald-600 flex items-center justify-center gap-1">
                                <ChevronUp className="w-4 h-4" /> +
                                {diff.toFixed(1)}
                              </span>
                            ) : diff < 0 ? (
                              <span className="text-red-600 flex items-center justify-center gap-1">
                                <ChevronDown className="w-4 h-4" />{" "}
                                {diff.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-primary/5 font-bold">
                      <td className="px-4 py-4 rounded-bl-lg">OVERALL BAND</td>
                      <td className="px-4 py-4 text-center">
                        {MOCK_AI_OVERALL.toFixed(1)}
                      </td>
                      <td className="px-4 py-4 text-center text-primary text-lg">
                        {teacherOverallBand.toFixed(1)}
                      </td>
                      <td className="px-4 py-4 text-center rounded-br-lg">
                        {teacherOverallBand - MOCK_AI_OVERALL !== 0 && (
                          <span
                            className={
                              teacherOverallBand > MOCK_AI_OVERALL
                                ? "text-emerald-600"
                                : "text-red-600"
                            }
                          >
                            {teacherOverallBand > MOCK_AI_OVERALL ? "+" : ""}
                            {(teacherOverallBand - MOCK_AI_OVERALL).toFixed(1)}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center bg-muted/20 border-t pt-4">
              <span className="text-sm text-muted-foreground">
                Kết quả sẽ được lưu nhưng chưa hiển thị cho học viên.
              </span>
              <Button
                size="lg"
                onClick={() => {
                  setIsApproved(true);
                  scrollToSection(4);
                }}
              >
                Duyệt đánh giá này
              </Button>
            </CardFooter>
          </Card>
        </section>

        {isApproved && (
          <>
            <Separator />
            {/* SECTION 5: Publish ("Công bố") */}
            <section
              ref={(el) => {
                sectionRefs.current[4] = el;
              }}
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex items-center gap-2 text-2xl font-semibold mb-2">
                <span className="bg-destructive text-destructive-foreground w-8 h-8 rounded flex items-center justify-center text-lg">
                  5
                </span>
                Công Bố
              </div>

              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Cảnh báo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    Sau khi công bố, kết quả sẽ hiển thị ngay lập tức cho học
                    viên <strong>{MOCK_STUDENT.name}</strong> và bạn sẽ không
                    thể chỉnh sửa điểm số hay nhận xét nữa.
                  </p>
                </CardContent>
                <CardFooter>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          variant="destructive"
                          size="lg"
                          className="w-full sm:w-auto"
                        />
                      }
                    >
                      <Send className="w-4 h-4 mr-2" /> Công bố kết quả ngay
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Xác nhận công bố</DialogTitle>
                        <DialogDescription>
                          Bạn có chắc chắn muốn công bố điểm{" "}
                          {teacherOverallBand.toFixed(1)} cho bài viết này?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="mt-4">
                        <Button variant="outline">Hủy</Button>
                        <Button
                          variant="destructive"
                          onClick={() => setIsPublished(true)}
                        >
                          Xác nhận công bố
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
