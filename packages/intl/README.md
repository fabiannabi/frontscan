# @frontscan/intl

Internationalisation: text that cannot be translated and layout that breaks right-to-left.

## Planned rules

Each rule is one ticket: the rule, a fixture repo under `test/fixtures/<rule>/` with the
problem planted (and a clean case next to it), and a test that asserts the exact findings.

- [ ] `hardcoded-jsx-text` — user-facing text written in JSX instead of coming from a message catalogue
- [ ] `physical-css-property` — margin-left, padding-right, left/right, text-align: left… with the logical equivalent
- [ ] `string-concatenation` — sentences built with + or template literals around translated parts
- [ ] `locale-unaware-format` — toFixed/ad-hoc dates where Intl.NumberFormat/DateTimeFormat belongs
- [ ] `hardcoded-direction` — dir="ltr" on the root, arrows and chevrons that do not flip
