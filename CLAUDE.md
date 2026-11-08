# frontscan

An auditor for frontend repos. One scan of a repo, then four lenses read it:
**census** (design system adoption), **a11y**, **intl** and **agent-ready**. It reports;
it never changes the repo it scans.

Most of this code is written by coding agents through Forge's dev loop — one GitHub
issue, one branch, one pull request, reviewed by an agent and merged by a human. These
rules are for those agents first.

## Commands

| Command | What it does |
|---|---|
| `pnpm install --frozen-lockfile` | Install. The lockfile is the truth; never edit it by hand |
| `pnpm verify` | Typecheck (strict) and every test. **Must pass before you finish** |
| `pnpm test -- packages/intl` | One package's tests while you work |

Node 24, pnpm 11, TypeScript 6 (the JS compiler, whose API the scanner uses), Vitest.

## Layout

```
packages/
  core/         RepoIndex, Finding and Lens (src/types.ts), defineLens, sortFindings
                — the contract is specified in docs/architecture.md
  census/       design system adoption       — each README lists the planned rules
  a11y/         accessibility from source
  intl/         translation and right-to-left
  agent-ready/  readiness for coding agents
  cli/          the frontscan command
```

## How to add a rule (most tickets are this)

1. Read the package README; the rule's id is there.
2. Add a fixture under `packages/<lens>/test/fixtures/<rule-id>/`: a tiny repo with the
   problem planted **and** a clean file that must not be flagged.
3. Write the test first: it asserts the **exact** findings — rule, file, line, message —
   not just a count. No finding for the clean file.
4. Implement the rule in `packages/<lens>/src/`. Findings follow `Finding` in
   `packages/core/src/types.ts`; `suggestion` says the concrete fix.
5. Tick the rule in the package README.
6. `pnpm verify`.

## Rules

- **The contract is `docs/architecture.md`.** The `contract` ticket writes it into
  `packages/core/src/types.ts` verbatim; after that, do not change it. If a ticket seems
  to need a change, say so in your answer and stop.
- **No new runtime dependencies.** Parse TS/JSX with the `typescript` package, CSS with
  your own small scanner. A dev dependency needs a reason in the PR description.
- **Deterministic output.** Sort with `sortFindings`; no timestamps or absolute paths in
  findings (paths are repo-relative POSIX).
- **Never read outside the scanned root, never execute the scanned code, never use the
  network.** frontscan runs on other people's repos.
- **Small diffs.** One rule per pull request. Do not reformat files you did not change.
- Never push to `main`, never merge, never edit CI or this file in a ticket.
