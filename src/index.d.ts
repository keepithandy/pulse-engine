/** Pre-alpha package-root declarations. JSON safety and numeric bounds remain runtime checks. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export interface Action { type: string; id?: string }
export type AnyAction = Action & Record<string, unknown>;
export interface TickAction { type: "@pulse/tick"; id?: string }
export interface EventInput<P = unknown, M = unknown> {
  type: string; version?: 1; id?: string; tick?: number; source?: string; payload?: P; metadata?: M;
}
type EventValue<E, K extends PropertyKey> = K extends keyof E
  ? undefined extends E[K] ? Exclude<E[K], undefined | null> | Record<string, never> : E[K]
  : Record<string, never>;
export type PublishedEvent<E extends EventInput = EventInput> = E extends EventInput ?
  DeepReadonly<Omit<E, "version" | "id" | "tick" | "source" | "payload" | "metadata">> & {
    readonly version: 1; readonly id: string; readonly tick: number; readonly source: string;
    readonly payload: DeepReadonly<EventValue<E, "payload">>; readonly metadata: DeepReadonly<EventValue<E, "metadata">>;
  } : never;
export interface TickEvent extends EventInput<{ tick: number }> { type: "engine/tick"; payload: { tick: number } }
export type ObservedEvent<E extends EventInput> = E | TickEvent;
export interface RandomState { algorithm: "mulberry32-v1"; seed: number; state: number }
export interface RandomSampling {
  next(): number;
  float(min?: number, max?: number): number;
  integer(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
}
export interface SeededRandom extends RandomSampling {
  getState(): Readonly<RandomState>;
  setState(snapshot: unknown): void;
}
export function createSeededRandom(seed?: string | number): Readonly<SeededRandom>;

export interface EventQuery { type?: string; limit?: number }
export interface EventFilter { type?: string }
export type Unsubscribe = () => boolean;
export interface EventJournalState<E extends EventInput = EventInput> {
  format: "pulse-event-journal"; version: 1; sequence: number; history: readonly PublishedEvent<E>[];
}
export interface EventJournal<E extends EventInput = EventInput> {
  publish(input: E, defaults?: { tick?: number; source?: string }): { event: PublishedEvent<E>; listenerErrors: unknown[] };
  prepare(inputs: readonly E[], defaults?: { tick?: number; source?: string }): DeepReadonly<(E & { tick: number; source: string })[]>;
  read(options?: EventQuery): PublishedEvent<E>[];
  subscribe(listener: (event: PublishedEvent<E>) => void, options?: EventFilter): Unsubscribe;
  clearSubscribers(): void;
  exportState(): DeepReadonly<EventJournalState<E>>;
  restoreState(snapshot: unknown): void;
}
export function createEventJournal<E extends EventInput = EventInput>(options?: { historyLimit?: number }): Readonly<EventJournal<E>>;

export interface ScheduleOptions { at: number; interval?: number | null; limit?: number | null; id?: string }
export interface ScheduledJob<A extends Action = AnyAction> {
  id: string; sequence: number; action: A; at: number; interval: number | null; remaining: number | null;
}
export interface SchedulerState<A extends Action = AnyAction> { version: 1; sequence: number; jobs: readonly ScheduledJob<A>[] }
export interface TickScheduler<A extends Action = AnyAction> {
  schedule(action: A, options: ScheduleOptions, currentTick?: number): string;
  cancel(id: string): boolean;
  due(tick: number): DeepReadonly<ScheduledJob<A>[]>;
  validateDue(tick: number): void;
  consume(id: string): boolean;
  list(): DeepReadonly<ScheduledJob<A>[]>;
  exportState(): { version: 1; sequence: number; jobs: DeepReadonly<ScheduledJob<A>[]> };
  restoreState(input: unknown, tick?: number): void;
}
export function createTickScheduler<A extends Action = AnyAction>(options?: { capacity?: number }): Readonly<TickScheduler<A>>;

export interface LifecycleContext<S, E extends EventInput = EventInput> {
  readonly pluginId: string;
  getState(): S;
  getTick(): number;
  getEvents(options?: EventQuery): PublishedEvent<ObservedEvent<E>>[];
  getRandomState(): Readonly<RandomState>;
}
export interface ActionContext<S, A extends Action = AnyAction, E extends EventInput = EventInput> {
  action: DeepReadonly<A | TickAction>; state: S; random: Readonly<RandomSampling>; tick: number;
  emit(event: E): void;
}
export type RuleContext<S, A extends Action = AnyAction> = Omit<ActionContext<S, A>, "emit">;
export type HookResponse<S, E extends EventInput = EventInput> =
  | { accepted: false; reason?: unknown }
  | { accepted?: true; state?: S; events?: E[] };
export interface Plugin<S = Record<string, JsonValue>, A extends Action = AnyAction, E extends EventInput = EventInput> {
  id: string; version?: string; dependsOn?: readonly string[];
  setup?(context: Readonly<LifecycleContext<S, E>>): void;
  dispose?(context: Readonly<LifecycleContext<S, E>>): void;
  onAction?(context: ActionContext<S, A, E>): HookResponse<S, E> | void;
  beforeTick?(context: ActionContext<S, A, E>): HookResponse<S, E> | void;
  onEvent?(context: LifecycleContext<S, E> & { event: PublishedEvent<ObservedEvent<E>>; state: S; tick: number }): void;
  afterTick?(context: LifecycleContext<S, E> & { state: S; tick: number }): void;
}
export type System<S = Record<string, JsonValue>, A extends Action = AnyAction, E extends EventInput = EventInput> = Plugin<S, A, E>;
export type PluginHookName = "setup" | "dispose" | "onAction" | "beforeTick" | "onEvent" | "afterTick";
export interface PluginMetadata { id: string; version: string; dependsOn: readonly string[]; hooks: readonly PluginHookName[] }
export type NormalizedPlugin<S, A extends Action, E extends EventInput> = Readonly<
  Omit<Plugin<S, A, E>, "version" | "dependsOn"> & { version: string; dependsOn: readonly string[] }
>;
export interface PluginRegistry<S, A extends Action, E extends EventInput> {
  list(): readonly Readonly<PluginMetadata>[];
  ordered(): readonly NormalizedPlugin<S, A, E>[];
  register(plugin: Plugin<S, A, E>): Readonly<PluginMetadata>;
  remove(id: string): NormalizedPlugin<S, A, E> | null;
}
export function createPluginRegistry<S = Record<string, JsonValue>, A extends Action = AnyAction, E extends EventInput = EventInput>(
  plugins?: readonly Plugin<S, A, E>[]
): Readonly<PluginRegistry<S, A, E>>;

export interface Rule<S = Record<string, JsonValue>, A extends Action = AnyAction, E extends EventInput = EventInput> {
  id: string; priority?: number; conflictKey?: string;
  condition(context: RuleContext<S, A>): boolean;
  effect(context: RuleContext<S, A>): HookResponse<S, E> | void;
}
export interface RuleTrace { ruleId: string; status: "skipped" | "rejected" | "applied"; reason: string; effects: string[] }
export type RuleDecision<S, E extends EventInput> =
  | { accepted: true; state: S; events: E[]; traces: RuleTrace[] }
  | { accepted: false; state: S; reason: unknown; events: []; traces: RuleTrace[] };
export interface RuleEvaluator<S, A extends Action, E extends EventInput> {
  evaluate(input: { action: A | TickAction; state: S; random: RandomSampling; tick: number; collectTraces?: boolean }): RuleDecision<S, E>;
}
export function createRuleEvaluator<S = Record<string, JsonValue>, A extends Action = AnyAction, E extends EventInput = EventInput>(
  rules?: readonly Rule<S, A, E>[]
): Readonly<RuleEvaluator<S, A, E>>;

export const ENGINE_VERSION: "0.1.0-alpha.0";
export const SNAPSHOT_FORMAT: "pulse-engine-snapshot";
export const SNAPSHOT_VERSION: 1;
export const SAVE_FORMAT: "pulse-engine-save";
export const SAVE_VERSION: 1;
export const SCENARIO_VERSION: 1;
export interface Branch { id: string; parentId: string | null }
export interface Snapshot<S = unknown, A extends Action = AnyAction, E extends EventInput = EventInput> {
  format: typeof SNAPSHOT_FORMAT; version: typeof SNAPSHOT_VERSION; engineVersion: typeof ENGINE_VERSION;
  label: unknown; branch: Branch; revision: number; actionSequence: number; tick: number;
  state: S; randomState: RandomState; events: EventJournalState<E>; schedules: SchedulerState<A>;
}
/** The advanced builder clones fields; it does not validate their nested contents. */
export interface SnapshotFields {
  actionSequence: number; revision: number; state: unknown; randomState: unknown; events: unknown;
  branch: { id: string; parentId?: string | null }; label?: unknown; tick?: number; schedules?: unknown;
}
export type BuiltSnapshot<T extends SnapshotFields> = DeepReadonly<{
  format: typeof SNAPSHOT_FORMAT; version: 1; engineVersion: typeof ENGINE_VERSION;
  label: T extends { label: infer L } ? L | null : null; branch: Branch;
  revision: number; actionSequence: number; tick: number; state: T["state"];
  randomState: T["randomState"]; events: T["events"];
  schedules: T extends { schedules: infer J } ? J : SchedulerState;
}>;
export function createSnapshotRecord<T extends SnapshotFields>(fields: T): BuiltSnapshot<T>;
export interface SnapshotEnvelope {
  format: typeof SNAPSHOT_FORMAT; version: 1; engineVersion: typeof ENGINE_VERSION;
  branch: Branch; revision: number; actionSequence: number; tick: number; schedules: unknown;
  [key: string]: unknown;
}
export function validateSnapshotRecord(input: unknown): SnapshotEnvelope;
export function forkSnapshotRecord<T extends SnapshotFields & { format: typeof SNAPSHOT_FORMAT; version: 1; engineVersion: typeof ENGINE_VERSION }>(
  snapshot: T, branchId: string
): DeepReadonly<Omit<T, "branch" | "label"> & { branch: Branch; label: null }>;
export interface VersionedData { version: number; [key: string]: unknown }
export interface Migration { from: number; to: number; migrate(input: VersionedData): VersionedData }
export interface MigrationOptions { migrations?: readonly Migration[] }
export function createMigrationRegistry(migrations?: readonly Migration[]): Readonly<{ migrate(input: unknown, targetVersion: number): VersionedData }>;
export function serializeSnapshot(snapshot: unknown): string;
/** Unwraps data only; use engine.importSave for complete restore validation. */
export function deserializeSave(input: unknown, options?: MigrationOptions): unknown;

