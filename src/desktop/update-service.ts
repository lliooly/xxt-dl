import { app, shell } from "electron";
import * as electronUpdater from "electron-updater";
import type { ProgressInfo, UpdateInfo } from "electron-updater";

import {
  createInitialUpdateState,
  isNewerReleaseVersion,
  reduceUpdateState,
  type DesktopUpdateInfo,
  type DesktopUpdateProgress,
  type DesktopUpdateState,
} from "./update-state.js";
import { fetchLatestReleaseInfo } from "./github-release-source.js";

const RELEASE_PAGE_URL = "https://github.com/lliooly/xxt-dl/releases";

export interface CheckForUpdatesInput {
  allowPrerelease?: boolean;
}

export class DesktopUpdateService {
  private readonly updater = electronUpdater.autoUpdater;
  private state: DesktopUpdateState;
  private configured = false;

  constructor(
    currentVersion: string,
    private readonly onStateChange: (state: DesktopUpdateState) => void,
  ) {
    this.state = createInitialUpdateState(currentVersion, app.isPackaged);
    this.configure();
  }

  getState(): DesktopUpdateState {
    return this.state;
  }

  async checkForUpdates(input: CheckForUpdatesInput = {}): Promise<DesktopUpdateState> {
    if (this.state.phase === "checking" || this.state.phase === "downloading") {
      return this.state;
    }

    if (!this.state.supportsInstall) {
      await this.checkGitHubReleases(input);
      return this.state;
    }

    this.updater.allowPrerelease = Boolean(input.allowPrerelease);
    await this.runUpdaterTask(() => this.updater.checkForUpdates());
    return this.state;
  }

  async downloadUpdate(): Promise<DesktopUpdateState> {
    if (!this.state.supportsInstall || !this.state.canDownload) {
      return this.state;
    }

    this.publish(
      reduceUpdateState(this.state, {
        type: "download-progress",
        progress: {
          percent: 0,
          transferred: 0,
          total: this.state.progress?.total ?? 0,
          bytesPerSecond: 0,
        },
      }),
    );
    await this.runUpdaterTask(() => this.updater.downloadUpdate());
    return this.state;
  }

  installDownloadedUpdate(): DesktopUpdateState {
    if (this.state.supportsInstall && this.state.canInstall) {
      this.updater.quitAndInstall(false, true);
    }

    return this.state;
  }

  async openReleasePage(): Promise<void> {
    await shell.openExternal(RELEASE_PAGE_URL);
  }

  scheduleStartupCheck(delayMs = 4500): void {
    if (!this.state.supportsInstall) {
      return;
    }

    setTimeout(() => {
      void this.checkForUpdates();
    }, delayMs);
  }

  private configure(): void {
    if (this.configured || !this.state.supportsInstall) {
      return;
    }

    this.configured = true;
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.fullChangelog = true;
    this.updater.logger = {
      info: (message) => console.info("[update]", message),
      warn: (message) => console.warn("[update]", message),
      error: (message) => console.error("[update]", message),
    };

    this.updater.on("checking-for-update", () => {
      this.publish(reduceUpdateState(this.state, { type: "checking" }));
    });

    this.updater.on("update-available", (info) => {
      this.publish(
        reduceUpdateState(this.state, {
          type: "available",
          checkedAt: new Date().toISOString(),
          info: toDesktopUpdateInfo(info),
        }),
      );
    });

    this.updater.on("update-not-available", () => {
      this.publish(
        reduceUpdateState(this.state, {
          type: "not-available",
          checkedAt: new Date().toISOString(),
        }),
      );
    });

    this.updater.on("download-progress", (progress) => {
      this.publish(
        reduceUpdateState(this.state, {
          type: "download-progress",
          progress: toDesktopUpdateProgress(progress),
        }),
      );
    });

    this.updater.on("update-downloaded", (info) => {
      this.publish(
        reduceUpdateState(this.state, {
          type: "downloaded",
          info: toDesktopUpdateInfo(info),
        }),
      );
    });

    this.updater.on("error", (error) => {
      this.publish(
        reduceUpdateState(this.state, {
          type: "error",
          message: formatUpdateError(error),
        }),
      );
    });
  }

  private async runUpdaterTask(task: () => Promise<unknown>): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.publish(
        reduceUpdateState(this.state, {
          type: "error",
          message: formatUpdateError(error),
        }),
      );
    }
  }

  private async checkGitHubReleases(input: CheckForUpdatesInput): Promise<void> {
    this.publish(reduceUpdateState(this.state, { type: "checking" }));

    try {
      const info = await fetchLatestReleaseInfo(Boolean(input.allowPrerelease));

      if (!info || !isNewerReleaseVersion(info.version, this.state.currentVersion)) {
        this.publish(
          reduceUpdateState(this.state, {
            type: "not-available",
            checkedAt: new Date().toISOString(),
          }),
        );
        return;
      }

      this.publish(
        reduceUpdateState(this.state, {
          type: "available",
          checkedAt: new Date().toISOString(),
          info,
        }),
      );
    } catch (error) {
      this.publish(
        reduceUpdateState(this.state, {
          type: "error",
          message: formatUpdateError(error),
        }),
      );
    }
  }

  private publish(nextState: DesktopUpdateState): void {
    this.state = nextState;
    this.onStateChange(this.state);
  }
}

function toDesktopUpdateInfo(info: UpdateInfo): DesktopUpdateInfo {
  return {
    version: info.version,
    releaseName: info.releaseName,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
  };
}

function toDesktopUpdateProgress(progress: ProgressInfo): DesktopUpdateProgress {
  return {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  };
}

function formatUpdateError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `更新失败：${error.message}`;
  }

  if (typeof error === "string" && error.trim()) {
    return `更新失败：${error.trim()}`;
  }

  return "更新失败：未知错误。";
}
