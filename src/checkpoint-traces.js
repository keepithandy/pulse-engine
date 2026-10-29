
import { copyData, freezeData } from "./data.js";
import { digestCheckpoint } from "./checkpoint-digest.js";
import { pulseError } from "./errors.js";

export const CHECKPOINT_TRACE_FORMAT = "pulse-checkpoint-trace";
export const CHECKPOINT_TRACE_VERSION = 1;

const KINDS = new Set(["dispatch", "step", "advance", "schedule", "cancelSchedule", "pause", "resume"]);
const OUTCOMES = new Set(["accepted", "rejected", "error"]);
const DIGEST_PATTERN = /^sha256-v1:[0-9a-f]{64}$/;
const DEFAULT_DEPTH = 32;
const DEFAULT_NODES = 10000;

function invalid(message) {
  throw pulseError(TypeError, "PULSE_VALIDATION", "validation", message);
}

function exactShape(value, required, optional, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(label + " must be an object.");
  const allowed = new Set([...required, ...optional]);
  for (const key of required) if (!Object.hasOwn(value, key)) invalid(label + "." + key + " is required.");
  for (const key of Object.keys(value)) if (!allowed.has(key)) invalid(label + "." + key + " is unsupported.");
}

function counter(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(label + " must be a nonnegative safe integer.");
}

function validateTrace(input) {
  const trace = copyData(input);
  exactShape(trace, ["format", "version", "configurationId", "commandCount", "checkpoints"], [], "trace");
  if (trace.format !== CHECKPOINT_TRACE_FORMAT) invalid("Incorrect checkpoint trace format.");
  if (trace.version !== CHECKPOINT_TRACE_VERSION) {
    throw pulseError(RangeError, "PULSE_COMPATIBILITY", "compatibility", "Unsupported checkpoint trace version.");
  }
  if (typeof trace.configurationId !== "string" || !trace.configurationId.trim() ||
      trace.configurationId !== trace.configurationId.trim()) invalid("A stable configurationId is required.");
  counter(trace.commandCount, "commandCount");
  if (!Array.isArray(trace.checkpoints)) invalid("Trace checkpoints must be an array.");
  let previous = -1;
  for (const entry of trace.checkpoints) {
    exactShape(entry, ["sequence", "kind", "tick", "outcome", "digest"], ["snapshot"], "checkpoint");
    counter(entry.sequence, "checkpoint.sequence");
    counter(entry.tick, "checkpoint.tick");
    if (entry.sequence <= previous || entry.sequence > trace.commandCount) {
      invalid("Checkpoint sequence must be strictly increasing within commandCount.");
    }
    if (entry.sequence === 0 ? entry.kind !== "initial" || entry.outcome !== null
      : !KINDS.has(entry.kind) || entry.outcome === null) invalid("Checkpoint kind/outcome is incompatible with sequence.");
    if (entry.sequence !== 0) {
      exactShape(entry.outcome, ["status"], ["reason"], "checkpoint.outcome");
      if (!OUTCOMES.has(entry.outcome.status)) invalid("Invalid command outcome.");
      if (entry.outcome.reason !== undefined &&
        (typeof entry.outcome.reason !== "string" || !entry.outcome.reason.trim())) invalid("Invalid outcome reason.");
      if (entry.outcome.status === "accepted" && entry.outcome.reason !== undefined) invalid("Accepted outcomes cannot include a reason.");
      if (entry.outcome.status === "error" && entry.outcome.reason === undefined) invalid("Error outcomes require a reason.");
    }
    if (typeof entry.digest !== "string" || !DIGEST_PATTERN.test(entry.digest)) invalid("Unsupported checkpoint digest.");
    if (Object.hasOwn(entry, "snapshot")) {
      if (entry.snapshot === null || typeof entry.snapshot !== "object" || Array.isArray(entry.snapshot)) {
        invalid("Checkpoint snapshot must be an object.");
      }
      if (entry.snapshot.tick !== entry.tick) invalid("Trace tick differs from checkpoint tick.");
    }
    previous = entry.sequence;
  }
  return freezeData(trace);
}

/**
 * Creates a detached trace from replayCommands onCheckpoint entries.
 * No additional fields are written to the v1 replay command record.
 */
export async function createCheckpointTrace({ configurationId, commandCount, checkpoints, includeSnapshots = false } = {}) {
  if (!Array.isArray(checkpoints) || typeof includeSnapshots !== "boolean") invalid("Invalid checkpoint trace inputs.");
  counter(commandCount, "commandCount");
  const result = [];
  for (const entry of checkpoints) {
    const captured = copyData(entry);
    exactShape(captured, ["sequence", "kind", "tick", "outcome", "snapshot"], [], "replay checkpoint");
    const digest = await digestCheckpoint(captured.snapshot);
    result.push({
      sequence: captured.sequence, kind: captured.kind, tick: captured.tick,
      outcome: captured.outcome, digest,
      ...(includeSnapshots ? { snapshot: captured.snapshot } : {})
    });
  }
  return validateTrace({
    format: CHECKPOINT_TRACE_FORMAT, version: CHECKPOINT_TRACE_VERSION,
    configurationId, commandCount, checkpoints: result
  });
}

function equals(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((key, i) => key === kb[i] && equals(a[key], b[key]));
}

