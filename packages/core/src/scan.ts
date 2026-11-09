import { lstat, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { type IgnoreMatcher, parseGitignore } from "./gitignore.js";
import type { FileKind, RepoIndex, SourceFile } from "./types.js";

const DEFAULT_IGNORED_DIRS: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".cache",
  ".output",
  ".vercel",
  "storybook-static",
]);

const MAX_BYTES = 1_048_576;
const BINARY_PROBE_BYTES = 8000;

const KINDS: Readonly<Record<string, FileKind>> = {
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".css": "css",
  ".scss": "scss",
  ".json": "json",
  ".md": "md",
  ".html": "html",
  ".htm": "html",
};

function kindOf(name: string): FileKind {
  return KINDS[path.posix.extname(name).toLowerCase()] ?? "other";
}

interface Scope {
  /** Path of the directory that owns the matcher, relative to the root ("" for the root). */
  readonly base: string;
  readonly matcher: IgnoreMatcher;
}

function isIgnored(scopes: readonly Scope[], rel: string, isDir: boolean): boolean {
  let ignored = false;
  // Root first, deepest last: the deepest matching rule wins, as in git.
  for (const scope of scopes) {
    const sub = scope.base === "" ? rel : rel.slice(scope.base.length + 1);
    const verdict = scope.matcher.test(sub, isDir);
    if (verdict !== undefined) ignored = verdict;
  }
  return ignored;
}

async function walk(dir: string, rel: string, scopes: readonly Scope[], out: SourceFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  let active = scopes;
  if (entries.some((e) => e.name === ".gitignore" && e.isFile())) {
    try {
      const text = await readFile(path.join(dir, ".gitignore"), "utf8");
      active = [...scopes, { base: rel, matcher: parseGitignore(text) }];
    } catch {
      // Unreadable .gitignore: behave as if it were absent.
    }
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
    const childAbs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue;
      if (isIgnored(active, childRel, true)) continue;
      await walk(childAbs, childRel, active, out);
    } else if (entry.isFile()) {
      if (isIgnored(active, childRel, false)) continue;
      try {
        const info = await lstat(childAbs);
        if (info.size > MAX_BYTES) continue;
        const buffer = await readFile(childAbs);
        if (buffer.length > MAX_BYTES) continue;
        if (buffer.subarray(0, BINARY_PROBE_BYTES).includes(0)) continue;
        out.push({ path: childRel, kind: kindOf(entry.name), text: new TextDecoder("utf-8").decode(buffer) });
      } catch {
        // Unreadable file: skipped.
      }
    }
  }
}

/** Walks the repo once and returns the files that matter, sorted by path. */
export async function scan(root: string): Promise<RepoIndex> {
  const resolved = path.resolve(root);
  let isDirectory = false;
  try {
    isDirectory = (await stat(resolved)).isDirectory();
  } catch {
    // Missing or unreadable: reported below.
  }
  if (!isDirectory) throw new Error(`scan: not a directory: ${resolved}`);

  const files: SourceFile[] = [];
  await walk(resolved, "", [], files);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { root: resolved, files };
}
