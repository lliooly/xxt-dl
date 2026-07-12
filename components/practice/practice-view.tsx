"use client";

import { useCallback, useMemo, useState } from "react";
import { usePracticeData } from "@/src/practice/question-loader";
import { createSession, createSessionFromQuestions } from "@/src/practice/quiz-engine";
import type { PracticeChapter, PracticeConfig, PracticeSession, WrongEntry } from "@/src/practice/types";
import type { Question } from "@/src/types";
import { PracticeDashboard } from "./practice-dashboard";
import { QuizSession } from "./quiz-session";
import { WrongBookView } from "./wrong-book-view";

type View =
  | { kind: "dashboard" }
  | { kind: "quiz"; session: PracticeSession }
  | { kind: "wrong-book" };

export function PracticeView() {
  const { chapters, questionMap, loading, error } = usePracticeData();
  const [view, setView] = useState<View>({ kind: "dashboard" });

  const chapterMap = useMemo(() => {
    const map = new Map<string, { chapter: PracticeChapter; questions: Question[] }>();
    for (const ch of chapters) {
      const questions = questionMap.get(ch.id) ?? [];
      map.set(ch.id, { chapter: ch, questions });
    }
    return map;
  }, [chapters, questionMap]);

  const handleStartSession = useCallback(
    (config: PracticeConfig) => {
      const session = createSession(config, chapterMap);
      if (session.questions.length === 0) return;
      setView({ kind: "quiz", session });
    },
    [chapterMap],
  );

  const handleStartWrongBookReview = useCallback((entries: WrongEntry[]) => {
    if (entries.length === 0) return;
    const session = createSessionFromQuestions(
      entries.map((e) => ({
        question: e.question,
        chapterId: e.chapterId,
        chapterTitle: e.chapterTitle,
      })),
      true,
    );
    setView({ kind: "quiz", session });
  }, []);

  const handleRestartSession = useCallback(() => {
    if (view.kind === "quiz") {
      const session = createSession(view.session.config, chapterMap);
      if (session.questions.length > 0) {
        setView({ kind: "quiz", session });
      }
    }
  }, [view, chapterMap]);

  const handleExitQuiz = useCallback(() => {
    setView({ kind: "dashboard" });
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {view.kind === "dashboard" && (
        <PracticeDashboard
          chapters={chapters}
          onStartSession={handleStartSession}
          onStartWrongBookReview={handleStartWrongBookReview}
          onViewWrongBook={() => setView({ kind: "wrong-book" })}
          loading={loading}
        />
      )}

      {view.kind === "quiz" && (
        <QuizSession
          session={view.session}
          onExit={handleExitQuiz}
          onRestart={handleRestartSession}
        />
      )}

      {view.kind === "wrong-book" && (
        <WrongBookView
          onStartReview={handleStartWrongBookReview}
          onExit={() => setView({ kind: "dashboard" })}
        />
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
