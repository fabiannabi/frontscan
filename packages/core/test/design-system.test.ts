import { describe, expect, it } from "vitest";
import {
  designSystemFolders,
  designSystemPackages,
  isDesignSystemModule,
  jsxIndex,
  workspacePackages,
  type FileKind,
  type RepoIndex,
} from "../src/index.js";
import { createImportResolver } from "../src/tsconfig-paths.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});
const pkg = (deps: Record<string, string>, path = "package.json"): [string, FileKind, string] => [
  path,
  "json",
  JSON.stringify({ dependencies: deps }),
];
const config = (text: string): [string, FileKind, string] => ["frontscan.config.json", "json", text];

describe("designSystemPackages", () => {
  it("config wins over detection", () => {
    expect(
      designSystemPackages(repo(config('{"designSystem":["@acme/ui"],"other":1}'), pkg({ "@mui/material": "^6" }))),
    ).toEqual(["@acme/ui"]);
  });

  it("an empty config list turns detection off", () => {
    expect(designSystemPackages(repo(config('{"designSystem":[]}'), pkg({ "@mui/material": "^6" })))).toEqual([]);
  });

  it("ignores a config that is not at the root", () => {
    const index = repo(["packages/app/frontscan.config.json", "json", '{"designSystem":[]}'], pkg({ "@mui/joy": "1" }));
    expect(designSystemPackages(index)).toEqual(["@mui/joy"]);
  });

  it.each(["{nope", '{"designSystem":"@acme/ui"}', '{"designSystem":["a",1]}', "[]", "null"])(
    "invalid config %s falls back to detection",
    (text) => {
      expect(designSystemPackages(repo(config(text), pkg({ "@mui/material": "^6" })))).toEqual(["@mui/material"]);
    },
  );

  it("detects, sorts and de-duplicates", () => {
    expect(
      designSystemPackages(repo(pkg({ "@mui/material": "^6", "@acme/ui": "workspace:*", react: "^19" }))),
    ).toEqual(["@acme/ui", "@mui/material"]);
  });

  it("reads every package.json and all three dependency fields", () => {
    const index = repo(
      ["package.json", "json", JSON.stringify({ devDependencies: { "@mantine/core": "7" }, dependencies: { "@acme/ui": "1" } })],
      ["packages/app/package.json", "json", JSON.stringify({ peerDependencies: { "@chakra-ui/react": "3", "@acme/ui": "1" } })],
    );
    expect(designSystemPackages(index)).toEqual(["@acme/ui", "@chakra-ui/react", "@mantine/core"]);
  });

  it("detects the known packages and scoped ui only", () => {
    const known = { "@mui/material": "1", "@mui/joy": "1", "@chakra-ui/react": "1", "@mantine/core": "1", "@corp/ui": "1" };
    expect(designSystemPackages(repo(pkg(known)))).toEqual([
      "@chakra-ui/react",
      "@corp/ui",
      "@mantine/core",
      "@mui/joy",
      "@mui/material",
    ]);
    expect(designSystemPackages(repo(pkg({ "@mui/icons-material": "1", react: "1", ui: "1" })))).toEqual([]);
  });

  it("does not throw on invalid package.json", () => {
    expect(designSystemPackages(repo(["package.json", "json", "{"]))).toEqual([]);
  });
});

describe("isDesignSystemModule", () => {
  it("matches the exact name and subpaths only", () => {
    expect(isDesignSystemModule("@mui/material", ["@mui/material"])).toBe(true);
    expect(isDesignSystemModule("@mui/material/Button", ["@mui/material"])).toBe(true);
    expect(isDesignSystemModule("@mui/materials", ["@mui/material"])).toBe(false);
    expect(isDesignSystemModule("@mui/material", [])).toBe(false);
  });
});

const json = (path: string, value: unknown): [string, FileKind, string] => [path, "json", JSON.stringify(value)];
const named = (path: string, name: unknown): [string, FileKind, string] => json(path, { name });
const jsx = (path: string): [string, FileKind, string] => [path, "tsx", "export const A = () => <div />;"];

