"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Play,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { WrongEntry } from "@/src/practice/types";
import {
  clearWrongBook,
  getWrongEntries,
  getWrongCount,
  getTotalWrongCount,
  removeWrongEntry,
  toggleMastered,
} from "@/src/practice/wrong-book";

interface WrongBookViewProps {
  onStartReview: (entries: WrongEntry[]) => void;
  onExit: () => void;
}

export function WrongBookView({ onStartReview, onExit }: WrongBookViewProps) {
  const [entries, setEntries] = useState<WrongEntry[]>(getWrongEntries);
  const [search, setSearch] = useState("");
  const [masteredExpanded, setMasteredExpanded] = useState(false);

  const refresh = useCallback(() => {
    setEntries(getWrongEntries());
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.question.stem.toLowerCase().includes(q) ||
        e.chapterTitle.toLowerCase().includes(q) ||
        e.question.number.includes(q),
    );
  }, [entries, search]);

  const activeEntries = useMemo(() => filtered.filter((e) => !e.mastered), [filtered]);
  const masteredEntries = useMemo(() => filtered.filter((e) => e.mastered), [filtered]);

  const nonMasteredForReview = useMemo(
    () => getWrongEntries().filter((e) => !e.mastered).sort((a, b) => b.timestamp - a.timestamp),
    [entries],
  );

  function handleRemove(chapterId: string, questionNumber: string) {
    removeWrongEntry(chapterId, questionNumber);
    refresh();
  }

  function handleToggleMastered(chapterId: string, questionNumber: string) {
    toggleMastered(chapterId, questionNumber);
    refresh();
  }

  function handleClearAll() {
    clearWrongBook();
    refresh();
  }

  function handleReviewAll() {
    const toReview = getWrongEntries().filter((e) => !e.mastered).sort((a, b) => b.timestamp - a.timestamp);
    onStartReview(toReview);
  }

  const activeCount = getWrongCount();
  const totalCount = getTotalWrongCount();

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <Card className="border-foreground/15 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-5" />
                错题本
              </CardTitle>
              <CardDescription>
                {totalCount > 0
                  ? `共 ${totalCount} 道错题，其中 ${activeCount} 道待复习`
                  : "暂无错题，开始刷题后答错的题目会自动收录。"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onExit}>
              <ArrowLeft data-icon="inline-start" />
              返回
            </Button>
          </div>
        </CardHeader>
        {totalCount > 0 && (
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索错题关键词..."
                />
              </div>
              <Button variant="default" onClick={handleReviewAll} disabled={activeCount === 0}>
                <Play data-icon="inline-start" />
                复习全部 ({activeCount})
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <Trash2 data-icon="inline-start" />
                清空
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Active wrong entries */}
      {activeEntries.length > 0 && (
        <Card className="border-foreground/15 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              待复习
              <Badge variant="outline" className="ml-2">
                {activeCount}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <WrongEntryList
              entries={activeEntries}
              onRemove={handleRemove}
              onToggleMastered={handleToggleMastered}
              onStartReview={(e) => onStartReview([e])}
            />
          </CardContent>
        </Card>
      )}

      {/* Mastered entries */}
      {masteredEntries.length > 0 && (
        <Card className="border-foreground/15 shadow-sm">
          <Button
            variant="ghost"
            className="h-auto w-full justify-between rounded-none px-6 py-4 text-left"
            onClick={() => setMasteredExpanded(!masteredExpanded)}
            aria-expanded={masteredExpanded}
            aria-controls="mastered-wrong-entries"
          >
            <span className="flex items-center gap-2">
              <span className="text-base font-semibold leading-tight">已掌握</span>
              <Badge variant="outline" className="ml-2">
                {masteredEntries.length}
              </Badge>
            </span>
            <span className="text-xs text-muted-foreground">
              {masteredExpanded ? "收起" : "展开"}
            </span>
          </Button>
          {masteredExpanded && (
            <CardContent id="mastered-wrong-entries">
              <WrongEntryList
                entries={masteredEntries}
                onRemove={handleRemove}
                onToggleMastered={handleToggleMastered}
                onStartReview={(e) => onStartReview([e])}
              />
            </CardContent>
          )}
        </Card>
      )}

      {totalCount === 0 && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 text-muted-foreground">
          <BookOpen className="size-10 opacity-30" />
          <p className="text-sm">错题本为空</p>
          <p className="text-xs">开始刷题后答错的题目会自动出现在这里</p>
        </div>
      )}
    </div>
  );
}

function WrongEntryList({
  entries,
  onRemove,
  onToggleMastered,
  onStartReview,
}: {
  entries: WrongEntry[];
  onRemove: (chapterId: string, questionNumber: string) => void;
  onToggleMastered: (chapterId: string, questionNumber: string) => void;
  onStartReview: (entry: WrongEntry) => void;
}) {
  return (
    <ScrollArea className="max-h-[50vh]">
      <div className="flex flex-col gap-2 pr-3">
        {entries.map((entry) => (
          <div
            key={`${entry.chapterId}-${entry.question.number}`}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              entry.mastered
                ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20"
                : "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {entry.question.type}
                  </Badge>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.chapterTitle}
                  </span>
                  {entry.reviewCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      <RotateCcw className="inline size-3" /> {entry.reviewCount}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">{entry.question.stem}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  <span className="text-red-500">
                    你的答案：{entry.userAnswer}
                  </span>
                  <span className="text-emerald-600">
                    正确答案：{entry.question.correctAnswer}
                    {entry.question.correctAnswerText
                      ? `（${entry.question.correctAnswerText}）`
                      : ""}
                  </span>
                </div>
                {entry.question.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.question.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = entry.question.correctAnswer.includes(letter);
                      const isUserAnswer = entry.userAnswer.includes(letter);
                      return (
                        <span
                          key={letter}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                            isCorrect && isUserAnswer && "border-emerald-300 bg-emerald-50 text-emerald-700",
                            isCorrect && !isUserAnswer && "border-emerald-200 bg-emerald-50/50 text-emerald-600",
                            !isCorrect && isUserAnswer && "border-red-300 bg-red-50 text-red-700",
                            !isCorrect && !isUserAnswer && "border-border bg-background text-muted-foreground",
                          )}
                        >
                          {letter}. {opt}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={entry.mastered ? "取消掌握" : "标记为已掌握"}
                  aria-label={entry.mastered ? "取消掌握" : "标记为已掌握"}
                  onClick={() => onToggleMastered(entry.chapterId, entry.question.number)}
                >
                  {entry.mastered ? (
                    <CheckCircle2 className="text-emerald-500" />
                  ) : (
                    <Check className="text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="单独复习"
                  aria-label="单独复习"
                  onClick={() => onStartReview(entry)}
                >
                  <Play className="text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="删除"
                  aria-label="删除"
                  onClick={() => onRemove(entry.chapterId, entry.question.number)}
                >
                  <X className="text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
