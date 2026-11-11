import type { Area, Finding, JsxElement, Severity } from "@frontscan/core";
import { componentRows, propRows } from "./census-tables.js";
import { fixGroups } from "./fix-groups.js";
import type { FixGroup } from "./fix-groups.js";

export interface HtmlReportInput {
  /** Name of the scanned repo, never a path. */
  readonly repo: string;
  readonly files: number;
  /** The areas to show in the overview, in order. */
  readonly areas: readonly Area[];
  readonly findings: readonly Finding[];
  readonly elements: readonly JsxElement[];
}

const CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:";

const STYLE = `:root{color-scheme:light dark;--bg:#fff;--fg:#1b1b1b;--muted:#4a4a4a;--line:#c9c9c9;--link:#0b4fb3;--error:#a30018;--warning:#7a4600;--info:#3d3d3d}
@media (prefers-color-scheme: dark){:root{--bg:#141414;--fg:#ececec;--muted:#b8b8b8;--line:#4a4a4a;--link:#8ab8ff;--error:#ff9a9a;--warning:#ffcc80;--info:#c8c8c8}}
body{margin:0 auto;max-width:72rem;padding:1.5rem;background:var(--bg);color:var(--fg);font:1rem/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--link)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
table{border-collapse:collapse;margin:.5rem 0 1.5rem}
caption{text-align:left;font-weight:600;padding:.25rem 0}
th,td{border:1px solid var(--line);padding:.25rem .75rem;text-align:left}
td.num,th.num{text-align:right}
section.rule{border-left:.3rem solid var(--line);padding-left:1rem;margin:1rem 0}
section.rule.error{border-left-color:var(--error)}
section.rule.warning{border-left-color:var(--warning)}
section.rule.info{border-left-color:var(--info)}
.error .sev{color:var(--error)}
.warning .sev{color:var(--warning)}
.info .sev{color:var(--info)}
.sev{font-weight:700}
li{margin:.4rem 0}
.hint{color:var(--muted)}
summary{cursor:pointer;font-weight:600}
label{display:block;font-weight:600}
input[type=search]{font:inherit;padding:.25rem .5rem;margin:.25rem 0 1rem;min-width:16rem;color:var(--fg);background:var(--bg);border:1px solid var(--line)}
@media print{.filter{display:none}details>:not(summary){display:block}details::details-content{content-visibility:visible;display:contents}tr,li{break-inside:avoid}a{color:inherit}}`;

const SCRIPT = `(function(){var i=document.getElementById("filter");if(!i)return;
var rows=document.querySelectorAll("[data-filter]");
function apply(){var q=i.value.toLowerCase();for(var n=0;n<rows.length;n++){var r=rows[n];r.hidden=q!==""&&r.getAttribute("data-filter").toLowerCase().indexOf(q)<0}
var ts=document.querySelectorAll("[data-props]");for(var k=0;k<ts.length;k++){ts[k].hidden=q!==""&&!ts[k].querySelector("tbody tr:not([hidden])")}}
i.addEventListener("input",apply);
window.addEventListener("beforeprint",function(){var d=document.querySelectorAll("details");for(var n=0;n<d.length;n++)d[n].open=true})})();`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function location(f: Finding): string {
  if (f.file === undefined) return "<code>(repo)</code>";
  const file = escapeHtml(f.file);
  const text = f.line !== undefined ? `${file}:${f.line}` : file;
  const href = escapeHtml(f.file.split("/").map(encodeURIComponent).join("/"));
  return `<a href="${href}"><code>${text}</code></a>`;
}

function groupSection(g: FixGroup): string {
  const items = g.findings.map((f) => {
    const suggestion = f.suggestion !== undefined ? `<br><span class="hint">→ ${escapeHtml(f.suggestion)}</span>` : "";
    return `<li>${location(f)} ${escapeHtml(f.message)}${suggestion}</li>`;
  });
  return [
    `<section class="rule ${g.severity}">`,
    `<h3>${escapeHtml(g.id)} · <span class="sev">${g.severity}</span> · ${g.findings.length}</h3>`,
    "<ul>",
    ...items,
    "</ul>",
    "</section>",
  ].join("\n");
}

