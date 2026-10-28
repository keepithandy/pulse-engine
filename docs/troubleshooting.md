# Troubleshooting

## `ERR_PACKAGE_PATH_NOT_EXPORTED`

Import from `@keepithandy/pulse-engine`, not `@keepithandy/pulse-engine/src/engine.js`. The package exposes a deliberate root entry point.

## `Pulse Engine actions require a non-empty type`

Pass a JSON-safe object with a nonblank string `type`, such as `{ type: "counter/add" }`. Array actions, functions in action data, and unsupported values are rejected.

## `expected JSON-safe data` or `runtime objects are unsupported`

Use plain records and dense arrays containing JSON-safe primitives. Do not put class instances, cyclic references, symbols, accessors, functions, undefined, non-finite numbers, or `-0` into engine state or events. See [Engine contracts](engine-contracts.md#json-safe-data-boundaries).

## `Engine has been disposed`

Do not mutate or subscribe after `dispose()`. Create a new engine. Detached reads of previously committed state remain possible; see [lifecycle contracts](engine-contracts.md).

## `Reentrant engine mutation is unsupported`

Do not call `dispatch`, `step`, or schedule mutations from an action hook. Emit events or return the new state; invoke the next mutation after the outer operation finishes.

## `Snapshot engine version ... is incompatible`

Save and snapshot compatibility is strict in pre-alpha. Configure matching systems and state validators before importing. Do not assume automatic migrations for engine or consumer-owned schemas. Read [Compatibility](compatibility.md) before changing stored data.

## `pulse-run` rejects a scenario

Check `--scenario` path, JSON syntax, version 1, valid system ids, unique entities, resource numbers, and relationship references. The bundled runner only recognizes the example `resource-flow` system. Run `node bin/pulse-run.js --help` for valid flags.

## Tests pass locally but the packed package does not import

Run `npm run check:package`, `npm run test:types`, and the installed-consumer test when available. A source-relative import can hide missing packed exports or declarations. See [Getting started](getting-started.md).
