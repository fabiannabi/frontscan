import { sortFindings } from "@frontscan/core";
import type { Finding, Severity } from "@frontscan/core";

export interface FixGroup {
  /** `lens/rule`. */
  readonly id: string;
  readonly severity: Severity;
  readonly findings: Finding[];
}

const rank = (s: Severity) => (s === "error" ? 0 : s === "warning" ? 1 : 2);

/** Findings of the given severities grouped by rule: errors first, then most findings, then id. */
export function fixGroups(findings: readonly Finding[], severities: readonly Severity[]): FixGroup[] {
  const groups = new Map<string, { id: string; severity: Severity; findings: Finding[] }>();
  for (const f of sortFindings(findings)) {
    if (!severities.includes(f.severity)) continue;
    const id = `${f.lens}/${f.rule}`;
    const key = `${f.severity} ${id}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { id, severity: f.severity, findings: [] }));
    g.findings.push(f);
  }
  return [...groups.values()].sort(
    (a, b) =>
      rank(a.severity) - rank(b.severity) ||
      b.findings.length - a.findings.length ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
