import { statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { jsxIndex, scan, sortFindings } from "@frontscan/core";
import type { Finding } from "@frontscan/core";
import { htmlReport } from "./html-report.js";
import { jsonReport } from "./json-report.js";
import { LENSES } from "./lenses.js";
import { summaryReport } from "./summary-report.js";
import { AREAS, terminalReport } from "./terminal-report.js";

export interface Io {
  cwd: string;
  stdout(text: string): void;
  stderr(text: string): void;
  /** Colour the default report with ANSI codes. Decided by the caller; absent means no colour. */
  colour?: boolean;
  /** A monotonic clock in milliseconds, to time the scan. Defaults to `performance.now`. */
  now?: () => number;
  /** Writes the `--html` report. Defaults to `writeFileSync(path, text, "utf8")`. */
  writeFile?(path: string, text: string): void;
}

const USAGE = "Usage: frontscan [path] [--json] [--details|--all] [--html <file>]\n";

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export async function main(argv: readonly string[], io: Io): Promise<number> {
  if (argv.includes("-h") || argv.includes("--help")) {
    io.stdout(USAGE);
    return 0;
  }
  let json = false;
  let details = false;
  let htmlFile: string | undefined;
  const paths: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json") json = true;
    else if (arg === "--details" || arg === "--all") details = true;
    else if (arg === "--html" || arg.startsWith("--html=")) {
      const next = arg === "--html" ? argv[i + 1] : arg.slice("--html=".length);
      if (next === undefined || next === "" || next.startsWith("-")) {
        io.stderr(`frontscan: --html needs a file path\n${USAGE}`);
        return 2;
      }
      htmlFile = next;
      if (arg === "--html") i++;
    } else if (arg.startsWith("-")) {
      io.stderr(`frontscan: unknown option ${arg}\n${USAGE}`);
      return 2;
    } else paths.push(arg);
  }
  if (paths.length > 1) {
    io.stderr(`frontscan: expected at most one path\n${USAGE}`);
    return 2;
  }
  const arg = paths[0];
  const root = arg === undefined ? io.cwd : path.resolve(io.cwd, arg);
  if (!isDirectory(root)) {
    io.stderr(`frontscan: not a directory: ${arg ?? io.cwd}\n`);
    return 2;
  }
  const now = io.now ?? (() => performance.now());
  const started = now();
  const index = await scan(root);
  const findings: Finding[] = [];
  for (const lens of LENSES) findings.push(...(await lens.run(index)));
  const sorted = sortFindings(findings);
  const areas = AREAS.filter((a) => LENSES.some((l) => l.area === a));
  const repo = path.basename(root);
  if (json) io.stdout(jsonReport(sorted));
  else if (details) io.stdout(terminalReport(sorted));
  else {
    const durationMs = now() - started;
    io.stdout(
      summaryReport({
        repo,
        files: index.files.length,
        durationMs,
        areas,
        findings: sorted,
        elements: jsxIndex(index),
        colour: io.colour === true,
      }),
    );
  }
  if (htmlFile !== undefined) {
    const html = htmlReport({
      repo,
      files: index.files.length,
      areas,
      findings: sorted,
      elements: jsxIndex(index),
    });
    try {
      (io.writeFile ?? ((p, t) => writeFileSync(p, t, "utf8")))(path.resolve(io.cwd, htmlFile), html);
    } catch {
      io.stderr(`frontscan: cannot write ${htmlFile}\n`);
      return 2;
    }
  }
  return 0;
}
