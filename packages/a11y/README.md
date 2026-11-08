# @frontscan/a11y

Accessibility problems that can be found by reading the code, before anything renders.

## Planned rules

Each rule is one ticket: the rule, a fixture repo under `test/fixtures/<rule>/` with the
problem planted (and a clean case next to it), and a test that asserts the exact findings.

- [ ] `img-alt` — <img> without alt (or with a filename as alt)
- [ ] `icon-button-name` — a button whose only child is an icon and that has no aria-label
- [ ] `input-label` — form controls with no associated label
- [ ] `click-on-non-interactive` — onClick on div/span without role, tabIndex and key handling
- [ ] `heading-order` — skipped heading levels inside one component
- [ ] `positive-tabindex` — tabIndex greater than 0
