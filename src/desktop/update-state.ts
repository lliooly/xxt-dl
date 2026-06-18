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
  | { type: "not-available"; checkedAt: string; info?: DesktopUpdateInfo }
  | { type: "download-progress"; progress: DesktopUpdateProgress }
  | { type: "downloaded"; info: DesktopUpdateInfo }
  | { type: "error"; message: string }
  | { type: "reset" };

const devModeMessage = "当前是开发运行方式，可以检查 release notes，但下载安装需要使用打包后的桌面端。";

export function createInitialUpdateState(currentVersion: string, supportsInstall: boolean): DesktopUpdateState {
  return {
    phase: "idle",
    currentVersion: formatReleaseVersion(currentVersion),
    supportsUpdates: true,
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
  return compareReleaseVersions(candidate, current) > 0;
}

export function compareReleaseVersions(left: string, right: string): number {
  const leftVersion = parseReleaseVersion(left);
  const rightVersion = parseReleaseVersion(right);

  const length = Math.max(leftVersion.parts.length, rightVersion.parts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.parts[index] ?? 0;
    const rightPart = rightVersion.parts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
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
        canDownload: state.supportsInstall && isNewerReleaseVersion(event.info.version, state.currentVersion),
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
        ...state,
        ...(event.info ? updateInfoFields(event.info) : {}),
        phase: "not-available",
        canCheck: true,
        canDownload: false,
        canInstall: false,
        lastCheckedAt: event.checkedAt,
        progress: undefined,
        error: undefined,
        message: event.info
          ? `当前已经是最新版本 ${formatReleaseVersion(event.info.version)}。`
          : "当前已经是最新版本。",
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
        canDownload:
          state.supportsInstall && (state.phase === "available" || state.phase === "downloading"),
        canInstall: state.phase === "downloaded",
        error: event.message,
        message: event.message,
      };

    case "reset":
      return createInitialUpdateState(state.currentVersion, state.supportsInstall);
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

interface ParsedReleaseVersion {
  parts: number[];
  prerelease: string[];
}

function parseReleaseVersion(version: string): ParsedReleaseVersion {
  const [core = "", prerelease = ""] = formatReleaseVersion(version)
    .slice(1)
    .split("-", 2);
  const normalized = core
    .split(".")
    .map((part) => Number.parseInt(part, 10));

  return {
    parts: normalized.map((part) => (Number.isFinite(part) ? part : 0)),
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

function comparePrerelease(candidate: string[], current: string[]): number {
  if (candidate.length === 0 && current.length === 0) {
    return 0;
  }

  if (candidate.length === 0) {
    return 1;
  }

  if (current.length === 0) {
    return -1;
  }

  const length = Math.max(candidate.length, current.length);

  for (let index = 0; index < length; index += 1) {
    const candidatePart = candidate[index];
    const currentPart = current[index];

    if (candidatePart === undefined) {
      return -1;
    }

    if (currentPart === undefined) {
      return 1;
    }

    const comparison = comparePrereleasePart(candidatePart, currentPart);

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

function comparePrereleasePart(candidate: string, current: string): number {
  const candidateNumber = Number.parseInt(candidate, 10);
  const currentNumber = Number.parseInt(current, 10);
  const candidateIsNumber = String(candidateNumber) === candidate;
  const currentIsNumber = String(currentNumber) === current;

  if (candidateIsNumber && currentIsNumber) {
    return Math.sign(candidateNumber - currentNumber);
  }

  if (candidateIsNumber) {
    return -1;
  }

  if (currentIsNumber) {
    return 1;
  }

  return candidate.localeCompare(current);
}
