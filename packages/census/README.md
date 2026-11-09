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
