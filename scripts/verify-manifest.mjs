import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGLISH_MESSAGES } from "./locales/locale-source.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readJson(path.join(ROOT, "manifest.json"));

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(manifest.default_locale === "en", 'manifest.default_locale must be "en"');
assertMessageReference(manifest.name, "manifest.name");
assertMessageReference(manifest.short_name, "manifest.short_name");
assertMessageReference(manifest.description, "manifest.description");
assertMessageReference(manifest.action.default_title, "action.default_title");

assertPath(manifest.background.service_worker, "background.service_worker");
assertPath(manifest.action.default_popup, "action.default_popup");
assertPath(manifest.options_ui.page, "options_ui.page");

Object.values(manifest.icons || {}).forEach(function (iconPath) {
  assertPath(iconPath, `icons.${iconPath}`);
});

Object.values((manifest.action && manifest.action.default_icon) || {}).forEach(function (iconPath) {
  assertPath(iconPath, `action.default_icon.${iconPath}`);
});

(manifest.content_scripts || []).forEach(function (contentScript, index) {
  (contentScript.js || []).forEach(function (scriptPath) {
    assertPath(scriptPath, `content_scripts[${index}].js`);
  });
  (contentScript.css || []).forEach(function (cssPath) {
    assertPath(cssPath, `content_scripts[${index}].css`);
  });
});

assert(
  Array.isArray(manifest.content_scripts) &&
    manifest.content_scripts.some(function (contentScript) {
      return (contentScript.js || []).includes("src/shared/i18n.js");
    }),
  "content scripts must load src/shared/i18n.js before localized content UI"
);

console.log("manifest verification ok");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertPath(relativePath, label) {
  assert(Boolean(relativePath), `${label} is missing`);
  assert(fs.existsSync(path.join(ROOT, relativePath)), `${label} points to missing path: ${relativePath}`);
}

function assertMessageReference(value, label) {
  const match = /^__MSG_([A-Za-z0-9_@]+)__$/.exec(String(value || ""));
  assert(match, `${label} must use a __MSG_key__ reference`);
  assert(Object.prototype.hasOwnProperty.call(ENGLISH_MESSAGES, match[1]), `${label} references unknown locale key: ${match[1]}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
