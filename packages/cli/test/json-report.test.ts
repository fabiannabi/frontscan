import { describe, expect, it } from "vitest";
import type { Finding } from "@frontscan/core";
import { jsonReport } from "../src/json-report.js";

const repo: Finding = { lens: "census", rule: "component-usage", area: "design-system", severity: "info", message: "m0" };
const b: Finding = { lens: "census", rule: "raw-colour", area: "design-system", severity: "warning", message: "m1", file: "b.css", line: 1, column: 2, suggestion: "s1" };
const a: Finding = { lens: "census", rule: "raw-colour", area: "design-system", severity: "warning", message: "m2", file: "a.css", line: 3 };

describe("jsonReport", () => {
  it("prints an empty list", () => {
    expect(jsonReport([])).toBe("[]\n");
  });

  it("sorts the findings", () => {
    expect(jsonReport([b, a, repo])).toBe(
      [
        "[",
        "  {",
        '    "lens": "census",',
        '    "rule": "component-usage",',
        '    "area": "design-system",',
        '    "severity": "info",',
        '    "message": "m0"',
        "  },",
        "  {",
        '    "lens": "census",',
        '    "rule": "raw-colour",',
        '    "area": "design-system",',
        '    "severity": "warning",',
        '    "message": "m2",',
        '    "file": "a.css",',
        '    "line": 3',
        "  },",
        "  {",
        '    "lens": "census",',
        '    "rule": "raw-colour",',
        '    "area": "design-system",',
        '    "severity": "warning",',
        '    "message": "m1",',
        '    "file": "b.css",',
        '    "line": 1,',
        '    "column": 2,',
        '    "suggestion": "s1"',
        "  }",
        "]",
        "",
      ].join("\n"),
    );
  });

  it("does not mutate the input", () => {
    const input = [b, a, repo];
    jsonReport(input);
    expect(input).toEqual([b, a, repo]);
  });
});
