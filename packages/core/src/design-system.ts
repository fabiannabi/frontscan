import type { RepoIndex } from "./types.js";

const KNOWN = new Set(["@mui/material", "@mui/joy", "@chakra-ui/react", "@mantine/core"]);
const SCOPED_UI = /^@[^/]+\/ui$/;
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

/** Module names that count as the design system: the root config, else detection. */
export function designSystemPackages(index: RepoIndex): readonly string[] {
  const config = index.files.find((f) => f.path === "frontscan.config.json");
  if (config) {
    const json = parseJson(config.text);
    if (isRecord(json)) {
      const list = json["designSystem"];
      if (Array.isArray(list) && list.every((x) => typeof x === "string")) {
        return [...new Set(list as string[])].sort();
      }
    }
  }
  return [...declaredDependencies(index)]
    .filter((name) => KNOWN.has(name) || SCOPED_UI.test(name))
    .sort();
}

export function isDesignSystemModule(specifier: string, packages: readonly string[]): boolean {
  return packages.some((p) => specifier === p || specifier.startsWith(`${p}/`));
}
