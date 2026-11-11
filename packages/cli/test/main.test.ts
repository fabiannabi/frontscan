import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Finding, JsxElement } from "@frontscan/core";
import { htmlReport } from "../src/html-report.js";
import { main } from "../src/main.js";
import type { Io } from "../src/main.js";

const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const USAGE = "Usage: frontscan [path] [--json] [--details|--all] [--all-files] [--html <file>]\n";

async function run(argv: string[], dir = cwd) {
  let stdout = "";
  let stderr = "";
  const code = await main(argv, {
    cwd: dir,
    stdout: (s) => (stdout += s),
    stderr: (s) => (stderr += s),
    now: () => 0,
  });
  return { code, stdout, stderr };
}

const FINDINGS = [
  {
    lens: "census",
    rule: "adoption-score",
    area: "design-system",
    severity: "info",
    message: "No design system found; set one in frontscan.config.json.",
    suggestion: 'Add `"designSystem": ["<package>"]` to frontscan.config.json.',
  },
  {
    lens: "census",
    rule: "component-usage",
    area: "design-system",
    severity: "info",
    message: "`Button` is used 1 time in 1 file: src/App.tsx (1).",
  },
  {
    lens: "census",
    rule: "raw-colour",
    area: "design-system",
    severity: "warning",
    message: "Raw colour `#ff0000` in `color` bypasses the design tokens.",
    file: "src/Button.css",
    line: 2,
    column: 3,
    suggestion: "Define a colour token (a `--*` custom property in a token file) and use it here.",
  },
];

const RAW_COLOUR_FIXTURE = {
  lens: "census",
  rule: "raw-colour",
  area: "design-system",
  severity: "warning",
  message: "Raw colour `#ff0000` in `color` bypasses the design tokens.",
  file: "test/fixtures/first-run/src/Button.css",
  line: 2,
  column: 3,
  suggestion: "Define a colour token (a `--*` custom property in a token file) and use it here.",
};

const ADOPTION_SCORE = FINDINGS[0];

const STORY_USAGE = {
  lens: "census",
  rule: "component-usage",
  area: "design-system",
  severity: "info",
  message: "`Button` is used 1 time in 1 file: src/Button.stories.tsx (1).",
};

const NON_PRODUCT_SUMMARY = [
  "non-product  ·  1 file (2 tests and fixtures left out)  ·  0ms",
  "",
  "area           errors  warnings  info",
  "design-system       0         0     1",
  "",
  "No design system found; set one in frontscan.config.json.",
  "",
  "To fix",
  "",
  "Nothing to fix.",
  "",
  "1 info finding not listed; run with --details to see every finding.",
  "",
].join("\n");

const SUMMARY = [
  "first-run  ·  3 files  ·  0ms",
  "",
  "area           errors  warnings  info",
  "design-system       0         1     2",
  "",
  "No design system found; set one in frontscan.config.json.",
  "",
  "To fix",
  "",
  "census/raw-colour · warning · 1",
  "  src/Button.css:2  Raw colour `#ff0000` in `color` bypasses the design tokens.",
  "      → Define a colour token (a `--*` custom property in a token file) and use it here.",
  "",
  "Components",
  "",
  "component  uses  files",
  "Button        1      1",
  "",
  "2 info findings not listed; run with --details to see every finding.",
  "",
].join("\n");

const TERMINAL = [
  "design-system (3)",
  "  (repo)",
  "      info  No design system found; set one in frontscan.config.json.  census/adoption-score",
  "            → Add `\"designSystem\": [\"<package>\"]` to frontscan.config.json.",
  "      info  `Button` is used 1 time in 1 file: src/App.tsx (1).  census/component-usage",
  "  src/Button.css",
  "      2:3  warning  Raw colour `#ff0000` in `color` bypasses the design tokens.  census/raw-colour",
  "                    → Define a colour token (a `--*` custom property in a token file) and use it here.",
  "",
  "3 findings (0 errors, 1 warning, 2 info)",
  "",
].join("\n");

async function runHtml(argv: string[], writeFile?: Io["writeFile"]) {
  let stdout = "";
  let stderr = "";
  const written: [string, string][] = [];
  const code = await main(argv, {
    cwd,
    stdout: (s) => (stdout += s),
    stderr: (s) => (stderr += s),
    now: () => 0,
    writeFile: writeFile ?? ((p, t) => void written.push([p, t])),
  });
  return { code, stdout, stderr, written };
}

