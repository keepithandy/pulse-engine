# P02-02 — TypeScript declaration baseline

Status: implemented and merged on October 26, 2026 in [PR #34](https://github.com/keepithandy/pulse-engine/pull/34). Runtime baseline: `5e260a0`.

## Scope

- Declare all 25 runtime value exports at `src/index.d.ts`, plus consumer types for
  state, action/event unions, plug-ins, systems, rules, results, snapshots, worlds,
  scenarios, and advanced helpers.
- Route the existing package root to declarations using a `types` condition and
  top-level metadata while retaining the JavaScript/default destination.
- Add strict compile-only consumers with positive and expected-error fixtures.
- Pin TypeScript 7.0.2 for reproducible checks and run them in every Node CI job.
- Check both NodeNext and Bundler consumers from the checkout and a real temporary
  tarball installation. Compare all declared value names with runtime exports.

## Review boundary

There are no JavaScript engine behavior changes. JSON safety, bounds, identifiers,
dependency relationships, and saved-state invariants still require runtime validation.
Lifecycle/listener `void` callbacks retain TypeScript's usual async assignability;
the synchronous runtime contract still applies. See [the consumer guide](../typescript.md).

Type declaration wiring is the minimum package change needed here. Broader metadata and export-path policy were delivered in P02-04 (PR #35).
Isolated runtime/CLI consumer coverage was added in P02-05 (PR #38). The remaining review findings
about migration atomicity, restored event envelopes, and entity lookup identity are
separate work and are not fixed by adding declarations.

## Acceptance and checks

Positive fixtures use every value export and typed dispatch, tick narrowing, events,
state inference, inspection redaction, world commands, schedules, saves, and advanced
helpers. Expected errors cover malformed action/event payloads, incomplete state
replacements, async processing hooks/rules, missing schedule options, readonly data,
and attempting to trust nested data after envelope-only validation.

Run `npm run test:types`, `npm run test:coverage`, `npm run lint`,
`npm run check:package`, `npm run smoke`, and repository integrity checks.
Browser compatibility remains covered by the existing fixture and CI matrix.

Local evidence on Node 24.21.0:

- All 25 runtime value exports match the declaration surface.
- Both resolution modes pass from checkout and installed tarball, including 17
  expected-error cases per compilation.
- All 85 runtime tests pass; coverage is 97.20% lines, 93.06% branches, and 99.32%
  functions, above the existing gates.
- Source checks, all three integrity checks, package dry run, and the 100-tick
  resource-network smoke pass. The package includes `src/index.d.ts`.
- Native-module browser smoke passes using installed Chromium-based Edge. WebKit
  and the Node 22/24 OS matrix remain CI validation for this PR.
- `git diff --check` passes.
