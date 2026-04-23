# UX

## Screen inventory

1. **Home** — roster, meta-progression summary, "Descend" CTA.
2. **Loadout** — assign class/script/gear to each delver slot.
3. **Editor** — Monaco, API reference sidebar, per-delver tabs.
4. **Run** — grid view + combat log + speed controls + live script view.
5. **Post-mortem** — replay scrubber, cause-of-death, unlocks earned.
6. **Library** — stdlib modules, custom modules, shared scripts.
7. **Settings** — theme, telemetry opt-in, tick rate preferences, keybinds.

## Layout principles

- **Editor-forward.** Even on the Run screen, the script stays visible (read-only) alongside the grid — the player should never lose sight of the code their party is executing.
- **MD3 cards, neutral palette.** Surfaces layered via elevation tokens. No loud accents. Light default, dark secondary.
- **Monospace where it matters.** Editor, logs, API reference. Sans-serif for chrome.
- **Keyboard-first.** Space = pause, `.` = step tick, `[` / `]` = speed down/up, ⌘K = command palette for API lookup.

## The Editor

Three-pane layout:

```
┌──────────────┬────────────────────────────────┬────────────────┐
│  Delvers     │                                │  API           │
│              │        Monaco editor           │  Reference     │
│  ▸ Grimm     │                                │                │
│    Warrior   │     function tick(ctx) {       │  Tier 0 ✓      │
│              │       // ...                   │  Tier 1 ✓      │
│  ▸ Vex       │     }                          │  Tier 2 🔒     │
│    Ranger    │                                │                │
│              │                                │  ctx.self      │
│  ▸ Mira      │                                │  ctx.move      │
│    Cleric    │                                │  ...           │
│              │                                │                │
└──────────────┴────────────────────────────────┴────────────────┘
```

- Tabs for each delver. Unsaved-change dots.
- API panel filters to only what's unlocked by default; toggle "show locked" to preview goals.
- Inline diagnostics from the type checker (we ship `.d.ts` for the Context API).

## The Run view

```
┌────────────────────────────────────┬─────────────────────────────┐
│                                    │  tick 0412                  │
│                                    │  ───────────────────────    │
│         [ grid view ]              │  Grimm: attack goblin (8)   │
│                                    │  Vex: volley @ (4,7)        │
│                                    │  Mira: heal Grimm (+12)     │
│                                    │  goblin dies                │
│                                    │                             │
│                                    ├─────────────────────────────┤
│                                    │  Grimm.ts (read-only)       │
│                                    │                             │
│                                    │  function tick(ctx) {       │
│                                    │    if (ctx.self.hp < 40)    │
│                                    │      return ctx.retreat();  │
│                                    │    ...                      │
│                                    │                             │
├────────────────────────────────────┴─────────────────────────────┤
│  ⏸ ▶  1× 4× 16×   step ›   depth 3   tick 412   pause to edit   │
└──────────────────────────────────────────────────────────────────┘
```

- **Current tick's line is highlighted** in each delver's read-only script view — the code you wrote *is* the animation.
- Combat log is filterable by delver and severity (info/action/error).
- Grid supports hover-to-inspect any entity (shows their class, HP, last action).

## Post-mortem

- Big, blunt header: **"Grimm fell at depth 7, tick 2,841."**
- Replay scrubber across the bottom. Drag to any tick; grid + log + script pointer all sync.
- Cause-of-death card: last damage source, HP history sparkline, script line that ran that tick.
- Unlocks earned: list of new API/stdlib/cosmetic items with links to try them.
- CTAs: "Edit scripts" / "Descend again" / "View replay."

## Theming

- CSS variables in `src/ui/theme/tokens.ts`: colour, type, spacing, radius, elevation.
- Two themes shipped: `light` (default) and `dark`. Runtime switch via `[data-theme]` on `<html>`.
- Neutral palette: stone/graphite greys, ink-dark text, a single muted accent (default: desaturated amber) used sparingly for CTAs and the active-tick highlight.
- Typography: Inter for chrome, JetBrains Mono for code/logs. Licensed/bundled.

## Onboarding

A three-script tutorial disguised as the first three runs:

1. **Run 1 — "Move."** Pre-written script; player's only edit is changing the target. Teaches the edit → descend → observe loop.
2. **Run 2 — "Fight."** Player adds an `if (enemy) ctx.attack(enemy)` branch. Teaches conditionals + scan.
3. **Run 3 — "Survive."** Player adds an HP check and a retreat. Teaches state awareness.

After run 3, the tutorial scaffolding falls away and the real game begins.

## Accessibility

- Full keyboard navigation.
- Log panel is a proper `role="log"` with `aria-live="polite"`.
- Colourblind-safe palette: enemies/allies distinguished by shape + colour, never colour alone.
- Editor respects system-level reduced-motion for the active-tick highlight animation.
- Adjustable tick rate doubles as an accessibility lever (slow down, don't dumb down).
