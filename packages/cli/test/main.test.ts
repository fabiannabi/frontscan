import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "../src/main.js";

const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const USAGE = "Usage: frontscan [path] [--json]\n";

async function run(argv: string[], dir = cwd) {
  let stdout = "";
  let stderr = "";
  const code = await main(argv, {
    cwd: dir,
    stdout: (s) => (stdout += s),
    stderr: (s) => (stderr += s),
  });
  return { code, stdout, stderr };
}

const FINDINGS = [
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

const TERMINAL = [
  "design-system (2)",
  "  (repo)",
  "      info  `Button` is used 1 time in 1 file: src/App.tsx (1).  census/component-usage",
  "  src/Button.css",
  "      2:3  warning  Raw colour `#ff0000` in `color` bypasses the design tokens.  census/raw-colour",
  "                    → Define a colour token (a `--*` custom property in a token file) and use it here.",
  "",
  "2 findings (0 errors, 1 warning, 1 info)",
  "",
].join("\n");

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

  it("prints the terminal report", async () => {
    expect(await run(["first-run"])).toEqual({ code: 0, stdout: TERMINAL, stderr: "" });
  });

  it("accepts --json before the path", async () => {
    expect(await run(["--json", "first-run"])).toEqual(await run(["first-run", "--json"]));
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