export interface Explanation { actionId: string; tick: number; revision: number; accepted: boolean; reason: string; traces: RuleTrace[] }
export interface AcceptedDispatch<S, A extends Action, E extends EventInput> {
  accepted: true; action: A & { id: string }; revision: number; tick: number; state: S;
  events: PublishedEvent<E>[]; listenerErrors: unknown[]; eventListenerErrors: unknown[]; pluginErrors: unknown[];
}
export interface RejectedDispatch<S, A extends Action> {
  accepted: false; code: "PULSE_REJECTED"; category: "rejection"; action: A & { id: string }; reason: unknown; revision: number; tick: number; state: S;
}
export type DispatchResult<S, A extends Action, E extends EventInput> = AcceptedDispatch<S, A, E> | RejectedDispatch<S, A>;
export type ScheduledResult<S, A extends Action, E extends EventInput> = { scheduleId: string } & (
  DispatchResult<S, A, E> | { accepted: false; reason: string }
);
export interface StepResult<S, A extends Action, E extends EventInput> {
  advanced: boolean; tick: number; result: DispatchResult<S, TickAction, ObservedEvent<E>>;
  scheduled: ScheduledResult<S, A, E>[];
}
export interface StateChange<S, A extends Action> { action: A | TickAction; previousState: S; state: S; revision: number; tick: number }
export interface RestoreResult<S> { restored: true; branch: Branch; revision: number; state: S }
export interface Inspection<S, A extends Action, E extends EventInput> {
  state: S; tick: number; revision: number; branch: Branch; paused: boolean;
  schedules: DeepReadonly<ScheduledJob<A>[]>; plugins: readonly Readonly<PluginMetadata>[];
  events: PublishedEvent<ObservedEvent<E>>[]; traces: Explanation[];
}
export interface EngineOptions<S, A extends Action, E extends EventInput, I = Inspection<S, A, E>> {
  initialState?: S; systems?: readonly Plugin<S, A, E>[]; plugins?: readonly Plugin<S, A, E>[]; rules?: readonly Rule<S, A, E>[];
  seed?: string | number; branchId?: string; eventHistoryLimit?: number; scheduleCapacity?: number;
  validateState?: (state: DeepReadonly<S>) => boolean | void;
  diagnostics?: boolean; traceLimit?: number; redact?: (data: Inspection<S, A, E>) => I;
}
export interface Engine<S, A extends Action = AnyAction, E extends EventInput = EventInput, I = Inspection<S, A, E>> {
  dispatch(action: A): DispatchResult<S, A, E>;
  getState(): S;
  getTick(): number;
  subscribe(listener: (change: StateChange<S, A>) => void): Unsubscribe;
  subscribeToEvents(listener: (event: PublishedEvent<ObservedEvent<E>>) => void, options?: EventFilter): Unsubscribe;
  getEvents(options?: EventQuery): PublishedEvent<ObservedEvent<E>>[];
  getRandomState(): Readonly<RandomState>;
  getPlugins(): readonly Readonly<PluginMetadata>[];
  registerPlugin(plugin: Plugin<S, A, E>): Readonly<PluginMetadata>;
  unregisterPlugin(id: string): boolean;
  snapshot(options?: { label?: JsonValue }): DeepReadonly<Snapshot<S, A, ObservedEvent<E>>>;
  restore(snapshot: unknown): RestoreResult<S>;
  fork(id: string): DeepReadonly<Snapshot<S, A, ObservedEvent<E>>>;
  exportSave(): string;
  importSave(input: unknown, options?: MigrationOptions): RestoreResult<S>;
  schedule(action: A, options: ScheduleOptions): string;
  cancelSchedule(id: string): boolean;
  getSchedules(): DeepReadonly<ScheduledJob<A>[]>;
  step(): StepResult<S, A, E>;
  advance(count?: number): StepResult<S, A, E>[];
  pause(): void;
  resume(): void;
  startRecording(options: ReplayRecordingOptions<S, A, ObservedEvent<E>>): Readonly<ReplayRecording<S, A, ObservedEvent<E>>>;
  inspect(): DeepReadonly<I> | null;
  getExplanation(actionId: string): Explanation | null;
  dispose(): unknown[];
}
export function createEngine<S = Record<string, JsonValue>, A extends Action = AnyAction, E extends EventInput = EventInput, I = Inspection<S, A, E>>(
  options?: EngineOptions<S, A, E, I>
): Readonly<Engine<S, A, E, I>>;

