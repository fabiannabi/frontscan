import type { RepoIndex } from "./types.js";

export interface WorkspacePackage {
  readonly name: string;
  readonly dir: string;
}

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const dirname = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** One block-list item of `pnpm-workspace.yaml`, without quotes or comment. */
function yamlItem(raw: string): string {
  const text = raw.trim();
  const quote = text[0];
  if (quote === '"' || quote === "'") {
    const end = text.indexOf(quote, 1);
    return end === -1 ? text.slice(1) : text.slice(1, end);
  }
  return text.replace(/(^|\s)#.*$/, "").trim();
}

/** The block list under the top-level `packages:` key; flow style is ignored. */
function pnpmGlobs(text: string): string[] {
  const globs: string[] = [];
  let inside = false;
  for (const line of text.split(/\r?\n/)) {
    if (!inside) {
      const m = /^packages\s*:(.*)$/.exec(line);
      if (m && m[1]!.replace(/(^|\s)#.*$/, "").trim() === "") inside = true;
      continue;
    }
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const item = /^\s*-\s*(.*)$/.exec(line);
    if (!item) break;
    const glob = yamlItem(item[1]!);
    if (glob !== "") globs.push(glob);
  }
  return globs;
}

function packageJsonGlobs(text: string): string[] {
  const json = parseJson(text);
  if (!isRecord(json)) return [];
  const w = json["workspaces"];
  const list = Array.isArray(w) ? w : isRecord(w) && Array.isArray(w["packages"]) ? w["packages"] : [];
  return list.filter((x): x is string => typeof x === "string");
}

const segmentRegex = (seg: string) =>
  new RegExp(`^${seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);

function matchSegments(pat: readonly string[], segs: readonly string[]): boolean {
  const [head, ...rest] = pat;
  if (head === undefined) return segs.length === 0;
  if (head === "**") {
    for (let i = 0; i <= segs.length; i++) if (matchSegments(rest, segs.slice(i))) return true;
    return false;
  }
  return segs.length > 0 && segmentRegex(head).test(segs[0]!) && matchSegments(rest, segs.slice(1));
}

const toSegments = (path: string) =>
  path
    .replace(/^\.\//, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter((s) => s !== "" && s !== ".");

/** Workspace packages: folders matched by a workspace glob whose `package.json` has a string `name`. */
export function workspacePackages(index: RepoIndex): readonly WorkspacePackage[] {
  const globs: string[] = [];
  for (const file of index.files) {
    if (file.path === "pnpm-workspace.yaml") globs.push(...pnpmGlobs(file.text));
    else if (file.path === "package.json") globs.push(...packageJsonGlobs(file.text));
  }
  const include = globs.filter((g) => !g.startsWith("!")).map(toSegments);
  const exclude = globs.filter((g) => g.startsWith("!")).map((g) => toSegments(g.slice(1)));
  const out: WorkspacePackage[] = [];
  for (const file of index.files) {
    if (basename(file.path) !== "package.json") continue;
    const dir = dirname(file.path);
    if (dir === "") continue;
    const segs = dir.split("/");
    if (!include.some((p) => matchSegments(p, segs))) continue;
    if (exclude.some((p) => matchSegments(p, segs))) continue;
    const json = parseJson(file.text);
    if (!isRecord(json) || typeof json["name"] !== "string") continue;
    out.push({ name: json["name"], dir });
  }
  return out.sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
}
