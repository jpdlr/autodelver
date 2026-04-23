# Roadmap

Milestones are outcome-defined, not date-defined. Each one ends with a playable build and a decision: continue, pivot, or shelve.

## M0 — Skeleton (est. 1–2 days)

**Goal:** Vite + TS + Vitest repo boots, renders a grid, has a ticking game loop.

- [ ] Vite + React + TS scaffold
- [ ] Token-based theme (light/dark via CSS vars)
- [ ] Grid canvas renderer (flat colored tiles, no sprites yet)
- [ ] Tick loop with speed controls (1×/4×/pause)
- [ ] Vitest + RTL set up; one smoke test per module
- [ ] One "walker" entity that moves in a straight line

**Exit criterion:** Open the app, see a tile walk across a grid at 6 ticks/sec. Tests green.

## M1 — Sandbox (est. 3–5 days)

**Goal:** Prove the scripting core works end-to-end.

- [ ] Monaco editor integration
- [ ] Web Worker sandbox with structured-clone messaging
- [ ] Per-tick CPU budget with timeout enforcement
- [ ] Minimal Context API: `ctx.self`, `ctx.move`, `ctx.scan.nearest`
- [ ] Error capture → surfaced in a log panel with line numbers
- [ ] A single delver runs a user-written script against a single room

**Exit criterion:** Type `ctx.move({x: ctx.self.pos.x + 1, y: ctx.self.pos.y})` in the editor, hit deploy, watch the delver walk right.

**Risk:** Worker messaging latency at 6 ticks/sec. Fallback: drop to 3 tps or batch state snapshots.

## M2 — Vertical Slice (est. 1–2 weeks)

**Goal:** Full loop playable with one class.

- [ ] Warrior class: HP, attack, melee combat
- [ ] 3-floor procedural dungeon (BSP)
- [ ] Basic enemy (dumb pathfinder)
- [ ] Death → post-mortem screen with last-tick state
- [ ] "Descend again" loop with permanent XP
- [ ] One API unlock (`ctx.memory`) gated behind killing floor-3 boss

**Exit criterion:** Playable from "open app" → "die" → "unlock" → "descend again" → "die deeper." Fun enough that I want to play a 4th run unprompted.

**Playtest gate:** 3 outside testers. If none finish a second run, pivot.

## M3 — The Party (est. 2–3 weeks)

**Goal:** Multi-delver coordination becomes the game.

- [ ] 2nd and 3rd classes (Ranger, Cleric)
- [ ] `ctx.party` snapshot API
- [ ] `ctx.signal` / `ctx.on` primitives
- [ ] Party deployment UI (assign scripts to 3 slots)
- [ ] Revive mechanic
- [ ] 10-floor dungeon with mid-run shrine

**Exit criterion:** A thoughtful player can build a healer script that pre-heals based on tank signals, and it *works*.

## M4 — Idle (est. 1 week)

**Goal:** The "close the tab" fantasy.

- [ ] Offline progress calculation (capped at 8h)
- [ ] Auto-descend on party wipe (same script, reset run)
- [ ] Daily seed mode
- [ ] Run history / replay scrubbing

**Exit criterion:** Leave it running overnight, wake up to meaningful progress + a replay worth scrubbing.

## M5 — Depth (est. 3–4 weeks)

**Goal:** Enough content that the roguelite loop sustains.

- [ ] 2 more classes (Rogue, Artificer)
- [ ] Full API unlock tree (Tier 0 → Tier 3)
- [ ] Stdlib module system with importable helpers
- [ ] Custom module slots (player-authored helpers)
- [ ] Boss variety (5+ distinct encounter scripts)
- [ ] Meta-currency shop

**Exit criterion:** A fresh player has >20 hours of new-content discovery ahead of them.

## M6 — Public (est. 2 weeks)

**Goal:** Shippable.

- [ ] Onboarding / tutorial (3 guided scripts)
- [ ] In-game API reference (filterable by unlocked)
- [ ] Script sharing (export/import as gist)
- [ ] CI (GitHub Actions): typecheck, test, build
- [ ] Landing page
- [ ] Licence + code of conduct

**Exit criterion:** Public GitHub repo under `jpdlr/autodelver`, playable build deployed, one friend plays it unprompted and sends a screenshot.

## Post-1.0 candidates (not committed)

- Leaderboards for daily seeds
- Community challenges ("deepest run with <20 LOC")
- Mobile-responsive editor
- Steam / Electron wrapper
- Multiplayer raid mode (two programmers, one party)
- Mod API for custom dungeon generators

## Cut list (things I've already decided against)

- **Full visual programming / blocks** — breaks "code is the verb."
- **Twitch combat controls** — fights the idle fantasy.
- **Persistent shared world (Screeps-style)** — not a single-dev scope.
- **Monetisation** — this is a portfolio project, not a business.
