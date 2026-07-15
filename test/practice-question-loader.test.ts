import assert from "node:assert/strict";
import test from "node:test";

import { parsePracticeResponse } from "../src/practice/question-loader.js";

const payload = {
  chapters: [
    { id: "chapter-1", title: "第一章", questionCount: 1, path: "chapter-1.questions.json" },
  ],
  questions: {
    "chapter-1": [
      {
        number: "1",
        type: "单选题",
        stem: "示例题",
        options: ["A. 甲", "B. 乙"],
        correctAnswer: "A",
        correctAnswerText: "甲",
      },
    ],
  },
};

test("parsePracticeResponse accepts a valid practice payload", async () => {
  assert.deepEqual(
    await parsePracticeResponse(Response.json(payload)),
    payload,
  );
});

test("parsePracticeResponse reports the API error for a non-success response", async () => {
  await assert.rejects(
    parsePracticeResponse(Response.json({ error: "题库文件损坏。" }, { status: 500 })),
    /题库文件损坏/,
  );
});

test("parsePracticeResponse rejects invalid JSON and invalid payload shapes", async () => {
  await assert.rejects(
    parsePracticeResponse(new Response("{invalid")),
    /无效 JSON/,
  );
  await assert.rejects(
    parsePracticeResponse(Response.json({ chapters: "bad", questions: {} })),
    /响应格式无效/,
  );
  await assert.rejects(
    parsePracticeResponse(Response.json({
      chapters: payload.chapters,
      questions: { "chapter-1": [{ stem: "缺少字段" }] },
    })),
    /响应格式无效/,
  );
});
