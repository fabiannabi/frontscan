import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scan } from "../src/index.js";

const fixtures = path.join(import.meta.dirname, "fixtures");
const created: string[] = [];

async function tree(files: Record<string, string | Buffer>): Promise<string> {
  await fs.mkdir(fixtures, { recursive: true });
  const root = await fs.mkdtemp(path.join(fixtures, ".tmp-"));
  created.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  return root;
}

afterAll(async () => {
  await Promise.all(created.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

const paths = async (root: string) => (await scan(root)).files.map((f) => f.path);

describe("scan", () => {
  it("indexes the reference tree", async () => {
    const root = await tree({
      ".gitignore": "*.log\n/secret.txt\ngen/\n!keep.log\n",
      "src/App.tsx": "export const A = 1;\n",
      "src/b.ts": "",
      "src/util.MJS": "x",
      "src/styles.scss": "x",
      "src/x.css": "x",
      "app.log": "x",
      "keep.log": "x",
      "secret.txt": "x",
      "sub/secret.txt": "x",
      "gen/a.ts": "x",
      "sub/.gitignore": "local.ts\n",
      "sub/local.ts": "x",
      "sub/other.ts": "x",
      "node_modules/p/index.js": "x",
      "dist/a.js": "x",
      ".git/HEAD": "ref",
      ".github/workflows/ci.yml": "x",
      "logo.png": Buffer.from([1, 2, 0, 3]),
      "README.md": "x",
      "data.json": "{}",
      "index.html": "x",
    });
    const index = await scan(root);
    expect(index.root).toBe(path.resolve(root));
    expect(index.files.map((f) => [f.path, f.kind])).toEqual([
      [".github/workflows/ci.yml", "other"],
      [".gitignore", "other"],
      ["README.md", "md"],
      ["data.json", "json"],
      ["index.html", "html"],
      ["keep.log", "other"],
      ["src/App.tsx", "tsx"],
      ["src/b.ts", "ts"],
      ["src/styles.scss", "scss"],
      ["src/util.MJS", "js"],
      ["src/x.css", "css"],
      ["sub/.gitignore", "other"],
      ["sub/other.ts", "ts"],
      ["sub/secret.txt", "other"],
    ]);
    expect(index.files.find((f) => f.path === "src/App.tsx")?.text).toBe("export const A = 1;\n");
    expect(await scan(root)).toEqual(index);
  });

  it("accepts a relative root", async () => {
    const root = await tree({ "a.ts": "x" });
    const relative = path.relative(process.cwd(), root);
    expect((await scan(relative)).root).toBe(path.resolve(relative));
    expect(await paths(relative)).toEqual(["a.ts"]);
  });

  it("strips the BOM and keeps CRLF", async () => {
    const root = await tree({
      "a.ts": Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("a\r\nb\r\n")]),
    });
    expect((await scan(root)).files[0]?.text).toBe("a\r\nb\r\n");
  });

  it("does not list or follow symbolic links", async () => {
    const outside = await tree({ "o.ts": "x", "d/p.ts": "x" });
    const root = await tree({ "real.ts": "x", "dir/in.ts": "x" });
    await fs.symlink(path.join(root, "real.ts"), path.join(root, "link-file.ts"));
    await fs.symlink(path.join(root, "dir"), path.join(root, "link-dir"));
    await fs.symlink(path.join(outside, "o.ts"), path.join(root, "out-file.ts"));
    await fs.symlink(path.join(outside, "d"), path.join(root, "out-dir"));
    expect(await paths(root)).toEqual(["dir/in.ts", "real.ts"]);
  });

  it("rejects a root that is missing or a file", async () => {
    const root = await tree({ "f.txt": "x" });
    const missing = path.join(root, "nope");
    await expect(scan(missing)).rejects.toThrow(new Error(`scan: not a directory: ${missing}`));
    const file = path.join(root, "f.txt");
    await expect(scan(file)).rejects.toThrow(new Error(`scan: not a directory: ${file}`));
  });

  it("skips files over 1 MiB and keeps empty files", async () => {
    const root = await tree({
      "big.ts": Buffer.alloc(1_048_577, "a"),
      "limit.ts": Buffer.alloc(1_048_576, "a"),
      "empty.ts": "",
    });
    const files = (await scan(root)).files;
    expect(files.map((f) => f.path)).toEqual(["empty.ts", "limit.ts"]);
    expect(files[0]?.text).toBe("");
  });

  it("does not let ! bring back default ignored directories", async () => {
    const root = await tree({ ".gitignore": "!dist/\n!node_modules/\n", "dist/a.js": "x", "node_modules/p.js": "x" });
    expect(await paths(root)).toEqual([".gitignore"]);
  });

  it("does not let ! bring back files inside an ignored directory", async () => {
    const root = await tree({ ".gitignore": "gen/\n!gen/a.ts\n", "gen/a.ts": "x", "ok.ts": "x" });
    expect(await paths(root)).toEqual([".gitignore", "ok.ts"]);
  });

  it("lets a nested .gitignore re-include with !", async () => {
    const root = await tree({ ".gitignore": "*.log\n", "sub/.gitignore": "!a.log\n", "sub/a.log": "x", "sub/b.log": "x" });
    expect(await paths(root)).toEqual([".gitignore", "sub/.gitignore", "sub/a.log"]);
  });
});
