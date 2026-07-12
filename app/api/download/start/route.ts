import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, parseStartInput, readJsonRequest } from "@/src/web/download-api";
import { webDownloadTaskService } from "@/src/web/download-task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = parseStartInput(await readJsonRequest(request));
    return NextResponse.json({ state: webDownloadTaskService.start(input) }, { status: 201 });
  } catch (error) {
    if (!(error instanceof Error)) console.error("启动下载任务失败", error);
    const result = apiErrorResponse(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
