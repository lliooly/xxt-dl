import { resolve } from "node:path";
import { NextResponse } from "next/server";

import {
  loadPracticeLibrary,
  PracticeLibraryError,
} from "@/src/web/practice-library";

/** Serve practice chapters and questions from the local output directory. */
export async function GET() {
  try {
    return NextResponse.json(
      await loadPracticeLibrary(resolve(process.cwd(), "output")),
    );
  } catch (error) {
    const message = error instanceof PracticeLibraryError
      ? error.message
      : "本地题库接口处理失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
