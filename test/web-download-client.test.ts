import assert from "node:assert/strict";
import test from "node:test";

import { parseDownloadResponse } from "../src/web/download-client.js";

const idleState = { status: "idle", courses: [], logs: [] };

test("parseDownloadResponse accepts a valid state payload", async () => {
  assert.deepEqual(
    await parseDownloadResponse(Response.json({ state: idleState })),
    idleState,
  );
});

test("parseDownloadResponse reports API and malformed response errors", async () => {
  await assert.rejects(
    parseDownloadResponse(Response.json({ error: "已有下载任务" }, { status: 409 })),
    /已有下载任务/,
  );
  await assert.rejects(
    parseDownloadResponse(new Response("<html>error</html>", { status: 500 })),
    /无效 JSON/,
  );
  await assert.rejects(
    parseDownloadResponse(Response.json({ state: { status: "unknown" } })),
    /响应格式无效/,
  );
});
