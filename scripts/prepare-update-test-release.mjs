#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

const input = process.argv[2];

if (!input || input === "--help" || input === "-h") {
  printHelp();
  process.exit(input ? 0 : 1);
}

const version = normalizeVersion(input);

updatePackageJson(version);
updatePackageLock(version);

console.log(`Prepared update test version v${version}`);
console.log("");
console.log("Next steps:");
console.log(`  npm run check && npm test && npm run build`);
console.log(`  git add package.json package-lock.json`);
console.log(`  git commit -m "chore(发布): 准备 v${version} 测试版本"`);
console.log(`  git tag v${version}`);
console.log(`  git push && git push origin v${version}`);

function normalizeVersion(value) {
  const trimmed = value.trim().replace(/^v/, "");

  if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(trimmed)) {
    fail("Version must look like v0.1.2-beta.0 or 0.1.2-beta.0.");
  }

  return trimmed;
}

function updatePackageJson(version) {
  const packageJson = readJson("package.json");
  packageJson.version = version;
  writeJson("package.json", packageJson);
}

function updatePackageLock(version) {
  const lockFile = "package-lock.json";

  if (!fs.existsSync(lockFile)) {
    return;
  }

  const lock = readJson(lockFile);

  if ("version" in lock) {
    lock.version = version;
  }

  if (lock.packages?.[""]) {
    lock.packages[""].version = version;
  }

  writeJson(lockFile, lock);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run release:test-version -- v0.1.2-beta.0");
  console.log("");
  console.log("This prepares package.json and package-lock.json for an app update test release.");
}

function fail(message) {
  console.error(`Failed to prepare update test release: ${message}`);
  process.exit(1);
}
