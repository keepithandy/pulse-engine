import { createEngine, createWorldPlugin, getEntity, queryEntities } from "@keepithandy/pulse-engine";
const engine = createEngine({ systems: [createWorldPlugin()] });
engine.dispatch({ type: "world/entity.create", entityType: "hero", entityId: "hero-1", components: { health: 10 } });
const state = engine.getState();
console.log(JSON.stringify({ count: queryEntities(state, { with: ["health"] }).length, health: getEntity(state, "hero-1").components.health }));
engine.dispose();
