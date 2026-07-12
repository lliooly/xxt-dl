"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  RotateCcw,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getResults } from "@/src/practice/quiz-engine";
import type { PracticeSession } from "@/src/practice/types";

interface QuizResultsProps {
  session: PracticeSession;
  onRestart: () => void;
  onExit: () => void;
  /** Start a fresh session with new config (for wrong-book mode). */
  onNewRestart: () => void;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes} 分 ${remainingSeconds} 秒`;
  }
  return `${remainingSeconds} 秒`;
}

export function QuizResults({ session, onRestart, onExit, onNewRestart }: QuizResultsProps) {
  const results = useMemo(() => getResults(session), [session]);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary card */}
      <Card className="border-foreground/15 shadow-sm">
        <CardHeader>
          <CardTitle>刷题结果</CardTitle>
          <CardDescription>
            用时 {formatTime(results.timeSpent)} · 共 {results.total} 题
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Score ring */}
          <div className="flex items-center justify-center gap-8">
            <div className="relative flex size-28 items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted/30"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${results.score} ${100 - results.score}`}
                  strokeDashoffset="25"
                  className={cn(
                    results.score >= 80
                      ? "text-emerald-500"
                      : results.score >= 60
                        ? "text-amber-500"
                        : "text-red-500",
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{results.score}</span>
                <span className="text-xs text-muted-foreground">分</span>
              </div>
            </div>

            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-muted-foreground">正确</span>
                <span className="font-semibold tabular-nums text-emerald-600">{results.correct}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="size-4 text-red-500" />
                <span className="text-muted-foreground">错误</span>
                <span className="font-semibold tabular-nums text-red-500">{results.wrong}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">准确率</span>
                <span className="font-semibold tabular-nums">{results.score}%</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">用时</span>
                <span className="font-semibold tabular-nums">{formatTime(results.timeSpent)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-question breakdown */}
      {results.total > 0 && (
        <Card className="border-foreground/15 shadow-sm">
          <CardHeader>
            <CardTitle>答题详情</CardTitle>
            <CardDescription>
              点击题目可查看正确答案，错题已自动加入错题本。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-2 pr-3">
                {results.questions.map((qs, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-4 py-3",
                      qs.isCorrect === true
                        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
                        : qs.isCorrect === false
                          ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30"
                          : "border-border bg-muted/10",
                    )}
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-relaxed">
                          <span className="text-muted-foreground">{qs.question.type} · </span>
                          {qs.question.stem}
                        </p>
                      </div>
                      {qs.isCorrect === false && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                          <span className="text-red-500">
                            你的答案：{qs.userAnswer || "未作答"}
                          </span>
                          <span className="text-emerald-600">
                            正确答案：{qs.question.correctAnswer}
                            {qs.question.correctAnswerText
                              ? `（${qs.question.correctAnswerText}）`
                              : ""}
                          </span>
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {qs.chapterTitle}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {qs.isCorrect === true ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : qs.isCorrect === false ? (
                        <XCircle className="size-4 text-red-500" />
                      ) : (
                        <span className="text-xs text-muted-foreground">未答</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onExit}>
          <ArrowLeft data-icon="inline-start" />
          返回首页
        </Button>
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw data-icon="inline-start" />
          重新作答
        </Button>
        <Button variant="default" onClick={onNewRestart}>
          <RefreshCw data-icon="inline-start" />
          再来一轮
        </Button>
      </div>
    </div>
  );
}
