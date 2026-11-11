# @frontscan/census

Design system adoption: which components are used, where, with which props, and which values bypass the tokens.

## Planned rules

Each rule is one ticket: the rule, a fixture repo under `test/fixtures/<rule>/` with the
problem planted (and a clean case next to it), and a test that asserts the exact findings.

- [x] `component-usage` — every JSX component, how many times and in which files (info, feeds the report)
- [ ] `unused-component` — exported components nobody imports
- [x] `prop-usage` — which props each component is actually called with, and with which static values
- [ ] `unused-prop` — props a component declares that no call site passes
- [x] `raw-colour` — hex/rgb/hsl literals outside token files, with the nearest existing token
- [ ] `token-scale` — repeated colours and spacings clustered into a proposed token scale ("these 23 greys are 5")
- [ ] `near-duplicate-component` — components whose JSX and props overlap enough to be one
- [x] `adoption-score` — % of interactive UI that uses the design system, without tests, stories or the design system's own code

## How the adoption score is counted

`adoption-score` gives one repo-level `info` finding: design system interactive elements ÷ (those + plain HTML interactive elements), as an integer percent (`Math.round`). Example: `Design system adoption: 43% of interactive elements (30 of 70; 40 plain HTML).`

- **Plain HTML:** elements with origin `html` named exactly `button`, `a`, `input`, `select` or `textarea`.
- **Design system:** elements with origin `design-system` whose name, or its last segment after `.` (`Form.Input` → `Input`), equals or ends with `Button`, `Link`, `Anchor`, `Input`, `TextField`, `Select`, `Textarea`, `TextArea`, `Checkbox`, `Radio` or `Switch`. So `IconButton`, `NumericInput` and `HTMLSelect` count; `InputGroup` and `Text` do not.
- **Not counted:** local and external components, and every other tag.
- **Files left out:** `*.test.*`, `*.spec.*`, `*.stories.*` (`.js`, `.jsx`, `.ts`, `.tsx`), any `__tests__` folder, and everything under the folder of a non-root `package.json` named as the design system. A root `package.json` with that name leaves nothing out.
- **No design system found:** the message is `No design system found; set one in frontscan.config.json.` instead of a percentage.
- **No interactive elements:** the message is `Design system adoption: no interactive elements found.`

Known limits: aliased imports (`{ Button as B }`) are missed because the local name is used; a suffix can misclassify a component (a `Select` that is not a form control); local components that wrap design system ones are not credited.
