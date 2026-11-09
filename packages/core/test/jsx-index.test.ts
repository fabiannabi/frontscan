import { describe, expect, it } from "vitest";
import { jsxIndex, type FileKind, type RepoIndex } from "../src/index.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});

const tsx = (text: string) => jsxIndex(repo(["a.tsx", "tsx", text]));
const propsOf = (src: string) => tsx(`const x = <C ${src} />;`)[0]!.props;

describe("jsxIndex", () => {
  it("indexes the reference example exactly", () => {
    const text = [
      "export function App(props: Props) {",
      "  return (",
      '    <Card title="Hi" {...props}>',
      '      <Button variant="primary" size={2} disabled onClick={go} />',
      "    </Card>",
      "  );",
      "}",
    ].join("\n");
    expect(jsxIndex(repo(["src/App.tsx", "tsx", text]))).toEqual([
      {
        file: "src/App.tsx", name: "Card", hasSpread: true, line: 3, column: 5,
        props: [{ name: "title", value: "Hi", line: 3, column: 11 }],
      },
      {
        file: "src/App.tsx", name: "Button", hasSpread: false, line: 4, column: 7,
        props: [
          { name: "variant", value: "primary", line: 4, column: 15 },
          { name: "size", value: 2, line: 4, column: 33 },
          { name: "disabled", value: true, line: 4, column: 42 },
          { name: "onClick", line: 4, column: 51 },
        ],
      },
    ]);
  });

  describe("static values", () => {
    const cases: [string, string | number | boolean | null][] = [
      ['v="primary"', "primary"],
      ["v='primary'", "primary"],
      ['v={"primary"}', "primary"],
      ["v={`primary`}", "primary"],
      ["v={4}", 4],
      ["v={-4}", -4],
      ["v={1.5}", 1.5],
      ["v", true],
      ["v={true}", true],
      ["v={false}", false],
      ["v={null}", null],
    ];
    it.each(cases)("%s", (src, value) => {
      expect(propsOf(src)).toEqual([{ name: "v", value, line: 1, column: 14 }]);
    });

    it.each(["v={undefined}", "v={y}", "v={{a:1}}", "v={`a${b}`}", "v={<Icon />}", "v={() => 1}"])(
      "%s is absent",
      (src) => {
        const [p] = propsOf(src);
        expect(p).toEqual({ name: "v", line: 1, column: 14 });
        expect("value" in p!).toBe(false);
      },
    );
  });

  it("keeps names as written", () => {
    const names = tsx(
      "const x = <div><Menu.Item /><svg:rect xlink:href=\"a\" aria-label=\"b\" /><List<Item> items={x} /></div>;",
    );
    expect(names.map((e) => e.name)).toEqual(["div", "Menu.Item", "svg:rect", "List"]);
    expect(names[2]!.props.map((p) => p.name)).toEqual(["xlink:href", "aria-label"]);
  });

  it("skips fragments but indexes their children and React.Fragment", () => {
    expect(tsx("const x = <><A /></>;").map((e) => e.name)).toEqual(["A"]);
    expect(tsx("const x = <React.Fragment><A /></React.Fragment>;").map((e) => e.name)).toEqual([
      "React.Fragment",
      "A",
    ]);
  });

  it("orders parents before children and files in index order", () => {
    const out = jsxIndex(
      repo(
        ["b.tsx", "tsx", "const x = <A><B /></A>;"],
        ["a.tsx", "tsx", "const x = <C />;"],
      ),
    );
    expect(out.map((e) => [e.file, e.name])).toEqual([
      ["b.tsx", "A"],
      ["b.tsx", "B"],
      ["a.tsx", "C"],
    ]);
  });

  it("parses jsx files", () => {
    expect(jsxIndex(repo(["a.jsx", "jsx", "const x = <div id=\"a\" />;"]))).toEqual([
      {
        file: "a.jsx", name: "div", hasSpread: false, line: 1, column: 11,
        props: [{ name: "id", value: "a", line: 1, column: 16 }],
      },
    ]);
  });

  it("ignores other kinds", () => {
    expect(jsxIndex(repo(["a.ts", "ts", "const x = <div>;"], ["a.css", "css", "<div>"]))).toEqual([]);
    expect(jsxIndex(repo())).toEqual([]);
  });

  it("does not throw on broken files and is deterministic", () => {
    const index = repo(["a.tsx", "tsx", "const x = <div><span></div>;"]);
    expect(() => jsxIndex(index)).not.toThrow();
    expect(jsxIndex(index)).toEqual(jsxIndex(index));
  });
});
