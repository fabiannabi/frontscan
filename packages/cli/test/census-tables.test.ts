import type { JsxElement, JsxProp } from "@frontscan/core";
import { describe, expect, it } from "vitest";
import { componentRows, propRows } from "../src/census-tables.js";

const prop = (name: string, value?: JsxProp["value"]): JsxProp =>
  value === undefined ? { name, line: 1, column: 1 } : { name, value, line: 1, column: 1 };
const el = (file: string, name: string, props: JsxProp[] = []): JsxElement => ({
  file,
  name,
  props,
  hasSpread: false,
  line: 1,
  column: 1,
  origin: /^[A-Z]/.test(name) ? "local" : "html",
});

describe("componentRows", () => {
  it("returns nothing without elements", () => {
    expect(componentRows([])).toEqual([]);
  });

  it("counts uses and files, skips HTML tags, and sorts by uses, files, then name", () => {
    const rows = componentRows([
      el("a.tsx", "div"),
      el("a.tsx", "Card"),
      el("a.tsx", "Zed"),
      el("b.tsx", "Zed"),
      el("a.tsx", "Alpha"),
      el("a.tsx", "Alpha"),
      el("a.tsx", "Beta"),
      el("b.tsx", "Beta"),
      el("a.tsx", "svg:rect"),
      el("a.tsx", "Big"),
      el("a.tsx", "Big"),
      el("a.tsx", "Big"),
    ]);
    expect(rows).toEqual([
      { name: "Big", uses: 3, files: 1 },
      { name: "Beta", uses: 2, files: 2 },
      { name: "Zed", uses: 2, files: 2 },
      { name: "Alpha", uses: 2, files: 1 },
      { name: "Card", uses: 1, files: 1 },
    ]);
  });
});

describe("propRows", () => {
  it("returns nothing for components without props and skips HTML tags", () => {
    expect(propRows([el("a.tsx", "Card"), el("a.tsx", "div", [prop("className", "x")])])).toEqual([]);
  });

  it("aggregates values, ignores key, and counts a repeated prop once per element", () => {
    const rows = propRows([
      el("a.tsx", "Button", [prop("variant", "primary"), prop("key", "k1")]),
      el("a.tsx", "Button", [prop("variant", "primary"), prop("size", 2), prop("disabled", true)]),
      el("b.tsx", "Button", [prop("variant", "ghost"), prop("variant", "ghost"), prop("size")]),
      el("b.tsx", "Button", [prop("variant", "alt"), prop("size", 2), prop("onClick")]),
      el("b.tsx", "Card", [prop("elevated", false)]),
      el("b.tsx", "Card"),
    ]);
    expect(rows).toEqual([
      {
        component: "Button",
        uses: 4,
        props: [
          {
            name: "variant",
            uses: 4,
            values: [
              { text: '"ghost"', count: 2 },
              { text: '"primary"', count: 2 },
              { text: '"alt"', count: 1 },
            ],
            dynamic: 0,
          },
          { name: "size", uses: 3, values: [{ text: "2", count: 2 }], dynamic: 1 },
          { name: "disabled", uses: 1, values: [{ text: "true", count: 1 }], dynamic: 0 },
          { name: "onClick", uses: 1, values: [], dynamic: 1 },
        ],
      },
      { component: "Card", uses: 2, props: [{ name: "elevated", uses: 1, values: [{ text: "false", count: 1 }], dynamic: 0 }] },
    ]);
  });
});
