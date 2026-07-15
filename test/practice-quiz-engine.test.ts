import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAnswer,
  createSession,
  createSessionFromQuestions,
  getResults,
  goToQuestion,
  nextQuestion,
  submitAnswer,
} from "../src/practice/quiz-engine.js";
import type { PracticeChapter, PracticeConfig } from "../src/practice/types.js";
import type { Question } from "../src/types.js";

function question(overrides: Partial<Question> = {}): Question {
  return {
    number: "1",
    type: "单选题",
    stem: "示例题",
    options: ["A. 甲", "B. 乙"],
    correctAnswer: "A",
    correctAnswerText: "甲",
    ...overrides,
  };
}

function source(value: Question) {
  return { question: value, chapterId: "chapter-1", chapterTitle: "第一章" };
}

test("checkAnswer preserves Unicode text for fill-in questions", () => {
  const fill = question({
    type: "填空题",
    options: [],
    correctAnswer: "马克思主义 中国化",
    correctAnswerText: "",
  });

  assert.equal(checkAnswer(fill, "马克思主义 中国化"), true);
  assert.equal(checkAnswer(fill, "  马克思主义   中国化  "), true);
  assert.equal(checkAnswer(fill, "   "), false);
  assert.equal(checkAnswer(fill, "马克思主义"), false);
});

test("checkAnswer falls back to answer text for text questions", () => {
  const fill = question({
    type: "填空题",
    options: [],
    correctAnswer: "",
    correctAnswerText: "人民群众",
  });

  assert.equal(checkAnswer(fill, "人民群众"), true);
});

test("checkAnswer keeps multi-select comparison order-independent and strict", () => {
  const multiple = question({ type: "多选题", correctAnswer: "AC" });

  assert.equal(checkAnswer(multiple, "C,A"), true);
  assert.equal(checkAnswer(multiple, "A"), false);
  assert.equal(checkAnswer(multiple, "ABC"), false);
});

test("checkAnswer matches judgement labels with their option letters", () => {
  const judgement = question({
    type: "判断题",
    options: ["A. 正确", "B. 错误"],
    correctAnswer: "√",
    correctAnswerText: "正确",
  });

  assert.equal(checkAnswer(judgement, "A"), true);
  assert.equal(checkAnswer(judgement, "对"), true);
  assert.equal(checkAnswer(judgement, "B"), false);
});

test("submitting one question does not answer the next question", () => {
  const chapter: PracticeChapter = {
    id: "chapter-1",
    title: "第一章",
    questionCount: 2,
    path: "chapter-1.questions.json",
  };
  const chapterMap = new Map([
    [chapter.id, { chapter, questions: [question(), question({ number: "2" })] }],
  ]);
  const session = createSession(
    { mode: "chapter", chapterIds: [chapter.id], shuffle: false },
    chapterMap,
  );

  assert.equal(submitAnswer(session, 0, "A"), true);
  assert.equal(nextQuestion(session), 1);
  assert.equal(session.questions[1].userAnswer, null);
  assert.equal(goToQuestion(session, 0), true);
  assert.equal(session.questions[0].userAnswer, "A");

  const results = getResults(session);
  assert.deepEqual(
    {
      total: results.total,
      correct: results.correct,
      wrong: results.wrong,
      unanswered: results.unanswered,
      score: results.score,
    },
    { total: 2, correct: 1, wrong: 0, unanswered: 1, score: 50 },
  );
});

test("createSession rebuilds wrong-book rounds from the latest source", () => {
  const config: PracticeConfig = { mode: "wrong-book", chapterIds: [], shuffle: false };
  const first = source(question());
  const second = source(question({ number: "2" }));

  assert.equal(createSession(config, new Map(), [first]).questions.length, 1);
  assert.equal(createSession(config, new Map(), [first, second]).questions.length, 2);
  assert.equal(createSessionFromQuestions([first], false).questions.length, 1);
});
