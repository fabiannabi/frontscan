# Architecture

frontscan reads a repo **once** into a `RepoIndex`, then hands it to every lens. A lens is
a pure function from the index to `Finding[]`: it never reads the disk itself, never runs
the scanned code and never touches the network. That is what makes it safe to point at
someone else's repo, and what lets a new lens be one package and one ticket.

```
scan(root) ──► RepoIndex ──┬──► census       ──┐
                           ├──► a11y          ├──► sortFindings ──► terminal · JSON · CI
                           ├──► intl          │
                           ├──► agent-ready   │
                           └──► security     ──┘
```

## The contract

This is the design every ticket builds against. The first ticket turns it into
`packages/core/src/types.ts`, verbatim; after that it changes only in a pull request of its
own, decided by a human.

```ts
/**
 * The contract every lens is written against. Changing it is an architecture
 * decision, made by a human in its own pull request — not inside a ticket.
 */

/** The five things frontscan audits. */
export type Area = "design-system" | "a11y" | "intl" | "agent-ready" | "security";

export type Severity = "error" | "warning" | "info";

/** One problem, at one place, with what to do about it. */
export interface Finding {
  /** The lens that produced it, e.g. "intl". */
  readonly lens: string;
  /** A stable rule id inside the lens, kebab-case, e.g. "physical-css-property". */
  readonly rule: string;
  readonly area: Area;
  readonly severity: Severity;
  /** What is wrong, in one sentence. */
  readonly message: string;
  /** Repo-relative POSIX path. Absent for findings about the repo as a whole. */
  readonly file?: string;
  /** 1-based. */
  readonly line?: number;
  /** 1-based. */
  readonly column?: number;
  /** The concrete fix, when there is one. */
  readonly suggestion?: string;
}

export type FileKind = "ts" | "tsx" | "js" | "jsx" | "css" | "scss" | "json" | "md" | "html" | "other";

export interface SourceFile {
  /** Repo-relative POSIX path. */
  readonly path: string;
  readonly kind: FileKind;
  readonly text: string;
}

/**
 * What one scan of a repo produces, shared by every lens so the repo is read once.
 * Lenses must treat it as read-only.
 */
export interface RepoIndex {
  /** Absolute path of the scanned repo. */
  readonly root: string;
  /** Every file the scan kept (`.gitignore` and the default ignores applied), sorted by path. */
  readonly files: readonly SourceFile[];
}

export interface Lens {
  /** kebab-case, unique, e.g. "census". */
  readonly id: string;
  readonly area: Area;
  /** One line, for reports. */
  readonly title: string;
  run(index: RepoIndex): readonly Finding[] | Promise<readonly Finding[]>;
}
```

## Two helpers in `@frontscan/core`

- `defineLens(lens)` — returns the lens; throws if its id is not kebab-case.
- `sortFindings(findings)` — a new array ordered by file, line, column, severity
  (error → warning → info), then rule; findings without a file first. Every report uses
  it, so two runs over the same commit produce byte-identical output.

## Decisions

- **TypeScript 6** (the JS compiler) parses TS/JSX: its API is stable and it is the one
  dependency the scanner needs. TypeScript 7 is the Go port and does not expose it the same way.
- **No runtime dependencies beyond it.** CSS is read by a small scanner of our own.
- **Node 24.** Its `@types/node` depends on `undici-types` 7, which is published with
  provenance; the Node 22 line depends on 6.x, which is not, and the workspace's
  `trustPolicy: no-downgrade` refuses it.
