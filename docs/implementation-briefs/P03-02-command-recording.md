# P03-02 — Complete command recording

**Status:** implementation for PR review (October 28, 2026).

P03-01 merged in PR #41 at `7c8a1d2`, including initial-pause and command-kind review fixes. This work adds capture; replay execution remains P03-03.

## Decisions

1. Use `engine.startRecording` at public engine boundaries, including saved method references.
2. Capture one external invocation and outcome; leave internal ticks and scheduled work inside that command.
3. Capture the full checkpoint and real pause flag independently of diagnostics.
4. Offer status, stop and complete retained-record access, with one session per engine.
5. Support synchronous start/command/end streaming without retaining command history.
6. Reject configuration changes, restore/import and disposal until recording stops.
7. Fail before unrepresentable inputs execute. Sink failure makes the session incomplete and blocks further mutations until stop; already committed engine work is preserved.
8. Preserve public results and original exceptions when capture succeeds; if both execution and capture throw, retain the original exception and failed status.

## Verification focus

Initial pause, immutable inputs, aliases, accepted/rejected/error outcomes, partial advances, scheduled-work deduplication, bounded event history, streaming counts and zero retention, start/command/end sink failures, asynchronous sinks, callback reentrancy, blocked migration/configuration callbacks and independent later sessions.

Browser, installed JavaScript consumer and strict TypeScript fixtures exercise the public API. The roadmap marks P03-01 complete and keeps P03-02 open until review, verification and merge.
