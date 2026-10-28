# Executable Pulse Engine examples

Run from the repository checkout on Node 22+ using `node examples/dispatch.mjs` (or any other script below). Each example imports the **public package root**, not an internal source file, and prints one deterministic JSON line.

| Example | Contract demonstrated |
| --- | --- |
| `dispatch.mjs` | Synchronous actions and committed state |
| `rules.mjs` | Rule conditions and explicit rejection |
| `world.mjs` | World entity creation, queries, detached reads |
| `schedules.mjs` | Scheduled actions on explicit ticks |
| `saves.mjs` | Export/import round-trip of revision and state |
| `inspection.mjs` | Diagnostic inspection and action traces |

`npm test` executes all six scripts as separate processes and verifies their exact JSON output. These examples are intentionally small and do not define persistent game content or balance.
