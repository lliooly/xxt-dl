import assert from "node:assert/strict";
import test from "node:test";

import { parseWrongEntries } from "../src/practice/wrong-book.js";

const validEntry = {
  question: {
    number: "1",
    type: "单选题",
    stem: "示例题",
    options: ["A. 甲", "B. 乙"],
    correctAnswer: "A",
    correctAnswerText: "甲",
  },
  chapterId: "chapter-1",
  chapterTitle: "第一章",
  userAnswer: "B",
  timestamp: 1,
  reviewCount: 0,
  mastered: false,
};

test("parseWrongEntries accepts valid persisted entries", () => {
  assert.deepEqual(parseWrongEntries(JSON.stringify([validEntry])), [validEntry]);
});

test("parseWrongEntries rejects malformed JSON and invalid entry fields", () => {
  for (const raw of [
    "{invalid",
    JSON.stringify([null]),
    JSON.stringify([{ ...validEntry, mastered: "false" }]),
    JSON.stringify([{ ...validEntry, question: { stem: "缺少字段" } }]),
  ]) {
    assert.deepEqual(parseWrongEntries(raw), []);
  }
});
