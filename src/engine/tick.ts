import type { Action, Delver, Enemy, Pos, World } from './types';
import { type Rng, sfc32 } from './rng';
import { isWalkable, posEq, distCheb, neighbours, distManhattan } from './grid';
import { findPath } from './pathfind';
import { resolveAttack } from './combat';
import { entityAt } from './world';
import { DOWN, ENEMY_AI, HEAL, REGEN, REVIVE } from './balance';

export interface TickInput {
  delverActions: Map<string, Action>;
}

/**
 * Advance the world one tick:
 *   1. Apply delver actions (resolved simultaneously, party-index order for conflicts)
 *   2. Enemy AI decides and applies
 *   3. Post-tick: regen, downed counters, win/lose checks
 */
export function advanceTick(world: World, input: TickInput): World {
  if (world.status !== 'running') return world;
  const rng: Rng = sfc32(`${world.seed}:tick${world.tick}`);

  world.tick++;

  // Delver actions
  for (const d of world.delvers) {
    if (d.hp === 0) {
      if (d.downedFor > 0) d.downedFor--;
      continue;
    }
    const action = input.delverActions.get(d.id) ?? { type: 'wait' };
    applyDelverAction(world, d, action, rng);
  }

  // Enemy AI
  for (const e of world.enemies) {
    if (e.hp === 0) continue;
    applyEnemyAction(world, e, rng);
  }

  // Post-tick
  postTick(world);
  return world;
}

function applyDelverAction(world: World, d: Delver, action: Action, rng: Rng): void {
  switch (action.type) {
    case 'wait':
      // regen a bit
      if (d.mp < d.maxMp) d.mp++;
      return;
    case 'descend': {
      if (posEq(d.pos, world.stairs)) {
        world.events.push({
          tick: world.tick,
          kind: 'descend',
          actorId: d.id,
          message: `${d.name} reaches the stairs — floor cleared.`,
        });
        world.status = 'cleared';
      }
      return;
    }
    case 'move': {
      if (posEq(d.pos, action.target)) return;
      // Route around currently-occupied tiles so a cluster of delvers
      // doesn't all pick the same blocked corridor and stall. The goal
      // tile itself stays allowed so "move to enemy" still terminates on
      // the enemy's cell.
      const blocked = new Set<string>();
      for (const o of world.delvers) {
        if (o.id !== d.id && o.hp > 0) blocked.add(`${o.pos.x},${o.pos.y}`);
      }
      for (const e of world.enemies) {
        if (e.hp > 0 && !posEq(e.pos, action.target)) blocked.add(`${e.pos.x},${e.pos.y}`);
      }
      let path = findPath(world.grid, d.pos, action.target, blocked);
      // If every detour is blocked (e.g. the ally is in a choke point),
      // fall back to the naive path and let sidestep handle it.
      if (!path || path.length < 2) {
        path = findPath(world.grid, d.pos, action.target);
      }
      if (path && path.length >= 2) {
        const next = path[1];
        const occupant = entityAt(world, next);
        if (!occupant || posEq(next, action.target)) {
          d.pos = next;
          return;
        }
      }
      // No path (target off-map, walled off, or occupied) — take the best
      // single step toward the goal direction so "move far that way" still
      // produces motion. Prefer strictly-closer free neighbours.
      let equalFallback: Pos | null = null;
      const currDist = distManhattan(d.pos, action.target);
      for (const n of neighbours(d.pos)) {
        if (!isWalkable(world.grid, n)) continue;
        if (entityAt(world, n)) continue;
        const nd = distManhattan(n, action.target);
        if (nd < currDist) {
          d.pos = n;
          return;
        }
        if (nd === currDist && !equalFallback) equalFallback = n;
      }
      if (equalFallback) d.pos = equalFallback;
      return;
    }
    case 'attack': {
      const target = world.enemies.find((e) => e.id === action.target && e.hp > 0);
      if (!target) return;
      if (distCheb(d.pos, target.pos) > d.range) return;
      const res = resolveAttack(world.tick, d, target, rng);
      world.events.push(...res.events);
      return;
    }
    case 'heal': {
      if (d.class !== 'cleric') return;
      if (d.mp < HEAL.MP_COST || d.cooldowns.heal > 0) return;
      const target = world.delvers.find((ally) => ally.id === action.target && ally.hp > 0);
      if (!target || distCheb(d.pos, target.pos) > d.range || target.hp >= target.maxHp) return;
      d.mp -= HEAL.MP_COST;
      d.cooldowns.heal = HEAL.COOLDOWN_TICKS;
      const amount = Math.min(HEAL.AMOUNT, target.maxHp - target.hp);
      target.hp += amount;
      world.events.push({
        tick: world.tick,
        kind: 'heal',
        actorId: d.id,
        targetId: target.id,
        message: `${d.name} heals ${target.name} for ${amount} HP`,
        data: { amount, mpCost: HEAL.MP_COST, cooldown: HEAL.COOLDOWN_TICKS },
      });
      return;
    }
    case 'revive': {
      if (d.class !== 'cleric') return;
      if (d.mp < REVIVE.MP_COST || d.reviveUsedDepth === world.depth) return;
      const target = world.delvers.find((ally) => ally.id === action.target && ally.hp === 0);
      if (!target || target.id === d.id || distCheb(d.pos, target.pos) > d.range) return;
      d.mp -= REVIVE.MP_COST;
      d.reviveUsedDepth = world.depth;
      target.hp = Math.min(
        Math.max(REVIVE.MIN_HP, Math.floor(target.maxHp * REVIVE.HP_FRACTION)),
        target.maxHp,
      );
      target.downedFor = 0;
      world.events.push({
        tick: world.tick,
        kind: 'heal',
        actorId: d.id,
        targetId: target.id,
        message: `${d.name} revives ${target.name} with ${target.hp} HP`,
        data: { amount: target.hp, mpCost: REVIVE.MP_COST, oncePerDepth: true },
      });
      return;
    }
    case 'retreat': {
      // move one step toward entrance
      const path = findPath(world.grid, d.pos, world.entrance);
      if (path && path.length > 1) {
        const next = path[1];
        if (!entityAt(world, next)) d.pos = next;
      }
      return;
    }
  }
}

