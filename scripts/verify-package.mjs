import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LOCALES } from "./locales/locale-source.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const distDirectory = path.join(ROOT, "dist");
const expectedZipName = `motionblock-${manifest.version}.zip`;
const zipFiles = fs.existsSync(distDirectory)
  ? fs.readdirSync(distDirectory).filter(function (name) {
      return /^motionblock-.*\.zip$/.test(name);
    })
  : [];

assert(zipFiles.length === 1 && zipFiles[0] === expectedZipName, `dist must contain only ${expectedZipName}`);

const zipPath = path.join(distDirectory, expectedZipName);
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "motionblock-package-"));

try {
  childProcess.execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    "$zip = $env:MOTIONBLOCK_ZIP; $dest = $env:MOTIONBLOCK_EXTRACT; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $dest)"
  ], {
    env: Object.assign({}, process.env, {
      MOTIONBLOCK_EXTRACT: tempDirectory,
      MOTIONBLOCK_ZIP: zipPath
    })
  });

  assertExists("manifest.json");
  assertExists("src/shared/i18n.js");
  assertExists("src/shared/config.js");
  assertExists("src/app/background/message-router.js");
  assertExists("src/app/popup/view.js");
  assertExists("src/app/popup/controller.js");
  assertExists("src/app/options/controller.js");
  assertExists("src/app/content/frame-context.js");
  assertExists("src/app/content/runtime.js");
  assertExists("src/app/content/scanner.js");
  assertExists("src/app/content/controller.js");
  assertExists("src/platform/chrome/settings-storage.js");
  assertExists("src/features/network-blocking/background/dynamic-rules.js");
  assertExists("src/features/block-stats/background/tab-stats.js");
  assertExists("src/features/block-stats/content/block-stats.js");
  assertExists("src/features/diagnostics/page/media-audio-guard.js");
  assertExists("src/features/diagnostics/page/audio-probe.js");
  assertExists("src/features/diagnostics/shared/url-sanitizer.js");
  assertExists("src/features/diagnostics/background/diagnostics-store.js");
  assertExists("src/features/diagnostics/content/audio-bridge.js");
  assertExists("src/features/diagnostics/content/diagnostics.js");
  assertExists("src/features/uninstall-feedback/background/uninstall-feedback.js");
  assertExists("src/features/emoji-blocking/content/emoji.js");
  assertExists("src/features/media-blocking/content/url-utils.js");
  assertExists("src/features/media-blocking/content/element-inspection.js");
  assertExists("src/features/media-blocking/content/custom-hosts.js");
  assertExists("src/features/media-blocking/content/classifier.js");
  assertExists("src/features/media-blocking/content/original-state.js");
  assertExists("src/features/media-blocking/content/reveal-controls.js");
  assertExists("src/features/media-blocking/content/effects.js");
  assertExists("src/features/media-blocking/content/restore.js");
  assertExists("src/content.js");
  assertExists("src/popup.html");
  assertExists("src/options.html");
  assertExists("_locales/en/messages.json");

  SUPPORTED_LOCALES.forEach(function (locale) {
    assertExists(`_locales/${locale}/messages.json`);
  });

  const packagedManifest = JSON.parse(fs.readFileSync(path.join(tempDirectory, "manifest.json"), "utf8"));
  assert(packagedManifest.default_locale === "en", "packaged manifest is missing default_locale");
  const isolatedContentScript = packagedManifest.content_scripts.find(function (contentScript) {
    return (contentScript.js || []).includes("src/shared/i18n.js");
  });
  assert(isolatedContentScript && isolatedContentScript.js[0] === "src/shared/i18n.js", "packaged isolated content script must load i18n before config/content");

  assertNoRemoteExecutableCode(tempDirectory);
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}

console.log("package verification ok");

function assertExists(relativePath) {
  assert(fs.existsSync(path.join(tempDirectory, relativePath)), `package is missing ${relativePath}`);
}

function assertNoRemoteExecutableCode(directory) {
  const executableFiles = walk(directory).filter(function (filePath) {
    return /\.(js|mjs|html)$/i.test(filePath);
  });

  executableFiles.forEach(function (filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    assert(!/<script[^>]+src=["']https?:\/\//i.test(source), `remote script tag found in ${filePath}`);
    assert(!/importScripts\(["']https?:\/\//i.test(source), `remote importScripts found in ${filePath}`);
  });
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(function (entry) {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
