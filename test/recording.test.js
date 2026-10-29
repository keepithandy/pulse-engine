import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateReplayRecord } from "../src/index.js";

function counter(options = {}) {
  return createEngine({ seed: "recording", initialState: { count: 0 }, systems: [{
    id: "counter", onAction({ action, state, random }) {
      if (action.type === "add") return { state: { count: state.count + (action.amount ?? 1) },
        events: [{ type: "added" }] };
      if (action.type === "roll") return { state: { count: state.count + random.integer(1, 6) } };
      if (action.type === "reject") return { accepted: false, reason: "Not allowed." };
      if (action.type === "throw") throw new Error("Hook failed.");
    }
  }], ...options });
}
const recordingError = error => error.code === "PULSE_RECORDING" && error.category === "recording";
const start = (engine, options = {}) => engine.startRecording({ configurationId: "counter/v1", ...options });

test("recorder captures all public commands through saved aliases, outcomes and immutable inputs", () => {
  const engine = counter({ eventHistoryLimit: 1 });
  const dispatch = engine.dispatch;
  const action = { type: "add", amount: 2 };
  const recording = start(engine);
  const initial = engine.snapshot();
  assert.equal(dispatch(action).accepted, true);
  action.amount = 999;
  const id = engine.schedule({ type: "add" }, { at: 1 });
  assert.equal(engine.step().scheduled.length, 1);
  assert.equal(engine.advance().length, 1);
  assert.equal(dispatch({ type: "reject" }).accepted, false);
  assert.throws(() => dispatch({ type: "throw" }), /Hook failed/);
  assert.equal(engine.cancelSchedule(id), false);
  engine.pause();
  assert.deepEqual(engine.advance(5), []);
  engine.resume();
  assert.equal(engine.cancelSchedule(engine.schedule({ type: "roll" }, { at: 10 })), true);
  assert.throws(() => recording.getRecord(), recordingError);
  const status = recording.stop();
  assert.equal(status.state, "stopped");
  assert.equal(status.commandCount, 12);
  const record = recording.getRecord();
  assert.deepEqual(validateReplayRecord(record), record);
  assert.deepEqual(record.initialSnapshot, initial);
  assert.equal(record.seed, "recording");
  assert.equal(record.initialPaused, false);
  assert.deepEqual(record.commands.map(command => command.kind),
    ["dispatch", "schedule", "step", "advance", "dispatch", "dispatch", "cancelSchedule", "pause", "advance", "resume", "schedule", "cancelSchedule"]);
  assert.deepEqual(record.commands.map(command => command.outcome.status),
    ["accepted", "accepted", "accepted", "accepted", "rejected", "error", "rejected", "accepted", "accepted", "accepted", "accepted", "accepted"]);
  assert.equal(record.commands[0].action.amount, 2);
  assert.equal(record.commands[3].count, 1);
  assert.equal(record.commands[4].outcome.reason, "Not allowed.");
  assert.equal(record.commands[5].outcome.reason, "Hook failed.");
  assert.equal(record.commands.filter(command => command.kind === "dispatch").length, 3);
  assert.equal(engine.getEvents().length, 1);
  assert.throws(() => { record.commands[0].action.amount = 0; }, TypeError);
  assert.deepEqual(recording.stop(), status);
  engine.dispatch({ type: "add" });
  assert.equal(recording.getRecord().commands.length, 12);
  engine.dispose();
});

test("recording starts from the real pause state despite disabled or redacted diagnostics", () => {
  for (const options of [{ diagnostics: false }, { redact: () => ({ paused: false }) }]) {
    const engine = counter(options);
    engine.advance(2);
    engine.pause();
    engine.schedule({ type: "roll" }, { at: 3 });
    const recording = start(engine);
    assert.deepEqual(engine.advance(5), []);
    assert.equal(engine.step().advanced, true); // Explicit step works while paused.
    engine.resume();
    engine.advance(1);
    recording.stop();
    const record = recording.getRecord();
    assert.equal(record.initialPaused, true);
    assert.equal(record.initialSnapshot.tick, 2);
    assert.equal(record.initialSnapshot.schedules.jobs.length, 1);
    assert.deepEqual(record.commands.map(command => command.kind), ["advance", "step", "resume", "advance"]);
    assert.equal(engine.getTick(), 4);
    engine.dispose();
  }
});

test("recorded command boundaries reproduce a checkpoint without duplicate scheduled work", () => {
  const original = counter();
  original.schedule({ type: "roll" }, { at: 2, interval: 2, limit: 3 });
  original.pause();
  const recording = start(original);
  original.advance(5);
  original.resume();
  original.dispatch({ type: "roll" });
  original.advance(6);
  recording.stop();
  const record = recording.getRecord();
  const replayed = counter();
  replayed.restore(record.initialSnapshot);
  if (record.initialPaused) replayed.pause();
  for (const command of record.commands) {
    if (command.kind === "dispatch") replayed.dispatch(command.action);
    if (command.kind === "advance") replayed.advance(command.count);
    if (command.kind === "resume") replayed.resume();
  }
  assert.deepEqual(replayed.snapshot(), original.snapshot());
  assert.equal(record.commands.length, 4);
  original.dispose();
  replayed.dispose();
});

