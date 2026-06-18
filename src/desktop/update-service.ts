import { CancellationError, CancellationToken } from "builder-util-runtime";
import electron from "electron";
import * as electronUpdater from "electron-updater";
import type { AppUpdater, ProgressInfo, UpdateCheckResult, UpdateInfo } from "electron-updater";

import {
  createInitialUpdateState,
  isNewerReleaseVersion,
  reduceUpdateState,
  type DesktopUpdateInfo,
  type DesktopUpdateProgress,
  type DesktopUpdateState,
} from "./update-state.js";
import {
  getAutoUpdaterResolutionError,
  resolveAutoUpdaterModule,
  type ElectronUpdaterModule,
} from "./electron-updater-module.js";
import { fetchLatestReleaseInfo } from "./github-release-source.js";

const { app, shell } = electron;

const DEFAULT_RELEASE_PAGE_URL = "https://github.com/lliooly/xxt-dl/releases";

export interface CheckForUpdatesInput {
  allowPrerelease?: boolean;
}

export interface DesktopUpdateServiceDependencies {
  updater?: AppUpdater;
  updaterUnavailableReason?: string;
  isPackaged?: boolean;
  openExternal?: (url: string) => Promise<void>;
  fetchLatestReleaseInfo?: typeof fetchLatestReleaseInfo;
  releasePageUrl?: string;
  now?: () => string;
}

type UpdateOperationKind = "check" | "download";

interface ActiveUpdateOperation {
  id: number;
  kind: UpdateOperationKind;
  startedFrom: DesktopUpdateState;
  aborted: boolean;
  errorHandled: boolean;
  downloaded: boolean;
  expectedVersion?: string;
  controller?: AbortController;
  cancellationToken?: CancellationToken;
  promise: Promise<DesktopUpdateState>;
}

export class DesktopUpdateService {
  private readonly updater: AppUpdater | undefined;
  private readonly fetchReleaseInfo: typeof fetchLatestReleaseInfo;
  private readonly openExternal: (url: string) => Promise<void>;
  private readonly releasePageUrl: string;
  private readonly now: () => string;
  private readonly isPackagedBuild: boolean;
  private state: DesktopUpdateState;
  private configured = false;
  private activeOperation: ActiveUpdateOperation | undefined;
  private nextOperationId = 0;

  constructor(
    currentVersion: string,
    private readonly onStateChange: (state: DesktopUpdateState) => void,
    dependencies: DesktopUpdateServiceDependencies = {},
  ) {
    const hasInjectedUpdater = Object.prototype.hasOwnProperty.call(dependencies, "updater");
    this.isPackagedBuild = dependencies.isPackaged ?? Boolean(app?.isPackaged);
    const resolvedUpdater =
      hasInjectedUpdater || !this.isPackagedBuild
        ? dependencies.updater
        : resolveAutoUpdaterModule(electronUpdater as unknown as ElectronUpdaterModule);
    const resolutionError =
      dependencies.updaterUnavailableReason ??
      (this.isPackagedBuild && !hasInjectedUpdater
        ? getAutoUpdaterResolutionError(electronUpdater as unknown as ElectronUpdaterModule)
        : undefined);

    this.updater = resolvedUpdater;
    this.fetchReleaseInfo = dependencies.fetchLatestReleaseInfo ?? fetchLatestReleaseInfo;
    this.openExternal = dependencies.openExternal ?? ((url) => shell.openExternal(url));
    this.releasePageUrl = dependencies.releasePageUrl ?? getReleasePageUrl();
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.state = createInitialUpdateState(currentVersion, this.isPackagedBuild && Boolean(this.updater));

    if (this.isPackagedBuild && !this.updater && resolutionError) {
      this.state = {
        ...this.state,
        phase: "unsupported",
        error: resolutionError,
        message: `自动更新不可用：${resolutionError}`,
      };
    }

    this.configure();
  }

  getState(): DesktopUpdateState {
    return this.state;
  }

