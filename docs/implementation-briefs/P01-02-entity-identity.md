# P01-02 — Harden entity identity and lookups

## Scope

Use own-property checks wherever world entity records are read. Apply one
boundary policy to plug-in ids, generated-id prefixes, entity ids, entity types,
component names, and query filters: trim surrounding whitespace, reject empty
values, and reject `__proto__`, `prototype`, and `constructor` after trimming.
Store and return canonical names. Normalize component names supplied during
entity creation and reject collisions created by normalization.

## Confirmed behavior to cover

- `getEntity({}, "toString")` throws instead of returning `null` because the
  current lookup reads an inherited function.
- `queryEntities` can treat an inherited function as an entity when an order
  entry has no matching own record.
- World mutation hooks read entity records without checking ownership, so
  inherited names do not follow the documented unknown-entity path.
- Reserved names surrounded by whitespace pass the current pre-trim check.
- `getEntity` returns the caller's untrimmed id even though lookup trims it.

## Acceptance

- Missing inherited names return `null` or an empty query result.
- Destroy and component actions against inherited names reject without changing
  the snapshot.
- Whitespace inputs resolve to the same canonical entity/component names.
- Reserved names reject after trimming; normalization collisions reject without
  changing the snapshot.
- Focused world tests, lint, coverage, package, smoke, browser, and integrity
  checks pass.

## Out of scope

Do not change world schemas, save formats, deterministic counter policy, or
automatic plug-in validator registration. P01-03 handles restore validation.
