import assert from "node:assert/strict";
import test from "node:test";

import { createEngine, createEventJournal } from "../src/index.js";

test("publishes immutable, ordered event envelopes", () => {
  const journal = createEventJournal();
  const first = journal.publish({
    type: "resource/changed",
    payload: { resource: "water", amount: -2 }
  });
  journal.publish({ type: "outpost/stable" });

  assert.equal(first.event.id, "event-000001");
  assert.equal(Object.isFrozen(first.event), true);
  assert.equal(Object.isFrozen(first.event.payload), true);
  assert.deepEqual(
    journal.read().map((event) => event.type),
    ["resource/changed", "outpost/stable"]
  );

  assert.throws(() => {
    first.event.payload.amount = 999;
  }, TypeError);
  assert.equal(journal.read()[0].payload.amount, -2);
});

test("filters subscriptions and isolates listener errors", () => {
  const journal = createEventJournal();
  const seen = [];
  journal.subscribe((event) => seen.push(event.type), { type: "warning" });
  journal.subscribe(() => {
    throw new Error("subscriber failure");
  });

  journal.publish({ type: "notice" });
  const result = journal.publish({ type: "warning" });

  assert.deepEqual(seen, ["warning"]);
  assert.equal(result.listenerErrors.length, 1);
  assert.equal(journal.read().length, 2);
});

test("enforces the configured history limit", () => {
  const journal = createEventJournal({ historyLimit: 2 });

  journal.publish({ type: "one" });
  journal.publish({ type: "two" });
  journal.publish({ type: "three" });

  assert.deepEqual(
    journal.read().map((event) => event.type),
    ["two", "three"]
  );
});
test("event sequence exhaustion rejects publication and batches before mutation", () => {
  const journal = createEventJournal();
  journal.restoreState({ format: "pulse-event-journal", version: 1, sequence: Number.MAX_SAFE_INTEGER, history: [] });
  const before = journal.exportState();
  assert.throws(() => journal.publish({ type: "overflow" }), /Event sequence/);
  assert.deepEqual(journal.exportState(), before);

  journal.restoreState({ format: "pulse-event-journal", version: 1, sequence: Number.MAX_SAFE_INTEGER - 1, history: [] });
  const almostExhausted = journal.exportState();
  assert.throws(() => journal.prepare([{ type: "one" }, { type: "two" }]), /Event sequence/);
  assert.deepEqual(journal.exportState(), almostExhausted);
});

test("engine event exhaustion rolls the action back before publishing", () => {
  const engine = createEngine({ systems: [{ id: "event-source", onAction({ action }) {
    if (action.type === "emit") return { events: [{ type: "emitted" }] };
  } }] });
  const checkpoint = structuredClone(engine.snapshot());
  checkpoint.events.sequence = Number.MAX_SAFE_INTEGER;
  engine.restore(checkpoint);
  const before = engine.snapshot();
  let observed = 0;
  engine.subscribeToEvents(() => { observed += 1; });

  assert.throws(() => engine.dispatch({ type: "emit" }), /Event sequence/);
  assert.deepEqual(engine.snapshot(), before);
  assert.equal(observed, 0);
});
