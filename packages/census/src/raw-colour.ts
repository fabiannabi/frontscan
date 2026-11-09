import type { CssDeclaration, Finding } from "@frontscan/core";

type Rgb = readonly [number, number, number];

interface Literal {
  readonly text: string;
  readonly rgb: Rgb;
}

interface Token {
  readonly name: string;
  readonly value: string;
  readonly rgb: Rgb;
}

const TOKEN_DIRS = new Set(["tokens", "theme", "themes"]);
const TOKEN_STEMS = new Set([
  "token",
  "tokens",
  "theme",
  "themes",
  "color",
  "colors",
  "colour",
  "colours",
  "palette",
  "variables",
  "vars",
]);

function isTokenFile(path: string): boolean {
  const segments = path.split("/");
  const base = segments.pop()!;
  if (segments.some((s) => TOKEN_DIRS.has(s.toLowerCase()))) return true;
  const dot = base.lastIndexOf(".");
  let stem = dot > 0 ? base.slice(0, dot) : base;
  if (stem.startsWith("_")) stem = stem.slice(1);
  return stem.split(/[.\-_]/).some((p) => TOKEN_STEMS.has(p.toLowerCase()));
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(%|deg|turn|rad|grad)?$/i;

function parseNumber(s: string): { n: number; unit: string } | undefined {
  const m = NUMBER.exec(s);
  if (!m) return undefined;
  const unit = (m[1] ?? "").toLowerCase();
  return { n: parseFloat(s), unit };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = clamp(s, 0, 1);
  const light = clamp(l, 0, 1);
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t0: number) => {
    const t = (t0 + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)];
}

function parseFunction(name: string, inner: string): Rgb | undefined {
  if (inner.includes("(")) return undefined;
  const trimmed = inner.trim();
  const args = (trimmed.includes(",") ? trimmed.split(",") : trimmed.split(/[\s/]+/))
    .map((a) => a.trim())
    .filter((a) => a !== "");
  if (args.length < 3 || args.length > 4) return undefined;
  const nums = args.map(parseNumber);
  if (nums.some((n) => n === undefined)) return undefined;
  const [a, b, c] = nums as { n: number; unit: string }[];
  if (name.startsWith("rgb")) {
    const ch = (v: { n: number; unit: string }) =>
      Math.round(clamp(v.unit === "%" ? v.n * 2.55 : v.n, 0, 255));
    return [ch(a!), ch(b!), ch(c!)];
  }
  const turns: Record<string, number> = { "": 1, deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9 };
  return hslToRgb(a!.n * (turns[a!.unit] ?? 1), b!.n / 100, c!.n / 100);
}

/** Index of the char after the `)` matching the `(` at `open`, or -1. */
function closeParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i + 1;
  }
  return -1;
}

/** Every hex / rgb / hsl literal in a value, outside `var(…)` and `url(…)`. */
function colourLiterals(value: string): Literal[] {
  const out: Literal[] = [];
  let i = 0;
  while (i < value.length) {
    const c = value[i]!;
    const prev = value[i - 1];
    const boundary = prev === undefined || /[\s,(/]/.test(prev);
    if (c === "#" && boundary) {
      const run = /^[0-9a-fA-F]+/.exec(value.slice(i + 1))?.[0] ?? "";
      const after = value[i + 1 + run.length];
      if ([3, 4, 6, 8].includes(run.length) && (after === undefined || !/[\w-]/.test(after))) {
        out.push({ text: `#${run}`, rgb: hexToRgb(run) });
      }
      i += 1 + run.length;
      continue;
    }
    if (prev === undefined || !/[\w-]/.test(prev)) {
      const fn = /^([A-Za-z]+)\(/.exec(value.slice(i));
      if (fn) {
        const name = fn[1]!.toLowerCase();
        const open = i + fn[0].length - 1;
        const end = closeParen(value, open);
        if (end === -1) break;
        if (name === "rgb" || name === "rgba" || name === "hsl" || name === "hsla") {
          const rgb = parseFunction(name, value.slice(open + 1, end - 1));
          if (rgb) out.push({ text: value.slice(i, end), rgb });
        } else if (name !== "var" && name !== "url") {
          // Other functions (gradients, calc…) may hold literals: scan inside them.
          i = open + 1;
          continue;
        }
        i = end;
        continue;
      }
    }
    i++;
  }
  return out;
}

function hexToRgb(hex: string): Rgb {
  const full = hex.length <= 4 ? [...hex].map((d) => d + d).join("") : hex;
  return [0, 2, 4].map((o) => parseInt(full.slice(o, o + 2), 16)) as unknown as Rgb;
}

function toLab([r, g, b]: Rgb): [number, number, number] {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)] as const;
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 ΔE between two sRGB colours (D65). */
function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const isCustomProperty = (d: CssDeclaration) => d.property.startsWith("--");

/** Colour literals written by hand outside token files, each with the nearest colour token. */
export function rawColour(declarations: readonly CssDeclaration[]): Finding[] {
  const tokens: Token[] = [];
  for (const d of declarations) {
    if (d.origin !== "stylesheet" || !isCustomProperty(d) || d.value === undefined) continue;
    const lits = colourLiterals(d.value);
    if (lits.length === 1 && lits[0]!.text === d.value) {
      tokens.push({ name: d.property, value: d.value, rgb: lits[0]!.rgb });
    }
  }

  const suggest = (rgb: Rgb): string => {
    if (tokens.length === 0) {
      return "Define a colour token (a `--*` custom property in a token file) and use it here.";
    }
    const ranked = tokens
      .map((t) => ({ t, de: deltaE(rgb, t.rgb) }))
      .sort((x, y) => x.de - y.de || compare(x.t.name, y.t.name) || compare(x.t.value, y.t.value));
    const { t, de } = ranked[0]!;
    if (t.rgb.every((v, i) => v === rgb[i])) return `Use \`var(${t.name})\` (same colour).`;
    return `Use the nearest token \`var(${t.name})\` (${t.value}, ΔE ${de.toFixed(1)}).`;
  };

  const out: Finding[] = [];
  for (const d of declarations) {
    if (d.value === undefined || isTokenFile(d.file)) continue;
    const lits = colourLiterals(d.value);
    if (isCustomProperty(d) && lits.length === 1 && lits[0]!.text === d.value) continue;
    for (const lit of lits) {
      out.push({
        lens: "census",
        rule: "raw-colour",
        area: "design-system",
        severity: "warning",
        message: `Raw colour \`${lit.text}\` in \`${d.property}\` bypasses the design tokens.`,
        file: d.file,
        line: d.line,
        column: d.column,
        suggestion: suggest(lit.rgb),
      });
    }
  }
  return out;
}
