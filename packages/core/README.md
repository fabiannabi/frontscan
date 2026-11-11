# @frontscan/core

The scan every lens reads, and the contract they share. See `docs/architecture.md`.

## Planned

Each line is one ticket.

- [x] `contract` — `src/types.ts` from `docs/architecture.md`, verbatim, plus `defineLens` and `sortFindings` with tests
- [x] `scan` — walk a repo into a `RepoIndex`: honour `.gitignore`, skip `node_modules`/build output and binaries, POSIX paths, sorted, file kinds
- [x] `jsx-index` — every JSX element with its name, props (literal values where static) and position, from the TypeScript parser
- [x] `css-index` — every declaration (property, value, position) in CSS/SCSS files and in style objects
- [x] `ds-origin` — each JSX element's origin (design-system / local / external / html) from imports, design-system packages from frontscan.config.json or package.json
