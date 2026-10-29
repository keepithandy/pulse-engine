# P03-04 — Canonical checkpoint digests

**Status:** proposed, implementation not started  
**Depends on:** P01 data policy (complete), P03-01 replay envelope (merged). Can be implemented independently of the recorder.  
**Deliverable:** portable, versioned canonical checkpoint digest for use in replay validation; no change to the engine's synchronous state-transition pipeline.

## Contract proposal

Expose a post-checkpoint utility `digestCheckpoint(snapshot)` returning a stable, versioned SHA-256 digest, e.g. `sha256-v1:<64 lowercase hexadecimal characters>`. It may be asynchronous (Web Crypto API) because it runs **after** a command, not in the synchronous engine hook pipeline. Node 22+ and supported browsers provide `crypto.subtle`; unsupported environments fail explicitly rather than silently using a weaker algorithm.

Publish a named `canonicalCheckpointBytes(snapshot)` helper only if needed by reference fixtures; do not expose a general-purpose serializer prematurely.

## Canonical input definition

- Validate and **detach** through the engine's JSON-safe data boundary; do not invoke getters or mutate caller input.
- Hash checkpoint fields defining simulation identity: `engineVersion`, `version`, `branch`, `revision`, `actionSequence`, `tick`, `state`, `randomState`, `schedules`, `events`. Ignore human-only `label`, document why.
- Arrays preserve original index order. Object property names sort using a specified ordinal string ordering that works identically in JS runtimes; do not use locale-aware sorting or enumeration order.
- Preserve JSON-safe number identity and standard JSON serialization, with a single specified UTF-8 text encoding; disallow `-0`, NaN, infinities, holes, cyclic structures, symbols, accessors and prototype-bearing runtime objects per existing validation.
- Include a fixed domain/version prefix in the hashed bytes to prevent accidental reuse across future formats. Treat schema evolution as `v2`, not silent changes to v1.
- No hashing of engine functions, UI state, wall-clock timestamps or external hooks. Callers are responsible for protecting a digest from tampering; it is **not a signature**.

## Fixtures and acceptance

1. Golden fixture with nested objects in differing insertion orders, Unicode keys, escaped Unicode, array order, empty arrays/objects, negative/decimal numbers and integer boundaries.
2. Equivalent snapshots with differently ordered plain-object keys produce the same digest. Different tick, state, PRNG, schedule, event sequence or branch produces a different digest. Different `label` produces the same digest.
3. Invalid JSON data, malicious getters, cyclic objects, incompatible snapshot format/version and malformed numeric values reject before any digest succeeds.
4. Recompute golden digests on Node 22, Node 24, Chromium and WebKit; commit expected values as reviewed fixtures. Verify the packed install and TypeScript declarations.
5. Hash multiple large representative checkpoints to record cost without claiming performance improvements.

## Review decisions

Confirm inclusion of branch identity and whether event history capacity is part of the canonical contract. Resolve the function's async return type before implementation. Document impact of an existing snapshot being valid structurally but invalid semantically.

## Exclusions and merge gate

No engine internals rewrite, snapshots/save format change, dependency addition, UI or divergence report. Keep draft until implementation, supported-runtime fixtures, docs and green CI are reviewed. The roadmap checkbox stays unchecked until complete.
