import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { jsxIndex, scan, sortFindings, type FileKind, type RepoIndex } from "@frontscan/core";
import { census, propUsage } from "../src/index.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});

const finding = (message: string) => ({
  lens: "census",
  rule: "prop-usage",
  area: "design-system",
  severity: "info",
  message,
});

const usage = (...files: [string, FileKind, string][]) =>
  sortFindings(propUsage(jsxIndex(repo(...files))));
const tsx = (text: string) => usage(["a.tsx", "tsx", text]);

describe("census prop-usage", () => {
  it("reports the fixture exactly", async () => {
    const index = await scan(fileURLToPath(new URL("./fixtures/prop-usage", import.meta.url)));
    expect(await census.run(index)).toEqual([
      {
        lens: "census",
        rule: "component-usage",
        area: "design-system",
        severity: "info",
        message: "`Button` is used 5 times in 2 files: src/App.tsx (4), src/Page.jsx (1).",
      },
      {
        lens: "census",
        rule: "component-usage",
        area: "design-system",
        severity: "info",
        message: "`Card` is used 1 time in 1 file: src/Page.jsx (1).",
      },
      {
        lens: "census",
        rule: "component-usage",
        area: "design-system",
        severity: "info",
        message: "`Icon` is used 1 time in 1 file: src/Plain.tsx (1).",
      },
      finding("`Button` receives `disabled` in 1 of 5 uses: true (1)."),
      finding("`Button` receives `onClick` in 1 of 5 uses: dynamic (1)."),
      finding("`Button` receives `size` in 1 of 5 uses: 2 (1)."),
      finding('`Button` receives `variant` in 5 of 5 uses: "primary" (3), "ghost" (1), dynamic (1).'),
      finding('`Card` receives `title` in 1 of 1 use: "Hi" (1).'),
    ]);
  });

  it("renders numbers, booleans and null as is", () => {
    expect(tsx("const x = <Box gap={-1} on={false} x={null} />;")).toEqual([
      finding("`Box` receives `gap` in 1 of 1 use: -1 (1)."),
      finding("`Box` receives `on` in 1 of 1 use: false (1)."),
      finding("`Box` receives `x` in 1 of 1 use: null (1)."),
    ]);
  });

  it("escapes strings with JSON.stringify", () => {
    expect(tsx("const x = <T label='say \"hi\"' />;")).toEqual([
      finding('`T` receives `label` in 1 of 1 use: "say \\"hi\\"" (1).'),
    ]);
  });

  it("keeps a number and a string apart", () => {
    expect(tsx('const x = <><A n={1} /><A n="1" /></>;')).toEqual([
      finding('`A` receives `n` in 2 of 2 uses: "1" (1), 1 (1).'),
    ]);
  });

  it("counts a spread toward n only", () => {
    expect(tsx('const x = <><A {...p} /><A x="1" /></>;')).toEqual([
      finding('`A` receives `x` in 1 of 2 uses: "1" (1).'),
    ]);
  });

  it("ignores key and does not treat children as props", () => {
    expect(tsx('const x = <A key="k">hi</A>;')).toEqual([]);
  });

  it("keeps ref", () => {
    expect(tsx("const x = <A ref={r} />;")).toEqual([
      finding("`A` receives `ref` in 1 of 1 use: dynamic (1)."),
    ]);
  });

  it("ignores HTML, namespaced and lowercase dotted tags", () => {
    expect(
      tsx('const x = <><div className="a" /><svg:rect x={1} /><motion.div x={1} /></>;'),
    ).toEqual([]);
  });

  it("names dotted and generic components as jsxIndex does", () => {
    expect(tsx('const x = <><Foo.Bar a="1" /><List<Item> items={x} /></>;')).toEqual([
      finding('`Foo.Bar` receives `a` in 1 of 1 use: "1" (1).'),
      finding("`List` receives `items` in 1 of 1 use: dynamic (1)."),
    ]);
  });

  it("counts each occurrence of a duplicate attribute but k once", () => {
    expect(tsx('const x = <A x="1" x="2" />;')).toEqual([
      finding('`A` receives `x` in 1 of 1 use: "1" (1), "2" (1).'),
    ]);
  });

  it("caps the listed values at 10", () => {
    const values = Array.from({ length: 12 }, (_, i) => `<A x="v${String(i + 1).padStart(2, "0")}" />`);
    expect(tsx(`const x = <>${values.join("")}<A x={y} /></>;`)).toEqual([
      finding(
        "`A` receives `x` in 13 of 13 uses: " +
          Array.from({ length: 10 }, (_, i) => `"v${String(i + 1).padStart(2, "0")}" (1)`).join(", ") +
          ", 2 more values (2), dynamic (1).",
      ),
    ]);
  });

  it("orders by count, then by rendered text", () => {
    expect(tsx('const x = <><A x="b" /><A x="a" /><A x="c" /><A x="c" /></>;')).toEqual([
      finding('`A` receives `x` in 4 of 4 uses: "c" (2), "a" (1), "b" (1).'),
    ]);
    expect(tsx('const x = <><A x="B" /><A x="a" /></>;')).toEqual([
      finding('`A` receives `x` in 2 of 2 uses: "B" (1), "a" (1).'),
    ]);
  });

  it("returns [] for an empty repo and repos without components", () => {
    expect(usage()).toEqual([]);
    expect(
      usage(["a.ts", "ts", "export const a = 1;"], ["a.css", "css", "a { color: red }"]),
    ).toEqual([]);
    expect(tsx("const x = <div><span /></div>;")).toEqual([]);
  });

  it("is deterministic and does not mutate the index", () => {
    const els = jsxIndex(repo(["a.tsx", "tsx", 'const x = <A x="1" y={z} {...p} />;']));
    const copy = structuredClone(els);
    const first = propUsage(els);
    expect(propUsage(els)).toEqual(first);
    expect(els).toEqual(copy);
  });
});
