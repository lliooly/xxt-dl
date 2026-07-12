import type { Question } from "../types.js";

/** A chapter/assignment that contains practice questions. */
export interface PracticeChapter {
  /** Unique id derived from the filename. */
  id: string;
  /** Human-readable title (assignment title). */
  title: string;
  /** Number of questions in this chapter. */
  questionCount: number;
  /** Relative path to the .questions.json file. */
  path: string;
}

/** A single wrong-answer entry persisted in the wrong-answer notebook. */
export interface WrongEntry {
  question: Question;
  chapterId: string;
  chapterTitle: string;
  /** The answer(s) the user selected, joined by comma for multi-select. */
  userAnswer: string;
  /** When the user first got this wrong. */
  timestamp: number;
  /** How many times this entry has been reviewed. */
  reviewCount: number;
  /** Whether the user has marked it as mastered. */
  mastered: boolean;
}

/** Configuration for starting a practice session. */
export interface PracticeConfig {
  /** Where questions are drawn from. */
  mode: "chapter" | "all" | "wrong-book";
  /** Which chapters to include (only for "chapter" mode). */
  chapterIds: string[];
  /** Whether to shuffle question order. */
  shuffle: boolean;
}

/** Runtime state of one question during a practice session. */
export interface QuizQuestionState {
  question: Question;
  chapterId: string;
  chapterTitle: string;
  /** The user's submitted answer, or null if not yet answered. */
  userAnswer: string | null;
  /** null = not answered yet, true/false once submitted. */
  isCorrect: boolean | null;
}

/** A practice session tracking progress through a set of questions. */
export interface PracticeSession {
  id: string;
  config: PracticeConfig;
  questions: QuizQuestionState[];
  currentIndex: number;
  startedAt: number;
  completedAt: number | null;
  status: "active" | "completed";
}

/** Summarised results after completing a session. */
export interface PracticeResults {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  /** Percentage 0–100. */
  score: number;
  /** Elapsed time in milliseconds. */
  timeSpent: number;
  questions: QuizQuestionState[];
}
