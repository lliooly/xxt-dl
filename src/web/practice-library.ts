import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { PracticeChapter } from "../practice/types.js";
import type { Question } from "../types.js";

export interface PracticeLibraryPayload {
  chapters: PracticeChapter[];
  questions: Record<string, Question[]>;
}

export type PracticeLibraryErrorCode = "INVALID_FILE" | "READ_FAILED";

export class PracticeLibraryError extends Error {
  constructor(
    readonly code: PracticeLibraryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PracticeLibraryError";
  }
}

export async function loadPracticeLibrary(outputDir: string): Promise<PracticeLibraryPayload> {
  let files: string[];
  try {
    files = await readdir(outputDir);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return emptyLibrary();
    }
    throw new PracticeLibraryError("READ_FAILED", "读取本地题库失败。", { cause: error });
  }

  const result = emptyLibrary();
  const questionFiles = files
    .filter((file) => file.endsWith(".questions.json"))
    .sort((left, right) => left.localeCompare(right));

  for (const file of questionFiles) {
    const questions = await readQuestionFile(join(outputDir, file), file);
    if (questions.length === 0) continue;

    const id = file.replace(/\.questions\.json$/, "");
    const title = id.replace(/^\d+-/, "").replace(/-/g, " ");
    result.chapters.push({
      id,
      title,
      questionCount: questions.length,
      path: file,
    });
    result.questions[id] = questions;
  }

  return result;
}

async function readQuestionFile(filePath: string, filename: string): Promise<Question[]> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new PracticeLibraryError("INVALID_FILE", `题库文件 ${filename} 不是有效的 JSON。`, {
      cause: error,
    });
  }

  if (!Array.isArray(value) || !value.every(isQuestion)) {
    throw new PracticeLibraryError("INVALID_FILE", `题库文件 ${filename} 的题目结构无效。`);
  }

  return value;
}

function isQuestion(value: unknown): value is Question {
  if (!isRecord(value)) return false;

  return (
    typeof value.number === "string" &&
    typeof value.type === "string" &&
    typeof value.stem === "string" &&
    Array.isArray(value.options) &&
    value.options.every((option) => typeof option === "string") &&
    typeof value.correctAnswer === "string" &&
    typeof value.correctAnswerText === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function emptyLibrary(): PracticeLibraryPayload {
  return { chapters: [], questions: {} };
}
