import { createEngine } from "@keepithandy/pulse-engine";
const options = { initialState: { count: 0 }, systems: [{
  id: "counter", onAction({ action, state }) {
    if (action.type === "count/add") return { state: { count: state.count + 1 } };
  }
}] };
const source = createEngine(options);
source.dispatch({ type: "count/add" });
const saved = source.exportSave();
const restored = createEngine(options);
restored.importSave(saved);
console.log(JSON.stringify({ count: restored.getState().count, revision: restored.snapshot().revision }));
source.dispose();
restored.dispose();
