import { copyData, freezeData } from "./data.js";
import { pulseError } from "./errors.js";
import { synchronousResult } from "./hooks.js";
import { validateReplayRecord } from "./replay.js";

const REQUIRED_METHODS = Object.freeze([
  "restore", "snapshot", "dispatch", "step", "advance", "schedule",
  "cancelSchedule", "pause", "resume", "dispose"
]);

function error(message, cause) {
  return pulseError(Error, "PULSE_REPLAY", "replay", message, cause);
}

function messageFor(thrown) {
  // A thrown value may be an arbitrary object. Never run its message getter.
  try {
    const descriptor = thrown && typeof thrown === "object"
      ? Object.getOwnPropertyDescriptor(thrown, "message") : null;
    return typeof descriptor?.value === "string" && descriptor.value.trim()
      ? descriptor.value : "Command threw an error.";
  } catch {
    return "Command threw an error.";
  }
}

function reasonFor(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function observedOutcome(kind, result) {
  let rejection;
  if (kind === "dispatch" && !result.accepted) rejection = result;
  if (kind === "step" && !result.advanced) rejection = result.result;
  if (kind === "advance") rejection = result.find(step => !step.advanced)?.result;
  if (kind === "cancelSchedule" && !result) return { status: "rejected", reason: "Schedule not found." };
  return rejection
    ? { status: "rejected", reason: reasonFor(rejection.reason, "Command rejected.") }
    : { status: "accepted" };
}

function executeCommand(engine, command) {
  switch (command.kind) {
    case "dispatch": return engine.dispatch(command.action);
    case "step": return engine.step();
    case "advance": return engine.advance(command.count);
    case "schedule": return engine.schedule(command.action, command.options);
    case "cancelSchedule": return engine.cancelSchedule(command.id);
    case "pause": return engine.pause();
    case "resume": return engine.resume();
    default: throw error("Unsupported replay command kind.");
  }
}

function equalData(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = Object.keys(left).sort();
  const b = Object.keys(right).sort();
  if (a.length !== b.length || a.some((key, index) => key !== b[index])) return false;
  return a.every(key => equalData(left[key], right[key]));
}

function equivalentSnapshot(expected, actual) {
  // The label is presentation metadata; restoring a snapshot does not restore its label.
  return equalData({ ...expected, label: null }, { ...actual, label: null });
}

function sameOutcome(expected, actual) {
  if (!expected) return actual.status !== "error";
  return expected.status === actual.status &&
    (expected.reason === undefined || expected.reason === actual.reason);
}

function checkpoint(engine) {
  return freezeData(copyData(engine.snapshot()));
}

/**
 * Replays host-approved external inputs in a freshly configured engine.
 * All engine ownership stays inside this call; even a diverged run is disposed.
 */
export function replayCommands(input, {
  expectedConfigurationId, createConfiguredEngine, onCheckpoint
} = {}) {
  const record = validateReplayRecord(input);
  if (typeof expectedConfigurationId !== "string" || !expectedConfigurationId.trim() ||
    expectedConfigurationId !== record.configurationId) {
    throw error("Replay configuration identity does not match the approved host configuration.");
  }
  if (typeof createConfiguredEngine !== "function" ||
    onCheckpoint !== undefined && typeof onCheckpoint !== "function") {
    throw pulseError(TypeError, "PULSE_VALIDATION", "validation",
      "Replay requires a synchronous engine factory and an optional synchronous checkpoint callback.");
  }

  let engine;
  let result;
  let failed = false;
  let originalError;
  let cleanupError;
  try {
    engine = synchronousResult(createConfiguredEngine(Object.freeze({
      configurationId: record.configurationId, seed: record.seed
    })), "Replay engine factories must be synchronous.");
    if (!engine || REQUIRED_METHODS.some(method => typeof engine[method] !== "function")) {
      throw error("The replay factory did not return a complete Pulse Engine interface.");
    }
    engine.restore(record.initialSnapshot);
    if (record.initialPaused) engine.pause();
    else engine.resume();

    const startingSnapshot = checkpoint(engine);
    if (!equivalentSnapshot(record.initialSnapshot, startingSnapshot)) {
      throw error("Restored replay checkpoint differs from the recorded starting checkpoint.");
    }
    function notify(sequence, kind, outcome, snapshot) {
      if (!onCheckpoint) return;
      synchronousResult(onCheckpoint(freezeData({
        sequence, kind, tick: snapshot.tick, outcome: outcome === null ? null : freezeData({ ...outcome }),
        snapshot
      })), "Replay checkpoint callbacks must be synchronous.");
    }
    notify(0, "initial", null, startingSnapshot);

    function run() {
      for (const command of record.commands) {
        let actual;
        try {
          const value = executeCommand(engine, command);
          actual = observedOutcome(command.kind, value);
        } catch (thrown) {
          actual = { status: "error", reason: messageFor(thrown) };
        }

        const wantsSnapshot = !!onCheckpoint;
        const after = wantsSnapshot ? checkpoint(engine) : null;
        if (after) notify(command.sequence, command.kind, actual, after);
        if (!sameOutcome(command.outcome, actual)) {
          return freezeData({
            status: "diverged", commandCount: command.sequence,
            divergence: {
              sequence: command.sequence, kind: command.kind,
              tick: after ? after.tick : engine.snapshot().tick,
              expected: command.outcome ?? null,
              actual
            }
          });
        }
      }
      return freezeData({
        status: "completed", commandCount: record.commands.length,
        finalSnapshot: checkpoint(engine)
      });
    }
    result = run();
  } catch (cause) {
    failed = true;
    originalError = cause;
  } finally {
    if (engine && typeof engine.dispose === "function") {
      try {
        const disposeErrors = engine.dispose();
        if (Array.isArray(disposeErrors) && disposeErrors.length) {
          cleanupError = error("Replay engine disposal reported failures.", disposeErrors[0]);
        }
      } catch (cause) {
        cleanupError = error("Replay engine disposal threw an error.", cause);
      }
    }
  }
  if (failed) throw originalError;
  if (cleanupError) throw cleanupError;
  return result;
}
