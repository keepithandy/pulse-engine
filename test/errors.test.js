import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, deserializeSave, summarizePulseError, validateSnapshotRecord } from "../src/index.js";

test("invalid actions expose validation code without changing TypeError behavior", () => {
  const engine = createEngine();
  try {
    assert.throws(() => engine.dispatch({}), error => {
      assert.ok(error instanceof TypeError);
      assert.equal(error.code, "PULSE_VALIDATION");
      assert.equal(error.category, "validation");
      assert.match(error.message, /non-empty type/);
      assert.equal(JSON.stringify(summarizePulseError(error)), JSON.stringify({
        code: "PULSE_VALIDATION", category: "validation", message: error.message, cause: null
      }));
      return true;
    });
  } finally { engine.dispose(); }
});

test("engine rejections and disposed mutations use machine-readable categories", () => {
  const engine = createEngine({ systems: [{
    id: "reject", onAction: () => ({ accepted: false, reason: "not allowed" })
  }] });
  const response = engine.dispatch({ type: "example" });
  assert.equal(response.accepted, false);
  assert.equal(response.code, "PULSE_REJECTED");
  assert.equal(response.category, "rejection");
  assert.equal(response.reason, "not allowed");
  engine.dispose();
  assert.throws(() => engine.dispatch({ type: "example" }), error => {
    assert.equal(error.code, "PULSE_LIFECYCLE");
    assert.equal(error.category, "lifecycle");
    return true;
  });
});

test("version mismatches have compatibility codes and preserve RangeError", () => {
  const engine = createEngine();
  const snapshot = structuredClone(engine.snapshot());
  engine.dispose();
  snapshot.engineVersion = "999.0.0";
  assert.throws(() => validateSnapshotRecord(snapshot), error => {
    assert.ok(error instanceof RangeError);
    assert.equal(error.code, "PULSE_COMPATIBILITY");
    assert.equal(error.category, "compatibility");
    return true;
  });
});

test("invalid save JSON retains a SyntaxError cause in JSON-safe summaries", () => {
  assert.throws(() => deserializeSave("{"), error => {
    assert.ok(error instanceof SyntaxError);
    assert.equal(error.code, "PULSE_VALIDATION");
    assert.ok(error.cause instanceof SyntaxError);
    const summary = summarizePulseError(error);
    assert.equal(summary.cause.name, "SyntaxError");
    assert.equal(summary.cause.code, null);
    assert.equal(JSON.parse(JSON.stringify(summary)).category, "validation");
    return true;
  });
  assert.deepEqual(summarizePulseError(null), {
    code: "PULSE_UNKNOWN", category: "unknown", message: "Unknown thrown value.", cause: null
  });
});
