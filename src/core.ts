import type { CourseEntry, Link, RawLinkItem } from "./types.js";

const TEXT_HINTS = [
  "作业",
  "查看",
  "答题",
  "测验",
  "考试",
  "练习",
  "提交",
  "批阅",
  "详情",
];

const URL_HINTS = [
  "work",
  "homework",
  "answer",
  "exam",
  "test",
  "quiz",
  "reversiontest",
  "doHomeWork",
  "api/work",
];

const TASK_URL_HINTS = [
  "/mooc-ans/mooc2/work/task",
  "/mooc2/work/task",
  "workid=",
  "answerid=",
];

const COURSE_ENTRY_URL_HINTS = [
  "/mooc-ans/visit/stucoursemiddle",
  "/visit/stucoursemiddle",
];

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const URL_LIKE_PATTERN = /(?:"|')((?:https?:)?\/\/[^"']+|\/[A-Za-z0-9_./?=&%:+#;-]+)(?:"|')/g;
const UNUSABLE_HREF_PATTERN = /^(?:#|javascript:|void\(0\)|about:blank$)/i;

export function isAssignmentLikeLink(link: Partial<Link> | undefined): boolean {
  const text = compact(link?.text ?? "");
  const href = String(link?.href ?? "");

  if (!href) {
    return false;
  }

  const lowerHref = href.toLowerCase();
  return (
    TEXT_HINTS.some((hint) => text.includes(hint)) ||
    URL_HINTS.some((hint) => lowerHref.includes(hint.toLowerCase()))
  );
}

export function isAssignmentTaskLink(link: Partial<Link> | undefined): boolean {
  const href = String(link?.href ?? "").toLowerCase();

  if (!href) {
    return false;
  }

  return TASK_URL_HINTS.some((hint) => href.includes(hint.toLowerCase()));
}

export function isCourseEntryLink(link: Partial<Link> | undefined): boolean {
  const href = String(link?.href ?? "").toLowerCase();

  if (!href) {
    return false;
  }

  return COURSE_ENTRY_URL_HINTS.some((hint) => href.includes(hint.toLowerCase()));
}

export function dedupeLinks<T extends Partial<Link>>(links: T[]): Link[] {
  const seen = new Set();
  const result = [];

  for (const link of links) {
    const href = String(link?.href ?? "").trim();
    if (!href || seen.has(href)) {
      continue;
    }

    seen.add(href);
    result.push({
      text: compact(link?.text ?? ""),
      href,
    });
  }

  return result;
}

export function collectCourseEntryLinks(links: Partial<Link>[]): Link[] {
  return dedupeLinks(links).filter(isCourseEntryLink);
}

export function collectTaskLinks(links: Partial<Link>[]): Link[] {
  return dedupeLinks(links).filter(isAssignmentTaskLink);
}

export function selectCourseEntry<T extends Partial<CourseEntry>>(courses: T[], query: string): T | undefined {
  const normalizedQuery = normalizeCourseQuery(query);

  if (!normalizedQuery) {
    return undefined;
  }

  const index = Number(normalizedQuery);
  if (Number.isInteger(index) && index > 0) {
    return courses.find((course) => course.index === index) ?? courses[index - 1];
  }

  return courses.find((course) => courseMatches(course, normalizedQuery));
}

export function resolveCourseQueryInput(value: unknown): string {
  return compact(value) || "1";
}

export function collectCandidateLinks(rawItems: RawLinkItem[], baseUrl: string): Link[] {
  const links: Link[] = [];

  for (const item of rawItems) {
    const text = compact(item?.text ?? "");
    const values = [
      item?.href,
      item?.data,
      item?.onclick,
      item?.title,
      item?.ariaLabel,
      ...Object.values(item?.dataset ?? {}),
    ];

    for (const value of values) {
      const directUrl = normalizeUrl(value, baseUrl);
      if (directUrl) {
        links.push({ text, href: directUrl });
      }

      for (const extractedUrl of extractUrlsFromText(value, baseUrl)) {
        links.push({ text, href: extractedUrl });
      }
    }
  }

  return dedupeLinks(links);
}

export function extractUrlsFromText(value: unknown, baseUrl: string): string[] {
  const text = String(value ?? "");
  const matches = [];

  for (const match of text.matchAll(URL_LIKE_PATTERN)) {
    const url = normalizeUrl(match[1], baseUrl);
    if (url) {
      matches.push(url);
    }
  }

  return [...new Set(matches)];
}

export function normalizeUrl(value: unknown, baseUrl: string): string {
  const candidate = String(value ?? "").trim();

  if (!candidate || UNUSABLE_HREF_PATTERN.test(candidate)) {
    return "";
  }

  if (!candidate.startsWith("http") && !candidate.startsWith("/") && !candidate.startsWith("//")) {
    return "";
  }

  try {
    return new URL(candidate, baseUrl).href;
  } catch {
    return "";
  }
}

export function resolveLoginQrImageUrl(src: unknown, baseUrl: string): string {
  const url = normalizeUrl(src, baseUrl);

  if (!url) {
    return "";
  }

  return url.includes("/createqr") ? url : "";
}

export function filenameForAssignment(title: unknown, fallback = "assignment"): string {
  const cleaned = compact(String(title ?? "").replace(INVALID_FILENAME_CHARS, " "));
  return cleaned.slice(0, 90) || fallback;
}

export function buildReviewMarkdown({
  title,
  bodyMarkdown,
}: {
  title: string;
  sourceUrl?: string;
  bodyMarkdown: string;
}): string {
  return `# ${title}\n\n${bodyMarkdown.trim()}\n`;
}

export function compact(value: unknown): string {
  return String(value).replace(/\s+/g, " ").trim();
}

export function isReadyToReadUrl(value: unknown): boolean {
  const url = String(value ?? "").toLowerCase();

  return (
    url.includes("i.chaoxing.com/base") ||
    url.includes("mooc1-1.chaoxing.com/visit/interaction") ||
    url.includes("mooc1.chaoxing.com/visit/interaction") ||
    url.includes("mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu") ||
    url.includes("/mooc2/work/list") ||
    url.includes("/mooc2/work/task")
  );
}

function courseMatches(course: Partial<CourseEntry>, normalizedQuery: string): boolean {
  const title = normalizeCourseQuery(`${course?.title ?? ""} ${course?.text ?? ""}`);

  if (title.includes(normalizedQuery)) {
    return true;
  }

  if (normalizedQuery.includes("毛概")) {
    return title.includes("毛泽东思想") || title.includes("中国特色社会主义理论体系概论");
  }

  if (normalizedQuery.includes("习概") || normalizedQuery.includes("习毛概")) {
    return (
      title.includes("习近平新时代中国特色社会主义思想概论") ||
      title.includes("毛泽东思想") ||
      title.includes("中国特色社会主义理论体系概论")
    );
  }

  return false;
}

function normalizeCourseQuery(value: unknown): string {
  return compact(value).toLowerCase().replace(/\s+/g, "");
}
