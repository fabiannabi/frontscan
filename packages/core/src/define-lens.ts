import type { Lens } from "./types.js";

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Returns the lens unchanged; throws a plain `Error` if its id is not kebab-case. */
export function defineLens(lens: Lens): Lens {
  if (!KEBAB_CASE.test(lens.id)) {
    throw new Error(`lens id "${lens.id}" is not kebab-case`);
  }
  return lens;
}
