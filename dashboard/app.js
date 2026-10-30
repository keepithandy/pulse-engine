import { createEngineFromScenario, digestCheckpoint, exampleSystemRegistry, validateScenario } from "../src/index.js";

const byId = id => document.getElementById(id);
const ui = Object.fromEntries([
  "preset", "scenario-json", "seed", "tick-count", "apply-button", "reset-button",
  "step-button", "run-button", "stop-button", "verify-button", "verify-result",
  "status", "tick-value", "entity-value", "event-value", "resource-value",
  "resources", "events", "resource-legend", "resource-chart", "chart-empty",
  "state-json", "export-button"
].map(id => [id, byId(id)]));
const palette = ["#56c7f4", "#aa9bff", "#f2bc71", "#71d3ad", "#ec8bab", "#d0e26f"];
const svgNS = "http://www.w3.org/2000/svg";
const maxSamples = 101;
let engine = null;
let applied = null;
let points = [];
let recentEvents = [];
let eventCount = 0;
let busy = false;
let canStop = false;
let stopRequested = false;

function setStatus(message, kind = "success") {
  ui.status.textContent = message;
  ui.status.dataset.kind = kind;
}

function setVerification(message, result = "idle") {
  ui["verify-result"].textContent = message;
  ui["verify-result"].dataset.result = result;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function setBusy(value, stoppable = false) {
  busy = value;
  canStop = stoppable;
  for (const id of ["preset", "scenario-json", "seed", "tick-count", "apply-button",
    "reset-button", "step-button", "run-button", "verify-button", "export-button"]) {
    ui[id].disabled = value;
  }
  ui["stop-button"].disabled = !stoppable;
}

function readTickCount() {
  const value = ui["tick-count"].value.trim();
  const ticks = Number(value);
  if (!value || !Number.isSafeInteger(ticks) || ticks < 1 || ticks > 1000) {
    throw new RangeError("Enter a whole number of ticks from 1 to 1,000.");
  }
  return ticks;
}

function getResources(state) {
  if (!state || !state.resources || typeof state.resources !== "object" || Array.isArray(state.resources)) return {};
  return state.resources;
}

function rememberPoint() {
  points.push({ tick: engine.getTick(), resources: { ...getResources(engine.getState()) } });
  if (points.length > maxSamples) points.shift();
}

function createSvg(tag, attrs = {}, text) {
  const element = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderChart(resources) {
  const svg = ui["resource-chart"];
  svg.replaceChildren();
  ui["resource-legend"].replaceChildren();
  const names = Object.keys(resources).sort();
  ui["chart-empty"].classList.toggle("visible", names.length === 0);
  if (!names.length) return;

  for (const [index, name] of names.entries()) {
    const item = document.createElement("span");
    item.className = "legend-item";
    const dot = document.createElement("span");
    dot.className = "legend-swatch";
    dot.style.backgroundColor = palette[index % palette.length];
    const label = document.createElement("span");
    label.textContent = name;
    item.append(dot, label);
    ui["resource-legend"].append(item);
  }

  const left = 49, right = 744, top = 18, bottom = 212;
  const values = points.flatMap(point => names.map(name => point.resources[name]).filter(Number.isFinite));
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const spread = high - low || 1;
  const xAt = index => left + (points.length < 2 ? 0 : index / (points.length - 1)) * (right - left);
  const yAt = value => bottom - (value - low) / spread * (bottom - top);
  for (let line = 0; line <= 4; line += 1) {
    const y = top + line * (bottom - top) / 4;
    svg.append(createSvg("line", { x1: left, y1: y, x2: right, y2: y, stroke: "#283c50", "stroke-width": 1 }));
    svg.append(createSvg("text", { x: left - 10, y: y + 4, "text-anchor": "end" }, Number((high - spread * line / 4).toFixed(2)).toString()));
  }
  svg.append(createSvg("text", { x: left, y: 238 }, "Tick " + points[0].tick));
  svg.append(createSvg("text", { x: right, y: 238, "text-anchor": "end" }, "Tick " + points.at(-1).tick));
  for (const [index, name] of names.entries()) {
    const color = palette[index % palette.length];
    let segment = [];
    const flushSegment = () => {
      if (segment.length > 1) svg.append(createSvg("polyline", {
        points: segment.map(item => item.join(",")).join(" "),
        fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round"
      }));
      else if (segment.length === 1) svg.append(createSvg("circle", {
        cx: segment[0][0], cy: segment[0][1], r: 3.5, fill: color
      }));
      segment = [];
    };
    for (const [sampleIndex, point] of points.entries()) {
      const value = point.resources[name];
      if (Number.isFinite(value)) segment.push([xAt(sampleIndex), yAt(value)]);
      else flushSegment();
    }
    flushSegment();
  }
}

function renderResources(resources) {
  const list = ui.resources;
  list.replaceChildren();
  const names = Object.keys(resources).sort();
  if (!names.length) {
    const empty = document.createElement("p");
    empty.className = "muted-empty";
    empty.textContent = "No resources in this scenario.";
    list.append(empty);
    return;
  }
  for (const [index, name] of names.entries()) {
    const row = document.createElement("div");
    row.className = "resource-row";
    const label = document.createElement("span");
    label.className = "resource-label";
    const dot = document.createElement("span");
    dot.className = "resource-dot";
    dot.style.backgroundColor = palette[index % palette.length];
    const text = document.createElement("span");
    text.textContent = name;
    label.append(dot, text);
    const value = document.createElement("strong");
    value.textContent = String(resources[name]);
    row.append(label, value);
    list.append(row);
  }
}

function renderEvents() {
  const list = ui.events;
  list.replaceChildren();
  if (!recentEvents.length) {
    const empty = document.createElement("li");
    empty.className = "muted-empty";
    empty.textContent = "No events emitted yet. Run a tick.";
    list.append(empty);
    return;
  }
  for (const event of [...recentEvents].reverse()) {
    const row = document.createElement("li");
    row.className = "event-row";
    const tick = document.createElement("span");
    tick.textContent = "T " + event.tick;
    const info = document.createElement("div");
    const type = document.createElement("strong");
    type.textContent = event.type;
    const source = document.createElement("small");
    source.textContent = "Source: " + (event.source ?? "unknown");
    info.append(type, source);
    row.append(tick, info);
    list.append(row);
  }
}

function render() {
  if (!engine) return;
  const state = engine.getState();
  const resources = getResources(state);
  ui["tick-value"].textContent = String(engine.getTick());
  ui["entity-value"].textContent = String(Array.isArray(state.entities) ? state.entities.length : 0);
  ui["event-value"].textContent = String(eventCount);
  ui["resource-value"].textContent = String(Object.keys(resources).length);
  ui["state-json"].textContent = JSON.stringify(state, null, 2);
  renderChart(resources);
  renderResources(resources);
  renderEvents();
}

function initializeEngine(scenario, seedOverride) {
  const validation = validateScenario(scenario);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  const replacement = createEngineFromScenario(validation.value, {
    systemRegistry: exampleSystemRegistry,
    ...(seedOverride ? { seed: seedOverride } : {})
  });
  // Keep the existing engine alive if validation or construction fails.
  engine?.dispose();
  engine = replacement;
  applied = { scenario: validation.value, seedOverride };
  recentEvents = [];
  eventCount = 0;
  points = [];
  engine.subscribeToEvents(event => {
    eventCount += 1;
    recentEvents.push(event);
    if (recentEvents.length > 30) recentEvents.shift();
  });
  rememberPoint();
  setVerification("Not checked yet");
  render();
  setStatus("Scenario ready. Run ticks to simulate real engine state.");
}

function applyEditor() {
  if (busy) return;
  try {
    const value = JSON.parse(ui["scenario-json"].value);
    initializeEngine(value, ui.seed.value);
  } catch (error) {
    setStatus("Cannot apply scenario: " + errorMessage(error), "error");
  }
}

function reset() {
  if (busy || !applied) return;
  try {
    initializeEngine(applied.scenario, applied.seedOverride);
    setStatus("Run reset to the last applied scenario.");
  } catch (error) {
    setStatus("Reset failed: " + errorMessage(error), "error");
  }
}

async function loadPreset() {
  if (busy) return;
  const id = ui.preset.value;
  if (!["resource-network", "minimal"].includes(id)) {
    setStatus("Unknown example scenario.", "error");
    return;
  }
  setBusy(true);
  setStatus("Loading example scenario…", "loading");
  try {
    const response = await fetch("/scenarios/" + id + ".json");
    if (!response.ok) throw new Error("Could not load preset (" + response.status + ").");
    const scenario = await response.json();
    ui["scenario-json"].value = JSON.stringify(scenario, null, 2);
    ui.seed.value = "";
    initializeEngine(scenario, "");
  } catch (error) {
    setStatus("Preset loading failed: " + errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}

function tickOnce(target) {
  const result = target.step();
  if (!result.advanced || result.result?.accepted === false) {
    throw new Error("Tick " + (target.getTick() + 1) + " rejected: " + (result.result?.reason ?? "Unknown reason"));
  }
  if (result.result.pluginErrors.length) throw result.result.pluginErrors[0];
  const failed = result.scheduled.find(item => !item.accepted || item.pluginErrors?.length);
  if (failed) throw new Error("Scheduled action failed at tick " + target.getTick() + ": " + (failed.reason ?? "Plugin error"));
}

async function runTicks(count) {
  if (busy || !engine) return;
  setBusy(true, true);
  stopRequested = false;
  let completed = 0;
  try {
    // Yield between batches, keeping controls responsive on long runs.
    while (completed < count && !stopRequested) {
      for (let i = 0; i < 20 && completed < count && !stopRequested; i += 1) {
        tickOnce(engine);
        completed += 1;
        rememberPoint();
      }
      render();
      if (completed < count) await new Promise(resolve => requestAnimationFrame(resolve));
    }
    setStatus(stopRequested
      ? "Run stopped after " + completed + " tick(s)."
      : "Completed " + completed + " tick(s) with the actual simulator.");
  } catch (error) {
    render();
    setStatus("Run stopped at tick " + engine.getTick() + ": " + errorMessage(error), "error");
  } finally {
    stopRequested = false;
    setBusy(false);
  }
}

async function verifyRepeatability() {
  if (busy || !applied) return;
  let count;
  try { count = readTickCount(); }
  catch (error) { setStatus(errorMessage(error), "error"); return; }
  setBusy(true);
  setVerification("Running two independent simulations…");
  let first, second;
  try {
    // Allow the checking state to paint before executing synchronous engine ticks.
    await new Promise(resolve => requestAnimationFrame(resolve));
    const options = {
      systemRegistry: exampleSystemRegistry,
      ...(applied.seedOverride ? { seed: applied.seedOverride } : {})
    };
    first = createEngineFromScenario(applied.scenario, options);
    second = createEngineFromScenario(applied.scenario, options);
    for (let i = 0; i < count; i += 1) {
      tickOnce(first);
      tickOnce(second);
    }
    const [left, right] = await Promise.all([
      digestCheckpoint(first.snapshot()),
      digestCheckpoint(second.snapshot())
    ]);
    if (left !== right) {
      setVerification("FAIL — checkpoint digests differ after " + count + " ticks.", "fail");
      setStatus("Determinism check failed. Inspect your system implementation.", "error");
    } else {
      setVerification("PASS — identical SHA-256 checkpoints after " + count + " ticks.", "pass");
      setStatus("Determinism verified for the selected scenario, seed and tick count.");
    }
  } catch (error) {
    setVerification("ERROR — " + errorMessage(error), "fail");
    setStatus("Verification failed: " + errorMessage(error), "error");
  } finally {
    first?.dispose();
    second?.dispose();
    setBusy(false);
  }
}

function downloadCheckpoint() {
  if (!engine || busy) return;
  const json = JSON.stringify(engine.snapshot(), null, 2) + "\n";
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "pulse-checkpoint-tick-" + engine.getTick() + ".json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus("Checkpoint exported at tick " + engine.getTick() + ".");
}

ui.preset.addEventListener("change", loadPreset);
ui["apply-button"].addEventListener("click", applyEditor);
ui["reset-button"].addEventListener("click", reset);
ui["step-button"].addEventListener("click", () => runTicks(1));
ui["run-button"].addEventListener("click", () => {
  try { runTicks(readTickCount()); }
  catch (error) { setStatus(errorMessage(error), "error"); }
});
ui["stop-button"].addEventListener("click", () => { if (canStop) stopRequested = true; });
ui["verify-button"].addEventListener("click", verifyRepeatability);
ui["export-button"].addEventListener("click", downloadCheckpoint);
loadPreset();
