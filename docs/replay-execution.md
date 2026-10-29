# Executing replay records

P03-03 implements deterministic replay of the [v1 input protocol](replay-format.md) and can consume [P03-02 command recordings](recording.md). It executes recorded **external** commands only; scheduled work and engine tick actions remain internal to their enclosing `step()` / `advance()`.

```js
import { createEngine, replayCommands } from "@keepithandy/pulse-engine";

const run = replayCommands(record, {
  expectedConfigurationId: "counter/v1",
  createConfiguredEngine({ configurationId, seed }) {
    // The host selects the trusted matching code and configuration.
    // Never deserialize plug-in functions from the record.
    return createEngine({ seed, initialState: { count: 0 }, systems: trustedSystems });
  },
  onCheckpoint({ sequence, kind, tick, snapshot, outcome }) {
    // Optional synchronous callback, including sequence 0 for the initial checkpoint.
    // Store snapshots outside the engine for future comparison (P03-05).
  }
});
if (run.status === "completed") console.log(run.finalSnapshot);
else console.log(run.divergence);
```

## Contract

- Validate and detach the complete replay record **before** calling the host factory.
- Require explicit `expectedConfigurationId`; mismatches fail before calling external code. This is an identity check, **not** cryptographic authentication of a configuration. The host is responsible for choosing stable, identical systems, rules, handlers, validators and capacities.
- The factory receives a deeply frozen `{ configurationId, seed }` argument and must synchronously return a fresh, disposable Pulse Engine instance. The replay owns the returned instance and calls `dispose()` on all completed, failed and divergent runs.
- Restore the full starting snapshot, apply `initialPaused` and compare the restored checkpoint with the input. The human `label` is excluded from this initial comparison because it is not restored.
- Execute `dispatch`, `step`, `advance`, `schedule`, `cancelSchedule`, `pause`, `resume` in recorded sequence. Internal ticks, due scheduled jobs, events and observer calls **must not be replayed separately**.
- Compare accepted/rejected/error outcomes and supplied reason strings when present. An outcome mismatch returns `{ status: "diverged", commandCount, divergence: { sequence, kind, tick, expected, actual } }`. This deliberately excludes the full checkpoint from divergence reports. A command with no recorded outcome may succeed or reject, but an unverified throw is divergence.
- On success return a deep-frozen `{ status: "completed", commandCount, finalSnapshot }`. The final snapshot includes revision, tick, state, random generator state, event journal, schedules and branch metadata. This version does **not** prove final equivalence against an original run when the source record contains no expected final digest; canonical digest comparison follows in P03-04.
- `onCheckpoint` runs once at sequence 0 and once after each executed command, with detached, deep-frozen data. It must return synchronously. Do not use the callback to mutate a host-captured engine. Callback failures abort replay; the engine is disposed.
- Nonzero disposal failures surface `PULSE_REPLAY`, rather than silently reporting a successful replay. Source commands throwing with a matching recorded `error` outcome are expected and replay continues; never auto-retry a potentially committed operation.

## Exclusions

No dynamic plug-in code loading, wall-clock scheduling, automatic migrations, file/network I/O, canonical hashes, divergence-state value dumps or UI. Restored checkpoint compatibility depends on host configuration; no guarantee of replay equivalence exists when hooks have external state, nondeterministic I/O or a different implementation.

## Validation

`npm test`, `npm run test:types`, `npm run test:coverage`, `npm run lint`, `npm run check:package`, `npm run smoke`, and repository CI matrix for Node 22/24 and Chromium/WebKit.