  async checkForUpdates(input: CheckForUpdatesInput = {}): Promise<DesktopUpdateState> {
    return this.beginOperation("check", async (operation) => {
      operation.controller = new AbortController();
      this.publish(reduceUpdateState(this.state, { type: "checking" }));

      const info = await this.fetchReleaseInfo(Boolean(input.allowPrerelease), {
        signal: operation.controller.signal,
        updateMetadataAssetName: this.state.supportsInstall ? getUpdateMetadataAssetName() : undefined,
      });

      if (!this.isOperationActive(operation)) {
        return;
      }

      const checkedAt = this.now();

      if (!info) {
        this.publish(
          reduceUpdateState(this.state, {
            type: "not-available",
            checkedAt,
          }),
        );
        return;
      }

      if (!isNewerReleaseVersion(info.version, this.state.currentVersion)) {
        this.publish(
          reduceUpdateState(this.state, {
            type: "not-available",
            checkedAt,
            info,
          }),
        );
        return;
      }

      this.publish(
        reduceUpdateState(this.state, {
          type: "available",
          checkedAt,
          info,
        }),
      );
    });
  }

  async downloadUpdate(): Promise<DesktopUpdateState> {
    if (!this.state.supportsInstall || !this.state.canDownload || !this.updater) {
      return this.state;
    }

    const availableVersion = this.state.availableVersion;

    if (!availableVersion) {
      this.publish(
        reduceUpdateState(this.state, { type: "error", message: "更新失败：未找到可用版本号。" }),
      );
      return this.state;
    }

    return this.beginOperation("download", async (operation) => {
      const updater = this.updater;

      if (!updater) {
        throw new Error("自动更新器不可用。");
      }

      operation.expectedVersion = availableVersion;
      configureUpdaterForVersion(updater, availableVersion);

      const result = await updater.checkForUpdates();

      if (!this.isOperationActive(operation)) {
        return;
      }

      if (!result?.isUpdateAvailable || !sameReleaseVersion(result.updateInfo.version, availableVersion)) {
        throw new Error(`更新元数据与已选版本不匹配：期望 ${availableVersion}。`);
      }

      operation.cancellationToken = getUpdateCancellationToken(result);
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

      await updater.downloadUpdate(operation.cancellationToken);

      if (!this.isOperationActive(operation)) {
        return;
      }

      if (!operation.downloaded) {
        operation.downloaded = true;
        this.publish(
          reduceUpdateState(this.state, {
            type: "downloaded",
            info: toDesktopUpdateInfo(result.updateInfo),
          }),
        );
      }
    });
  }

  cancelUpdateOperation(): DesktopUpdateState {
    const operation = this.activeOperation;

    if (!operation) {
      return this.state;
    }

    operation.aborted = true;
    this.activeOperation = undefined;
    operation.controller?.abort(new Error(getCancelledMessage(operation.kind)));
    operation.cancellationToken?.cancel();
    this.publish(createCancelledState(operation));
    return this.state;
  }

  installDownloadedUpdate(): DesktopUpdateState {
    if (this.state.supportsInstall && this.state.canInstall && this.updater) {
      this.updater.quitAndInstall(false, true);
    }

    return this.state;
  }

  async openReleasePage(): Promise<void> {
    await this.openExternal(this.releasePageUrl);
  }

