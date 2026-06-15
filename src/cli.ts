import { chromium } from "playwright";
import fs from "fs-extra";
import path from "node:path";
import process from "node:process";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import TurndownService from "turndown";

import {
  collectAssignmentLinks,
  collectAssignmentTaskLinks,
  collectCourseLinks,
  openAssignmentList,
  saveLoginQrCode,
  saveAssignmentPage,
  writeDebugSnapshot,
} from "./browser.js";
import { combineAssignmentReviews } from "./clean.js";
import { isReadyToReadUrl, resolveCourseQueryInput, selectCourseEntry } from "./core.js";
import type { CourseEntry, FindAssignmentLinksOptions, ManifestItem } from "./types.js";
import type { Page } from "playwright";

const DEFAULT_START_URL = "https://i.chaoxing.com/";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const profileDir = path.resolve(options.profile ?? ".xxt-profile");
  const outDir = path.resolve(options.out ?? "output");
  const startUrl = options.url ?? DEFAULT_START_URL;
  const limit = options.limit ? Number(options.limit) : undefined;

  await fs.ensureDir(outDir);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();
  const rl = readline.createInterface({ input, output });

  try {
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });

    console.log("浏览器已打开。请登录学习通；检测到二维码会保存到输出目录，扫码后会自动继续抓取。");
    await waitForReadyPage(page, outDir);

    const links = await findAssignmentLinks({
      page,
      context,
      outDir,
      rl,
      courseQuery: options.course,
    });
    const selectedLinks = Number.isFinite(limit) ? links.slice(0, limit) : links;

    await fs.writeJson(path.join(outDir, "assignment-links.json"), selectedLinks, {
      spaces: 2,
    });

    if (selectedLinks.length === 0) {
      await writeDebugSnapshot(page, outDir);
      console.log("没有在当前页面发现疑似作业链接。你可以进入更具体的作业列表页后再运行一次。");
      console.log(`已保存调试文件：${path.join(outDir, "debug-page.json")}`);
      return;
    }

    console.log(`发现 ${selectedLinks.length} 个疑似作业/测验链接，开始保存详情页。`);

    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    const manifest = [];
    for (const [offset, link] of selectedLinks.entries()) {
      const index = offset + 1;
      console.log(`[${index}/${selectedLinks.length}] ${link.text || link.href}`);

      const saved = await saveAssignmentPage({
        context,
        link,
        index,
        outDir,
        turndown,
      });

      manifest.push(saved);
    }

    await fs.writeJson(path.join(outDir, "manifest.json"), manifest, {
      spaces: 2,
    });
    await writeCombinedReview(outDir, manifest);

    console.log(`保存完成：${outDir}`);
  } finally {
    rl.close();
    await context.close();
  }
}

async function waitForReadyPage(page: Page, outDir: string, timeoutMs = 180_000): Promise<void> {
  const startedAt = Date.now();
  let lastQrKey = "";

  while (Date.now() - startedAt < timeoutMs) {
    if (isReadyToReadUrl(page.url())) {
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      console.log(`已检测到可读取页面：${page.url()}`);
      return;
    }

    const qr = await saveLoginQrCode(page, outDir).catch((error: unknown) => {
      console.log(`二维码保存失败：${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    });

    const qrKey = qr ? `${qr.uuid ?? ""}:${qr.imageUrl}:${qr.expired}` : "";
    if (qr && qrKey !== lastQrKey) {
      lastQrKey = qrKey;
      console.log(`检测到学习通扫码登录二维码：${path.join(outDir, qr.imageFile)}`);
      console.log(`二维码地址：${qr.imageUrl}`);
      if (qr.uuid) {
        console.log(`二维码 uuid：${qr.uuid}`);
      }
      if (qr.expired) {
        console.log("二维码已失效，已尝试刷新；如果仍无法扫码，请重新运行。");
      }
    }

    await page.waitForTimeout(1000);
  }

  throw new Error("等待登录后的学习通页面超时，请确认已经打开个人空间或课程页。");
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

async function findAssignmentLinks({ page, context, outDir, rl, courseQuery }: FindAssignmentLinksOptions) {
  const currentTaskLinks = await collectAssignmentTaskLinks(page);
  if (currentTaskLinks.length > 0) {
    return currentTaskLinks;
  }

  const courseLinks = await collectCourseLinks(page);
  await fs.writeJson(path.join(outDir, "course-links.raw.json"), courseLinks, {
    spaces: 2,
  });

  if (courseLinks.length === 0) {
    return [];
  }

  console.log(`当前页没有发现作业链接，但发现 ${courseLinks.length} 个课程入口。`);

  const courses: CourseEntry[] = courseLinks.map((link, index) => ({
    ...link,
    index: index + 1,
    title: link.text || `课程 ${index + 1}`,
  }));

  await fs.writeJson(path.join(outDir, "course-links.json"), courses, {
    spaces: 2,
  });

  for (const course of courses) {
    console.log(`${course.index}. ${course.title}`);
  }

  const query = resolveCourseQueryInput(
    courseQuery ?? (await rl.question("请输入课程序号或关键词（直接回车默认：第 1 项）：")),
  );

  const selectedCourse = selectCourseEntry(courses, query);
  if (!selectedCourse) {
    console.log(`没有找到匹配课程：${query}`);
    console.log(`已保存课程列表：${path.join(outDir, "course-links.json")}`);
    return [];
  }

  console.log(`进入课程：${selectedCourse.title}`);
  await page.goto(selectedCourse.finalUrl || selectedCourse.href, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

  const openedWorkList = await openAssignmentList(page);
  if (!openedWorkList) {
    console.log("没有在课程页找到“作业”导航。");
  }

  const courseTaskLinks = await collectAssignmentTaskLinks(page);
  if (courseTaskLinks.length > 0) {
    return courseTaskLinks;
  }

  const fallbackLinks = await collectAssignmentLinks(page);
  if (fallbackLinks.length > 0) {
    console.log("没有发现具体 work/task 链接，改用当前页面上的疑似作业链接。");
    return fallbackLinks;
  }

  await writeDebugSnapshot(page, outDir);
  console.log("已进入课程，但仍未发现作业/测验链接。");
  console.log("你可以在打开的浏览器里点到课程内的“作业/考试/测验”页，再按当前流程重新运行。");
  console.log(`已保存课程页调试文件：${path.join(outDir, "debug-page.json")}`);
  return [];
}

function parseArgs(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? args[index + 1] ?? "";

    if (inlineValue === undefined) {
      index += 1;
    }

    options[key] = value;
  }

  return options;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
