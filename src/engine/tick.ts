import type { Action, Delver, Enemy, World } from './types';
import { type Rng, sfc32 } from './rng';
import { isWalkable, posEq, distCheb, neighbours, distManhattan } from './grid';
import { findPath } from './pathfind';
import { resolveAttack } from './combat';
import { entityAt } from './world';

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
      // Plan through living entities — they might move or die. We only defer
      // the actual step if the next tile is occupied *right now*.
      const path = findPath(world.grid, d.pos, action.target);
      if (!path || path.length < 2) return;
      const next = path[1];
      const occupant = entityAt(world, next);
      if (!occupant || posEq(next, action.target)) {
        d.pos = next;
        return;
      }
      // Try a sidestep around the blocker toward the goal
      for (const n of neighbours(d.pos)) {
        if (!isWalkable(world.grid, n)) continue;
        if (entityAt(world, n)) continue;
        if (distManhattan(n, action.target) < distManhattan(d.pos, action.target)) {
          d.pos = n;
          return;
        }
      }
      return;
    }
    case 'attack': {
      const target = world.enemies.find((e) => e.id === action.target && e.hp > 0);
      if (!target) return;
      if (distCheb(d.pos, target.pos) > 1) return;
      const res = resolveAttack(world.tick, d, target, rng);
      world.events.push(...res.events);
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
  if (!target || bestDist > 12) return;

  // Adjacent? Attack.
  if (distCheb(e.pos, target.pos) === 1) {
    const res = resolveAttack(world.tick, e, target, rng);
    world.events.push(...res.events);
    return;
  }

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

  // Death logging for delvers
  for (const d of world.delvers) {
    if (d.hp === 0 && d.downedFor === 0) {
      d.downedFor = 20;
      world.events.push({
        tick: world.tick,
        kind: 'death',
        actorId: d.id,
        message: `${d.name} is downed.`,
      });
    }
  }

  // HP regen out-of-combat
  const anyEnemyNear = world.delvers.some((d) =>
    world.enemies.some((e) => e.hp > 0 && distCheb(d.pos, e.pos) <= 4),
  );
  if (!anyEnemyNear) {
    for (const d of world.delvers) {
      if (d.hp > 0 && d.hp < d.maxHp && world.tick % 3 === 0) d.hp++;
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
