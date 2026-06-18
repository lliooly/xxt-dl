#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const options = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || "release");
const version = options.version || readPackageVersion();
const prereleaseIdentifier = getPrereleaseIdentifier(version);

if (!prereleaseIdentifier) {
  console.log(`Skipped prerelease update alias generation for stable version ${version}`);
  process.exit(0);
}

if (!fs.existsSync(root)) {
  fail(`Release artifact directory does not exist: ${root}`);
}

const metadataFiles = listFiles(root).filter((file) => /^latest(?:-mac|-linux)?\.yml$/.test(path.basename(file)));

if (metadataFiles.length === 0) {
  fail(`No updater metadata files found in ${root}`);
}

for (const metadataFile of metadataFiles) {
  const aliasFile = path.join(path.dirname(metadataFile), path.basename(metadataFile).replace(/^latest/, prereleaseIdentifier));
  fs.copyFileSync(metadataFile, aliasFile);
  console.log(`Created ${path.relative(root, aliasFile)} from ${path.relative(root, metadataFile)}`);
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--root" || arg === "--version") {
      parsed[arg.slice(2)] = args[index + 1];
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readPackageVersion() {
  const packageJsonPath = path.resolve("package.json");

  if (!fs.existsSync(packageJsonPath)) {
    fail(`package.json does not exist: ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  if (!packageJson.version || typeof packageJson.version !== "string") {
    fail(`package.json version is missing or invalid: ${packageJsonPath}`);
  }

  return packageJson.version;
}

function getPrereleaseIdentifier(version) {
  const prerelease = version.trim().replace(/^v/, "").split("-", 2)[1];
  return prerelease?.split(".")[0] || null;
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function fail(message) {
  console.error(`Prerelease update alias generation failed: ${message}`);
  process.exit(1);
}
