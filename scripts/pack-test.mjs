import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "packages", "cli", "test", "fixtures", "first-run");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  return result;
}

function listFiles(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? listFiles(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
    )
    .sort();
}

const packDir = mkdtempSync(join(tmpdir(), "frontscan-pack-"));
const installDir = mkdtempSync(join(tmpdir(), "frontscan-install-"));
const copyDir = mkdtempSync(join(tmpdir(), "frontscan-fixture-"));

try {
  const build = run("pnpm", ["build"], root);
  assert.equal(build.status, 0, build.stderr);

  const pack = run("pnpm", ["--filter", "frontscan", "pack", "--pack-destination", packDir], root);
  assert.equal(pack.status, 0, pack.stderr);
  const tgz = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  assert.ok(tgz, "pnpm pack produced no .tgz");

  const install = run("npm", ["install", "--no-audit", "--no-fund", join(packDir, tgz)], installDir);
  assert.equal(install.status, 0, install.stderr);

  const pkgDir = join(installDir, "node_modules", "frontscan");
  const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  assert.equal(manifest.bin.frontscan, "./dist/cli/src/bin.js");
  assert.deepStrictEqual(manifest.dependencies, { typescript: "6.0.3" });
  assert.equal("private" in manifest, false);

  const files = listFiles(pkgDir).filter((f) => f !== "node_modules");
  const top = files.filter((f) => !f.startsWith("dist/"));
  assert.deepStrictEqual(top, ["LICENSE", "README.md", "package.json"]);
  assert.ok(files.some((f) => f === "dist/cli/src/bin.js"));

  const dev = run(process.execPath, [join(root, "packages", "cli", "bin", "frontscan.mjs"), "--json", fixture], root);
  const installed = run("npx", ["--no-install", "frontscan", "--json", fixture], installDir);
  assert.equal(installed.status, dev.status);
  assert.deepStrictEqual(JSON.parse(installed.stdout), JSON.parse(dev.stdout));

  cpSync(fixture, copyDir, { recursive: true });
  const bare = run(join(installDir, "node_modules", ".bin", "frontscan"), [], copyDir);
  assert.equal(bare.status, 0, bare.stderr);
  console.log("pack test passed");
} finally {
  for (const dir of [packDir, installDir, copyDir]) rmSync(dir, { recursive: true, force: true });
}
