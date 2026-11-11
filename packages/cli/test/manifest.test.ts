import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface Manifest {
  name?: string;
  version?: string;
  bin?: string | Record<string, string>;
}

function readManifest(file: string): Manifest {
  return JSON.parse(readFileSync(join(root, file), "utf8")) as Manifest;
}

const manifestFiles = [
  "package.json",
  ...readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `packages/${e.name}/package.json`)
    .filter((f) => {
      try {
        readFileSync(join(root, f));
        return true;
      } catch {
        return false;
      }
    }),
];

const cliManifest = readManifest("packages/cli/package.json");

describe("package manifests", () => {
  it("no bin path starts with ./", () => {
    const offenders: { file: string; name: string; value: string }[] = [];
    for (const file of manifestFiles) {
      const manifest = readManifest(file);
      const bin = typeof manifest.bin === "string" ? { [manifest.name ?? ""]: manifest.bin } : (manifest.bin ?? {});
      for (const [name, value] of Object.entries(bin)) {
        if (value.startsWith("./")) offenders.push({ file, name, value });
      }
    }
    offenders.sort((a, b) => (a.file === b.file ? a.name.localeCompare(b.name) : a.file.localeCompare(b.file)));
    expect(offenders).toEqual([]);
  });

  it("frontscan bin is the built entry", () => {
    expect(cliManifest.bin).toEqual({ frontscan: "dist/cli/src/bin.js" });
    expect(cliManifest.version).toBe("0.1.1");
  });
});
