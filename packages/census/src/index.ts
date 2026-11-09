import { defineLens, jsxIndex, sortFindings } from "@frontscan/core";
import { componentUsage } from "./component-usage.js";

export { componentUsage } from "./component-usage.js";

export const census = defineLens({
  id: "census",
  area: "design-system",
  title: "Design system adoption",
  run(index) {
    return sortFindings(componentUsage(jsxIndex(index)));
  },
});
