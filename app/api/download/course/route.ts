import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, parseCourseInput, readJsonRequest } from "@/src/web/download-api";
import { webDownloadTaskService } from "@/src/web/download-task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { taskId, course } = parseCourseInput(await readJsonRequest(request));
    return NextResponse.json({ state: webDownloadTaskService.selectCourse(taskId, course) });
  } catch (error) {
    const result = apiErrorResponse(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
