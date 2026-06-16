export type DesktopUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "unsupported";

export interface DesktopUpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface DesktopUpdateInfo {
  version: string;
  releaseName?: string | null;
  releaseDate?: string | null;
  releaseNotes?: ReleaseNotesInput;
}

export interface DesktopUpdateState {
  phase: DesktopUpdatePhase;
  currentVersion: string;
  supportsUpdates: boolean;
  supportsInstall: boolean;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
  availableVersion?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progress?: DesktopUpdateProgress;
  lastCheckedAt?: string;
  message?: string;
  error?: string;
}

export type ReleaseNotesInput = string | null | undefined | ReleaseNoteEntry[];

interface ReleaseNoteEntry {
  version?: string | null;
  note?: string | null;
}

export type DesktopUpdateEvent =
  | { type: "checking" }
  | { type: "available"; info: DesktopUpdateInfo; checkedAt: string }
  | { type: "not-available"; checkedAt: string }
  | { type: "download-progress"; progress: DesktopUpdateProgress }
  | { type: "downloaded"; info: DesktopUpdateInfo }
  | { type: "error"; message: string }
  | { type: "reset" };

const devModeMessage = "当前是开发运行方式，可以检查 release notes，但下载安装需要使用打包后的桌面端。";

export function createInitialUpdateState(currentVersion: string, supportsInstall: boolean): DesktopUpdateState {
  return {
    phase: "idle",
    currentVersion: formatReleaseVersion(currentVersion),
    supportsUpdates: supportsInstall,
    supportsInstall,
    canCheck: true,
    canDownload: false,
    canInstall: false,
    message: supportsInstall ? undefined : devModeMessage,
  };
}

export function formatReleaseVersion(version: string): string {
  const trimmed = version.trim();
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export function isNewerReleaseVersion(candidate: string, current: string): boolean {
  const candidateParts = parseVersionParts(candidate);
  const currentParts = parseVersionParts(current);

  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] > currentParts[index]) {
      return true;
    }

    if (candidateParts[index] < currentParts[index]) {
      return false;
    }
  }

  return false;
}

export function normalizeReleaseNotes(releaseNotes: ReleaseNotesInput): string {
  if (!releaseNotes) {
    return "";
  }

  if (typeof releaseNotes === "string") {
    return releaseNotes.trim();
  }

  return releaseNotes
    .map((entry) => {
      const version = entry.version?.trim();
      const note = entry.note?.trim();

      if (version && note) {
        return `### ${version}\n\n${note}`;
      }

      return note || version || "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function reduceUpdateState(state: DesktopUpdateState, event: DesktopUpdateEvent): DesktopUpdateState {
  switch (event.type) {
    case "checking":
      return {
        ...state,
        phase: "checking",
        canCheck: false,
        canDownload: false,
        canInstall: false,
        error: undefined,
        message: "正在检查新版本。",
      };

    case "available":
      return {
        ...state,
        ...updateInfoFields(event.info),
        phase: "available",
        canCheck: true,
        canDownload: state.supportsInstall,
        canInstall: false,
        progress: undefined,
        lastCheckedAt: event.checkedAt,
        error: undefined,
        message: state.supportsInstall
          ? `发现新版本 ${formatReleaseVersion(event.info.version)}。`
          : `发现新版本 ${formatReleaseVersion(event.info.version)}。请从 Release 页面下载安装包。`,
      };

    case "not-available":
      return {
        phase: "not-available",
        currentVersion: state.currentVersion,
        supportsUpdates: state.supportsUpdates,
        supportsInstall: state.supportsInstall,
        canCheck: true,
        canDownload: false,
        canInstall: false,
        lastCheckedAt: event.checkedAt,
        message: "当前已经是最新版本。",
      };

    case "download-progress":
      return {
        ...state,
        phase: "downloading",
        canCheck: false,
        canDownload: false,
        canInstall: false,
        progress: event.progress,
        error: undefined,
        message: `正在下载更新 ${Math.round(event.progress.percent)}%。`,
      };

    case "downloaded":
      return {
        ...state,
        ...updateInfoFields(event.info),
        phase: "downloaded",
        canCheck: true,
        canDownload: false,
        canInstall: true,
        progress: state.progress
          ? {
              ...state.progress,
              percent: 100,
            }
          : undefined,
        error: undefined,
        message: "更新已下载，重启应用后安装。",
      };

    case "error":
      return {
        ...state,
        phase: "error",
        canCheck: true,
        canDownload: state.phase === "available",
        canInstall: state.phase === "downloaded",
        error: event.message,
        message: event.message,
      };

    case "reset":
      return createInitialUpdateState(state.currentVersion, state.supportsUpdates);
  }
}

function updateInfoFields(info: DesktopUpdateInfo): Pick<
  DesktopUpdateState,
  "availableVersion" | "releaseName" | "releaseDate" | "releaseNotes"
> {
  return {
    availableVersion: formatReleaseVersion(info.version),
    releaseName: info.releaseName || undefined,
    releaseDate: info.releaseDate || undefined,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes) || undefined,
  };
}

function parseVersionParts(version: string): [number, number, number] {
  const normalized = formatReleaseVersion(version)
    .slice(1)
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10));

  return [
    Number.isFinite(normalized[0]) ? normalized[0] : 0,
    Number.isFinite(normalized[1]) ? normalized[1] : 0,
    Number.isFinite(normalized[2]) ? normalized[2] : 0,
  ];
}
