# Recording command histories

P03-02 adds opt-in recording to an existing engine using the [v1 replay input format](replay-format.md). Executing recordings is P03-03.

## Retained recording

```js
import { createEngine, validateReplayRecord } from "@keepithandy/pulse-engine";

const engine = createEngine({ seed: "run-17", initialState: { count: 0 } });
engine.pause();
const recording = engine.startRecording({ configurationId: "counter/rules-v1" });
engine.advance(5); // Captured even though pause makes this a no-op.
engine.resume();
engine.advance(2);
recording.stop();
const replay = validateReplayRecord(recording.getRecord());
console.log(replay.initialPaused, replay.commands.length); // true, 3
engine.dispose();
```

`startRecording({ configurationId, seed?, retainCommands?, sink? })` synchronously captures the full checkpoint and actual pause flag, even with disabled or redacted diagnostics. The seed defaults to the engine's construction seed; after restoring a different PRNG seed, supply the matching seed explicitly. A mismatch fails before recording starts.

The host owns the configuration identity and must keep hook code, closure data, rules, validation and other deterministic dependencies stable. Only one session may be active. Saved references such as `const dispatch = engine.dispatch` remain captured.

| Handle method | Behavior |
| --- | --- |
| `getStatus()` | Frozen `{ state, commandCount, retainedCommandCount, reason }`; state is `recording`, `stopped` or `failed`. Count includes an attempted command whose subsequent sink write failed. |
| `stop()` | Finalizes the sink, releases the engine and returns status. Idempotent after release. A failed session stays failed. A final sink error throws but still releases the engine. |
| `getRecord()` | Deeply frozen record, only after a successful stop with retention enabled. Each call returns a separate command array. Active, failed and streaming-only sessions throw `PULSE_RECORDING`. |

Recording controls and checkpoint exports are unavailable inside engine callbacks and sinks. Status reads remain available. A stopped handle works after engine disposal and never controls a later session.

## Commands and outcomes

Each external `dispatch`, `step`, `advance`, `schedule`, `cancelSchedule`, `pause` or `resume` call gets one contiguous sequence number. Inputs are detached and validated before execution. `advance()` records count 1; generated action and schedule ids follow ordinary allocation.

An advance of 100 ticks is **one command**. Internal tick dispatches, due scheduled actions, emitted events and observer callbacks do not create commands. Event-journal eviction never truncates the input log.

Every command includes an outcome:

- `accepted`: the public call succeeded. Includes paused/zero-count advances and a successful step containing failed scheduled work or observer errors.
- `rejected`: dispatch or a tick was rejected, advance stopped at a rejected tick, or cancellation found no schedule.
- `error`: a protocol-valid call threw, such as a schedule targeting a past tick or a throwing hook. The original thrown value is preserved.

Outcomes describe the enclosing call. An advance can execute some ticks before rejection or an exception. Outcome metadata never means to skip execution. String reasons/messages are captured; other values use a generic reason without invoking getters or string conversion.

## Streaming without retained history

```js
const recording = engine.startRecording({
  configurationId: "counter/rules-v1",
  retainCommands: false,
  sink(entry) {
    // Host-defined reliable synchronous acceptance, e.g. appendFileSync.
    writeLineSynchronously(JSON.stringify(entry));
  }
});
// Run commands, then:
recording.stop();
```

The sink receives deeply frozen entries:

1. `{ type: "start", record }`: v1 replay header, full checkpoint, empty commands.
2. `{ type: "command", command }`: each attempted engine command after its outcome is known.
3. `{ type: "end", commandCount }`: completion on successful stop.

Reconstruct a replay by replacing the start record's commands with the command entries and calling `validateReplayRecord`. The host must additionally verify one start, one end and the matching count; the replay validator does not validate transport framing. Treat the stream as complete only when stop succeeds and the sink reliably accepts the end entry.

With retention disabled, the recorder retains the starting checkpoint and counters but no command history. The sink and ordinary engine state, event history and advance results have separate memory costs. Retention defaults to true and can be combined with a sink. Disabling retention without a sink is invalid.

Sinks must return synchronously without a Promise or thenable. Late Promise failures are observed, but asynchronous delivery is unsupported. A host may accept into its own queue synchronously; later queue/storage failure is outside this success guarantee.

## Failure and mutation boundaries

| Situation | Behavior |
| --- | --- |
| Start sink fails | Start throws; no session remains and no command was executed. |
| Input cannot be represented by replay v1 | Block the call before execution and fail recording. Unsafe data, invalid counts and unsupported schedule fields are never silently omitted or coerced. |
| Command sink fails | The command may already have committed. Fail recording and block further commands until stop; do not roll back committed engine work. |
| Engine and sink both throw | Preserve the original engine exception and expose failed recording status. |
| End sink fails | Stop throws, status is failed, and the engine is released. |
| Configuration changes, restore/import or disposal during an active session | Reject before mutation or migration/setup/disposal callbacks. Stop first, make the change and start a new session. |

Recording errors use `PULSE_RECORDING`, category `recording`. Capture failure errors include `commandExecuted`: false for a blocked input; true for failure recording an attempted command. Do not blindly retry after a sink error: inspect engine state and recording status first.

Incomplete sessions cannot export a record and do not emit an end entry on a later stop. A sink that writes before throwing can leave an ambiguously acknowledged stream; the host must mark it incomplete or discard it.

Configuration restrictions cover `registerPlugin`, `unregisterPlugin`, `restore`, `importSave` and `dispose`, including while failed but not stopped. Reads, save exports and forked checkpoints remain allowed between calls. Sinks cannot mutate the engine or start/stop recording while delivering an entry.

Calls without active recording keep normal validation and return behavior. Save, snapshot and replay schemas are unchanged.
