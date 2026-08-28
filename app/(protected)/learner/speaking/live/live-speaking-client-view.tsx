"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Sparkles,
  Shuffle,
  Headphones,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  SPEAKING_MOCK_TOPICS,
  SpeakingMockTopic,
  getRandomMockTopic,
} from "@/lib/data/speaking-mock-topics";
import { LiveSpeakingExaminerRoom } from "@/components/speaking/live";
import { cn } from "@/lib/utils";

interface LiveSpeakingClientViewProps {
  candidateName: string;
}

export function LiveSpeakingClientView({
  candidateName,
}: LiveSpeakingClientViewProps) {
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<SpeakingMockTopic>(
    SPEAKING_MOCK_TOPICS[0]
  );
  const [isInRoom, setIsInRoom] = useState<boolean>(false);

  const handleRandomTopic = () => {
    const random = getRandomMockTopic();
    setSelectedTopic(random);
  };

  if (isInRoom) {
    return (
      <div className="space-y-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsInRoom(false)}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại Chọn Đề Thi</span>
        </Button>

        <LiveSpeakingExaminerRoom
          candidateName={candidateName}
          topic={selectedTopic}
          onBackToDashboard={() => router.push("/learner/dashboard")}
          onRestart={() => setIsInRoom(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-muted/20 border border-indigo-500/20 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold"
              >
                Giám khảo AI Trực tiếp
              </Badge>
              <Badge
                variant="secondary"
                className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
              >
                Full Test (Part 1 - 3)
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Phòng Thi IELTS Speaking Trực Tiếp AI
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Trải nghiệm đàm thoại giọng nói 1-on-1 thời gian thực với Giám
              khảo AI bản ngữ chuẩn khảo thí. Hệ thống tự động chuyển Part, hiển
              thị Cue Card đếm ngược 1 phút và xuất Bảng điểm 4 tiêu chí chi
              tiết sau khi thi.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <Button
              size="lg"
              onClick={() => setIsInRoom(true)}
              className="gap-2 font-semibold shadow-md bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              <Sparkles className="size-4" />
              <span>Vào Phòng Thi Ngay</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Tips & Audio Best Practice Bar */}
        <div className="mt-5 pt-4 border-t border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Headphones className="size-4 text-indigo-500 shrink-0" />
            <span>Nên đeo tai nghe để âm thanh rõ ràng & tránh lặp tiếng.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <span>Hỗ trợ ngắt lời tự nhiên khi đang nói.</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-blue-500 shrink-0" />
            <span>Chấm điểm 4 tiêu chí: FC, LR, GRA & Phát âm (PR).</span>
          </div>
        </div>
      </div>

      {/* Topic Catalog Selector */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Chọn Bộ Đề Thi Mẫu</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Chọn chủ đề bạn muốn luyện tập hoặc bấm &ldquo;Chọn Đề Ngẫu
              nhiên&rdquo;.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRandomTopic}
            className="gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Shuffle className="size-3.5" />
            <span>Chọn Đề Ngẫu nhiên</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SPEAKING_MOCK_TOPICS.map((topic) => {
            const isSelected = selectedTopic.id === topic.id;

            return (
              <Card
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className={cn(
                  "cursor-pointer transition-all border py-0 gap-0 overflow-hidden shadow-xs hover:border-primary/50",
                  isSelected
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/[0.03]"
                    : "border-border/70 hover:shadow-sm"
                )}
              >
                <CardHeader className="p-4 sm:p-6 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            topic.difficulty === "Advanced"
                              ? "destructive"
                              : topic.difficulty === "Challenging"
                                ? "outline"
                                : "secondary"
                          }
                          className="text-[10px] font-mono"
                        >
                          {topic.difficulty}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {topic.category}
                        </span>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground">
                        {topic.title}
                      </CardTitle>
                    </div>

                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {isSelected && <CheckCircle2 className="size-3" />}
                    </div>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {topic.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-5 py-3 border-t bg-muted/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold text-foreground/90">
                      Part 1 Theme:
                    </span>
                    <span className="text-foreground/80 truncate max-w-[200px]">
                      {topic.part1.theme}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold text-foreground/90">
                      Part 2 Cue Card:
                    </span>
                    <span className="text-foreground/80 truncate max-w-[200px]">
                      {topic.part2.topicTitle}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold text-foreground/90">
                      Part 3 Discussion:
                    </span>
                    <span className="text-foreground/80 truncate max-w-[200px]">
                      {topic.part3.theme}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-2 border-t flex justify-end">
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTopic(topic);
                      setIsInRoom(true);
                    }}
                    className={cn(
                      "h-8 text-xs font-medium cursor-pointer gap-1.5",
                      isSelected &&
                        "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                  >
                    <Mic className="size-3.5" />
                    <span>Bắt đầu thi đề này</span>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
