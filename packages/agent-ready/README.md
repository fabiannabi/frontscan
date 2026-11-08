# @frontscan/agent-ready

How ready a repo is for coding agents to work in it safely, as a score with the fixes in order of impact.

## Planned rules

Each rule is one ticket: the rule, a fixture repo under `test/fixtures/<rule>/` with the
problem planted (and a clean case next to it), and a test that asserts the exact findings.

- [ ] `agent-instructions` — CLAUDE.md or AGENTS.md exists and says how to verify a change
- [ ] `verify-script` — one command that typechecks, lints and tests
- [ ] `strict-typescript` — strict mode on, no blanket any
- [ ] `fast-tests` — a test command that runs without a browser or network
- [ ] `ci` — a workflow that runs the verify command on pull requests
- [ ] `lockfile` — a committed lockfile and a pinned package manager
