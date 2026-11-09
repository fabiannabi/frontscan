import { sortFindings } from "@frontscan/core";
import type { Area, Finding, JsxElement, Severity } from "@frontscan/core";
import { componentRows, propRows } from "./census-tables.js";

export interface SummaryInput {
  /** Name of the scanned repo, never a path. */
  readonly repo: string;
  readonly files: number;
  readonly durationMs: number;
  /** The areas to show in the table, in order. */
  readonly areas: readonly Area[];
  readonly findings: readonly Finding[];
  readonly elements: readonly JsxElement[];
  readonly colour?: boolean;
}

const MAX_FINDINGS_PER_RULE = 5;
const MAX_COMPONENTS = 10;
const MAX_PROPS = 5;
const MAX_VALUES = 3;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

/** no-color.org: colour only on a TTY, and only when NO_COLOR is unset or empty. */
export function shouldColour(isTTY: boolean | undefined, noColor: string | undefined): boolean {
  return isTTY === true && (noColor === undefined || noColor === "");
}

function formatDuration(ms: number): string {
  const rounded = Math.round(ms);
  return rounded < 1000 ? `${rounded}ms` : `${(rounded / 1000).toFixed(1)}s`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Left-aligned first column, right-aligned numbers; `leftLast` left-aligns the last column too. */
function table(rows: readonly (readonly string[])[], leftLast = false): string[] {
  const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => r[c]!.length)));
  return rows.map((r) =>
    r
      .map((cell, c) => (c === 0 || (leftLast && c === r.length - 1) ? cell.padEnd(widths[c]!) : cell.padStart(widths[c]!)))
      .join("  ")
      .trimEnd(),
  );
}

export function summaryReport(input: SummaryInput): string {
  const wrap = (code: string, text: string) => (input.colour === true ? `${code}${text}${RESET}` : text);
  const bold = (text: string) => wrap(BOLD, text);
  const sorted = sortFindings(input.findings);
  let hiddenError = 0;
  let hiddenWarning = 0;
  const infoCount = sorted.filter((f) => f.severity === "info").length;

  const sections: string[] = [];
  sections.push(
    bold(`${input.repo}  ·  ${plural(input.files, "file")}  ·  ${formatDuration(input.durationMs)}`),
  );

  const count = (area: Area, severity: Severity) =>
    sorted.filter((f) => f.area === area && f.severity === severity).length;
  sections.push(
    table([
      ["area", "errors", "warnings", "info"],
      ...input.areas.map((a) => [a, ...(["error", "warning", "info"] as const).map((s) => String(count(a, s)))]),
    ]).join("\n"),
  );

  // To fix
  const fixLines = [bold("To fix"), ""];
  const groups = new Map<string, { id: string; severity: Severity; findings: Finding[] }>();
  for (const f of sorted) {
    if (f.severity === "info") continue;
    const id = `${f.lens}/${f.rule}`;
    const key = `${f.severity} ${id}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { id, severity: f.severity, findings: [] }));
    g.findings.push(f);
  }
  if (groups.size === 0) fixLines.push("Nothing to fix.");
  const rank = (s: Severity) => (s === "error" ? 0 : 1);
  const blocks = [...groups.values()].sort(
    (a, b) =>
      rank(a.severity) - rank(b.severity) ||
      b.findings.length - a.findings.length ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const blockTexts: string[] = [];
  for (const g of blocks) {
    const colourCode = g.severity === "error" ? RED : YELLOW;
    const lines = [`${g.id} · ${wrap(colourCode, g.severity)} · ${g.findings.length}`];
    for (const f of g.findings.slice(0, MAX_FINDINGS_PER_RULE)) {
      const where = (f.file ?? "(repo)") + (f.file !== undefined && f.line !== undefined ? `:${f.line}` : "");
      lines.push(`  ${where}  ${f.message}`);
      if (f.suggestion !== undefined) lines.push(`      ${wrap(DIM, `→ ${f.suggestion}`)}`);
    }
    const more = g.findings.length - MAX_FINDINGS_PER_RULE;
    if (more > 0) {
      lines.push(`  … and ${more} more`);
      if (g.severity === "error") hiddenError += more;
      else hiddenWarning += more;
    }
    blockTexts.push(lines.join("\n"));
  }
  sections.push(fixLines.join("\n") + (blockTexts.length > 0 ? `\n${blockTexts.join("\n\n")}` : ""));

  // Census tables
  const components = componentRows(input.elements);
  if (components.length > 0) {
    const shown = components.slice(0, MAX_COMPONENTS);
    const lines = [
      bold("Components"),
      "",
      ...table([["component", "uses", "files"], ...shown.map((c) => [c.name, String(c.uses), String(c.files)])]),
    ];
    if (components.length > shown.length) lines.push(`… and ${components.length - shown.length} more components`);
    sections.push(lines.join("\n"));

    const listed = new Set(shown.map((c) => c.name));
    const withProps = propRows(input.elements).filter((c) => listed.has(c.component));
    if (withProps.length > 0) {
      const propBlocks = withProps.map((c) => {
        const props = c.props.slice(0, MAX_PROPS);
        const rows = props.map((p) => {
          const values = p.values.slice(0, MAX_VALUES).map((v) => `${v.text} (${v.count})`);
          if (p.dynamic > 0) values.push(`dynamic (${p.dynamic})`);
          return [p.name, String(p.uses), values.join(", ")];
        });
        const out = [
          `${c.component} (${plural(c.uses, "use")})`,
          ...table([["prop", "uses", "top values"], ...rows], true).map((l) => `  ${l}`),
        ];
        if (c.props.length > props.length) out.push(`  … and ${c.props.length - props.length} more props`);
        return out.join("\n");
      });
      sections.push(`${bold("Props")}\n\n${propBlocks.join("\n\n")}`);
    }
  }

  // Footer
  const hidden: string[] = [];
  if (hiddenError > 0) hidden.push(plural(hiddenError, "error"));
  if (hiddenWarning > 0) hidden.push(plural(hiddenWarning, "warning"));
  if (infoCount > 0) hidden.push(plural(infoCount, "info finding"));
  if (hidden.length > 0) {
    sections.push(`${hidden.join(", ")} not listed; run with --details to see every finding.`);
  }
  return `${sections.join("\n\n")}\n`;
}
