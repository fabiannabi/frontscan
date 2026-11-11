import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  designSystemFolders,
  designSystemPackages,
  jsxIndex,
  scan,
  type FileKind,
  type RepoIndex,
} from "../src/index.js";

const repo = (...files: [string, FileKind, string][]): RepoIndex => ({
  root: "/r",
  files: files.map(([path, kind, text]) => ({ path, kind, text })),
});

const tsx = (text: string) => jsxIndex(repo(["a.tsx", "tsx", text]));
const propsOf = (src: string) => tsx(`const x = <C ${src} />;`)[0]!.props;

describe("jsxIndex", () => {
  it("indexes the reference example exactly", () => {
    const text = [
      "export function App(props: Props) {",
      "  return (",
      '    <Card title="Hi" {...props}>',
      '      <Button variant="primary" size={2} disabled onClick={go} />',
      "    </Card>",
      "  );",
      "}",
    ].join("\n");
    expect(jsxIndex(repo(["src/App.tsx", "tsx", text]))).toEqual([
      {
        file: "src/App.tsx", name: "Card", hasSpread: true, line: 3, column: 5, origin: "local",
        props: [{ name: "title", value: "Hi", line: 3, column: 11 }],
      },
      {
        file: "src/App.tsx", name: "Button", hasSpread: false, line: 4, column: 7, origin: "local",
        props: [
          { name: "variant", value: "primary", line: 4, column: 15 },
          { name: "size", value: 2, line: 4, column: 33 },
          { name: "disabled", value: true, line: 4, column: 42 },
          { name: "onClick", line: 4, column: 51 },
        ],
      },
    ]);
  });

  describe("static values", () => {
    const cases: [string, string | number | boolean | null][] = [
      ['v="primary"', "primary"],
      ["v='primary'", "primary"],
      ['v={"primary"}', "primary"],
      ["v={`primary`}", "primary"],
      ["v={4}", 4],
      ["v={-4}", -4],
      ["v={1.5}", 1.5],
      ["v", true],
      ["v={true}", true],
      ["v={false}", false],
      ["v={null}", null],
    ];
    it.each(cases)("%s", (src, value) => {
      expect(propsOf(src)).toEqual([{ name: "v", value, line: 1, column: 14 }]);
    });

    it.each(["v={undefined}", "v={y}", "v={{a:1}}", "v={`a${b}`}", "v={<Icon />}", "v={() => 1}"])(
      "%s is absent",
      (src) => {
        const [p] = propsOf(src);
        expect(p).toEqual({ name: "v", line: 1, column: 14 });
        expect("value" in p!).toBe(false);
      },
    );
  });

  it("keeps names as written", () => {
    expect(
      tsx(
        "const x = <div><Menu.Item /><svg:rect xlink:href=\"a\" aria-label=\"b\" /><List<Item> items={x} /></div>;",
      ),
    ).toEqual([
      { file: "a.tsx", name: "div", props: [], hasSpread: false, line: 1, column: 11, origin: "html" },
      { file: "a.tsx", name: "Menu.Item", props: [], hasSpread: false, line: 1, column: 16, origin: "local" },
      {
        file: "a.tsx", name: "svg:rect", hasSpread: false, line: 1, column: 29, origin: "html",
        props: [
          { name: "xlink:href", value: "a", line: 1, column: 39 },
          { name: "aria-label", value: "b", line: 1, column: 54 },
        ],
      },
      {
        file: "a.tsx", name: "List", hasSpread: false, line: 1, column: 71, origin: "local",
        props: [{ name: "items", line: 1, column: 83 }],
      },
    ]);
  });

  it("skips fragments but indexes their children and React.Fragment", () => {
    expect(tsx("const x = <><A /></>;")).toEqual([
      { file: "a.tsx", name: "A", props: [], hasSpread: false, line: 1, column: 13, origin: "local" },
    ]);
    expect(tsx("const x = <React.Fragment><A /></React.Fragment>;")).toEqual([
      { file: "a.tsx", name: "React.Fragment", props: [], hasSpread: false, line: 1, column: 11, origin: "local" },
      { file: "a.tsx", name: "A", props: [], hasSpread: false, line: 1, column: 27, origin: "local" },
    ]);
  });

  it("orders parents before children and files in index order", () => {
    const out = jsxIndex(
      repo(
        ["b.tsx", "tsx", "const x = <A><B /></A>;"],
        ["a.tsx", "tsx", "const x = <C />;"],
      ),
    );
    expect(out).toEqual([
      { file: "b.tsx", name: "A", props: [], hasSpread: false, line: 1, column: 11, origin: "local" },
      { file: "b.tsx", name: "B", props: [], hasSpread: false, line: 1, column: 14, origin: "local" },
      { file: "a.tsx", name: "C", props: [], hasSpread: false, line: 1, column: 11, origin: "local" },
    ]);
  });

  describe("origin", () => {
    const pkg = (deps: Record<string, string>) => [
      "package.json",
      "json",
      JSON.stringify({ dependencies: deps }),
    ] as [string, FileKind, string];
    const ds = (...extra: [string, FileKind, string][]) => [
      ["frontscan.config.json", "json", '{"designSystem":["@acme/ui"]}'] as [string, FileKind, string],
      pkg({ "react-router": "^7", "framer-motion": "^11" }),
      ...extra,
    ];
    const one = (text: string, ...extra: [string, FileKind, string][]) =>
      jsxIndex(repo(...ds(["a.tsx", "tsx", text], ...extra)));
    const base = { file: "a.tsx", props: [], hasSpread: false };

    it.each([
      ['import { Button } from "@acme/ui";\nconst x = <Button/>;', "Button"],
      ['import Button from "@acme/ui/Button";\nconst x = <Button/>;', "Button"],
      ['import { Button as B } from "@acme/ui";\nconst x = <B/>;', "B"],
    ])("design system import: %s", (text, name) => {
      const source = text.includes("/Button") ? "@acme/ui/Button" : "@acme/ui";
      expect(one(text)).toEqual([{ ...base, name, line: 2, column: 11, origin: "design-system", source }]);
    });

    it("design system namespace import", () => {
      expect(one('import * as UI from "@acme/ui";\nconst x = <UI.Button/>;')).toEqual([
        { ...base, name: "UI.Button", line: 2, column: 11, origin: "design-system", source: "@acme/ui" },
      ]);
    });

    it("local relative and alias imports", () => {
      expect(
        one('import { Card } from "./Card";\nimport { Tile } from "@/components/Tile";\nconst x = <Card><Tile/></Card>;'),
      ).toEqual([
        { ...base, name: "Card", line: 3, column: 11, origin: "local", source: "./Card" },
        { ...base, name: "Tile", line: 3, column: 17, origin: "local", source: "@/components/Tile" },
      ]);
    });

    it("external import from a dependency", () => {
      expect(one('import { Link } from "react-router";\nconst x = <Link/>;')).toEqual([
        { ...base, name: "Link", line: 2, column: 11, origin: "external", source: "react-router" },
      ]);
    });

    it("imported lowercase root follows its import", () => {
      expect(one('import { motion } from "framer-motion";\nconst x = <motion.div/>;')).toEqual([
        { ...base, name: "motion.div", line: 2, column: 11, origin: "external", source: "framer-motion" },
      ]);
    });

    it("declared or unknown capitalised names are local without a source", () => {
      expect(one("function Card() { return null; }\nconst x = <Card/>;")).toEqual([
        { ...base, name: "Card", line: 2, column: 11, origin: "local" },
      ]);
      expect(one("const x = <Global/>;")).toEqual([
        { ...base, name: "Global", line: 1, column: 11, origin: "local" },
      ]);
    });

    it("html tags that are not imported", () => {
      expect(one("const x = <div><svg:rect/><my-element/></div>;")).toEqual([
        { ...base, name: "div", line: 1, column: 11, origin: "html" },
        { ...base, name: "svg:rect", line: 1, column: 16, origin: "html" },
        { ...base, name: "my-element", line: 1, column: 27, origin: "html" },
      ]);
    });

    it("ignores type-only imports", () => {
      expect(one('import type { Button } from "@acme/ui";\nconst x = <Button/>;')).toEqual([
        { ...base, name: "Button", line: 2, column: 11, origin: "local" },
      ]);
    });

    it("ignores require and dynamic import", () => {
      expect(
        one('const Button = require("@acme/ui");\nconst Card = import("@acme/ui");\nconst x = <Button><Card/></Button>;'),
      ).toEqual([
        { ...base, name: "Button", line: 3, column: 11, origin: "local" },
        { ...base, name: "Card", line: 3, column: 19, origin: "local" },
      ]);
    });

    it("ignores an inline type import but keeps the value import", () => {
      expect(
        one('import { type Button, Card } from "@acme/ui";\nconst x = <Button><Card/></Button>;'),
      ).toEqual([
        { ...base, name: "Button", line: 2, column: 11, origin: "local" },
        { ...base, name: "Card", line: 2, column: 19, origin: "design-system", source: "@acme/ui" },
      ]);
    });

    it("bare import of a package that is not a dependency is local", () => {
      expect(one('import { Card } from "components/Card";\nconst x = <Card/>;')).toEqual([
        { ...base, name: "Card", line: 2, column: 11, origin: "local", source: "components/Card" },
      ]);
    });

    it("has no design-system origin without config or detection", () => {
      const out = jsxIndex(
        repo(["a.tsx", "tsx", 'import { Button } from "@acme/ui";\nconst x = <Button/>;']),
      );
      expect(out).toEqual([
        { ...base, name: "Button", line: 2, column: 11, origin: "local", source: "@acme/ui" },
      ]);
    });
  });

  it("parses jsx files", () => {
    expect(jsxIndex(repo(["a.jsx", "jsx", "const x = <div id=\"a\" />;"]))).toEqual([
      {
        file: "a.jsx", name: "div", hasSpread: false, line: 1, column: 11, origin: "html",
        props: [{ name: "id", value: "a", line: 1, column: 16 }],
      },
    ]);
  });

  it("ignores other kinds", () => {
    expect(jsxIndex(repo(["a.ts", "ts", "const x = <div>;"], ["a.css", "css", "<div>"]))).toEqual([]);
    expect(jsxIndex(repo())).toEqual([]);
  });

  it("does not throw on broken files and is deterministic", () => {
    const index = repo(["a.tsx", "tsx", "const x = <div><span></div>;"]);
    expect(() => jsxIndex(index)).not.toThrow();
    expect(jsxIndex(index)).toEqual([
      { file: "a.tsx", name: "div", props: [], hasSpread: false, line: 1, column: 11, origin: "html" },
      { file: "a.tsx", name: "span", props: [], hasSpread: false, line: 1, column: 16, origin: "html" },
    ]);
    expect(jsxIndex(index)).toEqual(jsxIndex(index));
  });
});

