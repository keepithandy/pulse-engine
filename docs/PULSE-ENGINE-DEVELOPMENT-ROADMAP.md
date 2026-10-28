# Pulse Engine — Development Roadmap

<div align="center">
  <p><strong>From a working simulation kernel to a dependable simulation platform.</strong></p>
  <p>14 phases · 100 work items · Evidence-based priorities · Explicit completion gates</p>
  <p>
    <a href="#review-summary">Review</a> ·
    <a href="#phase-index">Phases</a> ·
    <a href="#recommended-milestones">Milestones</a> ·
    <a href="#how-to-follow-this-roadmap">Tracking</a> ·
    <a href="#first-implementation-brief">Start here</a>
  </p>
</div>

> [!NOTE]
> **Roadmap status:** Phases 01–02 are implemented and merged; **16 of 100** work items are complete. The reviewed baseline remains pinned as historical evidence. Phase 03 has begun with P03-01 in review.

| Document field | Value |
| --- | --- |
| Repository | [keepithandy/pulse-engine](https://github.com/keepithandy/pulse-engine) |
| Review date | October 17, 2026 — America/New_York |
| Reviewed baseline | [`31a8289`](https://github.com/keepithandy/pulse-engine/commit/31a8289875b78fd7bc8363d23e86b9419f0980fc) |
| Package | `@keepithandy/pulse-engine` |
| Baseline version | `0.1.0-alpha.0` |
| Work items completed | **16 / 100** |
| Next work item | **P03-01 — Define a replay format** |

---

## Review summary

Pulse Engine already contains working implementations for synchronous dispatch, rules, immutable events, seeded randomness, snapshots, scheduling, plug-in lifecycle, JSON saves, scenario validation, diagnostics, a headless runner, and a generic entity/component world.

The package is small enough to understand and already protects important contracts with meaningful tests. The strongest next step is to tighten correctness at data and lifecycle boundaries, make the public package easier to consume, and then add larger capabilities on that foundation.

### What was reviewed

All **41 files** in the pinned repository tree were retrieved for this review, including all runtime modules, tests, package manifests, schemas, tools, and workflows. Existing Node checks ran from a local copy of that exact baseline on **Node.js 24.19.0**. Focused probes exercised the boundary cases listed below.

| Verification | Observed result |
| --- | --- |
| Existing test suite | **43 passed; 0 failed** |
| Source syntax, whitespace, and randomness checks | Passed |
| Coverage gate | Passed |
| Overall source line coverage | **96.22%** |
| Overall source branch coverage | **91.11%** |
| Overall source function coverage | **97.78%** |
| Package dry run | Passed; an actual isolated installation remains future work |
| Headless smoke scenario | Passed: tick 100; energy 200; water 110 |
| Baseline Engine quality workflow | [Completed successfully](https://github.com/keepithandy/pulse-engine/actions/runs/39081776403) |
| Baseline Repository integrity workflow | [Completed successfully](https://github.com/keepithandy/pulse-engine/actions/runs/39081776443) |

The local review did not install and rerun the browser matrix. The successful baseline workflow covers the configured Node/OS and Chromium/WebKit jobs. No large-world benchmark or production capacity claim was established.

### Confirmed findings

These observations were reproduced against the reviewed baseline. They are distinct from the proposed larger features later in this document.

| ID | Reproduced behavior | Evidence | First work item |
| --- | --- | --- | --- |
| F01 | An accessor at an array index is accepted and its getter runs during validation/copying. The focused probe invoked it twice. | [`src/data.js`](https://github.com/keepithandy/pulse-engine/blob/31a8289875b78fd7bc8363d23e86b9419f0980fc/src/data.js): array elements are read directly; descriptor checks apply to object keys. | P01-01 |
| F02 | `getEntity({}, "toString")` throws instead of returning the documented missing-entity result. | [`src/world.js`](https://github.com/keepithandy/pulse-engine/blob/31a8289875b78fd7bc8363d23e86b9419f0980fc/src/world.js): lookup reads inherited properties. | P01-02 |
| F03 | Publishing after restoring an event sequence of `Number.MAX_SAFE_INTEGER` advances it to the unsafe value `9007199254740992`. | [`src/events.js`](https://github.com/keepithandy/pulse-engine/blob/31a8289875b78fd7bc8363d23e86b9419f0980fc/src/events.js): publication increments without an overflow guard. | P01-04 |
| F04 | Restore accepts a world with duplicate order entries pointing to a missing entity. | [`src/engine.js`](https://github.com/keepithandy/pulse-engine/blob/31a8289875b78fd7bc8363d23e86b9419f0980fc/src/engine.js) and [`src/world.js`](https://github.com/keepithandy/pulse-engine/blob/31a8289875b78fd7bc8363d23e86b9419f0980fc/src/world.js): current restore validates engine components without validating world invariants. | P01-03 |

### Design and scale decisions to resolve

| Area | Current observation | Planned response |
| --- | --- | --- |
| Tick ordering | Two plug-ins run `a:before, a:action, b:before, b:action`. The desired stage contract needs to be explicit. | P01-05; later Phase 07 |
| Entity representation | Scenarios initialize `state.entities`; the world plug-in stores entities under `state.world`. | P01-07; P04-06 |
| Dispatch cost | Each dispatch captures a complete snapshot and performs multiple copies. This is a performance concern to measure, not a measured regression. | Phase 11 |
| Long-run output | The CLI accumulates the full `--events` log in an array. Its memory use grows with the run. | P11-06; P12-05 |
| Replay | Bounded event history exists; a complete versioned command recording and replay protocol does not. | Phase 03 |
| Public package | The manifest has a root export and CLI, with no declarations or isolated installed-consumer test. | Phase 02 |
| Save compatibility | Snapshot validation requires an exact engine version; plug-in configuration compatibility relies on the host. | Phase 08 |

---

## Product direction

**Goal:** a deterministic simulation package that supports rich worlds, reproducible runs, durable saves, and useful tooling while remaining practical to embed in multiple consumers.

### Architectural rules

1. Keep simulation state JSON-safe and runtime hooks outside saved data.
2. Keep engine execution synchronous; place asynchronous I/O and worker messaging in host adapters.
3. Make time, input order, random streams, and compatibility versions explicit.
4. Keep game story, balance, rendering, and content in consumers such as Outpost Zero.
5. Put inventories, spatial helpers, workflows, and storage adapters behind deliberate optional entry points or packages when their dependencies justify it.
6. Preserve detached reads and atomic state changes while optimizing.
7. Build replay and compatibility fixtures alongside new features.
8. Select stable-release scope deliberately. Optional spatial or economy modules can develop on their own track.
9. Add dependencies only for a demonstrated requirement; a monorepo or runtime rewrite requires a concrete consumer benefit.
10. Measure workload needs before changing the storage or scheduling architecture.

### How the phases fit together

- **Phases 01–03:** correctness, public consumption, reproducibility.
- **Phases 04–07:** richer worlds and reusable simulation systems.
- **Phases 08–10:** durable content, authoring, and diagnostics.
- **Phases 11–12:** measured scale and hosting options.
- **Phases 13–14:** real-consumer validation and stable delivery.

The default path follows the numbered phases. Dependencies below allow optional work to be scheduled independently once its prerequisites are complete. No calendar dates or throughput promises are implied.

## Phase index

Phase 02 is **complete**; Phases 03–14 are **not started**. Phase 01 completion is tracked below; the review evidence above describes the existing package.

| Phase | Outcome | Items | Prerequisites |
| --- | --- | ---: | --- |
| [01](#phase-01--correctness-and-boundary-hardening) | Correctness and boundary hardening | 8 | Reviewed baseline |
| [02](#phase-02--public-api-and-developer-experience) | Public API and developer experience | 7 | Phase 01 |
| [03](#phase-03--replay-provenance-and-determinism) | Replay, provenance, and determinism | 7 | Phases 01–02 |
| [04](#phase-04--world-model-and-component-schemas) | World model and component schemas | 8 | Phases 01–02; Phase 03 replay fixtures apply to new actions |
| [05](#phase-05--queries-relationships-and-spatial-foundations) | Queries, relationships, and spatial foundations | 7 | Phase 04; Phase 03 fixture discipline |
| [06](#phase-06--resources-inventories-and-transfers) | Resources, inventories, and transfers | 7 | Phases 04–05 |
| [07](#phase-07--scheduling-and-long-running-workflows) | Scheduling and long-running workflows | 7 | Phases 02–04; resource examples can follow Phase 06 |
| [08](#phase-08--durable-saves-and-storage-adapters) | Durable saves and storage adapters | 7 | Phases 03–04 and 07 |
| [09](#phase-09--scenario-authoring-and-content-tooling) | Scenario authoring and content tooling | 7 | Phases 02, 04, and 08 |
| [10](#phase-10--diagnostics-and-developer-tools) | Diagnostics and developer tools | 7 | Phases 02–03 and 09 |
| [11](#phase-11--performance-and-large-world-scaling) | Performance and large-world scaling | 7 | Phases 03, 05, 07, and 10 |
| [12](#phase-12--workers-host-integration-and-cli-expansion) | Workers, host integration, and CLI expansion | 7 | Phases 02, 08, and 11 |
| [13](#phase-13--reference-consumers-and-ecosystem-validation) | Reference consumers and ecosystem validation | 7 | Phases 06–07, 09–10, and 12 |
| [14](#phase-14--release-engineering-and-stable-package-delivery) | Release engineering and stable package delivery | 7 | All preceding work selected for the release scope; optional tracks may be deferred explicitly |

## Recommended milestones

| Milestone | Completion evidence | Release posture |
| --- | --- | --- |
| A — Dependable alpha | Phases 01–02 pass their gates. | A clean consumer can install and use a hardened public package. |
| B — Reproducible core | Phase 03 passes with replay fixtures. | Runs have versioned inputs and divergence reports. |
| C — Persistent world foundation | Phase 04 and the selected Phase 07–08 capabilities pass. | Real worlds can be validated, saved, restored, and upgraded. |
| D — Productive authoring and hosting | Selected Phase 09–12 tools meet their gates. | Developers can author, inspect, and host representative workloads. |
| E — Stable selected scope | Reference consumers validate the chosen scope and Phase 14 closes. | A documented compatibility promise supports a stable release. |

A milestone is complete only when its evidence is recorded. Passing the current test suite does not automatically complete a new milestone.

---

## Phase 01 — Correctness and boundary hardening

**Status:** complete · **Progress:** 8/8 · **Depends on:** Reviewed baseline

**Outcome:** A trustworthy baseline before the public API and feature surface grow.

### Work items

- [x] **P01-01 — Make data validation inert.** Validate array property descriptors before reading values; define handling of sparse arrays, symbols, accessors, and unsupported properties.
  - **Done when:** Array getters never execute during validation or copying, and supported values round-trip through saves without silent changes.
  - **Completed October 17, 2026.** [PR #22](https://github.com/keepithandy/pulse-engine/pull/22) merged into `main` at [`1ed004c`](https://github.com/keepithandy/pulse-engine/commit/1ed004cbe3b929f214e183cceba9002186fc567c). The fix validates array-index descriptors without running getters, rejects data shapes that would not survive JSON faithfully, and documents the supported boundary in `docs/engine-contracts.md`. Nine regression tests cover unsafe fields, no getter execution, unchanged rejected-operation checkpoints, and JSON save/restore.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/39083857321) passed across Node 22/24 on Ubuntu, Windows and macOS and Chromium/WebKit; CI ran `npm ci`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run check:package`, `npm run smoke`, and browser checks. [Repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/39083857325) passed.

- [x] **P01-02 — Harden entity identity and lookups.** Use own-property lookups consistently and define one policy for whitespace and reserved identifiers.
  - **Done when:** Missing ids such as `toString` return the documented missing result; mutation attempts cannot act on inherited properties.
  - **Completed October 24, 2026.** [PR #25](https://github.com/keepithandy/pulse-engine/pull/25) merged at [`f5c6281`](https://github.com/keepithandy/pulse-engine/commit/f5c6281b7c9cd1d8b7e73f2be494d28c26965ccf). Own-property lookup, canonical input policy, and regression coverage are in place.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40139853366) and [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40139853302) passed.

- [x] **P01-03 — Validate restored world invariants.** Add a consumer/plug-in state-validation boundary and validate world order, entity records, components, and counters before installing state.
  - **Done when:** Duplicate order entries, dangling ids, and malformed world records reject atomically without coupling the core to game schemas.
  - **Completed October 24, 2026.** [PR #24](https://github.com/keepithandy/pulse-engine/pull/24) merged at [`fdd7a20`](https://github.com/keepithandy/pulse-engine/commit/fdd7a20a9a16fd166002f1512901cd011ac1d13f). `validateState` and `validateWorldState` reject malformed restores atomically.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40131883832) and [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40131883833) passed.

- [x] **P01-04 — Guard every deterministic counter.** Audit event sequences, entity allocation, schedules, revisions, and numeric random-range boundaries.
  - **Done when:** Operations at safe-integer boundaries reject before mutation; generated identities remain unique across restore.
  - **Completed October 24, 2026.** [PR #26](https://github.com/keepithandy/pulse-engine/pull/26) guards event publication and batches, entity allocation, repeating-job rescheduling, and overflowing random ranges. Rejected operations preserve counters and engine state.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40140652177) passed Node 22/24 across Linux, Windows, and macOS plus Chromium and WebKit; [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40140652171) passed.

- [x] **P01-05 — Specify tick phase ordering.** Choose and document whether all `beforeTick` hooks finish before any `onAction` hook, or whether plug-ins execute interleaved.
  - **Done when:** A two-plug-in fixture locks down the chosen order, rejection behavior, and observable events; compatibility impact is recorded.
  - **Completed October 24, 2026.** [PR #27](https://github.com/keepithandy/pulse-engine/pull/27) records dependency-ordered, per-plugin interleaving, preserving current behavior. Its two-plugin fixture verifies hook/event order and atomic rejection.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40140979291) passed Node 22/24 across Linux, Windows, and macOS plus Chromium and WebKit; [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40140979301) passed.

- [x] **P01-06 — Complete lifecycle and failure contracts.** Define subscription cleanup, post-disposal reads/writes, observer errors, and irreversible external side effects in hooks.
  - **Done when:** Lifecycle tests cover retained listeners and failed setup/disposal; documentation states exactly which engine changes roll back.
  - **Completed October 24, 2026.** [PR #28](https://github.com/keepithandy/pulse-engine/pull/28) clears subscriptions and blocks writes/new subscriptions after disposal while preserving reads. It documents setup, unregister, disposal, observer, and external-side-effect failure behavior, with lifecycle regression coverage.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40141298868) passed Node 22/24 across Linux, Windows, and macOS plus Chromium and WebKit; [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40141298856) passed.

- [x] **P01-07 — Define scenario-to-world mapping.** Document how scenario `state.entities` relates to the world plug-in's `state.world` and choose a compatibility strategy.
  - **Done when:** A written state-layout decision and migration fixture specification remove ambiguity before the world expansion.
  - **Completed October 24, 2026.** [PR #29](https://github.com/keepithandy/pulse-engine/pull/29) preserves v1 scenario entities at `state.entities` and keeps ECS records at `state.world`; there is no implicit copy or merge. The decision includes current compatibility and future P04-06 adapter fixtures.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40141684324) passed Node 22/24 across Linux, Windows, and macOS plus Chromium and WebKit; [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40141684419) passed.

- [x] **P01-08 — Build an adversarial contract suite.** Add focused malformed-input fixtures for every confirmed finding and the associated public entry points.
  - **Done when:** Each regression demonstrates the failure before its fix and asserts unchanged state, randomness, counters, and history after rejection.
  - **Completed October 24, 2026.** [PR #30](https://github.com/keepithandy/pulse-engine/pull/30) adds the adversarial contract matrix covering F01–F04, maps each finding to public entry points and regressions, and audits P01-04 boundary coverage.
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40142052854) passed Node 22/24 across Linux, Windows, and macOS plus Chromium and WebKit; [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40142052756) passed.

### Demonstration

Malformed inputs and failed operations leave the same usable engine checkpoint.

### Phase completion gate

The four reproduced findings have focused regression coverage; time, cleanup, and scenario/world contracts are explicit.

[Return to phase index](#phase-index)

---

## Phase 02 — Public API and developer experience

**Status:** complete · **Progress:** 7/7 · **Depends on:** Phase 01

**Outcome:** A package that downstream developers can discover, type-check, and install with confidence.

### Work items

- [x] **P02-01 — Inventory the supported API.** Classify root exports as stable candidates or advanced helpers and document the support boundary.
  - **Done when:** Every supported export has an example, input contract, return shape, and compatibility policy.
  - **Completed October 24, 2026.** [PR #31](https://github.com/keepithandy/pulse-engine/pull/31) adds the [public API inventory](public-api.md), covering all 25 root exports, 25 engine methods, compatibility classes, and advanced subsystem interfaces. Local checks verified all 13 examples and the 70-test coverage suite. See the [implementation brief](implementation-briefs/P02-01-supported-api-inventory.md).
  - **Verification:** [Engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40148469920) passed Node 22/24 across Linux, Windows, and macOS plus Chromium and WebKit; [repository integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40148469904) passed.

- [x] **P02-02 — Ship TypeScript declarations.** Add generics for state, actions, events, systems, rules, and plug-in context without requiring a runtime rewrite.
  - **Done when:** Consumer fixtures type-check normal usage and reject representative invalid actions and hook results.
  - **Completed October 26, 2026.** [PR #34](https://github.com/keepithandy/pulse-engine/pull/34): Root declarations, strict NodeNext/Bundler fixture checks, and isolated installed TypeScript consumption.

- [x] **P02-03 — Introduce structured errors.** Define documented error codes, categories, causes, and JSON-safe summaries while preserving useful messages.
  - **Done when:** Callers can distinguish validation, rejection, compatibility, and lifecycle failures without parsing prose.
  - **Completed October 28, 2026.** [PR #39](https://github.com/keepithandy/pulse-engine/pull/39): Structured failure codes, categories, JSON-safe cause summaries and regression coverage at key public boundaries.

- [x] **P02-04 — Add package metadata and export checks.** Complete repository, homepage, issue tracker, keywords, types, and deliberate export paths.
  - **Done when:** A package validator catches missing destinations and private-file leakage; supported imports resolve from the tarball.
  - **Completed October 28, 2026.** [PR #35](https://github.com/keepithandy/pulse-engine/pull/35): Discoverability metadata, export and tarball allowlist validation, with executable-example packaging completed in the Phase 02 follow-up.

- [x] **P02-05 — Test installed consumers.** Replace dry-run-only confidence with real temporary tarball installation in isolated consumer fixtures.
  - **Done when:** Root imports and the installed CLI work outside the repository with development dependencies absent.
  - **Completed October 28, 2026.** [PR #38](https://github.com/keepithandy/pulse-engine/pull/38): Isolated tarball installation verifying JavaScript root imports, private deep-import rejection and CLI execution.

- [x] **P02-06 — Organize executable examples.** Add small examples for dispatch, rules, world entities, schedules, saves, and inspection.
  - **Done when:** CI executes the examples against the public package surface and checks their documented outcomes.
  - **Completed October 28, 2026.** [PR #36](https://github.com/keepithandy/pulse-engine/pull/36): Six independent deterministic executable examples, exercised by the test suite.

- [x] **P02-07 — Separate guides from reference.** Provide getting-started, API-reference, troubleshooting, and compatibility pages with a concise navigation index.
  - **Done when:** A new contributor can run a scenario and locate every supported API without reading engine internals.
  - **Completed October 28, 2026.** [PR #37](https://github.com/keepithandy/pulse-engine/pull/37): Getting-started, troubleshooting, compatibility and documentation-index guides.

### Demonstration

A clean JavaScript consumer and a clean TypeScript consumer import the packed package and run the same scenario.

### Phase completion gate

The packed artifact, public exports, examples, and declarations agree. Phase 02's implementation PRs are merged; at merge time, some macOS matrix jobs were still queued, while the completed Linux, Windows, and browser checks reported success. The follow-up package test also verifies that examples survive a real tarball installation.

[Return to phase index](#phase-index)

---

## Phase 03 — Replay, provenance, and determinism

**Status:** in progress · **Progress:** 0/7 · **Depends on:** Phases 01–02

**Outcome:** Runs can be reproduced and divergences can be explained from durable inputs.

### Work items

- [ ] **P03-01 — Define a replay format.** Record initial state, seed, configuration identity, ordered commands, and explicit time-control operations.
  - **Done when:** A versioned schema distinguishes replay inputs from the bounded event journal and preserves scheduled-action semantics.
  - **Implementation in review, October 28, 2026:** [PR #41](https://github.com/keepithandy/pulse-engine/pull/41) defines the versioned replay input record, shipped JSON Schema, strict validator, regression fixtures, TypeScript contracts and explicit external-command/scheduled-work policies. The checkbox remains open until CI and merge are complete.

- [ ] **P03-02 — Record complete command histories.** Add an opt-in recorder with sequence numbers, accepted/rejected outcomes, and a policy for dynamic plug-in changes.
  - **Done when:** Captured input order is complete and recording can use a streaming sink without retaining the entire run in memory.

- [ ] **P03-03 — Implement replay execution.** Rebuild a fresh configured engine and execute recorded commands without duplicating internally scheduled work.
  - **Done when:** Original and replayed checkpoints match for ticks, state, PRNG, scheduler, revisions, and event sequencing.

- [ ] **P03-04 — Add canonical checkpoint digests.** Specify deterministic serialization and digest inputs after the Phase 01 data policy is fixed.
  - **Done when:** Equivalent supported data yields identical digests across the supported runtime matrix; ordering and numeric edge cases have fixtures.

- [ ] **P03-05 — Report divergence precisely.** Compare checkpoints and report the earliest differing command, tick, state path, and configuration identity.
  - **Done when:** A deliberately corrupted replay produces a useful first-divergence report without dumping sensitive full state by default.

- [ ] **P03-06 — Add named random streams.** Offer deterministic stream derivation for independent systems while keeping existing random sequences compatible.
  - **Done when:** Adding an unrelated named stream does not change existing stream output; stream state participates in rollback and saves.

- [ ] **P03-07 — Publish determinism fixtures.** Create repeat, restore, replay, and cross-runtime fixture suites with versioned expected results.
  - **Done when:** CI checks fixtures across supported Node versions and browsers and requires review for expected-result changes.

### Demonstration

Record a run, replay it in a fresh engine, and identify the first deliberate divergence.

### Phase completion gate

Replay verifies configuration and state checkpoints and fails clearly when required inputs are missing.

[Return to phase index](#phase-index)

---

## Phase 04 — World model and component schemas

**Status:** not started · **Progress:** 0/8 · **Depends on:** Phases 01–02; Phase 03 replay fixtures apply to new actions

**Outcome:** A validated world foundation that can represent substantially richer simulations.

### Work items

- [ ] **P04-01 — Register component schemas.** Add optional component validators, defaults, and explicit component version metadata.
  - **Done when:** Invalid component writes fail before commit and schema/default application is consistent across create, update, and load.

- [ ] **P04-02 — Register entity archetypes.** Define reusable named sets of component defaults with explicit merge and override rules.
  - **Done when:** Archetype expansion produces independent entity data in deterministic order and rejects unknown archetypes.

- [ ] **P04-03 — Support atomic world batches.** Allow related creates, updates, and removals to be submitted as one explicit world transaction.
  - **Done when:** One invalid operation rolls back the entire batch, including allocated ids and emitted events.

- [ ] **P04-04 — Add revision-aware patching.** Introduce bounded component patch operations and optional expected-revision checks.
  - **Done when:** Stale updates reject predictably; patches cannot escape component boundaries or create reserved keys.

- [ ] **P04-05 — Strengthen entity references.** Define reference declarations and deterministic policies for deleting referenced entities.
  - **Done when:** Reject, cascade, or detach policies are explicit and tested; broken references cannot enter a validated save.

- [ ] **P04-06 — Bridge scenario entities into worlds.** Implement the Phase 01 mapping decision with a documented adapter and legacy migration path.
  - **Done when:** Existing scenario fixtures retain their meaning and new world scenarios populate one declared source of entity truth.

- [ ] **P04-07 — Expose world change summaries.** Return created, changed, and removed entity/component identities without exposing live mutable objects.
  - **Done when:** Consumers can update a view from change summaries and obtain the same result as a complete query.

- [ ] **P04-08 — Add world compatibility migrations.** Version world/component layouts and provide migration hooks owned by their schemas.
  - **Done when:** Old fixture worlds migrate deterministically; incompatible or partial migrations leave the live engine unchanged.

### Demonstration

Create a populated world, update components, save it, and restore identical queries.

### Phase completion gate

All new world actions are deterministic, validated, migratable, and replayable.

[Return to phase index](#phase-index)

---

## Phase 05 — Queries, relationships, and spatial foundations

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phase 04; Phase 03 fixture discipline

**Outcome:** World data supports rich selection, linked entities, and deterministic spatial queries.

### Work items

- [ ] **P05-01 — Design reusable query objects.** Support component predicates, projections, limits, and explicit result ordering.
  - **Done when:** Equivalent queries return detached results in a documented stable order, including tied values.

- [ ] **P05-02 — Introduce query indexes.** Add measured indexes for common component and type membership queries.
  - **Done when:** Indexed results match a simple reference scan before and after mutations, batches, and restore.

- [ ] **P05-03 — Model typed relationships.** Represent directed links with types, metadata, uniqueness rules, and optional reverse traversal.
  - **Done when:** Relationship operations validate endpoints and participate in world transactions, events, and persistence.

- [ ] **P05-04 — Add bounded graph traversal.** Provide deterministic neighbor, reachability, and constrained traversal helpers.
  - **Done when:** Cycles terminate, traversal budgets are explicit, and equal-cost results have stable tie-breaking.

- [ ] **P05-05 — Add optional spatial primitives.** Define game-agnostic positions, bounds, grids, and coordinate conventions in an optional module.
  - **Done when:** Coordinates and boundary behavior have reproducible fixtures and remain consumer-configurable.

- [ ] **P05-06 — Implement nearby and region queries.** Support deterministic radius, bounds, and cell queries with an index rebuild strategy.
  - **Done when:** Spatial results match brute-force fixtures and remain correct after moves, deletes, batches, and restore.

- [ ] **P05-07 — Prototype deterministic pathfinding.** Add a bounded grid/graph route helper with declared costs and tie-breaking.
  - **Done when:** The same map and request produce the same route; blocked or over-budget requests return structured outcomes.

### Demonstration

Query a connected world by components, relations, and nearby positions with stable result order.

### Phase completion gate

Indexes are derived, rebuildable, and equivalent to validated reference scans.

[Return to phase index](#phase-index)

---

## Phase 06 — Resources, inventories, and transfers

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 04–05

**Outcome:** Reusable simulation modules support economies and logistics with explicit invariants.

### Work items

- [ ] **P06-01 — Create a resource ledger.** Define resource identities, quantities, units, bounds, and optional fixed-point precision.
  - **Done when:** Invalid quantities reject and each resource's precision and rounding policy is documented and tested.

- [ ] **P06-02 — Add inventory containers.** Model slots, stacks, capacity, and accepted-resource constraints as reusable components.
  - **Done when:** Insertion, removal, and overflow handling preserve declared capacity and quantity invariants.

- [ ] **P06-03 — Implement atomic transfers.** Transfer between inventories or accounts with explicit partial-transfer policies.
  - **Done when:** Failed transfers change neither endpoint and emit no committed transfer event.

- [ ] **P06-04 — Support reservations and commitments.** Reserve quantities for future jobs with deterministic release, expiry, and commit actions.
  - **Done when:** Concurrent reservations cannot overcommit stock and survive replay and restore consistently.

- [ ] **P06-05 — Build production recipes.** Describe deterministic input consumption and output production with requirements and duration metadata.
  - **Done when:** A recipe starts only when its declared inputs and output policy are satisfied; completion cannot duplicate goods.

- [ ] **P06-06 — Model logistics work orders.** Represent delivery requests, assignments, pickup, transit, and completion using existing world and scheduling APIs.
  - **Done when:** Interrupted and resumed work preserves item ownership and produces an inspectable event trail.

- [ ] **P06-07 — Add accounting and balance scenarios.** Create conservation checks and scenarios that exercise loops, shortages, overflow, and cancellation.
  - **Done when:** Fixture runs reconcile every quantity change to an explicit source, sink, or transfer.

### Demonstration

A resource network produces, stores, reserves, and transfers goods without violating capacity or conservation rules.

### Phase completion gate

Transfers and reservations remain atomic and reproducible across save/restore.

[Return to phase index](#phase-index)

---

## Phase 07 — Scheduling and long-running workflows

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 02–04; resource examples can follow Phase 06

**Outcome:** The time model can coordinate complex simulation work with inspectable behavior.

### Work items

- [ ] **P07-01 — Add schedule groups and handles.** Support groups, tags, rescheduling, and group cancellation with stable identities.
  - **Done when:** Updates preserve deterministic ordering and invalid group operations leave existing jobs unchanged.

- [ ] **P07-02 — Introduce explicit tick stages.** Formalize the Phase 01 ordering decision into documented execution stages and dependency rules.
  - **Done when:** Stage transitions and failure boundaries have fixtures and cannot introduce hidden wall-clock behavior.

- [ ] **P07-03 — Support deterministic priorities.** Add priority where justified, with insertion sequence as a final stable tie-breaker.
  - **Done when:** Ordering is identical before and after restore and old schedules retain their documented behavior.

- [ ] **P07-04 — Add tick-based retries.** Provide explicit maximum attempts, retry delays, and terminal-failure records.
  - **Done when:** Retry timing depends only on simulation ticks and every attempt is replayable and inspectable.

- [ ] **P07-05 — Create a workflow state machine.** Model named states, guarded transitions, scheduled waits, completion, and cancellation.
  - **Done when:** Workflows save and restore without losing pending transitions or executing terminal work twice.

- [ ] **P07-06 — Bound per-step work.** Add a declared policy for due-job bursts, cancellation, and deterministic continuation under a work budget.
  - **Done when:** A large due queue can be processed incrementally with equivalent final results and clear progress metadata.

- [ ] **P07-07 — Add calendar and time-scale adapters.** Offer optional calendar views and speed controls outside the deterministic kernel.
  - **Done when:** Changing display speed or host timing does not change simulation results for the same tick/action sequence.

### Demonstration

A multi-step job pauses, retries, resumes from a save, and reaches a deterministic terminal state.

### Phase completion gate

New time behavior has versioned ordering, bounded work, and compatible restore semantics.

[Return to phase index](#phase-index)

---

## Phase 08 — Durable saves and storage adapters

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 03–04 and 07

**Outcome:** Long-lived worlds can be stored, recovered, and upgraded through a documented compatibility path.

### Work items

- [ ] **P08-01 — Separate format compatibility versions.** Define policies for save, snapshot, world, component, replay, and plug-in configuration versions.
  - **Done when:** Compatible patch releases can load declared supported fixtures without relying only on exact engine-version equality.

- [ ] **P08-02 — Record configuration manifests.** Include required plug-in ids/versions and schema identities or fingerprints in save metadata.
  - **Done when:** Loading into a mismatched runtime produces an actionable error before changing engine state.

- [ ] **P08-03 — Define storage adapter contracts.** Keep asynchronous I/O outside synchronous hooks and specify save/load/list/delete adapter behavior.
  - **Done when:** An in-memory reference adapter passes a shared conformance suite with explicit failure semantics.

- [ ] **P08-04 — Build atomic file persistence.** Provide an optional Node adapter using staged writes and a documented recovery strategy.
  - **Done when:** Interrupted-write fixtures preserve the last valid save and recover or report incomplete writes predictably.

- [ ] **P08-05 — Build browser persistence.** Provide an optional IndexedDB adapter with schema upgrades and quota-error handling.
  - **Done when:** Browser fixtures cover reload recovery, upgrade paths, failed writes, and unavailable storage.

- [ ] **P08-06 — Add bounded autosave and retention.** Schedule host-owned checkpoints with save slots, rotation, retention, and cancellation.
  - **Done when:** Overlapping save requests follow a declared ordering and a failed save does not erase the previous good slot.

- [ ] **P08-07 — Add save inspection and migration tooling.** Offer metadata-only inspection, compatibility reports, and explicit offline migration.
  - **Done when:** Users can inspect or migrate a copy before loading; integrity checks are documented as corruption detection, not authentication.

### Demonstration

Save a world through an adapter, recover after an interrupted write, and migrate a previous format.

### Phase completion gate

Storage failures cannot silently replace a valid save or partially install live state.

[Return to phase index](#phase-index)

---

## Phase 09 — Scenario authoring and content tooling

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 02, 04, and 08

**Outcome:** Large scenarios become easy to compose, validate, compare, and distribute.

### Work items

- [ ] **P09-01 — Align schema and runtime validation.** Use shared fixtures to remove discrepancies between the JSON schema and semantic validator.
  - **Done when:** Both paths accept and reject the same structural examples, while semantic errors retain precise paths.

- [ ] **P09-02 — Add versioned scenario upgrades.** Introduce explicit migrations and normalized scenario output.
  - **Done when:** Older scenarios upgrade reproducibly and unsupported versions fail without partially constructing an engine.

- [ ] **P09-03 — Support bounded composition.** Design deterministic includes, templates, and overrides with explicit precedence and cycle detection.
  - **Done when:** Composition resolves to self-contained data, has resource limits, and cannot read arbitrary paths by default.

- [ ] **P09-04 — Add procedural scenario generation.** Provide seeded generators for generic networks, populations, and spatial fixtures.
  - **Done when:** The same generator version, parameters, and seed produce identical normalized scenarios.

- [ ] **P09-05 — Add validation commands.** Expose dedicated validation, normalization, and compatibility-report commands.
  - **Done when:** Invalid content exits nonzero with structured path errors and valid normalization is stable across repeated runs.

- [ ] **P09-06 — Introduce content manifests.** Describe content versions, dependencies, required schemas, and configuration requirements as data.
  - **Done when:** Missing or incompatible content dependencies fail before engine startup; scenarios do not execute downloaded code.

- [ ] **P09-07 — Publish a scenario gallery.** Provide small, medium, and stress scenarios with documented purpose and expected behavior.
  - **Done when:** Every gallery entry validates, runs through public APIs, and declares its required optional modules.

### Demonstration

Compose a scenario from reusable content, validate it with useful errors, and reproduce its run.

### Phase completion gate

The schema, runtime validator, normalized data, and CLI agree on accepted inputs.

[Return to phase index](#phase-index)

---

## Phase 10 — Diagnostics and developer tools

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 02–03 and 09

**Outcome:** Developers can inspect large simulations and explain decisions without editing engine internals.

### Work items

- [ ] **P10-01 — Define a diagnostics protocol.** Version portable inspection, trace, command-result, and error envelopes.
  - **Done when:** Tools can negotiate protocol compatibility and distinguish redacted, disabled, and unavailable fields.

- [ ] **P10-02 — Build a read-only inspector.** Add a separate developer interface for state, components, schedules, plug-ins, and configuration.
  - **Done when:** The interface works through public observation APIs and remains usable against a saved inspection record.

- [ ] **P10-03 — Add event and action timelines.** Correlate recorded commands, committed events, workflow steps, and rule decisions.
  - **Done when:** Developers can filter by entity, action, tick, and event type without losing causal identifiers.

- [ ] **P10-04 — Build snapshot and replay comparisons.** Show changed paths and configuration differences between checkpoints.
  - **Done when:** The comparison agrees with canonical digests and highlights the first meaningful divergence.

- [ ] **P10-05 — Introduce named metrics.** Capture counters for dispatches, rejections, queue depth, history use, and optional host-side durations.
  - **Done when:** Metrics collection is optional and timing measurements never influence deterministic simulation decisions.

- [ ] **P10-06 — Add portable debug bundles.** Export a redacted run manifest, relevant checkpoints, traces, and reproduction instructions.
  - **Done when:** Bundles explicitly identify omissions and can reproduce supported cases without secrets or unrelated user data.

- [ ] **P10-07 — Add diagnostics access controls.** Define redaction boundaries, payload budgets, and visibility rules for any external inspector bridge.
  - **Done when:** Oversized or restricted records are handled explicitly and read-only sessions cannot invoke mutation commands.

### Demonstration

Inspect a failing replay, find the first divergence, and trace it to an action and rule.

### Phase completion gate

Tools consume detached diagnostics and cannot mutate live state through observation APIs.

[Return to phase index](#phase-index)

---

## Phase 11 — Performance and large-world scaling

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 03, 05, 07, and 10

**Outcome:** Scaling decisions are supported by measurements and preserve existing behavior.

### Work items

- [ ] **P11-01 — Establish reproducible benchmarks.** Measure dispatch, tick, world queries, saves, restore, scheduling, and diagnostics at defined sizes.
  - **Done when:** Benchmark reports include runtime, hardware, scenario, seed, warm-up, and allocation/memory observations.

- [ ] **P11-02 — Set workload budgets.** Choose representative small, medium, and large workloads from consumer needs.
  - **Done when:** Targets are documented as measured budgets and baseline data is stored before optimization begins.

- [ ] **P11-03 — Reduce unnecessary copying.** Profile the current snapshot-per-dispatch path and repeated copies before introducing transaction or structural-sharing strategies.
  - **Done when:** Selected workloads improve while rollback, detached reads, and frozen observer data retain their contracts.

- [ ] **P11-04 — Optimize scheduler structures.** Evaluate an indexed priority queue or equivalent only where the baseline warrants it.
  - **Done when:** Due-job ordering, cancellation, repeat behavior, and restored schedules remain fixture-equivalent.

- [ ] **P11-05 — Cache stable dependency and query plans.** Avoid recomputing unchanged plug-in ordering and query membership plans.
  - **Done when:** Registration, removal, component changes, and restore invalidate caches correctly and match uncached results.

- [ ] **P11-06 — Bound large-run memory.** Stream replay/events and summaries; offer incremental advance results with backpressure and cancellation.
  - **Done when:** Memory use is bounded by documented buffers rather than total run length when streaming modes are selected.

- [ ] **P11-07 — Add regression reporting.** Track trend reports and introduce performance gates only on controlled runners with justified tolerances.
  - **Done when:** Noisy shared-runner timing does not block unrelated changes; correctness gates remain mandatory.

### Demonstration

Compare a large-world workload before and after optimization with identical checkpoint digests.

### Phase completion gate

Representative workloads show measured improvements without determinism or isolation regressions.

[Return to phase index](#phase-index)

---

## Phase 12 — Workers, host integration, and CLI expansion

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 02, 08, and 11

**Outcome:** Consumers can host the engine efficiently in browsers, Node services, and automation.

### Work items

- [ ] **P12-01 — Design a host transport protocol.** Define versioned commands, responses, subscriptions, correlation ids, and cancellation messages.
  - **Done when:** Unknown protocol versions and out-of-order requests fail predictably without corrupting the hosted engine.

- [ ] **P12-02 — Add a Web Worker adapter.** Run the synchronous engine behind an asynchronous browser messaging boundary.
  - **Done when:** Worker and direct runs match; startup, cancellation, errors, and disposal are covered by browser tests.

- [ ] **P12-03 — Add a Node worker adapter.** Support isolated headless runs through worker threads with explicit resource ownership.
  - **Done when:** Worker termination releases handles and task failures remain scoped to their declared run.

- [ ] **P12-04 — Expand CLI subcommands.** Add run, validate, inspect, replay, compare, and migrate commands as their underlying APIs mature.
  - **Done when:** Help, exit codes, JSON output, stderr diagnostics, and invalid arguments have installed-package tests.

- [ ] **P12-05 — Stream CLI outputs.** Support backpressure-aware event/replay files and bounded summaries; define interruption behavior.
  - **Done when:** Long-run output does not accumulate in one event array and partial artifacts are identifiable.

- [ ] **P12-06 — Add concurrent run orchestration.** Support independent seeded run batches with deterministic run identities and bounded concurrency.
  - **Done when:** Serial and concurrent batches produce the same per-run results regardless of completion order.

- [ ] **P12-07 — Publish consumer integration adapters.** Provide small framework-independent subscription bindings and service-host examples.
  - **Done when:** Adapters use public APIs, do not access internal mutable state, and have explicit teardown and compatibility tests.

### Demonstration

Run the same scenario directly, in a worker, and through the CLI with matching checkpoint digests.

### Phase completion gate

Host adapters preserve command order, propagate errors, and clean up resources.

[Return to phase index](#phase-index)

---

## Phase 13 — Reference consumers and ecosystem validation

**Status:** not started · **Progress:** 0/7 · **Depends on:** Phases 06–07, 09–10, and 12

**Outcome:** The package proves its usefulness through real consumers and reusable examples.

### Work items

- [ ] **P13-01 — Define the Outpost Zero vertical slice.** Specify the smallest playable consumer loop using world entities, resource flows, and scheduled jobs.
  - **Done when:** The consumer owns game-specific content and proves one complete loop with save/restore.

- [ ] **P13-02 — Build a logistics reference simulation.** Exercise inventories, reservations, routes, and workflows in a reusable demonstration.
  - **Done when:** A deterministic scenario explains shortages and delivery outcomes through events and diagnostics.

- [ ] **P13-03 — Build a distinct second consumer.** Use the engine for a different simulation shape, such as an agent sandbox or event-driven factory.
  - **Done when:** Both consumers use the public package without adding game-specific branches to the core.

- [ ] **P13-04 — Create an integration test matrix.** Track supported consumer versions against core and optional-module versions.
  - **Done when:** Candidate releases run the declared consumer fixtures and surface compatibility failures before publication.

- [ ] **P13-05 — Publish a plug-in starter.** Provide a minimal plug-in with typed hooks, manifests, contract tests, examples, and migration notes.
  - **Done when:** A new plug-in can be packed and consumed by an isolated fixture without engine-internal imports.

- [ ] **P13-06 — Publish extension quality criteria.** Document dependency, determinism, lifecycle, data-validation, compatibility, and licensing expectations.
  - **Done when:** A reusable conformance checklist distinguishes tested support from unverified community claims.

- [ ] **P13-07 — Feed real usage back into the API.** Collect concrete friction from the reference consumers and prioritize evidence-backed fixes.
  - **Done when:** Each accepted API change links a consumer problem, migration plan, and regression fixture.

### Demonstration

Multiple consumers use the same engine while keeping their content and presentation separate.

### Phase completion gate

Consumer feedback produces targeted API improvements and compatibility fixtures.

[Return to phase index](#phase-index)

---

## Phase 14 — Release engineering and stable package delivery

**Status:** not started · **Progress:** 0/7 · **Depends on:** All preceding work selected for the release scope; optional tracks may be deferred explicitly

**Outcome:** A maintainable release process with an explicit compatibility promise.

### Work items

- [ ] **P14-01 — Choose stable release scope.** Separate required core capabilities from optional modules and experimental APIs.
  - **Done when:** A written release contract lists supported platforms, formats, exports, and deferred work without requiring every optional feature for core v1.

- [ ] **P14-02 — Add changesets and compatibility review.** Select a lightweight version/changelog workflow and require migration notes for breaking changes.
  - **Done when:** A change's compatibility impact is reviewable before release and engine/package version values cannot drift.

- [ ] **P14-03 — Harden automation and maintenance.** Unify workflow conventions, declare supported runtime lifetimes, pin actions under a maintenance policy, and document vulnerability reporting.
  - **Done when:** Workflow permissions and update ownership are clear; dependency changes receive reproducible compatibility checks.

- [ ] **P14-04 — Automate verified artifacts.** Build and test the actual tarball, attach checksums and release notes, and rehearse publication without credentials in logs.
  - **Done when:** An independent consumer installs the exact candidate artifact and confirms imports, CLI, examples, and bundled declarations.

- [ ] **P14-05 — Prepare publication controls.** Define authorized maintainers, scoped package settings, protected release environments, and provenance where supported.
  - **Done when:** A dry-run release succeeds; real publication requires an explicit release action and uses the verified candidate.

- [ ] **P14-06 — Run beta compatibility and recovery drills.** Exercise old saves, scenario migrations, replay fixtures, worker hosts, and consumer upgrades.
  - **Done when:** Supported upgrades pass and unsupported ones fail clearly; release rollback and artifact-retention procedures are documented.

- [ ] **P14-07 — Close the stable-release checklist.** Review documentation, license notices, troubleshooting, support policy, benchmark evidence, and known limitations.
  - **Done when:** The release owner signs off on evidence for the selected scope and records the next maintenance priorities.

### Demonstration

Install a candidate tarball in clean consumers, load supported fixtures, and complete a documented release rehearsal.

### Phase completion gate

Only the selected, tested scope enters the release; deferred items remain visible and unchecked.

[Return to phase index](#phase-index)

---

## How to follow this roadmap

### Status rules

| Status | Meaning |
| --- | --- |
| Not started | No implementation work has begun. |
| In progress | One clearly bounded work item is active. |
| Blocked | The missing prerequisite, owner decision, or failing gate is written down. |
| In review | Implementation and evidence are ready for review. |
| Complete | Acceptance criteria, relevant tests, documentation, and phase evidence are satisfied. |
| Deferred | Explicitly removed from the current release scope; its checkbox remains unchecked. |

Use GitHub task-list checkboxes for individual completion. Update each phase's progress and status when its work changes. Count completed work items rather than subtasks, review steps, or existing baseline features.

### Recommended working loop

1. Start with the earliest unfinished prerequisite.
2. Select one work item, such as `P01-01`.
3. Turn its acceptance criteria into a small implementation brief.
4. Record the current behavior and write a regression fixture for a confirmed defect.
5. Implement a reviewable change, keeping related compatibility work together.
6. Run the checks relevant to the changed contract and the required repository gates.
7. Record the pull request, commit, exact commands, and observed results.
8. Update the checkbox only after the completion criteria are met.
9. Update the phase status and decide the next work item.
10. Revisit priorities at milestone boundaries using actual consumer feedback.

One work item can require multiple pull requests. A large phase should not become a single unreviewable change. Separate early correctness fixes from later feature additions so each contract remains easy to inspect.

### Suggested issue and pull-request naming

```text
Issue: P01-01 — Make data validation inert
Branch: fix/p01-01-data-validation
Pull request: P01-01: reject array accessors without invoking getters
```

The identifiers in this roadmap are planning identifiers. They do not represent GitHub issues that have already been created.

### Work-item evidence template

Copy this into an issue, implementation note, or pull request:

```markdown
## Work item

- ID:
- Phase:
- Baseline commit:
- Scope:
- Dependencies:

## Acceptance criteria

- [ ] Required behavior is implemented.
- [ ] Relevant rejection and failure behavior is covered.
- [ ] Determinism, rollback, and compatibility checks are satisfied.
- [ ] Public examples and documentation match the implementation.

## Evidence

- Pull request:
- Implementation commit:
- Commands run:
- Observed results:
- Compatibility or migration impact:
- Known remaining limitations:

## Roadmap update

- Item status:
- Phase progress:
- Next item:
```

Only retain acceptance lines relevant to the work item. Add specific behavior from its **Done when** criterion; generic checklists alone are insufficient.

### Phase review record

| Phase | Started | Completed | Evidence / PRs | Remaining decisions |
| --- | --- | --- | --- | --- |
| 01 | October 17, 2026 | October 24, 2026 | [PRs #22, #24–#30](https://github.com/keepithandy/pulse-engine/pulls?q=is%3Apr+is%3Amerged+P01), [P01-08 engine quality](https://github.com/keepithandy/pulse-engine/actions/runs/40142052854), [P01-08 integrity](https://github.com/keepithandy/pulse-engine/actions/runs/40142052756) | Phase 01 gate complete; see Phase 02 for current progress. |
| 02 | October 24, 2026 | — | [P02-01 / PR #31](https://github.com/keepithandy/pulse-engine/pull/31), [implementation brief](implementation-briefs/P02-01-supported-api-inventory.md) | P02-01 complete; P02-02 is next; phase gate remains open. |
| 03 | — | — | — | — |
| 04 | — | — | — | — |
| 05 | — | — | — | — |
| 06 | — | — | — | — |
| 07 | — | — | — | — |
| 08 | — | — | — | — |
| 09 | — | — | — | — |
| 10 | — | — | — | — |
| 11 | — | — | — | — |
| 12 | — | — | — | — |
| 13 | — | — | — | — |
| 14 | — | — | — | — |

## Verification policy

Use the repository's existing gates as the baseline:

```sh
npm ci
npm run lint
npm test
npm run test:coverage
npm run check:package
npm run smoke
node .github/smoke/run-integrity.mjs
```

Run browser compatibility checks when browser-visible behavior, module loading, serialization, or host integration changes:

```sh
npx playwright install chromium webkit
node tools/browser-check.mjs
```

The default local browser script runs Chromium. Set `PULSE_BROWSER=webkit` in the host shell to exercise WebKit; Linux CI installs browser system dependencies with `--with-deps`. Keep the configured Node/OS/browser workflow matrix green.

As phases add replay, types, installed-consumer checks, migrations, adapters, and performance tooling, document their actual commands here. Proposed commands must not appear as runnable instructions until implemented.

### Required evidence by change type

| Change | Relevant evidence |
| --- | --- |
| Correctness fix | Focused regression, rejection atomicity, and existing behavior suite |
| Action or rule change | Accepted/rejected paths, trace behavior, event order, and deterministic fixture |
| World or component change | Schema validation, queries, references, batch atomicity, and save/restore |
| Scheduler or workflow change | Tick order, retry/cancellation, restoration, and replay equivalence |
| Save-format change | Previous-version fixtures, migration failure atomicity, and configuration compatibility |
| Public API or package change | Declarations/examples plus clean tarball-installed consumer |
| Browser or worker change | Browser compatibility plus direct/hosted equivalence and teardown |
| Performance change | Representative baseline, measured result, memory observations, and unchanged correctness fixtures |

The current coverage minimums are **80% lines**, **85% functions**, and **70% branches**. High coverage complements direct behavioral assertions; the reproduced findings show why percentage alone is insufficient.

## Scope and release controls

- Keep new optional modules opt-in and document their compatibility with the core.
- Treat worker adapters as execution hosts; multiplayer synchronization would require its own design and validation.
- Use explicit, bounded input and output formats for authoring tools and run recordings.
- Introduce new file formats with fixtures, version fields, and migration decisions.
- Keep benchmark targets provisional until workload data exists.
- Keep old issues and completed baseline work separate from the 100 new items.
- Mark deferred items visibly and revise release scope rather than marking unfinished work complete.
- Require an explicit release action for package publication. Roadmap completion itself does not publish anything.

## First implementation brief

This is the preserved implementation brief for **completed P01-01** (see [PR #22](https://github.com/keepithandy/pulse-engine/pull/22)). P02-01 is completed (see its [implementation brief](implementation-briefs/P02-01-supported-api-inventory.md)). The next unfinished item is **P02-02**, which needs its own scoped brief when work begins:

```text
Repository: keepithandy/pulse-engine
Roadmap: docs/PULSE-ENGINE-DEVELOPMENT-ROADMAP.md
Work item: P01-01 — Make data validation inert

Read the current implementation and repository instructions before changing code.
Confirm the baseline and re-check the review finding against the current branch.

Implement only P01-01 and any directly necessary compatibility documentation.
The current reviewed behavior accepts an accessor at an array index and invokes
its getter during validation/copying. Validate property descriptors before reading
array entries. Define supported sparse-array and property behavior explicitly,
using the package's JSON-safe save contract.

Add focused regression tests showing that rejected accessors are never invoked.
Check the affected public entry points and verify state/randomness/history remain
unchanged after rejection. Preserve supported plain-data behavior and verify save
roundtrips for the accepted representation.

Run the relevant repository checks and report exact commands and results.
Provide a reviewable pull request. Update the roadmap checkbox only after its
acceptance criteria are satisfied, and record the implementation evidence.
Do not begin P01-02 or other feature work as part of this change.
```

---

<div align="center">
  <p><strong>Build a trustworthy core. Prove it through real worlds. Ship a clear compatibility promise.</strong></p>
  <sub>This roadmap is a living plan. Its completion claims must always be backed by implementation evidence.</sub>
</div>
