import { describe, expect, it } from "vitest";
import { parseGitignore } from "../src/gitignore.js";

const ignored = (rules: string, p: string, isDir = false) => parseGitignore(rules).test(p, isDir);

describe("parseGitignore", () => {
  it("ignores comments and blank lines", () => {
    expect(ignored("# a.ts\n\n   \n", "a.ts")).toBeUndefined();
    expect(ignored("# c\na.ts\n", "a.ts")).toBe(true);
  });

  it("supports escaped # and !", () => {
    expect(ignored("\\#x", "#x")).toBe(true);
    expect(ignored("\\!x", "!x")).toBe(true);
    expect(ignored("\\!x", "x")).toBeUndefined();
  });

  it("supports *, ? and [a-z]", () => {
    expect(ignored("*.log", "a.log")).toBe(true);
    expect(ignored("*.log", "a/b.log")).toBe(true);
    expect(ignored("*.log", "a.txt")).toBeUndefined();
    expect(ignored("a?c", "abc")).toBe(true);
    expect(ignored("a?c", "a/c")).toBeUndefined();
    expect(ignored("[a-c].ts", "b.ts")).toBe(true);
    expect(ignored("[a-c].ts", "d.ts")).toBeUndefined();
    expect(ignored("[!a-c].ts", "d.ts")).toBe(true);
    expect(ignored("a*b", "a/b")).toBeUndefined();
  });

  it("supports **/x, a/**/b and x/**", () => {
    expect(ignored("**/x", "x")).toBe(true);
    expect(ignored("**/x", "a/b/x")).toBe(true);
    expect(ignored("a/**/b", "a/b")).toBe(true);
    expect(ignored("a/**/b", "a/x/y/b")).toBe(true);
    expect(ignored("a/**/b", "c/a/b")).toBeUndefined();
    expect(ignored("x/**", "x/a")).toBe(true);
    expect(ignored("x/**", "x/a/b")).toBe(true);
    expect(ignored("x/**", "x", true)).toBeUndefined();
  });

  it("anchors with a leading or middle slash, otherwise matches at any level", () => {
    expect(ignored("/a.txt", "a.txt")).toBe(true);
    expect(ignored("/a.txt", "sub/a.txt")).toBeUndefined();
    expect(ignored("doc/a.txt", "doc/a.txt")).toBe(true);
    expect(ignored("doc/a.txt", "x/doc/a.txt")).toBeUndefined();
    expect(ignored("a.txt", "x/y/a.txt")).toBe(true);
  });

  it("requires a directory for a trailing slash", () => {
    expect(ignored("gen/", "gen", true)).toBe(true);
    expect(ignored("gen/", "gen", false)).toBeUndefined();
    expect(ignored("gen/", "x/gen", true)).toBe(true);
  });

  it("supports negation and the last matching rule wins", () => {
    expect(ignored("*.log\n!keep.log", "keep.log")).toBe(false);
    expect(ignored("*.log\n!keep.log", "a.log")).toBe(true);
    expect(ignored("!keep.log\n*.log", "keep.log")).toBe(true);
  });

  it("handles CRLF and trailing spaces", () => {
    expect(ignored("a.ts\r\n", "a.ts")).toBe(true);
    expect(ignored("a.ts  \n", "a.ts")).toBe(true);
  });
});
