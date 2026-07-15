import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadPracticeLibrary,
  PracticeLibraryError,
} from "../src/web/practice-library.js";

const validQuestion = {
  number: "1",
  type: "单选题",
  stem: "示例题",
  options: ["A. 甲", "B. 乙"],
  correctAnswer: "A",
  correctAnswerText: "甲",
};

async function withTempDir(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "xxt-practice-library-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("loadPracticeLibrary treats a missing output directory as an empty library", async () => {
  await withTempDir(async (directory) => {
    assert.deepEqual(await loadPracticeLibrary(join(directory, "missing")), {
      chapters: [],
      questions: {},
    });
  });
});

test("loadPracticeLibrary rejects malformed JSON instead of returning an empty library", async () => {
  await withTempDir(async (directory) => {
    await writeFile(join(directory, "001-broken.questions.json"), "{invalid", "utf8");

    await assert.rejects(
      loadPracticeLibrary(directory),
      (error: unknown) =>
        error instanceof PracticeLibraryError &&
        error.code === "INVALID_FILE" &&
        error.message.includes("001-broken.questions.json"),
    );
  });
});

test("loadPracticeLibrary rejects question files with invalid field types", async () => {
  await withTempDir(async (directory) => {
    await writeFile(
      join(directory, "001-invalid.questions.json"),
      JSON.stringify([{ ...validQuestion, options: "A. 甲" }]),
      "utf8",
    );

    await assert.rejects(
      loadPracticeLibrary(directory),
      (error: unknown) =>
        error instanceof PracticeLibraryError && error.code === "INVALID_FILE",
    );
  });
});

test("loadPracticeLibrary loads valid files in stable filename order", async () => {
  await withTempDir(async (directory) => {
    await writeFile(
      join(directory, "002-second-chapter.questions.json"),
      JSON.stringify([{ ...validQuestion, stem: "第二题" }]),
      "utf8",
    );
    await writeFile(
      join(directory, "001-first-chapter.questions.json"),
      JSON.stringify([validQuestion]),
      "utf8",
    );
    await writeFile(join(directory, "003-empty.questions.json"), "[]", "utf8");

    const result = await loadPracticeLibrary(directory);

    assert.deepEqual(result.chapters.map(({ id, title, questionCount }) => ({
      id,
      title,
      questionCount,
    })), [
      { id: "001-first-chapter", title: "first chapter", questionCount: 1 },
      { id: "002-second-chapter", title: "second chapter", questionCount: 1 },
    ]);
    assert.deepEqual(Object.keys(result.questions), [
      "001-first-chapter",
      "002-second-chapter",
    ]);
  });
});
