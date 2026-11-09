# @frontscan/core

The scan every lens reads, and the contract they share. See `docs/architecture.md`.

## Planned

Each line is one ticket.

- [x] `contract` — `src/types.ts` from `docs/architecture.md`, verbatim, plus `defineLens` and `sortFindings` with tests
- [x] `scan` — walk a repo into a `RepoIndex`: honour `.gitignore`, skip `node_modules`/build output and binaries, POSIX paths, sorted, file kinds
- [ ] `jsx-index` — every JSX element with its name, props (literal values where static) and position, from the TypeScript parser
- [ ] `css-index` — every declaration (property, value, position) in CSS/SCSS files and in style objects
