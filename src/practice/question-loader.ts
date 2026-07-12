"use client";

import { useCallback, useEffect, useState } from "react";
import type { Question } from "../types.js";
import type { PracticeChapter } from "./types.js";

export interface PracticeData {
  chapters: PracticeChapter[];
  questionMap: Map<string, Question[]>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Load practice chapters and questions.
 *
 * Browser: fetches chapters and questions from the local Next.js API.
 */
export function usePracticeData(): PracticeData {
  const [chapters, setChapters] = useState<PracticeChapter[]>([]);
  const [questionMap, setQuestionMap] = useState<Map<string, Question[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/practice-chapters");
      if (resp.ok) {
        const data: { chapters: PracticeChapter[]; questions: Record<string, Question[]> } =
          await resp.json();
        setChapters(data.chapters);
        const map = new Map<string, Question[]>();
        for (const [id, qs] of Object.entries(data.questions)) {
          map.set(id, qs);
        }
        setQuestionMap(map);
        return;
      }

      setChapters([]);
      setQuestionMap(new Map());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载题库失败");
      setChapters([]);
      setQuestionMap(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { chapters, questionMap, loading, error, reload: load };
}
