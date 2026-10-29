import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEngine, digestCheckpoint, replayCommands } from "../src/index.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/checkpoint-digests/v1-golden.json", import.meta.url), "utf8"));
const clone = value => structuredClone(value);
const snapshot = () => clone(fixture.snapshot);
const digest = input => digestCheckpoint(input);

test("P03-04 golden fixture uses versioned SHA-256, including Unicode and numeric keys", async () => {
  assert.equal(await digest(snapshot()), fixture.digest);
  assert.match(fixture.digest, /^sha256-v1:[0-9a-f]{64}$/);
  const engine = createEngine({ seed: 17, initialState: clone(fixture.snapshot.state) });
  assert.deepEqual(engine.snapshot(), fixture.snapshot);
  assert.equal(await digest(engine.snapshot()), fixture.digest);
  engine.dispose();
});

test("key insertion order never changes digests, including nested and integer-like keys", async () => {
  const original = snapshot();
  const reversed = clone(original);
  reversed.state = {
    max: original.state.max, min: original.state.min,
    empty: {}, arr: [{ a: 2, z: 1 }, [], { y: 0.125, x: -2.5 }],
    numericKeys: { "01": "leading", "2": "two", "10": "ten" },
    unicode: { line: "line\nbreak", emoji: "💡", "é": "café", "雪": "雪" }
  };
  reversed.randomState = { state: 17, seed: 17, algorithm: "mulberry32-v1" };
  reversed.branch = { parentId: null, id: "main" };
  assert.equal(await digest(original), await digest(reversed));

  const labeled = clone(original);
  labeled.label = "A manual checkpoint";
  assert.equal(await digest(labeled), fixture.digest);
  assert.deepEqual(original, fixture.snapshot);
});

test("revisions, tick, branch, state, PRNG, schedules and events all participate in identity", async () => {
  const original = snapshot();
  const cases = [
    item => { item.revision = 1; },
    item => { item.actionSequence = 1; },
    item => { item.tick = 1; },
    item => { item.branch.id = "fork"; },
    item => { item.branch.parentId = "parent"; },
    item => { item.state.arr[0].z = 3; },
    item => { item.state.arr.reverse(); },
    item => { item.randomState.state = 18; },
    item => { item.randomState.seed = 18; },
    item => { item.schedules.sequence = 1; item.schedules.jobs = [
      { id: "job-1", sequence: 1, action: { type: "wait" }, at: 2, interval: null, remaining: 1 }
    ]; },
    item => { item.events.sequence = 1; },
    item => { item.events.sequence = 1; item.events.history.push({
      version: 1, id: "event-000001", type: "started", tick: 0,
      source: "test", payload: {}, metadata: {}
    }); }
  ];
  for (const mutate of cases) {
    const next = clone(original);
    mutate(next);
    assert.notEqual(await digest(next), fixture.digest);
  }
});

test("invalid snapshots reject before hashing and never invoke accessor getters", async () => {
  let calls = 0;
  const cases = [
    item => { item.format = "invalid"; },
    item => { item.version = 2; },
    item => { item.engineVersion = "future"; },
    item => { item.revision = -1; },
    item => { item.state.bad = -0; },
    item => { item.state.bad = Number.NaN; },
    item => { item.state.bad = Number.POSITIVE_INFINITY; },
    item => { item.state.bad = undefined; },
    item => { item.state.bad = Symbol("unsafe"); },
    item => { item.state.bad = { constructor: new Date() }; },
    item => { item.state.bad = [1, , 2]; },
    item => { item.state.self = item.state; },
    item => { item.unreviewedField = "ignored by ordinary snapshots"; },
    item => { item.randomState.algorithm = "unknown"; },
    item => { item.schedules.sequence = -1; },
    item => { item.events.format = "unknown-journal"; },
    item => { Object.defineProperty(item.state, "bad", { enumerable: true, get() {
      calls += 1;
      throw new Error("Getter must not run");
    } }); }
  ];
  for (const corrupt of cases) {
    const item = snapshot();
    corrupt(item);
    await assert.rejects(digest(item));
  }
  assert.equal(calls, 0);
});

test("post-replay checkpoint identity matches original run, including random draws", async () => {
  const systems = [{
    id: "dice", onAction({ action, random, state }) {
      if (action.type === "roll") return { state: { values: [...state.values, random.integer(1, 100)] } };
    }
  }];
  const engine = createEngine({ seed: "replay-digest", systems, initialState: { values: [] } });
  const recording = engine.startRecording({ configurationId: "dice/v1" });
  engine.schedule({ type: "roll" }, { at: 2 });
  engine.dispatch({ type: "roll" });
  engine.advance(4);
  recording.stop();
  const record = recording.getRecord();
  const sourceDigest = await digest(engine.snapshot());
  const replayed = replayCommands(record, {
    expectedConfigurationId: "dice/v1",
    createConfiguredEngine: ({ seed }) => createEngine({ seed, systems, initialState: { values: [] } })
  });
  assert.equal(replayed.status, "completed");
  assert.equal(await digest(replayed.finalSnapshot), sourceDigest);
  engine.dispose();
});

test("large representative checkpoints hash consistently without timing assumptions", async () => {
  const item = snapshot();
  item.state.rows = Array.from({ length: 2500 }, (_, id) => ({
    id, tags: ["resource", "worker", String(id % 13)],
    nested: { x: id, y: (id % 7) / 8, enabled: id % 2 === 0 }
  }));
  const expected = await digest(item);
  for (let i = 0; i < 3; i += 1) assert.equal(await digest(item), expected);
});
