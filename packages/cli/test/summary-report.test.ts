import type { Finding, JsxElement, JsxProp } from "@frontscan/core";
import { describe, expect, it } from "vitest";
import { shouldColour, summaryReport } from "../src/summary-report.js";
import type { SummaryInput } from "../src/summary-report.js";

const finding = (rule: string, severity: Finding["severity"], extra: Partial<Finding> = {}): Finding => ({
  lens: "census",
  rule,
  area: "design-system",
  severity,
  message: `${rule} problem`,
  ...extra,
});
const prop = (name: string, value?: JsxProp["value"]): JsxProp =>
  value === undefined ? { name, line: 1, column: 1 } : { name, value, line: 1, column: 1 };
const el = (file: string, name: string, props: JsxProp[] = []): JsxElement => ({
  file,
  name,
  props,
  hasSpread: false,
  line: 1,
  column: 1,
});
const input = (extra: Partial<SummaryInput> = {}): SummaryInput => ({
  repo: "demo",
  files: 4,
  durationMs: 12,
  areas: ["design-system", "a11y"],
  findings: [],
  elements: [],
  ...extra,
});

const warnings = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    finding("raw-colour", "warning", { file: "a.css", line: i + 1, suggestion: "Use a token." }),
  );

describe("summaryReport", () => {
  it("reports no findings at all", () => {
    expect(summaryReport(input())).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       0         0     0",
        "a11y                0         0     0",
        "",
        "To fix",
        "",
        "Nothing to fix.",
        "",
      ].join("\n"),
    );
  });

  it("uses singular and formats durations", () => {
    const head = (ms: number) => summaryReport(input({ files: 1, durationMs: ms })).split("\n")[0];
    expect(head(0)).toBe("demo  ·  1 file  ·  0ms");
    expect(head(999)).toBe("demo  ·  1 file  ·  999ms");
    expect(head(1500)).toBe("demo  ·  1 file  ·  1.5s");
  });

  it("lists errors only", () => {
    const findings = [
      finding("b-rule", "error", { file: "x.css", line: 3, message: "bad b" }),
      finding("a-rule", "error", { file: "x.css", line: 1, message: "bad a", suggestion: "Fix a." }),
    ];
    expect(summaryReport(input({ areas: ["design-system"], findings }))).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       2         0     0",
        "",
        "To fix",
        "",
        "census/a-rule · error · 1",
        "  x.css:1  bad a",
        "      → Fix a.",
        "",
        "census/b-rule · error · 1",
        "  x.css:3  bad b",
        "",
      ].join("\n"),
    );
  });

  it("lists warnings only, widest group first", () => {
    const findings = [
      finding("a-rule", "warning", { file: "x.css", line: 9, message: "w a" }),
      finding("b-rule", "warning", { file: "x.css", line: 1, message: "w b1" }),
      finding("b-rule", "warning", { file: "x.css", line: 2, message: "w b2" }),
    ];
    expect(summaryReport(input({ areas: ["design-system"], findings }))).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       0         3     0",
        "",
        "To fix",
        "",
        "census/b-rule · warning · 2",
        "  x.css:1  w b1",
        "  x.css:2  w b2",
        "",
        "census/a-rule · warning · 1",
        "  x.css:9  w a",
        "",
      ].join("\n"),
    );
  });

  it("puts error groups before warning groups and counts info as not listed", () => {
    const findings = [
      finding("w-rule", "warning", { file: "x.css", line: 1, message: "w" }),
      finding("w-rule", "warning", { file: "y.css", line: 1, message: "w2" }),
      finding("e-rule", "error", { file: "x.css", line: 2, message: "e" }),
      finding("i-rule", "info", { message: "i" }),
      finding("i-rule", "info", { message: "i2", area: "a11y" }),
    ];
    expect(summaryReport(input({ findings }))).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       1         2     1",
        "a11y                0         0     1",
        "",
        "To fix",
        "",
        "census/e-rule · error · 1",
        "  x.css:2  e",
        "",
        "census/w-rule · warning · 2",
        "  x.css:1  w",
        "  y.css:1  w2",
        "",
        "2 info findings not listed; run with --details to see every finding.",
        "",
      ].join("\n"),
    );
  });

  it("cuts a rule off after 5 findings and counts the hidden ones in the footer", () => {
    expect(summaryReport(input({ areas: ["design-system"], findings: warnings(7) }))).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       0         7     0",
        "",
        "To fix",
        "",
        "census/raw-colour · warning · 7",
        "  a.css:1  raw-colour problem",
        "      → Use a token.",
        "  a.css:2  raw-colour problem",
        "      → Use a token.",
        "  a.css:3  raw-colour problem",
        "      → Use a token.",
        "  a.css:4  raw-colour problem",
        "      → Use a token.",
        "  a.css:5  raw-colour problem",
        "      → Use a token.",
        "  … and 2 more",
        "",
        "2 warnings not listed; run with --details to see every finding.",
        "",
      ].join("\n"),
    );
  });

  it("joins hidden counts by severity", () => {
    const findings = [...warnings(6), finding("i", "info"), finding("i", "info")];
    expect(summaryReport(input({ areas: ["design-system"], findings })).trimEnd().split("\n").at(-1)).toBe(
      "1 warning, 2 info findings not listed; run with --details to see every finding.",
    );
  });

  it("shows (repo) for a finding without a file and only the file without a line", () => {
    const findings = [
      finding("a-rule", "error", { message: "whole repo" }),
      finding("b-rule", "error", { file: "x.json", message: "whole file" }),
    ];
    expect(summaryReport(input({ areas: ["design-system"], findings }))).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       2         0     0",
        "",
        "To fix",
        "",
        "census/a-rule · error · 1",
        "  (repo)  whole repo",
        "",
        "census/b-rule · error · 1",
        "  x.json  whole file",
        "",
      ].join("\n"),
    );
  });

  it("cuts the tables off at 10 components and 5 props", () => {
    const names = "ABCDEFGHIJKL".split("");
    const elements = [
      ...names.map((n) => el("a.tsx", n)),
      el("a.tsx", "A", ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].map((p) => prop(p, 1))),
    ];
    expect(summaryReport(input({ areas: ["design-system"], elements }))).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       0         0     0",
        "",
        "To fix",
        "",
        "Nothing to fix.",
        "",
        "Components",
        "",
        "component  uses  files",
        "A             2      1",
        "B             1      1",
        "C             1      1",
        "D             1      1",
        "E             1      1",
        "F             1      1",
        "G             1      1",
        "H             1      1",
        "I             1      1",
        "J             1      1",
        "… and 2 more components",
        "",
        "Props",
        "",
        "A (2 uses)",
        "  prop  uses  top values",
        "  p1       1  1 (1)",
        "  p2       1  1 (1)",
        "  p3       1  1 (1)",
        "  p4       1  1 (1)",
        "  p5       1  1 (1)",
        "  … and 2 more props",
        "",
      ].join("\n"),
    );
  });

  it("shows the top 3 values and dynamic values after them", () => {
    const elements = [
      el("a.tsx", "Button", [prop("variant", "primary"), prop("onClick")]),
      el("a.tsx", "Button", [prop("variant", "primary"), prop("onClick")]),
      el("b.tsx", "Button", [prop("variant", "ghost"), prop("variant")]),
      el("b.tsx", "Button", [prop("variant", "alt")]),
      el("b.tsx", "Button", [prop("variant", "zzz")]),
    ];
    expect(summaryReport(input({ areas: ["design-system"], elements }))).toBe(
      [
        "demo  ·  4 files  ·  12ms",
        "",
        "area           errors  warnings  info",
        "design-system       0         0     0",
        "",
        "To fix",
        "",
        "Nothing to fix.",
        "",
        "Components",
        "",
        "component  uses  files",
        "Button        5      2",
        "",
        "Props",
        "",
        "Button (5 uses)",
        '  prop     uses  top values',
        '  variant     5  "primary" (2), "alt" (1), "ghost" (1), dynamic (1)',
        "  onClick     2  dynamic (2)",
        "",
      ].join("\n"),
    );
  });

  it("omits Props when no listed component received props", () => {
    const out = summaryReport(input({ elements: [el("a.tsx", "Card")] }));
    expect(out).not.toContain("Props");
    expect(out).toContain("Card");
  });

  it("colours headings, severities and suggestions with fixed ANSI codes", () => {
    const findings = [
      finding("e-rule", "error", { file: "x.css", line: 1, message: "e", suggestion: "Fix e." }),
      finding("w-rule", "warning", { file: "x.css", line: 2, message: "w" }),
    ];
    const out = summaryReport(
      input({ areas: ["design-system"], findings, elements: [el("a.tsx", "Button", [prop("a", 1)])], colour: true }),
    );
    expect(out).toBe(
      [
        "\x1b[1mdemo  ·  4 files  ·  12ms\x1b[0m",
        "",
        "area           errors  warnings  info",
        "design-system       1         1     0",
        "",
        "\x1b[1mTo fix\x1b[0m",
        "",
        "census/e-rule · \x1b[31merror\x1b[0m · 1",
        "  x.css:1  e",
        "      \x1b[2m→ Fix e.\x1b[0m",
        "",
        "census/w-rule · \x1b[33mwarning\x1b[0m · 1",
        "  x.css:2  w",
        "",
        "\x1b[1mComponents\x1b[0m",
        "",
        "component  uses  files",
        "Button        1      1",
        "",
        "\x1b[1mProps\x1b[0m",
        "",
        "Button (1 use)",
        "  prop  uses  top values",
        "  a        1  1 (1)",
        "",
      ].join("\n"),
    );
    expect(summaryReport(input({ findings, colour: false }))).not.toContain("\x1b");
    expect(summaryReport(input({ findings }))).not.toContain("\x1b");
  });
});

describe("shouldColour", () => {
  it("follows the TTY and NO_COLOR", () => {
    expect(shouldColour(true, undefined)).toBe(true);
    expect(shouldColour(true, "")).toBe(true);
    expect(shouldColour(true, "1")).toBe(false);
    expect(shouldColour(false, undefined)).toBe(false);
    expect(shouldColour(undefined, undefined)).toBe(false);
  });
});
