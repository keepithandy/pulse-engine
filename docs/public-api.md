# Public API inventory

This inventory covers all **32 named exports** from `@keepithandy/pulse-engine`
at `0.1.0-alpha.0`, plus the methods and hook contracts they expose. It was checked
against `src/index.js` and its implementations at baseline `ec4c887`.
See [engine contracts](engine-contracts.md) for the detailed behavioral boundaries.

## Support and compatibility

Import supported library names from `@keepithandy/pulse-engine`. The manifest has
one root ES-module export; direct `src/*` imports and undocumented implementation
details are outside the supported import boundary. The separate `pulse-run` CLI
is documented in the [README](../README.md#scenarios-and-headless-execution).

The inventory uses two compatibility classes:

- **C — Stable candidate:** the intended host-facing API to consider for a future
  stable release. Its current inputs, outputs, and examples are documented here.
- **A — Advanced helper:** an exposed subsystem or record utility for callers that
  own its composition, validation, and lifecycle. Direct use depends more closely
  on the current version's record shapes and behavior. `exampleSystemRegistry` is
  an advanced export supplied specifically as an example.

Both classes are **pre-alpha**, with no stable API or save-format guarantee yet.
Pin the exact package version when integrating; review contract changes and migration
needs when upgrading. A candidate designation does not declare an API stable or change
runtime behavior. Changes to either class should identify their compatibility impact
and update the affected contracts and examples. Formal release policy remains Phase 14
work. Version constants describe the current implementation, rather than promising
that older data is compatible.

Engine state, actions, events, scenarios, and saved records use the existing
[JSON-safe data contract](engine-contracts.md#json-safe-data-boundaries). Functions
belong in runtime systems, rules, validators, and listeners. Hooks execute synchronously.
Read methods return detached data except where an advanced helper explicitly says
otherwise. Selected validation, rejection, compatibility, and lifecycle boundaries now have
[structured error metadata](errors.md); other plug-in errors may remain unstructured.

The examples use Node's assertion library to make the expected results explicit.
Each JavaScript block is independent and can run in a Node 22+ ES module within this
checkout using package self-reference, or in a consumer with the package installed.
Running them in this checkout does not establish isolated tarball installation support;
that verification belongs to P02-05.

## Root exports

The compatibility class in each row applies to that export's documented contract.
The linked sections provide usage examples and the returned object's methods.

| Export | Class | Input contract | Result and example |
| --- | --- | --- | --- |
| `summarizePulseError` | C | Thrown value, including unknown non-Error values. | JSON-safe `{ code, category, message, cause }`; [structured errors](errors.md). |
| `REPLAY_FORMAT` | C | None; constant. | `"pulse-engine-replay"`; [replay input protocol](replay-format.md). |
| `REPLAY_VERSION` | C | None; constant. | `1`; [replay input protocol](replay-format.md). |
| `createReplayRecord` | A | Host-owned configuration id, original seed, complete initial snapshot, initial pause state and optional ordered commands. | Frozen detached input record; [replay inputs](#replay-input-records). |
| `validateReplayRecord` | A | JSON-safe replay envelope v1. | Frozen detached validated replay record or throws; [replay inputs](#replay-input-records). |
| `replayCommands` | C | Valid replay record, matching host configuration id and synchronous trusted engine factory; optional checkpoint callback. | Deeply frozen completion or first outcome divergence; [replay execution](replay-execution.md). |
| `digestCheckpoint` | C | Compatible JSON-safe snapshot with semantically valid PRNG, event journal and schedules. | `Promise<sha256-v1:…>` stable across runtimes; [digest contract](checkpoint-digests.md). |
| `createEngine` | C | Optional configuration object; JSON-safe initial state, runtime systems/rules, numeric or string seed, and the options below. | Frozen engine interface; [engine API](#engine-api). |
| `createEngineFromScenario` | C | Scenario v1 data plus an explicit system-factory allowlist and optional validation/engine options. | Engine initialized from scenario data; [scenarios](#scenarios). |
| `validateScenario` | C | Scenario data and optional synchronous `validateGameData` callback. | `{ valid, errors, value }`; invalid data has `value: null`; [scenarios](#scenarios). |
| `createWorldPlugin` | C | Optional `{ id: "pulse-world", idPrefix: "entity" }`; nonblank, non-reserved names. | Frozen plug-in manifest with an `onAction` hook; [world](#world). |
| `getEntity` | C | State record and entity id; names are trimmed and reserved names rejected. | Detached `{ id, type, components }`, or `null`; [world](#world). |
| `queryEntities` | C | State and optional `{ type, with: [], without: [] }` component filters. | Detached entity records in creation order; [world](#world). |
| `validateWorldState` | C | JSON-safe state record, optionally containing `world`. | `true`, or throws for invalid world invariants; [world](#world). |
| `ENGINE_VERSION` | C | None; constant. | `"0.1.0-alpha.0"`; [snapshot records](#snapshot-records). |
| `SNAPSHOT_FORMAT` | C | None; constant. | `"pulse-engine-snapshot"`; [snapshot records](#snapshot-records). |
| `SNAPSHOT_VERSION` | C | None; constant. | `1`; [snapshot records](#snapshot-records). |
| `SAVE_FORMAT` | C | None; constant. | `"pulse-engine-save"`; [save utilities](#save-utilities). |
| `SAVE_VERSION` | C | None; constant. | `1`; [save utilities](#save-utilities). |
| `SCENARIO_VERSION` | C | None; constant. | `1`; [scenarios](#scenarios). |
| `createTickScheduler` | A | Optional `{ capacity: 10000 }`; capacity is a positive safe integer. | Frozen scheduler interface; [standalone scheduler](#standalone-scheduler). |
| `createRuleEvaluator` | A | Rule array, default `[]`; unique nonblank ids and synchronous condition/effect functions. | Frozen `{ evaluate }` interface; [standalone rules](#standalone-rules). |
| `createMigrationRegistry` | A | Migration array, default `[]`; unique nonnegative safe `from`, `to === from + 1`, and `migrate` function. | Frozen `{ migrate }` interface; [save utilities](#save-utilities). |
| `deserializeSave` | A | Save JSON string or JSON-safe envelope, optional `{ migrations }`. | Detached snapshot after migration/unwrapping; [save utilities](#save-utilities). |
| `serializeSnapshot` | A | JSON-safe snapshot data. | Save-envelope JSON string; [save utilities](#save-utilities). |
| `createEventJournal` | A | Optional `{ historyLimit: 1000 }`; positive integer. | Frozen journal interface; [standalone events](#standalone-events). |
| `createPluginRegistry` | A | Plug-in array, default `[]`; valid ids, dependencies, and hook functions. | Frozen registry interface; [standalone plug-ins](#standalone-plug-ins). |
| `createSeededRandom` | A | Finite number or string seed, default `0`. | Frozen random interface; [standalone randomness](#standalone-randomness). |
| `createSnapshotRecord` | A | Checkpoint fields listed below; supply JSON-safe values and a nonblank `branch.id`. | Detached, deeply frozen snapshot record; [snapshot records](#snapshot-records). |
| `forkSnapshotRecord` | A | Snapshot envelope accepted by `validateSnapshotRecord`, and nonblank branch id. | Deeply frozen copied snapshot with new branch, parent id, and cleared label; [snapshot records](#snapshot-records). |
| `validateSnapshotRecord` | A | JSON-safe snapshot envelope matching the current format and versions. | Detached envelope with legacy tick/schedule defaults; [snapshot records](#snapshot-records). |
| `exampleSystemRegistry` | A | Frozen map; its `"resource-flow"` factory takes no required arguments. | Example plug-in producing configured resources on ticks; [scenarios](#scenarios). |

## Engine API

### Configuration and hook contracts

| Option | Default | Contract |
| --- | --- | --- |
| `initialState` | `{}` | JSON-safe simulation data; world APIs require a state record. |
| `systems`, `plugins` | `[]`, `[]` | Arrays of plug-in manifests, combined in that order and resolved by dependencies. |
| `rules` | `[]` | Rule array described under [standalone rules](#standalone-rules). |
| `seed` | `0` | Finite number or string; initializes the engine-owned random generator. |
| `branchId` | `"main"` | Nonblank string identifying the initial snapshot branch. |
| `eventHistoryLimit` | `1000` | Positive integer bounding retained event history. |
| `scheduleCapacity` | `10000` | Positive safe integer bounding queued jobs. |
| `validateState` | Accepting callback | Synchronous function receiving deeply frozen, detached initial/restore/import state. Throw or return `false` to reject; it does not validate each dispatch. |
| `diagnostics` | `true` | Boolean enabling traces, inspection, and explanations. |
| `traceLimit` | `1000` | Positive safe integer bounding retained explanations. |
| `redact` | Identity function | Synchronous inspection transformation on detached data; its JSON-safe result is copied and frozen. |

A plug-in manifest has a nonblank `id`, optional nonblank `version` (default
`"0.0.0"`), optional `dependsOn` array of nonblank ids, and optional hooks. Plug-in
ids, versions, and dependency names are trimmed. Dependencies must exist, ids must
be unique, and cycles reject. The engine runs lifecycle hooks; the raw registry
below only manages manifests and ordering.

- `setup` and `dispose` receive `{ pluginId, getState, getTick, getEvents,
  getRandomState }`. Return values are ignored; Promise results are unsupported.
- `onAction` and `beforeTick` receive `{ action, state, random, tick, emit }`.
  `action` is frozen, `state` is detached, and `random` exposes `next`, `float`,
  `integer`, and `pick`. `emit(event)` queues an event. Return nothing for no change,
  `{ state, events }` for a candidate change, or `{ accepted: false, reason }` to
  reject. A replacement `state` replaces the entire candidate state.
- `beforeTick` runs immediately before the same plug-in's `onAction` during a tick,
  in dependency order. Ordinary dispatch does not call tick hooks.
- `onEvent` receives the lifecycle getters plus `{ event, state, tick }`;
  `afterTick` receives the lifecycle getters plus `{ state, tick }`. Their return
  values are ignored. They observe a committed result; thrown errors are collected.

Rules receive `{ action, state, random, tick }`, with no `emit` method. Conditions
must return booleans. Effects use the response shape above and return events in
`events`. Larger priorities run first; ids break ties. `conflictKey` allows only
the first matching rule in a group to apply.

Engine-issued random sampling methods expire when their synchronous plug-in hook
or complete engine rule evaluation returns or throws. Do not retain the interface
or its methods for observers, later actions, or asynchronous work: expired calls
throw without changing the generator. Conditions and effects within one engine
rule evaluation share that evaluation's interface. Promise results remain
unsupported and fail synchronously; late Promise rejections are observed without
accepting their results or cancelling consumer asynchronous code.

### Returned methods

Methods below belong to the C-class `createEngine` contract. Every engine write
rejects after disposal or during a reentrant mutation. New subscriptions also reject
after disposal. Reads and snapshot/save export remain available. Unsubscribe
functions remain safe to call. [Lifecycle failures](engine-contracts.md#plug-ins-and-diagnostics)
describe cleanup and the limits of rollback.

Checkpoint exports (`snapshot`, `fork`, and `exportSave`) throw while an engine
operation is running, including calls from hooks, validators, and observers.
Capture an autosave after `dispatch()`, `step()`, or `advance()` returns, when all
events and due jobs for that operation have finished. Ordinary state, event, and
diagnostic reads remain available inside callbacks. Uncaught observer checkpoint
errors are collected without undoing the committed action.

| Method | Input | Return / behavior |
| --- | --- | --- |
| `dispatch(action)` | JSON-safe object with nonblank `type`, optional nonblank `id`, and consumer fields. | Dispatch result described below; ordinary actions leave the tick unchanged. |
| `getState()` | None. | Detached state. |
| `getTick()` | None. | Current nonnegative safe integer tick. |
| `subscribe(listener)` | Function receiving `{ action, previousState, state, revision, tick }` on acceptance. | Unsubscribe function returning whether its listener was removed. |
| `subscribeToEvents(listener, options)` | Listener and optional `{ type }` nonblank event filter. | Unsubscribe function returning whether its subscription was removed. |
| `getEvents(options)` | Optional `{ type, limit }`; nonnegative integer limit, default history bound. | New array of detached, deeply frozen event records; `limit: 0` returns `[]`. |
| `getRandomState()` | None. | Frozen `{ algorithm, seed, state }` generator checkpoint. |
| `getPlugins()` | None. | Frozen metadata array containing `{ id, version, dependsOn, hooks }`. |
| `registerPlugin(plugin)` | Valid manifest whose dependencies already exist. | Frozen metadata after setup. Failed setup removes the new plug-in and attempts its cleanup. |
| `unregisterPlugin(id)` | Registered plug-in id. | `true` if removed, `false` if absent; dependents block removal. A dispose error propagates after removal. |
| `snapshot(options)` | Optional `{ label }` containing JSON-safe label data. | Frozen snapshot containing the checkpoint fields listed below. |
| `restore(snapshot)` | Compatible envelope with valid random, journal, scheduler, and consumer state. | `{ restored: true, branch, revision, state }`; rejected loads leave the checkpoint unchanged. |
| `fork(id)` | Nonblank new branch id. | Frozen snapshot with new branch identity; source engine is unchanged. |
| `exportSave()` | None. | Save-envelope JSON string for the current snapshot. |
| `importSave(input, options)` | Save string/envelope and optional migration array in `{ migrations }`. | The same result as `restore`; migrates and validates before installation. |
| `schedule(action, options)` | Action and `{ at, interval, limit, id }` as below, targeting a future tick. | Schedule id string. |
| `cancelSchedule(id)` | Schedule id. | Boolean indicating removal. |
| `getSchedules()` | None. | Frozen, detached jobs sorted by due tick then insertion sequence. |
| `step()` | None. | `{ advanced, tick, result, scheduled }`; attempts one tick even while paused. |
| `advance(count = 1)` | Nonnegative safe integer count. | Array of step results; stops on tick rejection or pause. |
| `pause()` | None. | `undefined`; prevents `advance` progress. |
| `resume()` | None. | `undefined`; allows `advance` progress. |
| `startRecording(options)` | `{ configurationId, seed?, retainCommands?, sink? }`. | Handle with `getStatus()`, `stop()` and `getRecord()`; [recording contract](recording.md). |
| `inspect()` | None. | Frozen diagnostic view after redaction, or `null` when diagnostics are disabled. |
| `getExplanation(actionId)` | Action id. | Detached latest retained `{ actionId, tick, revision, accepted, reason, traces }`, or `null`. |
| `dispose()` | None; one call per engine. | Array of cleanup errors after all reverse-order cleanup attempts and subscription removal. |

An accepted dispatch result contains `{ accepted: true, action, revision, tick,
state, events, listenerErrors, eventListenerErrors, pluginErrors }`. Observer-error
arrays contain caught values (normally `Error` objects), so the entire result is not
promised to be JSON-safe. A rule or plug-in rejection returns `{ accepted: false,
action, reason, revision, tick, state }`, without acceptance-only arrays. Invalid
data or a thrown processing error throws. Rejection and processing exceptions roll
back the engine checkpoint and random state; external hook side effects cannot be
undone. A rejected action may still leave a diagnostic explanation.

State revisions and generated action ids advance on accepted dispatch. User-supplied
action ids still consume a sequence position. Pending events commit in publication
order as `{ version: 1, id, type, tick, source, payload, metadata }`, preserving
additional JSON-safe event fields. Omitted payload and metadata become `{}`.

```js
import assert from "node:assert/strict";
import { createEngine } from "@keepithandy/pulse-engine";

const engine = createEngine({
  initialState: { count: 0 },
  seed: "api-demo",
  systems: [{
    id: "counter",
    onAction({ action, state, emit }) {
      if (action.type !== "count/add") return;
      emit({ type: "count/added", payload: { amount: action.amount } });
      return { state: { count: state.count + action.amount } };
    }
  }]
});
const revisions = [];
const observed = [];
const stopState = engine.subscribe(change => revisions.push(change.revision));
const stopEvents = engine.subscribeToEvents(event => observed.push(event.type), {
  type: "count/added"
});
const result = engine.dispatch({ type: "count/add", amount: 2 });
assert.equal(result.accepted, true);
assert.equal(engine.getState().count, 2);
assert.equal(engine.getTick(), 0);
assert.deepEqual(revisions, [1]);
assert.deepEqual(observed, ["count/added"]);
assert.equal(engine.getEvents({ limit: 1 })[0].type, "count/added");
assert.equal(engine.getRandomState().algorithm, "mulberry32-v1");
assert.equal(engine.getPlugins()[0].id, "counter");
assert.equal(engine.inspect().revision, 1);
assert.equal(engine.getExplanation(result.action.id).accepted, true);
assert.equal(stopState(), true);
assert.equal(stopEvents(), true);
assert.deepEqual(engine.dispose(), []);
assert.equal(engine.getState().count, 2); // Reads survive disposal.
```

### Engine time and checkpoints

Schedule `at` is a safe integer strictly greater than the current tick. `interval`
is `null`/omitted for a one-shot job or a positive safe integer for repeats. `limit`
is `null`/omitted for unlimited repeats or a positive safe integer attempt count;
one-shot jobs accept only an omitted/null limit or `1`. Optional ids must be unique
and nonblank. Jobs contain `{ id, sequence, action, at, interval, remaining }`.
Each firing attempt consumes one run, including rejected or throwing actions.
Counter or next-repeat-tick overflow rejects before the tick commits.

`step().result` is the tick dispatch result. Its `scheduled` array contains dispatch
results augmented with `scheduleId`; caught scheduled exceptions instead produce
`{ scheduleId, accepted: false, reason }`. Scheduled failures do not undo a committed
tick or stop other due jobs.

```js
import assert from "node:assert/strict";
import { createEngine } from "@keepithandy/pulse-engine";

const engine = createEngine();
const id = engine.schedule({ type: "demo/ping" }, { at: 1 });
assert.equal(engine.getSchedules()[0].id, id);
engine.pause();
assert.deepEqual(engine.advance(2), []);
const first = engine.step();
assert.equal(first.advanced, true);
assert.equal(first.scheduled[0].scheduleId, id);
engine.resume();
assert.equal(engine.advance(2).length, 2);
const later = engine.schedule({ type: "demo/later" }, { at: 9 });
assert.equal(engine.cancelSchedule(later), true);
assert.deepEqual(engine.getSchedules(), []);
```

A snapshot contains `{ format, version, engineVersion, label, branch, revision,
actionSequence, tick, schedules, state, randomState, events }`. The branch contains
`{ id, parentId }`. It excludes runtime hooks/listeners, diagnostics, and pause state.
Recreate the same systems/rules configuration before loading it. `restore` checks
the current engine version exactly and validates components before installation.

```js
import assert from "node:assert/strict";
import { createEngine } from "@keepithandy/pulse-engine";

const engine = createEngine({ initialState: { ready: true } });
const checkpoint = engine.snapshot({ label: "start" });
const fork = engine.fork("preview");
assert.equal(fork.branch.parentId, "main");
assert.equal(engine.snapshot().branch.id, "main");
engine.advance(3);
assert.equal(engine.restore(checkpoint).restored, true);
assert.equal(engine.getTick(), 0);
const save = engine.exportSave();
engine.step();
assert.equal(engine.importSave(save).restored, true);
assert.equal(engine.getTick(), 0);
```

```js
import assert from "node:assert/strict";
import { createEngine } from "@keepithandy/pulse-engine";

const lifecycle = [];
const engine = createEngine();
const metadata = engine.registerPlugin({
  id: "demo",
  version: "1.0.0",
  setup({ pluginId }) { lifecycle.push(`setup:${pluginId}`); },
  dispose({ pluginId }) { lifecycle.push(`dispose:${pluginId}`); }
});
assert.equal(metadata.id, "demo");
assert.equal(engine.unregisterPlugin("demo"), true);
assert.equal(engine.unregisterPlugin("demo"), false);
assert.deepEqual(lifecycle, ["setup:demo", "dispose:demo"]);
assert.deepEqual(engine.dispose(), []);
```

## World

`createWorldPlugin` supplies generic storage under `state.world`, with
`{ nextEntity, order, entities }`. Each stored entity is `{ type, components }`.
Names are trimmed; `__proto__`, `prototype`, and `constructor` are reserved.
Generated ids use the configured prefix and a deterministic counter. The plug-in
handles these JSON-safe action shapes through engine dispatch:

| Type | Additional fields | Emitted type |
| --- | --- | --- |
| `world/entity.create` | Required `entityType`; optional `entityId`, `components: {}`. | `world/entity.created` |
| `world/entity.destroy` | Required `entityId`. | `world/entity.destroyed` |
| `world/component.set` | Required `entityId`, `component`, own `value` field. | `world/component.set` |
| `world/component.remove` | Required `entityId`, `component`. | `world/component.removed` |

Duplicate creation ids, unknown entities, and removal of missing components reject.
Malformed names and component data throw. `validateWorldState` checks storage
invariants, rather than consumer component schemas. Install it explicitly through
`validateState` for initial/restore/import checks. Queries require well-formed state;
they do not replace full validation. Missing `world` means an empty world. Scenario
v1 entities stay separate under `state.entities`; see [the mapping decision](scenario-world-mapping.md).

```js
import assert from "node:assert/strict";
import {
  createEngine, createWorldPlugin, getEntity, queryEntities, validateWorldState
} from "@keepithandy/pulse-engine";

const engine = createEngine({
  systems: [createWorldPlugin({ idPrefix: "worker" })],
  validateState: validateWorldState
});
const created = engine.dispatch({
  type: "world/entity.create",
  entityType: "worker",
  components: { position: { x: 3, y: 5 } }
});
assert.equal(created.accepted, true);
const state = engine.getState();
assert.equal(validateWorldState(state), true);
assert.equal(getEntity(state, "worker-000001").components.position.x, 3);
assert.equal(getEntity(state, "toString"), null);
assert.deepEqual(queryEntities(state, { type: "worker", with: ["position"] })
  .map(entity => entity.id), ["worker-000001"]);
```

## Scenarios

`validateScenario(input, { validateGameData } = {})` checks JSON-safe data, version,
seed, system ids, entity uniqueness, relationship references, and finite resources.
Its result is `{ valid: boolean, errors: string[], value }`, with a detached scenario
only on success. Invalid data generally produces a result; an invalid custom validator
or its invalid return value throws. The optional synchronous callback receives detached
`gameData` and must return an array of error strings. The complete input fields are
`{ version, seed, systems, entities, resources, relationships, gameData? }`;
see [the scenario schema](../scenarios/scenario.schema.json).

`createEngineFromScenario(input, options = {})` throws if validation fails or if a
scenario's system lacks an own function entry in `options.systemRegistry` (default
`{}`). Each factory receives detached scenario data and must return a plug-in with the
same id. Options include `validateGameData`, an optional seed override, and engine
options; scenario-derived `initialState` and systems are supplied by the builder.

`exampleSystemRegistry` is a frozen map with one `"resource-flow"` factory. Its
plug-in reads `gameData.production` and updates existing resource names on ticks.
It is an executable example, not a general resource schema or a production system catalog.

```js
import assert from "node:assert/strict";
import {
  SCENARIO_VERSION, validateScenario, createEngineFromScenario, exampleSystemRegistry
} from "@keepithandy/pulse-engine";

const scenario = {
  version: SCENARIO_VERSION,
  seed: "demo",
  systems: ["resource-flow"],
  entities: [],
  resources: { energy: 0 },
  relationships: [],
  gameData: { production: { energy: 2 } }
};
assert.equal(SCENARIO_VERSION, 1);
assert.equal(validateScenario(scenario).valid, true);
const engine = createEngineFromScenario(scenario, {
  systemRegistry: exampleSystemRegistry
});
engine.step();
assert.equal(engine.getState().resources.energy, 2);
assert.equal(exampleSystemRegistry["resource-flow"]().id, "resource-flow");
```

## Save utilities

`serializeSnapshot(snapshot)` checks JSON-safe data and wraps it as
`{ format: SAVE_FORMAT, version: SAVE_VERSION, snapshot }` JSON. It does not validate
the snapshot envelope or its components. `deserializeSave(input, { migrations } = {})`
parses/copies, checks the save format, migrates to the current save version, requires a
snapshot, and returns detached snapshot data. It does not perform engine restore validation.
Use `engine.importSave` for the complete loading boundary.

The built-in save v0 migration converts `checkpoint` to `snapshot`. Supplying a
`migrations` array replaces that default. `createMigrationRegistry(steps).migrate(input,
targetVersion)` instead defaults to no steps; it copies input, requires consecutive
version transitions, and returns a detached migrated record. Each synchronous migration
must return JSON-safe data with its declared `to` version. Missing transitions, future
versions, and invalid output throw. These utilities do not install state into an engine.

```js
import assert from "node:assert/strict";
import {
  createEngine, createMigrationRegistry, deserializeSave, serializeSnapshot,
  SAVE_FORMAT, SAVE_VERSION
} from "@keepithandy/pulse-engine";

const checkpoint = createEngine().snapshot();
const json = serializeSnapshot(checkpoint);
assert.equal(SAVE_FORMAT, "pulse-engine-save");
assert.equal(SAVE_VERSION, 1);
assert.equal(JSON.parse(json).format, SAVE_FORMAT);
assert.deepEqual(deserializeSave(json), checkpoint);
const legacy = { format: SAVE_FORMAT, version: 0, checkpoint };
const migrations = [{
  from: 0, to: 1,
  migrate: value => ({ format: SAVE_FORMAT, version: 1, snapshot: value.checkpoint })
}];
const registry = createMigrationRegistry(migrations);
assert.equal(registry.migrate(legacy, SAVE_VERSION).version, SAVE_VERSION);
assert.deepEqual(deserializeSave(legacy, { migrations }), checkpoint);
```

## Snapshot records

`createSnapshotRecord(fields)` accepts `{ actionSequence, branch, events, label,
randomState, revision, state, tick = 0, schedules = { version: 1, sequence: 0,
jobs: [] } }`. It supplies the current format/version/engine version, converts an
omitted label to `null`, checks a nonblank branch id, and clones/freezes the result.
Supply JSON-safe checkpoint fields, even though the builder itself only checks the
branch id before cloning. It uses structured cloning and is a record builder, not the JSON-safe/load-validation
boundary. A cloneable record it builds can still be invalid for restoration.

`validateSnapshotRecord(input)` checks JSON-safe data, format, snapshot/engine
versions, revision/action counters, branch ids, and tick. It returns a detached
record and supplies tick/schedule defaults for older v1 records. It does not validate
the nested random generator, event journal, scheduler jobs, or consumer world invariants.
`forkSnapshotRecord(snapshot, id)` runs that envelope validation, clears `label`, sets
the trimmed new branch id, and records the original branch as `parentId`. It does not
install anything. `engine.restore` performs the component validation and configured
state validation needed for a load.

```js
import assert from "node:assert/strict";
import {
  createEngine, createSnapshotRecord, validateSnapshotRecord, forkSnapshotRecord,
  ENGINE_VERSION, SNAPSHOT_FORMAT, SNAPSHOT_VERSION
} from "@keepithandy/pulse-engine";

const source = createEngine().snapshot();
const record = createSnapshotRecord({ ...source, label: "manual" });
assert.equal(ENGINE_VERSION, "0.1.0-alpha.0");
assert.equal(SNAPSHOT_FORMAT, "pulse-engine-snapshot");
assert.equal(SNAPSHOT_VERSION, 1);
assert.equal(record.engineVersion, ENGINE_VERSION);
assert.equal(record.format, SNAPSHOT_FORMAT);
assert.equal(record.version, SNAPSHOT_VERSION);
assert.equal(Object.isFrozen(record.state), true);
assert.equal(validateSnapshotRecord(record).label, "manual");
const fork = forkSnapshotRecord(record, "preview");
assert.deepEqual(fork.branch, { id: "preview", parentId: "main" });
assert.equal(fork.label, null);
assert.equal(record.branch.id, "main");
```

## Standalone randomness

`createSeededRandom(seed = 0)` normalizes finite numbers to unsigned 32-bit integers
and hashes string seeds. Equal seeds and calls reproduce the same sequence. The
returned interface contains:

| Method | Input | Return |
| --- | --- | --- |
| `next()` | None. | Number in `[0, 1)`; advances generator state. |
| `float(min = 0, max = 1)` | Finite endpoints with `max >= min` and finite span. | `min + next() * (max - min)`; equal endpoints return that endpoint while consuming a sample. |
| `integer(min, max)` | Safe integer endpoints, `max >= min`, `max < Number.MAX_SAFE_INTEGER`. | Integer within the inclusive bounds; invalid bounds do not advance state. |
| `pick(values)` | Nonempty array. | A selected array element by reference, with no deep copy. |
| `getState()` | None. | Frozen `{ algorithm: "mulberry32-v1", seed, state }`. |
| `setState(snapshot)` | Matching algorithm and unsigned 32-bit integer seed/state. | `undefined`; installs generator state. |

The engine exposes only sampling methods to action/rule hooks. Its public
`getRandomState` is read-only; normal checkpoint restoration owns random restoration.
The engine scopes its sampling interfaces to synchronous processing as described
above. A directly created generator and the random interface supplied to a standalone
rule evaluator remain caller-owned and do not expire.

```js
import assert from "node:assert/strict";
import { createSeededRandom } from "@keepithandy/pulse-engine";

const random = createSeededRandom("demo");
const saved = random.getState();
const first = random.next();
assert.ok(first >= 0 && first < 1);
random.setState(saved);
assert.equal(random.next(), first);
assert.equal(random.float(4, 4), 4);
assert.equal(random.integer(2, 2), 2);
assert.equal(random.pick(["only"]), "only");
```

## Standalone events

`createEventJournal({ historyLimit = 1000 } = {})` manages its own sequence,
bounded history, and subscriptions. Event input requires a nonblank `type`; optional
`version` must be `1`, `id`/`source` must be nonblank, and `tick` must be a nonnegative
safe integer. Extra fields and payload/metadata must be JSON-safe.

| Method | Input | Return |
| --- | --- | --- |
| `publish(event, defaults = {})` | Event draft; default `{ tick: 0, source: "engine" }` fills omitted fields. | `{ event, listenerErrors }`; committed event is detached/frozen and observer failures are collected. |
| `prepare(inputs, defaults = {})` | Array of event drafts, same defaults. | Frozen copied drafts with tick/source filled; checks batch sequence capacity without publishing or advancing the sequence. |
| `read(options = {})` | Optional type filter and nonnegative integer `limit`. | New array of detached/frozen retained events, newest limit in publication order. |
| `subscribe(listener, options = {})` | Function and optional nonblank `type` filter. | Unsubscribe function returning a removal boolean. |
| `clearSubscribers()` | None. | `undefined`; removes listeners, with no disposal state. |
| `exportState()` | None. | Frozen `{ format: "pulse-event-journal", version: 1, sequence, history }`. |
| `restoreState(snapshot)` | Matching journal format/version, nonnegative safe sequence, valid history events. | `undefined`; validates/copies data, then retains at most the configured history limit. |

```js
import assert from "node:assert/strict";
import { createEventJournal } from "@keepithandy/pulse-engine";

const journal = createEventJournal({ historyLimit: 2 });
const observed = [];
const stop = journal.subscribe(event => observed.push(event.type), { type: "demo/ping" });
const prepared = journal.prepare([{ type: "demo/ping" }], { tick: 2 });
assert.deepEqual(journal.read(), []);
const published = journal.publish(prepared[0]);
assert.equal(published.event.tick, 2);
assert.deepEqual(published.listenerErrors, []);
assert.deepEqual(observed, ["demo/ping"]);
const saved = journal.exportState();
journal.publish({ type: "demo/later" });
journal.restoreState(saved);
assert.equal(journal.read({ limit: 1 })[0].type, "demo/ping");
assert.equal(stop(), true);
journal.clearSubscribers();
```

## Standalone scheduler

`createTickScheduler({ capacity = 10000 } = {})` stores jobs but does not dispatch
actions, advance engine time, or own an engine transaction. Its schedule options and
job shape match the [engine scheduling contract](#engine-time-and-checkpoints).

| Method | Input | Return |
| --- | --- | --- |
| `schedule(action, options, currentTick = 0)` | Action, schedule options, and caller-owned current tick; `at > currentTick`. | New schedule id. |
| `cancel(id)` | Schedule id. | Boolean indicating removal. |
| `due(tick)` | Caller-supplied tick. | Frozen copied jobs with `at <= tick`, ordered by due tick/sequence; leaves jobs in place. |
| `validateDue(tick)` | Caller-supplied tick. | `undefined`, or throws if a due repeat's next tick would overflow; no job consumption. |
| `consume(id)` | Schedule id. | `false` if absent; otherwise `true`, removing a final run or advancing its repeat tick/count. |
| `list()` | None. | Frozen copied jobs ordered by due tick/sequence. |
| `exportState()` | None. | `{ version: 1, sequence, jobs }` with detached/frozen jobs. |
| `restoreState(snapshot, tick = 0)` | Version 1 scheduler state; valid jobs/counters within capacity and no job due before `tick`. | `undefined`; replaces scheduler data after validation. |

```js
import assert from "node:assert/strict";
import { createTickScheduler } from "@keepithandy/pulse-engine";

const scheduler = createTickScheduler({ capacity: 2 });
const id = scheduler.schedule({ type: "demo/ping" }, { at: 1, interval: 2, limit: 2 });
assert.equal(scheduler.due(1)[0].id, id);
scheduler.validateDue(1);
assert.equal(scheduler.consume(id), true);
assert.equal(scheduler.list()[0].at, 3);
const saved = scheduler.exportState();
assert.equal(scheduler.cancel(id), true);
scheduler.restoreState(saved, 1);
assert.equal(scheduler.list()[0].remaining, 1);
```

## Standalone rules

`createRuleEvaluator(rules = [])` requires unique nonblank rule ids, `condition`
and `effect` functions, optional finite `priority` (default `0`), and optional
nonblank `conflictKey`. See the [hook response contract](#configuration-and-hook-contracts).
Its sole method is `evaluate({ action, state, random, tick, collectTraces = true })`.
It returns `{ accepted: true, state, events, traces }` or `{ accepted: false, reason,
state, events: [], traces }`. Each trace has `{ ruleId, status, reason, effects }`.
`effects` lists emitted event types; status is `applied`, `skipped`, or `rejected`.

On rejection, this raw helper returns the originally supplied state reference. It
does not checkpoint/restore the supplied random interface or validate publication
envelopes. Use engine dispatch when engine-owned rollback and event validation are needed.

```js
import assert from "node:assert/strict";
import { createRuleEvaluator, createSeededRandom } from "@keepithandy/pulse-engine";

const evaluator = createRuleEvaluator([{
  id: "count", priority: 10,
  condition: ({ action }) => action.type === "count/add",
  effect: ({ state, action }) => ({ state: { count: state.count + action.amount } })
}]);
const result = evaluator.evaluate({
  action: { type: "count/add", amount: 2 },
  state: { count: 0 }, random: createSeededRandom(1), tick: 0
});
assert.equal(result.accepted, true);
assert.equal(result.state.count, 2);
assert.equal(result.traces[0].status, "applied");
```

## Standalone plug-ins

`createPluginRegistry(initialPlugins = [])` validates manifests and resolves
dependencies. It does not call setup/disposal or provide the engine's mutation guard.
Callers own lifecycle and any external effects of directly invoking returned hooks.

| Method | Input | Return |
| --- | --- | --- |
| `list()` | None. | Frozen array of frozen `{ id, version, dependsOn, hooks }` metadata. |
| `ordered()` | None. | Frozen array of normalized plug-in manifests in dependency order, retaining executable hooks. |
| `register(plugin)` | Manifest with an unused id and already-registered dependencies. | Metadata after dependency validation; no setup call. |
| `remove(id)` | Plug-in id. | Removed normalized manifest or `null`; dependents block removal; no dispose call. |

```js
import assert from "node:assert/strict";
import { createPluginRegistry } from "@keepithandy/pulse-engine";

let setupCalls = 0;
const registry = createPluginRegistry([{ id: "base" }]);
const metadata = registry.register({
  id: "addon", dependsOn: ["base"], setup() { setupCalls += 1; }
});
assert.equal(metadata.id, "addon");
assert.deepEqual(registry.ordered().map(plugin => plugin.id), ["base", "addon"]);
assert.equal(registry.list()[1].version, "0.0.0");
assert.equal(setupCalls, 0); // This helper does not execute lifecycle hooks.
assert.equal(registry.remove("addon").id, "addon");
assert.equal(registry.remove("missing"), null);
```

## Replay input records

The v1 replay protocol is independent from saved snapshot envelopes and the bounded event journal. `createReplayRecord({ configurationId, seed, initialSnapshot, initialPaused, commands })` builds a deeply frozen input record and defaults `commands` to `[]`; `validateReplayRecord(input)` accepts an existing detached envelope and checks format/version, configuration id, seed/checkpoint identity, pause state, nested checkpoint records and 1-based contiguous external input commands. Neither helper executes, captures or replays a simulation. See the [record reference](replay-format.md), [JSON Schema](replay.schema.json) and [full fixture](../fixtures/replay/counter-v1.json).

```js
import { createEngine, createReplayRecord, validateReplayRecord } from "@keepithandy/pulse-engine";
const engine = createEngine({ seed: "my-seed" });
const record = createReplayRecord({
  configurationId: "test-v1", seed: "my-seed", initialSnapshot: engine.snapshot(), initialPaused: false,
  commands: [{ sequence: 1, kind: "step" }]
});
const parsed = validateReplayRecord(JSON.parse(JSON.stringify(record)));
console.log(parsed.commands[0].kind); // step
engine.dispose();
```

## Scope of this inventory

P02-01 documented the Phase 02 public boundary and compatibility classes. The
[TypeScript declaration baseline](typescript.md) and strict consumer checks were
merged in PR #34.
P02-03 adds structured error metadata at selected public boundaries. Phase 02
also ships package validation, isolated JavaScript and TypeScript consumers, tested
examples, and focused guides. This inventory does not establish a stable release.
