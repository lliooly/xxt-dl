import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { CancellationToken } from "builder-util-runtime";
import type { AppUpdater } from "electron-updater";

import { DesktopUpdateService } from "../src/desktop/update-service.js";
import type { DesktopUpdateState } from "../src/desktop/update-state.js";

test("DesktopUpdateService prevents concurrent GitHub release checks", async () => {
  const deferred = createDeferred<{
    version: string;
    releaseNotes: string;
  } | undefined>();
  let calls = 0;

  const service = new DesktopUpdateService("0.1.1", () => undefined, {
    isPackaged: false,
    fetchLatestReleaseInfo: async () => {
      calls += 1;
      return deferred.promise;
    },
  });

  const first = service.checkForUpdates();
  const second = service.checkForUpdates();

  assert.equal(calls, 1);

  deferred.resolve({
    version: "v0.2.0",
    releaseNotes: "新版本",
  });

  const [firstState, secondState] = await Promise.all([first, second]);

  assert.equal(firstState.phase, "available");
  assert.equal(secondState.phase, "available");
});

test("DesktopUpdateService prevents concurrent update downloads", async () => {
  const updater = new FakeUpdater();
  const checkDeferred = createDeferred<{
    isUpdateAvailable: boolean;
    updateInfo: { version: string; releaseNotes?: string };
    cancellationToken: CancellationToken;
  }>();

  updater.nextCheckForUpdates = async () => {
    updater.checkForUpdatesCalls += 1;
    return checkDeferred.promise;
  };
  updater.nextDownloadUpdate = async () => {
    updater.downloadUpdateCalls += 1;
    updater.emit("update-downloaded", { version: "v0.2.0", releaseNotes: "已下载" });
    return [];
  };

  const service = new DesktopUpdateService("0.1.1", () => undefined, {
    isPackaged: true,
    updater: updater.asUpdater(),
    fetchLatestReleaseInfo: async () => ({
      version: "v0.2.0",
      releaseNotes: "新版本",
    }),
  });

  await service.checkForUpdates();

  const first = service.downloadUpdate();
  const second = service.downloadUpdate();

  assert.equal(updater.checkForUpdatesCalls, 1);

  checkDeferred.resolve({
    isUpdateAvailable: true,
    updateInfo: { version: "v0.2.0", releaseNotes: "新版本" },
    cancellationToken: new CancellationToken(),
  });

  await Promise.all([first, second]);

  assert.equal(updater.downloadUpdateCalls, 1);
  assert.equal(service.getState().phase, "downloaded");
});

test("DesktopUpdateService can cancel an in-flight release check", async () => {
  let aborted = false;

  const service = new DesktopUpdateService("0.1.1", () => undefined, {
    isPackaged: false,
    fetchLatestReleaseInfo: async (_allowPrerelease, options) =>
      new Promise((_resolve, reject) => {
        const signal = options?.signal;

        signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(signal?.reason ?? new Error("aborted"));
          },
          { once: true },
        );
      }),
  });

  const pending = service.checkForUpdates();
  service.cancelUpdateOperation();
  await pending;

  assert.equal(aborted, true);
  assert.equal(service.getState().message, "已取消更新检查。");
  assert.equal(service.getState().canCheck, true);
});

test("DesktopUpdateService emits only one error state when electron-updater both emits and rejects", async () => {
  const updater = new FakeUpdater();
  const states: DesktopUpdateState[] = [];

  updater.nextCheckForUpdates = async () => ({
    isUpdateAvailable: true,
    updateInfo: { version: "v0.2.0", releaseNotes: "新版本" },
    cancellationToken: new CancellationToken(),
  });
  updater.nextDownloadUpdate = async () => {
    updater.downloadUpdateCalls += 1;
    const error = new Error("下载失败");
    updater.emit("error", error);
    throw error;
  };

  const service = new DesktopUpdateService("0.1.1", (state) => states.push(state), {
    isPackaged: true,
    updater: updater.asUpdater(),
    fetchLatestReleaseInfo: async () => ({
      version: "v0.2.0",
      releaseNotes: "新版本",
    }),
  });

  await service.checkForUpdates();
  await service.downloadUpdate();

  assert.equal(states.filter((state) => state.phase === "error").length, 1);
});

test("DesktopUpdateService opens a configurable release page URL", async () => {
  let openedUrl = "";

  const service = new DesktopUpdateService("0.1.1", () => undefined, {
    isPackaged: false,
    openExternal: async (url) => {
      openedUrl = url;
    },
    releasePageUrl: "https://example.com/releases",
  });

  await service.openReleasePage();

  assert.equal(openedUrl, "https://example.com/releases");
});

test("DesktopUpdateService surfaces updater resolution failures in packaged builds", () => {
  const service = new DesktopUpdateService("0.1.1", () => undefined, {
    isPackaged: true,
    updater: undefined,
    updaterUnavailableReason: "electron-updater 模块未暴露可用的 autoUpdater 导出。",
  });

  assert.equal(service.getState().phase, "unsupported");
  assert.match(service.getState().message ?? "", /autoUpdater/);
});

class FakeUpdater extends EventEmitter {
  allowPrerelease = false;
  autoDownload = true;
  autoInstallOnAppQuit = true;
  fullChangelog = false;
  logger: unknown;
  checkForUpdatesCalls = 0;
  downloadUpdateCalls = 0;
  nextCheckForUpdates: () => Promise<unknown> = async () => null;
  nextDownloadUpdate: (_cancellationToken?: CancellationToken) => Promise<unknown> = async () => [];

  async checkForUpdates(): Promise<unknown> {
    return this.nextCheckForUpdates();
  }

  async downloadUpdate(cancellationToken?: CancellationToken): Promise<unknown> {
    return this.nextDownloadUpdate(cancellationToken);
  }

  quitAndInstall(): void {
    // no-op
  }

  asUpdater(): AppUpdater {
    return this as unknown as AppUpdater;
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