describe("jsxIndex design system through aliases", () => {
  const fixture = (name: string) =>
    scan(fileURLToPath(new URL(`./fixtures/ds-aliases/${name}`, import.meta.url)));

  it("blueprint-site: tsconfig alias, references, extends and relative imports", async () => {
    const index = await fixture("blueprint-site");
    expect(designSystemPackages(index)).toEqual(["@fabiannabi/blueprint"]);
    expect(designSystemFolders(index)).toEqual(["packages/blueprint"]);
    const app = jsxIndex(index).filter((e) => e.file === "src/App.tsx");
    expect(app).toEqual([
      { file: "src/App.tsx", name: "Card", props: [], hasSpread: false, line: 6, column: 3, origin: "local", source: "@/components/Card" },
      {
        file: "src/App.tsx", name: "Label", hasSpread: false, line: 7, column: 5, origin: "design-system",
        source: "@fabiannabi/blueprint/components/Label/Label",
        props: [{ name: "htmlFor", value: "q", line: 7, column: 12 }],
      },
      {
        file: "src/App.tsx", name: "Text", props: [], hasSpread: false, line: 8, column: 5, origin: "design-system",
        source: "@fabiannabi/blueprint/components/Text/Text",
      },
      {
        file: "src/App.tsx", name: "Button", props: [], hasSpread: false, line: 9, column: 5, origin: "design-system",
        source: "../packages/blueprint/src/components/Button/Button",
      },
    ]);
    expect(jsxIndex(index).filter((e) => e.file.endsWith("Button.tsx"))).toEqual([
      {
        file: "packages/blueprint/src/components/Button/Button.tsx", name: "Text", props: [], hasSpread: false,
        line: 2, column: 29, origin: "local", source: "../Text/Text",
      },
    ]);
  });

  it("calcom: workspace packages, declared or not, and relative imports into the design system", async () => {
    const index = await fixture("calcom");
    expect(designSystemPackages(index)).toEqual(["@calcom/ui"]);
    expect(designSystemFolders(index)).toEqual(["packages/ui"]);
    const file = "apps/web/pages/index.tsx";
    expect(jsxIndex(index).filter((e) => e.file === file)).toEqual([
      { file, name: "Shell", props: [], hasSpread: false, line: 7, column: 5, origin: "local", source: "../components/Shell" },
      { file, name: "Logo", props: [], hasSpread: false, line: 8, column: 7, origin: "external", source: "@calcom/lib/Logo" },
      {
        file, name: "Button", hasSpread: false, line: 9, column: 7, origin: "design-system",
        source: "@calcom/ui/components/button",
        props: [{ name: "color", value: "primary", line: 9, column: 15 }],
      },
      {
        file, name: "Dialog", props: [], hasSpread: false, line: 10, column: 7, origin: "design-system",
        source: "../../../packages/ui/components/dialog",
      },
    ]);
  });

  it("config folders and alias prefixes", () => {
    const folder = repo(
      ["frontscan.config.json", "json", '{"designSystem":["./packages/ui"]}'],
      ["apps/a/x.tsx", "tsx", 'import { B } from "../../packages/ui/src/B";\nconst x = <B />;'],
    );
    expect(designSystemPackages(folder)).toEqual([]);
    expect(jsxIndex(folder)).toEqual([
      { file: "apps/a/x.tsx", name: "B", props: [], hasSpread: false, line: 2, column: 11, origin: "design-system", source: "../../packages/ui/src/B" },
    ]);
    const alias = repo(
      ["frontscan.config.json", "json", '{"designSystem":["@/components/ui"]}'],
      ["x.tsx", "tsx", 'import { X } from "@/components/ui/x";\nconst x = <X />;'],
    );
    expect(jsxIndex(alias)).toEqual([
      { file: "x.tsx", name: "X", props: [], hasSpread: false, line: 2, column: 11, origin: "design-system", source: "@/components/ui/x" },
    ]);
  });
});
