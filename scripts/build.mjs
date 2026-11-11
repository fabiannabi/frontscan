import { spawnSync } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "packages", "cli", "dist");

rmSync(dist, { recursive: true, force: true });

const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const run = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { cwd: root, stdio: "inherit" });
if (run.status !== 0) process.exit(run.status ?? 1);

function* jsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(full);
    else if (entry.name.endsWith(".js")) yield full;
  }
}

// Rewrite "@frontscan/<name>" specifiers to relative paths into dist/<name>/src/index.js.
for (const file of jsFiles(dist)) {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits = [];
  for (const node of source.statements) {
    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node))) continue;
    const spec = node.moduleSpecifier;
    if (!spec || !ts.isStringLiteral(spec)) continue;
    const match = /^@frontscan\/([^/]+)$/.exec(spec.text);
    if (!match) continue;
    let rel = relative(dirname(file), join(dist, match[1], "src", "index.js")).split(sep).join(posix.sep);
    if (!rel.startsWith(".")) rel = `./${rel}`;
    edits.push({ start: spec.getStart(source), end: spec.getEnd(), text: JSON.stringify(rel) });
  }
  if (edits.length === 0) continue;
  let out = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  writeFileSync(file, out);
}

copyFileSync(join(root, "LICENSE"), join(root, "packages", "cli", "LICENSE"));
