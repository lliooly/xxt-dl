import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import type { Question } from "@/src/types";
import type { PracticeChapter } from "@/src/practice/types";

/** Serve practice chapters and questions from the local output directory. */
export async function GET(_request: NextRequest) {
  try {
    const outputDir = resolve(process.cwd(), "output");
    let files: string[];
    try {
      files = await readdir(outputDir);
    } catch {
      return NextResponse.json({ chapters: [], questions: {} });
    }

    const jsonFiles = files.filter((f) => f.endsWith(".questions.json")).sort();

    const chapters: PracticeChapter[] = [];
    const questions: Record<string, Question[]> = {};

    for (const file of jsonFiles) {
      const filePath = join(outputDir, file);
      let parsed: Question[];
      try {
        parsed = JSON.parse(await readFile(filePath, "utf-8"));
      } catch {
        continue;
      }
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      const base = file.replace(/\.questions\.json$/, "");
      const title = base.replace(/^\d+-/, "").replace(/-/g, " ");

      chapters.push({ id: base, title, questionCount: parsed.length, path: file });
      questions[base] = parsed;
    }

    return NextResponse.json({ chapters, questions });
  } catch {
    return NextResponse.json({ chapters: [], questions: {} });
  }
}
