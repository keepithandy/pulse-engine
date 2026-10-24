import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, createWorldPlugin, validateWorldState } from "../src/index.js";

test("world validation rejects malformed restores atomically", () => {
  const engine = createEngine({ plugins: [createWorldPlugin()], validateState: validateWorldState });
  engine.dispatch({ type: "world/entity.create", entityType: "actor", entityId: "hero" });
  const before = engine.snapshot();
  for (const mutate of [
    w => w.order.push("hero"), w => w.order.push("missing"),
    w => w.order.splice(0), w => w.entities.hero.components = [],
    w => w.nextEntity = 0, w => w.entities.hero.type = " actor "
  ]) {
    const bad = structuredClone(before);
    mutate(bad.state.world);
    assert.throws(() => engine.restore(bad));
    assert.deepEqual(engine.snapshot(), before);
  }
  engine.importSave(engine.exportSave());
  assert.deepEqual(engine.snapshot(), before);
});

test("consumer validation checks initialization and restore without mutating live state", () => {
  assert.throws(() => createEngine({ validateState: () => false }));
  assert.throws(() => createEngine({ validateState: () => Promise.resolve(true) }));
  let engine;
  engine = createEngine({ initialState: { count: 0 }, validateState(state) {
    assert.ok(Object.isFrozen(state));
    if (engine) assert.throws(() => engine.dispatch({ type: "test" }), /Reentrant/);
    return state.count >= 0;
  } });
  const before = engine.snapshot();
  const bad = structuredClone(before);
  bad.state.count = -1;
  assert.throws(() => engine.restore(bad));
  assert.deepEqual(engine.snapshot(), before);
  engine.restore(before);
});