test("step and partially completed advance record top-level rejection outcomes", () => {
  const engine = counter({ systems: [{
    id: "stop", beforeTick({ tick }) { if (tick === 2) return { accepted: false, reason: "Tick limit." }; }
  }] });
  const recording = start(engine);
  assert.equal(engine.advance(5).length, 2);
  assert.equal(engine.step().advanced, false);
  recording.stop();
  assert.deepEqual(recording.getRecord().commands.map(command => command.outcome),
    [{ status: "rejected", reason: "Tick limit." }, { status: "rejected", reason: "Tick limit." }]);
  assert.equal(engine.getTick(), 1);
  engine.dispose();
});

test("valid protocol commands that fail at runtime remain in the recording", () => {
  const engine = counter();
  const recording = start(engine);
  assert.throws(() => engine.schedule({ type: "add" }, { at: 0 }), /future tick/);
  engine.schedule({ type: "throw" }, { at: 1 });
  const step = engine.step();
  assert.equal(step.advanced, true);
  assert.equal(step.scheduled[0].accepted, false);
  recording.stop();
  const commands = recording.getRecord().commands;
  assert.equal(commands[0].outcome.status, "error");
  assert.equal(commands[2].outcome.status, "accepted"); // Scheduled errors are internal work.
  assert.equal(commands.length, 3);
  engine.dispose();
});

test("streaming emits a reconstructable ordered record without retaining commands", () => {
  const entries = [];
  const engine = counter();
  const recording = start(engine, { retainCommands: false, sink: entry => { entries.push(entry); } });
  for (let i = 0; i < 200; i += 1) engine.dispatch({ type: "add" });
  assert.equal(recording.getStatus().retainedCommandCount, 0);
  assert.equal(recording.getStatus().commandCount, 200);
  recording.stop();
  assert.deepEqual(entries.map(entry => entry.type), ["start", ...Array(200).fill("command"), "end"]);
  const record = validateReplayRecord({ ...entries[0].record, commands: entries.slice(1, -1).map(entry => entry.command) });
  assert.equal(record.commands.length, entries.at(-1).commandCount);
  assert.deepEqual(record.commands.map(command => command.sequence), Array.from({ length: 200 }, (_, index) => index + 1));
  assert.ok(Object.isFrozen(entries[0].record.initialSnapshot));
  assert.ok(Object.isFrozen(entries[1].command.action));
  assert.throws(() => recording.getRecord(), recordingError);
  engine.dispose();
});

test("recording rejects configuration changes, restore, import and disposal before any callbacks", () => {
  const engine = counter();
  const snapshot = engine.snapshot();
  let callbacks = 0;
  const recording = start(engine);
  for (const mutate of [
    () => engine.registerPlugin({ id: "new", setup() { callbacks += 1; } }),
    () => engine.unregisterPlugin("counter"),
    () => engine.restore(snapshot),
    () => engine.importSave({ version: 0 }, { migrations: [{ from: 0, to: 1, migrate() { callbacks += 1; } }] }),
    () => engine.dispose(),
    () => start(engine)
  ]) assert.throws(mutate, recordingError);
  assert.equal(callbacks, 0);
  assert.deepEqual(engine.snapshot(), snapshot);
  assert.equal(engine.getPlugins().length, 1);
  recording.stop();
  engine.restore(snapshot);
  engine.registerPlugin({ id: "new", setup() { callbacks += 1; } });
  assert.equal(callbacks, 1);
  const next = start(engine, { configurationId: "counter/v2" });
  recording.stop(); // An old handle must not release the new session.
  assert.throws(() => engine.unregisterPlugin("new"), recordingError);
  next.stop();
  engine.dispose();
});

test("engine observers and streaming sinks cannot reenter recording or engine mutation", () => {
  const engine = counter();
  let recording;
  let attempts = 0;
  const probe = () => {
    for (const mutate of [() => engine.step(), () => engine.pause(), () => start(engine),
      () => engine.snapshot(), ...(recording ? [() => recording.stop(), () => recording.getRecord()] : [])]) {
      assert.throws(mutate, error => error.code === "PULSE_LIFECYCLE");
      attempts += 1;
    }
  };
  recording = start(engine, { sink: probe });
  engine.subscribe(probe);
  engine.dispatch({ type: "add" });
  recording.stop();
  assert.equal(attempts, 22); // Start sink, observer, command sink, end sink.
  assert.equal(recording.getRecord().commands.length, 1);
  engine.dispose();
});

