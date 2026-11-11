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
  it("says how many files were left out, only when above 0", () => {
    const header = (html: string) => html.slice(html.indexOf("<header>"), html.indexOf("</header>") + 9);
    expect(header(htmlReport({ ...empty, files: 1, excluded: 2 }))).toEqual(
      "<header>\n<h1>demo</h1>\n<p>1 file (2 tests and fixtures left out)</p>\n</header>",
    );
    expect(htmlReport({ ...empty, excluded: 0 })).toEqual(htmlReport(empty));
  });

  it("renders the full document", () => {
    const expected = readFileSync(path.join(here, "fixtures/html-report/expected.html"), "utf8");
    expect(htmlReport(smallInput())).toEqual(expected);
  });

  it("renders the adoption score right after the overview table, escaped", () => {
    const score = finding({
      rule: "adoption-score",
      severity: "info",
      message: "Design system adoption: 50% of <b>interactive</b> elements (2 of 4; 2 plain HTML).",
    });
    const p = "<p>Design system adoption: 50% of &lt;b&gt;interactive&lt;/b&gt; elements (2 of 4; 2 plain HTML).</p>";
    const without = htmlReport({ ...empty, findings: [] });
    const html = htmlReport({ ...empty, findings: [score] });
    const end = without.indexOf("</table>") + 8;
    expect(html.slice(end, end + p.length + 1)).toEqual(`\n${p}`);
  });

  it("leaves the output unchanged without an adoption-score finding", () => {
    expect(htmlReport({ ...empty, findings: [finding()] })).not.toContain("adoption");
    expect(htmlReport(empty)).not.toContain("<p>Design system");
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
    const line = (prefix: string) => html.split("\n").find((l) => l.startsWith(prefix));
    expect(line("<title>")).toEqual(`<title>frontscan · ${e}</title>`);
    expect(html.slice(html.indexOf("<header>"), html.indexOf("</header>") + 9)).toEqual(
      `<header>\n<h1>${e}</h1>\n<p>0 files</p>\n</header>`,
    );
    // href is percent-encoded, then escaped: encodeURIComponent leaves ' alone, so it becomes &#39;
    const href = "%3C%3E%26%22&#39;";
    expect(line("<li>")).toEqual(`<li><a href="${href}"><code>${e}:1</code></a> ${e}<br><span class="hint">→ ${e}</span></li>`);
    expect(line('<tr data-filter="Btn variant"')).toEqual(
      `<tr data-filter="Btn variant"><th scope="row">variant</th><td class="num">1</td><td>&quot;&lt;&gt;&amp;\\&quot;&#39;&quot; (1)</td></tr>`,
    );
  });

  it("percent-encodes link targets so a path cannot become a script URL", () => {
    const li = (file: string) => mainOf(htmlReport({ ...empty, findings: [finding({ file, line: 2 })] })).match(/<li>.*<\/li>/)![0];
    expect(li("javascript:x/a.css")).toEqual(
      '<li><a href="javascript%3Ax/a.css"><code>javascript:x/a.css:2</code></a> Raw colour.</li>',
    );
    expect(li("src/a#b?.css")).toEqual('<li><a href="src/a%23b%3F.css"><code>src/a#b?.css:2</code></a> Raw colour.</li>');
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
