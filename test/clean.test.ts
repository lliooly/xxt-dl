import test from "node:test";
import assert from "node:assert/strict";

import { answerContentFromOptions, combineAssignmentReviews, formatAssignmentReview } from "../src/clean.js";

test("answerContentFromOptions maps answer letters to option text", () => {
  assert.equal(
    answerContentFromOptions("C", [
      "A. 陈独秀",
      "B. 李大钊",
      "C. 毛泽东",
      "D. 瞿秋白",
    ]),
    "毛泽东",
  );

  assert.equal(
    answerContentFromOptions("AB", [
      "A. 实事求是",
      "B. 群众路线",
      "C. 独立自主",
    ]),
    "实事求是；群众路线",
  );
});

test("formatAssignmentReview keeps only title, question, options, and bold correct answer", () => {
  const markdown = formatAssignmentReview({
    title: "第一章作业",
    sourceUrl: "https://example.com/work/task",
    questions: [
      {
        number: "1",
        type: "单选题",
        stem: "在中国共产党历史上,( )第一个明确提出了“马克思主义中国化”。",
        options: ["A. 陈独秀", "B. 李大钊", "C. 毛泽东", "D. 瞿秋白"],
        correctAnswer: "C",
        correctAnswerText: "毛泽东",
      },
    ],
  });

  assert.equal(
    markdown,
    "# 第一章作业\n\n## 1. 单选题\n\n题目：在中国共产党历史上,( )第一个明确提出了“马克思主义中国化”。\n\nA. 陈独秀\nB. 李大钊\nC. 毛泽东\nD. 瞿秋白\n\n**正确答案：C 毛泽东**\n",
  );

  assert.equal(markdown.includes("来源"), false);
  assert.equal(markdown.includes("我的答案"), false);
  assert.equal(markdown.includes("得分"), false);
});

test("combineAssignmentReviews joins non-empty review files", () => {
  assert.equal(
    combineAssignmentReviews(["# 第一章\n\n## 1. 单选题\n", "", "# 第二章\n\n## 1. 单选题\n"]),
    "# 第一章\n\n## 1. 单选题\n\n---\n\n# 第二章\n\n## 1. 单选题",
  );
});
