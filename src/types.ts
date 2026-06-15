import type TurndownService from "turndown";
import type { BrowserContext, Page } from "playwright";
import type { Interface as ReadlineInterface } from "node:readline/promises";

export interface Link {
  text: string;
  href: string;
}

export interface RawLinkItem {
  tag?: string;
  text?: string;
  href?: string;
  data?: string;
  onclick?: string;
  title?: string;
  ariaLabel?: string;
  dataset?: Record<string, string>;
}

export interface CourseEntry extends Link {
  index?: number;
  title?: string;
  finalUrl?: string;
  error?: string;
}

export interface Question {
  number: string;
  type: string;
  stem: string;
  options: string[];
  correctAnswer: string;
  correctAnswerText: string;
}

export interface Assignment {
  title: string;
  questions: Question[];
}

export interface ManifestItem {
  title: string;
  href: string;
  markdown?: string;
  html?: string;
  cleanMarkdown?: string;
  questions?: string;
}

export interface SaveAssignmentPageOptions {
  context: BrowserContext;
  link: Link;
  index: number;
  outDir: string;
  turndown: TurndownService;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
}

export interface FindAssignmentLinksOptions {
  page: Page;
  context: BrowserContext;
  outDir: string;
  rl: ReadlineInterface;
  courseQuery?: string;
}
