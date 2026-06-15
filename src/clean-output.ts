import { chromium } from "playwright";
import fs from "fs-extra";
import path from "node:path";
import process from "node:process";

import { combineAssignmentReviews, extractAssignmentFromDocument, formatAssignmentReview } from "./clean.js";

const outDir = path.resolve(process.argv[2] ?? "output");
const manifestPath = path.join(outDir, "manifest.json");

async function main() {
  const manifest = await fs.readJson(manifestPath);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const aggregate = [];
  const updatedManifest = [];

  try {
    for (const item of manifest) {
      if (!item.html) {
        updatedManifest.push(item);
        continue;
      }

      const htmlPath = path.join(outDir, item.html);
      const html = await fs.readFile(htmlPath, "utf8");
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const assignment = await page.evaluate(extractAssignmentFromDocument);
      const title = assignment.title || item.title;
      const cleanMarkdown = formatAssignmentReview({
        title,
        sourceUrl: item.href,
        questions: assignment.questions,
      });

      const base = item.html.replace(/\.html$/i, "");
      const cleanMarkdownFile = `${base}.clean.md`;
      const questionsFile = `${base}.questions.json`;

      await fs.writeFile(path.join(outDir, cleanMarkdownFile), cleanMarkdown, "utf8");
      await fs.writeJson(path.join(outDir, questionsFile), assignment.questions, {
        spaces: 2,
      });

      aggregate.push(cleanMarkdown);
      updatedManifest.push({
        ...item,
        cleanMarkdown: cleanMarkdownFile,
        questions: questionsFile,
      });

      console.log(`${item.html}: ${assignment.questions.length} 题`);
    }

    await fs.writeFile(path.join(outDir, "题库整理.md"), combineAssignmentReviews(aggregate), "utf8");
    await fs.writeJson(manifestPath, updatedManifest, { spaces: 2 });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
