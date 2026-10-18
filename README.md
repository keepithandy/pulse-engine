# Pulse Engine

<div align="center">
  <p><strong>A deterministic simulation core for event-driven worlds.</strong></p>
  <p>Build repeatable systems, inspect every decision, and keep game content in its own layer.</p>
  <p>
    <a href="https://github.com/keepithandy/pulse-engine/actions/workflows/engine-quality.yml"><img src="https://img.shields.io/github/actions/workflow/status/keepithandy/pulse-engine/engine-quality.yml?branch=main&label=engine%20quality&logo=githubactions&logoColor=white" alt="Engine quality workflow"></a>
    <a href="https://github.com/keepithandy/pulse-engine/actions/workflows/repository-integrity.yml"><img src="https://img.shields.io/github/actions/workflow/status/keepithandy/pulse-engine/repository-integrity.yml?branch=main&label=repository%20integrity&logo=githubactions&logoColor=white" alt="Repository integrity workflow"></a>
    <img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22 or newer">
    <img src="https://img.shields.io/badge/stage-pre--alpha-orange" alt="Pre-alpha">
    <a href="LICENSE"><img src="https://img.shields.io/github/license/keepithandy/pulse-engine?color=blue" alt="MIT license"></a>
  </p>
  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="#capabilities">Capabilities</a> ·
    <a href="#documentation">Documentation</a>
  </p>
</div>

> [!IMPORTANT]
> **Pulse Engine is pre-alpha.** Its APIs and save formats may change while the engine develops.

## What is Pulse Engine?

Pulse Engine is a framework-independent JavaScript simulation engine for deterministic, event-driven worlds. It provides the reusable machinery for simulation while each game keeps its own story, interface, balance, and content.

**Outpost Zero** is the first separate game planned to use the engine.

## Capabilities

| System | What it provides |
| --- | --- |
| **Actions and rules** | Synchronous action dispatch, ordered systems, rule priorities, conflict groups, and decision traces |
| **Events** | Versioned, immutable event records with deterministic ordering and filtered subscriptions |
| **Time and scheduling** | Explicit ticks, pause and resume controls, and repeatable scheduled actions |
| **Seeded randomness** | Reproducible random state that participates in snapshots and rollback |
| **Snapshots and saves** | Branchable snapshots, JSON save envelopes, validation, and versioned migrations |
| **Plug-ins** | Dependency-ordered setup, action and event hooks, lifecycle management, and disposal |
| **Entity/component world** | Generic entities and JSON-safe components without game-specific rules |
| **Scenarios and runner** | Validated scenario files and a headless command-line runner |
| **Diagnostics** | Read-only inspection, bounded event history, and decision explanations |

The engine is designed to keep the simulation reproducible: dispatching an ordinary action does not advance time, and no wall-clock timer affects simulation behavior.

## Quick start

Pulse Engine currently targets **Node.js 22 or newer**. To work from a local checkout:

```sh
git clone https://github.com/keepithandy/pulse-engine.git
cd pulse-engine
npm ci
npm test
npm run smoke
```

Run the example scenario for ten ticks:

```sh
node bin/pulse-run.js --scenario scenarios/resource-network.json --ticks 10
```

The runner writes deterministic JSON to stdout and exits with a nonzero status for invalid input or runtime failures.

## Use the world model

The generic entity/component world is a plug-in. Consumers define what their components mean and keep their game-specific systems outside the engine.

```js
import {
  createEngine,
  createWorldPlugin,
  queryEntities
} from "./src/index.js";

const engine = createEngine({
  systems: [createWorldPlugin()]
});

engine.dispatch({
  type: "world/entity.create",
  entityType: "worker",
  components: {
    position: { x: 3, y: 5 },
    health: 100
  }
});

const workers = queryEntities(engine.getState(), {
  type: "worker",
  with: ["position"]
});

console.log(workers);
```

For the complete API contract, including dispatch results, scheduling, snapshots, migrations, plug-in lifecycle, and scenario validation, see [Engine contracts](docs/engine-contracts.md).

## Quality checks

Run the checks locally:

```sh
npm run lint
npm test
npm run test:coverage
npm run check:package
npm run smoke
node tools/browser-check.mjs
```

GitHub Actions checks Node.js 22 and 24 on Linux, Windows, and macOS. Browser checks cover Chromium and WebKit. Coverage gates require **80% lines**, **85% functions**, and **70% branches**.

## Project boundary

Pulse Engine owns simulation state, actions, rules, events, scheduling, seeded randomness, snapshots, plug-ins, persistence, and diagnostics.

Games that use it own their story, presentation, balance, and content. This boundary lets the simulation core stay reusable while each game can evolve independently.

## Documentation

- [Engine contracts](docs/engine-contracts.md) — API behavior, lifecycle, snapshots, saves, scheduling, diagnostics, and scenarios
- [Example scenarios](scenarios/) — data-driven inputs for the headless runner
- [Source](src/) — engine implementation
- [Tests](test/) — behavioral and compatibility checks

## Package

The package manifest is `@keepithandy/pulse-engine` at **0.1.0-alpha.0**. The package contents can be checked locally with:

```sh
npm run check:package
```

That command performs a dry run; it does not publish the package.

---

<div align="center">
  <sub>Deterministic by design · Game-agnostic by default · Observable when it matters</sub>
</div>
