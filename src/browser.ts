import fs from "fs-extra";
import path from "node:path";
import type { BrowserContext, Frame, Page } from "playwright";

import {
  buildReviewMarkdown,
  collectCandidateLinks,
  collectCourseEntryLinks,
  collectTaskLinks,
  dedupeLinks,
  filenameForAssignment,
  isAssignmentLikeLink,
  isAssignmentTaskLink,
  isCourseEntryLink,
  resolveLoginQrImageUrl,
} from "./core.js";
import { extractAssignmentFromDocument, formatAssignmentReview } from "./clean.js";
import type {
  CourseEntry,
  Link,
  LoginQrCode,
  ManifestItem,
  RawLinkItem,
  SaveAssignmentPageOptions,
  SavedLoginQrCode,
} from "./types.js";

export async function collectAssignmentLinks(page: Page): Promise<Link[]> {
  const links: Link[] = [];

  for (const frame of page.frames()) {
    try {
      const rawItems = await readInteractableItems(frame);
      links.push(...collectCandidateLinks(rawItems, frame.url()));
    } catch {
      // Some third-party frames block evaluation. They are not needed for visible course content.
    }
  }

  return dedupeLinks(links).filter(isAssignmentLikeLink);
}

export async function collectAssignmentTaskLinks(page: Page): Promise<Link[]> {
  const links: Link[] = [];

  for (const frame of page.frames()) {
    try {
      const rawItems = await readInteractableItems(frame);
      links.push(...collectCandidateLinks(rawItems, frame.url()));
    } catch {
      // Some third-party frames block evaluation. They are not needed for visible course content.
    }
  }

  return collectTaskLinks(links);
}

export async function collectCourseLinks(page: Page): Promise<Link[]> {
  const links: Link[] = [];

  for (const frame of page.frames()) {
    try {
      links.push(...(await readCourseCards(frame)));

      const rawItems = await readInteractableItems(frame);
      links.push(...collectCandidateLinks(rawItems, frame.url()));
    } catch {
      // Some third-party frames block evaluation. They are not needed for visible course content.
    }
  }

  return collectCourseEntryLinks(links);
}

export async function readLoginQrCode(page: Page): Promise<LoginQrCode | undefined> {
  for (const frame of page.frames()) {
    try {
      const rawQr = await frame.evaluate(() => {
        const image = document.querySelector("#quickCode, img[src*='createqr']");
        if (!(image instanceof HTMLImageElement)) {
          return undefined;
        }

        const box = image.closest(".ecode-box") || document;
        const disable = box.querySelector(".ewmDisable");
        const disableStyle = disable ? window.getComputedStyle(disable) : undefined;
        const expired = Boolean(
          disableStyle &&
            disableStyle.display !== "none" &&
            disableStyle.visibility !== "hidden" &&
            disableStyle.opacity !== "0",
        );
        const readInput = (selector: string) => (box.querySelector(selector) as HTMLInputElement | null)?.value || "";

        return {
          imageSrc: image.getAttribute("src") || image.src,
          uuid: readInput("#uuid"),
          enc: readInput("#enc"),
          tip: readInput("#QRCodeTip"),
          expired,
          frameUrl: window.location.href,
        };
      });

      const imageUrl = resolveLoginQrImageUrl(rawQr?.imageSrc, rawQr?.frameUrl || frame.url());
      if (imageUrl) {
        return {
          imageUrl,
          uuid: rawQr?.uuid || undefined,
          enc: rawQr?.enc || undefined,
          tip: rawQr?.tip || undefined,
          expired: Boolean(rawQr?.expired),
          frameUrl: rawQr?.frameUrl || frame.url(),
        };
      }
    } catch {
      // Login pages can contain cross-origin frames. Ignore frames that cannot be evaluated.
    }
  }

  return undefined;
}

export async function refreshLoginQrCode(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    const refreshButton = frame.locator(".ewmDisable a, a[onclick*='refrushEwm']").first();
    const count = await refreshButton.count().catch(() => 0);
    if (count === 0) {
      continue;
    }

    const visible = await refreshButton.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    await refreshButton.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }

  return false;
}

