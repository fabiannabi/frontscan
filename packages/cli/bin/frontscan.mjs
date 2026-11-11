import { registerHooks } from "node:module";

// The workspace sources import "./x.js" for files that are "./x.ts" on disk.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && specifier.endsWith(".js")) {
        return nextResolve(specifier.slice(0, -3) + ".ts", context);
      }
      throw error;
    }
  },
});

await import("../src/bin.ts");
