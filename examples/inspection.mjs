import { createEngine } from "@keepithandy/pulse-engine";
const engine = createEngine({ initialState: { ready: true } });
engine.dispatch({ type: "inspect/noop" });
const inspection = engine.inspect();
console.log(JSON.stringify({ revision: inspection.revision, traces: inspection.traces.length, ready: inspection.state.ready }));
engine.dispose();
