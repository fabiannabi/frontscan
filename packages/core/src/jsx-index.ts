import ts from "typescript";
import {
  declaredDependencies,
  designSystemFolders,
  designSystemPackages,
  isDesignSystemModule,
} from "./design-system.js";
import { createImportResolver } from "./tsconfig-paths.js";
import { workspacePackages } from "./workspace.js";
import type { RepoIndex } from "./types.js";

export interface JsxProp {
  readonly name: string;
  readonly value?: string | number | boolean | null;
  readonly line: number;
  readonly column: number;
}

export type JsxOrigin = "design-system" | "local" | "external" | "html";

export interface JsxElement {
  readonly file: string;
  readonly name: string;
  readonly props: readonly JsxProp[];
  readonly hasSpread: boolean;
  readonly line: number;
  readonly column: number;
  readonly origin: JsxOrigin;
  readonly source?: string;
}

type StaticValue = string | number | boolean | null;

function staticValue(attr: ts.JsxAttribute): { value: StaticValue } | undefined {
  const init = attr.initializer;
  if (init === undefined) return { value: true };
  if (ts.isStringLiteral(init)) return { value: init.text };
  if (!ts.isJsxExpression(init) || init.expression === undefined) return undefined;
  const e = init.expression;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return { value: e.text };
  if (ts.isNumericLiteral(e)) return { value: Number(e.text) };
  if (
    ts.isPrefixUnaryExpression(e) &&
    e.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(e.operand)
  ) {
    return { value: -Number(e.operand.text) };
  }
  if (e.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (e.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (e.kind === ts.SyntaxKind.NullKeyword) return { value: null };
  return undefined;
}

/** `@scope/name` or `name` from an import specifier. */
function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

const isBare = (specifier: string) =>
  !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("@/");

/** Local names bound by the file's value imports, mapped to their specifier. */
function importsOf(sf: ts.SourceFile): Map<string, string> {
  const imports = new Map<string, string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const clause = st.importClause;
    if (clause === undefined || clause.isTypeOnly) continue;
    const spec = st.moduleSpecifier.text;
    if (clause.name) imports.set(clause.name.text, spec);
    const nb = clause.namedBindings;
    if (nb === undefined) continue;
    if (ts.isNamespaceImport(nb)) imports.set(nb.name.text, spec);
    else for (const el of nb.elements) if (!el.isTypeOnly) imports.set(el.name.text, spec);
  }
  return imports;
}

export function jsxIndex(index: RepoIndex): readonly JsxElement[] {
  const out: JsxElement[] = [];
  const dsPackages = designSystemPackages(index);
  const dependencies = declaredDependencies(index);
  const dsFolders = designSystemFolders(index);
  const workspaces = workspacePackages(index);
  const workspaceNames = new Set(workspaces.map((w) => w.name));
  const resolveImport = createImportResolver(index, new Set([...dependencies, ...workspaceNames]));
  const within = (path: string, dir: string) => path === dir || path.startsWith(`${dir}/`);
  for (const file of index.files) {
    if (file.kind !== "tsx" && file.kind !== "jsx") continue;
    const sf = ts.createSourceFile(
      file.path,
      file.text,
      ts.ScriptTarget.Latest,
      true,
      file.kind === "tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.JSX,
    );
    const pos = (node: ts.Node) => {
      const p = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      return { line: p.line + 1, column: p.character + 1 };
    };
    const imports = importsOf(sf);
    const classify = (tag: string): { origin: JsxOrigin; source?: string } => {
      const root = tag.split(/[.:]/)[0] ?? tag;
      const source = imports.get(root);
      if (source !== undefined) {
        if (isDesignSystemModule(source, dsPackages)) return { origin: "design-system", source };
        const resolved = resolveImport(file.path, source);
        if (resolved !== undefined) {
          const foreign = (dir: string) => within(resolved, dir) && !within(file.path, dir);
          if (dsFolders.some(foreign)) return { origin: "design-system", source };
          if (workspaces.some((w) => foreign(w.dir))) return { origin: "external", source };
        }
        const pkg = packageName(source);
        if (isBare(source) && (dependencies.has(pkg) || workspaceNames.has(pkg))) {
          return { origin: "external", source };
        }
        return { origin: "local", source };
      }
      return { origin: /^[A-Z]/.test(root) ? "local" : "html" };
    };
    const visit = (node: ts.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const props: JsxProp[] = [];
        let hasSpread = false;
        for (const attr of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attr)) {
            hasSpread = true;
            continue;
          }
          const sv = staticValue(attr);
          props.push({
            name: attr.name.getText(sf),
            ...(sv ? { value: sv.value } : {}),
            ...pos(attr.name),
          });
        }
        const name = node.tagName.getText(sf);
        out.push({
          file: file.path,
          name,
          props,
          hasSpread,
          ...pos(node),
          ...classify(name),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}
