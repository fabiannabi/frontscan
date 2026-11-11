#!/usr/bin/env node
import { main } from "./main.js";
import { shouldColour } from "./summary-report.js";

process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
  colour: shouldColour(process.stdout.isTTY, process.env.NO_COLOR),
  now: () => performance.now(),
});
