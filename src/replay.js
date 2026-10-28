import { copyData, freezeData } from "./data.js";
import { pulseError } from "./errors.js";
import { createEventJournal } from "./events.js";
import { createSeededRandom } from "./random.js";
import { createTickScheduler } from "./scheduler.js";
import { ENGINE_VERSION, validateSnapshotRecord } from "./snapshots.js";

export const REPLAY_FORMAT = "pulse-engine-replay";
export const REPLAY_VERSION = 1;

const COMMAND_KEYS = Object.freeze({
  dispatch: ["action"],
  step: [],
  advance: ["count"],
  schedule: ["action", "options"],
  cancelSchedule: ["id"],
  pause: [],
  resume: []
});
const OUTCOME_STATUSES = new Set(["accepted", "rejected", "error"]);

function fail(path, message) {
  throw pulseError(TypeError, "PULSE_VALIDATION", "validation", `${path}: ${message}`);
}

function record(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected an object.");
}

function shape(value, path, required, allowed = required) {
  record(value, path);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "required.");
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`, "unexpected field.");
}

function name(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    fail(path, "expected a non-empty string.");
  }
}

function counter(value, path, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    fail(path, `expected a safe integer >= ${minimum}.`);
  }
}

function action(value, path) {
  record(value, path);
  if (typeof value.type !== "string" || !value.type.trim()) fail(`${path}.type`, "non-empty action type required.");
  if (value.id !== undefined && (typeof value.id !== "string" || !value.id.trim())) {
    fail(`${path}.id`, "non-empty action id required.");
  }
}

function scheduleOptions(value, path) {
  shape(value, path, ["at"], ["at", "interval", "limit", "id"]);
  counter(value.at, `${path}.at`);
  if (value.interval !== undefined && value.interval !== null) counter(value.interval, `${path}.interval`, 1);
  if (value.limit !== undefined && value.limit !== null) counter(value.limit, `${path}.limit`, 1);
  if ((value.interval === undefined || value.interval === null) && value.limit != null && value.limit !== 1) {
    fail(path, "multiple scheduled runs require an interval.");
  }
  if (value.id !== undefined) name(value.id, `${path}.id`);
}

function outcome(value, path) {
  shape(value, path, ["status"], ["status", "reason"]);
  if (!OUTCOME_STATUSES.has(value.status)) fail(`${path}.status`, "unsupported outcome status.");
  if (value.reason !== undefined && (typeof value.reason !== "string" || !value.reason.trim())) {
    fail(`${path}.reason`, "expected a non-empty reason string.");
  }
  if (value.status === "accepted" && value.reason !== undefined) {
    fail(`${path}.reason`, "accepted outcomes cannot include a failure reason.");
  }
  if (value.status === "error" && value.reason === undefined) {
    fail(`${path}.reason`, "error outcomes require a reason.");
  }
}

function command(value, index) {
  const path = `$.commands[${index}]`;
  record(value, path);
  if (typeof value.kind !== "string" || !Object.hasOwn(COMMAND_KEYS, value.kind)) {
    fail(`${path}.kind`, "unsupported external command.");
  }
  const fields = COMMAND_KEYS[value.kind];
  shape(value, path, ["sequence", "kind", ...fields], ["sequence", "kind", ...fields, "outcome"]);
  counter(value.sequence, `${path}.sequence`, 1);
  if (value.sequence !== index + 1) fail(`${path}.sequence`, "commands must have contiguous sequences starting at 1.");
  if (value.kind === "dispatch" || value.kind === "schedule") action(value.action, `${path}.action`);
  if (value.kind === "advance") counter(value.count, `${path}.count`);
  if (value.kind === "schedule") scheduleOptions(value.options, `${path}.options`);
  if (value.kind === "cancelSchedule") name(value.id, `${path}.id`);
  if (value.outcome !== undefined) outcome(value.outcome, `${path}.outcome`);
}

function initialCheckpoint(snapshot, seed) {
  const candidate = validateSnapshotRecord(snapshot);
  // A replay starts at a complete checkpoint, not just a syntactically valid
  // envelope. Validate the internal subsystem records in disposable instances.
  const random = createSeededRandom(seed);
  random.setState(candidate.randomState);
  if (random.getState().seed !== createSeededRandom(seed).getState().seed) {
    fail("$.initialSnapshot.randomState.seed", "does not match the declared initial seed.");
  }
  const eventHistoryLength = Array.isArray(candidate.events?.history) ? candidate.events.history.length : 0;
  const events = createEventJournal({ historyLimit: Math.max(1, eventHistoryLength) });
  events.restoreState(candidate.events);
  const scheduleLength = Array.isArray(candidate.schedules?.jobs) ? candidate.schedules.jobs.length : 0;
  const scheduler = createTickScheduler({ capacity: Math.max(1, scheduleLength) });
  scheduler.restoreState(candidate.schedules, candidate.tick);
  return candidate;
}

/** Validate and detach a versioned host-authored replay input log. Does not run it. */
export function validateReplayRecord(input) {
  let value;
  try { value = copyData(input); }
  catch (cause) {
    throw pulseError(TypeError, "PULSE_VALIDATION", "validation", `Invalid replay data: ${cause.message}`, cause);
  }
  shape(value, "$", ["format", "version", "engineVersion", "configurationId", "seed", "initialSnapshot", "initialPaused", "commands"]);
  if (value.format !== REPLAY_FORMAT) fail("$.format", "invalid replay format.");
  if (value.version !== REPLAY_VERSION) {
    throw pulseError(RangeError, "PULSE_COMPATIBILITY", "compatibility", `Unsupported replay version: ${value.version}.`);
  }
  if (value.engineVersion !== ENGINE_VERSION) {
    throw pulseError(RangeError, "PULSE_COMPATIBILITY", "compatibility", `Replay engine version ${value.engineVersion} is incompatible with ${ENGINE_VERSION}.`);
  }
  name(value.configurationId, "$.configurationId");
  if (value.configurationId.trim() !== value.configurationId) fail("$.configurationId", "must not have surrounding whitespace.");
  if (!(typeof value.seed === "string" || typeof value.seed === "number" && Number.isFinite(value.seed))) {
    fail("$.seed", "expected a finite number or string.");
  }
  initialCheckpoint(value.initialSnapshot, value.seed);
  if (typeof value.initialPaused !== "boolean") fail("$.initialPaused", "expected a boolean.");
  if (!Array.isArray(value.commands)) fail("$.commands", "expected an array.");
  value.commands.forEach(command);
  return freezeData(value);
}

/** Build a replay envelope from an explicit starting checkpoint and input commands. */
export function createReplayRecord(input) {
  let value;
  try { value = copyData(input); }
  catch (cause) {
    throw pulseError(TypeError, "PULSE_VALIDATION", "validation", `Invalid replay configuration: ${cause.message}`, cause);
  }
  record(value, "$");
  shape(value, "$", ["configurationId", "seed", "initialSnapshot", "initialPaused"], ["configurationId", "seed", "initialSnapshot", "initialPaused", "commands"]);
  return validateReplayRecord({
    format: REPLAY_FORMAT,
    version: REPLAY_VERSION,
    engineVersion: ENGINE_VERSION,
    configurationId: value.configurationId,
    seed: value.seed,
    initialSnapshot: value.initialSnapshot,
    initialPaused: value.initialPaused,
    commands: value.commands ?? []
  });
}
