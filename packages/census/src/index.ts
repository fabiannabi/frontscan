import { defineLens, jsxIndex, sortFindings } from "@frontscan/core";
import { componentUsage } from "./component-usage.js";
import { propUsage } from "./prop-usage.js";

export { componentUsage } from "./component-usage.js";
export { propUsage } from "./prop-usage.js";

export const census = defineLens({
  id: "census",
  area: "design-system",
  title: "Design system adoption",
  run(index) {
    const els = jsxIndex(index);
    return sortFindings([...componentUsage(els), ...propUsage(els)]);
  },
});
