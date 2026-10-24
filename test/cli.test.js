import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const run = args => spawnSync(process.execPath, ["bin/pulse-run.js", ...args], { encoding: "utf8" });
const scenario = ["--scenario", "scenarios/minimal.json"];
function fails(args, diagnostic) {
  const result = run(args);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, diagnostic);
  assert.doesNotMatch(result.stderr, /at main/);
}

test("CLI identifies missing values before reading files or running", () => {
  for (const flag of ["--scenario", "--seed", "--ticks", "--events"]) {
    const prefix = flag === "--scenario" ? [] : scenario;
    for (const suffix of [[], [""], ["   "], ["--ticks", "0"]]) {
      fails([...prefix, flag, ...suffix], new RegExp(`Missing value for ${flag}`));
    }
  }
  fails([...scenario, "--ticks", "-1"], /--ticks must be an integer/);
  fails([...scenario, "--seed", "one", "--seed", "two"], /Invalid or repeated option: --seed/);
  fails([...scenario, "--unknown", "value"], /Invalid or repeated option: --unknown/);
});

test("CLI reports file operation and path, and supports short help", () => {
  const dir = mkdtempSync(join(tmpdir(), "pulse-cli-"));
  try {
    const invalid = join(dir, "invalid.json");
    writeFileSync(invalid, "{");
    fails(["--scenario", invalid], /Invalid JSON in scenario/);
    assert.ok(run(["--scenario", invalid]).stderr.includes(invalid));
    fails(["--scenario", join(dir, "missing.json")], /Cannot read scenario/);
    const output = join(dir, "missing", "events.json");
    fails([...scenario, "--ticks", "0", "--events", output], /Cannot write events/);
    assert.ok(run([...scenario, "--ticks", "0", "--events", output]).stderr.includes(output));
    const help = run(["-h"]);
    assert.equal(help.status, 0);
    assert.equal(help.stderr, "");
    assert.equal(help.stdout, run(["--help"]).stdout);
    const zero = run([...scenario, "--ticks", "0"]);
    assert.equal(zero.status, 0);
    assert.equal(JSON.parse(zero.stdout).tick, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
