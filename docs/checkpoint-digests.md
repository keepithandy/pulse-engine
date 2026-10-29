# Canonical checkpoint digests (SHA-256 v1)

P03-04 provides a deterministic, versioned checksum of the entire simulation checkpoint. It complements [replay execution](replay-execution.md): replay reconstructs state, while this utility can compare checkpoint identities across processes, Node.js and browsers.

```js
import { createEngine, digestCheckpoint } from "@keepithandy/pulse-engine";
const engine = createEngine({ initialState: { energy: 5 }, seed: "outpost-1" });
const before = engine.snapshot();
const fingerprint = await digestCheckpoint(before); // sha256-v1:<64 lowercase hexadecimal>
engine.dispose();
```

## Exact v1 byte contract

1. The input must be valid JSON-safe data and a compatible snapshot. The utility detaches it, validates the snapshot header, PRNG, event journal and scheduler **before hashing**. It rejects unknown checkpoint root fields rather than silently leaving out possible simulation data. Legacy omitted tick/schedule fields are normalized by the current snapshot validator.
2. Include exactly `format`, `version`, `engineVersion`, `branch`, `revision`, `actionSequence`, `tick`, `state`, `randomState`, `schedules`, `events`. Exclude only the human-oriented `label` property.
3. Canonicalize recursively: arrays preserve index order; plain-object keys sort in ascending JavaScript **UTF-16 code-unit order** using ordinal comparisons, independent of insertion order. Write object entries directly in that order; a normal `JSON.stringify(object)` would reorder integer-like keys. Values and keys use JavaScript `JSON.stringify` escaping and number formatting. Unicode bytes are UTF-8 from `TextEncoder`. Do not normalize Unicode strings, whitespace, numbers or event-history arrays.
4. The exact hash input is UTF-8 encoding of `pulse-engine/checkpoint/sha256-v1\n` followed immediately by that canonical JSON object (the `\n` denotes one newline character, not two literal characters).
5. Hash with `crypto.subtle.digest("SHA-256", bytes)`; return `sha256-v1:` followed by 64 **lowercase** hexadecimal characters. The API is `async`/`Promise<string>` and runs outside the synchronous engine hook pipeline. No runtime dependencies or fallback crypto algorithms are used.
6. A change to this canonical byte contract requires a new digest version (e.g. `sha256-v2`); it must not quietly change v1 results.

## Identity, semantics and limitations

- All recorded state, tick/revision/sequence counters, branch metadata, PRNG state, retained event-journal **content and ordering**, and scheduler content/order participate in the digest. Different event retention capacities can therefore change checkpoint hashes if they produce different retained event histories. Event **capacity itself** is host configuration and does not appear in the saved checkpoint.
- Different snapshot labels produce the **same** digest. A checkpoint digest is not an authenticity proof: anyone able to change a checkpoint can recompute it. Signatures or trusted storage are separate concerns.
- Configuration identity and executable system code are **not** in the snapshot. A matching checksum says checkpoints match; it does not prove the host was configured with the same rules. Compare `configurationId` independently before replay.
- Malformed values (getters, cycles, holes, prototypes, negative zero, NaN, infinity) reject. Unsupported snapshot versions use the existing compatibility error; missing global Web Crypto / `TextEncoder` uses `PULSE_DIGEST`.
- The engine's snapshot semantic validators do not know game-specific `validateState` hooks; a host must still validate its own world rules. Digest validation is about the **portable checkpoint**, not whether the current host can execute its rules.

## Conformance

The versioned [golden fixture](../fixtures/checkpoint-digests/v1-golden.json) pins a known SHA-256 value for nested objects, integer-like keys, Unicode, arrays and numeric limits. Tests verify label invariance and changes to each identity field, invalid snapshots, repeated hashing of large checkpoints, and replay output equivalence. The package is checked from an isolated installed tarball and the CI matrix executes the golden value in Node.js 22/24, Chromium and WebKit.

Canonical state diffs and first-mismatch path reporting remain P03-05.
