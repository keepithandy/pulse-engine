# P03-06 — Named deterministic random streams

**Status:** proposed; no runtime implementation  
**Dependencies:** current seeded PRNG and snapshot/restore contracts; P03-04 digest fixtures should be available before final merge.  
**Goal:** prevent adding an unrelated random consumer from shifting existing system outcomes.

## Contract options requiring review

Prefer an opt-in extension to the engine's scoped random API:

```ts
context.random.stream("world.weather").integer(1, 6);
context.random.stream("world.loot").float();
```

Names must be non-empty canonical strings, case-sensitive, use no surrounding whitespace, have a documented max length, and reject invalid types without advancing any stream. Stream access must expire at the end of the synchronous hook, exactly as current random handles do. A repeated lookup for the same name within an action must refer to one shared stream state. Plugins can adopt streams incrementally; existing `random.float/integer/pick/next` must remain unchanged.

## Derivation and storage

- Derive a stream's initial PRNG state from the engine seed plus a **domain-separated**, versioned stream namespace. Do not use JS `String.hashCode`, locale-sensitive conversion or object traversal order.
- Track every named stream's state, sorted by canonical name when saved. Stream creation order must not influence its sequence; adding `world.weather` must not affect `world.loot` or the legacy default stream.
- Save/restore, fork, failed dispatch rollback, rejected ticks and checkpoint digests must include named stream state. A missing optional stream collection in legacy snapshot/save data must mean no named streams, not a changed legacy seed.
- Never persist an in-memory function or the transient stream handle. PRNG substream state is simulation data, not a new runtime dependency.
- State the policy for registering a stream after restoration; the same seed+name initializes it to the same state, but an existing named stream resumes from its saved position.
- Review whether the change needs a new snapshot-format version or an optional backward-compatible field. **Do not silently alter existing JSON save semantics**; migration tests are mandatory for any new persisted field.

## Regression and property fixtures

1. Capture golden legacy `float`/`integer`/`pick` samples and snapshots: identical results with no named-stream calls.
2. Interleave streams in two different access orders; sequences for each name must match. Add an unrelated named stream; other streams remain unchanged.
3. Rejected dispatch and a throwing hook must roll back **all** sampled streams and the existing random state. Repeat after snapshot restore/fork and after save round-trip.
4. Verify names with Unicode, whitespace, reserved objects' property names and excessive size reject or behave by a documented canonical rule.
5. Test escaped random handles, asynchronous use and post-disposal/lifecycle boundaries.
6. Confirm Node 22/24, Chromium/WebKit, TypeScript and isolated packaged consumers against golden fixtures. Keep coverage gates and existing smoke passing.

## Out of scope / release gate

Do not replace the default PRNG, alter existing combat/game balance, add nondeterministic entropy, or invent a plug-in-specific seed. Keep draft until a compatibility decision, migration fixtures, implementation and green cross-runtime checks are reviewed.
