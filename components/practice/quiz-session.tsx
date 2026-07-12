"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { addWrongEntry, incrementReviewCount } from "@/src/practice/wrong-book";
import { goToQuestion, nextQuestion, submitAnswer } from "@/src/practice/quiz-engine";
import type { PracticeSession } from "@/src/practice/types";
import { QuizCard } from "./quiz-card";
import { QuizResults } from "./quiz-results";

interface QuizSessionProps {
  session: PracticeSession;
  onExit: () => void;
  onRestart: () => void;
}

export function QuizSession({ session, onExit, onRestart }: QuizSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(session.currentIndex);
  const [showResult, setShowResult] = useState(false);
  const [questions, setQuestions] = useState([...session.questions]);
  const [completed, setCompleted] = useState(session.status === "completed");
  const submittedRef = useRef(false);

  const currentQs = questions[currentIndex];
  const progressPercent = useMemo(() => {
    const answered = questions.filter((q) => q.userAnswer !== null).length;
    return questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;
  }, [questions]);

  const answeredCount = useMemo(
    () => questions.filter((q) => q.userAnswer !== null).length,
    [questions],
  );

  useEffect(() => {
    session.currentIndex = currentIndex;
  }, [currentIndex, session]);

  useEffect(() => {
    if (questions.length > 0 && answeredCount === questions.length) {
      session.status = "completed";
      session.completedAt = Date.now();
      setCompleted(true);
    }
  }, [answeredCount, questions.length, session]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;

      const isCorrect = submitAnswer(session, currentIndex, answer);

      if (!isCorrect) {
        addWrongEntry(
          currentQs.question,
          currentQs.chapterId,
          currentQs.chapterTitle,
          answer,
        );
      } else {
        incrementReviewCount(currentQs.chapterId, currentQs.question.number);
      }

      setQuestions([...session.questions]);
      setShowResult(true);
    },
    [session, currentIndex, currentQs],
  );

  const handleNext = useCallback(() => {
    submittedRef.current = false;
    setShowResult(false);
    const nextIdx = nextQuestion(session);
    if (nextIdx >= 0) {
      setCurrentIndex(nextIdx);
    } else {
      setCompleted(true);
    }
    setQuestions([...session.questions]);
  }, [session]);

  const handleJump = useCallback(
    (index: number) => {
      if (goToQuestion(session, index)) {
        submittedRef.current = questions[index].userAnswer !== null;
        setShowResult(questions[index].userAnswer !== null);
        setCurrentIndex(index);
      }
    },
    [session, questions],
  );

  const handleRestart = useCallback(() => {
    for (const qs of session.questions) {
      qs.userAnswer = null;
      qs.isCorrect = null;
    }
    session.currentIndex = 0;
    session.status = "active";
    session.completedAt = null;
    setQuestions([...session.questions]);
    setCurrentIndex(0);
    setShowResult(false);
    setCompleted(false);
    submittedRef.current = false;
  }, [session]);

  if (completed) {
    return (
      <QuizResults
        session={session}
        onRestart={handleRestart}
        onExit={onExit}
        onNewRestart={onRestart}
      />
    );
  }

  if (!currentQs) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">没有题目可刷</p>
        <Button variant="outline" onClick={onExit}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft data-icon="inline-start" />
          退出刷题
        </Button>
        <div className="flex flex-1 items-center gap-3">
          <Progress value={progressPercent} className="flex-1" />
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {answeredCount}/{questions.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRestart}>
          <RotateCcw data-icon="inline-start" />
          重来
        </Button>
      </div>

      {/* Question card */}
      <QuizCard
        qs={currentQs}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        showResult={showResult}
        onAnswer={handleAnswer}
        onNext={handleNext}
      />

      {/* Question navigator */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const isCurrent = i === currentIndex;
          const isAnswered = q.userAnswer !== null;
          const isWrong = q.isCorrect === false;

          return (
            <Button
              key={i}
              variant="ghost"
              size="icon"
              className={cn(
                "text-xs",
                isCurrent && "ring-2 ring-primary ring-offset-1",
                isWrong && !isCurrent && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                isAnswered && !isWrong && !isCurrent && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                !isAnswered && !isCurrent && "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
              onClick={() => handleJump(i)}
              title={`第 ${i + 1} 题${isAnswered ? (isWrong ? "（答错）" : "（答对）") : "（未答）"}`}
            >
              {i + 1}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