export function htmlReport(input: HtmlReportInput): string {
  const repo = escapeHtml(input.repo);
  const count = (area: Area, severity: Severity) =>
    input.findings.filter((f) => f.area === area && f.severity === severity).length;

  const main: string[] = [];
  main.push(
    [
      "<table>",
      "<caption>Overview</caption>",
      "<thead><tr><th scope=\"col\">area</th><th scope=\"col\" class=\"num\">errors</th><th scope=\"col\" class=\"num\">warnings</th><th scope=\"col\" class=\"num\">info</th></tr></thead>",
      "<tbody>",
      ...input.areas.map(
        (a) =>
          `<tr><th scope="row">${escapeHtml(a)}</th>${(["error", "warning", "info"] as const)
            .map((s) => `<td class="num">${count(a, s)}</td>`)
            .join("")}</tr>`,
      ),
      "</tbody>",
      "</table>",
    ].join("\n"),
  );

  const score = input.findings.find((f) => f.lens === "census" && f.rule === "adoption-score");
  if (score !== undefined) main.push(`<p>${escapeHtml(score.message)}</p>`);

  const fix =fixGroups(input.findings, ["error", "warning"]);
  main.push(
    [
      "<section>",
      "<h2>To fix</h2>",
      ...(fix.length === 0 ? ["<p>Nothing to fix.</p>"] : fix.map(groupSection)),
      "</section>",
    ].join("\n"),
  );

  const info = fixGroups(input.findings, ["info"]);
  if (info.length > 0) {
    main.push(
      ["<section>", "<details>", "<summary>Info</summary>", ...info.map(groupSection), "</details>", "</section>"].join(
        "\n",
      ),
    );
  }

  const components = componentRows(input.elements);
  if (components.length > 0) {
    main.push(
      [
        "<div class=\"filter\">",
        "<label for=\"filter\">Filter components and props</label>",
        "<input id=\"filter\" type=\"search\">",
        "</div>",
      ].join("\n"),
    );
    main.push(
      [
        "<section>",
        "<h2>Components</h2>",
        "<table>",
        "<caption>Components by use</caption>",
        "<thead><tr><th scope=\"col\">component</th><th scope=\"col\" class=\"num\">uses</th><th scope=\"col\" class=\"num\">files</th></tr></thead>",
        "<tbody>",
        ...components.map(
          (c) =>
            `<tr data-filter="${escapeHtml(c.name)}"><th scope="row">${escapeHtml(c.name)}</th><td class="num">${c.uses}</td><td class="num">${c.files}</td></tr>`,
        ),
        "</tbody>",
        "</table>",
        "</section>",
      ].join("\n"),
    );
    const props = propRows(input.elements);
    if (props.length > 0) {
      main.push(
        [
          "<section>",
          "<h2>Props</h2>",
          ...props.map((c) =>
            [
              "<table data-props>",
              `<caption>${escapeHtml(c.component)} (${plural(c.uses, "use")})</caption>`,
              "<thead><tr><th scope=\"col\">prop</th><th scope=\"col\" class=\"num\">uses</th><th scope=\"col\">values</th></tr></thead>",
              "<tbody>",
              ...c.props.map((p) => {
                const values = p.values.map((v) => `${v.text} (${v.count})`);
                if (p.dynamic > 0) values.push(`dynamic (${p.dynamic})`);
                return `<tr data-filter="${escapeHtml(`${c.component} ${p.name}`)}"><th scope="row">${escapeHtml(p.name)}</th><td class="num">${p.uses}</td><td>${escapeHtml(values.join(", "))}</td></tr>`;
              }),
              "</tbody>",
              "</table>",
            ].join("\n"),
          ),
          "</section>",
        ].join("\n"),
      );
    }
  }

  return `${[
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<title>frontscan · ${repo}</title>`,
    `<style>\n${STYLE}\n</style>`,
    "</head>",
    "<body>",
    "<header>",
    `<h1>${repo}</h1>`,
    `<p>${plural(input.files, "file")}</p>`,
    "</header>",
    "<main>",
    main.join("\n"),
    "</main>",
    `<script>\n${SCRIPT}\n</script>`,
    "</body>",
    "</html>",
  ].join("\n")}\n`;
}
