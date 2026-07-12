import type { StartDownloadInput } from "../collector/download-job.js";
import { WebDownloadTaskError } from "./download-task-service.js";

export interface TaskInput {
  taskId: string;
}

export interface CourseInput extends TaskInput {
  course: string;
}

export class WebDownloadInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebDownloadInputError";
  }
}

export function parseStartInput(value: unknown): StartDownloadInput {
  const input = asRecord(value);
  const courseQuery = optionalTrimmedString(input.courseQuery, "课程关键词");
  const rawLimit = input.limit;
  const result: StartDownloadInput = {};

  if (courseQuery) result.courseQuery = courseQuery;
  if (rawLimit !== undefined && rawLimit !== null && rawLimit !== "") {
    const limit = typeof rawLimit === "number" ? rawLimit : Number(rawLimit);
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new WebDownloadInputError("作业数量必须是正整数。");
    }
    result.limit = limit;
  }

  return result;
}

export function parseTaskInput(value: unknown): TaskInput {
  const input = asRecord(value);
  const taskId = optionalTrimmedString(input.taskId, "任务 ID");
  if (!taskId) throw new WebDownloadInputError("缺少任务 ID。");
  return { taskId };
}

export function parseCourseInput(value: unknown): CourseInput {
  const input = asRecord(value);
  const { taskId } = parseTaskInput(input);
  const course = optionalTrimmedString(input.course, "课程");
  if (!course) throw new WebDownloadInputError("请选择课程。");
  return { taskId, course };
}

export function apiErrorResponse(error: unknown): { status: number; error: string } {
  if (error instanceof WebDownloadTaskError) {
    const status = error.code === "ACTIVE_TASK"
      ? 409
      : error.code === "TASK_NOT_FOUND"
        ? 404
        : 422;
    return {
      status,
      error: error.message,
    };
  }
  if (error instanceof WebDownloadInputError) {
    return { status: 400, error: error.message };
  }
  return {
    status: 500,
    error: "本地服务处理请求失败。",
  };
}

export function assertLocalJsonRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new WebDownloadInputError("请求必须使用 JSON 格式。");
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new WebDownloadInputError("请求必须来自本地 Web 应用同源页面。");
  }
}

export async function readJsonRequest(request: Request): Promise<unknown> {
  assertLocalJsonRequest(request);
  try {
    return await request.json();
  } catch {
    throw new WebDownloadInputError("请求的 JSON 内容无效。");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new WebDownloadInputError("请求内容必须是 JSON 对象。");
  }
  return value as Record<string, unknown>;
}

function optionalTrimmedString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new WebDownloadInputError(`${label}必须是字符串。`);
  return value.trim() || undefined;
}
