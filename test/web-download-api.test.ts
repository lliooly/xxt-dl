import assert from "node:assert/strict";
import test from "node:test";

import {
  apiErrorResponse,
  assertLocalJsonRequest,
  parseCourseInput,
  readJsonRequest,
  parseStartInput,
  parseTaskInput,
} from "../src/web/download-api.js";
import { WebDownloadTaskError } from "../src/web/download-task-service.js";

test("download API accepts a trimmed course query and positive integer limit", () => {
  assert.deepEqual(parseStartInput({ courseQuery: "  高等数学  ", limit: 3 }), {
    courseQuery: "高等数学",
    limit: 3,
  });
  assert.deepEqual(parseStartInput({ courseQuery: "", limit: "" }), {});
});

test("download API rejects an invalid limit", () => {
  for (const limit of [0, -1, 1.5, "abc"]) {
    assert.throws(() => parseStartInput({ limit }), /正整数/);
  }
});

test("download API validates task and course payloads", () => {
  assert.deepEqual(parseTaskInput({ taskId: " task-1 " }), { taskId: "task-1" });
  assert.deepEqual(parseCourseInput({ taskId: "task-1", course: " 2 " }), {
    taskId: "task-1",
    course: "2",
  });
  assert.throws(() => parseTaskInput({}), /任务 ID/);
  assert.throws(() => parseCourseInput({ taskId: "task-1", course: "" }), /课程/);
});

test("download API maps task errors to HTTP status codes", () => {
  assert.deepEqual(
    apiErrorResponse(new WebDownloadTaskError("ACTIVE_TASK", "已有任务")),
    { status: 409, error: "已有任务" },
  );
  assert.deepEqual(
    apiErrorResponse(new WebDownloadTaskError("TASK_NOT_FOUND", "任务不存在")),
    { status: 404, error: "任务不存在" },
  );
  assert.deepEqual(apiErrorResponse(new Error("内部路径 /private/example")), {
    status: 500,
    error: "本地服务处理请求失败。",
  });
});

test("download API requires local same-origin JSON requests", () => {
  const valid = new Request("http://127.0.0.1:8263/api/download/start", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1:8263" },
  });
  assert.doesNotThrow(() => assertLocalJsonRequest(valid));

  const form = new Request("http://127.0.0.1:8263/api/download/start", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  assert.throws(() => assertLocalJsonRequest(form), /JSON/);

  const crossOrigin = new Request("http://127.0.0.1:8263/api/download/start", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
  });
  assert.throws(() => assertLocalJsonRequest(crossOrigin), /同源/);
});

test("download API reports validation errors as 400", () => {
  let validationError: unknown;
  try {
    parseTaskInput({});
  } catch (error) {
    validationError = error;
  }
  assert.deepEqual(apiErrorResponse(validationError), {
    status: 400,
    error: "缺少任务 ID。",
  });
});

test("download API rejects malformed JSON as a validation error", async () => {
  const request = new Request("http://127.0.0.1:8263/api/download/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid",
  });
  await assert.rejects(readJsonRequest(request), /JSON 内容无效/);
});
