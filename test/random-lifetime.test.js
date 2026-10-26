import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createEngine, createRuleEvaluator, createSeededRandom } from "../src/index.js";

const samples = [
  ["next", []], ["float", [-2, 2]], ["integer", [1, 100]], ["pick", [["a", "b"]]]
];
const sampler = {
  id: "sampler",
  onAction({ action, state, random }) {
    if (action.type !== "draw") return;
    return { state: { draws: [...state.draws, ...samples.map(([method, args]) => random[method](...args))] } };
  }
};

function makeEngine(kind, hook) {
  const plugin = { id: "tested-hook" };
  const rule = { id: "tested-rule", condition: ({ action }) => action.type === "bad", effect: () => ({}) };
  if (kind === "onAction") plugin.onAction = context => context.action.type === "bad" ? hook(context) : undefined;
  if (kind === "beforeTick") plugin.beforeTick = hook;
  if (kind === "condition") rule.condition = context => context.action.type === "bad" ? hook(context) : false;
  if (kind === "effect") rule.effect = hook;
  return createEngine({
    initialState: { draws: [] }, seed: "random-lifetime", plugins: [sampler, plugin],
    rules: kind === "condition" || kind === "effect" ? [rule] : []
  });
}

function attempt(engine, kind) {
  return kind === "beforeTick" ? engine.step() : engine.dispatch({ type: "bad" });
}

function assertExpired(random) {
  for (const [method, args] of samples) {
    // Destructured methods must expire along with the containing interface.
    const draw = random[method];
    assert.throws(() => draw(...args), /Random helpers are only available during synchronous engine processing/);
  }
}

for (const kind of ["onAction", "beforeTick", "condition", "effect"]) {
  test(`${kind}: rejected async work cannot change the restored random sequence`, async () => {
    let continuation;
    const errors = [];
    const engine = makeEngine(kind, ({ random }) => {
      continuation = (async () => {
        random.next();
        await Promise.resolve();
        for (const [method, args] of samples) {
          try { random[method](...args); }
          catch (error) { errors.push(error); }
        }
        return true;
      })();
      return continuation;
    });
    engine.schedule({ type: "draw" }, { at: 1 });
    const before = engine.snapshot();
    assert.throws(() => attempt(engine, kind), /synchronous|boolean/);
    assert.deepEqual(engine.snapshot(), before);
    await continuation;
    assert.deepEqual(engine.snapshot(), before);
    assert.equal(errors.length, samples.length);
    for (const error of errors) assert.match(error.message, /Random helpers are only available during synchronous engine processing/);

    const control = makeEngine();
    control.restore(before);
    engine.dispatch({ type: "draw" });
    control.dispatch({ type: "draw" });
    assert.deepEqual(engine.snapshot(), control.snapshot());
  });

  test(`${kind}: retained helpers stay expired during observers, later actions, restore, and disposal`, () => {
    let saved;
    const engine = makeEngine(kind, ({ random }) => {
      saved ??= random;
      random.next();
      return true;
    });
    attempt(engine, kind);
    assert.ok(Object.isFrozen(saved));
    const before = engine.snapshot();
    assertExpired(saved);
    assert.deepEqual(engine.snapshot(), before);
    let observerCalls = 0;
    engine.subscribe(() => { observerCalls += 1; assertExpired(saved); });
    engine.registerPlugin({
      id: "later-hook",
      onAction() { assertExpired(saved); },
      onEvent() { assertExpired(saved); }
    });
    const result = engine.step();
    assert.equal(result.advanced, true);
    assert.deepEqual(result.result.listenerErrors, []);
    assert.deepEqual(result.result.pluginErrors, []);
    assert.ok(observerCalls > 0);
    engine.restore(before);
    assertExpired(saved);
    assert.deepEqual(engine.snapshot(), before);
    engine.dispose();
    assertExpired(saved);
    assert.deepEqual(engine.snapshot(), before);
  });
}

test("rejected async random draws do not escape as unhandled Promise rejections", () => {
  const entry = new URL("../src/index.js", import.meta.url).href;
  const source = `
    import assert from 'node:assert/strict';
    import { createEngine } from ${JSON.stringify(entry)};
    const lateDraw = async ({ random }) => { await Promise.resolve(); random.next(); return true; };
    for (const kind of ['onAction', 'beforeTick', 'condition', 'effect']) {
      const plugin = { id: 'async' };
      const rule = { id: 'async', condition: () => true, effect: () => ({}) };
      if (kind === 'onAction' || kind === 'beforeTick') plugin[kind] = lateDraw;
      else rule[kind] = lateDraw;
      const engine = createEngine({ plugins: [plugin], rules: [rule] });
      const before = engine.snapshot();
      assert.throws(() => kind === 'beforeTick' ? engine.step() : engine.dispatch({ type: 'test' }));
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(engine.snapshot(), before);
    }
    console.log('Late random draws rejected without unhandled rejections.');
  `;
  const result = spawnSync(process.execPath, ["--unhandled-rejections=strict", "--input-type=module"], {
    input: source, encoding: "utf8", timeout: 10000
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Late random draws rejected/);
});

test("throwing processing hooks revoke random helpers before rollback", () => {
  for (const kind of ["onAction", "beforeTick", "condition", "effect"]) {
    let saved;
    const engine = makeEngine(kind, ({ random }) => {
      saved = random;
      random.next();
      throw new Error("Processing failed.");
    });
    const before = engine.snapshot();
    assert.throws(() => attempt(engine, kind), /Processing failed/);
    assertExpired(saved);
    assert.deepEqual(engine.snapshot(), before);
    const control = makeEngine();
    engine.dispatch({ type: "draw" });
    control.dispatch({ type: "draw" });
    assert.deepEqual(engine.snapshot(), control.snapshot());
  }
});

test("standalone generators and rule evaluators keep caller-owned random access", () => {
  const random = createSeededRandom("standalone");
  let saved;
  const evaluator = createRuleEvaluator([{
    id: "capture",
    condition: () => true,
    effect(context) { saved = context.random; return {}; }
  }]);
  assert.equal(evaluator.evaluate({ action: { type: "test" }, state: {}, tick: 0, random }).accepted, true);
  assert.equal(saved, random);
  const checkpoint = random.getState();
  const expected = samples.map(([method, args]) => saved[method](...args));
  random.setState(checkpoint);
  assert.deepEqual(samples.map(([method, args]) => random[method](...args)), expected);
});
