import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Finding, JsxElement } from "@frontscan/core";
import { htmlReport } from "../src/html-report.js";
import type { HtmlReportInput } from "../src/html-report.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const finding = (over: Partial<Finding> = {}): Finding => ({
  lens: "census",
  rule: "raw-colour",
  area: "design-system",
  severity: "warning",
  message: "Raw colour.",
  ...over,
});

const element = (name: string, file: string, props: JsxElement["props"] = []): JsxElement =>
  ({ name, file, line: 1, column: 1, props }) as JsxElement;

const empty: HtmlReportInput = { repo: "demo", files: 0, areas: ["design-system"], findings: [], elements: [] };

export function smallInput(): HtmlReportInput {
  const findings: Finding[] = [
    finding({ lens: "a11y", rule: "img-alt", area: "a11y", severity: "error", message: "Image without alt.", file: "src/A.tsx", line: 4, suggestion: "Add an alt." }),
    ...Array.from({ length: 7 }, (_, i) =>
      finding({ message: `Raw colour #${i}${i}${i}.`, file: "src/a.css", line: i + 1, suggestion: "Use a token." }),
    ),
    finding({ rule: "component-usage", severity: "info", message: "`Button` is used.", file: "src/App.tsx" }),
    finding({ lens: "agent-ready", rule: "no-agents-md", area: "agent-ready", message: "No AGENTS.md." }),
  ];
  const elements: JsxElement[] = Array.from({ length: 12 }, (_, i) =>
    element(`Comp${String.fromCharCode(65 + i)}`, `src/f${i}.tsx`, i === 0 ? [{ name: "variant", value: "primary" }, { name: "onClick" }] as never : []),
  );
  elements.push(element("CompA", "src/g.tsx", [{ name: "variant", value: "ghost" }] as never));
  return { repo: "demo", files: 9, areas: ["design-system", "a11y"], findings, elements };
}

const mainOf = (html: string) => html.slice(html.indexOf("<main>"), html.indexOf("</main>") + 7);

describe("htmlReport", () => {
  it("renders the full document", () => {
    const expected = readFileSync(path.join(here, "fixtures/html-report/expected.html"), "utf8");
    expect(htmlReport(smallInput())).toEqual(expected);
  });

  it("lists every finding of a rule", () => {
    const findings = Array.from({ length: 12 }, (_, i) => finding({ message: `m${i}`, file: "f.css", line: i + 1 }));
    const html = htmlReport({ ...empty, findings });
    const section = html.slice(html.indexOf('<section class="rule'), html.indexOf("</section>") + 10);
    expect(section).toEqual(
      [
        '<section class="rule warning">',
        '<h3>census/raw-colour · <span class="sev">warning</span> · 12</h3>',
        "<ul>",
        ...findings.map((f, i) => `<li><a href="f.css"><code>f.css:${i + 1}</code></a> ${f.message}</li>`),
        "</ul>",
        "</section>",
      ].join("\n"),
    );
  });

  it("escapes every piece of input text", () => {
    const t = `<>&"'`;
    const e = "&lt;&gt;&amp;&quot;&#39;";
    const html = htmlReport({
      ...empty,
      repo: t,
      findings: [finding({ message: t, suggestion: t, file: t, line: 1 })],
      elements: [element("Btn", "a.tsx", [{ name: "variant", value: t }] as never)],
    });
    expect(html).toContain(`<title>frontscan · ${e}</title>`);
    expect(html).toContain(`<h1>${e}</h1>`);
    expect(html).toContain(`<li><a href="${e}"><code>${e}:1</code></a> ${e}<br><span class="hint">→ ${e}</span></li>`);
    expect(html).toContain(
      `<tr data-filter="Btn variant"><th scope="row">variant</th><td class="num">1</td><td>&quot;&lt;&gt;&amp;\\&quot;&#39;&quot; (1)</td></tr>`,
    );
  });

  it("renders the three link forms", () => {
    const li = (f: Partial<Finding>) => mainOf(htmlReport({ ...empty, findings: [finding(f)] })).match(/<li>.*<\/li>/)![0];
    expect(li({ file: "src/a.css", line: 3 })).toEqual('<li><a href="src/a.css"><code>src/a.css:3</code></a> Raw colour.</li>');
    expect(li({ file: "src/a.css" })).toEqual('<li><a href="src/a.css"><code>src/a.css</code></a> Raw colour.</li>');
    expect(li({})).toEqual("<li><code>(repo)</code> Raw colour.</li>");
  });

  it("renders an empty repo", () => {
    expect(mainOf(htmlReport(empty))).toEqual(
      [
        "<main>",
        [
          "<table>",
          "<caption>Overview</caption>",
          '<thead><tr><th scope="col">area</th><th scope="col" class="num">errors</th><th scope="col" class="num">warnings</th><th scope="col" class="num">info</th></tr></thead>',
          "<tbody>",
          '<tr><th scope="row">design-system</th><td class="num">0</td><td class="num">0</td><td class="num">0</td></tr>',
          "</tbody>",
          "</table>",
        ].join("\n"),
        "<section>\n<h2>To fix</h2>\n<p>Nothing to fix.</p>\n</section>",
        "</main>",
      ].join("\n"),
    );
  });

  it("is deterministic", () => {
    const a = htmlReport(smallInput());
    expect(htmlReport(smallInput())).toEqual(a);
    expect(a.match(/\/home|C:\\|\d{4}-\d{2}-\d{2}/)).toEqual(null);
  });
});
