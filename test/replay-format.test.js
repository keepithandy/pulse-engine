import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createEngine, createReplayRecord, validateReplayRecord,
  REPLAY_FORMAT, REPLAY_VERSION
} from "../src/index.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/replay/counter-v1.json", import.meta.url), "utf8"));
const copy = () => structuredClone(fixture);

function engineWithInitialSchedule() {
  const engine = createEngine({ initialState: { count: 0 }, seed: 17, systems: [{
    id: "count", onAction({ action, state }) {
      if (action.type === "count/add") return { state: { count: state.count + 1 } };
    }
  }] });
  engine.schedule({ type: "count/add" }, { at: 2 });
  return engine;
}

test("P03-01 fixture matches a real engine checkpoint and can round-trip without mutation", () => {
  const engine = engineWithInitialSchedule();
  try {
    assert.equal(REPLAY_FORMAT, fixture.format);
    assert.equal(REPLAY_VERSION, fixture.version);
    assert.deepEqual(engine.snapshot(), fixture.initialSnapshot);
    const parsed = validateReplayRecord(fixture);
    const assembled = createReplayRecord({
      configurationId: fixture.configurationId, seed: 17,
      initialSnapshot: engine.snapshot(), commands: fixture.commands
    });
    assert.deepEqual(parsed, fixture);
    assert.deepEqual(assembled, fixture);
    assert.deepEqual(JSON.parse(JSON.stringify(assembled)), fixture);
    assert.ok(Object.isFrozen(assembled));
    assert.ok(Object.isFrozen(assembled.commands[0]));
    assert.ok(Object.isFrozen(assembled.initialSnapshot.schedules.jobs[0]));
    const source = copy();
    const detached = validateReplayRecord(source);
    source.commands[0].action.type = "changed";
    source.initialSnapshot.state.count = 999;
    assert.deepEqual(detached, fixture);
    assert.throws(() => { detached.commands[0].sequence = 100; }, TypeError);
  } finally { engine.dispose(); }
});

test("record envelope defaults to an empty command log without capturing event history", () => {
  const engine = engineWithInitialSchedule();
  try {
    const empty = createReplayRecord({ configurationId: "fixture-v1", seed: 17, initialSnapshot: engine.snapshot() });
    assert.deepEqual(empty.commands, []);
    assert.equal(empty.initialSnapshot.schedules.jobs.length, 1);
    assert.equal(empty.initialSnapshot.events.history.length, 0);
    assert.equal(empty.configurationId, "fixture-v1");
  } finally { engine.dispose(); }
});

test("external-command fixture preserves internal scheduled execution semantics", () => {
  const engine = engineWithInitialSchedule();
  const visited = [];
  try {
    const replay = validateReplayRecord(copy());
    for (const input of replay.commands) {
      visited.push(input.kind);
      if (input.kind === "dispatch") engine.dispatch(input.action);
      if (input.kind === "schedule") engine.schedule(input.action, input.options);
      if (input.kind === "step") engine.step();
      if (input.kind === "advance") engine.advance(input.count);
      if (input.kind === "cancelSchedule") assert.equal(engine.cancelSchedule(input.id), true);
      if (input.kind === "pause") engine.pause();
      if (input.kind === "resume") engine.resume();
    }
    assert.deepEqual(visited, ["dispatch", "schedule", "step", "advance", "pause", "resume", "cancelSchedule", "step"]);
    assert.equal(engine.getTick(), 4);
    assert.deepEqual(engine.getState(), { count: 2 }); // One manual dispatch, one triggered job.
    assert.equal(engine.getSchedules().length, 0);
    assert.ok(replay.commands.every(command => command.action?.type !== "@pulse/tick"));
    assert.equal(replay.commands.filter(command => command.kind === "dispatch").length, 1);
  } finally { engine.dispose(); }
});

test("invalid command sequences and unknown operations reject in all cases", () => {
  for (const modify of [
    record => { record.commands[1].sequence = 1; },
    record => { record.commands[1].sequence = 4; },
    record => { record.commands[2].kind = "tick/internal"; },
    record => { record.commands[1].extra = true; },
    record => { delete record.commands[1].options.at; },
    record => { record.commands[1].options.interval = 0; },
    record => { record.commands[1].options.limit = 3; },
    record => { record.commands[1].options.id = ""; },
    record => { record.commands[4].action = { type: "incorrect" }; },
    record => { record.commands[3].count = -1; },
    record => { record.commands[6].id = ""; },
    record => { record.commands[7].outcome = { status: "accepted", reason: "no" }; },
    record => { record.commands[7].outcome = { status: "error" }; },
    record => { record.commands[7].outcome = { status: "unknown" }; }
  ]) {
    const malformed = copy();
    modify(malformed);
    assert.throws(() => validateReplayRecord(malformed), /commands/);
  }
});

test("replay rejects malformed or incompatible envelopes and nested checkpoint state", () => {
  for (const [mutate, message] of [
    [record => { record.format = "pulse-event-journal"; }, /format/],
    [record => { record.version = 2; }, /Unsupported replay version/],
    [record => { record.engineVersion = "0.0.1"; }, /incompatible/],
    [record => { record.configurationId = "  "; }, /configurationId/],
    [record => { record.seed = null; }, /seed/],
    [record => { record.seed = 18; }, /seed/],
    [record => { record.initialSnapshot.engineVersion = "0.0.1"; }, /incompatible/],
    [record => { record.initialSnapshot.randomState.state = -1; }, /seeded-random/],
    [record => { record.initialSnapshot.events.sequence = -1; }, /journal/],
    [record => { record.initialSnapshot.schedules.jobs[0].at = -1; }, /Schedule tick/],
    [record => { delete record.initialSnapshot; }, /initialSnapshot/],
    [record => { record.unexpected = true; }, /unexpected field/]
  ]) {
    const malformed = copy();
    mutate(malformed);
    assert.throws(() => validateReplayRecord(malformed), message);
  }
});

test("validation never invokes unsafe user getters", () => {
  let getterCount = 0;
  const input = copy();
  Object.defineProperty(input.commands[0].action, "attack", {
    enumerable: true,
    get() { getterCount += 1; throw new Error("must not run"); }
  });
  assert.throws(() => validateReplayRecord(input), /accessors are unsupported/);
  assert.equal(getterCount, 0);
});

test("structured validation and compatibility errors are inspectable", () => {
  assert.throws(() => validateReplayRecord({}), error => error.code === "PULSE_VALIDATION" && error.category === "validation");
  const wrongVersion = copy();
  wrongVersion.version = 77;
  assert.throws(() => validateReplayRecord(wrongVersion), error => error instanceof RangeError && error.code === "PULSE_COMPATIBILITY");
  assert.throws(() => createReplayRecord({ configurationId: "x", seed: 17 }), /initialSnapshot/);
});
