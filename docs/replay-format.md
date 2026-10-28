# Replay input format (v1)

**Scope:** Phase 03, work item P03-01. This document specifies the portable, versioned **inputs** needed to reproduce a deterministic run. It is not a replay recorder or replay executor. Those are P03-02 and P03-03.

See the [JSON Schema](replay.schema.json) for the serialized envelope and the [fixture](../fixtures/replay/counter-v1.json) for a full example. These two files are separate: the schema is included in the installable package, while the test fixture stays in the checkout.

## Record contract

```json
{
  "format": "pulse-engine-replay",
  "version": 1,
  "engineVersion": "0.1.0-alpha.0",
  "configurationId": "my-game/rules-v1",
  "seed": 17,
  "initialSnapshot": { "format": "pulse-engine-snapshot", "...": "full engine.snapshot() record" },
  "commands": [
    { "sequence": 1, "kind": "dispatch", "action": { "type": "world/inspect" } },
    { "sequence": 2, "kind": "step" },
    { "sequence": 3, "kind": "advance", "count": 3 }
  ]
}
```

- **`format` and `version`:** replay protocol identity, separate from saves, snapshots, scenario files, and bounded event journals.
- **`engineVersion`:** engine compatibility lock. Unknown versions fail with a compatibility error.
- **`configurationId`:** nonblank, host-owned identity for the *complete runtime configuration* (plug-ins, their versions/order, rules, validators and consumer schemas). The engine does not hash or validate the identity against loaded code. The future executor must enforce host-provided configuration compatibility, never infer it from a snapshot.
- **`seed`:** caller's original numeric/string seed; for this v1 format its normalized seeded-random identity must equal `initialSnapshot.randomState.seed`. The **checkpoint** owns the PRNG *position* and restores it; restarting from the seed alone would lose earlier random draws.
- **`initialSnapshot`:** full detached checkpoint from immediately before the first recorded external command, including `state`, `tick`, `revision`, `actionSequence`, branch, random state, pending scheduler jobs and event journal metadata. Preserve the snapshot even if the bounded event journal has evicted older output.
- **`commands`:** contiguous safe-integer sequence numbers starting at 1, in order. An empty log is valid. Optional `outcome` describes an observed command's `accepted`, `rejected` or `error` status, with an optional string failure reason (required for `error`). It is metadata, not an instruction to skip execution.

## External commands

| `kind` | Required payload | Meaning |
| --- | --- | --- |
| `dispatch` | `action` | One host-initiated action dispatched without advancing time |
| `step` | — | One host-initiated tick attempt, including all internally due jobs |
| `advance` | `count` | One host-initiated advance call, with a non-negative safe-integer count |
| `schedule` | `action`, `options` | Enqueue a future action with `at`, optional `interval`, `limit` and `id` |
| `cancelSchedule` | `id` | Host-initiated cancellation by schedule id |
| `pause` | — | Host time-control call |
| `resume` | — | Host time-control call |

Each command allows only the listed fields plus `sequence`, `kind` and optional `outcome`. Schedule options match `engine.schedule`: `at` is a non-negative safe integer, `interval` and `limit` are positive safe integers or `null` when supplied, and multiple runs require an interval. Feasibility relative to the *current tick* is evaluated during replay, not when validating the static record.

**No internal work may be recorded as another external input.** If the host calls `step()` and that tick triggers three scheduled actions, record *one* `step`, not the three scheduled dispatches, `engine/tick`, or emitted events. The same applies to `advance(count)`; the executor must call it once with the recorded count, even if pause or rejection stops it early.

**Dynamic plug-in/rule changes are not replayable in v1.** Do not serialize hook functions or treat a registration as a command. P03-02 must either reject sessions with dynamic runtime changes or close one recording and begin a new one with a fresh configuration identity and checkpoint. This prevents silently replaying a different system graph.

## Public helpers

```js
import { createEngine, createReplayRecord, validateReplayRecord } from "@keepithandy/pulse-engine";

const engine = createEngine({ initialState: { count: 0 }, seed: 17 });
const replay = createReplayRecord({
  configurationId: "counter-v1", seed: 17, initialSnapshot: engine.snapshot(),
  commands: [{ sequence: 1, kind: "step" }]
});
const parsed = validateReplayRecord(JSON.parse(JSON.stringify(replay)));
console.log(parsed.commands[0].kind); // "step"
engine.dispose();
```

`createReplayRecord` constructs a detached, deeply frozen record, defaulting to an empty command log. `validateReplayRecord` checks the version, expected fields, JSON-safe input, contiguous command order, seed identity and **complete random/event/scheduler checkpoint subrecords** using throwaway subsystem instances. It neither mutates the supplied record nor runs any command. Both helpers are synchronous and have no new dependencies.

## Distinguishing other engine records

| Record | Stores | Constraint |
| --- | --- | --- |
| Replay input log | Starting checkpoint, configuration identity, seed, **external commands** | Full command history is required for replay |
| Event journal | Committed output events | Bounded, may omit older events and never captures rejected input calls |
| Snapshot | Engine checkpoint at one point | Contains current scheduler/PRNG and optional bounded event history, but not complete input history |
| Save | JSON envelope around a snapshot | Existing versioning and save-migration rules remain unchanged |

## Compatibility and follow-up boundaries

This is a **pre-alpha v1 input schema**, not a stable external file guarantee. The validator rejects unknown top-level/command fields, unknown operation kinds, unsupported format/version/engine-version values, invalid sequences, unsafe payloads and broken starting checkpoints. The JSON Schema describes the portable shape; JavaScript validation additionally enforces safe integer bounds, accessor-inert JSON-safe data, exact versions, original PRNG seed identity and nested subsystem invariants.

P03-02 will own a recorder, streaming/capture policies and accepted/rejected outcomes. P03-03 will own execution, observer policy and checkpoint comparison. P03-04 will define canonical checkpoint hashes. This PR **does not** modify engine dispatch, tick scheduling, saves, events, randomness or plug-in lifecycles.
