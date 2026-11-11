import ts from "typescript";
import type { RepoIndex } from "./types.js";

/** Repo-relative POSIX path with `.`/`..` collapsed; `undefined` when it escapes the root. */
export function normalizeRepoPath(path: string): string | undefined {
  const out: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (out.pop() === undefined) return undefined;
    } else out.push(seg);
  }
  return out.join("/");
}

const dirname = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const join = (dir: string, rel: string) => normalizeRepoPath(dir === "" ? rel : `${dir}/${rel}`);
const isRelative = (s: string) => s === "." || s === ".." || s.startsWith("./") || s.startsWith("../");

interface PathEntry {
  readonly key: string;
  readonly targets: readonly string[];
  readonly declDir: string;
}

interface RawConfig {
  baseUrl?: string;
  paths?: readonly PathEntry[];
  references?: readonly string[];
}

interface Applied {
  readonly baseUrl: string | undefined;
  readonly entries: readonly { key: string; target: string; base: string }[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Resolves import specifiers to repo-relative paths from tsconfig `paths`, without executing anything. */
export function createImportResolver(
  index: RepoIndex,
  knownPackages: ReadonlySet<string>,
): (fromFile: string, specifier: string) => string | undefined {
  const texts = new Map(index.files.map((f) => [f.path, f.text]));

  const jsonOf = (path: string): Record<string, unknown> | undefined => {
    const text = texts.get(path);
    if (text === undefined) return undefined;
    const { config } = ts.parseConfigFileTextToJson(path, text);
    return isRecord(config) ? config : undefined;
  };

  const load = (path: string, stack: ReadonlySet<string>): RawConfig => {
    if (stack.has(path)) return {};
    const json = jsonOf(path);
    if (json === undefined) return {};
    const next = new Set(stack).add(path);
    const dir = dirname(path);
    const result: RawConfig = {};
    const ext = json["extends"];
    const list = typeof ext === "string" ? [ext] : Array.isArray(ext) ? ext : [];
    for (const e of list) {
      if (typeof e !== "string" || !isRelative(e)) continue;
      const target = join(dir, e.endsWith(".json") ? e : `${e}.json`);
      if (target === undefined) continue;
      const parent = load(target, next);
      if (parent.baseUrl !== undefined) result.baseUrl = parent.baseUrl;
      if (parent.paths !== undefined) result.paths = parent.paths;
    }
    const options = json["compilerOptions"];
    if (isRecord(options)) {
      if (typeof options["baseUrl"] === "string") {
        const base = join(dir, options["baseUrl"]);
        if (base !== undefined) result.baseUrl = base;
      }
      const paths = options["paths"];
      if (isRecord(paths)) {
        result.paths = Object.entries(paths).flatMap(([key, targets]) =>
          Array.isArray(targets) && typeof targets[0] === "string"
            ? [{ key, targets: targets as string[], declDir: dir }]
            : [],
        );
      }
    }
    const refs = json["references"];
    if (Array.isArray(refs)) {
      result.references = refs.flatMap((r) => {
        if (!isRecord(r) || typeof r["path"] !== "string") return [];
        const p = join(dir, r["path"]);
        if (p === undefined) return [];
        return [r["path"].endsWith(".json") ? p : p === "" ? "tsconfig.json" : `${p}/tsconfig.json`];
      });
    }
    return result;
  };

  const apply = (cfg: RawConfig): { baseUrl: string | undefined; entries: Applied["entries"] } => ({
    baseUrl: cfg.baseUrl,
    entries: (cfg.paths ?? []).map((p) => ({
      key: p.key,
      target: p.targets[0]!,
      base: cfg.baseUrl ?? p.declDir,
    })),
  });

  const cache = new Map<string, Applied | undefined>();
  const configFor = (fromFile: string): Applied | undefined => {
    let dir = dirname(fromFile);
    for (;;) {
      const path = dir === "" ? "tsconfig.json" : `${dir}/tsconfig.json`;
      if (texts.has(path)) {
        if (!cache.has(path)) {
          const cfg = load(path, new Set());
          let applied: Applied = apply(cfg);
          if (cfg.paths === undefined && cfg.references !== undefined) {
            const entries = [...applied.entries];
            let baseUrl = applied.baseUrl;
            for (const ref of cfg.references) {
              const a = apply(load(ref, new Set([path])));
              baseUrl ??= a.baseUrl;
              for (const e of a.entries) if (!entries.some((x) => x.key === e.key)) entries.push(e);
            }
            applied = { baseUrl, entries };
          }
          cache.set(path, applied);
        }
        return cache.get(path);
      }
      if (dir === "") return undefined;
      dir = dirname(dir);
    }
  };

  const packageName = (s: string) =>
    s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : (s.split("/")[0] ?? s);

  return (fromFile, specifier) => {
    if (isRelative(specifier)) return join(dirname(fromFile), specifier);
    if (specifier.startsWith("/")) return undefined;
    const cfg = configFor(fromFile);
    if (cfg === undefined) return undefined;
    const exact = cfg.entries.find((e) => e.key === specifier);
    if (exact !== undefined) return join(exact.base, exact.target);
    let best: { prefix: number; rest: string; e: Applied["entries"][number] } | undefined;
    for (const e of cfg.entries) {
      const star = e.key.indexOf("*");
      if (star === -1) continue;
      const prefix = e.key.slice(0, star);
      const suffix = e.key.slice(star + 1);
      if (
        specifier.length >= prefix.length + suffix.length &&
        specifier.startsWith(prefix) &&
        specifier.endsWith(suffix) &&
        (best === undefined || prefix.length > best.prefix)
      ) {
        best = { prefix: prefix.length, rest: specifier.slice(prefix.length, specifier.length - suffix.length), e };
      }
    }
    if (best !== undefined) return join(best.e.base, best.e.target.replace("*", best.rest));
    if (cfg.baseUrl !== undefined && !knownPackages.has(packageName(specifier))) {
      return join(cfg.baseUrl, specifier);
    }
    return undefined;
  };
}
