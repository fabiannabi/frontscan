import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cssIndex, scan, sortFindings, type FileKind, type RepoIndex } from "@frontscan/core";
import { census, rawColour } from "../src/index.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});

const found = (
  file: string,
  line: number,
  column: number,
  literal: string,
  property: string,
  suggestion: string,
) => ({
  lens: "census",
  rule: "raw-colour",
  area: "design-system",
  severity: "warning",
  message: `Raw colour \`${literal}\` in \`${property}\` bypasses the design tokens.`,
  file,
  line,
  column,
  suggestion,
});

const NO_TOKEN = "Define a colour token (a `--*` custom property in a token file) and use it here.";

const NO_CLOSE =
  "No colour token is close to this colour at this opacity; define one (a `--*` custom property in a token file) and use it here.";

const run = (...files: [string, FileKind, string][]) =>
  sortFindings(rawColour(cssIndex(repo(...files))));
const css = (text: string) => run(["src/a.css", "css", `.a {\n  ${text}\n}\n`]);
const at = (literal: string, property: string, suggestion = NO_TOKEN) =>
  found("src/a.css", 2, 3, literal, property, suggestion);

describe("census raw-colour", () => {
  it("reports the fixture exactly", async () => {
    const index = await scan(fileURLToPath(new URL("./fixtures/raw-colour", import.meta.url)));
    expect(await census.run(index)).toEqual([
      found("src/App.tsx", 2, 17, "#fff", "color", "Use `var(--color-surface)` (same colour)."),
      found("src/Button.css", 2, 3, "#3B82F6", "color", "Use `var(--color-primary)` (same colour)."),
      found(
        "src/Button.css",
        3,
        3,
        "rgba(59, 130, 246, 0.5)",
        "background",
        NO_CLOSE,
      ),
      found(
        "src/Button.css",
        4,
        3,
        "#1f2937",
        "border",
        "Use the nearest token `var(--color-text)` (#111827, ΔE 8.3).",
      ),
    ]);
  });

  it("flags hex in 3, 4, 6 and 8 digits, any case", () => {
    expect(
      run([
        "src/a.css",
        "css",
        ".a {\n  color: #abc;\n  fill: #ABCD;\n  stroke: #aabbcc;\n  background: #AABBCCDD;\n}\n",
      ]),
    ).toEqual([
      found("src/a.css", 2, 3, "#abc", "color", NO_TOKEN),
      found("src/a.css", 3, 3, "#ABCD", "fill", NO_TOKEN),
      found("src/a.css", 4, 3, "#aabbcc", "stroke", NO_TOKEN),
      found("src/a.css", 5, 3, "#AABBCCDD", "background", NO_TOKEN),
    ]);
  });

  it("does not flag malformed hex or fragment ids", () => {
    expect(
      run([
        "src/a.css",
        "css",
        ".a {\n  color: #abcde;\n  fill: #ggg;\n  stroke: url(#abc);\n  outline: #abcdefg;\n}\n",
      ]),
    ).toEqual([]);
  });

  it("flags rgb, rgba, hsl and hsla in comma and space syntax", () => {
    expect(
      run([
        "src/a.css",
        "css",
        ".a {\n  color: rgb(1, 2, 3);\n  fill: rgb(1 2 3 / 50%);\n  stroke: RGBA(1, 2, 3, 0.5);\n" +
          "  background: hsl(210, 50%, 40%);\n  outline: hsla(210, 50%, 40%, 0.3);\n}\n",
      ]),
    ).toEqual([
      found("src/a.css", 2, 3, "rgb(1, 2, 3)", "color", NO_TOKEN),
      found("src/a.css", 3, 3, "rgb(1 2 3 / 50%)", "fill", NO_TOKEN),
      found("src/a.css", 4, 3, "RGBA(1, 2, 3, 0.5)", "stroke", NO_TOKEN),
      found("src/a.css", 5, 3, "hsl(210, 50%, 40%)", "background", NO_TOKEN),
      found("src/a.css", 6, 3, "hsla(210, 50%, 40%, 0.3)", "outline", NO_TOKEN),
    ]);
  });

  it("does not flag an unparseable function", () => {
    expect(css("color: rgb(var(--x));")).toEqual([]);
  });

  it("does not flag a fallback inside var()", () => {
    expect(css("color: var(--x, #fff);")).toEqual([]);
  });

  it("gives one finding per literal at the same position, ordered by message", () => {
    expect(css("background: linear-gradient(#fff, #000);")).toEqual([
      at("#000", "background"),
      at("#fff", "background"),
    ]);
  });

  it("treats a custom property holding one colour as a token, never flagged", () => {
    expect(
      run(
        ["src/global.css", "css", ":root {\n  --brand: #f00;\n  --brand-hover: var(--brand);\n}\n"],
        ["src/a.css", "css", ".a {\n  color: #f00;\n  background: #fe0000;\n}\n"],
      ),
    ).toEqual([
      found("src/a.css", 2, 3, "#f00", "color", "Use `var(--brand)` (same colour)."),
      found(
        "src/a.css",
        3,
        3,
        "#fe0000",
        "background",
        "Use the nearest token `var(--brand)` (#f00, ΔE 0.4).",
      ),
    ]);
  });

  it("skips token files and scans ThemeProvider.tsx", () => {
    const body = ".a {\n  color: #000;\n}\n";
    expect(
      run(
        ["src/design-tokens.css", "css", body],
        ["src/theme.light.scss", "scss", body],
        ["src/tokens/base.css", "css", body],
        ["src/_colors.scss", "scss", body],
        ["src/ThemeProvider.tsx", "tsx", 'export const T = () => <div style={{ color: "#000" }} />;'],
      ),
    ).toEqual([found("src/ThemeProvider.tsx", 1, 38, "#000", "color", NO_TOKEN)]);
  });

  it("suggests defining a token when the repo has none", () => {
    expect(css("color: #123456;")).toEqual([at("#123456", "color")]);
  });

  it("breaks a tie by token name", () => {
    expect(
      run(
        ["src/global.css", "css", ":root {\n  --b: #111;\n  --a: #111111;\n}\n"],
        ["src/a.css", "css", ".a {\n  color: #111;\n}\n"],
      ),
    ).toEqual([at("#111", "color", "Use `var(--a)` (same colour).")]);
  });

  const withTokens = (tokens: string, body: string) =>
    run(
      ["src/global.css", "css", `:root {\n${tokens}\n}\n`],
      ["src/a.css", "css", `.a {\n${body}\n}\n`],
    );
  const line = (n: number, literal: string, property: string, suggestion: string) =>
    found("src/a.css", n, 3, literal, property, suggestion);

  it("does not match a translucent literal to a solid token", () => {
    expect(
      withTokens("  --popup-text-color: #000;", "  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);"),
    ).toEqual([line(2, "rgba(0, 0, 0, 0.1)", "box-shadow", NO_CLOSE)]);
  });

  it("matches a translucent token at the same alpha", () => {
    expect(
      withTokens("  --shadow: rgba(0, 0, 0, 0.1);", "  color: rgba(0, 0, 0, 0.1);\n  fill: #0000001a;"),
    ).toEqual([
      line(2, "rgba(0, 0, 0, 0.1)", "color", "Use `var(--shadow)` (same colour)."),
      line(3, "#0000001a", "fill", "Use `var(--shadow)` (same colour)."),
    ]);
  });

  it("does not match a solid literal to a translucent token", () => {
    expect(withTokens("  --shadow: rgba(0, 0, 0, 0.1);", "  color: #000;")).toEqual([
      line(2, "#000", "color", NO_CLOSE),
    ]);
  });

  it("treats alpha written as %, number or hex alike", () => {
    const same = "Use `var(--half)` (same colour).";
    expect(
      withTokens(
        "  --half: rgba(0, 0, 0, 0.5);",
        "  color: rgb(0 0 0 / 50%);\n  fill: #00000080;\n  stroke: hsla(0, 0%, 0%, 0.5);",
      ),
    ).toEqual([
      line(2, "rgb(0 0 0 / 50%)", "color", same),
      line(3, "#00000080", "fill", same),
      line(4, "hsla(0, 0%, 0%, 0.5)", "stroke", same),
    ]);
  });

  it("reads alpha from 4-digit hex", () => {
    expect(withTokens("  --x: #abcd;", "  color: #aabbccdd;")).toEqual([
      line(2, "#aabbccdd", "color", "Use `var(--x)` (same colour)."),
    ]);
    expect(withTokens("  --y: #abc;", "  color: #abcd;")).toEqual([
      line(2, "#abcd", "color", NO_CLOSE),
    ]);
  });

  it("says no token is close when the nearest is beyond ΔE 10", () => {
    expect(withTokens("  --brand: #f00;", "  color: #00f;")).toEqual([
      line(2, "#00f", "color", NO_CLOSE),
    ]);
    expect(withTokens("  --grey: #808080;", "  color: #999;\n  fill: #9b9b9b;")).toEqual([
      line(2, "#999", "color", "Use the nearest token `var(--grey)` (#808080, ΔE 9.6)."),
      line(3, "#9b9b9b", "fill", NO_CLOSE),
    ]);
  });

  it("gives no finding for a non-literal style prop", () => {
    expect(run(["src/a.tsx", "tsx", "export const A = () => <div style={{ color: c }} />;"])).toEqual(
      [],
    );
  });

  it("does not flag a style-prop custom property and does not make it a token", () => {
    expect(
      run(
        ["src/a.tsx", "tsx", 'export const A = () => <div style={{ "--accent": "#f00" }} />;'],
        ["src/a.css", "css", ".a {\n  color: #f00;\n}\n"],
      ),
    ).toEqual([at("#f00", "color")]);
  });
});