test("unrepresentable commands fail recording before executing and leave getters inert", () => {
  let getterCalls = 0;
  for (const mutate of [
    engine => engine.advance(-1),
    engine => engine.dispatch({ type: "add", amount: undefined }),
    engine => engine.schedule({ type: "add" }, { at: 1, extra: true }),
    engine => engine.cancelSchedule(["missing"]),
    engine => {
      const action = { type: "add" };
      Object.defineProperty(action, "amount", { enumerable: true, get() { getterCalls += 1; throw new Error("Getter must not run."); } });
      return engine.dispatch(action);
    }
  ]) {
    const engine = counter();
    const before = engine.snapshot();
    const recording = start(engine);
    assert.throws(() => mutate(engine), error => recordingError(error) && error.commandExecuted === false);
    assert.equal(recording.getStatus().state, "failed");
    assert.equal(recording.getStatus().commandCount, 0);
    assert.deepEqual(engine.snapshot(), before);
    assert.throws(() => engine.dispatch({ type: "add" }), recordingError);
    assert.throws(() => recording.getRecord(), recordingError);
    assert.equal(recording.stop().state, "failed");
    engine.dispatch({ type: "add" });
    engine.dispose();
  }
  assert.equal(getterCalls, 0);
});

test("sink failure after a command marks incomplete, preserves committed state and blocks the next command", () => {
  const engine = counter();
  const entries = [];
  const recording = start(engine, { sink: entry => {
    entries.push(entry);
    if (entry.type === "command") throw new Error("Disk full.");
  } });
  assert.throws(() => engine.dispatch({ type: "add" }), error => recordingError(error) && error.commandExecuted === true);
  assert.equal(engine.getState().count, 1);
  assert.equal(recording.getStatus().state, "failed");
  assert.equal(recording.getStatus().commandCount, 1);
  assert.throws(() => engine.step(), recordingError);
  assert.equal(engine.getTick(), 0);
  assert.equal(recording.stop().state, "failed");
  assert.deepEqual(entries.map(entry => entry.type), ["start", "command"]);
  assert.throws(() => recording.getRecord(), recordingError);
  const next = start(engine);
  next.stop();
  engine.dispose();
});

test("start and end sink failures release the engine without claiming a complete record", () => {
  const engine = counter();
  assert.throws(() => start(engine, { sink() { throw new Error("No storage."); } }), recordingError);
  engine.dispatch({ type: "add" });
  const recording = start(engine, { sink: entry => { if (entry.type === "end") throw new Error("Flush failed."); } });
  assert.throws(() => recording.stop(), recordingError);
  assert.equal(recording.getStatus().state, "failed");
  assert.throws(() => recording.getRecord(), recordingError);
  engine.dispatch({ type: "add" });
  assert.equal(recording.stop().state, "failed");
  engine.dispose();
});

test("async sinks fail explicitly and late rejection is observed", async () => {
  const engine = counter();
  const recording = start(engine, { sink: entry => {
    if (entry.type === "command") return Promise.reject(new Error("Late failure."));
  } });
  assert.throws(() => engine.step(), recordingError);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(recording.getStatus().state, "failed");
  recording.stop();
  engine.dispose();
});

test("original thrown values survive recording and simultaneous sink errors", () => {
  for (const thrown of [new Error("Original."), null, "failure",
    Object.defineProperty({}, "message", { get() { throw new Error("Getter must not run."); } })]) {
    const engine = counter({ systems: [{ id: "throws", onAction() { throw thrown; } }] });
    const recording = start(engine);
    assert.throws(() => engine.dispatch({ type: "test" }), error => error === thrown);
    recording.stop();
    assert.equal(recording.getRecord().commands[0].outcome.status, "error");
    engine.dispose();
  }
  const engine = counter();
  const recording = start(engine, { sink: entry => { if (entry.type === "command") throw new Error("Sink failure."); } });
  assert.throws(() => engine.dispatch({ type: "throw" }), /Hook failed/);
  assert.equal(recording.getStatus().state, "failed");
  recording.stop();
  engine.dispose();
});

test("empty sessions, invalid options, disposal and restored seed identity have explicit contracts", () => {
  const engine = counter();
  for (const options of [{ retainCommands: false }, { sink: true }, { retainCommands: "yes" }, { configurationId: "" }]) {
    assert.throws(() => start(engine, options), error => error.code === "PULSE_VALIDATION");
  }
  const recording = start(engine);
  recording.stop();
  assert.deepEqual(recording.getRecord().commands, []);
  const donor = counter({ seed: 21 });
  engine.restore(donor.snapshot());
  assert.throws(() => start(engine), /seed/);
  const restored = start(engine, { seed: 21 });
  restored.stop();
  assert.equal(restored.getRecord().seed, 21);
  engine.dispose();
  assert.throws(() => start(engine), error => error.code === "PULSE_LIFECYCLE");
  assert.deepEqual(recording.getRecord().commands, []);
  donor.dispose();
});
