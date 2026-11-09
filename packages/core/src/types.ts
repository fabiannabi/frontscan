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
