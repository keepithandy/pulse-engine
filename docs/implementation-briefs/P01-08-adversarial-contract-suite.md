# P01-08 — Build an adversarial contract suite

## Scope

Audit the confirmed Phase 01 findings against their public entry points and ensure
each failure has a focused regression that checks the relevant unchanged-state
invariant. Keep the fixtures close to their owning modules and provide one matrix
that makes the coverage reviewable.

## Acceptance

- F01 through F04 each link to the baseline symptom, public APIs, focused regression,
  and snapshot/random/counter/history invariant.
- P01-04 safe-counter and random-boundary regressions are included in the audit.
- Full Node, browser, coverage, package, smoke, lint, and repository-integrity checks
  pass.