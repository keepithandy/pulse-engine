import assert from "node:assert/strict";
import test from "node:test";
import { assertData, copyData } from "../src/data.js";
import { createEngine, createEventJournal } from "../src/index.js";

function getterArray() {
  let reads = 0;
  const values = [0];
  Object.defineProperty(values, "0", { enumerable: true, configurable: true, get() { reads++; return 5; } });
  return { values, readCount: () => reads };
}

test("P01-01: validation and copy never invoke array accessors", () => {
  const { values, readCount } = getterArray();
  assert.throws(() => assertData(values), /accessors/);
  assert.throws(() => copyData(values), /accessors/);
  assert.equal(readCount(), 0);
});

test("P01-01: reject sparse arrays, including those with inherited index getters", () => {
  const sparse = [1, , 3];
  assert.throws(() => copyData(sparse), /sparse/);
  const proto = Object.create(Array.prototype);
  Object.defineProperty(proto, "1", { get() { throw Error("inherited getter ran"); } });
  Object.setPrototypeOf(sparse, proto);
  assert.throws(() => copyData(sparse), /runtime objects/);
});

test("P01-01: reject extra array fields, symbols and hidden fields before cloning", () => {
  const extra = [1]; extra.label = "not in JSON";
  assert.throws(() => copyData(extra), /unsupported array property/);
  const symbol = [1]; symbol[Symbol("meta")] = true;
  assert.throws(() => copyData(symbol), /unsupported array property/);
  const hidden = [1]; Object.defineProperty(hidden, "secret", { value: "hidden" });
  assert.throws(() => copyData(hidden), /unsupported array property/);
});

test("P01-01: reject hidden, symbol and accessor object fields", () => {
  const values = [
    Object.defineProperty({}, "hidden", { value: 2 }),
    { [Symbol("data")]: 1 },
    Object.defineProperty({}, "secret", { get() { throw Error("getter ran"); } })
  ];
  for (const value of values) assert.throws(() => copyData(value), /non-enumerable|symbol|accessors/);
});

test("P01-01: reject negative zero, which loses its sign in JSON", () => {
  assert.throws(() => copyData(-0), /JSON-safe/);
  assert.throws(() => copyData({ count: -0 }), /JSON-safe/);
});

test("P01-01: dense JSON values survive copying and JSON serialization", () => {
  const source = { empty: [], nested: [null, 0, false, "ok", { arr: [1, 2] }], object: Object.assign(Object.create(null), { foo: 5 }) };
  const clone = copyData(source);
  assert.deepEqual(JSON.parse(JSON.stringify(clone)), JSON.parse(JSON.stringify(source)));
  assert.deepEqual(JSON.parse(JSON.stringify(clone)), clone);
});

test("P01-01: rejected array accessors do not mutate engine execution or scheduling", () => {
  const { values, readCount } = getterArray();
  assert.throws(() => createEngine({ initialState: { invalid: values } }), /accessors/);
  const engine = createEngine({ initialState: { health: 10 }, seed: "fixture" });
  const before = engine.snapshot();
  assert.throws(() => engine.dispatch({ type: "noop", payload: values }), /accessors/);
  assert.deepEqual(engine.snapshot(), before);
  assert.throws(() => engine.schedule({ type: "noop", payload: values }, { at: 1 }), /accessors/);
  assert.deepEqual(engine.snapshot(), before);
  assert.equal(readCount(), 0);
});

test("P01-01: rejected event payload preserves journal sequence and history", () => {
  const journal = createEventJournal();
  const { values, readCount } = getterArray();
  const before = journal.exportState();
  assert.throws(() => journal.publish({ type: "sample", payload: values }), /accessors/);
  assert.deepEqual(journal.exportState(), before);
  assert.equal(readCount(), 0);
});

test("P01-01: supported dense data round-trips through engine JSON saves", () => {
  const state = { items: [null, true, 3.5, { tags: ["alpha", "beta"] }], empty: [], key: "test" };
  const first = createEngine({ initialState: state, seed: 7 });
  const second = createEngine({ seed: 100 });
  second.importSave(first.exportSave());
  assert.deepEqual(second.getState(), state);
  assert.deepEqual(second.snapshot(), first.snapshot());
});
