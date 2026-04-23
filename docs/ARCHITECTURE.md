# Architecture

## Layers

```
 ┌──────────────────────────────────────────────────────┐
 │  UI  (React, Monaco, canvas renderer)                │
 ├──────────────────────────────────────────────────────┤
 │  Game Engine  (tick loop, world state, combat)       │
 ├──────────────────────────────────────────────────────┤
 │  Sandbox Host  (Worker pool, API bridge, timeouts)   │
 ├──────────────────────────────────────────────────────┤
 │  Persistence  (localStorage + IndexedDB for replays) │
 └──────────────────────────────────────────────────────┘
```

Strict one-way dependency: UI → Engine → Sandbox. No upward imports.

## Game engine

- **Pure and deterministic.** Given a seed and a list of scripts, a run's outcome is reproducible.
- **Immutable state snapshots per tick.** Cheap structural sharing via a tiny in-house immutable grid; no external state lib needed at this scale.
- **Event log is the source of truth for replays.** State can be re-derived from `(seed, scripts, events[])`.
- **No `Math.random()`** anywhere in engine code. A seeded PRNG (`sfc32` or `mulberry32`) is injected.

## Sandbox

- **One Web Worker per delver.** Isolation is cheap and gives us per-delver CPU accounting.
- **Bridge protocol:** `postMessage` with structured cloning, one round-trip per tick per delver.
  - Host → Worker: `{ type: 'tick', ctx: <frozen snapshot> }`
  - Worker → Host: `{ type: 'action', action: <serializable> } | { type: 'error', ... }`
- **Timeout enforcement:** `setTimeout(killWorker, budget)` racing the response. On timeout, worker is terminated and restarted with fresh `onDeploy`. Logged as a budget miss.
- **Forbidden globals:** the worker entry shim deletes `fetch`, `XMLHttpRequest`, `importScripts`, `WebSocket`, etc., and freezes `globalThis` before the user script runs.
- **User script loading:** compiled via `esbuild-wasm` to strip TS types and basic-lint, then passed to the worker as a `Blob` URL. No string `eval` on the main thread.

## API bridge

The `ctx` object seen by user code is **not** a reference — it's a frozen snapshot serialized per tick. User mutations to it are ignored. Action requests (`ctx.move(...)`) are implemented as thin functions that push onto a per-tick action queue; that queue is returned to the host at end-of-tick.

Pseudocode shape inside the worker:

```ts
let actions: Action[] = [];
const ctx = makeCtxSnapshot(state, (a) => actions.push(a));
userTick(ctx);
postMessage({ type: 'actions', actions });
```

## State model

```
World
├── seed: string
├── depth: number
├── tick: number
├── grid: Grid (tiles + fog)
├── entities: Map<EntityId, Entity>
│   ├── Delver (scriptId, hp, mp, pos, inventory, memory)
│   ├── Enemy (ai profile, hp, pos)
│   └── Prop (chests, doors, traps)
├── signals: Signal[] (delivered next tick)
└── eventLog: Event[] (append-only)
```

## Persistence

- **`localStorage`:** settings, theme, meta-progression (unlocks, currency, class roster).
- **IndexedDB:** run replays (seed + scripts + events). LRU-capped at ~50 runs.
- **No server.** Everything local. Export/import as JSON for sharing.

## Determinism & replays

- Replays store `{ seed, scripts, events }`. Playback re-runs the engine and compares — if divergence, we have a bug.
- CI runs a "golden replay" test: a recorded script + seed must produce the same final state across commits.

## Testing strategy

- **Unit:** PRNG, pathfinder, combat math, grid ops.
- **Engine:** given a seed + scripted inputs, assert tick-by-tick state matches fixtures.
- **Sandbox:** spin up a real Worker, send a malicious script (`while(true){}`, attempts to `fetch`), assert timeout / no network access.
- **Component:** Monaco mount, log panel rendering, speed controls.
- **Integration / "golden run":** deterministic script + seed → expected depth reached within 1 tick of expected.

## File layout (planned)

```
autodelver/
├── src/
│   ├── engine/         # pure, no DOM
│   │   ├── world.ts
│   │   ├── tick.ts
│   │   ├── combat.ts
│   │   ├── rng.ts
│   │   └── dungeon.ts
│   ├── sandbox/
│   │   ├── host.ts     # main-thread side
│   │   ├── worker.ts   # in-worker entry shim
│   │   └── ctx.ts      # snapshot factory
│   ├── ui/
│   │   ├── App.tsx
│   │   ├── GridCanvas.tsx
│   │   ├── Editor.tsx
│   │   ├── LogPanel.tsx
│   │   └── theme/
│   ├── persistence/
│   ├── config/
│   │   └── flags.ts
│   └── test/
├── docs/               # this folder
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```
