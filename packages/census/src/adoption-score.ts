import { designSystemPackages } from "@frontscan/core";
import type { Finding, JsxElement, RepoIndex } from "@frontscan/core";

const HTML_TAGS = new Set(["button", "a", "input", "select", "textarea"]);
const DS_SUFFIXES = [
  "Button",
  "Link",
  "Anchor",
  "Input",
  "TextField",
  "Select",
  "Textarea",
  "TextArea",
  "Checkbox",
  "Radio",
  "Switch",
];
const LEFT_OUT = /\.(test|spec|stories)\.[jt]sx?$/;

const base = { lens: "census", rule: "adoption-score", area: "design-system", severity: "info" } as const;

function isInteractiveDesignSystem(name: string): boolean {
  const last = name.slice(name.lastIndexOf(".") + 1);
  return DS_SUFFIXES.some((s) => last.endsWith(s));
}

function packageName(text: string): string | undefined {
  try {
    const json: unknown = JSON.parse(text);
    if (typeof json === "object" && json !== null && !Array.isArray(json)) {
      const name = (json as Record<string, unknown>)["name"];
      return typeof name === "string" ? name : undefined;
    }
  } catch {
    // not JSON: no name
  }
  return undefined;
}

/** Directories (with trailing slash) of non-root `package.json` files named as the design system. */
function designSystemDirs(index: RepoIndex, packages: readonly string[]): string[] {
  const dirs: string[] = [];
  for (const file of index.files) {
    if (!file.path.endsWith("/package.json")) continue;
    const name = packageName(file.text);
    if (name !== undefined && packages.includes(name)) {
      dirs.push(file.path.slice(0, file.path.length - "package.json".length));
    }
  }
  return dirs;
}

/** One repo-level finding: the share of interactive elements that come from the design system. */
export function adoptionScore(index: RepoIndex, elements: readonly JsxElement[]): Finding[] {
  const packages = designSystemPackages(index);
  if (packages.length === 0) {
    return [
      {
        ...base,
        message: "No design system found; set one in frontscan.config.json.",
        suggestion: 'Add `"designSystem": ["<package>"]` to frontscan.config.json.',
      },
    ];
  }
  const dirs = designSystemDirs(index, packages);
  let ds = 0;
  let html = 0;
  for (const el of elements) {
    if (LEFT_OUT.test(el.file) || el.file.split("/").includes("__tests__")) continue;
    if (dirs.some((d) => el.file.startsWith(d))) continue;
    if (el.origin === "html" && HTML_TAGS.has(el.name)) html++;
    else if (el.origin === "design-system" && isInteractiveDesignSystem(el.name)) ds++;
  }
  const total = ds + html;
  if (total === 0) {
    return [{ ...base, message: "Design system adoption: no interactive elements found." }];
  }
  const percent = Math.round((100 * ds) / total);
  const message = `Design system adoption: ${percent}% of interactive elements (${ds} of ${total}; ${html} plain HTML).`;
  if (html === 0) return [{ ...base, message }];
  return [
    {
      ...base,
      message,
      suggestion:
        "Replace plain `<button>`, `<a>`, `<input>`, `<select>` and `<textarea>` with the design system's components.",
    },
  ];
}
