import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkedReferences = [];

walk(path.join(ROOT, "src"))
  .filter(function (filePath) {
    return /\.(?:js|html)$/.test(filePath);
  })
  .forEach(function (filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    if (filePath.endsWith(".js")) {
      checkImportScripts(filePath, source);
      checkStaticImports(filePath, source);
    }
    if (filePath.endsWith(".html")) {
      checkHtmlScripts(filePath, source);
    }
  });

console.log(`import verification ok (${checkedReferences.length} references)`);

function checkImportScripts(filePath, source) {
  const pattern = /importScripts\(([^)]*)\)/g;
  let match;

  while ((match = pattern.exec(source))) {
    const references = Array.from(match[1].matchAll(/["']([^"']+)["']/g)).map(function (referenceMatch) {
      return referenceMatch[1];
    });

    references.forEach(function (reference) {
      assertRelativeFile(filePath, reference, "importScripts");
    });
  }
}

function checkStaticImports(filePath, source) {
  const pattern = /(?:import\s+(?:[^"']+\s+from\s+)?|export\s+[^"']+\s+from\s+)["']([^"']+)["']/g;
  let match;

  while ((match = pattern.exec(source))) {
    const reference = match[1];
    if (reference.startsWith(".") || reference.startsWith("/")) {
      assertRelativeFile(filePath, reference, "static import");
    }
  }
}

function checkHtmlScripts(filePath, source) {
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = pattern.exec(source))) {
    assertRelativeFile(filePath, match[1], "HTML script");
  }
}

function assertRelativeFile(ownerPath, reference, kind) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(reference) || reference.startsWith("chrome-extension://")) {
    throw new Error(`${kind} in ${toRelative(ownerPath)} uses remote or absolute URL: ${reference}`);
  }

  const resolved = path.resolve(path.dirname(ownerPath), reference);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${kind} in ${toRelative(ownerPath)} points to missing file: ${reference}`);
  }

  checkedReferences.push(`${toRelative(ownerPath)} -> ${toRelative(resolved)}`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(function (entry) {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath);
}
