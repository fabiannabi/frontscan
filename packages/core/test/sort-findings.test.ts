import { describe, expect, it } from "vitest";
import { sortFindings, type Finding } from "../src/index.js";

const f = (over: Partial<Finding> & { message: string }): Finding => ({
  lens: "intl",
  rule: "r",
  area: "intl",
  severity: "error",
  ...over,
});
const messages = (list: readonly Finding[]) => list.map((x) => x.message);

describe("sortFindings", () => {
  it("does not mutate the input and returns a new array", () => {
    const input = [f({ message: "b", file: "b.ts" }), f({ message: "a", file: "a.ts" })];
    const copy = [...input];
    const out = sortFindings(input);
    expect(out).not.toBe(input);
    expect(input).toEqual(copy);
    expect(messages(out)).toEqual(["a", "b"]);
  });

  it("puts findings without file first", () => {
    const out = sortFindings([f({ message: "x", file: "a.ts", line: 1 }), f({ message: "none" })]);
    expect(messages(out)).toEqual(["none", "x"]);
  });

  it("puts a missing line first within a file", () => {
    const out = sortFindings([f({ message: "l1", file: "a.ts", line: 1 }), f({ message: "noline", file: "a.ts" })]);
    expect(messages(out)).toEqual(["noline", "l1"]);
  });

  it("puts a missing column first on a line", () => {
    const out = sortFindings([
      f({ message: "c1", file: "a.ts", line: 2, column: 1 }),
      f({ message: "nocol", file: "a.ts", line: 2 }),
    ]);
    expect(messages(out)).toEqual(["nocol", "c1"]);
  });

  it("orders by file, line (numeric), column", () => {
    const out = sortFindings([
      f({ message: "4", file: "b.ts", line: 1 }),
      f({ message: "3", file: "a.ts", line: 10 }),
      f({ message: "2", file: "a.ts", line: 9, column: 5 }),
      f({ message: "1", file: "a.ts", line: 9, column: 2 }),
    ]);
    expect(messages(out)).toEqual(["1", "2", "3", "4"]);
  });

  it("orders severity error → warning → info", () => {
    const out = sortFindings([
      f({ message: "i", severity: "info" }),
      f({ message: "w", severity: "warning" }),
      f({ message: "e", severity: "error" }),
    ]);
    expect(messages(out)).toEqual(["e", "w", "i"]);
  });

  it("compares strings by code units, not locale", () => {
    const out = sortFindings([f({ message: "lower", file: "a.ts" }), f({ message: "upper", file: "B.ts" })]);
    expect(messages(out)).toEqual(["upper", "lower"]);
  });

  it("breaks ties by rule, then lens, then message", () => {
    const out = sortFindings([
      f({ message: "m2", rule: "b" }),
      f({ message: "m2", rule: "a", lens: "z" }),
      f({ message: "m2", rule: "a", lens: "a" }),
      f({ message: "m1", rule: "a", lens: "a" }),
    ]);
    expect(out.map((x) => `${x.rule}/${x.lens}/${x.message}`)).toEqual(["a/a/m1", "a/a/m2", "a/z/m2", "b/intl/m2"]);
  });

  it("gives the same output for different input orders", () => {
    const base = [
      f({ message: "m1", rule: "a", lens: "a", file: "a.ts", line: 1, column: 1 }),
      f({ message: "m2", rule: "a", lens: "a", file: "a.ts", line: 1, column: 1 }),
      f({ message: "m1", rule: "a", lens: "b", file: "a.ts", line: 1, column: 1 }),
      f({ message: "w", severity: "warning", file: "a.ts", line: 1, column: 1 }),
      f({ message: "nofile" }),
      f({ message: "noline", file: "a.ts" }),
    ];
    expect(sortFindings([...base].reverse())).toEqual(sortFindings(base));
    expect(messages(sortFindings(base))).toEqual(["nofile", "noline", "m1", "m2", "m1", "w"]);
  });
});
