import assert from "node:assert/strict";
import test from "node:test";
import {
  createEngine, createReplayRecord, replayCommands
} from "../src/index.js";

function counter(seed = 17, options = {}) {
  return createEngine({
    seed, initialState: { count: 0, rolls: [] },
    eventHistoryLimit: options.eventHistoryLimit ?? 1000,
    systems: [{
      id: "counter",
      onAction({ action, state, random }) {
        if (action.type === "add") return {
          state: { ...state, count: state.count + (action.amount ?? 1) },
          events: [{ type: "added", payload: { amount: action.amount ?? 1 } }]
        };
        if (action.type === "roll") return {
          state: { ...state, rolls: [...state.rolls, random.integer(1, 20)] }
        };
        if (action.type === "reject") return { accepted: false, reason: "No budget." };
        if (action.type === "throw") throw new Error("Expected hook error.");
      }
    }]
  });
}

function recorded() {
  const engine = counter();
  engine.schedule({ type: "add", amount: 3 }, { at: 2, id: "initial-job" });
  engine.pause();
  const recording = engine.startRecording({ configurationId: "counter/v1" });
  engine.advance(5);
  engine.dispatch({ type: "roll" });
  engine.dispatch({ type: "reject" });
  assert.throws(() => engine.dispatch({ type: "throw" }), /Expected hook error/);
  engine.resume();
  engine.schedule({ type: "add" }, { at: 5, id: "cancel-me" });
  engine.cancelSchedule("cancel-me");
  engine.step();
  engine.advance(3);
  recording.stop();
  const record = recording.getRecord();
  const final = engine.snapshot();
  engine.dispose();
  return { record, final };
}

function options(overrides = {}) {
  return {
    expectedConfigurationId: "counter/v1",
    createConfiguredEngine: ({ seed }) => counter(seed),
    ...overrides
  };
}

test("P03-03 replays recorded commands without double-dispatching internally scheduled jobs", () => {
  const { record, final } = recorded();
  const checkpoints = [];
  const result = replayCommands(record, options({
    onCheckpoint(value) {
      assert.ok(Object.isFrozen(value));
      assert.ok(Object.isFrozen(value.snapshot.state));
      checkpoints.push(value);
    }
  }));
  assert.equal(result.status, "completed");
  assert.equal(result.commandCount, record.commands.length);
  assert.deepEqual(result.finalSnapshot, final);
  assert.equal(result.finalSnapshot.tick, 4);
  assert.equal(result.finalSnapshot.state.count, 3); // One pending job, not an extra external dispatch.
  assert.equal(result.finalSnapshot.state.rolls.length, 1);
  assert.equal(checkpoints.length, record.commands.length + 1);
  assert.equal(checkpoints[0].sequence, 0);
  assert.equal(checkpoints[0].kind, "initial");
  assert.equal(checkpoints[0].tick, 0);
  assert.deepEqual(checkpoints.slice(1).map(c => c.sequence),
    record.commands.map(c => c.sequence));
  assert.throws(() => { result.finalSnapshot.state.count = 5; }, TypeError);
  assert.ok(record.commands.some(command => command.outcome.status === "rejected"));
  assert.ok(record.commands.some(command => command.outcome.status === "error"));
});

test("approved configuration identity is checked before invoking the host factory", () => {
  let invoked = false;
  const { record } = recorded();
  assert.throws(() => replayCommands(record, options({
    expectedConfigurationId: "wrong/configuration",
    createConfiguredEngine() { invoked = true; return counter(); }
  })), error => error.code === "PULSE_REPLAY");
  assert.equal(invoked, false);
  assert.throws(() => replayCommands(record, options({ expectedConfigurationId: undefined })),
    error => error.code === "PULSE_REPLAY");
});

test("replay requires valid input and does not invoke a factory for malformed commands", () => {
  const { record } = recorded();
  const corrupt = structuredClone(record);
  corrupt.commands[1].sequence = 99;
  let invoked = false;
  assert.throws(() => replayCommands(corrupt, options({
    createConfiguredEngine() { invoked = true; return counter(); }
  })), error => error.code === "PULSE_VALIDATION");
  assert.equal(invoked, false);
});

test("outcome divergence gives the first differing external command without exposing state", () => {
  const { record } = recorded();
  const corrupt = structuredClone(record);
  corrupt.commands[2].outcome = { status: "accepted" };
  const result = replayCommands(corrupt, options());
  assert.equal(result.status, "diverged");
  assert.equal(result.commandCount, 3);
  assert.deepEqual(result.divergence.expected, { status: "accepted" });
  assert.deepEqual(result.divergence.actual, { status: "rejected", reason: "No budget." });
  assert.equal(result.divergence.sequence, 3);
  assert.ok(!Object.hasOwn(result, "finalSnapshot"));
  assert.ok(Object.isFrozen(result.divergence));
});

