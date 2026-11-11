# frontscan

**An auditor for frontend repos — and the agents that work in them.** Point it at a project and
it tells you, with the file, the line and the fix:

| Lens | What it checks | What it proposes | Status |
|---|---|---|---|
| **census** | Which components are used, where and with which props; colours and spacings that bypass the tokens; components that are near-copies | A token scale drawn from the values the repo already uses, and which components to merge | Available: `component-usage`, `prop-usage`, `raw-colour` |
| **a11y** | Images without alt, icon buttons without a name, inputs without labels, clickable divs | The exact attribute or element to change | Planned |
| **intl** | Hard-coded text, CSS that breaks right-to-left, sentences built by concatenation | The logical property, the message to extract | Planned |
| **agent-ready** | Agent instructions, one verify command, strict types, fast tests, CI | A score, and what to add first | Planned |
| **security** | What an injected or careless agent could leak, run or publish: missing unbreakable rules, permissive agent settings, committed secrets, scripts that print the environment, unpinned CI, agent containers holding keys | The rule, setting or config to add — each one reproduced from a real attack | Planned |

It reads the repo once, never runs its code and never touches the network.

Status: the `census` lens works today. The `frontscan` command gives a readable terminal
summary, `--details` for every finding and `--json` for tools. Planned and not yet available:
the other four lenses, an HTML report, `--ci` and an npm package.

## Built by agents, reviewed by a human

What was written by hand is the frame: this README, [`CLAUDE.md`](CLAUDE.md), the design in
[`docs/architecture.md`](docs/architecture.md), the workspace and CI. **Every line of code —
starting with the contract itself — comes from [Forge](https://fabiannabi.github.io/forge/)'s
dev loop.** No human wrote the code, and a human reviewed and merged every pull request. The
loop:

1. A Planner agent writes the ticket as an Obsidian note.
2. The plan goes back and forth with the maintainer on the GitHub issue until it is approved.
3. An Implementer works in a throwaway container, whose only way out is the model API, until
   `pnpm verify` passes.
4. A Reviewer comments on the PR.
5. A human merges, or doesn't.
6. A Retro agent proposes lessons, which the maintainer approves.

Approved lessons change how later tickets are done. For example, tests here now assert exact
output objects with `toEqual` rather than counts.

Each ticket's cost is measured and logged, so the claim "agents built this" comes with what
it took.

### Ticket log

| Issue | Ticket | Pull request | Plan rounds | Review rounds | Agent cost | Merged |
|---|---|---|---|---|---|---|
| [#1](https://github.com/fabiannabi/frontscan/issues/1) | Core contract: types, `defineLens`, `sortFindings` | [#2](https://github.com/fabiannabi/frontscan/pull/2) | 1 | 1 | $0.83 | yes |
| [#3](https://github.com/fabiannabi/frontscan/issues/3) | Scan a repo into a `RepoIndex` | [#4](https://github.com/fabiannabi/frontscan/pull/4) | 1 | 1 | $1.17 | yes |
| [#5](https://github.com/fabiannabi/frontscan/issues/5) | `jsxIndex`: every JSX element | [#6](https://github.com/fabiannabi/frontscan/pull/6) | 0 | 1 | $0.87 | yes |
| [#7](https://github.com/fabiannabi/frontscan/issues/7) | `cssIndex`: every CSS declaration | [#8](https://github.com/fabiannabi/frontscan/pull/8) | 0 | 2 | $1.25 | yes |
| [#9](https://github.com/fabiannabi/frontscan/issues/9) | census `component-usage` | [#10](https://github.com/fabiannabi/frontscan/pull/10) | 0 | 1 | $0.82 | yes |
| [#11](https://github.com/fabiannabi/frontscan/issues/11) | census `prop-usage` | [#12](https://github.com/fabiannabi/frontscan/pull/12) | 0 | 1 | $0.90 | yes |
| [#13](https://github.com/fabiannabi/frontscan/issues/13) | census `raw-colour` | [#14](https://github.com/fabiannabi/frontscan/pull/14) | 0 | 1 | $1.12 | yes |
| [#15](https://github.com/fabiannabi/frontscan/issues/15) | The `frontscan` command: terminal and JSON reports | [#16](https://github.com/fabiannabi/frontscan/pull/16) | 0 | 1 | $0.99 | yes |
| [#17](https://github.com/fabiannabi/frontscan/issues/17) | A terminal report a human can read | [#18](https://github.com/fabiannabi/frontscan/pull/18) | 0 | 2 | $1.68 | yes |

9 tickets, 9 merged, $9.63 in total (~$1.07 per ticket). Every Implementer passed
`pnpm verify` on its first attempt, and none needed the maintainer to request changes.

"Agent cost" covers the whole ticket: plan, issue, code, review and retrospective.

## Use it

### Install

```bash
npx frontscan .
```

Releases: 0.1.0 published by hand; later versions from a `frontscan-vX.Y.Z` tag through npm trusted publishing with provenance, each approved by the maintainer.

From a clone (for contributors):

```bash
pnpm install
pnpm -s frontscan path/to/repo            # readable summary
pnpm -s frontscan path/to/repo --details  # every finding
pnpm -s frontscan path/to/repo --json     # for CI and tools
```

A run against Cal.com (6,211 files in 2.8 s), trimmed:

```
calcom  ·  6211 files  ·  2.8s

area           errors  warnings  info
design-system       0       177  5446

To fix

census/raw-colour · warning · 177
  apps/web/components/AddToHomescreen.tsx:18  Raw colour `#2F333D` in `background` bypasses the design tokens.
      → Use the nearest token `var(--cal-bg-brand-emphasis)` (hsla(220, 6%, 25%, 1), ΔE 5.8).
  … and 176 more

Components

component     uses  files
Button         478    228
SkeletonText   182     46
Badge          127     59

Props

Button (478 uses)
  prop       uses  top values
  color       342  "secondary" (173), "minimal" (82), "primary" (64), dynamic (7)
```

To work on it: `pnpm verify` typechecks and runs every test.

## License

MIT