export interface WorldEntity { type: string; components: Record<string, JsonValue> }
export interface World { nextEntity: number; order: string[]; entities: Record<string, WorldEntity> }
export interface WorldState { world?: World }
export type WorldAction =
  | { type: "world/entity.create"; entityType: string; entityId?: string; components?: Record<string, JsonValue>; id?: string }
  | { type: "world/entity.destroy"; entityId: string; id?: string }
  | { type: "world/component.set"; entityId: string; component: string; value: JsonValue; id?: string }
  | { type: "world/component.remove"; entityId: string; component: string; id?: string };
export type WorldEvent =
  | { type: "world/entity.created" | "world/entity.destroyed"; payload: { entityId: string; entityType: string } }
  | { type: "world/component.set" | "world/component.removed"; payload: { entityId: string; component: string } };
export function createWorldPlugin<S extends WorldState = WorldState>(options?: { id?: string; idPrefix?: string }): Readonly<Plugin<S, WorldAction, WorldEvent>>;
export function getEntity<S extends object>(state: S & WorldState, entityId: string): (WorldEntity & { id: string }) | null;
export function queryEntities<S extends object>(state: S & WorldState, options?: { type?: string; with?: string[]; without?: string[] }): (WorldEntity & { id: string })[];
export function validateWorldState(input: unknown): true;