  private configure(): void {
    if (this.configured || !this.state.supportsInstall || !this.updater) {
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

    this.updater.on("download-progress", (progress) => {
      const operation = this.getActiveDownloadOperation();

      if (!operation) {
        return;
      }

      this.publish(
        reduceUpdateState(this.state, {
          type: "download-progress",
          progress: toDesktopUpdateProgress(progress),
        }),
      );
    });

    this.updater.on("update-downloaded", (info) => {
      const operation = this.getActiveDownloadOperation();

      if (!operation) {
        return;
      }

      operation.downloaded = true;
      this.publish(
        reduceUpdateState(this.state, {
          type: "downloaded",
          info: toDesktopUpdateInfo(info),
        }),
      );
    });

    this.updater.on("error", (error) => {
      const operation = this.getActiveDownloadOperation();

      if (!operation) {
        return;
      }

      this.publishOperationError(operation, error);
    });
  }

  private beginOperation(
    kind: UpdateOperationKind,
    runner: (operation: ActiveUpdateOperation) => Promise<void>,
  ): Promise<DesktopUpdateState> {
    if (this.activeOperation) {
      return this.activeOperation.promise;
    }

    const operation: ActiveUpdateOperation = {
      id: ++this.nextOperationId,
      kind,
      startedFrom: this.state,
      aborted: false,
      errorHandled: false,
      downloaded: false,
      promise: Promise.resolve(this.state),
    };

    operation.promise = (async () => {
      try {
        await runner(operation);
      } catch (error) {
        this.publishOperationError(operation, error);
      } finally {
        if (this.activeOperation?.id === operation.id) {
          this.activeOperation = undefined;
        }
      }

      return this.state;
    })();

    this.activeOperation = operation;
    return operation.promise;
  }

  private getActiveDownloadOperation(): ActiveUpdateOperation | undefined {
    if (!this.activeOperation || this.activeOperation.kind !== "download" || this.activeOperation.aborted) {
      return undefined;
    }

    return this.activeOperation;
  }

  private isOperationActive(operation: ActiveUpdateOperation): boolean {
    return this.activeOperation?.id === operation.id && !operation.aborted;
  }

  private publishOperationError(operation: ActiveUpdateOperation, error: unknown): void {
    if (!this.isOperationActive(operation) || operation.errorHandled || isCancellationLikeError(error)) {
      return;
    }

    operation.errorHandled = true;
    this.publish(
      reduceUpdateState(this.state, {
        type: "error",
        message: formatUpdateError(error),
      }),
    );
  }

  private publish(nextState: DesktopUpdateState): void {
    this.state = nextState;
    this.onStateChange(this.state);
  }
}

function getUpdateMetadataAssetName(): string {
  if (process.platform === "darwin") {
    return "latest-mac.yml";
  }

  if (process.platform === "linux") {
    return "latest-linux.yml";
  }

  return "latest.yml";
}

function configureUpdaterForVersion(updater: AppUpdater, version: string): void {
  updater.allowPrerelease = Boolean(getPrereleaseIdentifier(version));
}

function getPrereleaseIdentifier(version: string): string | null {
  const prerelease = version.replace(/^v/, "").split("-", 2)[1];
  return prerelease?.split(".")[0] || null;
}

function getUpdateCancellationToken(result: UpdateCheckResult): CancellationToken {
  return result.cancellationToken ?? new CancellationToken();
}

function createCancelledState(operation: ActiveUpdateOperation): DesktopUpdateState {
  if (operation.kind === "download") {
    const availableVersion = operation.startedFrom.availableVersion;
    const canDownload =
      operation.startedFrom.supportsInstall &&
      (availableVersion
        ? isNewerReleaseVersion(availableVersion, operation.startedFrom.currentVersion)
        : false);

    return {
      ...operation.startedFrom,
      phase: canDownload ? "available" : operation.startedFrom.phase,
      canCheck: true,
      canDownload,
      canInstall: false,
      progress: undefined,
      error: undefined,
      message: getCancelledMessage(operation.kind),
    };
  }

  return {
    ...operation.startedFrom,
    canCheck: true,
    progress: undefined,
    error: undefined,
    message: getCancelledMessage(operation.kind),
  };
}

function getCancelledMessage(kind: UpdateOperationKind): string {
  return kind === "download" ? "已取消更新下载。" : "已取消更新检查。";
}

function getReleasePageUrl(): string {
  const override = process.env.XXT_DL_RELEASE_PAGE_URL?.trim();
  return override || DEFAULT_RELEASE_PAGE_URL;
}

function sameReleaseVersion(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) {
    return false;
  }

  return left.replace(/^v/, "") === right.replace(/^v/, "");
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
  if (error instanceof Error) {
    const details = [error.message.trim()].filter(Boolean);
    const errorCode = readErrorField(error, "code");
    const cause = formatErrorCause(error);

    if (errorCode) {
      details.push(`代码 ${errorCode}`);
    }

    if (cause) {
      details.push(`原因 ${cause}`);
    }

    return `更新失败：${details.join("；") || error.name}`;
  }

  if (typeof error === "string" && error.trim()) {
    return `更新失败：${error.trim()}`;
  }

  const serialized = serializeUnknownError(error);
  return serialized ? `更新失败：${serialized}` : "更新失败：未知错误。";
}

function formatErrorCause(error: Error): string | undefined {
  const cause = readErrorField(error, "cause");

  if (!cause) {
    return undefined;
  }

  if (cause instanceof Error) {
    return cause.message || cause.name;
  }

  if (typeof cause === "string") {
    return cause;
  }

  return serializeUnknownError(cause);
}

function readErrorField(error: Error, fieldName: "code" | "cause"): unknown {
  return (error as Error & Partial<Record<"code" | "cause", unknown>>)[fieldName];
}

function serializeUnknownError(error: unknown): string | undefined {
  if (error === null || error === undefined) {
    return undefined;
  }

  if (typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function isCancellationLikeError(error: unknown): boolean {
  if (error instanceof CancellationError) {
    return true;
  }

  return error instanceof Error && (error.name === "AbortError" || error.message === "cancelled");
}