function applyEnemyAction(world: World, e: Enemy, rng: Rng): void {
  // Find nearest living delver within 10 tiles; if none, idle.
  let target: Delver | undefined;
  let bestDist = Infinity;
  for (const d of world.delvers) {
    if (d.hp === 0) continue;
    const dist = distManhattan(e.pos, d.pos);
    if (dist < bestDist) {
      bestDist = dist;
      target = d;
    }
  }
  if (!target || bestDist > ENEMY_AI.AGGRO_RANGE_MANH) return;

  // Adjacent? Attack.
  if (distCheb(e.pos, target.pos) === 1) {
    const res = resolveAttack(world.tick, e, target, rng);
    world.events.push(...res.events);
    return;
  }

  // Bosses anchor on the stairs and never give chase. The stairs room is
  // the arena — you have to come to them, and you can't slip past.
  if (e.isBoss) return;

  // Otherwise step toward target along a simple greedy pathfind.
  const path = findPath(world.grid, e.pos, target.pos);
  if (!path || path.length < 2) return;
  const next = path[1];
  const occupant = entityAt(world, next);
  if (!occupant || occupant.id === target.id) {
    e.pos = next;
  } else {
    // try sidestep
    for (const n of neighbours(e.pos)) {
      if (
        isWalkable(world.grid, n) &&
        !entityAt(world, n) &&
        distManhattan(n, target.pos) < bestDist
      ) {
        e.pos = n;
        return;
      }
    }
  }
}

function postTick(world: World): void {
  // Clean dead enemies: leave the reference but hp=0 is the marker
  for (const e of world.enemies) {
    if (e.hp === 0 && !world.events.some((ev) => ev.kind === 'death' && ev.actorId === e.id && ev.tick === world.tick - 0)) {
      // already logged in combat
    }
  }

  for (const d of world.delvers) {
    if (d.cooldowns.heal > 0) d.cooldowns.heal--;
  }

  // Death logging for delvers
  for (const d of world.delvers) {
    if (d.hp === 0 && d.downedFor === 0) {
      d.downedFor = DOWN.REVIVE_WINDOW;
      world.events.push({
        tick: world.tick,
        kind: 'death',
        actorId: d.id,
        message: `${d.name} is downed.`,
      });
    }
  }

  if (world.tick % REGEN.MP_EVERY_TICKS === 0) {
    for (const d of world.delvers) {
      if (d.hp > 0 && d.mp < d.maxMp) d.mp++;
    }
  }

  const anyEnemyNear = world.delvers.some((d) =>
    world.enemies.some((e) => e.hp > 0 && distCheb(d.pos, e.pos) <= REGEN.OOC_THRESHOLD_CHEB),
  );
  if (!anyEnemyNear) {
    for (const d of world.delvers) {
      if (d.hp > 0 && d.hp < d.maxHp && world.tick % REGEN.HP_EVERY_TICKS === 0) d.hp++;
    }
  }

  // Check wipe / cleared
  if (world.delvers.every((d) => d.hp === 0)) {
    world.status = 'wiped';
    world.events.push({
      tick: world.tick,
      kind: 'info',
      message: 'Party wipe — the dungeon keeps what it takes.',
    });
  }
}
