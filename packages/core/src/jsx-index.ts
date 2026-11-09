import ts from "typescript";
import type { RepoIndex } from "./types.js";

export interface JsxProp {
  readonly name: string;
  readonly value?: string | number | boolean | null;
  readonly line: number;
  readonly column: number;
}

export interface JsxElement {
  readonly file: string;
  readonly name: string;
  readonly props: readonly JsxProp[];
  readonly hasSpread: boolean;
  readonly line: number;
  readonly column: number;
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

export function jsxIndex(index: RepoIndex): readonly JsxElement[] {
  const out: JsxElement[] = [];
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
        out.push({
          file: file.path,
          name: node.tagName.getText(sf),
          props,
          hasSpread,
          ...pos(node),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}
