# Getting started

Pulse Engine is a synchronous, deterministic ES-module simulation kernel. It provides no UI or gameplay content. **Node.js 22+** is required for the CLI; browsers need native ES modules and `structuredClone`.

## From a source checkout

```sh
git clone https://github.com/keepithandy/pulse-engine.git
cd pulse-engine
npm ci
npm test
node bin/pulse-run.js --scenario scenarios/minimal.json --ticks 3
```

The final command prints a JSON summary with `tick: 3`. `--help` displays CLI options. `--events FILE` writes the full published-event stream to a JSON file; use it deliberately for long runs because it is buffered in memory.

## Simulator dashboard (local developer tool)

From the repository root, run:

```sh
npm run dashboard
```

Open `http://127.0.0.1:4173/dashboard/` in your browser. The server listens only on your computer. Pick **Resource network**, click **Step +1** or set the count and click **Run ticks**, then inspect the resource timeline, events and live JSON. Edit the JSON and **Apply scenario** to start a fresh simulation, or **Reset** the current applied setup. Use **Verify repeatability** to compare two independent runs from the same seed with canonical SHA-256 checkpoint digests. **Export checkpoint** downloads the current snapshot.

The dashboard uses the real `createEngineFromScenario` and `exampleSystemRegistry` APIs. Built-in scenarios support the `resource-flow` example system; arbitrary new system IDs cannot be entered as JSON alone because executable plug-ins require JavaScript code. The dashboard does not send your scenario to a remote server and is not an online hosted service. It is intentionally **not** a general-purpose editor for game logic. The headless CLI remains useful for automation.

## Your first action

From the repository root, create an `example.mjs` file:

```js
import { createEngine } from "@keepithandy/pulse-engine";

const engine = createEngine({
  initialState: { count: 0 },
  systems: [{
    id: "counter",
    onAction({ action, state }) {
      if (action.type === "counter/add") {
        return { state: { count: state.count + 1 } };
      }
    }
  }]
});
const result = engine.dispatch({ type: "counter/add" });
console.log(result.accepted, engine.getState()); // true { count: 1 }
engine.dispose();
```

Run `node example.mjs`. Package self-reference works in the checkout. External consumers must install a valid packed copy of `@keepithandy/pulse-engine`; publication to npm is not implied by these instructions.

## Next steps

Read the [public API reference](public-api.md) for engine methods, [TypeScript guide](typescript.md) for types, and [executable examples](../examples/README.md) for tested dispatch/rules/world/scheduling/saves/inspection patterns.

Simulation actions do not advance ticks automatically: call `step()` or `advance(count)` explicitly. Store functions outside state; snapshots and saves contain only JSON-safe values.
