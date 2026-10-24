# P01-05 — Specify tick phase ordering

## Decision

Plug-ins remain dependency ordered. During a tick, each plug-in runs its
`beforeTick` hook immediately before its `onAction` hook for `@pulse/tick`.
The engine continues to commit state and events only after every hook and rule
accepts. A rejection stops later hooks and commits no engine state, event,
revision, or tick changes.

## Compatibility

This records the existing interleaved behavior. It does not reorder plug-in hooks
or change the later `afterTick` and scheduled-action phases.

## Acceptance

A two-plug-in regression locks down hook order, emitted event order, rejection
short-circuiting, and rollback. The engine contract describes hook-owned external
side effects as outside engine rollback.