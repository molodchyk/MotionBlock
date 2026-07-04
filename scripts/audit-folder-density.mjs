import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FAIL_ON_HARD = process.argv.includes("--fail-on-hard");
const CHECK_ROOTS = ["src", "src/features", "src/shared", "test", "scripts"];
const FILE_SOFT_LIMIT = 12;
const FILE_HARD_LIMIT = 18;
const FEATURE_SUBFOLDER_SOFT_LIMIT = 15;
const FEATURE_SUBFOLDER_HARD_LIMIT = 22;

const findings = [];

CHECK_ROOTS.forEach(function (relativeRoot) {
  const directory = path.join(ROOT, relativeRoot);
  if (fs.existsSync(directory)) {
    auditDirectory(directory);
  }
});

if (!findings.length) {
  console.log("folder-density audit ok");
  process.exit(0);
}

console.log("folder-density audit findings:");
findings
  .sort(function (a, b) {
    return b.fileCount - a.fileCount;
  })
  .forEach(function (finding) {
    console.log(
      `${finding.severity.toUpperCase()} ${finding.fileCount} files ${finding.relativePath} (soft ${finding.softLimit}, hard ${finding.hardLimit})`
    );
  });

if (FAIL_ON_HARD && findings.some(function (finding) {
  return finding.severity === "hard";
})) {
  process.exitCode = 1;
}

function auditDirectory(directory) {
  const relativePath = path.relative(ROOT, directory) || ".";
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const fileCount = entries.filter(function (entry) {
    return entry.isFile();
  }).length;
  const inFeatureTree = /^src[\\/]features[\\/]/.test(relativePath);
  const softLimit = inFeatureTree ? FEATURE_SUBFOLDER_SOFT_LIMIT : FILE_SOFT_LIMIT;
  const hardLimit = inFeatureTree ? FEATURE_SUBFOLDER_HARD_LIMIT : FILE_HARD_LIMIT;

  if (fileCount > softLimit) {
    findings.push({
      relativePath,
      fileCount,
      softLimit,
      hardLimit,
      severity: fileCount > hardLimit ? "hard" : "soft"
    });
  }

  entries
    .filter(function (entry) {
      return entry.isDirectory() && entry.name !== ".git" && entry.name !== "dist" && entry.name !== "_locales";
    })
    .forEach(function (entry) {
      auditDirectory(path.join(directory, entry.name));
    });
}