const expectedWrite = [
  [
    path.resolve(cwd, "out.html"),
    htmlReport({
      repo: "first-run",
      files: 3,
      areas: ["design-system"],
      findings: FINDINGS as Finding[],
      elements: [{ name: "Button", file: "src/App.tsx", line: 1, column: 1, props: [] } as unknown as JsxElement],
    }),
  ],
];

describe("main --html", () => {
  it("writes the report and prints the summary", async () => {
    const r = await runHtml(["first-run", "--html", "out.html"]);
    expect({ code: r.code, stdout: r.stdout, stderr: r.stderr }).toEqual({ code: 0, stdout: SUMMARY, stderr: "" });
    expect(r.written).toEqual(expectedWrite);
  });

  it("keeps --json and --details output", async () => {
    const json = await runHtml(["first-run", "--json", "--html", "out.html"]);
    expect(json.stdout).toEqual((await run(["first-run", "--json"])).stdout);
    expect(json.written).toEqual(expectedWrite);
    const details = await runHtml(["--details", "first-run", "--html", "out.html"]);
    expect(details.stdout).toEqual(TERMINAL);
    expect(details.written).toEqual(expectedWrite);
  });

  it("needs a file path", async () => {
    const err = `frontscan: --html needs a file path\n${USAGE}`;
    expect(await runHtml(["first-run", "--html"])).toEqual({ code: 2, stdout: "", stderr: err, written: [] });
    expect(await runHtml(["--html", "--json"])).toEqual({ code: 2, stdout: "", stderr: err, written: [] });
    expect(await runHtml(["first-run", "--html="])).toEqual({ code: 2, stdout: "", stderr: err, written: [] });
    expect(await runHtml(["first-run", "--html=-x"])).toEqual({ code: 2, stdout: "", stderr: err, written: [] });
  });

  it("reports a failed write", async () => {
    const r = await runHtml(["first-run", "--html", "out.html"], () => {
      throw new Error("ENOENT");
    });
    expect({ code: r.code, stderr: r.stderr }).toEqual({ code: 2, stderr: "frontscan: cannot write out.html\n" });
  });

  it("accepts --html=<file>", async () => {
    expect(await runHtml(["first-run", "--html=out.html"])).toEqual({
      code: 0,
      stdout: SUMMARY,
      stderr: "",
      written: expectedWrite,
    });
  });

  it("keeps --json and --details output with --html=<file>", async () => {
    const json = await runHtml(["first-run", "--json", "--html=out.html"]);
    expect(json).toEqual({
      code: 0,
      stdout: (await run(["first-run", "--json"])).stdout,
      stderr: "",
      written: expectedWrite,
    });
    expect(await runHtml(["--details", "first-run", "--html=out.html"])).toEqual({
      code: 0,
      stdout: TERMINAL,
      stderr: "",
      written: expectedWrite,
    });
  });

  it("splits --html=<file> at the first = only", async () => {
    const r = await runHtml(["first-run", "--html=a=b.html"]);
    expect(r).toEqual({
      code: 0,
      stdout: SUMMARY,
      stderr: "",
      written: [[path.resolve(cwd, "a=b.html"), expectedWrite[0]![1]]],
    });
  });

  it("reports a failed write with --html=<file>", async () => {
    const r = await runHtml(["first-run", "--html=out.html"], () => {
      throw new Error("ENOENT");
    });
    expect(r).toEqual({ code: 2, stdout: SUMMARY, stderr: "frontscan: cannot write out.html\n", written: [] });
  });
});

