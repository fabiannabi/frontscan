import type { Finding, JsxElement } from "@frontscan/core";
import { isComponentName } from "./component-usage.js";

const MAX_VALUES = 10;

interface PropStats {
  elements: number;
  values: Map<string, number>;
  dynamic: number;
}

const byCountThenText = (a: [string, number], b: [string, number]) =>
  b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/** One repo-level finding per distinct (component, prop): in how many uses it is passed and with which static values. */
export function propUsage(elements: readonly JsxElement[]): Finding[] {
  const components = new Map<string, { uses: number; props: Map<string, PropStats> }>();
  for (const { name, props } of elements) {
    if (!isComponentName(name)) continue;
    let component = components.get(name);
    if (!component) components.set(name, (component = { uses: 0, props: new Map() }));
    component.uses++;
    const seen = new Set<string>();
    for (const prop of props) {
      if (prop.name === "key") continue;
      let stats = component.props.get(prop.name);
      if (!stats) component.props.set(prop.name, (stats = { elements: 0, values: new Map(), dynamic: 0 }));
      if (!seen.has(prop.name)) {
        seen.add(prop.name);
        stats.elements++;
      }
      if (prop.value === undefined) {
        stats.dynamic++;
      } else {
        const rendered = typeof prop.value === "string" ? JSON.stringify(prop.value) : String(prop.value);
        stats.values.set(rendered, (stats.values.get(rendered) ?? 0) + 1);
      }
    }
  }
  const findings: Finding[] = [];
  for (const [name, { uses, props }] of components) {
    for (const [prop, stats] of props) {
      const sorted = [...stats.values].sort(byCountThenText);
      const entries = sorted.slice(0, MAX_VALUES).map(([text, count]) => `${text} (${count})`);
      const rest = sorted.slice(MAX_VALUES);
      if (rest.length > 0) {
        let total = 0;
        for (const [, count] of rest) total += count;
        entries.push(`${rest.length} more values (${total})`);
      }
      if (stats.dynamic > 0) entries.push(`dynamic (${stats.dynamic})`);
      findings.push({
        lens: "census",
        rule: "prop-usage",
        area: "design-system",
        severity: "info",
        message: `\`${name}\` receives \`${prop}\` in ${stats.elements} of ${uses} use${uses === 1 ? "" : "s"}: ${entries.join(", ")}.`,
      });
    }
  }
  return findings;
}
