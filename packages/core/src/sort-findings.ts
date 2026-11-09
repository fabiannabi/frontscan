import type { Finding, Severity } from "./types.js";

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

function compareOptional<T extends string | number>(a: T | undefined, b: T | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a < b ? -1 : 1;
}

function compare(a: Finding, b: Finding): number {
  return (
    compareOptional(a.file, b.file) ||
    compareOptional(a.line, b.line) ||
    compareOptional(a.column, b.column) ||
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    compareOptional(a.rule, b.rule) ||
    compareOptional(a.lens, b.lens) ||
    compareOptional(a.message, b.message)
  );
}

/**
 * Returns a new array of the findings, leaving the input untouched, ordered by:
 * `file`, `line`, `column`, `severity` (`error` → `warning` → `info`), `rule`,
 * `lens`, then `message`.
 *
 * A missing `file`, `line` or `column` comes before any present value at its level
 * (a finding without `file` first; within a file, one without `line` first; on a
 * line, one without `column` first). Strings are compared by plain code units
 * (`<` / `>`), never `localeCompare`, so output is byte-identical on every machine.
 * Findings equal on every key are interchangeable; their relative order is unspecified.
 */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(compare);
}
