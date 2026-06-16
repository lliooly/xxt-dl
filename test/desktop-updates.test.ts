import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialUpdateState,
  formatReleaseVersion,
  isNewerReleaseVersion,
  normalizeReleaseNotes,
  reduceUpdateState,
  type DesktopUpdateState,
} from "../src/desktop/update-state.js";

test("formatReleaseVersion keeps app versions aligned with release tags", () => {
  assert.equal(formatReleaseVersion("0.1.1"), "v0.1.1");
  assert.equal(formatReleaseVersion("v0.2.0-beta.1"), "v0.2.0-beta.1");
});

test("isNewerReleaseVersion compares release tag versions", () => {
  assert.equal(isNewerReleaseVersion("v0.2.0", "v0.1.1"), true);
  assert.equal(isNewerReleaseVersion("v0.1.1", "v0.1.1"), false);
  assert.equal(isNewerReleaseVersion("v0.1.0", "v0.1.1"), false);
});

test("normalizeReleaseNotes trims plain release notes", () => {
  assert.equal(normalizeReleaseNotes("  ## 新功能\n\n- 支持应用内更新  "), "## 新功能\n\n- 支持应用内更新");
  assert.equal(normalizeReleaseNotes(null), "");
});

test("normalizeReleaseNotes joins full changelog entries", () => {
  assert.equal(
    normalizeReleaseNotes([
      { version: "0.2.0", note: "新增更新中心" },
      { version: "0.1.1", note: "修复打包图标" },
    ]),
    "### 0.2.0\n\n新增更新中心\n\n### 0.1.1\n\n修复打包图标",
  );
});

test("createInitialUpdateState allows release checks but disables installer actions for dev builds", () => {
  assert.deepEqual(createInitialUpdateState("0.1.1", false), {
    phase: "idle",
    currentVersion: "v0.1.1",
    supportsUpdates: false,
    supportsInstall: false,
    canCheck: true,
    canDownload: false,
    canInstall: false,
    message: "当前是开发运行方式，可以检查 release notes，但下载安装需要使用打包后的桌面端。",
  });
});

test("reduceUpdateState exposes a downloadable update with changelog", () => {
  const state = reduceUpdateState(createState(), {
    type: "available",
    checkedAt: "2026-06-16T10:00:00.000Z",
    info: {
      version: "0.2.0",
      releaseName: "XXT DL v0.2.0",
      releaseDate: "2026-06-16T09:30:00.000Z",
      releaseNotes: "## 新功能\n\n- 应用内更新",
    },
  });

  assert.equal(state.phase, "available");
  assert.equal(state.availableVersion, "v0.2.0");
  assert.equal(state.releaseName, "XXT DL v0.2.0");
  assert.equal(state.releaseNotes, "## 新功能\n\n- 应用内更新");
  assert.equal(state.lastCheckedAt, "2026-06-16T10:00:00.000Z");
  assert.equal(state.canDownload, true);
  assert.equal(state.canInstall, false);
});

test("reduceUpdateState keeps installer actions disabled for dev release checks", () => {
  const state = reduceUpdateState(createInitialUpdateState("0.1.1", false), {
    type: "available",
    checkedAt: "2026-06-16T10:00:00.000Z",
    info: {
      version: "v0.2.0",
      releaseNotes: "开发态可以看到这段说明",
    },
  });

  assert.equal(state.phase, "available");
  assert.equal(state.canCheck, true);
  assert.equal(state.canDownload, false);
  assert.equal(state.canInstall, false);
  assert.equal(state.message, "发现新版本 v0.2.0。请从 Release 页面下载安装包。");
});

test("reduceUpdateState keeps progress and enables install after download", () => {
  const downloading = reduceUpdateState(createState(), {
    type: "download-progress",
    progress: {
      percent: 42.5,
      transferred: 425,
      total: 1000,
      bytesPerSecond: 2048,
    },
  });

  assert.equal(downloading.phase, "downloading");
  assert.deepEqual(downloading.progress, {
    percent: 42.5,
    transferred: 425,
    total: 1000,
    bytesPerSecond: 2048,
  });
  assert.equal(downloading.canCheck, false);

  const downloaded = reduceUpdateState(downloading, {
    type: "downloaded",
    info: {
      version: "0.2.0",
      releaseNotes: [{ version: "0.2.0", note: "安装包已准备好" }],
    },
  });

  assert.equal(downloaded.phase, "downloaded");
  assert.equal(downloaded.canInstall, true);
  assert.equal(downloaded.canDownload, false);
  assert.equal(downloaded.releaseNotes, "### 0.2.0\n\n安装包已准备好");
});

function createState(): DesktopUpdateState {
  return createInitialUpdateState("0.1.1", true);
}
