# P03-05 — First-divergence diagnostics

**Status:** implemented on PR #45; CI verification pending  
**Depends on:** P03-03 replay execution + P03-04 canonical checkpoint digests (both merged).  
**Goal:** identify the earliest *observed* mismatch between an authoritative run and a replay without exposing entire state by default.

## Important limitation

A P03-01 replay record holds inputs/outcomes, **not a complete baseline checkpoint after each command**. A final digest alone cannot prove which earlier command first diverged. This feature therefore needs reference and candidate **checkpoint traces** (or full deterministic re-execution of both), not just the replay input plus a final digest.

## Implemented interface

```ts
compareCheckpointTraces(reference, candidate, {
  includeValues?: false,  // privacy-preserving default
  maximumDepth?: number,
  maximumNodes?: number
}): DivergenceReport
```

Traces are host-owned immutable sidecars created asynchronously by `createCheckpointTrace` using the existing SHA-256 digest API, keyed by replay `sequence`, `kind`, `tick`, `configurationId`, `digest` and (optional) detached checkpoint. Version their format independently of the P03-01 replay envelope. A trace can be constructed by P03-03's checkpoint callback; do not expand the v1 record's allowed keys silently.

## Reporting algorithm

1. Validate both trace envelopes, matching configuration identity and ordered contiguous commands.
2. Compare the first checkpoint (sequence 0) before processing inputs. If different, report `initial-checkpoint` instead of misattributing a command.
3. Scan pairs in input order and find the earliest **recorded** digest mismatch. Include sequence, command kind, reference tick, observed tick and a stable classification (`config`, `outcome`, `state`, `scheduler`, `random`, `events`, `metadata`).
4. If both checkpoints are available, structurally compare their canonical data in deterministic key order to report the first differing JSON Pointer path, including escaping `~` and `/`; return paths and categories, not raw values by default.
5. Distinguish `no-divergence`, `different-recordings`, `insufficient-trace`, and `diverged`. If checkpoints are sparse, identify the interval of first divergence, **not** an exact unproven command.
6. Bound traversal depth, number of nodes, and output size; avoid accidentally executing getters via host-supplied trace data. Fail on incompatible trace versions.

## Tests and acceptance

- Intentionally change one action outcome, state component, scheduler job, PRNG state, event sequence and initial configuration. Assert exact first category/sequence/path and correct no-leak behavior.
- Nested keys containing `/` and `~`, arrays, different insertion ordering, null vs absent key, and same final state from different intermediate histories.
- No-checkpoint and sampled-checkpoint traces must be reported as incomplete with an honest bound.
- Confirm comparisons never mutate input, execute getters, or return state values unless explicitly opted in.
- Test direct API, TypeScript consumers and packed Node usage; replay fixtures run across Node 22/24, Chromium and WebKit.

## Scope boundary / merge gate

No logs to stdout, UI inspector, interactive diff viewer, serialization of executable hooks or changes to existing replay/save schema. Keep this PR draft until P03-03 and P03-04 are ready, implementation passes all gates, and privacy behavior is reviewed.

## Implementation evidence

- New `src/checkpoint-traces.js` validates strict, versioned sidecars and compares the first paired observed outcome, tick or SHA-256 digest difference.
- `test/checkpoint-traces.test.js` verifies real replay callbacks and state, scheduler, random, event, outcome and initial-checkpoint mismatches, privacy, sparse intervals and traversal ceilings.
- Root TypeScript declarations, browser fixture, installed-tarball JavaScript test, API reference and documentation are updated.
- Source record schemas, runtime math and saved-game formats are unchanged. This implementation does **not** claim that a final digest or sparse traces can establish an exact first divergence.
