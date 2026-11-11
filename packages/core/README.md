# @frontscan/core

The scan every lens reads, and the contract they share. See `docs/architecture.md`.

## Planned

Each line is one ticket.

- [x] `contract` — `src/types.ts` from `docs/architecture.md`, verbatim, plus `defineLens` and `sortFindings` with tests
- [x] `scan` — walk a repo into a `RepoIndex`: honour `.gitignore`, skip `node_modules`/build output and binaries, POSIX paths, sorted, file kinds
- [x] `jsx-index` — every JSX element with its name, props (literal values where static) and position, from the TypeScript parser
- [x] `css-index` — every declaration (property, value, position) in CSS/SCSS files and in style objects
- [x] `ds-origin` — each JSX element's origin (design-system / local / external / html) from imports, design-system packages from frontscan.config.json or package.json
- [x] `ds-aliases` — design system through workspace packages, tsconfig paths/extends/references and relative imports; config accepts folders and aliases
- [x] `product-files` — `productIndex` leaves tests and fixtures out of the product index; defaults: `*.test.*`, `*.spec.*`, `*.stories.*`, `__tests__/`, `__mocks__/`, `__fixtures__/`, `test/`, `tests/`, `fixtures/`, `e2e/`, `.storybook/` (gitignore syntax, relative to the scanned root; directory patterns match at any depth). The root `frontscan.config.json` can add paths with `"ignore": [...]` and bring paths back with `"include": [...]` (wins over the defaults and `ignore`); a key that is not an array of strings is ignored
