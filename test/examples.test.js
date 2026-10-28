import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const expected = {
  "dispatch": {
    "accepted": true,
    "count": 1
  },
  "rules": {
    "first": true,
    "second": false,
    "coins": 2
  },
  "world": {
    "count": 1,
    "health": 10
  },
  "schedules": {
    "tick": 2,
    "calls": 1
  },
  "saves": {
    "count": 1,
    "revision": 1
  },
  "inspection": {
    "revision": 1,
    "traces": 1,
    "ready": true
  }
};
for (const [name, output] of Object.entries(expected)) {
  test(`executable example: ${name}`, () => {
    const result = spawnSync(process.execPath, [`examples/${name}.mjs`], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), output);
    assert.equal(result.stderr, "");
  });
}
