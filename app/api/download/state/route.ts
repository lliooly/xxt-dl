import { NextResponse } from "next/server";
import { webDownloadTaskService } from "@/src/web/download-task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ state: webDownloadTaskService.getSnapshot() });
}
