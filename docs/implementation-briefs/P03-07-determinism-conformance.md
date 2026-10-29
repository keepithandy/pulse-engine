# P03-07 — Versioned determinism conformance suite

**Status:** proposed, implementation not started  
**Dependencies:** P03-01 through P03-06; the initial fixtures can be developed progressively against already-merged features.  
**Purpose:** ensure two supported runtimes running the same engine configuration and external inputs produce equal outcomes.

## Fixture manifest

Store reviewed manifest(s) under `fixtures/determinism/v1/` including `fixtureVersion`, engine/package version, fixture id, seed, configurationId, input replay file, starting checkpoint, expected command outcomes, expected final checkpoint digest, and a concise description. Snapshots and commands remain separate from expected results to prevent accidental self-confirmation.

Initial scenarios:
- **Baseline:** seeded actions without schedules, historical event journal and ordinary rejection.
- **Scheduler:** queued jobs at equal tick, cancellation, repeat/limit, paused advance, manual step, and restore from pending jobs.
- **Branching:** fork/restore with distinct branch identity and identical replay on the same branch.
- **World:** create, set/remove components and destroy; adversarial IDs and JSON-safe nested values.
- **Randomness:** default generator, interleaved independent named streams (only after P03-06).
- **Corrupt data:** invalid replay format, mismatched configuration, tampered digest, inaccessible hook configuration, and rejected mutation with unchanged checkpoint.
- **Serialization:** nested Unicode keys, arrays, safe number boundaries and differing object insertion orders.

## Harness and CI rules

1. Provide one public-package-root fixture runner with no private deep imports, no DOM dependency and no wall-clock simulation time.
2. Compare final snapshots at the declared contract granularity (revision, tick, state, event sequencing, scheduler, PRNG); compare versioned canonical digests once P03-04 merges.
3. Run the same named fixtures against Node 22 and 24 on Linux, Windows and macOS, plus browser Chromium/WebKit using existing jobs.
4. Pin golden expected outputs to explicit versioned files. Intentional changes require a separate visible golden-update diff and a documented compatibility reason.
5. Treat PR changes to replay schema, serializers, PRNG algorithms and scheduler semantics as high-signal: run targeted fixtures before general tests, then lint, coverage, package integrity, types and smoke.
6. Keep fixture iteration budget bounded. Do not add unbounded event capture, production telemetry or unusually large CI artifacts.

## Acceptance and anti-false-positive checks

- Every supported runtime obtains byte-identical canonical digest for each compatible expected run, after normalizing only the intentionally excluded presentation metadata.
- Flip one bit in an expected digest, drop one recorded external command, duplicate a scheduled action, and alter a plugin order: each deliberate corruption must fail with a meaningful message.
- Prove that the fixture harness uses the **installed tarball** in at least one isolated consumer to catch private-path imports.
- Record a reproducible command for developers to run one fixture locally and identify which phase contract failed.

## Milestone

Milestone B (reproducible core) is not complete until the replay executor, digests, diagnostics, stream compatibility, and the full conformance evidence pass. Keep this PR draft until implementation/test evidence is attached. No roadmap checkbox is closed on planning alone.
