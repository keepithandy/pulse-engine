# Phase 01 adversarial contract matrix

This matrix connects each confirmed baseline finding to its public boundary,
regression fixture, and unchanged-state assertion. The original failure symptoms
are recorded in the [development roadmap review findings](PULSE-ENGINE-DEVELOPMENT-ROADMAP.md#confirmed-findings).

| Finding | Baseline failure | Public entry points and regression coverage | Rejection invariant |
| --- | --- | --- | --- |
| F01 — Array accessors | An indexed getter ran during validation/copying. | `test/data.test.js`: `assertData`, `copyData`, engine construction, dispatch, schedule, event publish, and JSON save round-trip. | Getter count stays zero; dispatch/schedule snapshots and event sequence/history stay unchanged. |
| F02 — Inherited entity names | `getEntity({}, "toString")` threw instead of returning the missing result. | `test/world.test.js`: `getEntity`, `queryEntities`, destroy, component-set, and component-remove actions. | Queries report missing; rejected mutations preserve the engine snapshot. |
| F03 — Event sequence overflow | Publishing after restoring `Number.MAX_SAFE_INTEGER` advanced to an unsafe sequence. | `test/events.test.js`: journal publish, batch prepare, and engine dispatch with a subscribed observer. | Journal/engine snapshots remain unchanged and no observer sees a partial event. |
| F04 — Invalid world restore | Duplicate order entries and dangling entity ids could enter restored state. | `test/state-validation.test.js`: malformed world restores through the engine validator; valid save import remains supported. | Every rejected restore preserves the full prior snapshot. |

P01-04 boundary regressions extend the same model: `test/completion.test.js`
covers action, revision, tick, and repeat-schedule exhaustion;
`test/world.test.js` covers generated entity exhaustion; and
`test/random.test.js` verifies invalid ranges reject without consuming PRNG state.

The baseline symptoms above were reproduced during the original review. The focused
fixtures now assert the corrected public behavior and its relevant state,
randomness, counter, and history invariants.