describe("main", () => {
  it("prints the findings as JSON", async () => {
    const r = await run(["first-run", "--json"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(JSON.parse(r.stdout)).toEqual(FINDINGS);
    expect((await run(["first-run", "--json"])).stdout).toBe(r.stdout);
  });

  it("scans the working directory without a path", async () => {
    const r = await run(["--json"], path.join(cwd, "first-run"));
    expect(JSON.parse(r.stdout)).toEqual(FINDINGS);
  });

  it("prints the summary report by default", async () => {
    expect(await run(["first-run"])).toEqual({ code: 0, stdout: SUMMARY, stderr: "" });
  });

  it("prints every finding with --details and --all", async () => {
    expect(await run(["first-run", "--details"])).toEqual({ code: 0, stdout: TERMINAL, stderr: "" });
    expect(await run(["--all", "first-run"])).toEqual({ code: 0, stdout: TERMINAL, stderr: "" });
  });

  it("lets --json win over --details", async () => {
    expect(await run(["first-run", "--json", "--details"])).toEqual(await run(["first-run", "--json"]));
  });

  it("colours the summary only when asked", async () => {
    let stdout = "";
    await main(["first-run"], { cwd, stdout: (t) => (stdout += t), stderr: () => {}, now: () => 0, colour: true });
    expect(stdout).toContain("\x1b[1mfirst-run  ·  3 files  ·  0ms\x1b[0m");
    expect((await run(["first-run"])).stdout).not.toContain("\x1b");
  });

  it("accepts --json before the path", async () => {
    expect(await run(["--json", "first-run"])).toEqual(await run(["first-run", "--json"]));
  });

  it("leaves test, fixture and story files out by default", async () => {
    // The only finding left is the repo-level census adoption-score; no raw-colour, no component-usage.
    expect(await run(["non-product", "--json"])).toEqual({
      code: 0,
      stdout: `${JSON.stringify([ADOPTION_SCORE], null, 2)}\n`,
      stderr: "",
    });
  });

  it("brings them back with --all-files, anywhere in argv", async () => {
    const expected = {
      code: 0,
      stdout: `${JSON.stringify([ADOPTION_SCORE, STORY_USAGE, RAW_COLOUR_FIXTURE], null, 2)}\n`,
      stderr: "",
    };
    expect(await run(["non-product", "--all-files", "--json"])).toEqual(expected);
    expect(await run(["--all-files", "--json", "non-product"])).toEqual(expected);
  });

  it("keeps --all as --details", async () => {
    expect((await run(["non-product", "--all"])).stdout).toEqual((await run(["non-product", "--details"])).stdout);
    expect((await run(["non-product", "--all"])).stdout).not.toEqual(
      (await run(["non-product", "--all-files", "--details"])).stdout,
    );
  });

  it("rejects --all-files=x", async () => {
    expect(await run(["--all-files=x"])).toEqual({
      code: 2,
      stdout: "",
      stderr: `frontscan: unknown option --all-files=x\n${USAGE}`,
    });
  });

  it("says how many files the default summary left out", async () => {
    expect(await run(["non-product"])).toEqual({ code: 0, stdout: NON_PRODUCT_SUMMARY, stderr: "" });
  });

  it("reports no product findings when scanning packages/cli itself", async () => {
    const cliDir = path.resolve(cwd, "..", "..");
    expect(await run(["--json"], cliDir)).toEqual({
      code: 0,
      stdout: `${JSON.stringify([ADOPTION_SCORE], null, 2)}\n`,
      stderr: "",
    });
  });

  it("prints the usage for --help", async () => {
    expect(await run(["--help"])).toEqual({ code: 0, stdout: USAGE, stderr: "" });
  });

  it("rejects an unknown option", async () => {
    expect(await run(["--ci"])).toEqual({
      code: 2,
      stdout: "",
      stderr: `frontscan: unknown option --ci\n${USAGE}`,
    });
  });

  it("rejects = on options that take no value, and unknown options with =", async () => {
    expect(await run(["first-run", "--json=1"])).toEqual({
      code: 2,
      stdout: "",
      stderr: `frontscan: unknown option --json=1\n${USAGE}`,
    });
    expect(await run(["first-run", "--nope=x"])).toEqual({
      code: 2,
      stdout: "",
      stderr: `frontscan: unknown option --nope=x\n${USAGE}`,
    });
  });

  it("rejects two paths", async () => {
    expect(await run(["a", "b"])).toEqual({
      code: 2,
      stdout: "",
      stderr: `frontscan: expected at most one path\n${USAGE}`,
    });
  });

  it("rejects a missing path", async () => {
    expect(await run(["does-not-exist"])).toEqual({
      code: 2,
      stdout: "",
      stderr: "frontscan: not a directory: does-not-exist\n",
    });
  });
});
