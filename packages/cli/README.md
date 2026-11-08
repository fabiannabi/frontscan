# frontscan (CLI)

```bash
frontscan [path]                 # every lens, terminal report
frontscan census|a11y|intl|agent-ready [path]
frontscan --json                 # machine-readable, for CI and for Forge
frontscan --ci                   # exit 1 when there are errors
```

## Planned

- [ ] `scan` — walk the repo once, honour .gitignore, build the RepoIndex (in @frontscan/core)
- [ ] `terminal-report` — findings grouped by area, then file
- [ ] `json-report` — the Finding[] contract, sorted with sortFindings
- [ ] `ci-mode` — exit codes and a baseline file so only new findings fail
- [ ] `tickets` — turn findings into Obsidian ticket notes for Forge's dev loop
