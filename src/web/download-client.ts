import { isRecord } from "../shared/validation.js";
import type { WebDownloadSnapshot } from "./download-task-service.js";

const downloadStatuses = new Set([
  "idle",
  "starting",
  "waiting-login",
  "selecting-course",
  "collecting",
  "downloading",
  "done",
  "error",
  "stopped",
]);

export async function requestDownloadState(): Promise<WebDownloadSnapshot> {
  return parseDownloadResponse(
    await fetch("/api/download/state", { cache: "no-store" }),
  );
}

export async function postDownloadState(
  url: string,
  body: unknown,
): Promise<WebDownloadSnapshot> {
  return parseDownloadResponse(await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function parseDownloadResponse(response: Response): Promise<WebDownloadSnapshot> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("下载接口返回了无效 JSON。");
  }

  if (!response.ok) {
    throw new Error(readApiError(value));
  }
  if (!isRecord(value) || !isDownloadSnapshot(value.state)) {
    throw new Error("下载接口响应格式无效。");
  }

  return value.state;
}

function isDownloadSnapshot(value: unknown): value is WebDownloadSnapshot {
  return (
    isRecord(value) &&
    typeof value.status === "string" &&
    downloadStatuses.has(value.status) &&
    (value.taskId === undefined || typeof value.taskId === "string") &&
    Array.isArray(value.courses) &&
    value.courses.every(isCourse) &&
    Array.isArray(value.logs) &&
    value.logs.every(isLogEntry)
  );
}

function isCourse(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.text === "string" &&
    typeof value.href === "string" &&
    (value.index === undefined || typeof value.index === "number") &&
    (value.title === undefined || typeof value.title === "string")
  );
}

function isLogEntry(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.message === "string"
  );
}

function readApiError(value: unknown): string {
  return isRecord(value) && typeof value.error === "string" && value.error.trim()
    ? value.error
    : "本地下载接口请求失败。";
}
