import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, createWorldPlugin, getEntity, queryEntities } from "../src/index.js";

function makeWorld(options = {}) {
  return createEngine({
    initialState: { resources: { metal: 3 } },
    systems: [createWorldPlugin(), ...(options.systems ?? [])]
  });
}

test("world plugin creates deterministic entities and query returns detached data", () => {
  const engine = makeWorld();
  const first = engine.dispatch({ type: "world/entity.create", entityType: "worker", components: {
    position: { x: 2, y: 4 }, health: 10
  } });
  const second = engine.dispatch({ type: "world/entity.create", entityType: "depot", components: {
    position: { x: 0, y: 0 }, storage: { metal: 3 }
  } });

  assert.equal(first.accepted, true);
  assert.equal(first.action.entityId, undefined);
  assert.deepEqual(first.events[0].payload, { entityId: "entity-000001", entityType: "worker" });
  assert.deepEqual(second.events[0].payload, { entityId: "entity-000002", entityType: "depot" });
  const workers = queryEntities(engine.getState(), { type: "worker", with: ["position"] });
  assert.deepEqual(workers.map(entity => entity.id), ["entity-000001"]);
  workers[0].components.position.x = 99;
  assert.equal(getEntity(engine.getState(), "entity-000001").components.position.x, 2);
  assert.deepEqual(queryEntities(engine.getState(), { with: ["storage"], without: ["disabled"] })
    .map(entity => entity.id), ["entity-000002"]);
});

test("component actions update state and publish deterministic world events", () => {
  const engine = makeWorld();
  engine.dispatch({ type: "world/entity.create", entityType: "drone", entityId: "scout-1" });
  const set = engine.dispatch({ type: "world/component.set", entityId: "scout-1", component: "battery", value: 80 });
  assert.equal(set.accepted, true);
  assert.deepEqual(set.events.map(event => event.type), ["world/component.set"]);
  assert.equal(getEntity(engine.getState(), "scout-1").components.battery, 80);
  const remove = engine.dispatch({ type: "world/component.remove", entityId: "scout-1", component: "battery" });
  assert.equal(remove.accepted, true);
  assert.deepEqual(queryEntities(engine.getState(), { with: ["battery"] }), []);
  const missing = engine.dispatch({ type: "world/component.remove", entityId: "scout-1", component: "battery" });
  assert.equal(missing.accepted, false);
  assert.equal(missing.revision, remove.revision);
});

test("destroy removes entities from lookups while preserving other game state", () => {
  const engine = makeWorld();
  engine.dispatch({ type: "world/entity.create", entityType: "tree", entityId: "tree-1" });
  const result = engine.dispatch({ type: "world/entity.destroy", entityId: "tree-1" });
  assert.equal(result.accepted, true);
  assert.equal(result.events[0].type, "world/entity.destroyed");
  assert.equal(getEntity(engine.getState(), "tree-1"), null);
  assert.deepEqual(engine.getState().resources, { metal: 3 });
});

test("world data participates in snapshots, restores and deterministic replay", () => {
  const first = makeWorld();
  first.dispatch({ type: "world/entity.create", entityType: "raider", components: { health: 7 } });
  const checkpoint = first.snapshot();
  first.dispatch({ type: "world/component.set", entityId: "entity-000001", component: "health", value: 0 });
  const expected = first.snapshot();

  const second = makeWorld();
  second.restore(checkpoint);
  second.dispatch({ type: "world/component.set", entityId: "entity-000001", component: "health", value: 0 });
  assert.deepEqual(second.snapshot(), expected);
});

test("invalid or unsafe world commands fail without changing engine state", () => {
  const engine = makeWorld();
  const before = engine.snapshot();
  const unsafeComponents = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => engine.dispatch({ type: "world/entity.create", entityType: "worker", components: unsafeComponents }), /non-reserved/);
  assert.deepEqual(engine.snapshot(), before);
  assert.equal(engine.dispatch({ type: "world/entity.destroy", entityId: "missing" }).accepted, false);
  assert.deepEqual(engine.snapshot(), before);
});

test("inherited entity names are missing for lookups and mutations", () => {
  assert.equal(getEntity({}, "toString"), null);
  assert.deepEqual(queryEntities({ world: { nextEntity: 1, order: ["toString"], entities: {} } }), []);

  const engine = makeWorld();
  const before = engine.snapshot();
  for (const action of [
    { type: "world/entity.destroy", entityId: "toString" },
    { type: "world/component.set", entityId: "toString", component: "health", value: 1 },
    { type: "world/component.remove", entityId: "toString", component: "health" }
  ]) {
    assert.equal(engine.dispatch(action).accepted, false);
    assert.deepEqual(engine.snapshot(), before);
  }
});

test("world identifiers trim input and store canonical ids and component names", () => {
  const engine = createEngine({ systems: [createWorldPlugin({ id: " world ", idPrefix: " unit " })] });
  assert.equal(engine.getPlugins()[0].id, "world");
  const created = engine.dispatch({
    type: "world/entity.create", entityId: " hero ", entityType: " actor ",
    components: { " health ": 10 }
  });
  assert.equal(created.accepted, true);
  assert.deepEqual(getEntity(engine.getState(), " hero "), {
    id: "hero", type: "actor", components: { health: 10 }
  });
  assert.deepEqual(queryEntities(engine.getState(), { type: " actor ", with: [" health "] })
    .map(entity => entity.id), ["hero"]);
  assert.equal(engine.dispatch({
    type: "world/component.set", entityId: " hero ", component: " health ", value: 9
  }).accepted, true);
});

test("reserved identifiers are rejected after trimming without changing state", () => {
  const engine = makeWorld();
  const before = engine.snapshot();
  for (const entityId of ["__proto__", " __proto__ ", "prototype", " constructor "]) {
    assert.throws(() => engine.dispatch({
      type: "world/entity.create", entityId, entityType: "actor"
    }), /non-empty, non-reserved/);
    assert.deepEqual(engine.snapshot(), before);
  }
  assert.throws(() => engine.dispatch({
    type: "world/entity.create", entityId: "hero", entityType: "actor",
    components: JSON.parse('{" __proto__ ":true}')
  }), /non-empty, non-reserved/);
  assert.deepEqual(engine.snapshot(), before);
});

test("component names that collide after trimming are rejected", () => {
  const engine = makeWorld();
  const before = engine.snapshot();
  assert.throws(() => engine.dispatch({
    type: "world/entity.create", entityType: "actor",
    components: { health: 1, " health ": 2 }
  }), /Duplicate component name after normalization/);
  assert.deepEqual(engine.snapshot(), before);
});
test("entity allocation exhaustion rejects before changing the world", () => {
  const engine = createEngine({
    initialState: { world: { nextEntity: Number.MAX_SAFE_INTEGER, order: [], entities: {} } },
    plugins: [createWorldPlugin()],
    validateState: validateWorldState
  });
  const before = engine.snapshot();
  assert.throws(() => engine.dispatch({ type: "world/entity.create", entityType: "actor" }), /Entity allocation counter/);
  assert.deepEqual(engine.snapshot(), before);
});
