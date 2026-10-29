// Compile-only contract fixture: expected-error examples must never be executed.
import * as pulse from "@keepithandy/pulse-engine";
import type { Action, Plugin, Rule, PublishedEvent } from "@keepithandy/pulse-engine";

interface State { count: number; rolls: number[] }
type Command = { type: "add"; amount: number } | { type: "roll" };
type Event = { type: "count/changed"; payload: { total: number } };
const plugin: Plugin<State, Command, Event> = {
  id: "counter",
  setup({ getState, getRandomState }) {
    const count: number = getState().count;
    const seed: number = getRandomState().seed;
    void [count, seed];
  },
  onAction({ action, state, random, emit }) {
    if (action.type === "add") {
      const count = state.count + action.amount;
      emit({ type: "count/changed", payload: { total: count } });
      return { state: { ...state, count } };
    }
    if (action.type === "roll") return { state: { ...state, rolls: [...state.rolls, random.integer(1, 6)] } };
  },
  afterTick({ getState, tick }) { void [getState().count, tick]; }
};
const rule: Rule<State, Command, Event> = {
  id: "cap", condition: ({ state }) => state.count > 100,
  effect: () => ({ accepted: false, reason: "Too high." })
};
const engine = pulse.createEngine<State, Command, Event>({
  initialState: { count: 0, rolls: [] }, systems: [plugin], rules: [rule],
  validateState: state => state.count >= 0
});
const result = engine.dispatch({ type: "add", amount: 2 });
if (result.accepted) {
  const total: number = result.state.count;
  result.events.forEach(event => { const value: number = event.payload.total; void value; });
  void [total, result.listenerErrors];
} else { const reason: unknown = result.reason; void reason; }
engine.subscribe(({ action, state }) => { if (action.type === "add") void action.amount; void state.count; });
engine.subscribeToEvents(event => {
  if (event.type === "count/changed") { const total: number = event.payload.total; void total; }
  if (event.type === "engine/tick") { const tick: number = event.payload.tick; void tick; }
});
const snapshot = engine.snapshot();
engine.restore(snapshot);
engine.importSave(engine.exportSave());
engine.fork("alternate");
engine.schedule({ type: "roll" }, { at: 1, interval: 2, limit: 3 });
engine.step().scheduled.forEach(job => { if (job.accepted) void job.state.count; });
engine.advance(2); engine.pause(); engine.resume();
const inspected = engine.inspect();
if (inspected) { const count: number = inspected.state.count; void count; }
engine.getEvents(); engine.getSchedules(); engine.getTick(); engine.getRandomState(); engine.getPlugins();
engine.getExplanation("action-1"); engine.cancelSchedule("schedule-1"); engine.registerPlugin(plugin); engine.unregisterPlugin(plugin.id);
const inferred = pulse.createEngine({ initialState: { health: 20 } });
const health: number = inferred.getState().health;
inferred.dispatch({ type: "heal", amount: 2 });
const redacted = pulse.createEngine({ initialState: { secret: "x" }, redact: () => ({ hidden: true }) });
const hidden: boolean | undefined = redacted.inspect()?.hidden;
void [health, hidden];

