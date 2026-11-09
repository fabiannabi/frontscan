import { sortFindings } from "@frontscan/core";
import type { Finding } from "@frontscan/core";

export function jsonReport(findings: readonly Finding[]): string {
  return JSON.stringify(sortFindings(findings), null, 2) + "\n";
}
