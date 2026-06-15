import type { Assignment, Question } from "./types.js";

export function formatAssignmentReview({
  title,
  questions,
}: {
  title: string;
  sourceUrl?: string;
  questions: Question[];
}): string {
  const parts = [`# ${cleanText(title || "未命名作业")}`];

  for (const question of questions) {
    const heading = [question.number, question.type].filter(Boolean).join(". ");
    parts.push(`## ${heading || "题目"}`);
    parts.push(`题目：${cleanText(question.stem)}`);

    if (question.options?.length) {
      parts.push(question.options.map(cleanText).filter(Boolean).join("\n"));
    }

    const answer = formatCorrectAnswer(question);
    if (answer) {
      parts.push(`**正确答案：${answer}**`);
    }
  }

  return `${parts.filter(Boolean).join("\n\n")}\n`;
}

export function combineAssignmentReviews(reviews: unknown[]): string {
  return reviews.map((review) => String(review ?? "").trim()).filter(Boolean).join("\n\n---\n\n");
}

export function answerContentFromOptions(answer: unknown, options: string[]): string {
  const letters = answerLetters(answer);
  if (letters.length === 0) {
    return "";
  }

  const optionMap = new Map();
  for (const option of options ?? []) {
    const parsed = parseOption(option);
    if (parsed) {
      optionMap.set(parsed.letter, parsed.content);
    }
  }

  return letters.map((letter) => optionMap.get(letter)).filter(Boolean).join("；");
}

export function normalizeQuestion(question: Partial<Question>): Question {
  const options = (question.options ?? []).map(cleanText).filter(Boolean);
  const correctAnswer = cleanText(question.correctAnswer);
  const correctAnswerText =
    cleanText(question.correctAnswerText) || answerContentFromOptions(correctAnswer, options);

  return {
    number: cleanText(question.number),
    type: cleanText(question.type).replace(/^\(|\)$/g, ""),
    stem: cleanText(question.stem),
    options,
    correctAnswer,
    correctAnswerText,
  };
}

export function extractAssignmentFromDocument(): Assignment {
  const title = textOf(document.querySelector(".mark_title")) || document.title || "未命名作业";
  const questions = [...document.querySelectorAll(".questionLi")].map((element, index) =>
    extractQuestion(element, index + 1),
  );

  return {
    title,
    questions: questions.filter((question) => question.stem || question.correctAnswer || question.options.length),
  };

  function extractQuestion(element: Element, fallbackNumber: number): Question {
    const header = element.querySelector(".mark_name");
    const number = readQuestionNumber(header, fallbackNumber);
    const type = textOf(header?.querySelector(".colorShallow")).replace(/^\(|\)$/g, "");
    const stem = textOf(header?.querySelector(".qtContent"));
    const options = [...element.querySelectorAll(".qtDetail li")].map(textOf).filter(Boolean);
    const correctAnswer = textOf(element.querySelector(".rightAnswerContent"));
    const correctAnswerText = readAnswerText(element, ".rightAnswerContent", correctAnswer, options);

    return {
      number,
      type,
      stem,
      options,
      correctAnswer,
      correctAnswerText,
    };
  }

  function readQuestionNumber(header: Element | null | undefined, fallbackNumber: number): string {
    const ownText = [...(header?.childNodes ?? [])]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ");
    const match = ownText.match(/\d+/);
    return match?.[0] || String(fallbackNumber);
  }

  function readAnswerText(questionElement: Element, selector: string, answer: string, options: string[]): string {
    const answerElement = questionElement.querySelector(selector);
    const hiddenText = textOf(answerElement?.parentElement?.nextElementSibling)
      .replace(/^[:：]/, "")
      .replace(/[;；]\s*$/, "");

    return hiddenText || answerTextFromOptions(answer, options);
  }

  function textOf(value: Element | null | undefined): string {
    return (((value as HTMLElement | null | undefined)?.innerText) || value?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function answerTextFromOptions(answer: unknown, options: string[]): string {
    const letters = String(answer ?? "")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .split("");
    const optionMap = new Map();

    for (const option of options ?? []) {
      const match = String(option ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .match(/^([A-Z])\s*[.．、]\s*(.+)$/i);
      if (match) {
        optionMap.set(match[1].toUpperCase(), match[2].trim());
      }
    }

    return letters.map((letter) => optionMap.get(letter)).filter(Boolean).join("；");
  }
}

function formatCorrectAnswer(question: Partial<Question>): string {
  const normalized = normalizeQuestion(question);
  return [normalized.correctAnswer, normalized.correctAnswerText].filter(Boolean).join(" ");
}

function answerLetters(answer: unknown): string[] {
  const text = cleanText(answer).replace(/[^A-Za-z]/g, "").toUpperCase();
  return [...text];
}

function parseOption(option: unknown): { letter: string; content: string } | undefined {
  const match = cleanText(option).match(/^([A-Z])\s*[.．、]\s*(.+)$/i);
  if (!match) {
    return undefined;
  }

  return {
    letter: match[1].toUpperCase(),
    content: match[2].trim(),
  };
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
