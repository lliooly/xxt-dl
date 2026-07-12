import fs from "fs-extra";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import TurndownService from "turndown";

import {
  collectAssignmentLinks,
  collectAssignmentTaskLinks,
  collectCourseLinks,
  openAssignmentList,
  saveAssignmentPage,
  saveLoginQrCode,
  writeDebugSnapshot,
} from "../browser.js";
import { combineAssignmentReviews } from "../clean.js";
import { isReadyToReadUrl, resolveCourseQueryInput, selectCourseEntry } from "../core.js";
import type { CourseEntry, Link, ManifestItem, SavedLoginQrCode } from "../types.js";

export type DownloadStatus =
  | "idle"
  | "starting"
  | "waiting-login"
  | "selecting-course"
  | "collecting"
  | "downloading"
  | "done"
  | "error"
  | "stopped";

export interface DownloadProgress {
  current: number;
  total: number;
  label: string;
}

export interface DownloadDoneResult {
  outDir: string;
  total: number;
}

export interface DownloadQrCode extends SavedLoginQrCode {
  dataUrl?: string;
}

export interface StartDownloadInput {
  courseQuery?: string;
  limit?: number;
}

export interface DownloadOptions {
  profileDir: string;
  outDir: string;
  startUrl: string;
  courseQuery?: string;
  limit?: number;
  headless?: boolean;
}

export interface DownloadHandlers {
  status?: (status: DownloadStatus) => void;
  log?: (message: string) => void;
  qr?: (qr: DownloadQrCode) => void;
  courses?: (courses: CourseEntry[]) => void;
  progress?: (progress: DownloadProgress) => void;
  done?: (result: DownloadDoneResult) => void;
  error?: (message: string) => void;
}

export class DownloadJob {
  private stopped = false;
  private context?: BrowserContext;
  private courseSelection?: (value: string) => void;

  constructor(
    private readonly options: DownloadOptions,
    private readonly handlers: DownloadHandlers,
  ) {}

  selectCourse(value: string): void {
    this.courseSelection?.(value);
    this.courseSelection = undefined;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.selectCourse("");
    await this.context?.close().catch(() => {});
  }

