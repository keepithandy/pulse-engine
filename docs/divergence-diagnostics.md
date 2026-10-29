# First-divergence diagnostics (P03-05)

Pulse Engine can detect the earliest **observed** checkpoint mismatch between two runs, without returning simulation values by default. This feature builds on [replay execution](replay-execution.md) and [canonical SHA-256 digests](checkpoint-digests.md).

A replay record contains external commands and outcomes, **not** the expected state after each command. The host must collect reference and candidate checkpoint sidecars to localize a divergence. A single final digest is not enough to prove when a mismatch began.

## Produce checkpoint traces

```js
import { createCheckpointTrace, compareCheckpointTraces, replayCommands } from "@keepithandy/pulse-engine";

const checkpoints = [];
const result = replayCommands(record, {
  expectedConfigurationId: "world/v1",
  createConfiguredEngine: ({ seed }) => createTrustedEngine({ seed }),
  onCheckpoint: value => checkpoints.push(value)
});

const candidateTrace = await createCheckpointTrace({
  configurationId: "world/v1",
  commandCount: record.commands.length,
  checkpoints,
  includeSnapshots: true // Opt-in: retain sensitive state to identify paths.
});
const report = compareCheckpointTraces(referenceTrace, candidateTrace);
```

Generate `referenceTrace` from a trusted original run with equivalent `sequence`, `kind`, `tick`, `outcome` and `snapshot` entries. Prefer collecting one starting checkpoint (sequence 0) plus one after **every** external command, even if the command was rejected or a paused advance was a no-op. Do not serialize hooks or modify replay-v1 records to hold these sidecars.

`createCheckpointTrace({ configurationId, commandCount, checkpoints, includeSnapshots? })` is **async** because SHA-256 digests use Web Crypto. It returns an immutable, JSON-safe `pulse-checkpoint-trace` record (version 1). Digest, command kind, sequence, tick and outcome are retained. Full snapshots are excluded by default; pass `includeSnapshots: true` to allow detailed structural paths. The caller owns and protects the trace; it is not a signature.

## Compare and interpret

`compareCheckpointTraces(referenceTrace, candidateTrace, { includeValues?, maximumDepth?, maximumNodes? })` is synchronous because it compares precomputed digests and optional snapshots. It returns one of:

- `no-divergence`: every sequence (0 through `commandCount`) has a matching observed checkpoint with matching outcome, tick and digest.
- `different-recordings`: the configuration identities, command counts, or observed command kinds differ; do **not** treat this as a proven simulation-state mismatch.
- `insufficient-trace`: initial checkpoint or intermediate observations are absent; apparently matching samples do **not** prove that the run was identical.
- `diverged`: a digest, tick or recorded command outcome differs at the first *paired observed* sequence.

A divergence returns `firstPossibleSequence`, `firstObservedSequence`, `precision: "exact" | "interval"`, `location` (`initial-checkpoint` or `command`), command kind, both ticks, a category, and a JSON Pointer `path` when retained snapshots permit. Intervals indicate the earliest possible command *after the last matching observation*, not an invented exact first mismatch. If a run diverges and later reconverges between sparse observations, it may remain undetectable.

Categories: `config` / `commands` for different-recordings; `outcome`, `state`, `scheduler`, `random`, `events`, `metadata`, or `checkpoint` for observed mismatches. With digest-only traces, the structural category and path may remain unknown (`checkpoint`). JSON Pointer escapes `~` to `~0`, `/` to `~1`; keys are visited in deterministic UTF-16 ordinal order. Human-only snapshot labels do not affect the digest or path.

## Privacy and bounds

By default, reports contain **no state values**. Even when snapshots are present, no raw value is returned unless `includeValues: true` is explicitly supplied. Opt-in scalars are capped at 256 string characters and containers are represented by their type, not their contents. Avoid sending unredacted checkpoints to telemetry.

Structural traversal is limited by `maximumDepth` (default 32; max 128) and `maximumNodes` (default 10,000; max 1,000,000). When a limit prevents identifying the path, the report returns `path: null` and `traversalLimited: true`, not a guessed location.

Traces are validated and detached using Pulse Engine's JSON-safe policy, so custom getters, unsupported prototypes, sparse arrays and cycles are not evaluated. Unsupported trace versions fail with `PULSE_COMPATIBILITY`. Trace validation checks shape, ordering and declared digest format; **synchronous comparison cannot authenticate externally supplied digests or prove they match attached checkpoints**. Use `createCheckpointTrace` to compute digests from trusted snapshots, and protect reference traces against tampering. Host configuration identity is asserted but not authenticated by the trace.

## Verification

Node 22/24 on Windows, macOS and Linux; browser Chromium/WebKit; isolated installed-package consumer; strict TypeScript consumer; replay-driven integration; scheduler, PRNG, event, state and metadata mutations; JSON Pointer escaping; missing versus null; transient divergence, incomplete/sparse sidecars and default no-value behavior. No save, snapshot, replay-v1 or simulation-rule changes.
