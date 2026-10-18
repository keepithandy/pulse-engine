// Engine data is deliberately JSON-safe; runtime hooks stay in the plug-in registry.
export function assertData(value, path = "$", ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return;
  if (!value || typeof value !== "object") throw new TypeError(`${path}: expected JSON-safe data.`);
  if (ancestors.has(value)) throw new TypeError(`${path}: cyclic data is unsupported.`);
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path}: runtime objects are unsupported.`);
  }

  ancestors.add(value);
  if (array) {
    const length = Object.getOwnPropertyDescriptor(value, "length").value;
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
        throw new TypeError(`${path}: unsupported array property ${String(key)}.`);
      }
    }
    if (keys.length !== length + 1) throw new TypeError(`${path}: sparse arrays are unsupported.`);
    for (let i = 0; i < length; i += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor) throw new TypeError(`${path}[${i}]: sparse arrays are unsupported.`);
      if (!Object.hasOwn(descriptor, "value")) throw new TypeError(`${path}[${i}]: accessors are unsupported.`);
      if (!descriptor.enumerable) throw new TypeError(`${path}[${i}]: non-enumerable properties are unsupported.`);
      assertData(descriptor.value, `${path}[${i}]`, ancestors);
    }
  } else {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError(`${path}: symbol properties are unsupported.`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError(`${path}.${key}: accessors are unsupported.`);
      if (!descriptor.enumerable) throw new TypeError(`${path}.${key}: non-enumerable properties are unsupported.`);
      assertData(descriptor.value, `${path}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

export function copyData(value) {
  assertData(value);
  return structuredClone(value);
}

export function freezeData(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeData(child);
  return value;
}

export function assertCounter(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer.`);
}
