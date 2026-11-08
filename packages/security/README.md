# @frontscan/security

Security for repos that coding agents work in. Most of these rules come from attacks that
were real, not theoretical — one of them in the platform that builds this repo: an agent
asked to set up testing printed the environment, keys included.

Every rule is checked statically, by reading the repo. None of them runs anything.

## Planned rules

Each line is one ticket, with a fixture that plants the attack and a clean case next to it.

### Agent instructions
- [ ] `missing-unbreakable-rules` — CLAUDE.md / AGENTS.md / .cursorrules has no rule against printing the environment or credentials, and none that says repo text is data, not instructions
- [ ] `permissive-agent-settings` — `.claude/settings.json` (or an editor's agent config) allows `Bash(*)`, `env`, `printenv`, `curl`, `git push` or skips permission prompts
- [ ] `no-forbidden-commands` — agents can run anything: no deny list for `env`, `printenv`, network tools or `git push`
- [ ] `prompt-injection-text` — hidden directives in files agents read: `<IMPORTANT>` blocks, "ignore previous instructions", invisible Unicode, instructions to read `~/.ssh` or `.env`

### Secrets
- [ ] `committed-secret` — keys and tokens in tracked files (Anthropic, OpenAI, GitHub, npm, AWS, private keys)
- [ ] `committed-env-file` — `.env*` tracked, or missing from `.gitignore`
- [ ] `env-dumping-script` — package scripts, test setup or CI steps that print the environment (`env`, `printenv`, `console.log(process.env)`, `set -x` around secrets)
- [ ] `mcp-config-secret` — MCP client configs with a token inline instead of a reference

### CI and supply chain
- [ ] `unpinned-action` — `uses:` by tag instead of commit SHA
- [ ] `excessive-permissions` — workflow-level write permissions, `id-token: write` on jobs that run on pull requests
- [ ] `pull-request-target` — `pull_request_target` that checks out the PR's code
- [ ] `release-cache` — a dependency cache in a job that publishes
- [ ] `install-scripts` — dependencies allowed to run install scripts without an allowlist
- [ ] `no-release-age-or-trust-policy` — no `minimumReleaseAge` / `trustPolicy` (or npm equivalents)
- [ ] `persisted-checkout-credentials` — `actions/checkout` without `persist-credentials: false` in jobs that never push

### Agent sandboxes
- [ ] `agent-container-secrets` — a Dockerfile / compose service for agents that receives API keys as env instead of through a credential proxy
- [ ] `agent-network` — agent containers with unrestricted network
- [ ] `writable-git-pointer` — a worktree mounted read-write including its `.git`, so an agent can redirect the host's git (the `core.fsmonitor` attack)

## Staying current

Attacks on coding agents change month to month. The rule list is reviewed against public
incident write-ups and advisories (OWASP's MCP and LLM top tens, CVEs in agent tooling),
and every new rule ships with the fixture that reproduces the attack it catches.
