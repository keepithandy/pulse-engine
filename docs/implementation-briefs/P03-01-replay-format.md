# P03-01 — Versioned replay input contract

**Status:** implementation for PR review (October 28, 2026).

## Problem and goal

The event journal records bounded outputs, not complete external input history. To reproduce simulation work deterministically, a separate versioned input log must identify the starting checkpoint, original seed, runtime configuration and the order of all host-originated commands, with scheduled/tick semantics explicit.

## Contract decisions

1. Use `pulse-engine-replay` version 1, with explicit `engineVersion` and host-supplied `configurationId`.
2. Capture the **complete initial snapshot** before the first recorded command, not merely initial game state. Its random, scheduler and event state must pass validation before accepting a replay record.
3. Preserve original seed and verify it normalizes to the checkpoint PRNG seed; the checkpoint state owns the current PRNG position.
4. Define command kinds for dispatch, step, advance, schedule, cancelSchedule, pause and resume; use contiguous 1-based sequence.
5. Record only **external inputs**. Internal scheduled executions and emitted events are never duplicated as commands.
6. Allow optional outcome metadata for a later recorder. Reject unsupported command kinds, unexpected fields and unsafe data.
7. Do not attempt to serialize dynamic hook/plugin changes; recording policy must reject or split these runs in P03-02.
8. Keep the contract independent of save and event schema. No engine runtime API methods or behavior are changed.

## Delivered files and verification

- `src/replay.js` and package-root declarations/exports: record builder and strict detached validator.
- `docs/replay.schema.json`: installable JSON Schema, draft 2020-12.
- `fixtures/replay/counter-v1.json`: versioned test fixture with an existing pending job and representative commands.
- `test/replay-format.test.js`: round-trips, exact initial checkpoint equality, internal scheduling, malformed sequences and data, and getter safety.
- `fixtures/types/consumer.mts`: discriminated command typing and expected-error compile checks.
- `docs/replay-format.md`: protocol, policy, compatibility and next-phase boundaries.

CI gates: Node 22/24 across Windows/Linux/macOS, browser compatibility, strict installed-consumer TS checks, coverage, packaging, smoke and repository integrity. Update the roadmap checkbox **after merge and verification**, not merely on PR creation.
