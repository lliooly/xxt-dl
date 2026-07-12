import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  DownloadJob as PlaywrightDownloadJob,
  type DownloadDoneResult,
  type DownloadHandlers,
  type DownloadStatus,
  type DownloadProgress,
  type DownloadQrCode,
  type StartDownloadInput,
} from "../collector/download-job.js";
import type { CourseEntry } from "../types.js";

export interface DownloadJob {
  run(): Promise<void>;
  selectCourse(value: string): void;
  stop(): Promise<void>;
}

export type DownloadJobFactory = (
  input: StartDownloadInput,
  handlers: DownloadHandlers,
) => DownloadJob;

export interface WebDownloadLogEntry {
  id: number;
  message: string;
}

export interface WebDownloadSnapshot {
  taskId?: string;
  status: DownloadStatus;
  qr?: DownloadQrCode;
  courses: CourseEntry[];
  progress?: DownloadProgress;
  done?: DownloadDoneResult;
  error?: string;
  logs: WebDownloadLogEntry[];
}

export type WebDownloadTaskErrorCode =
  | "ACTIVE_TASK"
  | "TASK_NOT_FOUND"
  | "INVALID_STATE"
  | "INVALID_COURSE";

export class WebDownloadTaskError extends Error {
  constructor(
    readonly code: WebDownloadTaskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WebDownloadTaskError";
  }
}

const activeStatuses = new Set<DownloadStatus>([
  "starting",
  "waiting-login",
  "selecting-course",
  "collecting",
  "downloading",
]);

export class WebDownloadTaskService {
  private snapshot: WebDownloadSnapshot = createIdleSnapshot();
  private activeJob?: DownloadJob;
  private nextLogId = 1;

  constructor(
    private readonly createJob: DownloadJobFactory = createDefaultJob,
    private readonly createTaskId: () => string = randomUUID,
  ) {}

  getSnapshot(): WebDownloadSnapshot {
    return structuredClone(this.snapshot);
  }

  start(input: StartDownloadInput): WebDownloadSnapshot {
    if (this.activeJob && activeStatuses.has(this.snapshot.status)) {
      throw new WebDownloadTaskError("ACTIVE_TASK", "已有下载任务正在运行。");
    }

    const taskId = this.createTaskId();
    this.snapshot = {
      taskId,
      status: "starting",
      courses: [],
      logs: [],
    };
    this.nextLogId = 1;

    const handlers = this.createHandlers(taskId);
    let job: DownloadJob;
    try {
      job = this.createJob(input, handlers);
    } catch (error) {
      this.snapshot.status = "error";
      this.snapshot.error = "启动下载任务失败。";
      throw error;
    }
    this.activeJob = job;
    void job.run().catch((error: unknown) => {
      if (this.snapshot.taskId !== taskId || this.snapshot.status === "stopped") {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.snapshot.status = "error";
      this.snapshot.error = this.snapshot.error ?? message;
    }).finally(() => {
      if (this.snapshot.taskId === taskId) {
        this.activeJob = undefined;
      }
    });

    return this.getSnapshot();
  }

  selectCourse(taskId: string, value: string): WebDownloadSnapshot {
    const job = this.requireActiveJob(taskId);
    if (this.snapshot.status !== "selecting-course") {
      throw new WebDownloadTaskError("INVALID_STATE", "当前任务不在课程选择阶段。");
    }
    if (!this.snapshot.courses.some((course) => String(course.index) === value)) {
      throw new WebDownloadTaskError("INVALID_COURSE", "所选课程不在当前课程列表中。");
    }
    job.selectCourse(value);
    return this.getSnapshot();
  }

  async stop(taskId: string): Promise<WebDownloadSnapshot> {
    const job = this.requireActiveJob(taskId);
    await job.stop();
    if (this.snapshot.taskId === taskId) {
      this.snapshot.status = "stopped";
      this.activeJob = undefined;
    }
    return this.getSnapshot();
  }

  private requireActiveJob(taskId: string): DownloadJob {
    if (!taskId || this.snapshot.taskId !== taskId || !this.activeJob) {
      throw new WebDownloadTaskError("TASK_NOT_FOUND", "下载任务不存在或已经结束。");
    }
    return this.activeJob;
  }

  private createHandlers(taskId: string): DownloadHandlers {
    const update = (action: () => void) => {
      if (this.snapshot.taskId === taskId) action();
    };
    return {
      status: (status) => update(() => { this.snapshot.status = status; }),
      qr: (qr) => update(() => { this.snapshot.qr = qr; }),
      courses: (courses) => update(() => { this.snapshot.courses = courses; }),
      progress: (progress) => update(() => { this.snapshot.progress = progress; }),
      done: (done) => update(() => {
        this.snapshot.done = done;
        this.snapshot.status = "done";
      }),
      error: (error) => update(() => {
        this.snapshot.error = error;
        this.snapshot.status = "error";
      }),
      log: (message) => update(() => {
        this.snapshot.logs = [
          ...this.snapshot.logs,
          { id: this.nextLogId++, message },
        ].slice(-100);
      }),
    };
  }
}

function createIdleSnapshot(): WebDownloadSnapshot {
  return { status: "idle", courses: [], logs: [] };
}

function createDefaultJob(input: StartDownloadInput, handlers: DownloadHandlers): DownloadJob {
  const appRoot = process.cwd();
  return new PlaywrightDownloadJob(
    {
      profileDir: path.join(appRoot, ".xxt-profile"),
      outDir: path.join(appRoot, "output"),
      startUrl: "https://i.chaoxing.com/",
      courseQuery: input.courseQuery,
      limit: input.limit,
      headless: true,
    },
    handlers,
  );
}

const globalTaskService = globalThis as typeof globalThis & {
  xxtWebDownloadTaskService?: WebDownloadTaskService;
};

export const webDownloadTaskService =
  globalTaskService.xxtWebDownloadTaskService ??= new WebDownloadTaskService();
