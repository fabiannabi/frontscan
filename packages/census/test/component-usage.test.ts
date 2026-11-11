import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scan, type FileKind, type Finding, type RepoIndex } from "@frontscan/core";
import { census } from "../src/index.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});

const finding = (message: string) => ({
  lens: "census",
  rule: "component-usage",
  area: "design-system",
  severity: "info",
  message,
});

const withoutScore = (findings: readonly Finding[]) => findings.filter((f) => f.rule !== "adoption-score");
const run = async (...files: [string, FileKind, string][]) => withoutScore(await census.run(repo(...files)));
const tsx = (text: string) => run(["a.tsx", "tsx", text]);

describe("census component-usage", () => {
  it("reports the fixture exactly", async () => {
    const index = await scan(
      fileURLToPath(new URL("./fixtures/component-usage", import.meta.url)),
    );
    expect(withoutScore(await census.run(index))).toEqual([
      finding("`Button` is used 3 times in 2 files: src/App.tsx (2), src/Page.jsx (1)."),
      finding("`Card` is used 1 time in 1 file: src/App.tsx (1)."),
      finding("`Layout.Header` is used 1 time in 1 file: src/App.tsx (1)."),
    ]);
  });

  it("has the lens metadata", () => {
    expect({ id: census.id, area: census.area, title: census.title }).toEqual({
      id: "census",
      area: "design-system",
      title: "Design system adoption",
    });
  });

  it("counts dotted names with a capitalised root", async () => {
    expect(await tsx("const x = <Foo.Bar />;")).toEqual([
      finding("`Foo.Bar` is used 1 time in 1 file: a.tsx (1)."),
    ]);
  });

  it.each([
    "<motion.div />",
    "<svg:rect />",
    "<div />",
    "<my-element />",
    "<Ünicode />",
  ])("ignores %s", async (jsx) => {
    expect(await tsx(`const x = ${jsx};`)).toEqual([]);
  });

  it("counts an opening and closing pair once", async () => {
    expect(await tsx("const x = <Card>hi</Card>;")).toEqual([
      finding("`Card` is used 1 time in 1 file: a.tsx (1)."),
    ]);
  });

  it("counts a generic component by its bare name", async () => {
    expect(await tsx("const x = <List<Item> items={x} />;")).toEqual([
      finding("`List` is used 1 time in 1 file: a.tsx (1)."),
      {
        ...finding("`List` receives `items` in 1 of 1 use: dynamic (1)."),
        rule: "prop-usage",
      },
    ]);
  });

  it("orders findings by message", async () => {
    expect(await tsx("const x = <><Card /><Button /></>;")).toEqual([
      finding("`Button` is used 1 time in 1 file: a.tsx (1)."),
      finding("`Card` is used 1 time in 1 file: a.tsx (1)."),
    ]);
    expect(await tsx("const x = <><Button /><ButtonGroup /><Button.Icon /></>;")).toEqual([
      finding("`Button.Icon` is used 1 time in 1 file: a.tsx (1)."),
      finding("`ButtonGroup` is used 1 time in 1 file: a.tsx (1)."),
      finding("`Button` is used 1 time in 1 file: a.tsx (1)."),
    ]);
  });

  it("lists files in code-unit order", async () => {
    expect(
      await run(
        ["src/b.tsx", "tsx", "const x = <Button />;"],
        ["src/B.tsx", "tsx", "const x = <Button />;"],
      ),
    ).toEqual([
      finding("`Button` is used 2 times in 2 files: src/B.tsx (1), src/b.tsx (1)."),
    ]);
  });

  it("returns [] for repos without components", async () => {
    expect(await run()).toEqual([]);
    expect(
      await run(["a.ts", "ts", "export const a = 1;"], ["a.css", "css", "a { color: red }"]),
    ).toEqual([]);
    expect(await tsx("const x = <div><span /></div>;")).toEqual([]);
  });

  it("is deterministic and does not mutate the index", async () => {
    const index = repo(["a.tsx", "tsx", "const x = <Card><Button /></Card>;"]);
    const copy = structuredClone(index);
    const first = await census.run(index);
    expect(await census.run(index)).toEqual(first);
    expect(index).toEqual(copy);
  });
});
