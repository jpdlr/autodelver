# Mechanics

## Tick model

- The world advances in **ticks**. Default rate: 6 ticks/sec (adjustable 1×/4×/16×/pause/step).
- Every tick, each delver's `tick(ctx)` function runs once, in party order.
- Each `tick()` call has a **CPU budget** (default 2ms; upgradeable). Exceeding the budget throws a `TickTimeout` and the delver skips the tick (logged).
- Actions returned by `tick()` resolve at end-of-tick, simultaneously. Ordering ambiguities (two delvers target same tile) resolve by party index with a flagged warning.

## The script surface

Each delver owns a single file with the shape:

```ts
// Optional: run once on deploy
function onDeploy(ctx: Context) {
  ctx.memory.role = 'tank';
}

// Required: runs every tick
function tick(ctx: Context): Action | void {
  if (ctx.self.hp < 40) return ctx.retreat();

  const enemy = ctx.scan.nearest('enemy');
  if (!enemy) return ctx.move(ctx.party.leader.pos);

  if (ctx.self.mp > 20 && enemy.hp > 50) {
    return ctx.cast('fireball', enemy);
  }
  return ctx.attack(enemy);
}
```

- Scripts are plain JS (TS types provided for authoring). Executed in a **Web Worker** with no DOM, no network, no `eval` of untrusted strings.
- Hot-reload during a run is **disabled** mid-run (prevents mid-run cheese). Pause → edit → resume is allowed but flagged in the run log.

## The Context API (progressively unlocked)

### Tier 0 — Starting API
- `ctx.self` — `{ hp, mp, pos, class, cooldowns, inventory }`
- `ctx.move(pos)` — pathfinds 1 tile toward target
- `ctx.attack(target)` — basic melee/ranged per class
- `ctx.scan.nearest(kind)` — nearest entity of `'enemy' | 'ally' | 'item'`
- `ctx.memory` — persistent per-delver scratch object

### Tier 1 — Early unlocks (depth 3–10)
- `ctx.scan.filter(pred)` / `ctx.scan.count(kind)`
- `ctx.cast(spellId, target)` — class-specific abilities
- `ctx.use(itemId)` — inventory consumables
- `ctx.retreat()` — move toward entrance

### Tier 2 — Mid-game
- `ctx.party` — snapshot of other delvers' public state
- `ctx.signal(name, payload?)` — broadcast to party (delivered next tick)
- `ctx.on(name, handler)` — register listener (registered in `onDeploy`)
- `ctx.pathfind(pos)` — full path, not just next step

### Tier 3 — Late-game
- `ctx.predict(action)` — dry-run an action, returns expected outcome
- `stdlib` imports: `import { kiteEnemy, holdFormation } from 'stdlib/combat'`
- Custom module slots — save your own helper files and import them

### Forbidden / non-existent
- No network, filesystem, DOM, timers, or access to other delvers' scripts directly.
- No `Math.random()` access inside the worker — use `ctx.rng()` (seeded, replay-safe).

## Classes (MVP + near-term)

| Class | Role | Signature ability | API additions |
|---|---|---|---|
| **Warrior** | Tank | `taunt(target)` — forces aggro | `ctx.self.armor`, `ctx.block()` |
| **Ranger** | DPS | `volley(pos)` — AoE at range | `ctx.scan.line(dir)`, range field on enemies |
| **Cleric** | Support | `heal(ally)` | `ctx.scan.wounded()`, `ctx.bless(ally)` |
| **Rogue** | Burst | `backstab(enemy)` | `ctx.stealth()`, `ctx.self.hidden` |
| **Artificer** | Utility | `deploy(gadget)` | `ctx.scan.gadgets()`, placeable entity API |

Classes are unlocked via meta-progression. Party composition is a strategic lever.

## Combat math (v0)

- All values integers. No floating-point damage.
- `damage = max(1, attack + weaponBonus - target.armor)` with a ±15% roll from `ctx.rng()`.
- Crits on `rng() < critChance`; crits deal `floor(damage * 1.5)`.
- HP regenerates out-of-combat (no enemies in scan radius for 10 ticks) at 1 HP/tick.
- MP regenerates 1/tick always.

## Dungeon generation

- Grid-based (no freeform movement). Tiles: floor, wall, door, stairs, trap, chest.
- Procedural rooms + corridors, BSP-split, seeded per-depth.
- Every N floors (default 5): **boss room**. Bosses gate API unlocks.
- Every M floors (default 10): **shrine** — safe room with shops/upgrades.

## Death and extraction

- A delver at 0 HP is **downed** for 20 ticks; allies can `revive(ally)` if API unlocked.
- Full party wipe = run ends. Loot banked to meta-inventory, XP applied.
- Voluntary extraction at shrines: bank run progress without risking the next floor.

## Meta-progression

**Permanent (survives death):**
- API unlocks (tier-gated, bought with "Insight" currency from boss kills)
- Stdlib module slots (starts at 0, caps at 5)
- Delver roster slots (3 → 5)
- Editor features (syntax highlight → autocomplete → type hints → live-preview replay)
- CPU budget per tick (2ms → 10ms cap)
- Class unlocks

**Run-scoped (lost on wipe):**
- Gear, consumables, potions
- Run-specific mutators (one-off buffs)
- Depth reached (banked at shrines)

## Failure modes as content

When a delver dies, the post-mortem screen shows:
- **Cause of death:** last enemy interaction + damage calc
- **Last 5 ticks of script output** per party member
- **Exceptions thrown** with line numbers
- **Budget misses** (ticks that hit the CPU timeout)
- **Signal trace** — what was broadcast and who received it

This is both diagnostic UI *and* the game's primary narrative surface.
