import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.env.npm_execpath;
const exec = (args, cwd = root) => spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 60000 });

test("packed package runs from an isolated JavaScript/CLI consumer without dev dependencies", { timeout: 120000 }, () => {
  assert.ok(npm, "Run this integration test via npm test.");
  const destination = resolve(tmpdir());
  const consumer = mkdtempSync(join(destination, "pulse-installed-"));
  try {
    const pack = exec([npm, "pack", "--json", "--pack-destination", consumer]);
    assert.equal(pack.status, 0, pack.stderr);
    const [archive] = JSON.parse(pack.stdout);
    assert.ok(archive.filename.endsWith(".tgz"));
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "pulse-isolated-consumer", private: true, type: "module" }));
    const install = exec([npm, "install", join(consumer, archive.filename), "--offline", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund"], consumer);
    assert.equal(install.status, 0, install.stderr);
    const installedManifest = JSON.parse(readFileSync(join(consumer, "node_modules/@keepithandy/pulse-engine/package.json"), "utf8"));
    assert.equal(installedManifest.name, "@keepithandy/pulse-engine");
    assert.deepEqual(Object.keys(installedManifest.dependencies ?? {}), []);

    const script = `import { createEngine, SAVE_VERSION } from "@keepithandy/pulse-engine";
const engine = createEngine({ initialState: { count: 1 }, systems: [{
  id: "count", onAction({ action, state }) {
    if (action.type === "add") return { state: { count: state.count + 1 } };
  }
}] });
const recording = engine.startRecording({ configurationId: "installed-counter/v1" });
const outcome = engine.dispatch({ type: "add" });
recording.stop();
if (recording.getRecord().commands[0].outcome.status !== "accepted") throw new Error("Installed recorder failed.");
let privateExportBlocked = false;
try { await import("@keepithandy/pulse-engine/src/engine.js"); }
catch (error) { privateExportBlocked = error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED"; }
console.log(JSON.stringify({ accepted: outcome.accepted, count: engine.getState().count, saveVersion: SAVE_VERSION, privateExportBlocked }));
engine.dispose();`;
    const imported = exec(["--input-type=module", "--eval", script], consumer);
    assert.equal(imported.status, 0, imported.stderr);
    assert.deepEqual(JSON.parse(imported.stdout), { accepted: true, count: 2, saveVersion: 1, privateExportBlocked: true });

    const installedExample = exec(["node_modules/@keepithandy/pulse-engine/examples/dispatch.mjs"], consumer);
    assert.equal(installedExample.status, 0, installedExample.stderr);
    assert.deepEqual(JSON.parse(installedExample.stdout), { accepted: true, count: 1 });

    const cli = exec(["node_modules/@keepithandy/pulse-engine/bin/pulse-run.js", "--scenario", join(root, "scenarios/minimal.json"), "--ticks", "3"], consumer);
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).tick, 3);
    assert.equal(cli.stderr, "");
  } finally {
    if (dirname(resolve(consumer)) !== destination || !basename(consumer).startsWith("pulse-installed-")) throw new Error("Unexpected installation cleanup path.");
    rmSync(consumer, { recursive: true, force: true });
  }
});