test("unverified runtime exceptions are not silently accepted", () => {
  const engine = counter();
  const source = createReplayRecord({
    configurationId: "counter/v1", seed: 17, initialSnapshot: engine.snapshot(),
    initialPaused: false, commands: [{ sequence: 1, kind: "dispatch", action: { type: "throw" } }]
  });
  engine.dispose();
  const result = replayCommands(source, options());
  assert.equal(result.status, "diverged");
  assert.equal(result.divergence.expected, null);
  assert.equal(result.divergence.actual.status, "error");
});

test("replay refuses a host with incompatible restored checkpoint and disposes the engine", () => {
  const engine = counter();
  engine.dispatch({ type: "add" });
  engine.dispatch({ type: "add" });
  const record = createReplayRecord({ configurationId: "counter/v1", seed: 17,
    initialSnapshot: engine.snapshot(), initialPaused: false });
  engine.dispose();
  let created;
  assert.throws(() => replayCommands(record, options({
    createConfiguredEngine({ seed }) {
      created = counter(seed, { eventHistoryLimit: 1 });
      return created;
    }
  })), error => error.code === "PULSE_REPLAY" && /checkpoint/.test(error.message));
  assert.throws(() => created.dispatch({ type: "add" }), /disposed/);
});

test("factory and observer failures propagate; replay-owned engine is always disposed", async () => {
  const { record } = recorded();
  let created;
  assert.throws(() => replayCommands(record, options({
    createConfiguredEngine({ seed }) { created = counter(seed); return created; },
    onCheckpoint() { throw new Error("Observer failed."); }
  })), /Observer failed/);
  assert.throws(() => created.dispatch({ type: "add" }), /disposed/);

  assert.throws(() => replayCommands(record, options({
    onCheckpoint() { return Promise.reject(new Error("Late failure")); }
  })), /must be synchronous/);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.throws(() => replayCommands(record, options({
    createConfiguredEngine() { return Promise.resolve({}); }
  })), /must be synchronous/);
  assert.throws(() => replayCommands(record, options({
    createConfiguredEngine: () => ({})
  })), error => error.code === "PULSE_REPLAY");
});

test("starting checkpoint can have a label and is restored without leaking that metadata", () => {
  const engine = counter();
  engine.dispatch({ type: "add" });
  const record = createReplayRecord({
    configurationId: "counter/v1", seed: 17,
    initialSnapshot: engine.snapshot({ label: "manual-checkpoint" }),
    initialPaused: false, commands: [{ sequence: 1, kind: "step", outcome: { status: "accepted" } }]
  });
  engine.dispose();
  const result = replayCommands(record, options());
  assert.equal(result.status, "completed");
  assert.equal(result.finalSnapshot.state.count, 1);
  assert.equal(result.finalSnapshot.label, null);
});

test("record replay supports schedule cancellation, rejected ticks and no-op pause", () => {
  const engine = counter();
  const recording = engine.startRecording({ configurationId: "counter/v1" });
  engine.schedule({ type: "add" }, { at: 3, id: "cancelled" });
  assert.equal(engine.cancelSchedule("cancelled"), true);
  assert.equal(engine.cancelSchedule("cancelled"), false);
  engine.pause();
  assert.deepEqual(engine.advance(100), []);
  engine.step();
  engine.resume();
  engine.advance(2);
  recording.stop();
  const record = recording.getRecord();
  const final = engine.snapshot();
  engine.dispose();
  const replay = replayCommands(record, options());
  assert.equal(replay.status, "completed");
  assert.deepEqual(replay.finalSnapshot, final);
  assert.equal(replay.finalSnapshot.state.count, 0);
  assert.equal(record.commands.find(command => command.kind === "cancelSchedule" && command.outcome.status === "rejected").outcome.reason,
    "Schedule not found.");
});

test("disposal failures are surfaced, not silently treated as successful replay", () => {
  const engine = counter();
  const record = createReplayRecord({
    configurationId: "counter/v1", seed: 17, initialSnapshot: engine.snapshot(),
    initialPaused: false
  });
  engine.dispose();
  assert.throws(() => replayCommands(record, options({
    createConfiguredEngine({ seed }) {
      const actual = counter(seed);
      return { ...actual, dispose() { actual.dispose(); return [new Error("Cleanup failure.")]; } };
    }
  })), error => error.code === "PULSE_REPLAY" && /disposal/.test(error.message));
});
