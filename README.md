# AutoDelver: Party Protocol

> A roguelite idler where you don't play the heroes — you **code** them.

You're a necromancer-programmer. Your party of delvers descends an infinite procedural dungeon on their own, each driven by a short `tick(ctx)` script you write in-game. Watch them thrive. Watch them die to a null reference. Patch the bug. Descend deeper.

**Core fantasy:** the joy of watching a system you built actually work — and the grim comedy of watching it fail in ways you didn't predict.

## Status

**Playable MVP.** The core loop — write → deploy → observe → die → unlock → iterate — is implemented end-to-end with one floor, combat, party of three (Warrior, Ranger, Cleric), a live Monaco editor with autocomplete on `ctx.*`, a Web Worker sandbox per delver, procedural enemies, persistent meta-progression, and light/dark theming.

Roadmap milestones M3–M6 (party signals, full unlock tree, offline progress, onboarding) are next — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

### Other scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production bundle into `dist/` |
| `npm run check` | `svelte-check` type pass |
| `npm test` | Run Vitest unit tests (engine core) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run preview` | Serve the production build locally |

## Writing a delver script

Every delver has a tab in the script editor. Your script must export a `tick(ctx)` function:

```js
function tick(ctx) {
  // Escape condition — on stairs? descend.
  if (ctx.self.pos.x === ctx.stairs.x && ctx.self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }
  // Panic — retreat if badly hurt
  if (ctx.self.hp < 10) return { type: 'retreat' };

  // Find nearest enemy
  let nearest = null, best = Infinity;
  for (const e of ctx.enemies) {
    const d = Math.abs(e.pos.x - ctx.self.pos.x) + Math.abs(e.pos.y - ctx.self.pos.y);
    if (d < best) { best = d; nearest = e; }
  }
  if (nearest && best <= 1) return { type: 'attack', target: nearest.id };
  if (nearest) return { type: 'move', target: nearest.pos };
  return { type: 'move', target: ctx.stairs };
}
```

Autocomplete is live — type `ctx.` in the editor and the game's API surface is fully documented inline.

## Architecture

```
src/
├── engine/       # pure TS: rng, grid, pathfind, dungeon, combat, tick, world
├── sandbox/      # per-delver Web Worker + Context API snapshots
├── ui/           # Svelte components, screens, theme
├── assets/       # procedural SVG generators (enemies, etc.)
├── persistence/  # localStorage for meta + scripts
├── stores/       # game store (Svelte 5 runes)
└── test/         # vitest setup
```

See [`docs/`](docs/) for the design docs (concept, mechanics, design loop, stack, assets, architecture, UX).

## Stack

**Svelte 5 + Vite + TypeScript**, Monaco editor, Canvas 2D rendering, Web Workers for the sandbox, Vitest for tests. No server, no accounts — everything runs client-side.

## License

MIT — see [`LICENSE`](LICENSE). Third-party attributions in [`LICENSES.md`](LICENSES.md).