describe("workspacePackages", () => {
  it("reads pnpm-workspace.yaml with quotes, comments and negation, sorted by dir", () => {
    const yaml = ["# top", "packages:", "  - 'packages/*' # all", '  - "apps/**"', "  - '!apps/old'", "", "other:", "  - x/*"].join("\n");
    expect(
      workspacePackages(
        repo(
          ["pnpm-workspace.yaml", "other", yaml],
          named("packages/b/package.json", "b"),
          named("apps/web/deep/package.json", "web"),
          named("apps/old/package.json", "old"),
          named("x/y/package.json", "y"),
        ),
      ),
    ).toEqual([
      { name: "web", dir: "apps/web/deep" },
      { name: "b", dir: "packages/b" },
    ]);
  });

  it("reads workspaces as an array and as { packages }", () => {
    const pkgs = [named("a/one/package.json", "one"), named("b/two/package.json", "two")];
    expect(workspacePackages(repo(json("package.json", { workspaces: ["b/*"] }), ...pkgs))).toEqual([
      { name: "two", dir: "b/two" },
    ]);
    expect(
      workspacePackages(repo(json("package.json", { workspaces: { packages: ["a/*", "b/*"] } }), ...pkgs)),
    ).toEqual([
      { name: "one", dir: "a/one" },
      { name: "two", dir: "b/two" },
    ]);
  });

  it("skips folders without a string name and ignores flow-style yaml", () => {
    const yaml: [string, FileKind, string] = ["pnpm-workspace.yaml", "other", "packages:\n  - p/*\n"];
    expect(
      workspacePackages(
        repo(yaml, named("p/a/package.json", 1), json("p/b/package.json", {}), ["p/c/package.json", "json", "{"], named("p/d/package.json", "d")),
      ),
    ).toEqual([{ name: "d", dir: "p/d" }]);
    expect(
      workspacePackages(repo(["pnpm-workspace.yaml", "other", "packages: [p/*]"], named("p/d/package.json", "d"))),
    ).toEqual([]);
  });
});

describe("design system detection in workspaces", () => {
  const ws: [string, FileKind, string] = ["pnpm-workspace.yaml", "other", "packages:\n  - packages/*\n"];
  it("accepts UI names with JSX and rejects the rest", () => {
    const index = repo(
      ws,
      named("packages/ui/package.json", "shared"), jsx("packages/ui/Button.tsx"),
      named("packages/kit/package.json", "@acme/design-system"), jsx("packages/kit/a.tsx"),
      named("packages/utils/package.json", "utils"), jsx("packages/utils/a.tsx"),
      named("packages/docs/package.json", "@acme/uikit-docs"), jsx("packages/docs/a.tsx"),
      named("packages/components/package.json", "pure"),
    );
    expect(designSystemPackages(index)).toEqual(["@acme/design-system", "shared"]);
    expect(designSystemFolders(index)).toEqual(["packages/kit", "packages/ui"]);
  });

  it("config folders are normalised and config names map to workspace dirs", () => {
    const index = repo(
      ws,
      ["frontscan.config.json", "json", '{"designSystem":["./packages/ui/","@acme/x","react"]}'],
      named("packages/x/package.json", "@acme/x"),
    );
    expect(designSystemFolders(index)).toEqual(["packages/ui", "packages/x"]);
    expect(designSystemPackages(index)).toEqual(["@acme/x", "react"]);
  });
});

