import type { Lens } from "@frontscan/core";
import { census } from "@frontscan/census";

/** Every lens the command runs, in order. Later tickets add theirs here. */
export const LENSES: readonly Lens[] = [census];
