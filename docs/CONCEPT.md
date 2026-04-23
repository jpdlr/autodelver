# Concept

## One-line pitch

A roguelite idler where you write short JavaScript scripts to control a party of delvers, then watch them descend an infinite dungeon — failure is a bug report, progress is better code.

## Design pillars

1. **Code is the verb.** The player's input is primarily a script, not a click. Every mechanic should make scripting richer, not bypass it.
2. **Failure is legible.** When a delver dies, the player should be able to point at a specific line and say "that's the bug." Opaque deaths kill the loop.
3. **Emergent coordination.** A single delver is a puzzle. A *party* is a distributed-systems puzzle. The game's depth comes from scripts that compose.
4. **Idle-respectful.** The game tolerates absence — offline progress is real, but active iteration is always strictly better. Never punish presence.
5. **Readable by default.** New players should be able to read a sample script and broadly understand it within 30 seconds. No ceremony.

## Core fantasy

You are not a hero. You are the **author** of heroes. The power fantasy is:

- Writing a 20-line script, hitting "Descend," and watching your party flawlessly execute a dungeon you couldn't solve manually.
- The moment your `signal`/`on` coordination protocol actually fires and the healer pre-heals the tank before the hit lands.
- Reading a post-mortem that says *"Ranger died at depth 14, tick 4,402 — `ctx.scan.nearest('enemy')` returned undefined because the enemy despawned mid-tick"* and thinking *"ah, I need a null check there."*

## The core loop

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │  1. WRITE    │──▶│  2. DEPLOY   │──▶│  3. OBSERVE  │──▶│  4. DIAGNOSE │
 │  scripts     │   │  descend     │   │  live run    │   │  post-mortem │
 └──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
        ▲                                                         │
        │                                                         │
        └──────────────────── 5. UNLOCK / REWRITE ◀───────────────┘
```

1. **Write** — Each delver gets their own script in a Monaco tab. ~10–30 lines.
2. **Deploy** — "Descend" starts the run. Party enters the dungeon on a fresh seed (or a saved seed for comparison runs).
3. **Observe** — Real-time grid view, adjustable tick speed (1× / 4× / 16× / pause / step). Combat log streams beside.
4. **Diagnose** — On death or extraction, a replay viewer lets the player scrub to any tick and see state + which line of each script ran.
5. **Unlock / Rewrite** — Gains (XP, API unlocks, stdlib modules, gear slots) feed back into the next script iteration.

## Session shapes

- **Active (5–30 min):** Write, descend, die, patch, descend again. Iteration-driven.
- **Idle (hours–days):** Let a known-good script farm depth. Offline progress capped at 8h to preserve iteration incentive.
- **Challenge (variable):** Daily seed with a leaderboard based on depth reached per-line-of-code.

## What this game is NOT

- **Not a code-golf puzzler.** Lines of code aren't the enemy; fragility is. Verbose-but-robust should often beat terse-but-clever.
- **Not a real programming tutorial.** We assume familiarity with JS syntax. Onboarding teaches the *API*, not the language.
- **Not twitch-action.** The tick rate is deliberately slow enough to read. Speed-ups are for confidence runs, not skill expression.
- **Not a Screeps clone.** Screeps is an MMO with persistent shared world; AutoDelver is single-player, narrative-shaped, short-run.

## Antipatterns to avoid

- **Opaque RNG deaths.** Every death must be attributable to a scriptable decision or a stated probability.
- **Scripting-as-chore.** If the "optimal" script converges to a single shape, we've failed. Unlocks should open new *strategies*, not just bigger numbers.
- **Hidden APIs.** Everything the player can do is visible in an in-game reference, filterable by what they've unlocked.
- **Punishing the writer.** Tick budgets exist, but the editor should never feel like a shackle. Start generous, tighten only as a meta-upgrade target.

## Tone

Dry, mechanical, slightly gothic. Flavor text reads like stack traces from a haunted IDE. The UI is minimal, monospaced-leaning, with MD3 card layouts in a neutral palette — light mode default, dark mode as the atmosphere-forward alternative.
