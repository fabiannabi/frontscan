import { describe, expect, it } from "vitest";
import { DEFAULT_NON_PRODUCT, productIndex } from "../src/product-files.js";
import type { RepoIndex, SourceFile } from "../src/types.js";

const root = "/repo";
const file = (path: string, text = `// ${path}`): SourceFile => ({
  path,
  kind: path.endsWith(".css") ? "css" : path.endsWith(".json") ? "json" : "ts",
  text,
});
const indexOf = (...files: SourceFile[]): RepoIndex => ({ root, files });
const config = (text: string) => file("frontscan.config.json", text);

describe("DEFAULT_NON_PRODUCT", () => {
  it("is the documented list", () => {
    expect(DEFAULT_NON_PRODUCT).toEqual([
      "*.test.*",
      "*.spec.*",
      "*.stories.*",
      "__tests__/",
      "__mocks__/",
      "__fixtures__/",
      "test/",
      "tests/",
      "fixtures/",
      "e2e/",
      ".storybook/",
    ]);
  });
});

describe("productIndex", () => {
  const keep = file("src/App.tsx");

  it.each([
    "src/a.test.tsx",
    "src/a.spec.ts",
    "src/Button.stories.tsx",
    "src/__tests__/a.ts",
    "src/__mocks__/a.ts",
    "__fixtures__/a.json",
    "test/a.css",
    "packages/x/tests/a.css",
    "fixtures/a.css",
    "e2e/a.ts",
    ".storybook/main.ts",
  ])("leaves out %s", (path) => {
    expect(productIndex(indexOf(file(path), keep), { allFiles: false })).toEqual({
      index: { root, files: [keep] },
      excluded: 1,
    });
  });

  it("keeps look-alikes", () => {
    const files = ["src/testing.ts", "src/contest/a.css", "src/latest.css", "src/test.css"].map((p) => file(p));
    expect(productIndex(indexOf(...files), { allFiles: false })).toEqual({ index: { root, files }, excluded: 0 });
  });

  it("keeps every file with allFiles", () => {
    const files = [file("test/a.css"), keep];
    expect(productIndex(indexOf(...files), { allFiles: true })).toEqual({ index: { root, files }, excluded: 0 });
  });

  it("adds config ignore to the defaults", () => {
    const cfg = config('{"ignore": ["src/legacy/"]}');
    expect(
      productIndex(indexOf(cfg, file("src/legacy/a.css"), file("test/a.css"), keep), { allFiles: false }),
    ).toEqual({ index: { root, files: [cfg, keep] }, excluded: 2 });
  });

  it("lets config include beat a default", () => {
    const cfg = config('{"include": ["fixtures/"]}');
    const x = file("test/fixtures/x.css");
    expect(productIndex(indexOf(cfg, x, file("test/a.css")), { allFiles: false })).toEqual({
      index: { root, files: [cfg, x] },
      excluded: 1,
    });
  });

  it("lets config include beat config ignore", () => {
    const cfg = config('{"ignore": ["src/legacy/"], "include": ["src/legacy/keep.css"]}');
    const kept = file("src/legacy/keep.css");
    expect(productIndex(indexOf(cfg, kept, file("src/legacy/a.css")), { allFiles: false })).toEqual({
      index: { root, files: [cfg, kept] },
      excluded: 1,
    });
  });

  it.each(["{not json", '{"ignore": "test/"}', '{"include": [1]}', '{"ignore": [1], "include": "x"}', "[]"])(
    "ignores the invalid config %s and keeps the defaults",
    (text) => {
      const cfg = config(text);
      expect(productIndex(indexOf(cfg, file("test/a.css"), keep), { allFiles: false })).toEqual({
        index: { root, files: [cfg, keep] },
        excluded: 1,
      });
    },
  );

  it("ignores a nested frontscan.config.json", () => {
    const nested = file("packages/x/frontscan.config.json", '{"include": ["test/"], "ignore": ["src/"]}');
    const t = file("test/a.css");
    expect(productIndex(indexOf(nested, t, keep), { allFiles: false })).toEqual({
      index: { root, files: [nested, keep] },
      excluded: 1,
    });
  });

  it("handles an empty index", () => {
    expect(productIndex(indexOf(), { allFiles: false })).toEqual({ index: { root, files: [] }, excluded: 0 });
  });
});
