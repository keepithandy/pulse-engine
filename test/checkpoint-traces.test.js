import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKPOINT_TRACE_FORMAT, CHECKPOINT_TRACE_VERSION, compareCheckpointTraces,
  createCheckpointTrace, createEngine, createReplayRecord, replayCommands
} from "../src/index.js";

const clone = value => structuredClone(value);

function base() {
  const engine = createEngine({ initialState: { nested: { "a/b~c": [null, 2] }, gold: 1 }, seed: 7 });
  const checkpoint = engine.snapshot();
  engine.dispose();
  return checkpoint;
}

function entry(sequence, snapshot, kind = sequence === 0 ? "initial" : "dispatch",
  outcome = sequence === 0 ? null : { status: "accepted" }) {
  return { sequence, kind, tick: snapshot.tick, outcome, snapshot };
}
const trace = (entries, options = {}) => createCheckpointTrace({
  configurationId: "test/rules-v1", commandCount: options.commandCount ?? Math.max(0, ...entries.map(x => x.sequence)),
  checkpoints: entries, includeSnapshots: options.includeSnapshots ?? true
});

test("P03-05 compares complete matching traces and freezes independent detached inputs", async () => {
  const s = base();
  const left = await trace([entry(0, s), entry(1, s)]);
  const right = await trace([entry(0, clone(s)), entry(1, clone(s))]);
  assert.equal(left.format, CHECKPOINT_TRACE_FORMAT);
  assert.equal(left.version, CHECKPOINT_TRACE_VERSION);
  assert.equal(compareCheckpointTraces(left, right).status, "no-divergence");
  assert.ok(Object.isFrozen(left.checkpoints[0].snapshot.state.nested));
  assert.notStrictEqual(left.checkpoints[0].snapshot, s);
  const cloned = clone(left);
  cloned.checkpoints[0].digest = "sha256-v1:" + "0".repeat(64);
  assert.equal(compareCheckpointTraces(left, right).status, "no-divergence");
});

test("detects first changed state path and privacy-preserving JSON pointer escaping", async () => {
  const s = base(), mutated = clone(s);
  mutated.state.nested["a/b~c"][1] = 7;
  const reference = await trace([entry(0, s), entry(1, s)]);
  const candidate = await trace([entry(0, clone(s)), entry(1, mutated)]);
  const report = compareCheckpointTraces(reference, candidate);
  assert.equal(report.status, "diverged");
  assert.equal(report.firstPossibleSequence, 1);
  assert.equal(report.firstObservedSequence, 1);
  assert.equal(report.precision, "exact");
  assert.equal(report.category, "state");
  assert.equal(report.path, "/state/nested/a~1b~0c/1");
  assert.equal(Object.hasOwn(report, "values"), false);
  const exposed = compareCheckpointTraces(reference, candidate, { includeValues: true });
  assert.deepEqual(exposed.values, { reference: 2, candidate: 7 });
  assert.ok(Object.isFrozen(exposed));
});

test("initial mismatch is correctly attributed to checkpoint zero", async () => {
  const s = base(), changed = clone(s);
  changed.state.gold = 9;
  const report = compareCheckpointTraces(await trace([entry(0, s)]),
    await trace([entry(0, changed)]));
  assert.equal(report.location, "initial-checkpoint");
  assert.equal(report.firstObservedSequence, 0);
  assert.equal(report.precision, "exact");
  assert.equal(report.path, "/state/gold");
});

test("reports categories for random, scheduled work, events and metadata without leaking values", async () => {
  const s = base();
  const cases = [
    ["random", "/randomState/state", next => { next.randomState.state = next.randomState.state + 1; }],
    ["scheduler", "/schedules/sequence", next => { next.schedules.sequence = 1; }],
    ["events", "/events/sequence", next => { next.events.sequence = 1; }],
    ["metadata", "/branch/id", next => { next.branch.id = "fork"; }],
    ["metadata", "/revision", next => { next.revision = 1; }]
  ];
  const reference = await trace([entry(0, s), entry(1, s)]);
  for (const [category, path, mutate] of cases) {
    const next = clone(s);
    mutate(next);
    const candidate = await trace([entry(0, clone(s)), entry(1, next)]);
    const result = compareCheckpointTraces(reference, candidate);
    assert.equal(result.category, category);
    assert.equal(result.path, path);
    assert.equal(result.firstObservedSequence, 1);
    assert.ok(!JSON.stringify(result).includes('"gold"'));
  }
});

