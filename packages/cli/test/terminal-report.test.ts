import { describe, expect, it } from "vitest";
import type { Finding } from "@frontscan/core";
import { terminalReport } from "../src/terminal-report.js";

const base = { lens: "census", rule: "raw-colour", area: "design-system", severity: "warning", message: "msg" } as const;

describe("terminalReport", () => {
  it("reports no findings", () => {
    expect(terminalReport([])).toBe("No findings.\n");
  });

  it("reports one finding with a singular summary", () => {
    const f: Finding = { ...base, file: "a.css", line: 2, column: 3, suggestion: "fix it" };
    expect(terminalReport([f])).toBe(
      [
        "design-system (1)",
        "  a.css",
        "      2:3  warning  msg  census/raw-colour",
        "                    → fix it",
        "",
        "1 finding (0 errors, 1 warning, 0 info)",
        "",
      ].join("\n"),
    );
  });

  it("orders areas and separates them with a blank line", () => {
    const sec: Finding = { lens: "sec", rule: "r2", area: "security", severity: "error", message: "m2", file: "a.ts", line: 1, column: 1 };
    const ds: Finding = { ...base, file: "z.css", line: 4, column: 1 };
    expect(terminalReport([sec, ds])).toBe(
      [
        "design-system (1)",
        "  z.css",
        "      4:1  warning  msg  census/raw-colour",
        "",
        "security (1)",
        "  a.ts",
        "      1:1  error  m2  sec/r2",
        "",
        "2 findings (1 error, 1 warning, 0 info)",
        "",
      ].join("\n"),
    );
  });

  it("puts findings without a file first under (repo)", () => {
    const repo: Finding = { ...base, rule: "component-usage", severity: "info", message: "repo wide" };
    const f: Finding = { ...base, file: "a.css", line: 1 };
    expect(terminalReport([f, repo])).toBe(
      [
        "design-system (2)",
        "  (repo)",
        "      info  repo wide  census/component-usage",
        "  a.css",
        "      1  warning  msg  census/raw-colour",
        "",
        "2 findings (0 errors, 1 warning, 1 info)",
        "",
      ].join("\n"),
    );
  });

  it("shows only the line when there is no column", () => {
    expect(terminalReport([{ ...base, file: "a.css", line: 7, suggestion: "s" }])).toBe(
      [
        "design-system (1)",
        "  a.css",
        "      7  warning  msg  census/raw-colour",
        "                  → s",
        "",
        "1 finding (0 errors, 1 warning, 0 info)",
        "",
      ].join("\n"),
    );
  });

  it("omits the arrow line without a suggestion", () => {
    expect(terminalReport([{ ...base, severity: "error", file: "a.css", line: 1, column: 1 }])).toBe(
      [
        "design-system (1)",
        "  a.css",
        "      1:1  error  msg  census/raw-colour",
        "",
        "1 finding (1 error, 0 warnings, 0 info)",
        "",
      ].join("\n"),
    );
  });

  it("counts every severity in the summary", () => {
    const fs: Finding[] = [
      { ...base, severity: "error", file: "a.css", line: 1 },
      { ...base, severity: "error", file: "a.css", line: 2 },
      { ...base, severity: "warning", file: "a.css", line: 3 },
      { ...base, severity: "info", file: "a.css", line: 4 },
    ];
    expect(terminalReport(fs)).toBe(
      [
        "design-system (4)",
        "  a.css",
        "      1  error  msg  census/raw-colour",
        "      2  error  msg  census/raw-colour",
        "      3  warning  msg  census/raw-colour",
        "      4  info  msg  census/raw-colour",
        "",
        "4 findings (2 errors, 1 warning, 1 info)",
        "",
      ].join("\n"),
    );
  });
});
