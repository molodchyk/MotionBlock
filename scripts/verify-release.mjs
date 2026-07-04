import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

run("node", ["test/sanity.js"]);
run("node", ["scripts/verify-manifest.mjs"]);
run("node", ["scripts/verify-imports.mjs"]);
run("node", ["scripts/locales/verify-locales.mjs"]);
run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/package.ps1"]);
run("node", ["scripts/verify-package.mjs"]);
assertIncludes("src/features/uninstall-feedback/background/uninstall-feedback.js", "https://molodchyk.com/motionblock/uninstall/");
assertIncludes("src/features/uninstall-feedback/background/uninstall-feedback.js", "setUninstallURL");
assertIncludes("src/features/uninstall-feedback/background/uninstall-feedback.js", 'url.searchParams.set("source", "chrome")');
assertIncludes("src/features/uninstall-feedback/background/uninstall-feedback.js", 'url.searchParams.set("version"');
assertIncludes("src/features/uninstall-feedback/background/uninstall-feedback.js", 'url.searchParams.set("lang"');
assertIncludes("PRIVACY.md", "Optional Uninstall Feedback");
assertIncludes("docs/chrome-web-store-privacy-form.md", "optional_uninstall_feedback");

console.log("release verification ok");

function run(command, args) {
  childProcess.execFileSync(command, args, {
    cwd: ROOT,
    stdio: "inherit"
  });
}

function assertIncludes(relativePath, expected) {
  const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${relativePath} must include: ${expected}`);
  }
}
