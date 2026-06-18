#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const platformRequirements = {
  macos: {
    required: [
      { label: "macOS DMG installer", pattern: /\.dmg$/ },
      { label: "macOS updater metadata", pattern: /(^|[/\\])latest-mac\.yml$/ },
    ],
    metadata: { file: "latest-mac.yml", references: /\.dmg$/ },
    forbidden: [
      { label: "macOS PKG installer", pattern: /\.pkg$/ },
      { label: "macOS ZIP installer", pattern: /\.zip$/ },
    ],
  },
  windows: {
    required: [
      { label: "Windows NSIS installer", pattern: /-win-[^-]+\.exe$/ },
      { label: "Windows updater metadata", pattern: /(^|[/\\])latest\.yml$/ },
    ],
    metadata: { file: "latest.yml", references: /-win-[^-]+\.exe$/ },
    forbidden: [
      { label: "Windows MSI installer", pattern: /\.msi$/ },
      { label: "Windows portable ZIP", pattern: /\.zip$/ },
    ],
  },
  linux: {
    required: [
      { label: "Linux AppImage installer", pattern: /\.AppImage$/ },
      { label: "Linux Deb package", pattern: /\.deb$/ },
      { label: "Linux updater metadata", pattern: /(^|[/\\])latest-linux\.yml$/ },
    ],
    metadata: { file: "latest-linux.yml", references: /\.AppImage$/ },
    forbidden: [
      { label: "Linux RPM package", pattern: /\.rpm$/ },
      { label: "Linux Snap package", pattern: /\.snap$/ },
    ],
  },
};

const options = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || "release");
const platforms = options.platform === "all" ? Object.keys(platformRequirements) : [options.platform || currentPlatform()];

if (!fs.existsSync(root)) {
  fail(`Release artifact directory does not exist: ${root}`);
}

const files = listFiles(root);
const relativeFiles = files.map((file) => normalizePath(path.relative(root, file)));

for (const platform of platforms) {
  const requirements = platformRequirements[platform];

  if (!requirements) {
    fail(`Unsupported platform "${platform}". Use one of: ${Object.keys(platformRequirements).join(", ")}, all.`);
  }

  validatePlatform(root, relativeFiles, requirements);
}

console.log(`Validated ${platforms.join(", ")} release artifacts in ${root}`);

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--root" || arg === "--platform") {
      parsed[arg.slice(2)] = args[index + 1];
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function currentPlatform() {
  if (process.platform === "darwin") {
    return "macos";
  }

  if (process.platform === "win32") {
    return "windows";
  }

  return "linux";
}

function validatePlatform(rootDir, relativePaths, requirements) {
  const matchedFiles = new Set();

  for (const requirement of requirements.required) {
    const matches = relativePaths.filter((file) => requirement.pattern.test(file));

    if (matches.length === 0) {
      fail(`Missing ${requirement.label}. Looked in ${rootDir}`);
    }

    for (const match of matches) {
      assertNonEmpty(path.join(rootDir, match), requirement.label);
      matchedFiles.add(match);
    }
  }

  for (const forbidden of requirements.forbidden) {
    const matches = relativePaths.filter((file) => forbidden.pattern.test(file));

    if (matches.length > 0) {
      fail(`Unexpected ${forbidden.label}: ${matches.join(", ")}`);
    }
  }

  validateMetadata(rootDir, relativePaths, matchedFiles, requirements.metadata);
}

function validateMetadata(rootDir, relativePaths, matchedFiles, metadata) {
  const metadataFile = relativePaths.find((file) => path.basename(file) === metadata.file);

  if (!metadataFile) {
    fail(`Missing updater metadata file: ${metadata.file}`);
  }

  const metadataPath = path.join(rootDir, metadataFile);
  const text = fs.readFileSync(metadataPath, "utf8");
  const referencedInstaller = [...matchedFiles].find(
    (file) => metadata.references.test(file) && metadataReferencesFile(text, path.basename(file), metadata.references),
  );

  if (!referencedInstaller) {
    fail(`${metadata.file} does not reference the expected installer artifact.\n${metadataDiagnostics(text, matchedFiles)}`);
  }
}

function metadataReferencesFile(text, fileName, expectedPattern) {
  const candidates = new Set([
    fileName,
    encodeURI(fileName),
    encodeURIComponent(fileName),
  ]);

  if ([...candidates].some((candidate) => text.includes(candidate))) {
    return true;
  }

  const referencedNames = extractMetadataReferences(text);
  return referencedNames.some((name) => expectedPattern.test(name) || expectedPattern.test(decodeMetadataValue(name)));
}

function extractMetadataReferences(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*(?:path|url):\s*['"]?([^'"]+)['"]?\s*$/);
      return match?.[1]?.trim();
    })
    .filter(Boolean);
}

function decodeMetadataValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function metadataDiagnostics(text, matchedFiles) {
  const references = extractMetadataReferences(text);
  const fileList = [...matchedFiles].join(", ") || "(none)";
  const referenceList = references.join(", ") || "(none)";

  return `Matched installers: ${fileList}\nMetadata references: ${referenceList}`;
}

function assertNonEmpty(file, label) {
  const stat = fs.statSync(file);

  if (!stat.isFile() || stat.size === 0) {
    fail(`${label} is empty or not a file: ${file}`);
  }
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

function normalizePath(file) {
  return file.split(path.sep).join("/");
}

function fail(message) {
  console.error(`Release artifact validation failed: ${message}`);
  process.exit(1);
}
