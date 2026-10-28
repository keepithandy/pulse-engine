import { createEngine } from "@keepithandy/pulse-engine";
const engine = createEngine({ initialState: { calls: 0 }, systems: [{
  id: "counter", onAction({ action, state }) {
    if (action.type === "count/add") return { state: { calls: state.calls + 1 } };
  }
}] });
engine.schedule({ type: "count/add" }, { at: 2 });
engine.advance(2);
console.log(JSON.stringify({ tick: engine.getTick(), calls: engine.getState().calls }));
engine.dispose();