const world = pulse.createEngine({ systems: [pulse.createWorldPlugin()] });
world.dispatch({ type: "world/entity.create", entityType: "worker", components: { health: 10 } });
pulse.getEntity(world.getState(), "entity-000001");
pulse.getEntity({ gold: 5 }, "missing");
pulse.queryEntities(world.getState(), { with: ["health"] });
pulse.validateWorldState(world.getState());
const scenario = { version: 1 as const, seed: 1, systems: [], entities: [], relationships: [], resources: {} };
const validation = pulse.validateScenario(scenario);
if (validation.valid) { const version: 1 = validation.value.version; void version; }
pulse.createEngineFromScenario(scenario, { systemRegistry: pulse.exampleSystemRegistry }).step();
const journal = pulse.createEventJournal<Event>();
const published: PublishedEvent<Event> = journal.publish({ type: "count/changed", payload: { total: 1 } }).event;
journal.prepare([{ type: "count/changed", payload: { total: 2 } }]);
journal.restoreState(journal.exportState()); journal.read(); journal.subscribe(() => {})(); journal.clearSubscribers();
const scheduler = pulse.createTickScheduler<Command>();
scheduler.schedule({ type: "roll" }, { at: 1 }); scheduler.restoreState(scheduler.exportState());
scheduler.due(1); scheduler.validateDue(1); scheduler.list(); scheduler.consume("x"); scheduler.cancel("x");
const registry = pulse.createPluginRegistry([plugin]);
registry.list(); registry.ordered(); registry.register(plugin); registry.remove("counter");
pulse.createRuleEvaluator([rule]).evaluate({ action: { type: "roll" }, state: { count: 0, rolls: [] }, random: pulse.createSeededRandom(), tick: 0 });
const built = pulse.createSnapshotRecord({ ...snapshot });
const builtCount: number = built.state.count;
void builtCount;
const envelope = pulse.validateSnapshotRecord(built);
// @ts-expect-error Envelope validation does not establish nested random-state validity.
envelope.randomState.seed;
pulse.forkSnapshotRecord(built, "fork"); pulse.validateSnapshotRecord(built);
pulse.serializeSnapshot(built); pulse.deserializeSave(engine.exportSave());
pulse.createMigrationRegistry([{ from: 0, to: 1, migrate: input => ({ ...input, version: 1 }) }]).migrate({ version: 0 }, 1);
void [pulse.ENGINE_VERSION, pulse.SNAPSHOT_FORMAT, pulse.SNAPSHOT_VERSION, pulse.SAVE_FORMAT, pulse.SAVE_VERSION, pulse.SCENARIO_VERSION, published];
const picked: "a" | "b" = pulse.createSeededRandom().pick(["a", "b"] as const);
void picked;
// P03-01: replay input commands are typed and distinguish host-originated calls.
const replayInput: pulse.ReplayCommand<Command> = {
  sequence: 1, kind: "dispatch", action: { type: "add", amount: 2 }, outcome: { status: "accepted" }
};
const replay = pulse.createReplayRecord({
  configurationId: "typed-counter-v1", seed: 0, initialSnapshot: snapshot, initialPaused: false,
  commands: [replayInput, { sequence: 2, kind: "advance", count: 1 }]
});
const replayVersion: 1 = replay.version;
const checkedReplay = pulse.validateReplayRecord(replay);
const replayFormat: "pulse-engine-replay" = pulse.REPLAY_FORMAT;
void [replayVersion, checkedReplay, replayFormat, pulse.REPLAY_VERSION];
// @ts-expect-error Replays have a discriminated command kind.
const invalidReplayKind: pulse.ReplayCommand<Command> = { sequence: 2, kind: "internal-tick" };
// @ts-expect-error Dispatch payload must match the declared union.
const invalidReplayAction: pulse.ReplayCommand<Command> = { sequence: 1, kind: "dispatch", action: { type: "add", amount: "two" } };
// @ts-expect-error Advance requires an explicit count.
const invalidReplayAdvance: pulse.ReplayCommand<Command> = { sequence: 3, kind: "advance" };
// @ts-expect-error Cannot attach a rejection reason to an accepted outcome.
const invalidReplayOutcome: pulse.ReplayOutcome = { status: "accepted", reason: "failed" };
void [invalidReplayKind, invalidReplayAction, invalidReplayAdvance, invalidReplayOutcome];


// P03-03: the public replay executor owns the temporary engine and narrows its result.
const execution = pulse.replayCommands(replay, {
  expectedConfigurationId: "typed-counter-v1",
  createConfiguredEngine({ seed }) { return pulse.createEngine({ initialState: { count: 0, rolls: [] }, seed }); },
  onCheckpoint(checkpoint) {
    const sequence: number = checkpoint.sequence;
    const tick: number = checkpoint.snapshot.tick;
    void [sequence, tick];
    // @ts-expect-error Replay snapshots are deeply readonly.
    checkpoint.snapshot.tick = 100;
  }
});
if (execution.status === "completed") {
  const count: number = execution.finalSnapshot.state.count;
  void count;
} else {
  const sequence: number = execution.divergence.sequence;
  // @ts-expect-error Divergence reports deliberately do not expose full state.
  execution.finalSnapshot;
  void sequence;
}
// @ts-expect-error An explicit trusted configuration identity is mandatory.
pulse.replayCommands(replay, { createConfiguredEngine: () => engine });

