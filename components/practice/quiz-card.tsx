"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { QuizQuestionState } from "@/src/practice/types";

interface QuizCardProps {
  qs: QuizQuestionState;
  questionNumber: number;
  totalQuestions: number;
  showResult: boolean;
  onAnswer: (answer: string) => void;
  onNext: () => void;
}

const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function QuizCard({
  qs,
  questionNumber,
  totalQuestions,
  showResult,
  onAnswer,
  onNext,
}: QuizCardProps) {
  const { question, userAnswer, isCorrect } = qs;
  const isMultiple = question.type === "多选题";
  const isTextAnswer = question.type === "填空题" || question.options.length === 0;
  const questionIdentity = `${qs.chapterId}::${question.number}`;
  const inputIdBase = encodeURIComponent(questionIdentity).replaceAll("%", "");

  const selectedForRadio = useMemo(() => {
    if (!userAnswer) return "";
    if (isMultiple) return "";
    return userAnswer.trim().toUpperCase();
  }, [userAnswer, isMultiple]);

  const answerMulti = useMemo(() => {
    if (!isMultiple || !userAnswer) return new Set<string>();
    return new Set(userAnswer.trim().toUpperCase().replace(/[^A-Z]/g, "").split(""));
  }, [isMultiple, userAnswer]);
  const [selectedMulti, setSelectedMulti] = useState<Set<string>>(answerMulti);
  const [textAnswer, setTextAnswer] = useState(isTextAnswer ? (userAnswer ?? "") : "");

  useEffect(() => {
    setSelectedMulti(answerMulti);
    setTextAnswer(isTextAnswer ? (userAnswer ?? "") : "");
  }, [answerMulti, isTextAnswer, questionIdentity, userAnswer]);

  function handleSingleSelect(value: string) {
    if (showResult) return;
    onAnswer(value);
  }

  function handleMultiToggle(letter: string) {
    if (showResult) return;
    const next = new Set(selectedMulti);
    if (next.has(letter)) {
      next.delete(letter);
    } else {
      next.add(letter);
    }
    setSelectedMulti(next);
  }

  function getOptionStyle(letter: string): string {
    if (!showResult) {
      const isSelected = isMultiple
        ? selectedMulti.has(letter)
        : userAnswer?.trim().toUpperCase() === letter;
      return isSelected
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-background hover:border-muted-foreground/30";
    }

    const correctLetter = question.correctAnswer.trim().toUpperCase();
    const isCorrectOption = correctLetter.includes(letter);
    const userSelected = isMultiple
      ? selectedMulti.has(letter)
      : userAnswer?.trim().toUpperCase() === letter;

    if (isCorrectOption && userSelected) {
      return "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    }
    if (isCorrectOption && !userSelected) {
      return "border-emerald-500 bg-emerald-50/60 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400";
    }
    if (!isCorrectOption && userSelected) {
      return "border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
    }
    return "border-border bg-background text-muted-foreground";
  }

  return (
    <Card className="border-foreground/15 shadow-sm">
      <CardContent className="flex flex-col gap-5 p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {question.type}
            </span>
            <span className="text-sm text-muted-foreground">
              第 {questionNumber}/{totalQuestions} 题
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{qs.chapterTitle}</span>
        </div>

        {/* Stem */}
        <div>
          <p className="text-base leading-relaxed font-medium">
            <span className="mr-1.5 text-muted-foreground">{question.number}.</span>
            {question.stem}
          </p>
        </div>

        {/* Options */}
        {isTextAnswer ? (
          <Input
            value={textAnswer}
            onChange={(event) => setTextAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && textAnswer.trim() && !showResult) {
                onAnswer(textAnswer);
              }
            }}
            placeholder="请输入答案"
            disabled={showResult}
            aria-label="填空答案"
          />
        ) : isMultiple ? (
          <div className="flex flex-col gap-2">
            {question.options.map((opt, i) => {
              const letter = optionLabels[i];
              const style = getOptionStyle(letter);
              return (
                <Label
                  key={letter}
                  htmlFor={`multi-${inputIdBase}-${letter}`}
                  data-disabled={showResult || undefined}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm leading-relaxed transition-colors",
                    style,
                    showResult && "pointer-events-none",
                  )}
                >
                  <Checkbox
                    id={`multi-${inputIdBase}-${letter}`}
                    checked={showResult ? question.correctAnswer.includes(letter) : selectedMulti.has(letter)}
                    disabled={showResult}
                    onCheckedChange={() => handleMultiToggle(letter)}
                  />
                  <span className="flex-1"><span className="mr-2 font-semibold">{letter}.</span>{optionContent(opt)}</span>
                  {showResult && selectedMulti.has(letter) && !question.correctAnswer.includes(letter) && <X className="size-4 shrink-0 text-destructive" />}
                </Label>
              );
            })}
          </div>
        ) : (
          <RadioGroup
            value={selectedForRadio}
            onValueChange={handleSingleSelect}
            className="flex flex-col gap-2"
            disabled={showResult}
          >
            {question.options.map((opt, i) => {
              const letter = optionLabels[i];
              const style = getOptionStyle(letter);
              const correctLetter = question.correctAnswer.trim().toUpperCase();
              const isCorrectOption = correctLetter.includes(letter);

              return (
                <Label
                  key={letter}
                  htmlFor={`opt-${inputIdBase}-${letter}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm leading-relaxed transition-colors",
                    style,
                    !showResult && "cursor-pointer",
                  )}
                >
                  <RadioGroupItem
                    value={letter}
                    id={`opt-${inputIdBase}-${letter}`}
                    className="mt-0.5 shrink-0"
                    disabled={showResult}
                  />
                  <span className="flex-1">
                    <span className="mr-2 font-semibold">{letter}.</span>
                    {optionContent(opt)}
                  </span>
                  {showResult && isCorrectOption && (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  )}
                  {showResult &&
                    userAnswer?.trim().toUpperCase() === letter &&
                    !isCorrectOption && <X className="mt-0.5 size-4 shrink-0 text-red-500" />}
                </Label>
              );
            })}
          </RadioGroup>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          {showResult ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {isCorrect ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                  <Check className="size-4" />
                  回答正确
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-red-500">
                  <X className="size-4" />
                  回答错误
                </span>
              )}
              {!isCorrect && (
                <span className="text-muted-foreground">
                  正确答案：{question.correctAnswer}
                  {question.correctAnswerText ? `（${question.correctAnswerText}）` : ""}
                </span>
              )}
            </div>
          ) : isTextAnswer ? (
            <span className="text-sm text-muted-foreground">请输入答案后提交</span>
          ) : isMultiple ? (
            <span className="text-sm text-muted-foreground">
              {selectedMulti.size > 0 ? `已选 ${selectedMulti.size} 项` : "请选择所有正确答案"}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {!userAnswer ? "请选择一个选项" : ""}
            </span>
          )}

          <div className="flex items-center gap-2">
            {showResult && (
              <Button variant="default" size="sm" onClick={onNext}>
                下一题
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
            {isTextAnswer && !showResult && (
              <Button
                variant="default"
                size="sm"
                disabled={!textAnswer.trim()}
                onClick={() => onAnswer(textAnswer)}
              >
                提交答案
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
            {isMultiple && !showResult && selectedMulti.size > 0 && (
              <Button variant="default" size="sm" onClick={() => onAnswer([...selectedMulti].sort().join(""))}>
                确认选择
                <ArrowRight data-icon="inline-end" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function optionContent(option: string): string {
  return option.replace(/^\s*[A-Z]\s*[.．、]\s*/i, "");
}
