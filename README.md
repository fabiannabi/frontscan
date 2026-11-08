# frontscan

**An auditor for frontend repos.** Point it at a project and it tells you, with the file,
the line and the fix:

| Lens | What it checks | What it proposes |
|---|---|---|
| **census** | Which components are used, where and with which props; colours and spacings that bypass the tokens; components that are near-copies | A token scale drawn from the values the repo already uses, and which components to merge |
| **a11y** | Images without alt, icon buttons without a name, inputs without labels, clickable divs | The exact attribute or element to change |
| **intl** | Hard-coded text, CSS that breaks right-to-left, sentences built by concatenation | The logical property, the message to extract |
| **agent-ready** | Agent instructions, one verify command, strict types, fast tests, CI | A score, and what to add first |

It reads the repo once, never runs its code and never touches the network.

> Status: **no code yet, on purpose.** The repo has its structure, its rules for agents and
> its design; every line of code will come from tickets — see below.

## Built by agents, reviewed by a human

What was written by hand is the frame: this README, [`CLAUDE.md`](CLAUDE.md), the design in
[`docs/architecture.md`](docs/architecture.md), the workspace and CI. **Every line of code —
starting with the contract itself — comes from [Forge](https://fabiannabi.github.io/forge/)'s
dev loop:**

1. a planning note becomes a GitHub issue, drafted by an Advisor agent;
2. an Implementer agent works on its own branch in a throwaway container whose only way
   out is the model API, until `pnpm verify` passes;
3. a Reviewer agent comments on the pull request;
4. a human reads it and merges — or doesn't.

Each ticket's cost is measured and logged, so the claim "agents built this" comes with what
it took.

### Ticket log

| Issue | Rule | Pull request | Review rounds | Agent cost | Merged |
|---|---|---|---|---|---|
| — | *the first tickets are being written* | | | | |

## Use it

Not published yet. From a clone:

```bash
pnpm install
pnpm verify
```

## License

MIT
