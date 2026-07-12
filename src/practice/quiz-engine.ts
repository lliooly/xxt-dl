import type { Question } from "../types.js";
import type {
  PracticeChapter,
  PracticeConfig,
  PracticeResults,
  PracticeSession,
  QuizQuestionState,
} from "./types.js";

// ── helpers ──────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns new array). */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Normalise a user answer for comparison: trim, uppercase, sort multi-option chars. */
function normaliseAnswer(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9对错√×]/g, "");
}

/**
 * Check whether a user answer is correct.
 * - 单选题: exact letter match (case-insensitive).
 * - 多选题: set-equal match of option letters.
 * - 判断题: "对"/"错"/"√"/"×" or A/B matching.
 */
export function checkAnswer(question: Question, userAnswer: string): boolean {
  const user = normaliseAnswer(userAnswer);
  const correct = normaliseAnswer(question.correctAnswer);

  if (!user) return false;

  if (question.type === "多选题") {
    // Order-independent set comparison of individual letters.
    const userSet = new Set(user.split(""));
    const correctSet = new Set(correct.split(""));
    if (userSet.size !== correctSet.size) return false;
    for (const ch of userSet) {
      if (!correctSet.has(ch)) return false;
    }
    return true;
  }

  // 单选题 / 判断题 — exact match after normalisation.
  return user === correct;
}

// ── session factory ──────────────────────────────────────────────────

let sessionCounter = 0;

/**
 * Build a practice session from the given chapters and config.
 * `chapterMap` is a Map of chapterId → { chapter, questions }.
 */
export function createSession(
  config: PracticeConfig,
  chapterMap: Map<string, { chapter: PracticeChapter; questions: Question[] }>,
): PracticeSession {
  const selected: { chapter: PracticeChapter; questions: Question[] }[] = [];

  if (config.mode === "chapter") {
    for (const id of config.chapterIds) {
      const entry = chapterMap.get(id);
      if (entry && entry.questions.length > 0) {
        selected.push(entry);
      }
    }
  } else if (config.mode === "all") {
    for (const entry of chapterMap.values()) {
      if (entry.questions.length > 0) {
        selected.push(entry);
      }
    }
  }
  // "wrong-book" mode is assembled externally (questions already filtered by caller).

  const quizQuestions: QuizQuestionState[] = [];

  for (const { chapter, questions } of selected) {
    for (const q of questions) {
      quizQuestions.push({
        question: q,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        userAnswer: null,
        isCorrect: null,
      });
    }
  }

  const ordered = config.shuffle ? shuffle(quizQuestions) : quizQuestions;

  sessionCounter += 1;

  return {
    id: `session-${sessionCounter}-${Date.now()}`,
    config,
    questions: ordered,
    currentIndex: 0,
    startedAt: Date.now(),
    completedAt: null,
    status: ordered.length > 0 ? "active" : "completed",
  };
}

/** Create a session from a flat list of questions (e.g. wrong-book review). */
export function createSessionFromQuestions(
  questions: { question: Question; chapterId: string; chapterTitle: string }[],
  shuffleQuestions: boolean,
): PracticeSession {
  const quizQuestions: QuizQuestionState[] = questions.map((q) => ({
    question: q.question,
    chapterId: q.chapterId,
    chapterTitle: q.chapterTitle,
    userAnswer: null,
    isCorrect: null,
  }));

  const ordered = shuffleQuestions ? shuffle(quizQuestions) : quizQuestions;
  sessionCounter += 1;

  return {
    id: `session-${sessionCounter}-${Date.now()}`,
    config: { mode: "wrong-book", chapterIds: [], shuffle: shuffleQuestions },
    questions: ordered,
    currentIndex: 0,
    startedAt: Date.now(),
    completedAt: null,
    status: ordered.length > 0 ? "active" : "completed",
  };
}

// ── session actions ──────────────────────────────────────────────────

/** Submit an answer for the question at the given index. Returns whether correct. */
export function submitAnswer(
  session: PracticeSession,
  questionIndex: number,
  answer: string,
): boolean {
  const qs = session.questions[questionIndex];
  if (!qs) return false;

  const isCorrect = checkAnswer(qs.question, answer);
  qs.userAnswer = answer;
  qs.isCorrect = isCorrect;
  return isCorrect;
}

/** Move to the next unanswered question. Returns the new index, or -1 if done. */
export function nextQuestion(session: PracticeSession): number {
  for (let i = session.currentIndex + 1; i < session.questions.length; i++) {
    if (session.questions[i].userAnswer === null) {
      session.currentIndex = i;
      return i;
    }
  }
  // All answered — complete the session.
  session.currentIndex = session.questions.length;
  session.status = "completed";
  session.completedAt = Date.now();
  return -1;
}

/** Jump to a specific question index. */
export function goToQuestion(session: PracticeSession, index: number): boolean {
  if (index < 0 || index >= session.questions.length) return false;
  session.currentIndex = index;
  return true;
}

/** Compute results summary for a session. */
export function getResults(session: PracticeSession): PracticeResults {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  for (const qs of session.questions) {
    if (qs.isCorrect === true) correct++;
    else if (qs.isCorrect === false) wrong++;
    else unanswered++;
  }

  const total = session.questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const timeSpent = (session.completedAt ?? Date.now()) - session.startedAt;

  return {
    total,
    correct,
    wrong,
    unanswered,
    score,
    timeSpent,
    questions: session.questions,
  };
}
