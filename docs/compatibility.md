# Compatibility and upgrade policy

**Current stage:** `0.1.0-alpha.0`, pre-alpha. The project does not promise semver-stable exports, save compatibility, or plug-in ABI stability yet. Changes require review and release notes before consumers treat them as stable.

## Current versioned surfaces

| Surface | Current policy |
| --- | --- |
| Package root | Documented in [Public API reference](public-api.md); pre-alpha changes are possible |
| Actions/events | Synchronous, JSON-safe data; event envelope version 1 |
| Scenarios | Scenario version 1; validator and `resource-flow` example are shipped |
| Snapshots | Format `pulse-engine-snapshot`, version 1; exact engine version enforced |
| Save files | `pulse-engine-save`, version 1; version-0 envelope migration available |
| Randomness | Named algorithm stored in snapshots and validated on restore |
| Plug-ins | Functions are re-registered at construction; not serialized |
| Type declarations | Compiler aid, not a replacement for runtime validation |

## Safe upgrade procedure

1. Copy a representative save and fixture before changing a consumer.
2. Install the intended package version in an isolated consumer and run its CLI/import tests.
3. Re-register the same plug-ins, rule configuration, and consumer state validator.
4. Verify imported snapshots, event sequence, scheduled jobs, state and random checkpoints.
5. Preserve fixtures for successful restores and explicit rejection cases before deploying.

`deserializeSave` unwraps a save envelope; it **does not** validate the full nested engine snapshot. Use `engine.importSave` or `engine.restore` for complete engine component validation and any configured consumer `validateState` function.

There is no automatic migration of arbitrary game-owned component schemas or plug-in code. Consult the [development roadmap](PULSE-ENGINE-DEVELOPMENT-ROADMAP.md) for future compatibility work.
