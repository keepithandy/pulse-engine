# P01-04 — Guard every deterministic counter

## Scope

Audit event publication, entity allocation, scheduler ordering and recurrence,
engine action/revision/tick counters, and numeric random range boundaries. Keep
all deterministic counters within the safe-integer range and reject boundary
operations before changing a checkpoint or publishing a partial event batch.

## Confirmed behavior to cover

- Restoring an event sequence at `Number.MAX_SAFE_INTEGER` currently lets the
  next publication increment to an unsafe value.
- Automatic entity allocation increments `world.nextEntity` without checking
  whether the next value is safe.
- A repeating schedule can overflow its next tick after the engine has already
  committed the tick that made the job due.
- Inclusive integer sampling uses `max + 1`; unsafe endpoints and finite float
  endpoints whose difference overflows are not rejected before drawing.
- Action sequence, revision, tick, and scheduler sequence already have guards;
  add checkpoint tests to keep those protections explicit.

## Acceptance

- Event sequence capacity is checked for a complete batch before state changes or
  listener publication.
- Entity, scheduler, action, revision, and tick exhaustion reject with unchanged
  snapshots.
- A due repeat that cannot be rescheduled rejects the tick before it advances.
- Invalid random boundaries reject without consuming PRNG state, and valid
  ranges continue producing values inside their documented bounds.
- Focused tests, full tests, lint, coverage, package, smoke, browser, and
  repository-integrity checks pass.

## Out of scope

Do not change normal counter ordering, event ID formats, save versions, or the
PRNG algorithm. Preserve valid-range random results where possible.
