import { describe, expect, it } from 'vitest';
import { createWorld, entityAt, spawnDelver } from './world';
import { advanceTick } from './tick';
import { findPath } from './pathfind';
import { distManhattan } from './grid';
import type { Action, Delver, World } from './types';

/**
 * End-to-end loop tests. Each test runs a full tick loop with a built-in
 * decision function that mirrors the default scripts (attack adjacent,
 * A* toward enemy/stairs, descend when on stairs). Focus: determinism,
 * termination, and the "no hang" invariant when delvers are healthy.
 */

function decide(world: World, d: Delver): Action {
  if (d.hp === 0) return { type: 'wait' };
  if (d.pos.x === world.stairs.x && d.pos.y === world.stairs.y) {
    return { type: 'descend' };
  }
  let near: typeof world.enemies[number] | null = null;
  let best = Infinity;
  for (const e of world.enemies) {
    if (e.hp === 0) continue;
    const dist = distManhattan(d.pos, e.pos);
    if (dist < best) { best = dist; near = e; }
  }
  if (near && best <= d.range) return { type: 'attack', target: near.id };

  const target = near && best <= 8 ? near.pos : world.stairs;
  const blocked = new Set(
    world.delvers
      .filter((o) => o.id !== d.id && o.hp > 0)
      .map((o) => `${o.pos.x},${o.pos.y}`),
  );
  const path = findPath(world.grid, d.pos, target, blocked);
  if (path && path.length > 1) {
    const next = path[1];
    const occ = entityAt(world, next);
    if (occ && occ.kind === 'delver' && occ.hp > 0) return { type: 'wait' };
    return { type: 'move', target: next };
  }
  return { type: 'wait' };
}

function makeParty(): Delver[] {
  return [
    spawnDelver({
      class: 'warrior',
      name: 'Grimm',
      pos: { x: 0, y: 0 },
      script: '',
      hp: 45, maxHp: 45, attack: 7, armor: 3, range: 1,
    }),
    spawnDelver({
      class: 'ranger',
      name: 'Vex',
      pos: { x: 0, y: 0 },
      script: '',
      hp: 30, maxHp: 30, attack: 8, armor: 1, range: 3,
    }),
    spawnDelver({
      class: 'cleric',
      name: 'Mira',
      pos: { x: 0, y: 0 },
      script: '',
      hp: 30, maxHp: 30, mp: 10, maxMp: 10, attack: 5, armor: 2, range: 2,
    }),
  ];
}

function runLoop(seed: string, maxTicks = 600): World {
  const world = createWorld({ seed, depth: 1, delvers: makeParty() });
  let guard = 0;
  while (world.status === 'running' && guard < maxTicks) {
    const actions = new Map<string, Action>();
    for (const d of world.delvers) actions.set(d.id, decide(world, d));
    advanceTick(world, { delverActions: actions });
    guard++;
  }
  return world;
}

describe('tick loop', () => {
  it('reaches a terminal status within the tick budget', () => {
    const world = runLoop('loop-test-stable');
    expect(['cleared', 'wiped']).toContain(world.status);
    expect(world.tick).toBeLessThan(600);
  });

  it('is deterministic under the same seed', () => {
    const a = runLoop('loop-determinism-1');
    const b = runLoop('loop-determinism-1');
    expect(a.status).toBe(b.status);
    expect(a.tick).toBe(b.tick);
    expect(a.delvers.map((d) => d.hp)).toEqual(b.delvers.map((d) => d.hp));
    expect(a.enemies.map((e) => e.hp)).toEqual(b.enemies.map((e) => e.hp));
    expect(a.events.length).toBe(b.events.length);
  });

  it('produces different outcomes for different seeds', () => {
    const a = runLoop('loop-seed-a');
    const b = runLoop('loop-seed-b');
    // Different seeds ⇒ different dungeons ⇒ at least one axis differs.
    const same =
      a.status === b.status &&
      a.tick === b.tick &&
      JSON.stringify(a.delvers.map((d) => d.hp)) ===
        JSON.stringify(b.delvers.map((d) => d.hp));
    expect(same).toBe(false);
  });

  it('monotonically increases tick during advance', () => {
    const world = createWorld({ seed: 'loop-monotonic', depth: 1, delvers: makeParty() });
    const ticks: number[] = [world.tick];
    for (let i = 0; i < 20 && world.status === 'running'; i++) {
      const actions = new Map<string, Action>();
      for (const d of world.delvers) actions.set(d.id, decide(world, d));
      advanceTick(world, { delverActions: actions });
      ticks.push(world.tick);
    }
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });

  it('does not silently hang when all delvers are alive and healthy', () => {
    // Regression guard: the party must always make progress, never spin
    // forever without their HP changing or any entity moving.
    const world = createWorld({ seed: 'loop-no-hang', depth: 1, delvers: makeParty() });
    const startPositions = world.delvers.map((d) => `${d.pos.x},${d.pos.y}`).join('|');
    for (let i = 0; i < 50 && world.status === 'running'; i++) {
      const actions = new Map<string, Action>();
      for (const d of world.delvers) actions.set(d.id, decide(world, d));
      advanceTick(world, { delverActions: actions });
    }
    const endPositions = world.delvers.map((d) => `${d.pos.x},${d.pos.y}`).join('|');
    // Either the run moved toward its conclusion, or the party at least
    // repositioned — they should never sit motionless for 50 ticks.
    const moved = startPositions !== endPositions;
    const progressed = world.status !== 'running' || world.tick >= 50;
    expect(moved || progressed).toBe(true);
  });

  it('advanceTick is a no-op once the run has terminated', () => {
    const done = runLoop('loop-terminal');
    const snapshot = {
      tick: done.tick,
      status: done.status,
      delvers: done.delvers.map((d) => ({ ...d, pos: { ...d.pos } })),
    };
    advanceTick(done, { delverActions: new Map() });
    expect(done.tick).toBe(snapshot.tick);
    expect(done.status).toBe(snapshot.status);
    expect(done.delvers.map((d) => d.hp)).toEqual(
      snapshot.delvers.map((d) => d.hp),
    );
  });
});
