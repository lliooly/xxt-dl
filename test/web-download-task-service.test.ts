import assert from "node:assert/strict";
import test from "node:test";

import {
  WebDownloadTaskError,
  WebDownloadTaskService,
  type DownloadJob,
  type DownloadJobFactory,
} from "../src/web/download-task-service.js";
import type { DownloadHandlers } from "../src/collector/download-job.js";

class FakeJob implements DownloadJob {
  selectedCourse?: string;
  stopped = false;
  private resolveRun!: () => void;
  readonly runPromise = new Promise<void>((resolve) => {
    this.resolveRun = resolve;
  });

  constructor(readonly handlers: DownloadHandlers) {}

  run(): Promise<void> {
    return this.runPromise;
  }

  selectCourse(value: string): void {
    this.selectedCourse = value;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.handlers.status?.("stopped");
    this.resolveRun();
  }

  finish(): void {
    this.resolveRun();
  }
}

function createHarness() {
  let job: FakeJob | undefined;
  const factory: DownloadJobFactory = (_input, handlers) => {
    job = new FakeJob(handlers);
    return job;
  };
  return {
    service: new WebDownloadTaskService(factory, () => "task-1"),
    get job() {
      assert.ok(job);
      return job;
    },
  };
}

test("WebDownloadTaskService starts idle and records job events", async () => {
  const harness = createHarness();
  assert.equal(harness.service.getSnapshot().status, "idle");

  const started = harness.service.start({ limit: 2 });
  assert.equal(started.taskId, "task-1");
  assert.equal(started.status, "starting");

  harness.job.handlers.status?.("waiting-login");
  harness.job.handlers.qr?.({
    imageFile: "login-qr.png",
    metadataFile: "login-qr.json",
    imageUrl: "https://example.test/qr",
    expired: false,
    capturedAt: "2026-07-12T00:00:00.000Z",
    frameUrl: "https://example.test/login",
  });
  harness.job.handlers.courses?.([{ index: 1, title: "课程一", text: "课程一", href: "https://example.test/course" }]);
  harness.job.handlers.progress?.({ current: 1, total: 2, label: "作业一" });
  harness.job.handlers.log?.("正在下载");
  harness.job.handlers.done?.({ outDir: "/tmp/output", total: 2 });

  const snapshot = harness.service.getSnapshot();
  assert.equal(snapshot.status, "done");
  assert.equal(snapshot.qr?.imageFile, "login-qr.png");
  assert.equal(snapshot.courses[0]?.title, "课程一");
  assert.equal(snapshot.progress?.current, 1);
  assert.equal(snapshot.logs[0]?.message, "正在下载");
  assert.equal(snapshot.done?.total, 2);
  harness.job.finish();
  await harness.job.runPromise;
});

test("WebDownloadTaskService rejects a second active task", () => {
  const harness = createHarness();
  harness.service.start({});
  assert.throws(
    () => harness.service.start({}),
    (error: unknown) => error instanceof WebDownloadTaskError && error.code === "ACTIVE_TASK",
  );
  harness.job.finish();
});

test("WebDownloadTaskService validates task id for course selection and stop", async () => {
  const harness = createHarness();
  harness.service.start({});

  assert.throws(
    () => harness.service.selectCourse("other-task", "1"),
    (error: unknown) => error instanceof WebDownloadTaskError && error.code === "TASK_NOT_FOUND",
  );
  await assert.rejects(
    harness.service.stop("other-task"),
    (error: unknown) => error instanceof WebDownloadTaskError && error.code === "TASK_NOT_FOUND",
  );

  harness.job.handlers.status?.("selecting-course");
  harness.job.handlers.courses?.([{ index: 1, title: "课程一", text: "课程一", href: "https://example.test/course" }]);
  harness.service.selectCourse("task-1", "1");
  assert.equal(harness.job.selectedCourse, "1");
  await harness.service.stop("task-1");
  assert.equal(harness.job.stopped, true);
  assert.equal(harness.service.getSnapshot().status, "stopped");
});

test("WebDownloadTaskService accepts course selection only in the selecting-course phase", () => {
  const harness = createHarness();
  harness.service.start({});
  assert.throws(
    () => harness.service.selectCourse("task-1", "1"),
    (error: unknown) => error instanceof WebDownloadTaskError && error.code === "INVALID_STATE",
  );

  harness.job.handlers.status?.("selecting-course");
  harness.job.handlers.courses?.([{ index: 1, title: "课程一", text: "课程一", href: "https://example.test/course" }]);
  assert.throws(
    () => harness.service.selectCourse("task-1", "999"),
    (error: unknown) => error instanceof WebDownloadTaskError && error.code === "INVALID_COURSE",
  );
  harness.service.selectCourse("task-1", "1");
  assert.equal(harness.job.selectedCourse, "1");
  harness.job.finish();
});

test("WebDownloadTaskService records synchronous job creation failures", () => {
  const service = new WebDownloadTaskService(() => {
    throw new Error("browser unavailable");
  }, () => "task-error");

  assert.throws(() => service.start({}), /browser unavailable/);
  const snapshot = service.getSnapshot();
  assert.equal(snapshot.status, "error");
  assert.equal(snapshot.error, "启动下载任务失败。");
});

test("WebDownloadTaskService keeps only the latest 100 logs", () => {
  const harness = createHarness();
  harness.service.start({});
  for (let index = 0; index < 105; index += 1) {
    harness.job.handlers.log?.(`log-${index}`);
  }
  const logs = harness.service.getSnapshot().logs;
  assert.equal(logs.length, 100);
  assert.equal(logs[0]?.message, "log-5");
  harness.job.finish();
});
