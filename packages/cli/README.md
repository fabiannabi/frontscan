# frontscan (CLI)

Installed with `npx frontscan .`.

```bash
frontscan [path]                 # every lens, readable summary
frontscan --details              # every finding, one by one (alias: --all)
frontscan census|a11y|intl|agent-ready [path]
frontscan --html report.html      # one self-contained HTML file; links resolve when it sits at the repo root
frontscan --json                 # machine-readable, for CI and for Forge
frontscan --ci                   # exit 1 when there are errors
```

## Planned

- [x] `scan` — walk the repo once, honour .gitignore, build the RepoIndex (in @frontscan/core)
- [x] `terminal-report` — findings grouped by area, then file
- [x] `json-report` — the Finding[] contract, sorted with sortFindings
- [x] `summary-report` — overview, what to fix by rule, census tables; `--details` for every finding
- [x] `html-report` — `--html <file>`: a shareable HTML report with nothing cut
- [ ] `ci-mode` — exit codes and a baseline file so only new findings fail
- [ ] `tickets` — turn findings into Obsidian ticket notes for Forge's dev loop