describe("tsconfig resolution", () => {
  const resolve = (index: RepoIndex, from: string, spec: string) =>
    createImportResolver(index, new Set(["react"]))(from, spec);
  const tsconfig = (path: string, value: unknown) => json(path, value);

  it("follows extends as a string, child paths replace the parent's", () => {
    const index = repo(
      tsconfig("tsconfig.json", { extends: "./base", compilerOptions: { paths: { "@b/*": ["lib/*"] } } }),
      tsconfig("base.json", { compilerOptions: { paths: { "@a/*": ["x/*"] } } }),
    );
    expect(resolve(index, "src/a.ts", "@b/q")).toBe("lib/q");
    expect(resolve(index, "src/a.ts", "@a/q")).toBeUndefined();
  });

  it("follows extends as an array, later entries winning", () => {
    const index = repo(
      tsconfig("tsconfig.json", { extends: ["./one.json", "./two.json"] }),
      tsconfig("one.json", { compilerOptions: { baseUrl: "one", paths: { "@/*": ["a/*"] } } }),
      tsconfig("two.json", { compilerOptions: { paths: { "@/*": ["b/*"] } } }),
    );
    expect(resolve(index, "a.ts", "@/z")).toBe("one/b/z");
  });

  it("resolves bare imports through baseUrl only, except known packages", () => {
    const index = repo(tsconfig("tsconfig.json", { compilerOptions: { baseUrl: "src" } }));
    expect(resolve(index, "src/a.ts", "components/Card")).toBe("src/components/Card");
    expect(resolve(index, "src/a.ts", "react/jsx-runtime")).toBeUndefined();
  });

  it("prefers an exact key, then the longest wildcard prefix, using the first target", () => {
    const index = repo(
      tsconfig("tsconfig.json", {
        compilerOptions: { paths: { "@a/*": ["w/*"], "@a/b/*": ["long/*", "other/*"], "@a/b/c": ["exact"] } },
      }),
    );
    expect(resolve(index, "a.ts", "@a/b/c")).toBe("exact");
    expect(resolve(index, "a.ts", "@a/b/d")).toBe("long/d");
    expect(resolve(index, "a.ts", "@a/z")).toBe("w/z");
  });

  it("uses the nearest tsconfig, and falls back to references in order, first wins", () => {
    const index = repo(
      tsconfig("tsconfig.json", { references: [{ path: "./a" }, { path: "./b/tsconfig.json" }] }),
      tsconfig("a/tsconfig.json", { compilerOptions: { paths: { "@k": ["from-a"] } } }),
      tsconfig("b/tsconfig.json", { compilerOptions: { paths: { "@k": ["from-b"], "@m": ["m"] } } }),
      tsconfig("pkg/tsconfig.json", { compilerOptions: { paths: { "@k": ["near"] } } }),
    );
    expect(resolve(index, "src/x.ts", "@k")).toBe("a/from-a");
    expect(resolve(index, "src/x.ts", "@m")).toBe("b/m");
    expect(resolve(index, "pkg/x.ts", "@k")).toBe("pkg/near");
  });

  it("resolves relative imports and refuses to leave the root", () => {
    const index = repo();
    expect(resolve(index, "a/b/c.ts", "../d/./e")).toBe("a/d/e");
    expect(resolve(index, "a.ts", "../x")).toBeUndefined();
    expect(resolve(index, "a.ts", "/abs")).toBeUndefined();
    expect(
      resolve(repo(tsconfig("tsconfig.json", { compilerOptions: { paths: { "@/*": ["../../*"] } } })), "a.ts", "@/x"),
    ).toBeUndefined();
  });

  it("ignores invalid JSON, cycles, escaping and package extends without throwing", () => {
    const code: [string, FileKind, string] = ["a.tsx", "tsx", 'import { B } from "@/b";\nconst x = <B />;'];
    const local = [
      { file: "a.tsx", name: "B", props: [], hasSpread: false, line: 2, column: 11, origin: "local", source: "@/b" },
    ];
    for (const cfgs of [
      [["tsconfig.json", "json", "{nope"] as [string, FileKind, string]],
      [tsconfig("tsconfig.json", { extends: "./a" }), tsconfig("a.json", { extends: "./tsconfig" })],
      [tsconfig("tsconfig.json", { extends: "../../x.json" })],
      [tsconfig("tsconfig.json", { extends: "@tsconfig/strictest/tsconfig.json" })],
    ]) {
      expect(jsxIndex(repo(code, ...cfgs))).toEqual(local);
    }
  });
});
