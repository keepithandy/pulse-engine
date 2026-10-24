#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createEngineFromScenario, exampleSystemRegistry } from "../src/index.js";

function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: pulse-run --scenario FILE [--seed STRING] [--ticks INTEGER] [--events FILE]\nRuns JSON scenarios headlessly. Writes a deterministic JSON summary to stdout.\nBuilt-in system: resource-flow. Unknown flags, scenarios and runtime failures exit 1.");
    return;
  }
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!["--scenario", "--seed", "--ticks", "--events"].includes(flag) || Object.hasOwn(args, flag)) throw new TypeError(`Invalid or repeated option: ${flag}.`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--") || value === "-h" || value.trim() === "") throw new TypeError(`Missing value for ${flag}. Use --help.`);
    args[flag] = value;
  }
  if (!args["--scenario"]) throw new TypeError("--scenario is required. Use --help.");
  const ticks = args["--ticks"] === undefined ? 10 : Number(args["--ticks"]);
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 1000000) throw new RangeError("--ticks must be an integer from 0 to 1000000.");
  let source;
  try { source = readFileSync(args["--scenario"], "utf8"); }
  catch (error) { throw new Error(`Cannot read scenario "${args["--scenario"]}": ${error.message}`); }
  let scenario;
  try { scenario = JSON.parse(source); }
  catch (error) { throw new Error(`Invalid JSON in scenario "${args["--scenario"]}": ${error.message}`); }
  const engine = createEngineFromScenario(scenario, { systemRegistry: exampleSystemRegistry, seed: args["--seed"] });
  const eventLog = [];
  if (args["--events"]) engine.subscribeToEvents(event => eventLog.push(event));
  try {
    for (let i = 0; i < ticks; i += 1) {
      const result = engine.step();
      if (!result.advanced || result.scheduled.some(item => !item.accepted)) throw new Error("Simulation rejected scheduled or tick work.");
      if (result.result.pluginErrors.length) throw result.result.pluginErrors[0];
    }
    const summary = { scenarioVersion: scenario.version, tick: engine.getTick(), state: engine.getState(), randomState: engine.getRandomState(), recentEvents: engine.getEvents() };
    if (args["--events"]) {
      try { writeFileSync(args["--events"], JSON.stringify(eventLog) + "\n"); }
      catch (error) { throw new Error(`Cannot write events "${args["--events"]}": ${error.message}`); }
    }
    console.log(JSON.stringify(summary));
  } finally { engine.dispose(); }
}

try { main(process.argv.slice(2)); }
catch (error) { console.error(`pulse-run: ${error.message}`); process.exitCode = 1; }
