import childProcess from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

run("node", ["test/sanity.js"]);
run("node", ["scripts/verify-manifest.mjs"]);
run("node", ["scripts/verify-imports.mjs"]);
run("node", ["scripts/locales/verify-locales.mjs"]);
run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/package.ps1"]);
run("node", ["scripts/verify-package.mjs"]);

console.log("release verification ok");

function run(command, args) {
  childProcess.execFileSync(command, args, {
    cwd: ROOT,
    stdio: "inherit"
  });
}
