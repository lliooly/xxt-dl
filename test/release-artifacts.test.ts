import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("release artifact validation requires both macOS x64 and arm64 installers", () => {
  const root = createReleaseDir();

  writeArtifact(root, "XXT DL-0.1.2-beta.2-mac-x64.dmg");
  writeArtifact(root, "latest-mac.yml", "path: XXT%20DL-0.1.2-beta.2-mac-x64.dmg\n");

  const result = runValidate(root, "macos");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing macOS arm64 DMG installer/);
});

test("release artifact validation accepts split macOS x64 and arm64 artifacts", () => {
  const root = createReleaseDir();

  writeArtifact(root, "release-macos-x64/XXT DL-0.1.2-beta.2-mac-x64.dmg");
  writeArtifact(root, "release-macos-x64/latest-mac.yml", "path: XXT%20DL-0.1.2-beta.2-mac-x64.dmg\n");
  writeArtifact(root, "release-macos-arm64/XXT DL-0.1.2-beta.2-mac-arm64.dmg");
  writeArtifact(root, "release-macos-arm64/latest-mac.yml", "path: XXT%20DL-0.1.2-beta.2-mac-arm64.dmg\n");

  const result = runValidate(root, "macos");

  assert.equal(result.status, 0, result.stderr);
});

test("prerelease update alias generator creates channel-specific metadata files", () => {
  const root = createReleaseDir();

  writeArtifact(root, "latest-mac.yml", "path: XXT%20DL-0.1.2-beta.2-mac-x64.dmg\n");
  writeArtifact(root, "latest.yml", "path: XXT%20DL-0.1.2-beta.2-win-x64.exe\n");
  writeArtifact(root, "latest-linux.yml", "path: XXT%20DL-0.1.2-beta.2-linux.AppImage\n");

  const result = runAliasGenerator(root, "0.1.2-beta.2");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(root, "beta-mac.yml"), "utf8"), "path: XXT%20DL-0.1.2-beta.2-mac-x64.dmg\n");
  assert.equal(fs.readFileSync(path.join(root, "beta.yml"), "utf8"), "path: XXT%20DL-0.1.2-beta.2-win-x64.exe\n");
  assert.equal(fs.readFileSync(path.join(root, "beta-linux.yml"), "utf8"), "path: XXT%20DL-0.1.2-beta.2-linux.AppImage\n");
});

test("prerelease update alias generator skips stable versions", () => {
  const root = createReleaseDir();

  writeArtifact(root, "latest-mac.yml", "path: XXT%20DL-0.1.2-mac-x64.dmg\n");

  const result = runAliasGenerator(root, "0.1.2");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, "beta-mac.yml")), false);
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

function runAliasGenerator(root: string, version: string) {
  return spawnSync(
    process.execPath,
    ["scripts/create-prerelease-update-aliases.mjs", "--root", root, "--version", version],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
}
