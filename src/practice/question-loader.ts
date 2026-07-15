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

export interface PracticePayload {
  chapters: PracticeChapter[];
  questions: Record<string, Question[]>;
}

export async function parsePracticeResponse(response: Response): Promise<PracticePayload> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("题库接口返回了无效 JSON。");
  }

  if (!response.ok) {
    throw new Error(readApiError(value));
  }
  if (!isPracticePayload(value)) {
    throw new Error("题库接口响应格式无效。");
  }

  return value;
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
      const response = await fetch("/api/practice-chapters", { cache: "no-store" });
      const data = await parsePracticeResponse(response);
      setChapters(data.chapters);
      const map = new Map<string, Question[]>();
      for (const [id, questions] of Object.entries(data.questions)) {
        map.set(id, questions);
      }
      setQuestionMap(map);
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

function isPracticePayload(value: unknown): value is PracticePayload {
  if (!isRecord(value) || !Array.isArray(value.chapters) || !isRecord(value.questions)) {
    return false;
  }

  return (
    value.chapters.every(isPracticeChapter) &&
    Object.values(value.questions).every(
      (questions) => Array.isArray(questions) && questions.every(isQuestion),
    )
  );
}

function isPracticeChapter(value: unknown): value is PracticeChapter {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    Number.isInteger(value.questionCount) &&
    typeof value.path === "string"
  );
}

function isQuestion(value: unknown): value is Question {
  return (
    isRecord(value) &&
    typeof value.number === "string" &&
    typeof value.type === "string" &&
    typeof value.stem === "string" &&
    Array.isArray(value.options) &&
    value.options.every((option) => typeof option === "string") &&
    typeof value.correctAnswer === "string" &&
    typeof value.correctAnswerText === "string"
  );
}

function readApiError(value: unknown): string {
  return isRecord(value) && typeof value.error === "string" && value.error.trim()
    ? value.error
    : "题库接口请求失败。";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