export interface ScenarioEntity { id: string; type: string; [key: string]: unknown }
export interface ScenarioRelationship { from: string; to: string; type: string; [key: string]: unknown }
export interface Scenario {
  version: 1; seed: string | number; systems: string[]; entities: ScenarioEntity[];
  resources: Record<string, number>; relationships: ScenarioRelationship[]; gameData?: Record<string, JsonValue>;
}
export interface ScenarioState {
  entities: ScenarioEntity[]; resources: Record<string, number>; relationships: ScenarioRelationship[]; gameData: Record<string, JsonValue>;
}
export interface ScenarioValidationOptions { validateGameData?: (gameData: Record<string, JsonValue>) => string[] }
export type ScenarioValidation = { valid: true; errors: []; value: Scenario } | { valid: false; errors: string[]; value: null };
export function validateScenario(input: unknown, options?: ScenarioValidationOptions): ScenarioValidation;
export type SystemRegistry<A extends Action = AnyAction, E extends EventInput = EventInput> = Record<string, (scenario: Scenario) => Plugin<ScenarioState, A, E>>;
export function createEngineFromScenario<A extends Action = AnyAction, E extends EventInput = EventInput, I = Inspection<ScenarioState, A, E>>(
  input: unknown,
  options?: Omit<EngineOptions<ScenarioState, A, E, I>, "initialState" | "systems"> & ScenarioValidationOptions & { systemRegistry?: SystemRegistry<A, E> }
): Readonly<Engine<ScenarioState, A, E, I>>;
export const exampleSystemRegistry: Readonly<SystemRegistry>;

