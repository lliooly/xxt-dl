import type { Question } from "../types.js";
import { isQuestion, isRecord } from "../shared/validation.js";
import type { WrongEntry } from "./types.js";

const STORAGE_KEY = "xxt-dl:wrong-book";

/** Guard against SSR / static export pre-rendering where `window` is absent. */
function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function readStore(): WrongEntry[] {
  if (!hasWindow()) return [];
  try {
    return parseWrongEntries(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function parseWrongEntries(raw: string | null): WrongEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isWrongEntry) ? value : [];
  } catch {
    return [];
  }
}

function writeStore(entries: WrongEntry[]): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Unique key for a wrong entry: chapterId + question number. */
function entryKey(chapterId: string, questionNumber: string): string {
  return `${chapterId}::${questionNumber}`;
}

// ── public API ───────────────────────────────────────────────────────

/** Add a wrong answer to the notebook. No-op if already present. */
export function addWrongEntry(
  question: Question,
  chapterId: string,
  chapterTitle: string,
  userAnswer: string,
): void {
  const entries = readStore();
  const key = entryKey(chapterId, question.number);

  if (entries.some((e) => entryKey(e.chapterId, e.question.number) === key)) {
    return; // already recorded
  }

  entries.push({
    question,
    chapterId,
    chapterTitle,
    userAnswer,
    timestamp: Date.now(),
    reviewCount: 0,
    mastered: false,
  });

  writeStore(entries);
}

/** Remove a wrong entry (e.g. after the user masters it). */
export function removeWrongEntry(chapterId: string, questionNumber: string): void {
  const key = entryKey(chapterId, questionNumber);
  writeStore(readStore().filter((e) => entryKey(e.chapterId, e.question.number) !== key));
}

/** Increment the review count for a wrong entry. */
export function incrementReviewCount(chapterId: string, questionNumber: string): void {
  const entries = readStore();
  const key = entryKey(chapterId, questionNumber);
  const entry = entries.find((e) => entryKey(e.chapterId, e.question.number) === key);
  if (entry) {
    entry.reviewCount += 1;
    writeStore(entries);
  }
}

/** Toggle the mastered flag on a wrong entry. */
export function toggleMastered(chapterId: string, questionNumber: string): void {
  const entries = readStore();
  const key = entryKey(chapterId, questionNumber);
  const entry = entries.find((e) => entryKey(e.chapterId, e.question.number) === key);
  if (entry) {
    entry.mastered = !entry.mastered;
    writeStore(entries);
  }
}

/** Get all wrong entries, newest first. */
export function getWrongEntries(): WrongEntry[] {
  return readStore().sort((a, b) => b.timestamp - a.timestamp);
}

/** Get wrong entries for a specific chapter. */
export function getWrongEntriesByChapter(chapterId: string): WrongEntry[] {
  return readStore()
    .filter((e) => e.chapterId === chapterId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** Get the total number of wrong entries (excluding mastered). */
export function getWrongCount(): number {
  return readStore().filter((e) => !e.mastered).length;
}

/** Get the total number of wrong entries including mastered. */
export function getTotalWrongCount(): number {
  return readStore().length;
}

/** Get all non-mastered wrong entries for review. */
export function getWrongEntriesForReview(): WrongEntry[] {
  return readStore()
    .filter((e) => !e.mastered)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** Check if a question is in the wrong book. */
export function isInWrongBook(chapterId: string, questionNumber: string): boolean {
  const key = entryKey(chapterId, questionNumber);
  return readStore().some((e) => entryKey(e.chapterId, e.question.number) === key);
}

/** Clear all wrong entries. Returns the count removed. */
export function clearWrongBook(): number {
  const count = readStore().length;
  writeStore([]);
  return count;
}

function isWrongEntry(value: unknown): value is WrongEntry {
  return (
    isRecord(value) &&
    isQuestion(value.question) &&
    typeof value.chapterId === "string" &&
    typeof value.chapterTitle === "string" &&
    typeof value.userAnswer === "string" &&
    typeof value.timestamp === "number" &&
    Number.isFinite(value.timestamp) &&
    typeof value.reviewCount === "number" &&
    Number.isInteger(value.reviewCount) &&
    value.reviewCount >= 0 &&
    typeof value.mastered === "boolean"
  );
}