test("outcome mismatches are classified independently of identical checkpoints", async () => {
  const s = base();
  const a = await trace([entry(0, s), entry(1, s)]);
  const b = await trace([entry(0, s), entry(1, s, "dispatch", { status: "rejected", reason: "Budget." })]);
  const r = compareCheckpointTraces(a, b);
  assert.equal(r.category, "outcome");
  assert.equal(r.path, null);
  assert.equal(r.firstObservedSequence, 1);
});

test("different host configurations and command kinds are not mistaken for state divergences", async () => {
  const s = base();
  const a = await trace([entry(0, s), entry(1, s)]);
  const b = await createCheckpointTrace({
    configurationId: "other/rules", commandCount: 1, checkpoints: [entry(0, s), entry(1, s)]
  });
  assert.deepEqual(compareCheckpointTraces(a, b), {
    status: "different-recordings", category: "config", reason: "Configuration identity differs."
  });
  const c = await trace([entry(0, s), entry(1, s, "step")]);
  assert.equal(compareCheckpointTraces(a, c).status, "different-recordings");
});

test("sparse or absent checkpoints report uncertainty, not an invented exact command", async () => {
  const s = base(), changed = clone(s);
  changed.state.gold = 7;
  const complete = await trace([entry(0, s), entry(1, s), entry(2, s)], { commandCount: 2 });
  const sparse = await trace([entry(0, s), entry(2, s)], { commandCount: 2 });
  assert.equal(compareCheckpointTraces(complete, sparse).status, "insufficient-trace");
  const report = compareCheckpointTraces(sparse,
    await trace([entry(0, s), entry(2, changed)], { commandCount: 2 }));
  assert.equal(report.status, "diverged");
  assert.equal(report.precision, "interval");
  assert.equal(report.firstPossibleSequence, 1);
  assert.equal(report.firstObservedSequence, 2);
  assert.equal(compareCheckpointTraces(await trace([], { commandCount: 2 }), sparse).status, "insufficient-trace");
  const differs = await trace([entry(0, s), entry(1, s), entry(2, s)], { commandCount: 3 });
  assert.equal(compareCheckpointTraces(complete, differs).status, "different-recordings");
});

test("transient earlier divergence is found even when final checkpoints match", async () => {
  const s = base(), changed = clone(s);
  changed.state.gold = 10;
  const a = await trace([entry(0, s), entry(1, s), entry(2, s)], { commandCount: 2 });
  const b = await trace([entry(0, s), entry(1, changed), entry(2, s)], { commandCount: 2 });
  assert.equal(a.checkpoints[2].digest, b.checkpoints[2].digest);
  assert.equal(compareCheckpointTraces(a, b).firstObservedSequence, 1);
});

test("reported state values require explicit opt-in and are bounded", async () => {
  const s = base(), changed = clone(s);
  changed.state.gold = "secret-".repeat(200);
  const a = await trace([entry(0, s)]), b = await trace([entry(0, changed)]);
  const safe = compareCheckpointTraces(a, b);
  assert.equal(safe.values, undefined);
  const exposed = compareCheckpointTraces(a, b, { includeValues: true });
  assert.equal(exposed.values.candidate.length, 256);
  assert.equal(exposed.values.reference, 1);
});