/** Structured public failure diagnostic; raw internal and plug-in errors may have unknown codes. */
export function summarizePulseError(error: unknown): {
  code: string; category: string; message: string;
  cause: { name: string; message: string; code: string | null } | null;
};

// Phase 03 input-log contract. The replay protocol records host-originated calls,
// not automatically triggered scheduled actions or bounded event-journal output.
export const REPLAY_FORMAT: "pulse-engine-replay";
export const REPLAY_VERSION: 1;
export type ReplayOutcome =
  | { status: "accepted"; reason?: never }
  | { status: "rejected"; reason?: string }
  | { status: "error"; reason: string };
export type ReplayCommand<A extends Action = AnyAction> = { sequence: number; outcome?: ReplayOutcome } & (
  | { kind: "dispatch"; action: A }
  | { kind: "step" }
  | { kind: "advance"; count: number }
  | { kind: "schedule"; action: A; options: ScheduleOptions }
  | { kind: "cancelSchedule"; id: string }
  | { kind: "pause" }
  | { kind: "resume" }
);
export interface ReplayRecord<S = unknown, A extends Action = AnyAction, E extends EventInput = EventInput> {
  format: typeof REPLAY_FORMAT;
  version: typeof REPLAY_VERSION;
  engineVersion: typeof ENGINE_VERSION;
  configurationId: string;
  seed: string | number;
  initialSnapshot: DeepReadonly<Snapshot<S, A, E>>;
  initialPaused: boolean;
  commands: DeepReadonly<ReplayCommand<A>[]>;
}
/** Builds an immutable replay record. The caller supplies the starting checkpoint. */
export function createReplayRecord<S, A extends Action = AnyAction, E extends EventInput = EventInput>(input: {
  configurationId: string; seed: string | number;
  initialSnapshot: DeepReadonly<Snapshot<S, A, E>>;
  initialPaused: boolean;
  commands?: readonly ReplayCommand<A>[];
}): DeepReadonly<ReplayRecord<S, A, E>>;
/** Validates/detaches a replay record; does not execute or record commands. */
export function validateReplayRecord(input: unknown): DeepReadonly<ReplayRecord>;

export type RecordedReplayCommand<A extends Action = AnyAction> = ReplayCommand<A> & { outcome: ReplayOutcome };
export type ReplayStreamEntry<S = unknown, A extends Action = AnyAction, E extends EventInput = EventInput> =
  | { readonly type: "start"; readonly record: DeepReadonly<ReplayRecord<S, A, E>> }
  | { readonly type: "command"; readonly command: DeepReadonly<RecordedReplayCommand<A>> }
  | { readonly type: "end"; readonly commandCount: number };
export interface ReplayRecordingOptions<S, A extends Action, E extends EventInput> {
  configurationId: string;
  /** Defaults to the engine's construction seed; override after restoring a different seed. */
  seed?: string | number;
  retainCommands?: boolean;
  /** Must complete synchronously. Async sinks are rejected at runtime and by this signature. */
  sink?: (entry: ReplayStreamEntry<S, A, E>) => undefined;
}
export interface ReplayRecordingStatus {
  state: "recording" | "stopped" | "failed";
  commandCount: number;
  retainedCommandCount: number;
  reason: string | null;
}
export interface ReplayRecording<S = unknown, A extends Action = AnyAction, E extends EventInput = EventInput> {
  getStatus(): Readonly<ReplayRecordingStatus>;
  /** Finalizes the stream and releases the engine; idempotent. Can throw on sink failure. */
  stop(): Readonly<ReplayRecordingStatus>;
  /** Available only after a successful stop with retainCommands enabled. */
  getRecord(): DeepReadonly<ReplayRecord<S, A, E>>;
}
