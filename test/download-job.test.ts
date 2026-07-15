import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { BrowserContext } from "playwright";

import { DownloadJob, type DownloadStatus } from "../src/collector/download-job.js";

test("DownloadJob closes the browser context when creating the first page fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xxt-download-job-"));
  let closed = false;
  const statuses: DownloadStatus[] = [];
  const context = {
    newPage: async () => {
      throw new Error("page unavailable");
    },
    close: async () => {
      closed = true;
    },
  } as unknown as BrowserContext;

  try {
    const job = new DownloadJob(
      {
        profileDir: join(directory, "profile"),
        outDir: join(directory, "output"),
        startUrl: "https://i.chaoxing.com/",
      },
      { status: (status) => statuses.push(status) },
      async () => context,
    );

    await assert.rejects(job.run(), /page unavailable/);
    assert.equal(closed, true);
    assert.deepEqual(statuses, ["starting", "error"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("DownloadJob does not launch a browser after it was stopped", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xxt-download-job-stopped-"));
  let launches = 0;
  const statuses: DownloadStatus[] = [];

  try {
    const job = new DownloadJob(
      {
        profileDir: join(directory, "profile"),
        outDir: join(directory, "output"),
        startUrl: "https://i.chaoxing.com/",
      },
      { status: (status) => statuses.push(status) },
      async () => {
        launches += 1;
        throw new Error("browser should not launch");
      },
    );

    await job.stop();
    await job.run();

    assert.equal(launches, 0);
    assert.deepEqual(statuses, ["starting", "stopped"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