const checksum: Promise<`sha256-v1:${string}`> = pulse.digestCheckpoint(snapshot);
const normalizedChecksum: Promise<string> = checksum;
void normalizedChecksum;
const recording = engine.startRecording({
  configurationId: "typed-counter-v1",
  sink(entry) {
    if (entry.type === "start") { const count: number = entry.record.initialSnapshot.state.count; void count; }
    if (entry.type === "command" && entry.command.kind === "dispatch" && entry.command.action.type === "add") {
      const amount: number = entry.command.action.amount;
      const outcome: pulse.ReplayOutcome = entry.command.outcome;
      void [amount, outcome];
      // @ts-expect-error Stream commands are deeply readonly.
      entry.command.action.amount = 0;
    }
    if (entry.type === "end") { const count: number = entry.commandCount; void count; }
  }
});
const recordingStatus: pulse.ReplayRecordingStatus = recording.getStatus();
recording.stop();
const recordedCount: number = recording.getRecord().initialSnapshot.state.count;
void [recordingStatus, recordedCount];
// @ts-expect-error A recording requires a configuration identity.
engine.startRecording({});
// @ts-expect-error Streaming sinks must be synchronous.
engine.startRecording({ configurationId: "v1", sink: async () => {} });
// @ts-expect-error Retention is a boolean option.
engine.startRecording({ configurationId: "v1", retainCommands: "no" });

engine.dispose();

// Every expected error must remain an error; tsc rejects unused directives.
// @ts-expect-error Unknown action type.
engine.dispatch({ type: "remove" });
// @ts-expect-error Required action field missing.
engine.dispatch({ type: "add" });
// @ts-expect-error Action payload has the wrong type.
engine.schedule({ type: "add", amount: "2" }, { at: 1 });
// @ts-expect-error Required scheduling tick missing.
engine.schedule({ type: "roll" }, {});
// @ts-expect-error Frozen snapshot data is not writable.
snapshot.state.count = 5;
// @ts-expect-error Published payload is deeply readonly.
published.payload.total = 4;
// @ts-expect-error World component writes require a value.
world.dispatch({ type: "world/component.set", entityId: "hero", component: "health" });
// @ts-expect-error State is inferred from initialState.
inferred.getState().missing;
// @ts-expect-error Async state transitions are unsupported.
const asyncPlugin: Plugin<State, Command, Event> = { id: "async", onAction: async () => ({ state: { count: 0, rolls: [] } }) };
// @ts-expect-error A replacement state must have the complete state shape.
const badPlugin: Plugin<State, Command, Event> = { id: "bad", onAction: () => ({ state: { count: "wrong" } }) };
// @ts-expect-error Event payloads preserve their declared type.
const badEvents: Plugin<State, Command, Event> = { id: "events", onAction: () => ({ events: [{ type: "count/changed", payload: { total: "wrong" } }] }) };
// @ts-expect-error Rules require boolean conditions.
const badRule: Rule<State, Command, Event> = { id: "bad", condition: () => 1, effect: () => ({}) };
// @ts-expect-error Rules cannot return Promise effects.
const asyncRule: Rule<State, Command, Event> = { id: "async", condition: () => true, effect: async () => ({}) };
// @ts-expect-error Rule conditions cannot return Promises.
const asyncCondition: Rule<State, Command, Event> = { id: "async", condition: async () => true, effect: () => ({}) };
// @ts-expect-error Hook state replacements must include all required fields.
const missingState: Plugin<State, Command, Event> = { id: "missing", onAction: () => ({ state: { count: 2 } }) };
// @ts-expect-error An action must have a string type.
const badAction: Action = { type: 5 };
void [asyncPlugin, badPlugin, badEvents, badRule, asyncRule, asyncCondition, missingState, badAction];
