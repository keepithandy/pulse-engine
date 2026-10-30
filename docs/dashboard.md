# Simulator dashboard

Pulse Engine is a simulation **library**, not a complete game. The dashboard is a development workbench for exercising its scenario runner; it deliberately lives outside `src/` and does not change how the engine simulates anything.

## Launch

From a **repository checkout** with Node.js 22+:

```sh
npm run dashboard
```

Open **http://127.0.0.1:4173/dashboard/**. The HTTP server binds only to `127.0.0.1` and serves a small allowlist of dashboard assets, engine modules and bundled sample scenarios. Stop it with Ctrl+C. To change the port, set `PULSE_DASHBOARD_PORT` in your shell before launching. No `npm install` is required for the dashboard itself; the repository's regular `npm ci` remains appropriate for running the test suite.

## First test in two clicks

1. Use the default **Resource network** scenario.
2. Set the tick count to **10** and select **Run ticks**.

Expected state: **tick 10**, **energy 20**, **water 20**. The initial state is energy 0 and water 10; the resource-flow example produces 2 energy and 1 water each tick. The timeline, event stream and state inspector all read from the live engine. **Step +1** executes exactly one more tick. **Reset** discards the run and restores the last successfully applied scenario and seed.

To experiment without writing JavaScript, change `gameData.production.energy` from `2` to `5`, click **Apply scenario**, and run 10 ticks: energy becomes **50**. The editor is intentionally restricted to JSON-safe data, and invalid input leaves the current engine alive.

## Controls

| Control | What it actually does |
| --- | --- |
| Scenario preset | Fetches bundled JSON, validates it, and creates a fresh engine |
| Scenario JSON + Apply | Parses and validates your edited scenario, then replaces the engine only if construction succeeds |
| Seed override | Optional deterministic seed; blank means use `scenario.seed` |
| Step +1 | Calls `engine.step()` |
| Run ticks | Calls `engine.step()` repeatedly, in responsive batches, 1–1,000 times |
| Stop run | Cancels upcoming batches; ticks already completed remain committed |
| Reset | Restores last **applied** scenario and seed; pending editor changes are not applied |
| Verify repeatability | Runs two new engines from the same applied scenario/seed for the chosen number of ticks, comparing `digestCheckpoint()` results; the visible engine is untouched |
| Export checkpoint | Downloads the current `engine.snapshot()` as JSON |

Charts keep only the latest **101** tick samples. The visible event stream keeps the most recent **30** emitted events, with a separate cumulative event count. The engine itself manages its own bounded event history. Neither chart history nor the event list is a durable audit record.

## Limits and expectations

- The bundled `resource-flow` example is the only current system registered for this dashboard. `minimal` has no systems or resources. Scenario JSON cannot define new executable JavaScript systems, and unknown system names fail clearly.
- Editing the JSON changes *scenario data* (entities, starting resources, production rates, relationships, seed). To test custom rules, game-specific plug-ins, replay execution, scheduled commands or external actions, write a host script against the engine API or extend this tool deliberately.
- The repeatability check verifies **two runs under identical local conditions** for the selected scenario, seed and tick count. A PASS is not a proof of correct simulation rules or portability between different devices.
- This tool is **local only**. It has no account system, remote persistence, backend endpoints, untrusted code evaluation, or telemetry upload. Its server is not intended for public network exposure.
- The browser needs native ES modules, `structuredClone`, and Web Crypto (available in supported localhost browser contexts). The dashboard is **not included in the published engine npm package**; launch it from the repository checkout.

## Validation

`npm test` checks the server allowlist, methods and response headers. The existing Chromium and WebKit CI browser checks also load the actual dashboard, step and run the resource network, reject invalid JSON without destroying the current run, verify reproducibility, and reset the scenario. The existing engine unit/coverage/TypeScript/package gates remain unchanged.
