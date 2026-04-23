# Assets

How AutoDelver gets its visual identity — automated wherever possible.

## Principles

1. **CC0 or MIT only.** No "free but attribution required" surprises that become licensing headaches.
2. **Automate the pipeline.** A script downloads, slices, and optimizes source assets. Re-running it from scratch is a one-command operation.
3. **Procedural where it adds identity.** For enemies, delvers, and dungeon variation, code-generated SVGs give the game a unique look *and* fit the coding-themed fantasy.
4. **No AI-generated images.** Clashes with tone, licensing murky, and undermines the "hand-built" feel of a roguelite.

## Asset budget

| Category | Source | Count | Format |
|---|---|---|---|
| Dungeon tiles | Kenney (Tiny Dungeon / 1-Bit) | ~40 | PNG atlas → sprite sheet |
| UI icons | Phosphor | ~20 used | Inline SVG via `phosphor-svelte` |
| Enemies | Procedural SVG | ∞ variants from ~8 archetypes | Generated at runtime |
| Delver portraits | Procedural SVG | Unique per delver | Generated from `hash(name + class)` |
| Item icons | Kenney + recolor pipeline | ~60 | SVG |
| Key art / logo | Hand-written SVG | ~5 pieces | Inline SVG |
| Fonts | JetBrains Mono + Inter | 2 | WOFF2, self-hosted |
| SFX (v1) | **deferred** — Kenney audio packs later | — | — |

## Pipeline

```
scripts/fetch-assets.ts
  ├── download Kenney packs (zip → unzip → atlas slice)
  ├── optimize PNGs (oxipng)
  ├── convert selected icons to SVG where useful
  ├── strip unused sprites (keep only referenced in manifest)
  └── emit src/assets/atlases/*.{png,json}
```

Run with `npm run assets`. Outputs are checked into the repo (small) so fresh clones don't need to re-download.

## Source 1: Kenney.nl — primary sprite source

All packs CC0 public domain. Packs we'll use:

- **Tiny Dungeon** — core dungeon tileset (floors, walls, doors, stairs, chests, 16×16)
- **1-Bit Pack** — monochrome tiny sprites, fits the gothic-terminal aesthetic
- **Micro Roguelike** — enemies, items, effects
- **UI Pack** — buttons, panels, cursors (fallback only; we mostly use custom SVG)

Downloaded once via `scripts/fetch-assets.ts`, sliced into a single atlas per pack.

**Styling:** we recolor at runtime via a tinting shader (Canvas `globalCompositeOperation: 'source-atop'` for MVP). This lets themes (light/dark) drive sprite palette without duplicating assets.

## Source 2: Phosphor Icons — UI chrome

- `phosphor-svelte` package. MIT.
- Used for editor toolbar, menu affordances, status pills, speed controls.
- NEVER used for gameplay entities — mixing icon styles with sprites looks cheap.

## Source 3: Procedural SVG — the identity layer

This is where AutoDelver earns its look. Three procedural systems:

### 3a. Enemy sprites

Each enemy has an archetype (`slime`, `goblin`, `wraith`, `construct`, ...) and a seed derived from `(depth, spawnIndex)`. A generator function composes SVG primitives:

```ts
function generateEnemy(archetype: Archetype, seed: number): SVGElement {
  const rng = sfc32(seed);
  const eyes = pick(rng, [1, 2, 2, 2, 3, 4]);   // 2 is common, 4 is rare
  const limbs = pick(rng, [2, 4, 6, 8]);
  const glitch = rng() < depth * 0.01;           // deeper = more corrupted
  return composeSVG(archetypes[archetype], { eyes, limbs, glitch });
}
```

Deeper floors introduce "corruption" — intentional SVG render glitches, path distortion, color bleed — reinforcing the "you are in a haunted system" theme.

### 3b. Delver portraits

Hash `(name, class)` → deterministic silhouette + palette. Same delver always looks the same; different names = visually different heroes. Lightweight — 3 layers (silhouette, accent, eyes) composited.

### 3c. Dungeon tile variation

Base tile from Kenney + a procedural overlay per tile position. Prevents the "perfectly tiled grid" look without drawing 20 variants by hand.

## Source 4: Hand-written SVG — key art

I write these directly as SVG files in `src/assets/keyart/`:

- `logo.svg` — wordmark, gothic-mechanical
- `sigil.svg` — the necromancer-programmer symbol (used on post-mortem screen)
- `gravestone.svg` — post-mortem decoration, stylized stack-trace engraving
- `shrine.svg` — shrine room illustration
- `title-frame.svg` — UI frame flourishes

Estimated ~500 lines of SVG total across all key art.

## Fonts

- **JetBrains Mono** (Apache 2.0) — code, logs, grid coordinates, API reference
- **Inter** (SIL OFL) — chrome, menus, button labels

Both self-hosted as WOFF2 in `src/assets/fonts/`. No Google Fonts / external CDN.

## Theming and color

All sprite tinting, UI color, and procedural-SVG palettes pull from the single token source in `src/ui/theme/tokens.ts`. Swapping themes retints everything — no per-theme asset duplication.

MVP palettes:
- **Light (default):** stone greys, ink text, muted amber accent
- **Dark:** graphite backgrounds, bone-white text, rusted-copper accent

## What happens when we need something Kenney doesn't have

In order of preference:
1. **Check if it can be procedural.** Most unique enemies and variants should be.
2. **Compose from existing sprites.** Layering + tinting covers a lot.
3. **Hand-draw an SVG.** For key pieces only.
4. **Commission an artist** (post-1.0, if the game has legs).

## Licensing summary

| Asset | License | Attribution required? |
|---|---|---|
| Kenney packs | CC0 | No (we credit anyway in README) |
| Phosphor Icons | MIT | Yes — in `LICENSES.md` |
| JetBrains Mono | Apache 2.0 | Yes — in `LICENSES.md` |
| Inter | SIL OFL | Yes — in `LICENSES.md` |
| Procedural SVG | (ours) | n/a |
| Key art | (ours) | n/a |

A `LICENSES.md` file ships at repo root with the full attributions.
