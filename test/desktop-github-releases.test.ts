import test from "node:test";
import assert from "node:assert/strict";

import { releaseToUpdateInfo, selectReleaseForUpdates } from "../src/desktop/github-release-source.js";

const releases = [
  {
    tag_name: "v0.3.0-beta.1",
    name: "XXT DL v0.3.0-beta.1",
    body: "预发布说明",
    draft: false,
    prerelease: true,
    published_at: "2026-06-16T11:00:00.000Z",
  },
  {
    tag_name: "v0.2.0",
    name: "XXT DL v0.2.0",
    body: "稳定版说明",
    draft: false,
    prerelease: false,
    published_at: "2026-06-16T10:00:00.000Z",
  },
  {
    tag_name: "v0.1.2",
    name: "XXT DL v0.1.2",
    body: "草稿说明",
    draft: true,
    prerelease: false,
    published_at: "2026-06-16T09:00:00.000Z",
  },
];

test("selectReleaseForUpdates ignores drafts and prereleases by default", () => {
  assert.equal(selectReleaseForUpdates(releases, false)?.tag_name, "v0.2.0");
});

test("selectReleaseForUpdates can opt into prereleases", () => {
  assert.equal(selectReleaseForUpdates(releases, true)?.tag_name, "v0.3.0-beta.1");
});

test("releaseToUpdateInfo maps GitHub release fields to desktop update info", () => {
  assert.deepEqual(releaseToUpdateInfo(releases[1]), {
    version: "v0.2.0",
    releaseName: "XXT DL v0.2.0",
    releaseDate: "2026-06-16T10:00:00.000Z",
    releaseNotes: "稳定版说明",
  });
});
