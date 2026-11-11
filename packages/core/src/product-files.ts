import { parseGitignore } from "./gitignore.js";
import type { IgnoreMatcher } from "./gitignore.js";
import type { RepoIndex } from "./types.js";

/** Gitignore-style patterns for files that are not part of the product's UI. */
export const DEFAULT_NON_PRODUCT: readonly string[] = [
  "*.test.*",
  "*.spec.*",
  "*.stories.*",
  "__tests__/",
  "__mocks__/",
  "__fixtures__/",
  "test/",
  "tests/",
  "fixtures/",
  "e2e/",
  ".storybook/",
];

export interface ProductOptions {
  /** Keep every file: turns the filter off. */
  allFiles: boolean;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A string-array key of the root config; anything else counts as absent. */
function configList(config: unknown, key: string): string[] {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return [];
  const list = (config as Record<string, unknown>)[key];
  return Array.isArray(list) && list.every((x) => typeof x === "string") ? (list as string[]) : [];
}

/** True when the path, or any ancestor directory, matches. */
function matches(matcher: IgnoreMatcher, path: string): boolean {
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    if (matcher.test(parts.slice(0, i).join("/"), true) === true) return true;
  }
  return matcher.test(path, false) === true;
}

/**
 * Splits an index into the product files and a count of the files left out: the defaults and the
 * root `frontscan.config.json` `ignore` list leave files out, `include` brings them back.
 */
export function productIndex(
  index: RepoIndex,
  options: ProductOptions,
): { index: RepoIndex; excluded: number } {
  if (options.allFiles) return { index: { root: index.root, files: index.files }, excluded: 0 };
  const config = index.files.find((f) => f.path === "frontscan.config.json");
  const json = config ? parseJson(config.text) : undefined;
  const ignore = parseGitignore([...DEFAULT_NON_PRODUCT, ...configList(json, "ignore")].join("\n"));
  const include = parseGitignore(configList(json, "include").join("\n"));
  const files = index.files.filter((f) => !(matches(ignore, f.path) && !matches(include, f.path)));
  return { index: { root: index.root, files }, excluded: index.files.length - files.length };
}
