import { assertCounter, copyData } from "./data.js";

const ACTIONS = new Set([
  "world/entity.create",
  "world/entity.destroy",
  "world/component.set",
  "world/component.remove"
]);
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function assertKey(value, label) {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a non-empty, non-reserved string.`);
  }
  const key = value.trim();
  if (!key || RESERVED_KEYS.has(key)) {
    throw new TypeError(`${label} must be a non-empty, non-reserved string.`);
  }
  return key;
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  copyData(value);
  return value;
}

function worldFrom(state) {
  const world = state.world ?? { nextEntity: 1, order: [], entities: {} };
  if (!world || typeof world !== "object" || Array.isArray(world) ||
      !Number.isSafeInteger(world.nextEntity) || world.nextEntity < 1 ||
      !Array.isArray(world.order) || !world.entities || typeof world.entities !== "object" ||
      Array.isArray(world.entities)) {
    throw new TypeError("Invalid Pulse Engine world state.");
  }
  return world;
}

function readEntityRecord(world, id) {
  if (!Object.hasOwn(world.entities, id)) return null;
  const record = world.entities[id];
  return record ? copyData(record) : null;
}

/**
 * Generic deterministic entity/component storage for simulation systems.
 * State is kept under state.world and is therefore included in engine snapshots.
 */
export function createWorldPlugin({ id = "pulse-world", idPrefix = "entity" } = {}) {
  id = assertKey(id, "World plug-in id");
  idPrefix = assertKey(idPrefix, "Entity id prefix");
  return Object.freeze({
    id,
    version: "1.0.0",
    onAction({ action, state }) {
      if (!ACTIONS.has(action.type)) return;
      const nextState = copyData(state);
      const current = worldFrom(nextState);
      const world = copyData(current);
      nextState.world = world;
      const events = [];

      if (action.type === "world/entity.create") {
        const type = assertKey(action.entityType, "Entity type");
        let entityId;
        if (action.entityId !== undefined) {
          entityId = assertKey(action.entityId, "Entity id");
          if (Object.hasOwn(world.entities, entityId)) {
            return { accepted: false, reason: `Entity ${entityId} already exists.` };
          }
        } else {
          do {
            const nextEntity = world.nextEntity + 1;
            assertCounter(nextEntity, "Entity allocation counter");
            entityId = `${idPrefix}-${String(world.nextEntity).padStart(6, "0")}`;
            world.nextEntity = nextEntity;
          } while (Object.hasOwn(world.entities, entityId));
        }
        const components = action.components ?? {};
        assertRecord(components, "Components");
        const normalizedComponents = {};
        for (const [key, value] of Object.entries(components)) {
          const name = assertKey(key, "Component name");
          if (Object.hasOwn(normalizedComponents, name)) {
            throw new TypeError(`Duplicate component name after normalization: ${name}.`);
          }
          normalizedComponents[name] = copyData(value);
        }
        world.entities[entityId] = { type, components: normalizedComponents };
        world.order.push(entityId);
        events.push({ type: "world/entity.created", payload: { entityId, entityType: type } });
        return { state: nextState, events };
      }

      const entityId = assertKey(action.entityId, "Entity id");
      const entity = Object.hasOwn(world.entities, entityId) ? world.entities[entityId] : null;
      if (!entity) return { accepted: false, reason: `Unknown entity ${entityId}.` };

      if (action.type === "world/entity.destroy") {
        delete world.entities[entityId];
        world.order = world.order.filter(id => id !== entityId);
        events.push({ type: "world/entity.destroyed", payload: { entityId, entityType: entity.type } });
      } else {
        const component = assertKey(action.component, "Component name");
        if (action.type === "world/component.set") {
          if (!Object.hasOwn(action, "value")) throw new TypeError("Component set actions require a value.");
          entity.components[component] = copyData(action.value);
          events.push({ type: "world/component.set", payload: { entityId, component } });
        } else {
          if (!Object.hasOwn(entity.components, component)) {
            return { accepted: false, reason: `Entity ${entityId} has no ${component} component.` };
          }
          delete entity.components[component];
          events.push({ type: "world/component.removed", payload: { entityId, component } });
        }
      }
      return { state: nextState, events };
    }
  });
}

/** Return one detached entity record, or null when the id is absent. */
export function getEntity(state, entityId) {
  assertRecord(state, "World state");
  const world = worldFrom(state);
  const id = assertKey(entityId, "Entity id");
  const entity = readEntityRecord(world, id);
  return entity ? { id, ...entity } : null;
}

/**
 * Query entities in deterministic creation order.
 * Options: { type, with: ["position"], without: ["dead"] }.
 */
export function queryEntities(state, { type, with: required = [], without = [] } = {}) {
  assertRecord(state, "World state");
  const world = worldFrom(state);
  if (type !== undefined) type = assertKey(type, "Entity type");
  if (!Array.isArray(required) || !Array.isArray(without)) {
    throw new TypeError("World query component filters must be arrays.");
  }
  required = required.map(name => assertKey(name, "Component name"));
  without = without.map(name => assertKey(name, "Component name"));
  return world.order.flatMap(id => {
    if (!Object.hasOwn(world.entities, id)) return [];
    const entity = world.entities[id];
    if (!entity || (type !== undefined && entity.type !== type)) return [];
    const components = entity.components ?? {};
    if (!required.every(name => Object.hasOwn(components, name)) ||
        without.some(name => Object.hasOwn(components, name))) return [];
    return [{ id, type: entity.type, components: copyData(components) }];
  });
}

/** Validate a detached world before restoring it. Throws on inconsistent records. */
export function validateWorldState(input) {
  const state = copyData(input);
  assertRecord(state, "World state");
  if (!Object.hasOwn(state, "world")) return true;
  if (state.world === null) throw new TypeError("World must be an object.");
  const world = worldFrom(state);
  const seen = new Set();
  for (const id of world.order) {
    if (assertKey(id, "Entity id") !== id || seen.has(id) || !Object.hasOwn(world.entities, id)) {
      throw new TypeError("World order requires unique canonical ids with matching entities.");
    }
    seen.add(id);
  }
  for (const [id, entity] of Object.entries(world.entities)) {
    if (!seen.has(id)) throw new TypeError(`Entity ${id} is missing from world order.`);
    assertRecord(entity, "Entity record");
    if (assertKey(entity.type, "Entity type") !== entity.type) throw new TypeError("Entity type must be canonical.");
    assertRecord(entity.components, "Components");
    for (const key of Object.keys(entity.components)) {
      if (assertKey(key, "Component name") !== key) throw new TypeError("Component name must be canonical.");
    }
  }
  return true;
}