export async function saveLoginQrCode(page: Page, outDir: string): Promise<SavedLoginQrCode | undefined> {
  let qr = await readLoginQrCode(page);
  if (!qr) {
    return undefined;
  }

  if (qr.expired && (await refreshLoginQrCode(page))) {
    qr = (await readLoginQrCode(page)) ?? qr;
  }

  await fs.ensureDir(outDir);

  const imageFile = "login-qr.png";
  const metadataFile = "login-qr.json";
  const response = await page.context().request.get(qr.imageUrl);
  if (!response.ok()) {
    throw new Error(`二维码图片下载失败：${response.status()} ${response.statusText()}`);
  }

  const saved: SavedLoginQrCode = {
    ...qr,
    imageFile,
    metadataFile,
    capturedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(outDir, imageFile), await response.body());
  await fs.writeJson(path.join(outDir, metadataFile), saved, { spaces: 2 });

  return saved;
}

export async function resolveCourseLinks(context: BrowserContext, courseLinks: Link[]): Promise<CourseEntry[]> {
  const resolved: CourseEntry[] = [];

  for (const [offset, link] of courseLinks.entries()) {
    const page = await context.newPage();

    try {
      await page.goto(link.href, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });

      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

      resolved.push({
        ...link,
        index: offset + 1,
        title: link.text || (await readCourseTitle(page, link, offset + 1)),
        finalUrl: page.url(),
      });
    } catch (error: unknown) {
      resolved.push({
        ...link,
        index: offset + 1,
        title: link.text || `课程 ${offset + 1}`,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await page.close();
    }
  }

  return resolved;
}

export async function openAssignmentList(page: Page): Promise<boolean> {
  const selectors = [
    "li[dataname='zy']",
    "li[pageheader='8']",
    "a[title='作业']",
    "a[data-url*='/work/list']",
    "a:has-text('作业')",
    "li:has-text('作业')",
  ];

  for (const frame of page.frames()) {
    for (const selector of selectors) {
      const locator = frame.locator(selector).first();
      const count = await locator.count().catch(() => 0);

      if (count === 0) {
        continue;
      }

      const dataUrl = await locator
        .evaluate((element: Element) => {
          const direct =
            element.getAttribute("data-url") ||
            element.getAttribute("dataurl") ||
            element.querySelector("[data-url]")?.getAttribute("data-url") ||
            element.querySelector("[dataurl]")?.getAttribute("dataurl") ||
            "";

          return direct;
        })
        .catch(() => "");

      await locator.click({ timeout: 5000 }).catch(async () => {
        if (dataUrl) {
          await frame.goto(dataUrl);
        }
      });

      await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(1200);

      return true;
    }
  }

  return false;
}

export async function writeDebugSnapshot(page: Page, outDir: string): Promise<void> {
  await fs.ensureDir(outDir);

  const frames = [];
  const candidates = [];

  for (const frame of page.frames()) {
    try {
      const rawItems = (await readInteractableItems(frame)).slice(0, 500);

      frames.push({
        url: frame.url(),
        title: await frame.title().catch(() => ""),
        rawItemCount: rawItems.length,
      });

      candidates.push(
        ...collectCandidateLinks(rawItems, frame.url()).map((candidate) => ({
          frameUrl: frame.url(),
          ...candidate,
          assignmentLike: isAssignmentLikeLink(candidate),
          taskLink: isAssignmentTaskLink(candidate),
          courseEntry: isCourseEntryLink(candidate),
        })),
      );
    } catch (error: unknown) {
      frames.push({
        url: frame.url(),
        title: "",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await fs.writeJson(
    path.join(outDir, "debug-page.json"),
    {
      pageUrl: page.url(),
      pageTitle: await page.title().catch(() => ""),
      frames,
      candidates,
    },
    { spaces: 2 },
  );

  await fs.writeFile(path.join(outDir, "debug-page.html"), await page.content(), "utf8");
  await page.screenshot({ path: path.join(outDir, "debug-page.png"), fullPage: true }).catch(() => {});
}

export async function saveAssignmentPage({
  context,
  link,
  index,
  outDir,
  turndown,
  waitUntil = "networkidle",
}: SaveAssignmentPageOptions): Promise<ManifestItem> {
  const page = await context.newPage();

  try {
    await page.goto(link.href, {
      waitUntil,
      timeout: 45_000,
    });

    const title = await readPageTitle(page, link.text, index);
    const html = await readBodyHtml(page);
    const bodyMarkdown = turndown.turndown(html);
    const assignment = await page.evaluate(extractAssignmentFromDocument).catch(() => ({
      title,
      questions: [],
    }));
    const cleanMarkdown = formatAssignmentReview({
      title: assignment.title || title,
      sourceUrl: link.href,
      questions: assignment.questions,
    });
    const basename = `${String(index).padStart(3, "0")}-${filenameForAssignment(title)}`;

    await fs.writeFile(
      path.join(outDir, `${basename}.md`),
      buildReviewMarkdown({
        title,
        sourceUrl: link.href,
        bodyMarkdown,
      }),
      "utf8",
    );

    await fs.writeFile(path.join(outDir, `${basename}.html`), html, "utf8");
    await fs.writeFile(path.join(outDir, `${basename}.clean.md`), cleanMarkdown, "utf8");
    await fs.writeJson(path.join(outDir, `${basename}.questions.json`), assignment.questions, {
      spaces: 2,
    });

    return {
      title,
      href: link.href,
      markdown: `${basename}.md`,
      html: `${basename}.html`,
      cleanMarkdown: `${basename}.clean.md`,
      questions: `${basename}.questions.json`,
    };
  } finally {
    await page.close();
  }
}

async function readPageTitle(page: Page, fallback: string | undefined, index: number): Promise<string> {
  const heading = await page
    .locator("h1, h2, .title, .work-title, .tit, .task-title")
    .first()
    .innerText({ timeout: 1500 })
    .catch(() => "");

  const browserTitle = await page.title().catch(() => "");
  return heading || browserTitle || fallback || `assignment-${index}`;
}

async function readCourseTitle(page: Page, link: Partial<Link>, index: number): Promise<string> {
  const selectors = [
    ".course-name",
    ".courseName",
    ".coursename",
    ".course-title",
    ".courseTitle",
    ".course-info h1",
    ".course-info h2",
    ".courseCard h3",
    "h1",
    "h2",
    ".title",
  ];

  for (const selector of selectors) {
    const title = await page.locator(selector).first().innerText({ timeout: 700 }).catch(() => "");
    if (title.trim()) {
      return title.trim();
    }
  }

  const browserTitle = await page.title().catch(() => "");
  return browserTitle || link.text || `课程 ${index}`;
}

async function readBodyHtml(page: Page): Promise<string> {
  return page.locator("body").innerHTML({ timeout: 5000 }).catch(async () => {
    const text = await page.locator("body").innerText({ timeout: 5000 });
    return `<pre>${escapeHtml(text)}</pre>`;
  });
}

async function readCourseCards(frame: Frame): Promise<Link[]> {
  return frame.$$eval(
    ".course-name, .courseName, .coursename, [class*='course-name'], [class*='courseName']",
    (elements: Element[]) => {
      const result: Link[] = [];

      for (const element of elements) {
        const htmlElement = element as HTMLElement;
        const title = (
          element.getAttribute("title") ||
          htmlElement.innerText ||
          element.textContent ||
          ""
        ).trim();

        if (!title) {
          continue;
        }

        const scopes = [
          element.closest("a"),
          element.closest("li"),
          element.closest(".course"),
          element.closest(".courseItem"),
          element.closest(".course-card"),
          element.closest(".Mcon"),
          element.closest(".item"),
          element.closest("div"),
          element.parentElement,
        ].filter(Boolean) as Element[];

        let href = "";
        for (const scope of scopes) {
          const anchor = scope.matches?.("a[href*='stucoursemiddle']")
            ? scope
            : scope.querySelector?.("a[href*='stucoursemiddle']");
          if ((anchor as HTMLAnchorElement | null)?.href) {
            href = (anchor as HTMLAnchorElement).href;
            break;
          }
        }

        if (href) {
          result.push({ text: title, href });
        }
      }

      return result;
    },
  );
}

async function readInteractableItems(frame: Frame): Promise<RawLinkItem[]> {
  return frame.$$eval(
    "a, button, [onclick], [data-url], [data-href], [data-link], [data-id], li, tr, div",
    (elements: Element[]) =>
      elements.map((element): RawLinkItem => {
        const htmlElement = element as HTMLElement;
        const anchor = element as HTMLAnchorElement;
        const textSource =
          htmlElement.innerText ||
          element.textContent ||
          htmlElement.title ||
          ((element.closest("li, tr, .course, .courseItem, .course-card, .item, .Mcon, .clearfix") as HTMLElement | null)?.innerText) ||
          "";

        return {
          tag: element.tagName.toLowerCase(),
          text: textSource,
          href: anchor.href || element.getAttribute("href") || "",
          data: element.getAttribute("data") || "",
          onclick: element.getAttribute("onclick") || "",
          title: element.getAttribute("title") || "",
          ariaLabel: element.getAttribute("aria-label") || "",
          dataset: Object.fromEntries(
            Object.entries(htmlElement.dataset).filter((entry): entry is [string, string] => entry[1] !== undefined),
          ),
        };
      }),
  );
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
