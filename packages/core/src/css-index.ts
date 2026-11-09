import ts from "typescript";
import type { RepoIndex } from "./types.js";

export interface CssDeclaration {
  readonly file: string;
  readonly property: string;
  readonly value?: string;
  readonly important: boolean;
  readonly line: number;
  readonly column: number;
  readonly origin: "stylesheet" | "style-prop";
}

const isSpace = (c: string | undefined) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";

/** Index of the char after the closing quote, or -1 when unterminated. */
function skipString(text: string, start: number): number {
  const q = text[start];
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === q) return i + 1;
  }
  return -1;
}

/** Collapses whitespace runs outside quotes into one space. */
function collapse(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '"' || c === "'") {
      const end = skipString(s, i);
      const stop = end === -1 ? s.length : end;
      out += s.slice(i, stop);
      i = stop;
    } else if (isSpace(c)) {
      while (i < s.length && isSpace(s[i])) i++;
      out += " ";
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Offset of the first `:` outside parentheses and strings, or -1. */
function topLevelColon(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"' || c === "'") {
      const end = skipString(s, i);
      if (end === -1) return -1;
      i = end - 1;
    } else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ":" && depth === 0) return i;
  }
  return -1;
}

function scanStylesheet(file: string, text: string, scss: boolean): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  const position = (offset: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - lineStarts[lo]! + 1 };
  };

  let buf = "";
  let start = -1;
  let depth = 0;
  let parens = 0;

  const append = (chunk: string, at: number) => {
    if (start < 0 && chunk.trim() !== "") start = at + (chunk.length - chunk.trimStart().length);
    buf += chunk;
  };
  const reset = () => {
    buf = "";
    start = -1;
  };
  const emit = () => {
    const stmt = buf.trim();
    const at = start;
    reset();
    if (depth === 0 || stmt === "" || stmt[0] === "@" || stmt[0] === "$") return;
    const colon = topLevelColon(stmt);
    if (colon <= 0) return;
    const rawProp = stmt.slice(0, colon).trim();
    if (!/^[A-Za-z_-][\w-]*$/.test(rawProp)) return;
    const property = rawProp.startsWith("--") ? rawProp : rawProp.toLowerCase();
    let value = stmt.slice(colon + 1);
    const imp = /\s*!\s*important\s*$/i.exec(value);
    if (imp) value = value.slice(0, imp.index);
    value = collapse(value.trim());
    out.push({
      file,
      property,
      ...(value === "" ? {} : { value }),
      important: imp !== null,
      ...position(at),
      origin: "stylesheet",
    });
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    const next = text[i + 1];
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1) return out;
      buf += " ";
      i = end + 2;
    } else if (scss && parens === 0 && c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (c === '"' || c === "'") {
      const end = skipString(text, i);
      if (end === -1) return out;
      append(text.slice(i, end), i);
      i = end;
    } else if (c === "#" && next === "{") {
      let level = 0;
      let j = i + 1;
      for (; j < text.length; j++) {
        if (text[j] === "{") level++;
        else if (text[j] === "}" && --level === 0) break;
      }
      if (j >= text.length) return out;
      append(text.slice(i, j + 1), i);
      i = j + 1;
    } else if (c === "(") {
      parens++;
      append(c, i);
      i++;
    } else if (c === ")") {
      parens = Math.max(0, parens - 1);
      append(c, i);
      i++;
    } else if (parens > 0) {
      append(c, i);
      i++;
    } else if (c === "{") {
      reset();
      depth++;
      i++;
    } else if (c === ";") {
      emit();
      i++;
    } else if (c === "}") {
      emit();
      depth = Math.max(0, depth - 1);
      i++;
    } else {
      append(c, i);
      i++;
    }
  }
  return out;
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isStringLiteral(name)) return name.text;
  if (!ts.isIdentifier(name)) return undefined;
  const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  const vendor = /^(Webkit|Moz|O|ms)(?=[A-Z])/.exec(name.text);
  if (vendor) return `-${vendor[1]!.toLowerCase()}${kebab(name.text.slice(vendor[1]!.length))}`;
  return kebab(name.text);
}

function styleValue(e: ts.Expression): string | undefined {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isNumericLiteral(e)) return String(Number(e.text));
  if (
    ts.isPrefixUnaryExpression(e) &&
    e.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(e.operand)
  ) {
    return String(-Number(e.operand.text));
  }
  return undefined;
}

function scanStyleProps(file: string, text: string, kind: "tsx" | "jsx"): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind === "tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.JSX,
  );
  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "style" &&
      node.initializer !== undefined &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression !== undefined &&
      ts.isObjectLiteralExpression(node.initializer.expression)
    ) {
      for (const prop of node.initializer.expression.properties) {
        let nameNode: ts.PropertyName | undefined;
        let value: string | undefined;
        if (ts.isPropertyAssignment(prop)) {
          nameNode = prop.name;
          value = styleValue(prop.initializer);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          nameNode = prop.name;
        }
        if (nameNode === undefined) continue;
        const property = propertyName(nameNode);
        if (property === undefined) continue;
        const p = sf.getLineAndCharacterOfPosition(nameNode.getStart(sf));
        out.push({
          file,
          property,
          ...(value === undefined ? {} : { value }),
          important: false,
          line: p.line + 1,
          column: p.character + 1,
          origin: "style-prop",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export function cssIndex(index: RepoIndex): readonly CssDeclaration[] {
  const out: CssDeclaration[] = [];
  for (const file of index.files) {
    if (file.kind === "css" || file.kind === "scss") {
      out.push(...scanStylesheet(file.path, file.text, file.kind === "scss"));
    } else if (file.kind === "tsx" || file.kind === "jsx") {
      out.push(...scanStyleProps(file.path, file.text, file.kind));
    }
  }
  return out;
}
