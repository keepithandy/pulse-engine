import { pulseError } from "./errors.js";
import { createEventJournal } from "./events.js";
import { createSeededRandom } from "./random.js";
import { createTickScheduler } from "./scheduler.js";
import { validateSnapshotRecord } from "./snapshots.js";

const DOMAIN = "pulse-engine/checkpoint/sha256-v1\n";
const DIGEST_VERSION = "sha256-v1";
const CHECKPOINT_FIELDS = new Set([
  "format", "version", "engineVersion", "label", "branch", "revision",
  "actionSequence", "tick", "state", "randomState", "schedules", "events"
]);

function reject(message, cause) {
  return pulseError(TypeError, "PULSE_VALIDATION", "validation", message, cause);
}

// Deliberately do not use JSON.stringify(object) for maps: JavaScript reorders
// integer-like object keys irrespective of insertion order. Canonical order
// here is UTF-16 code-unit ordering, not locale collation or UTF-8 ordering.
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function validateCheckpoint(input) {
  // This shared boundary checks JSON safety, copies data without calling getters
  // and applies the current engine's snapshot compatibility rules.
  const snapshot = validateSnapshotRecord(input);
  for (const key of Object.keys(snapshot)) {
    if (!CHECKPOINT_FIELDS.has(key)) {
      throw reject(`Unknown checkpoint field "${key}" cannot be silently excluded from a v1 digest.`);
    }
  }

  // A well-formed snapshot envelope can still contain invalid subsystem data.
  // Validate those components without modifying a running simulation.
  try {
    createSeededRandom().setState(snapshot.randomState);
    const historyCount = Array.isArray(snapshot.events?.history) ? snapshot.events.history.length : 0;
    createEventJournal({ historyLimit: Math.max(1, historyCount) }).restoreState(snapshot.events);
    const jobsCount = Array.isArray(snapshot.schedules?.jobs) ? snapshot.schedules.jobs.length : 0;
    createTickScheduler({ capacity: Math.max(1, jobsCount) }).restoreState(snapshot.schedules, snapshot.tick);
  } catch (cause) {
    throw reject("Checkpoint contains invalid random, event, or scheduler state.", cause);
  }
  return snapshot;
}

/**
 * A versioned checksum of a validated checkpoint, independent of key insertion
 * order, label and platform. No engine mutation or asynchronous hooks.
 * This is a checksum, NOT an authenticity signature.
 */
export async function digestCheckpoint(input) {
  const snapshot = validateCheckpoint(input);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== "function" || typeof TextEncoder !== "function") {
    throw pulseError(Error, "PULSE_DIGEST", "digest", "SHA-256 Web Crypto and TextEncoder are required for checkpoint digests.");
  }
  const { label: _ignoredLabel, ...identity } = snapshot;
  const bytes = new TextEncoder().encode(DOMAIN + canonical(identity));
  const hash = await subtle.digest("SHA-256", bytes);
  return `${DIGEST_VERSION}:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
