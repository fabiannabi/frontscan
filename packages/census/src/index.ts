import { cssIndex, defineLens, jsxIndex, sortFindings } from "@frontscan/core";
import { adoptionScore } from "./adoption-score.js";
import { componentUsage } from "./component-usage.js";
import { propUsage } from "./prop-usage.js";
import { rawColour } from "./raw-colour.js";

export { adoptionScore } from "./adoption-score.js";
export { componentUsage } from "./component-usage.js";
export { isComponentName } from "./component-usage.js";
export { propUsage } from "./prop-usage.js";
export { rawColour } from "./raw-colour.js";

export const census = defineLens({
  id: "census",
  area: "design-system",
  title: "Design system adoption",
  run(index) {
    const els = jsxIndex(index);
    return sortFindings([
      ...componentUsage(els),
      ...propUsage(els),
      ...rawColour(cssIndex(index)),
      ...adoptionScore(index, els),
    ]);
  },
});
