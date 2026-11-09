import type { Finding, JsxElement } from "@frontscan/core";

/** A component is a tag whose first character is ASCII A-Z (HTML tags and namespaced names are not). */
export function isComponentName(name: string): boolean {
  const c = name.charCodeAt(0);
  return c >= 65 && c <= 90;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One repo-level finding per distinct component: how many times it is used and in which files. */
export function componentUsage(elements: readonly JsxElement[]): Finding[] {
  const usage = new Map<string, Map<string, number>>();
  for (const { name, file } of elements) {
    if (!isComponentName(name)) continue;
    let files = usage.get(name);
    if (!files) usage.set(name, (files = new Map()));
    files.set(file, (files.get(file) ?? 0) + 1);
  }
  const findings: Finding[] = [];
  for (const [name, files] of usage) {
    const paths = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    let total = 0;
    for (const n of files.values()) total += n;
    const list = paths.map((p) => `${p} (${files.get(p)})`).join(", ");
    findings.push({
      lens: "census",
      rule: "component-usage",
      area: "design-system",
      severity: "info",
      message: `\`${name}\` is used ${plural(total, "time")} in ${plural(paths.length, "file")}: ${list}.`,
    });
  }
  return findings;
}
