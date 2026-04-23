# Stack

## Decision: Svelte 5

AutoDelver is built on **Svelte 5 + SvelteKit + TypeScript**, not React. The game chrome is minimal, the reactivity model matters more than ecosystem breadth, and the only place where React had a genuine edge (Monaco) is a bounded one-time integration cost.

### Why Svelte over React

- **Runes > hooks** for the engine-pushes-snapshots-to-UI pattern. No `useMemo`/`useCallback`/stale-closure gymnastics.
- **~0 runtime** — matters when we're already shipping Monaco (~3MB) and esbuild-wasm (~3MB). Every KB on first paint counts.
- **Fine-grained reactivity** — grid metadata and log streams update frequently; Svelte re-renders only what changed without selector ceremony.
- **Tauri pairing** — if we ever go native, Svelte + Tauri is a cleaner story than React.

### Why not Unity, Phaser, or other game frameworks

- The "engine" is integer math on a grid. Scene graphs, physics engines, and asset pipelines are overhead we'd pay for and never use.
- **Monaco in Unity = pain.** The editor is the centerpiece of this game; the web gives it to us for free.
- **User-script sandboxing in Unity = very hard.** Web Workers solve it in ~40 lines.

## The full stack

| Layer | Pick | Notes |
|---|---|---|
| Build | **Vite** (via SvelteKit) | Worker + WASM bundling first-class |
| Framework | **Svelte 5** + **SvelteKit** | Runes-based reactivity |
| Language | **TypeScript (strict)** | Non-negotiable — Context API types ship to players |
| State | **Svelte stores + runes** | No Zustand/Redux needed |
| Editor | **Monaco** via hand-rolled Svelte wrapper | ~150 LOC glue; see `ARCHITECTURE.md` |
| Grid render | **Canvas 2D** (MVP) → **PixiJS** if needed | Never JSX/SVG for the grid |
| Sandbox | **Web Worker per delver** | Isolation + CPU accounting |
| TS → JS | **esbuild-wasm** | Client-side, lazy-loaded, cached in SW |
| PRNG | **`sfc32`** (~10 LOC) | Replay determinism |
| Pathfinding | Hand-rolled **A*** (~60 LOC) | Deterministic, no deps |
| Persistence | **localStorage** + **IndexedDB via `idb`** | No server |
| Styling | **CSS variables + Svelte `<style>`** | Scoped by default; theming via `[data-theme]` |
| Icons | **`phosphor-svelte`** | Chrome only — not gameplay |
| Testing | **Vitest** + **`@testing-library/svelte`** + **Playwright** | RTL-equivalent; Playwright for real-Worker smoke tests |
| CI | **GitHub Actions** | Typecheck + test + build on PR |
| Deploy | **Cloudflare Pages** | Static SPA, edge-cached |

## Monaco integration plan

The one genuine cost of picking Svelte. Mitigation:

1. **Thin wrapper component** (`src/ui/MonacoEditor.svelte`) — lifecycle, resize observer, theme sync.
2. **Worker config** — Monaco needs its own workers (TS language service, JSON, CSS). Configure via Vite's worker imports, not Monaco's default CDN loader.
3. **Type definitions** — ship `ctx.d.ts` as a string, inject via `monaco.languages.typescript.typescriptDefaults.addExtraLib()`. Player gets full autocomplete on `ctx.*`.

Estimated effort: 1 day including Vite worker config quirks. Bounded, one-time.

## What we explicitly skipped

- **Tailwind** — fights the MD3 token system.
- **Component libs** (Skeleton, Flowbite) — chrome is small and bespoke.
- **Zod / Valibot** — engine is internal; types are enough.
- **tRPC / React Query** — no server.
- **Storybook** — defer until post-MVP.
- **SSR** — single-player game, client-only. SvelteKit in SPA mode.

## Open questions

- **Pixi vs. Canvas 2D:** Start Canvas 2D. Upgrade to Pixi if we want particles, shaders, or depth > 30 floor performance becomes an issue.
- **Worker pool sizing:** One-per-delver (up to 5) or a shared pool? Start one-per-delver for isolation clarity; revisit if `postMessage` overhead shows up in profiling.
