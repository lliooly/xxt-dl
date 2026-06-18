import { compareReleaseVersions, type DesktopUpdateInfo } from "./update-state.js";

const RELEASES_API_URL = "https://api.github.com/repos/lliooly/xxt-dl/releases";
const RELEASES_PAGE_SIZE = 100;
const DEFAULT_RELEASES_TIMEOUT_MS = 15_000;

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets?: GitHubReleaseAsset[];
}

export interface GitHubReleaseAsset {
  name: string;
}

export interface FetchLatestReleaseInfoOptions {
  updateMetadataAssetName?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchLatestReleaseInfo(
  allowPrerelease: boolean,
  options: FetchLatestReleaseInfoOptions = {},
): Promise<DesktopUpdateInfo | undefined> {
  const releases = await fetchGitHubReleases(options);
  const release = selectReleaseForUpdates(releases, allowPrerelease, options.updateMetadataAssetName);
  return release ? releaseToUpdateInfo(release) : undefined;
}

export function selectReleaseForUpdates(
  releases: GitHubRelease[],
  allowPrerelease: boolean,
  updateMetadataAssetName?: string,
): GitHubRelease | undefined {
  return [...releases]
    .filter((release) => {
      if (release.draft || (!allowPrerelease && release.prerelease)) {
        return false;
      }

      if (!updateMetadataAssetName) {
        return true;
      }

      return release.assets?.some((asset) => asset.name === updateMetadataAssetName) ?? false;
    })
    .sort((left, right) => {
      const versionComparison = compareReleaseVersions(right.tag_name, left.tag_name);

      if (versionComparison !== 0) {
        return versionComparison;
      }

      return comparePublishedAt(right.published_at, left.published_at);
    })[0];
}

export function releaseToUpdateInfo(release: GitHubRelease): DesktopUpdateInfo {
  return {
    version: release.tag_name,
    releaseName: release.name || release.tag_name,
    releaseDate: release.published_at,
    releaseNotes: release.body,
  };
}

async function fetchGitHubReleases(options: FetchLatestReleaseInfoOptions): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;

  for (let page = 1; ; page += 1) {
    const response = await fetchGitHubReleasesPage(fetchImpl, page, options);
    const pageReleases = parseGitHubReleasesResponse(await response.json());
    releases.push(...pageReleases);

    if (pageReleases.length < RELEASES_PAGE_SIZE) {
      return releases;
    }
  }
}

async function fetchGitHubReleasesPage(
  fetchImpl: typeof fetch,
  page: number,
  options: FetchLatestReleaseInfoOptions,
): Promise<Response> {
  const { signal, cleanup } = createTimedRequestSignal(options.signal, options.timeoutMs ?? DEFAULT_RELEASES_TIMEOUT_MS);

  try {
    const response = await fetchImpl(buildGitHubReleasesUrl(page), {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "xxt-dl-update-checker",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub Releases 请求失败：HTTP ${response.status}`);
    }

    return response;
  } catch (error) {
    if (signal.aborted && signal.reason instanceof Error) {
      throw signal.reason;
    }

    throw error;
  } finally {
    cleanup();
  }
}

function buildGitHubReleasesUrl(page: number): string {
  const url = new URL(RELEASES_API_URL);
  url.searchParams.set("per_page", String(RELEASES_PAGE_SIZE));
  url.searchParams.set("page", String(page));
  return url.toString();
}

function createTimedRequestSignal(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`GitHub Releases 请求超时：${timeoutMs}ms。`));
  }, timeoutMs);
  const handleParentAbort = () => {
    controller.abort(parentSignal?.reason ?? new Error("GitHub Releases 请求已取消。"));
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      handleParentAbort();
    } else {
      parentSignal.addEventListener("abort", handleParentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", handleParentAbort);
    },
  };
}

function parseGitHubReleasesResponse(value: unknown): GitHubRelease[] {
  if (!Array.isArray(value)) {
    throw new Error("GitHub Releases 响应格式无效：期望数组。");
  }

  return value.map(parseGitHubRelease);
}

function parseGitHubRelease(value: unknown): GitHubRelease {
  if (!value || typeof value !== "object") {
    throw new Error("GitHub Releases 响应格式无效：单个 release 不是对象。");
  }

  const release = value as Record<string, unknown>;
  const tagName = readString(release.tag_name, "tag_name");
  const draft = readBoolean(release.draft, "draft");
  const prerelease = readBoolean(release.prerelease, "prerelease");

  return {
    tag_name: tagName,
    name: readNullableString(release.name, "name"),
    body: readNullableString(release.body, "body"),
    draft,
    prerelease,
    published_at: readNullableString(release.published_at, "published_at"),
    assets: readAssets(release.assets),
  };
}

function readAssets(value: unknown): GitHubReleaseAsset[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("GitHub Releases 响应格式无效：assets 不是数组。");
  }

  return value.map((asset) => {
    if (!asset || typeof asset !== "object") {
      throw new Error("GitHub Releases 响应格式无效：asset 不是对象。");
    }

    const assetRecord = asset as Record<string, unknown>;
    return { name: readString(assetRecord.name, "assets[].name") };
  });
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`GitHub Releases 响应格式无效：${fieldName} 不是字符串。`);
  }

  return value;
}

function readNullableString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return readString(value, fieldName);
}

function readBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`GitHub Releases 响应格式无效：${fieldName} 不是布尔值。`);
  }

  return value;
}

function comparePublishedAt(left: string | null, right: string | null): number {
  const leftTimestamp = left ? Date.parse(left) : 0;
  const rightTimestamp = right ? Date.parse(right) : 0;
  return leftTimestamp - rightTimestamp;
}
