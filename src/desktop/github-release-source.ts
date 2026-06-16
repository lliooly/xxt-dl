import type { DesktopUpdateInfo } from "./update-state.js";

const RELEASES_API_URL = "https://api.github.com/repos/lliooly/xxt-dl/releases";

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
}

export async function fetchLatestReleaseInfo(allowPrerelease: boolean): Promise<DesktopUpdateInfo | undefined> {
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "xxt-dl-update-checker",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases 请求失败：HTTP ${response.status}`);
  }

  const releases = (await response.json()) as GitHubRelease[];
  const release = selectReleaseForUpdates(releases, allowPrerelease);
  return release ? releaseToUpdateInfo(release) : undefined;
}

export function selectReleaseForUpdates(
  releases: GitHubRelease[],
  allowPrerelease: boolean,
): GitHubRelease | undefined {
  return releases.find((release) => !release.draft && (allowPrerelease || !release.prerelease));
}

export function releaseToUpdateInfo(release: GitHubRelease): DesktopUpdateInfo {
  return {
    version: release.tag_name,
    releaseName: release.name || release.tag_name,
    releaseDate: release.published_at,
    releaseNotes: release.body,
  };
}
