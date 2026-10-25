# P02-01 — Inventory the supported API

## Scope

Baseline: `ec4c887cc59d0785dc36091a66fd7546ff3cf15f` (Phase 01 complete).

Document the current package root and the interfaces it returns. Classify its 25
named exports as 13 stable candidates and 12 advanced helpers, including the example
system registry. Make the existing pre-alpha compatibility boundary explicit before
adding declarations, structured errors, or new packaging features.

The [public API inventory](../public-api.md) records each export's input, return shape,
compatibility class, and example. It also covers engine options/methods, hook contexts
and responses, world actions, and standalone subsystem methods. The README and engine
contracts link to the inventory.

## Acceptance criteria

- Every name actually exported by `src/index.js` appears in the inventory with its
  input, result, compatibility class, and use in an independent JavaScript example.
- The returned engine interface and advanced subsystem interfaces are documented.
- Record builders, envelope validators, save utilities, and engine load validation
  have distinct, accurate descriptions of their existing checks.
- The stable-candidate classification preserves the existing pre-alpha status.
- Examples execute successfully using package-root imports in the local checkout.
- Required repository checks pass; the roadmap records P02-01 completion with the
  merge and identifies P02-02 as the next work item.

## Verification boundary

Local package self-reference checks the current root export surface. It does not
prove isolated tarball installation; P02-05 remains open. This documentation patch
does not add runtime behavior, TypeScript declarations, dependencies, or exports.

## Evidence

Local validation on Node `24.21.0`:

- A temporary verification script compared the inventory table and example imports
  against the actual root module namespace: all 25 exports matched, with 13 C and
  12 A classifications. It also compared all 25 engine method names and the
  documented scheduler, journal, random, and registry method tables with their
  actual returned interfaces, checked local links, and executed all 13 independent
  JavaScript examples in separate Node processes. It was removed after validation;
  the examples retain their assertion checks in the document.
- `npm run lint` passed.
- `npm run test:coverage` passed all 70 tests; coverage was 97.15% lines,
  92.86% branches, and 98.59% functions.
- `npm run check:package` passed the existing package dry run and included the
  new documentation.
- `npm run smoke` reached tick 100, energy 200, and water 110.
- `node .github/smoke/run-integrity.mjs` passed all three repository checks.
- `git diff --check` passed.

[PR #31](https://github.com/keepithandy/pulse-engine/pull/31) passed all nine checks
at implementation head `d194542a6d5c6473bdae4f618aa6fb5bd8c5c0a9`:
[Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40148469920)
covered Node 22/24 on Linux, Windows, and macOS plus Chromium and WebKit;
[repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40148469904)
passed. P02-01 completion is recorded with its approved merge on October 24, 2026.
P02-02 is next; the remaining P02 items have not been started by this patch.
