import { describe, expect, it } from "vitest";
import {
  designSystemPackages,
  isDesignSystemModule,
  type FileKind,
  type RepoIndex,
} from "../src/index.js";

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
