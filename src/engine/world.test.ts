import { describe, expect, it } from 'vitest';
import { createWorld, spawnDelver, resetEntityCounter } from './world';
import { advanceTick } from './tick';
import type { Action } from './types';
import { isWalkable } from './grid';

describe('world & golden run', () => {
  it('creates a deterministic world from seed', () => {
    resetEntityCounter();
    const w1 = createWorld({
      seed: 'goldenA',
      depth: 1,
      delvers: [
        spawnDelver({
          class: 'warrior',
          name: 'Grimm',
          pos: { x: 0, y: 0 },
          script: '',
        }),
      ],
    });
    resetEntityCounter();
    const w2 = createWorld({
      seed: 'goldenA',
      depth: 1,
      delvers: [
        spawnDelver({
          class: 'warrior',
          name: 'Grimm',
          pos: { x: 0, y: 0 },
          script: '',
        }),
      ],
    });
    expect(w1.grid.tiles).toEqual(w2.grid.tiles);
    expect(w1.stairs).toEqual(w2.stairs);
    expect(w1.enemies.length).toBe(w2.enemies.length);
    for (let i = 0; i < w1.enemies.length; i++) {
      expect(w1.enemies[i].pos).toEqual(w2.enemies[i].pos);
      expect(w1.enemies[i].archetype).toEqual(w2.enemies[i].archetype);
    }
  });

  it('delver moves when given a move action', () => {
    resetEntityCounter();
    const w = createWorld({
      seed: 'moveA',
      depth: 1,
      delvers: [
        spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' }),
      ],
    });
    const d = w.delvers[0];
    const startPos = { ...d.pos };
    // Move toward a walkable neighbour
    let attempted = false;
    for (let dx = -1; dx <= 1 && !attempted; dx++) {
      for (let dy = -1; dy <= 1 && !attempted; dy++) {
        if (dx === 0 && dy === 0) continue;
        const target = { x: d.pos.x + dx, y: d.pos.y + dy };
        if (isWalkable(w.grid, target)) {
          const actions = new Map<string, Action>([[d.id, { type: 'move', target }]]);
          advanceTick(w, { delverActions: actions });
          attempted = true;
          expect(d.pos).not.toEqual(startPos);
        }
      }
    }
    expect(attempted).toBe(true);
  });

  it('wipe when all delvers reach 0 hp', () => {
    resetEntityCounter();
    const w = createWorld({
      seed: 'wipeA',
      depth: 1,
      delvers: [
        spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' }),
      ],
    });
    w.delvers[0].hp = 0;
    advanceTick(w, { delverActions: new Map() });
    expect(w.status).toBe('wiped');
  });

  it('tick number increases', () => {
    resetEntityCounter();
    const w = createWorld({
      seed: 'tickA',
      depth: 1,
      delvers: [
        spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' }),
      ],
    });
    const t0 = w.tick;
    advanceTick(w, { delverActions: new Map() });
    advanceTick(w, { delverActions: new Map() });
    expect(w.tick).toBe(t0 + 2);
  });
});
