"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Bookmark,
  Layers,
  Play,
  Shuffle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PracticeChapter, PracticeConfig } from "@/src/practice/types";
import { ChapterPicker } from "./chapter-picker";

interface PracticeDashboardProps {
  chapters: PracticeChapter[];
  onStartSession: (config: PracticeConfig) => void;
  onViewWrongBook: () => void;
  loading: boolean;
  wrongCount: number;
}

export function PracticeDashboard({
  chapters,
  onStartSession,
  onViewWrongBook,
  loading,
  wrongCount,
}: PracticeDashboardProps) {
  const [pickingChapters, setPickingChapters] = useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  const totalQuestions = useMemo(
    () => chapters.reduce((sum, ch) => sum + ch.questionCount, 0),
    [chapters],
  );

  const hasChapters = chapters.length > 0 && totalQuestions > 0;

  function handleStartChapterMode() {
    setSelectedChapterIds([]);
    setPickingChapters(true);
  }

  function handleChapterConfirm() {
    if (selectedChapterIds.length === 0) return;
    onStartSession({ mode: "chapter", chapterIds: selectedChapterIds, shuffle: true });
  }

  function handleStartAll() {
    onStartSession({ mode: "all", chapterIds: [], shuffle: true });
  }

  if (pickingChapters) {
    return (
      <ChapterPicker
        chapters={chapters}
        selectedIds={selectedChapterIds}
        onSelectionChange={setSelectedChapterIds}
        onConfirm={handleChapterConfirm}
        onCancel={() => setPickingChapters(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-foreground/15 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Layers className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold tabular-nums">{chapters.length}</div>
              <div className="text-xs text-muted-foreground">章节数</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-foreground/15 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Bookmark className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold tabular-nums">{totalQuestions}</div>
              <div className="text-xs text-muted-foreground">总题数</div>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="h-auto justify-start p-0 text-left shadow-sm" onClick={onViewWrongBook}>
          <span className="flex items-center gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
              <BookOpen className="size-5 text-red-500" />
            </div>
            <span className="min-w-0">
              <span className="block text-2xl font-bold tabular-nums">{wrongCount}</span>
              <span className="block text-xs text-muted-foreground">错题数</span>
            </span>
          </span>
        </Button>
      </div>

      {/* Start buttons */}
      <Card className="border-foreground/15 shadow-sm">
        <CardHeader>
          <CardTitle>开始刷题</CardTitle>
          <CardDescription>
            选择题库来源，打乱题目顺序后开始练习。答错的题目会自动收入错题本。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-8 justify-center">
              <span className="text-sm text-muted-foreground">正在加载题库...</span>
            </div>
          ) : !hasChapters ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 p-8 text-center">
              <Layers className="size-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">暂无题库</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  请先下载作业（点击"开始"下载课程作业），题库会自动生成。
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                variant="outline"
                className="flex h-auto flex-col items-start gap-2 p-5 text-left"
                onClick={handleStartChapterMode}
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Layers className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">章节刷题</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    选择特定章节进行针对性练习
                  </span>
                </span>
              </Button>

              <Button
                variant="outline"
                className="flex h-auto flex-col items-start gap-2 p-5 text-left"
                onClick={handleStartAll}
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Shuffle className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">全部刷题</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    打乱所有章节的题目一起练习
                  </span>
                </span>
              </Button>

              <Button
                variant="outline"
                className={cn(
                  "flex h-auto flex-col items-start gap-2 p-5 text-left",
                  wrongCount === 0 && "opacity-50 pointer-events-none",
                )}
                onClick={onViewWrongBook}
                disabled={wrongCount === 0}
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
                  <BookOpen className="size-5 text-red-500" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">错题复习</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {wrongCount > 0
                      ? `从错题本（${wrongCount} 题）中复习`
                      : "暂无错题，刷题后自动收录"}
                  </span>
                </span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
