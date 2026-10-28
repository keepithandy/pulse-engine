import { createEngine } from "@keepithandy/pulse-engine";
const engine = createEngine({ initialState: { coins: 5 }, rules: [{
  id: "buy", condition: ({ action }) => action.type === "shop/buy",
  effect: ({ state }) => state.coins >= 3
    ? { state: { coins: state.coins - 3 } }
    : { accepted: false, reason: "Insufficient coins." }
}] });
const first = engine.dispatch({ type: "shop/buy" });
const second = engine.dispatch({ type: "shop/buy" });
console.log(JSON.stringify({ first: first.accepted, second: second.accepted, coins: engine.getState().coins }));
engine.dispose();
