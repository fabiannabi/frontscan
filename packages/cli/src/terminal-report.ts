import { sortFindings } from "@frontscan/core";
import type { Area, Finding, Severity } from "@frontscan/core";

export const AREAS: readonly Area[] = ["design-system", "a11y", "intl", "agent-ready", "security"];

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function findingLines(f: Finding): string[] {
  const position =
    f.line === undefined ? "" : `${f.column === undefined ? f.line : `${f.line}:${f.column}`}  `;
  const prefix = `${position}${f.severity}  `;
  const lines = [`      ${prefix}${f.message}  ${f.lens}/${f.rule}`];
  if (f.suggestion !== undefined) lines.push(`      ${" ".repeat(prefix.length)}→ ${f.suggestion}`);
  return lines;
}

export function terminalReport(findings: readonly Finding[]): string {
  if (findings.length === 0) return "No findings.\n";
  const sorted = sortFindings(findings);
  const blocks: string[] = [];
  for (const area of AREAS) {
    const inArea = sorted.filter((f) => f.area === area);
    if (inArea.length === 0) continue;
    const lines = [`${area} (${inArea.length})`];
    let current: string | undefined;
    for (const f of inArea) {
      const heading = f.file ?? "(repo)";
      if (heading !== current) {
        lines.push(`  ${heading}`);
        current = heading;
      }
      lines.push(...findingLines(f));
    }
    blocks.push(lines.join("\n"));
  }
  const count = (s: Severity) => sorted.filter((f) => f.severity === s).length;
  const summary = `${plural(sorted.length, "finding")} (${plural(count("error"), "error")}, ${plural(count("warning"), "warning")}, ${count("info")} info)`;
  return `${blocks.join("\n\n")}\n\n${summary}\n`;
}
