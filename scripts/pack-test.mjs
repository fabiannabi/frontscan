import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
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

  const dev = run(process.execPath, [join(root, "packages", "cli", "bin", "frontscan.mjs"), "--json", fixture], root);
  const installed = run("npx", ["--no-install", "frontscan", "--json", fixture], installDir);
  assert.equal(installed.status, dev.status);
  assert.deepStrictEqual(JSON.parse(installed.stdout), JSON.parse(dev.stdout));

  cpSync(fixture, copyDir, { recursive: true });
  const bare = run("npx", ["--no-install", "frontscan"], copyDir);
  assert.equal(bare.status, 0, bare.stderr);
  console.log("pack test passed");
} finally {
  for (const dir of [packDir, installDir, copyDir]) rmSync(dir, { recursive: true, force: true });
}