function jsonPointer(key) {
  return String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

function firstPath(reference, candidate, maxDepth, maxNodes, includeValues) {
  const rootA = { ...reference, label: null };
  const rootB = { ...candidate, label: null };
  const stack = [{ a: rootA, b: rootB, path: "", depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const { a, b, path, depth, missing, values } = stack.pop();
    if (++visited > maxNodes || depth > maxDepth) return { path: null, traversalLimited: true };
    if (missing) return { path, traversalLimited: false, ...(includeValues ? { values } : {}) };
    if (Object.is(a, b)) continue;
    if (a && b && typeof a === "object" && typeof b === "object" &&
        Array.isArray(a) === Array.isArray(b)) {
      const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
        .sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
      if (depth === maxDepth) return { path: null, traversalLimited: true };
      // Push reverse order so that depth-first traversal visits the first key.
      for (let i = keys.length - 1; i >= 0; i -= 1) {
        const key = keys[i];
        const nextPath = path + "/" + jsonPointer(key);
        if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) {
          const leaf = { path: nextPath, traversalLimited: false };
          if (includeValues) leaf.values = {
            reference: Object.hasOwn(a, key) ? scalar(a[key]) : { missing: true },
            candidate: Object.hasOwn(b, key) ? scalar(b[key]) : { missing: true }
          };
          stack.push({ ...leaf, missing: true, depth: depth + 1 });
        } else stack.push({ a: a[key], b: b[key], path: nextPath, depth: depth + 1 });
      }
      continue;
    }
    const leaf = { path: path || "/", traversalLimited: false };
    if (includeValues) leaf.values = { reference: scalar(a), candidate: scalar(b) };
    return leaf;
  }
  return { path: null, traversalLimited: false };
}

function scalar(value) {
  if (value === null || typeof value !== "object") {
    return typeof value === "string" && value.length > 256 ? value.slice(0, 256) : value;
  }
  return { type: Array.isArray(value) ? "array" : "object", valueOmitted: true };
}

function category(path, changedOutcome) {
  if (changedOutcome) return "outcome";
  const first = path?.split("/")[1];
  return ({ state: "state", schedules: "scheduler", randomState: "random", events: "events" })[first] ?? (path ? "metadata" : "checkpoint");
}

/** Synchronously compare host-prepared digest sidecars with bounded redacted diffs. */
export function compareCheckpointTraces(reference, candidate, {
  includeValues = false, maximumDepth = DEFAULT_DEPTH, maximumNodes = DEFAULT_NODES
} = {}) {
  if (typeof includeValues !== "boolean" || !Number.isSafeInteger(maximumDepth) || maximumDepth < 0 ||
      maximumDepth > 128 || !Number.isSafeInteger(maximumNodes) || maximumNodes < 1 || maximumNodes > 1000000) {
    invalid("Invalid checkpoint comparison limits.");
  }
  const a = validateTrace(reference);
  const b = validateTrace(candidate);
  if (a.configurationId !== b.configurationId) return freezeData({
    status: "different-recordings", category: "config", reason: "Configuration identity differs."
  });
  if (a.commandCount !== b.commandCount) return freezeData({
    status: "different-recordings", category: "commands", reason: "Recorded command counts differ."
  });
  const ma = new Map(a.checkpoints.map(entry => [entry.sequence, entry]));
  const mb = new Map(b.checkpoints.map(entry => [entry.sequence, entry]));
  if (!ma.has(0) || !mb.has(0)) return freezeData({
    status: "insufficient-trace", reason: "Both traces require a starting checkpoint.", lastMatchedSequence: null
  });
  const shared = [...ma.keys()].filter(sequence => mb.has(sequence)).sort((x, y) => x - y);
  let lastMatched = -1;
  let anyGaps = a.checkpoints.length !== b.checkpoints.length;
  for (const sequence of shared) {
    const left = ma.get(sequence), right = mb.get(sequence);
    if (left.kind !== right.kind) return freezeData({
      status: "different-recordings", category: "commands", reason: "Command kinds differ.", sequence
    });
    const outcomeDiff = !equals(left.outcome, right.outcome);
    const changed = left.tick !== right.tick || outcomeDiff || left.digest !== right.digest;
    if (changed) {
      let diff = { path: null, traversalLimited: false };
      if (left.snapshot && right.snapshot && left.digest !== right.digest) {
        diff = firstPath(left.snapshot, right.snapshot, maximumDepth, maximumNodes, includeValues);
      }
      return freezeData({
        status: "diverged",
        location: sequence === 0 ? "initial-checkpoint" : "command",
        configurationId: a.configurationId,
        firstPossibleSequence: lastMatched + 1,
        firstObservedSequence: sequence,
        precision: sequence === lastMatched + 1 ? "exact" : "interval",
        kind: left.kind,
        tick: { reference: left.tick, candidate: right.tick },
        category: category(diff.path, outcomeDiff),
        path: diff.path,
        traversalLimited: diff.traversalLimited,
        ...(includeValues && diff.values ? { values: diff.values } : {})
      });
    }
    if (lastMatched >= 0 && sequence !== lastMatched + 1) anyGaps = true;
    lastMatched = sequence;
  }
  if (lastMatched !== a.commandCount || anyGaps || shared.length !== a.checkpoints.length ||
      shared.length !== b.checkpoints.length) return freezeData({
    status: "insufficient-trace", reason: "Unobserved commands could have diverged and reconverged.",
    lastMatchedSequence: lastMatched
  });
  return freezeData({ status: "no-divergence", configurationId: a.configurationId, commandCount: a.commandCount });
}
