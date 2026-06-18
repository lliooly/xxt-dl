import test from "node:test";
import assert from "node:assert/strict";

import { fetchLatestReleaseInfo, releaseToUpdateInfo, selectReleaseForUpdates } from "../src/desktop/github-release-source.js";

const releases = [
  {
    tag_name: "v0.3.0-beta.1",
    name: "XXT DL v0.3.0-beta.1",
    body: "预发布说明",
    draft: false,
    prerelease: true,
    published_at: "2026-06-16T11:00:00.000Z",
    assets: [{ name: "latest-mac.yml" }],
  },
  {
    tag_name: "v0.2.0",
    name: "XXT DL v0.2.0",
    body: "稳定版说明",
    draft: false,
    prerelease: false,
    published_at: "2026-06-16T10:00:00.000Z",
    assets: [{ name: "latest-mac.yml" }],
  },
  {
    tag_name: "v0.1.2",
    name: "XXT DL v0.1.2",
    body: "草稿说明",
    draft: true,
    prerelease: false,
    published_at: "2026-06-16T09:00:00.000Z",
    assets: [{ name: "latest-mac.yml" }],
  },
];

test("selectReleaseForUpdates ignores drafts and prereleases by default", () => {
  assert.equal(selectReleaseForUpdates(releases, false)?.tag_name, "v0.2.0");
});

test("selectReleaseForUpdates can opt into prereleases", () => {
  assert.equal(selectReleaseForUpdates(releases, true)?.tag_name, "v0.3.0-beta.1");
});

test("selectReleaseForUpdates chooses the highest semver release instead of API order", () => {
  assert.equal(
    selectReleaseForUpdates(
      [
        {
          tag_name: "v0.9.9",
          name: "XXT DL v0.9.9",
          body: "较晚发布的旧 hotfix",
          draft: false,
          prerelease: false,
          published_at: "2026-06-18T10:00:00.000Z",
          assets: [{ name: "latest-mac.yml" }],
        },
        {
          tag_name: "v1.0.0",
          name: "XXT DL v1.0.0",
          body: "真正的最新版本",
          draft: false,
          prerelease: false,
          published_at: "2026-06-17T10:00:00.000Z",
          assets: [{ name: "latest-mac.yml" }],
        },
      ],
      false,
      "latest-mac.yml",
    )?.tag_name,
    "v1.0.0",
  );
});

test("selectReleaseForUpdates skips releases without update metadata when required", () => {
  assert.equal(
    selectReleaseForUpdates(
      [
        {
          tag_name: "v0.1.1",
          name: "XXT DL v0.1.1",
          body: "旧稳定版没有更新元数据",
          draft: false,
          prerelease: false,
          published_at: "2026-06-15T10:00:00.000Z",
          assets: [{ name: "XXT DL-0.1.1-mac-arm64.dmg" }],
        },
        {
          tag_name: "v0.1.2-beta.3",
          name: "XXT DL v0.1.2-beta.3",
          body: "测试版有更新元数据",
          draft: false,
          prerelease: true,
          published_at: "2026-06-18T10:00:00.000Z",
          assets: [{ name: "latest-mac.yml" }],
        },
      ],
      true,
      "latest-mac.yml",
    )?.tag_name,
    "v0.1.2-beta.3",
  );
});

test("releaseToUpdateInfo maps GitHub release fields to desktop update info", () => {
  assert.deepEqual(releaseToUpdateInfo(releases[1]), {
    version: "v0.2.0",
    releaseName: "XXT DL v0.2.0",
    releaseDate: "2026-06-16T10:00:00.000Z",
    releaseNotes: "稳定版说明",
  });
});

test("fetchLatestReleaseInfo paginates beyond the first hundred releases", async () => {
  const pageRequests: string[] = [];

  const info = await fetchLatestReleaseInfo(false, {
    fetchImpl: async (input) => {
      const url = String(input);
      pageRequests.push(url);
      const page = new URL(url).searchParams.get("page");

      if (page === "1") {
        return createFetchResponse(
          Array.from({ length: 100 }, (_, index) => ({
            tag_name: `v0.0.${index + 1}`,
            name: `XXT DL v0.0.${index + 1}`,
            body: "旧版本",
            draft: false,
            prerelease: false,
            published_at: "2026-06-16T10:00:00.000Z",
            assets: [{ name: "latest-mac.yml" }],
          })),
        );
      }

      return createFetchResponse([
        {
          tag_name: "v0.2.0",
          name: "XXT DL v0.2.0",
          body: "第二页的更新",
          draft: false,
          prerelease: false,
          published_at: "2026-06-18T10:00:00.000Z",
          assets: [{ name: "latest-mac.yml" }],
        },
      ]);
    },
    updateMetadataAssetName: "latest-mac.yml",
  });

  assert.equal(info?.version, "v0.2.0");
  assert.equal(pageRequests.length, 2);
});

test("fetchLatestReleaseInfo validates GitHub release payload shape", async () => {
  await assert.rejects(
    fetchLatestReleaseInfo(false, {
      fetchImpl: async () => createFetchResponse({ invalid: true }),
    }),
    /响应格式/,
  );
});

test("fetchLatestReleaseInfo times out stalled requests", async () => {
  await assert.rejects(
    fetchLatestReleaseInfo(false, {
      timeoutMs: 10,
      fetchImpl: async (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason ?? new Error("aborted")),
            { once: true },
          );
        }),
    }),
    /超时/,
  );
});

function createFetchResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
