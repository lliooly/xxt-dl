import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("release artifact validation requires both macOS x64 and arm64 installers", () => {
  const root = createReleaseDir();

  writeArtifact(root, "XXT DL-0.1.2-beta.3-mac-x64.dmg");
  writeArtifact(root, "latest-mac.yml", "path: XXT%20DL-0.1.2-beta.3-mac-x64.dmg\n");

  const result = runValidate(root, "macos");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing macOS arm64 DMG installer/);
});

test("release artifact validation accepts split macOS x64 and arm64 artifacts", () => {
  const root = createReleaseDir();

  writeArtifact(root, "release-macos-x64/XXT DL-0.1.2-beta.3-mac-x64.dmg");
  writeArtifact(root, "release-macos-x64/latest-mac.yml", "path: XXT%20DL-0.1.2-beta.3-mac-x64.dmg\n");
  writeArtifact(root, "release-macos-arm64/XXT DL-0.1.2-beta.3-mac-arm64.dmg");
  writeArtifact(root, "release-macos-arm64/latest-mac.yml", "path: XXT%20DL-0.1.2-beta.3-mac-arm64.dmg\n");

  const result = runValidate(root, "macos");

  assert.equal(result.status, 0, result.stderr);
});

function createReleaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xxt-dl-release-"));
}

function writeArtifact(root: string, relativePath: string, content = "artifact") {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runValidate(root: string, platform: string) {
  return spawnSync(
    process.execPath,
    ["scripts/validate-release-artifacts.mjs", "--platform", platform, "--root", root],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
}
