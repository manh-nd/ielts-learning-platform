"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IeltsSpeakingEvaluationResult } from "@/lib/gemini/speaking-schema";
import {
  Sparkles,
  Copy,
  Check,
  Play,
  Volume2,
  BookOpen,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiveCriteriaBreakdownProps {
  evaluationResult: IeltsSpeakingEvaluationResult;
  onSeekToTime?: (seconds: number) => void;
  className?: string;
}

export function LiveCriteriaBreakdown({
  evaluationResult,
  onSeekToTime,
  className,
}: LiveCriteriaBreakdownProps) {
  const [copiedMonologue, setCopiedMonologue] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("criteria");

  const criteria = evaluationResult.overallScorecard.criteria;
  const partEvaluations = evaluationResult.partEvaluations || [];
  const practiceMonologue =
    evaluationResult.overallScorecard.generalFeedback?.practiceMonologue;

  const handleCopyMonologue = useCallback(() => {
    if (!practiceMonologue) return;
    navigator.clipboard.writeText(practiceMonologue).then(() => {
      setCopiedMonologue(true);
      setTimeout(() => setCopiedMonologue(false), 2000);
    });
  }, [practiceMonologue]);

  return (
    <div
      data-testid="live-criteria-breakdown"
      className={cn("space-y-4", className)}
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="grid grid-cols-2 sm:w-80 h-9">
            <TabsTrigger value="criteria" className="text-xs font-semibold">
              4 Tiêu chí Chấm điểm
            </TabsTrigger>
            <TabsTrigger value="parts" className="text-xs font-semibold">
              Đánh giá từng Part ({partEvaluations.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: 4 IELTS Criteria Details */}
        <TabsContent value="criteria" className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Fluency & Coherence */}
            {criteria?.fluencyAndCoherence && (
              <Card className="border shadow-xs overflow-hidden py-0 gap-0 h-full flex flex-col justify-between">
                <div>
                  <CardHeader className="p-4 border-b bg-emerald-500/10 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        <CardTitle className="text-sm font-bold text-foreground">
                          Fluency & Coherence (FC)
                        </CardTitle>
                      </div>
                      <Badge className="bg-emerald-700 text-white font-mono text-xs">
                        Band {criteria.fluencyAndCoherence.score}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <p className="text-muted-foreground leading-relaxed">
                      {criteria.fluencyAndCoherence.summary}
                    </p>

                    {criteria.fluencyAndCoherence.strengths && (
                      <div>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300 block mb-1">
                          Điểm mạnh:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-foreground/90">
                          {criteria.fluencyAndCoherence.strengths.map(
                            (s, i) => (
                              <li key={i}>{s}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    {criteria.fluencyAndCoherence.weaknesses && (
                      <div>
                        <span className="font-semibold text-rose-700 dark:text-rose-300 block mb-1">
                          Cần cải thiện:
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-foreground/90">
                          {criteria.fluencyAndCoherence.weaknesses.map(
                            (w, i) => (
                              <li key={i}>{w}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            )}

            {/* 2. Lexical Resource */}
            {criteria?.lexicalResource && (
              <Card className="border shadow-xs overflow-hidden py-0 gap-0 h-full flex flex-col justify-between">
                <div>
                  <CardHeader className="p-4 border-b bg-blue-500/10 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <CardTitle className="text-sm font-bold text-foreground">
                          Lexical Resource (LR)
                        </CardTitle>
                      </div>
                      <Badge className="bg-blue-700 text-white font-mono text-xs">
                        Band {criteria.lexicalResource.score}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <p className="text-muted-foreground leading-relaxed">
                      {criteria.lexicalResource.summary}
                    </p>

                    {criteria.lexicalResource.upgrades &&
                      criteria.lexicalResource.upgrades.length > 0 && (
                        <div className="space-y-2 pt-1 border-t">
                          <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            Gợi ý Nâng cấp Từ vựng (Band 8.0+):
                          </span>
                          {criteria.lexicalResource.upgrades.map((upg, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-md bg-muted/40 border space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="line-through text-muted-foreground">
                                  {upg.originalExpression}
                                </span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                  ➔ {upg.betterAlternative}
                                </span>
                              </div>
                              {upg.contextExample && (
                                <p className="text-[11px] text-muted-foreground italic">
                                  &ldquo;{upg.contextExample}&rdquo;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                  </CardContent>
                </div>
              </Card>
            )}

            {/* 3. Grammatical Range & Accuracy */}
            {criteria?.grammaticalRangeAndAccuracy && (
              <Card className="border shadow-xs overflow-hidden py-0 gap-0 h-full flex flex-col justify-between">
                <div>
                  <CardHeader className="p-4 border-b bg-amber-500/10 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                        <CardTitle className="text-sm font-bold text-foreground">
                          Grammatical Range & Accuracy (GRA)
                        </CardTitle>
                      </div>
                      <Badge className="bg-amber-800 text-white font-mono text-xs">
                        Band {criteria.grammaticalRangeAndAccuracy.score}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <p className="text-muted-foreground leading-relaxed">
                      {criteria.grammaticalRangeAndAccuracy.summary}
                    </p>

                    {criteria.grammaticalRangeAndAccuracy.errors &&
                      criteria.grammaticalRangeAndAccuracy.errors.length >
                        0 && (
                        <div className="space-y-2 pt-1 border-t">
                          <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <Languages className="w-3.5 h-3.5" />
                            Lỗi Ngữ pháp & Câu sửa mẫu:
                          </span>
                          {criteria.grammaticalRangeAndAccuracy.errors.map(
                            (err, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-md bg-rose-500/5 border border-rose-500/20 space-y-1"
                              >
                                <div className="text-rose-700 dark:text-rose-300 font-medium">
                                  Câu sai: &ldquo;{err.originalPhrase}&rdquo;
                                </div>
                                <div className="text-emerald-700 dark:text-emerald-300 font-bold">
                                  Sửa lại: &ldquo;{err.correctedPhrase}&rdquo;
                                </div>
                                {err.explanation && (
                                  <p className="text-[11px] text-foreground/80">
                                    {err.explanation}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}
                  </CardContent>
                </div>
              </Card>
            )}

            {/* 4. Pronunciation */}
            {criteria?.pronunciation && (
              <Card className="border shadow-xs overflow-hidden py-0 gap-0 h-full flex flex-col justify-between">
                <div>
                  <CardHeader className="p-4 border-b bg-purple-500/10 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                        <CardTitle className="text-sm font-bold text-foreground">
                          Pronunciation (PR)
                        </CardTitle>
                      </div>
                      <Badge className="bg-purple-700 text-white font-mono text-xs">
                        Band {criteria.pronunciation.score}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <p className="text-muted-foreground leading-relaxed">
                      {criteria.pronunciation.summary}
                    </p>

                    {criteria.pronunciation.specificErrors &&
                      criteria.pronunciation.specificErrors.length > 0 && (
                        <div className="space-y-2 pt-1 border-t">
                          <span className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                            <Volume2 className="w-3.5 h-3.5" />
                            Lỗi Phát âm & Phiên âm IPA:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {criteria.pronunciation.specificErrors.map(
                              (item, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 rounded-md bg-purple-500/5 border border-purple-500/20 space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-foreground">
                                      {item.word}
                                    </span>
                                    {item.expectedIpa && (
                                      <span className="font-mono text-[11px] text-foreground/80">
                                        {item.expectedIpa}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                                    {item.detectedIssue}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </div>
              </Card>
            )}
          </div>

          {/* Model Monologue Shadowing Card */}
          {practiceMonologue && (
            <Card className="border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-background to-muted/20 shadow-xs overflow-hidden py-0 gap-0">
              <CardHeader className="p-4 border-b bg-indigo-500/10 pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Bài Nói Mẫu Band 8.0+ (Dùng để Shadowing)</span>
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                    Được viết lại tối ưu hóa từ chính câu trả lời của bạn
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyMonologue}
                  className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer bg-background"
                >
                  {copiedMonologue ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">
                        Đã sao chép
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép bài mẫu</span>
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-4 text-xs text-foreground/90 font-serif leading-relaxed italic">
                &ldquo;{practiceMonologue}&rdquo;
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Part Evaluations */}
        <TabsContent value="parts" className="space-y-4 pt-1">
          {partEvaluations.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border rounded-xl bg-muted/20">
              Không có dữ liệu đánh giá chi tiết theo từng Part.
            </div>
          ) : (
            partEvaluations.map((part, index) => (
              <Card
                key={index}
                className="border shadow-xs overflow-hidden py-0 gap-0"
              >
                <CardHeader className="p-4 border-b bg-muted/20 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        Part {part.partNumber}
                      </Badge>
                      <CardTitle className="text-sm font-semibold text-foreground">
                        {part.promptQuestion}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  {/* Verified Transcript */}
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-1">
                      Nội dung gỡ băng câu trả lời:
                    </span>
                    <p className="p-3 rounded-lg bg-muted/30 border font-serif text-foreground/90 italic leading-relaxed">
                      &ldquo;
                      {part.verifiedTranscript || part.candidateTranscript}
                      &rdquo;
                    </p>
                  </div>

                  {/* Pronunciation Notes */}
                  {part.pronunciationNotes &&
                    part.pronunciationNotes.length > 0 && (
                      <div className="space-y-2">
                        <span className="font-semibold text-purple-700 dark:text-purple-300 block">
                          Ghi chú Phát âm câu này:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {part.pronunciationNotes.map((note, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-md bg-purple-500/5 border border-purple-500/20 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-foreground">
                                  {note.word}
                                </span>
                                <span className="font-mono text-[11px] text-foreground/80 ml-1.5">
                                  {note.expectedIpa}
                                </span>
                                <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-0.5">
                                  {note.detectedIssue}
                                </p>
                              </div>
                              {note.timestampSeconds !== undefined &&
                                onSeekToTime && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      onSeekToTime(note.timestampSeconds!)
                                    }
                                    className="h-7 px-2 text-xs gap-1 cursor-pointer"
                                    title="Nghe đoạn này"
                                  >
                                    <Play className="w-3 h-3 text-primary fill-current" />
                                    <span>{note.timestampSeconds}s</span>
                                  </Button>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
