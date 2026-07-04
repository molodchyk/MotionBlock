import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FAIL_ON_HARD = process.argv.includes("--fail-on-hard");
const TARGETS = [
  {
    pattern: /^src[\\/](background|popup|options)\.js$/,
    kind: "runtime entry",
    soft: 150,
    hard: 600
  },
  {
    pattern: /^src[\\/]content\.js$/,
    kind: "content-script adapter",
    soft: 350,
    hard: 900
  },
  {
    pattern: /^src[\\/].*\.css$/,
    kind: "CSS surface",
    soft: 500,
    hard: 900
  },
  {
    pattern: /^src[\\/].*\.js$/,
    kind: "source module",
    soft: 450,
    hard: 900
  },
  {
    pattern: /^test[\\/].*\.js$/,
    kind: "test file",
    soft: 500,
    hard: 900
  },
  {
    pattern: /^scripts[\\/].*\.(?:js|mjs|ps1)$/,
    kind: "script",
    soft: 500,
    hard: 900
  }
];

const files = walk(ROOT).filter(function (filePath) {
  const relativePath = toRelative(filePath);
  return /^(src|test|scripts)[\\/]/.test(relativePath) && /\.(?:js|mjs|css|html|ps1)$/.test(relativePath);
});

const findings = files
  .map(function (filePath) {
    const relativePath = toRelative(filePath);
    const target = TARGETS.find(function (candidate) {
      return candidate.pattern.test(relativePath);
    });
    if (!target) {
      return null;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
    const severity = lines > target.hard ? "hard" : lines > target.soft ? "soft" : "";
    return severity ? { relativePath, lines, target, severity } : null;
  })
  .filter(Boolean)
  .sort(function (a, b) {
    return b.lines - a.lines;
  });

if (!findings.length) {
  console.log("file-size audit ok");
  process.exit(0);
}

console.log("file-size audit findings:");
findings.forEach(function (finding) {
  console.log(
    `${finding.severity.toUpperCase()} ${finding.lines} lines ${finding.relativePath} (${finding.target.kind}, soft ${finding.target.soft}, hard ${finding.target.hard})`
  );
});

if (FAIL_ON_HARD && findings.some(function (finding) {
  return finding.severity === "hard";
})) {
  process.exitCode = 1;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(function (entry) {
    if (entry.name === ".git" || entry.name === "dist" || entry.name === "_locales") {
      return [];
    }

    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath);
}
