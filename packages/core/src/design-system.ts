import { normalizeRepoPath } from "./tsconfig-paths.js";
import type { RepoIndex } from "./types.js";
import { workspacePackages, type WorkspacePackage } from "./workspace.js";

const KNOWN = new Set(["@mui/material", "@mui/joy", "@chakra-ui/react", "@mantine/core"]);
const SCOPED_UI = /^@[^/]+\/ui$/;
const UI_NAMES = new Set(["ui", "design-system", "designsystem", "components", "blueprint"]);
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies"] as const;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** Every dependency name declared in any `package.json` of the index. */
export function declaredDependencies(index: RepoIndex): ReadonlySet<string> {
  const names = new Set<string>();
  for (const file of index.files) {
    if (basename(file.path) !== "package.json") continue;
    const json = parseJson(file.text);
    if (!isRecord(json)) continue;
    for (const field of DEP_FIELDS) {
      const deps = json[field];
      if (isRecord(deps)) for (const name of Object.keys(deps)) names.add(name);
    }
  }
  return names;
}

/** The root config's `designSystem` list, if it is valid. */
function configEntries(index: RepoIndex): string[] | undefined {
  const config = index.files.find((f) => f.path === "frontscan.config.json");
  if (!config) return undefined;
  const json = parseJson(config.text);
  if (!isRecord(json)) return undefined;
  const list = json["designSystem"];
  return Array.isArray(list) && list.every((x) => typeof x === "string") ? (list as string[]) : undefined;
}

const isFolderEntry = (entry: string) => entry.startsWith("./");

/** Workspace packages that look like a design system: today's name rule, or a UI name with JSX inside. */
function workspaceCandidates(index: RepoIndex): WorkspacePackage[] {
  return workspacePackages(index).filter((pkg) => {
    if (KNOWN.has(pkg.name) || SCOPED_UI.test(pkg.name)) return true;
    const unscoped = pkg.name.slice(pkg.name.lastIndexOf("/") + 1);
    if (!UI_NAMES.has(unscoped) && !UI_NAMES.has(basename(pkg.dir))) return false;
    return index.files.some(
      (f) => (f.kind === "tsx" || f.kind === "jsx") && f.path.startsWith(`${pkg.dir}/`),
    );
  });
}

const sortedUnique = (list: Iterable<string>): string[] => [...new Set(list)].sort();

/** Module names and alias prefixes that count as the design system: the root config, else detection. */
export function designSystemPackages(index: RepoIndex): readonly string[] {
  const entries = configEntries(index);
  if (entries) return sortedUnique(entries.filter((e) => !isFolderEntry(e)));
  const names = [...declaredDependencies(index)].filter((name) => KNOWN.has(name) || SCOPED_UI.test(name));
  return sortedUnique([...names, ...workspaceCandidates(index).map((p) => p.name)]);
}

/** Repo-relative folders that count as the design system. */
export function designSystemFolders(index: RepoIndex): readonly string[] {
  const entries = configEntries(index);
  if (entries) {
    const workspaces = workspacePackages(index);
    const folders: string[] = [];
    for (const entry of entries) {
      if (isFolderEntry(entry)) {
        const dir = normalizeRepoPath(entry);
        if (dir) folders.push(dir);
      } else {
        for (const w of workspaces) if (w.name === entry) folders.push(w.dir);
      }
    }
    return sortedUnique(folders);
  }
  return sortedUnique(workspaceCandidates(index).map((p) => p.dir));
}

export function isDesignSystemModule(specifier: string, packages: readonly string[]): boolean {
  return packages.some((p) => specifier === p || specifier.startsWith(`${p}/`));
}
