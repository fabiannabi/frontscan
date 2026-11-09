import type { JsxElement } from "@frontscan/core";
import { isComponentName } from "@frontscan/census";

export interface ComponentRow {
  readonly name: string;
  readonly uses: number;
  readonly files: number;
}

export interface PropValue {
  readonly text: string;
  readonly count: number;
}

export interface PropRow {
  readonly name: string;
  /** Elements that pass the prop. */
  readonly uses: number;
  /** Literal values, most common first. */
  readonly values: readonly PropValue[];
  /** Uses whose value is not a literal. */
  readonly dynamic: number;
}

export interface ComponentProps {
  readonly component: string;
  readonly uses: number;
  readonly props: readonly PropRow[];
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

interface Stats {
  uses: number;
  files: Set<string>;
  props: Map<string, { uses: number; values: Map<string, number>; dynamic: number }>;
}

function collect(elements: readonly JsxElement[]): Map<string, Stats> {
  const components = new Map<string, Stats>();
  for (const { name, file, props } of elements) {
    if (!isComponentName(name)) continue;
    let stats = components.get(name);
    if (!stats) components.set(name, (stats = { uses: 0, files: new Set(), props: new Map() }));
    stats.uses++;
    stats.files.add(file);
    const seen = new Set<string>();
    for (const prop of props) {
      if (prop.name === "key") continue;
      let p = stats.props.get(prop.name);
      if (!p) stats.props.set(prop.name, (p = { uses: 0, values: new Map(), dynamic: 0 }));
      if (!seen.has(prop.name)) {
        seen.add(prop.name);
        p.uses++;
      }
      if (prop.value === undefined) p.dynamic++;
      else {
        const text = typeof prop.value === "string" ? JSON.stringify(prop.value) : String(prop.value);
        p.values.set(text, (p.values.get(text) ?? 0) + 1);
      }
    }
  }
  return components;
}

/** Every component, most used first. Lowercase (HTML) tags are skipped. */
export function componentRows(elements: readonly JsxElement[]): ComponentRow[] {
  return [...collect(elements)]
    .map(([name, s]) => ({ name, uses: s.uses, files: s.files.size }))
    .sort((a, b) => b.uses - a.uses || b.files - a.files || compare(a.name, b.name));
}

/** For every component that received props, those props with their values. Components are in `componentRows` order. */
export function propRows(elements: readonly JsxElement[]): ComponentProps[] {
  const components = collect(elements);
  const result: ComponentProps[] = [];
  for (const row of componentRows(elements)) {
    const stats = components.get(row.name)!;
    if (stats.props.size === 0) continue;
    const props = [...stats.props]
      .map(([name, p]) => ({
        name,
        uses: p.uses,
        values: [...p.values]
          .map(([text, count]) => ({ text, count }))
          .sort((a, b) => b.count - a.count || compare(a.text, b.text)),
        dynamic: p.dynamic,
      }))
      .sort((a, b) => b.uses - a.uses || compare(a.name, b.name));
    result.push({ component: row.name, uses: row.uses, props });
  }
  return result;
}
