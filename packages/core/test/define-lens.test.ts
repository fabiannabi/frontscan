import { describe, expect, it } from "vitest";
import { defineLens, type Lens } from "../src/index.js";

const lensWith = (id: string): Lens => ({ id, area: "a11y", title: "t", run: () => [] });

describe("defineLens", () => {
  it("returns the same lens object", () => {
    const lens = lensWith("census");
    expect(defineLens(lens)).toBe(lens);
  });

  it.each(["census", "a11y", "agent-ready"])("accepts %s", (id) => {
    expect(() => defineLens(lensWith(id))).not.toThrow();
  });

  it.each(["A11y", "1lens", "agent_ready", "agent--ready", "-x"])("rejects %s", (id) => {
    expect(() => defineLens(lensWith(id))).toThrow(Error);
    expect(() => defineLens(lensWith(id))).toThrow(`lens id "${id}" is not kebab-case`);
  });

  it("throws a plain Error naming the id", () => {
    let caught: unknown;
    try {
      defineLens(lensWith("Agent_Ready"));
    } catch (e) {
      caught = e;
    }
    expect(Object.getPrototypeOf(caught)).toBe(Error.prototype);
    expect((caught as Error).message).toBe('lens id "Agent_Ready" is not kebab-case');
  });
});
