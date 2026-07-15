import type { Question } from "../types.js";

export function isQuestion(value: unknown): value is Question {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
