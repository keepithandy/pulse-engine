# Pulse Engine documentation

Start here to use the pre-alpha simulation engine without reading its internals.

| Need | Page |
| --- | --- |
| Install and run a first scenario | [Getting started](getting-started.md) |
| Look up public imports, arguments and return values | [Public API reference](public-api.md) |
| Type-check a host application | [TypeScript consumers](typescript.md) |
| Handle failure categories and machine-readable codes | [Structured errors](errors.md) |
| Specify deterministic replay input records | [Replay format](replay-format.md) |
| Reproduce an external-command history | [Replay execution](replay-execution.md) |
| Compare portable checkpoint fingerprints | [Canonical checkpoint digests](checkpoint-digests.md) |
| Capture complete histories or stream recordings | [Recording](recording.md) |
| Resolve common runtime, CLI and save problems | [Troubleshooting](troubleshooting.md) |
| Understand versioning and upgrades | [Compatibility](compatibility.md) |
| Understand atomic operations and lifecycle constraints | [Engine contracts](engine-contracts.md) |
| Follow milestones and work items | [Development roadmap](PULSE-ENGINE-DEVELOPMENT-ROADMAP.md) |
| Explore runnable sample programs | [Executable examples](../examples/README.md) |

This project is pre-alpha. Type declarations aid development but cannot prove that runtime state is JSON-safe or compatible with previously saved data.
