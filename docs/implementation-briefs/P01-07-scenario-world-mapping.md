# P01-07 — Define scenario-to-world mapping

## Decision

Keep scenario v1 entities at `state.entities` and world plug-in data at
`state.world`. They are separate representations; the engine performs no implicit
copy, alias, merge, or conversion. Preserve the legacy representation for existing
scenario consumers. An explicit adapter and migration path belong to P04-06.

## Acceptance

Document current behavior and the future migration fixture requirements. Add a
regression proving an opt-in world plug-in does not alter legacy scenario entities
and that world creation changes only `state.world`.

## Out of scope

Do not change scenario v1 shape or add automatic world migration in Phase 01.