  async run(): Promise<void> {
    this.emitStatus("starting");
    await fs.ensureDir(this.options.outDir);

    const { chromium } = await import("playwright");
    this.context = await chromium.launchPersistentContext(this.options.profileDir, {
      headless: this.options.headless ?? true,
      viewport: { width: 1400, height: 900 },
    });

    const page = await this.context.newPage();

    try {
      this.log("正在打开学习通。");
      await page.goto(this.options.startUrl, { waitUntil: "domcontentloaded" });
      this.emitStatus("waiting-login");
      await this.waitForReadyPage(page);

      this.emitStatus("collecting");
      const links = await this.findAssignmentLinks(page);
      const selectedLinks = Number.isFinite(this.options.limit) ? links.slice(0, this.options.limit) : links;

      await fs.writeJson(path.join(this.options.outDir, "assignment-links.json"), selectedLinks, {
        spaces: 2,
      });

      if (selectedLinks.length === 0) {
        await writeDebugSnapshot(page, this.options.outDir);
        this.log("没有发现作业链接，已保存调试文件。");
        this.emitStatus("done");
        this.handlers.done?.({ outDir: this.options.outDir, total: 0 });
        return;
      }

      await this.saveAssignments(selectedLinks);
    } catch (error) {
      if (this.stopped) {
        this.emitStatus("stopped");
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.emitStatus("error");
      this.handlers.error?.(message);
      throw error;
    } finally {
      await this.context?.close().catch(() => {});
      this.context = undefined;
    }
  }

  private async waitForReadyPage(page: Page, timeoutMs = 180_000): Promise<void> {
    const startedAt = Date.now();
    let lastQrKey = "";

    while (Date.now() - startedAt < timeoutMs) {
      this.throwIfStopped();

      if (isReadyToReadUrl(page.url())) {
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        this.log("已检测到登录后的学习通页面。");
        return;
      }

      const qr = await saveLoginQrCode(page, this.options.outDir).catch((error: unknown) => {
        this.log(`二维码保存失败：${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      });

      const qrKey = qr ? `${qr.uuid ?? ""}:${qr.imageUrl}:${qr.expired}` : "";
      if (qr && qrKey !== lastQrKey) {
        lastQrKey = qrKey;
        this.log(qr.expired ? "二维码已失效，已尝试刷新。" : "已获取扫码登录二维码。");
        this.handlers.qr?.({
          ...qr,
          dataUrl: await imageFileToDataUrl(path.join(this.options.outDir, qr.imageFile)),
        });
      }

      await page.waitForTimeout(1000);
    }

    throw new Error("等待登录后的学习通页面超时。");
  }

  private async findAssignmentLinks(page: Page): Promise<Link[]> {
    const currentTaskLinks = await collectAssignmentTaskLinks(page);
    if (currentTaskLinks.length > 0) {
      this.log(`当前页发现 ${currentTaskLinks.length} 个作业任务链接。`);
      return currentTaskLinks;
    }

    const courseLinks = await collectCourseLinks(page);
    await fs.writeJson(path.join(this.options.outDir, "course-links.raw.json"), courseLinks, {
      spaces: 2,
    });

    if (courseLinks.length === 0) {
      return [];
    }

    const courses: CourseEntry[] = courseLinks.map((link, index) => ({
      ...link,
      index: index + 1,
      title: link.text || `课程 ${index + 1}`,
    }));

    await fs.writeJson(path.join(this.options.outDir, "course-links.json"), courses, {
      spaces: 2,
    });

    const selectedCourse = await this.chooseCourse(courses);
    if (!selectedCourse) {
      this.log("没有选择课程，已停止读取。");
      return [];
    }

    this.log(`进入课程：${selectedCourse.title}`);
    await page.goto(selectedCourse.finalUrl || selectedCourse.href, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    if (!(await openAssignmentList(page))) {
      this.log("没有在课程页找到“作业”导航。");
    }

    const courseTaskLinks = await collectAssignmentTaskLinks(page);
    if (courseTaskLinks.length > 0) {
      return courseTaskLinks;
    }

    const fallbackLinks = await collectAssignmentLinks(page);
    if (fallbackLinks.length > 0) {
      this.log("没有发现具体 work/task 链接，改用疑似作业链接。");
      return fallbackLinks;
    }

    await writeDebugSnapshot(page, this.options.outDir);
    this.log("已进入课程，但仍未发现作业/测验链接。");
    return [];
  }

  private async chooseCourse(courses: CourseEntry[]): Promise<CourseEntry | undefined> {
    const query = this.options.courseQuery ?? (await this.waitForCourseSelection(courses));
    const resolvedQuery = resolveCourseQueryInput(query);
    const selectedCourse = selectCourseEntry(courses, resolvedQuery);

    if (!selectedCourse) {
      this.log(`没有找到匹配课程：${resolvedQuery}`);
    }

    return selectedCourse;
  }

  private waitForCourseSelection(courses: CourseEntry[]): Promise<string> {
    this.emitStatus("selecting-course");
    this.handlers.courses?.(courses);

    return new Promise((resolve) => {
      this.courseSelection = resolve;
    });
  }

  private async saveAssignments(links: Link[]): Promise<void> {
    this.emitStatus("downloading");
    this.log(`发现 ${links.length} 个作业/测验链接，开始保存详情页。`);

    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    const manifest: ManifestItem[] = [];
    for (const [offset, link] of links.entries()) {
      this.throwIfStopped();

      const index = offset + 1;
      const label = link.text || link.href;
      this.handlers.progress?.({ current: index, total: links.length, label });
      this.log(`[${index}/${links.length}] ${label}`);

      manifest.push(
        await saveAssignmentPage({
          context: this.context!,
          link,
          index,
          outDir: this.options.outDir,
          turndown,
        }),
      );
    }

    await fs.writeJson(path.join(this.options.outDir, "manifest.json"), manifest, { spaces: 2 });
    await writeCombinedReview(this.options.outDir, manifest);

    this.emitStatus("done");
    this.handlers.done?.({ outDir: this.options.outDir, total: manifest.length });
  }

  private emitStatus(status: DownloadStatus): void {
    this.handlers.status?.(status);
  }

  private log(message: string): void {
    this.handlers.log?.(message);
  }

  private throwIfStopped(): void {
    if (this.stopped) {
      throw new Error("下载已停止。");
    }
  }
}

async function writeCombinedReview(outDir: string, manifest: ManifestItem[]): Promise<void> {
  const reviews: string[] = [];

  for (const item of manifest) {
    if (!item.cleanMarkdown) {
      continue;
    }

    const reviewPath = path.join(outDir, item.cleanMarkdown);
    if (await fs.pathExists(reviewPath)) {
      reviews.push(await fs.readFile(reviewPath, "utf8"));
    }
  }

  await fs.writeFile(path.join(outDir, "题库整理.md"), combineAssignmentReviews(reviews), "utf8");
}

async function imageFileToDataUrl(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
