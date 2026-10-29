# P03-03 — Deterministic replay execution

**Status:** implemented on PR #43; review and CI verification pending  
**Roadmap:** Phase 03 — Replay, provenance, and determinism  
**Depends on:** P03-01 merged (#41); P03-02 command recorder (#42) merged at a372675.  
**Scope:** engine-independent replay execution API, regression tests, TypeScript declarations, and documentation. No changes to simulation rules or save schemas.

## Problem and intended contract

Pulse Engine validates durable external-command records and PR #42 supplies recording. Before this PR, it could not reconstruct a fresh configured engine and execute a complete record with outcome verification. The first consumer needs to reproduce a failure without copying its UI or application state.

Implemented package-root public API:

```ts
replayCommands(record, {
  createConfiguredEngine, // synchronous host factory, selected using record.configurationId
  expectedConfigurationId,
  onCheckpoint?         // optional synchronous callback after an external command
}): ReplayResult
```

A host **must** supply the same ordered plugins, systems, rules, validators, event-history capacity, scheduling capacity, and seed configuration. No user-provided hooks are serialized or executed from untrusted replay data. A configuration mismatch fails before running any command.

## Algorithm and safety boundaries

1. Fully validate/detach the replay envelope before calling the host factory.
2. Compare `configurationId` with the declared identity; do not treat it as executable source or a registry lookup without host approval.
3. Build a fresh engine, verify initial seed and restore its initial snapshot atomically. Apply `initialPaused` explicitly (pause state is not in the snapshot).
4. Run **only** recorded external commands, in strict contiguous sequence. Supported kinds: `dispatch`, `step`, `advance`, `schedule`, `cancelSchedule`, `pause`, `resume`. Never replay `@pulse/tick` or due scheduled actions as standalone inputs.
5. Compare observed accepted/rejected/error outcome with recorded outcome when supplied. A mismatched outcome returns an explicit failure with sequence and kind, not a silently completed replay.
6. Capture final snapshot and optional per-command checkpoints. Never leak live mutable state. Declare ownership/disposal of the newly constructed engine; clean up on failed setup and exceptions.
7. Keep execution synchronous and deterministic. A host asynchronous factory, asynchronous hook, or mutating progress callback is unsupported. Do not retry partially applied commands.

## Acceptance tests

- Record and replay a seeded counter world with an already-pending scheduled action; verify full final snapshot equality (revision, tick, state, PRNG, scheduler and event sequence).
- Cover `pause` + `advance` no-op + `resume`, schedule/cancel, duplicate scheduled-action prevention, rejection, thrown hook, and retained method references.
- Tamper seed, `configurationId`, sequence, action, outcome and snapshot; assert failure with correct first sequence and no false-success result.
- Repeat with different random seeds and with a fixture whose initial checkpoint already has history and schedules.
- Package-root JavaScript + strict NodeNext/Bundler TypeScript consumer tests; Chromium and WebKit execution in CI.
- Existing suite, lint, coverage gates, package integrity and 100-tick smoke remain passing.

## Out of scope

No automatic plug-in deserialization, network or file I/O, live game migration, wall-clock stepping, replay UI, canonical checkpoint hashing (P03-04), or user-facing divergence viewer (P03-05).

## Merge gate

Implementation and fresh CI results must replace this plan. Keep this PR **draft** until tests and a second-pass code review are complete. Do not mark P03-03 complete based on this brief.

## Implementation evidence

- `src/replay-execution.js` implements validated, synchronous execution and deterministic outcome checks, including an initial restored-state equality gate.
- `test/replay-execution.test.js` includes end-to-end recorder/replay verification, scheduled-job deduplication, initial pause, thrown and rejected commands, configuration denial, state-history capacity mismatch, callbacks and cleanup tests.
- `test/browser-fixture.html` runs the same recorder→replayer verification in Chromium and WebKit through the current Playwright CI workflow.
- `fixtures/types/consumer.mts` checks the package-root API in the strict, installed TypeScript consumer.
- This change does not yet implement digest comparison (P03-04) or structured state divergence diff (P03-05).
