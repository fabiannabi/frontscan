import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { jsxIndex, scan, type FileKind, type Finding, type RepoIndex } from "@frontscan/core";
import { adoptionScore } from "../src/index.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});

const score = (...files: [string, FileKind, string][]): Finding[] => {
  const index = repo(...files);
  return adoptionScore(index, jsxIndex(index));
};

const base = {
  lens: "census",
  rule: "adoption-score",
  area: "design-system",
  severity: "info",
} as const;

const SUGGESTION =
  "Replace plain `<button>`, `<a>`, `<input>`, `<select>` and `<textarea>` with the design system's components.";

const config = ["frontscan.config.json", "json", '{ "designSystem": ["@acme/ui"] }'] as [
  string,
  FileKind,
  string,
];
const IMPORT = 'import { Button, Text } from "@acme/ui";\n';

describe("census adoption-score", () => {
  it("reports the fixture exactly", async () => {
    const index = await scan(fileURLToPath(new URL("./fixtures/adoption-score", import.meta.url)));
    expect(adoptionScore(index, jsxIndex(index))).toEqual([
      {
        ...base,
        message: "Design system adoption: 50% of interactive elements (2 of 4; 2 plain HTML).",
        suggestion: SUGGESTION,
      },
    ]);
  });

  it("says so when no design system is found", () => {
    expect(score(["a.tsx", "tsx", "const x = <button />;"])).toEqual([
      {
        ...base,
        message: "No design system found; set one in frontscan.config.json.",
        suggestion: 'Add `"designSystem": ["<package>"]` to frontscan.config.json.',
      },
    ]);
  });

  it("never shows a percentage without interactive elements", () => {
    expect(score(config, ["a.tsx", "tsx", `${IMPORT}const x = <Text />;`])).toEqual([
      { ...base, message: "Design system adoption: no interactive elements found." },
    ]);
  });

  it("scores 100% without suggestion when only the design system is used", () => {
    expect(score(config, ["a.tsx", "tsx", `${IMPORT}const x = <Button />;`])).toEqual([
      { ...base, message: "Design system adoption: 100% of interactive elements (1 of 1; 0 plain HTML)." },
    ]);
  });

  it("rounds the percentage", () => {
    expect(
      score(config, ["a.tsx", "tsx", `${IMPORT}const x = <><Button /><button /><a /></>;`]),
    ).toEqual([
      {
        ...base,
        message: "Design system adoption: 33% of interactive elements (1 of 3; 2 plain HTML).",
        suggestion: SUGGESTION,
      },
    ]);
  });

  it("counts suffix matches and dotted names, not InputGroup", () => {
    const text =
      'import { IconButton, NumericInput, HTMLSelect, InputGroup, Form } from "@acme/ui";\n' +
      "const x = <><IconButton /><NumericInput /><HTMLSelect /><InputGroup /><Form.Input /></>;";
    expect(score(config, ["a.tsx", "tsx", text])).toEqual([
      { ...base, message: "Design system adoption: 100% of interactive elements (4 of 4; 0 plain HTML)." },
    ]);
  });

  it("leaves out tests, specs, stories and __tests__ folders", () => {
    const text = "const x = <button />;";
    expect(
      score(
        config,
        ["a.test.tsx", "tsx", text],
        ["b.spec.js", "tsx", text],
        ["c.stories.jsx", "tsx", text],
        ["__tests__/d.tsx", "tsx", text],
        ["src/__tests__/e.tsx", "tsx", text],
      ),
    ).toEqual([{ ...base, message: "Design system adoption: no interactive elements found." }]);
  });

  it("leaves out the design system's package folder", () => {
    expect(
      score(
        config,
        ["packages/ui/package.json", "json", '{ "name": "@acme/ui" }'],
        ["packages/ui/src/Button.tsx", "tsx", "const x = <button />;"],
        ["packages/uikit/Other.tsx", "tsx", "const x = <button />;"],
      ),
    ).toEqual([
      {
        ...base,
        message: "Design system adoption: 0% of interactive elements (0 of 1; 1 plain HTML).",
        suggestion: SUGGESTION,
      },
    ]);
  });

  it("leaves nothing out when the root package.json is the design system", () => {
    expect(
      score(
        config,
        ["package.json", "json", '{ "name": "@acme/ui" }'],
        ["src/Button.tsx", "tsx", "const x = <button />;"],
      ),
    ).toEqual([
      {
        ...base,
        message: "Design system adoption: 0% of interactive elements (0 of 1; 1 plain HTML).",
        suggestion: SUGGESTION,
      },
    ]);
  });
});