test("bounded depth/node traversal with mismatched digests reports limitation", async () => {
  const s = base(), changed = clone(s);
  changed.state.nested["a/b~c"][1] = 8;
  const a = await trace([entry(0, s)]), b = await trace([entry(0, changed)]);
  assert.equal(compareCheckpointTraces(a, b, { maximumDepth: 0 }).traversalLimited, true);
  assert.equal(compareCheckpointTraces(a, b, { maximumNodes: 1 }).traversalLimited, true);
  for (const bad of [{ maximumDepth: -1 }, { maximumNodes: 0 }, { includeValues: "yes" }]) {
    assert.throws(() => compareCheckpointTraces(a, b, bad), error => error.code === "PULSE_VALIDATION");
  }
});

test("untrusted getters, corrupted formats and non-contiguous order reject before comparison", async () => {
  const s = base();
  const good = await trace([entry(0, s), entry(1, s)]);
  let calls = 0;
  const invalid = clone(good);
  Object.defineProperty(invalid.checkpoints[0], "trap", {
    enumerable: true, get() { calls++; throw new Error("Getter invoked"); }
  });
  assert.throws(() => compareCheckpointTraces(invalid, good));
  assert.equal(calls, 0);
  const wrongVersion = clone(good);
  wrongVersion.version = 9;
  assert.throws(() => compareCheckpointTraces(wrongVersion, good), error => error.code === "PULSE_COMPATIBILITY");
  const wrongSequence = clone(good);
  wrongSequence.checkpoints[1].sequence = 0;
  assert.throws(() => compareCheckpointTraces(wrongSequence, good), error => error.code === "PULSE_VALIDATION");
  const wrongDigest = clone(good);
  wrongDigest.checkpoints[0].digest = "sha1:a";
  assert.throws(() => compareCheckpointTraces(wrongDigest, good));
});

test("outcome traces can be derived from real replay command checkpoints", async () => {
  const counter = () => createEngine({
    initialState: { gold: 0 }, seed: "replay-trace", systems: [{
      id: "gold", onAction({ action, state }) {
        if (action.type === "gold") return { state: { gold: state.gold + 1 } };
      }
    }]
  });
  const original = counter();
  const starting = original.snapshot();
  const commands = [
    { sequence: 1, kind: "dispatch", action: { type: "gold" }, outcome: { status: "accepted" } },
    { sequence: 2, kind: "step", outcome: { status: "accepted" } }
  ];
  const checkpoints = [entry(0, starting)];
  const outcomes = [];
  for (const command of commands) {
    const result = command.kind === "step" ? original.step() : original.dispatch(command.action);
    outcomes.push(result);
    checkpoints.push(entry(command.sequence, original.snapshot(), command.kind, command.outcome));
  }
  const record = createReplayRecord({
    configurationId: "counter/v1", seed: "replay-trace",
    initialSnapshot: starting, initialPaused: false, commands
  });
  const replayCheckpoints = [];
  const replayed = replayCommands(record, {
    expectedConfigurationId: "counter/v1",
    createConfiguredEngine: () => counter(),
    onCheckpoint: cp => replayCheckpoints.push(cp)
  });
  assert.equal(replayed.status, "completed");
  const reference = await createCheckpointTrace({
    configurationId: "counter/v1", commandCount: 2, checkpoints, includeSnapshots: true
  });
  const candidate = await createCheckpointTrace({
    configurationId: "counter/v1", commandCount: 2,
    checkpoints: replayCheckpoints, includeSnapshots: true
  });
  assert.equal(compareCheckpointTraces(reference, candidate).status, "no-divergence");
  original.dispose();
});

test("digest-only sidecars remain private and report observed differences without path invention", async () => {
  const s = base(), changed = clone(s);
  changed.state.gold = 8;
  const a = await trace([entry(0, s), entry(1, s)], { includeSnapshots: false });
  const b = await trace([entry(0, s), entry(1, changed)], { includeSnapshots: false });
  assert.equal(a.checkpoints[0].snapshot, undefined);
  const r = compareCheckpointTraces(a, b);
  assert.equal(r.status, "diverged");
  assert.equal(r.path, null);
  assert.equal(r.category, "checkpoint");
});
