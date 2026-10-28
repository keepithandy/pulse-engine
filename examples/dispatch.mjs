import { createEngine } from "@keepithandy/pulse-engine";
const engine = createEngine({ initialState: { count: 0 }, systems: [{
  id: "counter", onAction({ action, state }) {
    if (action.type === "count/add") return { state: { count: state.count + 1 } };
  }
}] });
const result = engine.dispatch({ type: "count/add" });
console.log(JSON.stringify({ accepted: result.accepted, count: engine.getState().count }));
engine.dispose();
