import { describe, expect, it } from "vitest";
import { cssIndex, type FileKind, type RepoIndex } from "../src/index.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});

const css = (text: string) => cssIndex(repo(["a.css", "css", text]));
const scss = (text: string) => cssIndex(repo(["a.scss", "scss", text]));
const tsx = (text: string) => cssIndex(repo(["a.tsx", "tsx", text]));
const styleOf = (src: string) => tsx(`const x = <div style={{ ${src} }} />;`);
const pv = (ds: readonly { property: string; value?: string }[]) =>
  ds.map((d) => ("value" in d ? [d.property, d.value] : [d.property]));

describe("cssIndex", () => {
  it("indexes the stylesheet reference example exactly", () => {
    const text = ["/* c */", ".btn {", "  color: #FF0000;", "  margin-left: 8px !important;", "}"].join("\n");
    expect(cssIndex(repo(["src/a.css", "css", text]))).toEqual([
      { file: "src/a.css", property: "color", value: "#FF0000", important: false, line: 3, column: 3, origin: "stylesheet" },
      { file: "src/a.css", property: "margin-left", value: "8px", important: true, line: 4, column: 3, origin: "stylesheet" },
    ]);
  });

  it("indexes the style object reference example exactly", () => {
    const base = { file: "a.tsx", line: 1, important: false, origin: "style-prop" };
    expect(tsx('const x = <div style={{ marginLeft: 8, color: "red", padding: p }} />;')).toEqual([
      { ...base, property: "margin-left", value: "8", column: 25 },
      { ...base, property: "color", value: "red", column: 40 },
      { ...base, property: "padding", column: 54 },
    ]);
  });

  describe("value normalisation", () => {
    it.each([
      ["a{color:red !important}", true],
      ["a{color:red!important}", true],
      ["a{color:red !IMPORTANT;}", true],
      ["a{color:red}", false],
    ])("%s", (text, important) => {
      expect(css(text)).toEqual([
        { file: "a.css", property: "color", value: "red", important, line: 1, column: 3, origin: "stylesheet" },
      ]);
    });

    it("collapses whitespace in multi-line values", () => {
      const text = 'a {\n  box-shadow: 0 0 1px red,\n\t\t0 0 2px   blue;\n  grid-template-areas:\n    "a b"\n    "c   d";\n}';
      expect(pv(css(text))).toEqual([
        ["box-shadow", "0 0 1px red, 0 0 2px blue"],
        ["grid-template-areas", '"a b" "c   d"'],
      ]);
    });

    it("lowercases properties except custom properties", () => {
      expect(pv(css("a { COLOR: Red; --Brand: #FFF; --brand: x }"))).toEqual([
        ["color", "Red"],
        ["--Brand", "#FFF"],
        ["--brand", "x"],
      ]);
    });
  });

  describe("comments and strings", () => {
    it.each<[string, FileKind, string, string[][]]>([
      ["block comment", "css", "a { /* x: y; */ color: red; }", [["color", "red"]]],
      ["block comment with braces", "css", "a { /* } */ color: red; }", [["color", "red"]]],
      ["scss line comment", "scss", "a {\n // x: y;\n color: red;\n}", [["color", "red"]]],
      ["// in css url", "css", "a { background: url(http://x.com/a.png); }", [["background", "url(http://x.com/a.png)"]]],
      ["string with ;}", "css", 'a { content: ";}"; color: red; }', [["content", '";}"'], ["color", "red"]]],
      ["string with {", "css", "a { content: '{'; color: red; }", [["content", "'{'"], ["color", "red"]]],
      ["data url", "css", "a { background: url(data:image/png;base64,AAA); color: red; }", [["background", "url(data:image/png;base64,AAA)"], ["color", "red"]]],
      ["interpolation", "scss", "a { width: #{$x}px; color: red; }", [["width", "#{$x}px"], ["color", "red"]]],
      ["interpolation selector", "scss", "#{$s} { color: red; }", [["color", "red"]]],
    ])("%s", (_name, kind, text, expected) => {
      expect(pv(cssIndex(repo([`a.${kind}`, kind, text])))).toEqual(expected);
    });

    it("keeps positions after comments and strings", () => {
      const ds = css('/* x */ a { content: "{"; color: red; }');
      expect(ds.map((d) => [d.property, d.line, d.column])).toEqual([
        ["content", 1, 13],
        ["color", 1, 27],
      ]);
    });
  });

  describe("nesting and statements", () => {
    it("indexes nested declarations, not selectors", () => {
      expect(pv(scss(".btn { &:hover { color: red; } &.x { top: 0 } }"))).toEqual([
        ["color", "red"],
        ["top", "0"],
      ]);
    });

    it("indexes @media and @font-face blocks and a last declaration without ;", () => {
      expect(
        pv(css("@media (min-width: 1px) { a { top: 0 } }\n@font-face { font-family: X; src: url(a.woff) }")),
      ).toEqual([
        ["top", "0"],
        ["font-family", "X"],
        ["src", "url(a.woff)"],
      ]);
    });

    it("skips $var, @use and @include", () => {
      expect(
        pv(scss('@use "x";\n$x: 1;\na { $y: 2; @include m(1); color: red; }')),
      ).toEqual([["color", "red"]]);
    });

    it("ignores top-level statements and top-level selectors", () => {
      expect(css("a:hover;\nb { color: red }")).toEqual([
        { file: "a.css", property: "color", value: "red", important: false, line: 2, column: 5, origin: "stylesheet" },
      ]);
    });

    it("indexes custom properties", () => {
      expect(pv(css(":root { --brand: #fff; }"))).toEqual([["--brand", "#fff"]]);
    });
  });

  describe("style props", () => {
    it.each([
      ["marginLeft: 1", "margin-left"],
      ["WebkitTransition: 1", "-webkit-transition"],
      ["MozAppearance: 1", "-moz-appearance"],
      ["OTransition: 1", "-o-transition"],
      ["msTransform: 1", "-ms-transform"],
      ["opacity: 1", "opacity"],
      ['"margin-left": 1', "margin-left"],
      ['"--brand": 1', "--brand"],
    ])("%s", (src, property) => {
      expect(styleOf(src).map((d) => d.property)).toEqual([property]);
    });

    it.each<[string, string | undefined]>([
      ['"red"', "red"],
      ["`red`", "red"],
      ["8", "8"],
      ["-4", "-4"],
      ["p", undefined],
      ["`a${b}`", undefined],
      ["cond ? 1 : 2", undefined],
    ])("value %s", (src, value) => {
      const [d] = styleOf(`width: ${src}`);
      expect(d).toBeDefined();
      expect("value" in d!).toBe(value !== undefined);
      expect(d!.value).toBe(value);
    });

    it.each([
      ["spread", "<div style={{ ...s }} />"],
      ["computed key", "<div style={{ [k]: 1 }} />"],
      ["method", "<div style={{ m() { return 1; } }} />"],
      ["variable", "<div style={s} />"],
      ["string", '<div style="x" />'],
      ["other attribute", "<div css={{ color: 'red' }} />"],
    ])("skips %s", (_n, jsx) => {
      expect(tsx(`const x = ${jsx};`)).toEqual([]);
    });

    it("indexes style on components", () => {
      expect(tsx('const x = <C style={{ top: 0 }} />;')).toEqual([
        { file: "a.tsx", property: "top", value: "0", important: false, line: 1, column: 23, origin: "style-prop" },
      ]);
    });

    it("indexes a shorthand property without a value", () => {
      expect(tsx("const x = <div style={{ color }} />;")).toEqual([
        { file: "a.tsx", property: "color", important: false, line: 1, column: 25, origin: "style-prop" },
      ]);
    });
  });

  it.each<[string, FileKind, string[][]]>([
    ["a { color: red; /* oops", "css", [["color", "red"]]],
    ['a { color: red; content: "oops', "css", [["color", "red"]]],
    ["a { color: red; b { top: 0; ", "css", [["color", "red"], ["top", "0"]]],
    ["a { color: red; width: #{oops", "scss", [["color", "red"]]],
    ["} } a { color: red }", "css", [["color", "red"]]],
  ])("does not throw on malformed input %#", (text, kind, expected) => {
    expect(pv(cssIndex(repo([`a.${kind}`, kind, text])))).toEqual(expected);
  });

  it("does not throw on malformed tsx", () => {
    expect(tsx("const x = <div style={{ top: 0, a: ")).toEqual([
      { file: "a.tsx", property: "top", value: "0", important: false, line: 1, column: 25, origin: "style-prop" },
      { file: "a.tsx", property: "a", important: false, line: 1, column: 33, origin: "style-prop" },
    ]);
  });

  it("orders by file then source order, deterministically", () => {
    const r = repo(
      ["b.css", "css", "a { top: 0; left: 0 }"],
      ["a.tsx", "tsx", "const x = <i style={{ top: 1 }} />;"],
      ["c.scss", "scss", "a { right: 0 }"],
    );
    const out = cssIndex(r);
    expect(out.map((d) => `${d.file}:${d.property}`)).toEqual([
      "b.css:top",
      "b.css:left",
      "a.tsx:top",
      "c.scss:right",
    ]);
    expect(cssIndex(r)).toEqual(out);
  });

  it("ignores other kinds", () => {
    const text = "a { color: red } const x = <div style={{ top: 0 }} />;";
    const kinds: FileKind[] = ["ts", "js", "json", "md", "html", "other"];
    expect(cssIndex(repo(...kinds.map((k): [string, FileKind, string] => [`f.${k}`, k, text])))).toEqual([]);
  });
});
