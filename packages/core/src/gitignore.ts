/** A parsed `.gitignore`: a subset of git's pattern language, enough for the scan. */
export interface IgnoreMatcher {
  /**
   * Decides a path relative to the directory of the `.gitignore`, POSIX, no leading `./`.
   * `true` = ignored, `false` = re-included by `!`, `undefined` = no rule matched.
   * The last matching rule wins.
   */
  test(path: string, isDir: boolean): boolean | undefined;
}

interface Rule {
  readonly regex: RegExp;
  readonly negate: boolean;
  readonly dirOnly: boolean;
}

function escapeRegex(char: string): string {
  return char.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
}

/** One path segment (no `/`) to a regex source. */
function segmentToRegex(segment: string): string {
  let out = "";
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i] as string;
    if (c === "\\") {
      i++;
      out += i < segment.length ? escapeRegex(segment[i] as string) : "\\\\";
    } else if (c === "*") {
      out += "[^/]*";
    } else if (c === "?") {
      out += "[^/]";
    } else if (c === "[") {
      let j = i + 1;
      if (segment[j] === "!" || segment[j] === "^") j++;
      if (segment[j] === "]") j++;
      while (j < segment.length && segment[j] !== "]") j++;
      if (j >= segment.length) {
        out += "\\[";
      } else {
        let body = segment.slice(i + 1, j);
        let negated = false;
        if (body[0] === "!" || body[0] === "^") {
          negated = true;
          body = body.slice(1);
        }
        out += `[${negated ? "^" : ""}${body.replace(/[\\^]/g, "\\$&")}]`;
        i = j;
      }
    } else {
      out += escapeRegex(c);
    }
  }
  return out;
}

function parseRule(rawLine: string): Rule | undefined {
  let line = rawLine.replace(/\r$/, "");
  // Trailing spaces are dropped unless escaped.
  line = line.replace(/(?<!\\) +$/, "");
  if (line === "" || line.startsWith("#")) return undefined;

  let negate = false;
  if (line.startsWith("!")) {
    negate = true;
    line = line.slice(1);
  }

  let dirOnly = false;
  if (line.endsWith("/")) {
    dirOnly = true;
    line = line.slice(0, -1);
  }
  if (line === "") return undefined;

  const anchored = line.includes("/");
  if (line.startsWith("/")) line = line.slice(1);

  const segments = line.split("/");
  const last = segments.length - 1;
  let body = "";
  segments.forEach((segment, i) => {
    if (segment === "**") {
      if (i === last) body += i === 0 ? ".*" : ".+";
      else body += "(?:.*/)?";
    } else {
      body += segmentToRegex(segment);
      if (i < last) body += "/";
    }
  });

  const regex = new RegExp(`^${anchored ? "" : "(?:.*/)?"}${body}$`);
  return { regex, negate, dirOnly };
}

/** Turns the text of a `.gitignore` into a matcher. */
export function parseGitignore(text: string): IgnoreMatcher {
  const rules: Rule[] = [];
  for (const line of text.split("\n")) {
    const rule = parseRule(line);
    if (rule) rules.push(rule);
  }
  return {
    test(path, isDir) {
      for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i] as Rule;
        if (rule.dirOnly && !isDir) continue;
        if (rule.regex.test(path)) return !rule.negate;
      }
      return undefined;
    },
  };
}
