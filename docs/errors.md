# Structured error metadata

Selected public engine boundaries attach **`code`** and **`category`** to standard `Error`, `TypeError`, `RangeError`, or `SyntaxError` instances. This preserves human-readable messages and existing `instanceof` checks while avoiding message parsing.

| Code | Category | Representative case |
| --- | --- | --- |
| `PULSE_VALIDATION` | `validation` | Invalid action, rejected consumer state, malformed save JSON/format, or invalid scenario |
| `PULSE_REJECTED` | `rejection` | Explicitly rejected dispatch result (`accepted: false`, not an exception) |
| `PULSE_COMPATIBILITY` | `compatibility` | Unsupported snapshot or future save version |
| `PULSE_LIFECYCLE` | `lifecycle` | Disposed engine, reentrant mutation, or checkpoint while busy |
| `PULSE_RECORDING` | `recording` | Incomplete recording, sink failure, or mutation forbidden during recording; see [failure boundaries](recording.md#failure-and-mutation-boundaries) |
| `PULSE_REPLAY` | `replay` | Mismatched host configuration, incompatible restored checkpoint, or replay cleanup failure; see [execution contract](replay-execution.md) |
| `PULSE_UNKNOWN` | `unknown` | Error without structured metadata or non-Error thrown value in a summary |

```js
import { createEngine, summarizePulseError } from "@keepithandy/pulse-engine";

const engine = createEngine();
try {
  engine.dispatch({}); // missing type
} catch (error) {
  const detail = summarizePulseError(error);
  if (detail.code === "PULSE_VALIDATION") console.log(detail.message);
}
engine.dispose();
```

`summarizePulseError(error)` returns a JSON-safe `{ code, category, message, cause }` value. For an ordinary `Error` cause, the summary includes only its name, message and optional code, never stack traces, full input state, or arbitrary nested cause properties. An unstructured or unknown error is summarized as `PULSE_UNKNOWN`. Callers should still redact user-sensitive messages before telemetry.

**Scope:** This is an incremental structured-error contract for the documented boundaries above, not a claim that every internal or plug-in exception is decorated. User plug-in errors and observer errors may still be ordinary JavaScript errors; dispatch rejection returns structured result fields, not a thrown error. The package remains pre-alpha.
