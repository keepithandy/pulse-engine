import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.js";

const checkpointReaders = {
  snapshot: engine => engine.snapshot({ label: "autosave" }),
  fork: engine => engine.fork("autosave"),
  exportSave: engine => engine.exportSave()
};

function makeEngine(plugins = []) {
  return createEngine({ initialState: { count: 0 }, seed: "checkpoint-boundary", plugins: [{
    id: "counter",
    onAction({ action, state, random }) {
      if (action.type === "fail") throw new Error("Scheduled failure.");
      if (action.type !== "add") return;
      return {
        state: { count: state.count + random.integer(1, 3) },
        events: [{ type: "count/changed" }, { type: "count/recorded" }]
      };
    }
  }, ...plugins] });
}

function assertCheckpointBlocked(engine) {
  for (const read of Object.values(checkpointReaders)) {
    assert.throws(() => read(engine), /Checkpoints are unavailable during engine operations/);
  }
  // Ordinary diagnostic reads remain available inside callbacks.
  assert.equal(typeof engine.getState().count, "number");
  assert.equal(engine.getTick(), engine.inspect().tick);
}

test("event and state observers cannot export a partially published action", () => {
  const engine = makeEngine();
  const observations = [];
  engine.subscribeToEvents(event => {
    observations.push(event.type);
    assertCheckpointBlocked(engine);
  });
  engine.subscribe(() => {
    observations.push("state");
    assertCheckpointBlocked(engine);
  });

  const result = engine.dispatch({ type: "add" });
  assert.deepEqual(result.eventListenerErrors, []);
  assert.deepEqual(result.listenerErrors, []);
  assert.deepEqual(observations, ["count/changed", "count/recorded", "state"]);
  assert.equal(engine.snapshot({ label: "complete" }).label, "complete");
  assert.equal(engine.snapshot().events.sequence, 2);
  assert.equal(engine.snapshot().events.history.length, 2);

  const restored = makeEngine();
  restored.importSave(engine.exportSave());
  assert.deepEqual(restored.snapshot(), engine.snapshot());
  engine.dispatch({ type: "add" });
  restored.dispatch({ type: "add" });
  assert.deepEqual(restored.snapshot(), engine.snapshot());
});

test("tick checkpoints wait for every due job and preserve future execution", () => {
  let engine;
  const observed = [];
  engine = makeEngine([{
    id: "checkpoint-observer",
    onEvent({ event }) {
      observed.push(event.type);
      assertCheckpointBlocked(engine);
    },
    afterTick() {
      observed.push("afterTick");
      assertCheckpointBlocked(engine);
    }
  }]);
  engine.subscribe(() => assertCheckpointBlocked(engine));
  engine.subscribeToEvents(() => assertCheckpointBlocked(engine));
  engine.schedule({ type: "add" }, { at: 1, interval: 2, limit: 3 });
  engine.schedule({ type: "fail" }, { at: 1 });
  engine.schedule({ type: "add" }, { at: 1 });

  const step = engine.step();
  assert.equal(step.advanced, true);
  assert.deepEqual(step.result.pluginErrors, []);
  assert.deepEqual(step.result.listenerErrors, []);
  assert.deepEqual(step.result.eventListenerErrors, []);
  assert.deepEqual(step.scheduled.map(result => result.accepted), [true, false, true]);
  for (const result of step.scheduled.filter(result => result.accepted)) {
    assert.deepEqual(result.pluginErrors, []);
    assert.deepEqual(result.listenerErrors, []);
    assert.deepEqual(result.eventListenerErrors, []);
  }
  assert.deepEqual(observed, ["engine/tick", "afterTick", "count/changed", "count/recorded", "count/changed", "count/recorded"]);
  assert.equal(engine.getSchedules().length, 1);
  assert.equal(engine.getSchedules()[0].at, 3);
  assert.ok(engine.getEvents().every(event => event.tick === 1));
  assert.deepEqual(engine.fork("autosave").state, engine.getState());

  const restored = makeEngine();
  restored.importSave(engine.exportSave());
  assert.deepEqual(restored.snapshot(), engine.snapshot());
  engine.advance(4);
  restored.advance(4);
  assert.deepEqual(restored.snapshot(), engine.snapshot());
});

test("checkpoint attempts during processing reject without changing the checkpoint", () => {
  for (const read of Object.values(checkpointReaders)) {
    let engine;
    engine = makeEngine([{
      id: "checkpoint-in-action",
      onAction() { read(engine); }
    }]);
    engine.schedule({ type: "add" }, { at: 1 });
    const before = engine.snapshot();
    assert.throws(() => engine.dispatch({ type: "add" }), /Checkpoints are unavailable during engine operations/);
    assert.deepEqual(engine.snapshot(), before);
    assert.throws(() => engine.step(), /Checkpoints are unavailable during engine operations/);
    assert.deepEqual(engine.snapshot(), before);
  }
});

test("uncaught observer checkpoint errors are reported without reverting a commit", () => {
  const engine = makeEngine();
  engine.subscribe(() => engine.snapshot());
  engine.subscribeToEvents(() => engine.exportSave());
  const result = engine.dispatch({ type: "add" });
  assert.equal(result.accepted, true);
  assert.equal(result.listenerErrors.length, 1);
  assert.equal(result.eventListenerErrors.length, 2);
  assert.equal(engine.snapshot().revision, 1);
  assert.equal(engine.getEvents().length, 2);

  const saved = engine.exportSave();
  const checkpoint = engine.snapshot();
  engine.dispose();
  assert.equal(engine.exportSave(), saved);
  assert.deepEqual(engine.snapshot(), checkpoint);
  assert.deepEqual(engine.fork("disposed-copy").state, checkpoint.state);
});
