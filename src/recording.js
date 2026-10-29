import { copyData, freezeData } from "./data.js";
import { pulseError } from "./errors.js";
import { synchronousResult } from "./hooks.js";
import { createReplayRecord, validateReplayCommand } from "./replay.js";

function reason(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function errorReason(error) {
  // Do not invoke arbitrary thrown values' getters or string conversion.
  try {
    const descriptor = error && typeof error === "object" && Object.getOwnPropertyDescriptor(error, "message");
    return reason(descriptor?.value, "Command threw an error.");
  } catch { return "Command threw an error."; }
}

function outcomeFor(kind, result) {
  let rejection;
  if (kind === "dispatch" && !result.accepted) rejection = result;
  if (kind === "step" && !result.advanced) rejection = result.result;
  if (kind === "advance") rejection = result.find(step => !step.advanced)?.result;
  if (kind === "cancelSchedule" && !result) return { status: "rejected", reason: "Schedule not found." };
  return rejection
    ? { status: "rejected", reason: reason(rejection.reason, "Command rejected.") }
    : { status: "accepted" };
}

// Private controller: engine.js owns capture, operation boundaries and locking.
export function createRecording({ configurationId, seed, initialSnapshot, initialPaused, sink, retainCommands = true }, { locked, release }) {
  if (typeof retainCommands !== "boolean" || sink !== undefined && typeof sink !== "function") {
    throw pulseError(TypeError, "PULSE_VALIDATION", "validation", "Invalid recording sink or retention option.");
  }
  if (!retainCommands && !sink) throw pulseError(TypeError, "PULSE_VALIDATION", "validation", "Streaming recordings require a sink.");
  const header = createReplayRecord({ configurationId, seed, initialSnapshot, initialPaused });
  const commands = [];
  let state = "recording";
  let count = 0;
  let failureReason = null;
  let released = false;

  function fail(message, cause, commandExecuted = false) {
    state = "failed";
    failureReason ??= message;
    const error = pulseError(Error, "PULSE_RECORDING", "recording", failureReason, cause);
    error.commandExecuted = commandExecuted;
    return error;
  }
  function assertRecording() {
    if (state !== "recording") throw fail("Recording is incomplete; stop it before continuing.");
  }
  function emit(entry, commandExecuted = false) {
    if (!sink) return;
    try { synchronousResult(sink(freezeData(entry)), "Recording sinks must be synchronous."); }
    catch (cause) { throw fail("Recording sink failed; this recording is incomplete.", cause, commandExecuted); }
  }
  function getStatus() {
    return Object.freeze({ state, commandCount: count, retainedCommandCount: commands.length, reason: failureReason });
  }
  function prepare(kind, fields) {
    assertRecording();
    try {
      const command = copyData({ ...fields, sequence: count + 1, kind });
      validateReplayCommand(command, count);
      return freezeData(command);
    } catch (cause) {
      throw fail("Command cannot be represented by replay v1; it was not executed.", cause);
    }
  }
  function complete(command, result, thrown, didThrow) {
    try {
      const outcome = didThrow ? { status: "error", reason: errorReason(thrown) } : outcomeFor(command.kind, result);
      const entry = freezeData({ ...command, outcome });
      count += 1;
      if (retainCommands) commands.push(entry);
      emit({ type: "command", command: entry }, true);
    } catch (cause) {
      if (state === "failed") throw cause;
      throw fail("Recording completion failed; this recording is incomplete.", cause, true);
    }
  }
  function stop() {
    return locked(() => {
      if (released) return getStatus();
      try {
        if (state === "recording") {
          emit({ type: "end", commandCount: count });
          state = "stopped";
        }
        return getStatus();
      } finally { released = true; release(); }
    });
  }
  function getRecord() {
    return locked(() => {
      if (state !== "stopped" || !retainCommands) {
        throw pulseError(Error, "PULSE_RECORDING", "recording", "A complete retained record is available only after a successful stop.");
      }
      return freezeData({ ...header, commands: commands.slice() });
    });
  }
  emit({ type: "start", record: header });
  return { prepare, complete, handle: Object.freeze({ stop, getRecord, getStatus }) };
}
