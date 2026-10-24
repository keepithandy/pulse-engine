# Scenario entities and world-state mapping

## Decision

Scenario v1 keeps its current layout. `createEngineFromScenario()` places the
scenario's `entities` array at `state.entities`, alongside resources,
relationships, and game data. The entity/component world plug-in owns
`state.world`. Installing the plug-in does not copy, alias, merge, or convert the
legacy array.

The two representations may coexist. Existing scenarios keep their current meaning;
world queries inspect only `state.world`. Consumers that need to move scenario
entities into the world must opt into an explicit adapter. Phase 04, item P04-06,
will implement that adapter and its migration path.

This avoids silently creating two competing entity sources or changing the behavior
of existing scenario consumers.

## Current compatibility fixtures

1. **Legacy scenario:** Load a v1 scenario without the world plug-in. Assert
   `state.entities` is unchanged and `state.world` is absent.
2. **Opt-in world:** Load the same scenario with the world plug-in. Assert the legacy
   entities are still unchanged, the world is initially empty, and an explicit world
   create action changes only `state.world`.
3. **Separate queries:** Assert `queryEntities()` returns world records only; it does
   not project entries from `state.entities`.

## Phase 04 adapter fixture specification

When P04-06 adds the bridge, add a separate opt-in migration fixture that maps each
legacy entity's id and type to a world entity in deterministic source order. Keep
component conversion and relationship mapping explicit. Verify that duplicate or
reserved mapped ids, invalid component data, and unresolved relationship endpoints
reject before any migrated world is installed. The original legacy fixture must
continue to load unchanged when the adapter is not selected.