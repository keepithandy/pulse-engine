# TypeScript consumers

The package root includes pre-alpha declarations for all 25 runtime exports.
Import from `@keepithandy/pulse-engine`; there is no TypeScript runtime build step
or runtime dependency. The declarations follow the existing JavaScript contracts.

```ts
import { createEngine, type Plugin } from "@keepithandy/pulse-engine";

interface State { count: number }
type Command = { type: "add"; amount: number };
type Event = { type: "count/changed"; payload: { total: number } };

const counter: Plugin<State, Command, Event> = {
  id: "counter",
  onAction({ action, state, emit }) {
    // Tick actions also reach systems and rules.
    if (action.type !== "add") return;
    const count = state.count + action.amount;
    emit({ type: "count/changed", payload: { total: count } });
    return { state: { count } };
  }
};

const engine = createEngine<State, Command, Event>({
  initialState: { count: 0 }, systems: [counter]
});
engine.dispatch({ type: "add", amount: 2 });
engine.subscribeToEvents(event => {
  if (event.type === "count/changed") console.log(event.payload.total);
  if (event.type === "engine/tick") console.log(event.payload.tick);
});
```

State can be inferred from `initialState`. Specify the action and event unions when
you want the compiler to restrict dispatch, schedules, emissions, and hook results.
Engine contexts include the built-in `@pulse/tick` action, and subscriptions include
`engine/tick` events. Hook state is a detached mutable copy; published events,
schedules, and snapshots have readonly types. The optional fourth engine generic
describes a custom inspection/redaction result and is inferred when possible.

The world plug-in exposes `WorldAction`, `WorldEvent`, and `WorldState` types.
For game-owned world fields, supply your extended state to `createWorldPlugin<State>()`
and the same state/action/event parameters to `createEngine`.

## Validation boundaries

- These declarations do not prove JSON safety, finite/safe numeric bounds, canonical
  names, dependency order, valid lifecycle state, or configuration compatibility.
  Runtime validation remains authoritative; state generics describe consumer data.
- Action/tick hooks and rule callbacks reject Promise return types. Lifecycle and
  listener callbacks use TypeScript's conventional `void` return type, which can
  also accept async functions; runtime synchronous-hook requirements still apply.
- Decoded saves and snapshot labels use `unknown`. Envelope validation does not
  establish the types or validity of nested saved data. Use the engine load
  boundary and a consumer state validator for persisted data.
- Generic record builders preserve their input field types without promising nested
  validation. Direct generators and standalone evaluators keep their caller-owned
  random interface behavior.

## Verification

Run `npm run test:types`. The pinned compiler is TypeScript **7.0.2**; older compiler
versions have not been established as supported by this first declaration slice.
Strict fixtures run with NodeNext and Bundler resolution, with exact optional
properties, unchecked-index checks, and declaration checking enabled. Each configuration
checks both checkout self-reference and a temporary offline installation of the actual
tarball, without installing development dependencies in the consumer. Expected-error
examples fail the check if an invalid program unexpectedly becomes accepted.

The checker also compares declared value exports with the runtime namespace.
This is declaration/package-resolution coverage; broader installed runtime/CLI
coverage remains P02-05. Declarations and JavaScript APIs remain pre-alpha.
