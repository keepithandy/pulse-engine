# P01-06 — Complete lifecycle and failure contracts

## Scope

Define and enforce subscription cleanup, reads and writes after disposal, setup and
dispose failure behavior, observer errors, and the limits of engine rollback.

## Decisions

- Engine and event subscriptions are cleared when the engine is disposed; new
  subscriptions and mutations are rejected afterward, while state and checkpoint
  reads remain available.
- Setup failure keeps the original error and attempts best-effort cleanup in reverse
  initialization order. A dynamic registration is removed on setup failure.
- Unregister removes a plug-in before calling its cleanup hook. A cleanup error is
  returned to the caller and does not restore the plug-in.
- Full disposal attempts every plug-in cleanup in reverse dependency order, collects
  errors, and completes engine cleanup.
- Observer and plug-in errors after commit are reported without rolling committed
  engine state back. External side effects from user hooks cannot be reversed.

## Acceptance

Tests cover disposal reads/writes/subscriptions, failed initialization and dynamic
registration cleanup, disposal errors, observer failures, and failed unregister
cleanup. Engine contracts document the same observable behavior.