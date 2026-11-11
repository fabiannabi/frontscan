import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const dist = join(root, "packages", "cli", "dist");
const fixture = join("packages", "cli", "test", "fixtures", "first-run");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]));
}

function spawn(args: string[]) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout };
}

describe("build", () => {
  beforeAll(() => {
    const r = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: root, encoding: "utf8" });
    expect(r.status).toBe(0);
  }, 120_000);

  it("emits the expected files", () => {
    const files = listFiles(dist).map((f) => relative(dist, f).split("\\").join("/")).sort();
    expect(files).toEqual(EXPECTED_FILES);
  });

  it("leaves no @frontscan/ specifier", () => {
    const offenders = listFiles(dist).filter((f) => readFileSync(f, "utf8").includes("@frontscan/"));
    expect(offenders).toEqual([]);
  });

  it("starts bin.js with a shebang", () => {
    const first = readFileSync(join(dist, "cli", "src", "bin.js"), "utf8").split("\n")[0];
    expect(first).toBe("#!/usr/bin/env node");
  });

  it("prints the same as the dev launcher", () => {
    const built = spawn([join("packages", "cli", "dist", "cli", "src", "bin.js"), "--json", fixture]);
    const dev = spawn([join("packages", "cli", "bin", "frontscan.mjs"), "--json", fixture]);
    expect(built).toEqual(dev);
  }, 60_000);
});

const EXPECTED_FILES = [
  "census/src/adoption-score.js",
  "census/src/component-usage.js",
  "census/src/index.js",
  "census/src/prop-usage.js",
  "census/src/raw-colour.js",
  "cli/src/bin.js",
  "cli/src/census-tables.js",
  "cli/src/fix-groups.js",
  "cli/src/html-report.js",
  "cli/src/index.js",
  "cli/src/json-report.js",
  "cli/src/lenses.js",
  "cli/src/main.js",
  "cli/src/summary-report.js",
  "cli/src/terminal-report.js",
  "core/src/css-index.js",
  "core/src/define-lens.js",
  "core/src/design-system.js",
  "core/src/gitignore.js",
  "core/src/index.js",
  "core/src/jsx-index.js",
  "core/src/scan.js",
  "core/src/sort-findings.js",
  "core/src/types.js",
];
