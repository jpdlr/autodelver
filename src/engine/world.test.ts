import { describe, expect, it } from 'vitest';
import { createWorld, isBossFloor, spawnDelver, resetEntityCounter } from './world';
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

  it('ranger can attack from three tiles away', () => {
    resetEntityCounter();
    const w = createWorld({
      seed: 'rangeA',
      depth: 1,
      delvers: [
        spawnDelver({
          class: 'ranger',
          name: 'V',
          pos: { x: 0, y: 0 },
          script: '',
          range: 3,
          attack: 8,
        }),
      ],
    });
    const d = w.delvers[0];
    const e = w.enemies[0];
    d.pos = { x: 5, y: 5 };
    e.pos = { x: 8, y: 5 };
    const hp = e.hp;

    advanceTick(w, { delverActions: new Map([[d.id, { type: 'attack', target: e.id }]]) });

    expect(e.hp).toBeLessThan(hp);
  });

  it('cleric heals wounded allies with cooldown and mana cost', () => {
    resetEntityCounter();
    const cleric = spawnDelver({
      class: 'cleric',
      name: 'M',
      pos: { x: 0, y: 0 },
      script: '',
      hp: 30,
      maxHp: 30,
      mp: 10,
      maxMp: 10,
      range: 2,
    });
    const warrior = spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' });
    const w = createWorld({ seed: 'healA', depth: 1, delvers: [cleric, warrior] });
    const c = w.delvers[0];
    const target = w.delvers[1];
    c.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.hp = 20;

    advanceTick(w, { delverActions: new Map([[c.id, { type: 'heal', target: target.id }]]) });

    expect(target.hp).toBe(25);
    expect(c.mp).toBe(8);
    expect(c.cooldowns.heal).toBe(3);
  });

  it('boss floors spawn exactly one elite enemy on the stairs', () => {
    resetEntityCounter();
    const w = createWorld({
      seed: 'bossA',
      depth: 5,
      delvers: [spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' })],
    });
    expect(isBossFloor(5)).toBe(true);
    const bosses = w.enemies.filter((e) => e.isBoss);
    expect(bosses.length).toBe(1);
    expect(bosses[0].pos).toEqual(w.stairs);
    // Boss should have substantially more HP than a regular-floor archetype.
    expect(bosses[0].maxHp).toBeGreaterThan(40);
  });

  it('non-boss floors have no elites', () => {
    resetEntityCounter();
    const w = createWorld({
      seed: 'regA',
      depth: 3,
      delvers: [spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' })],
    });
    expect(isBossFloor(3)).toBe(false);
    expect(w.enemies.every((e) => !e.isBoss)).toBe(true);
  });

  it('depth scaling makes deeper enemies tougher', () => {
    resetEntityCounter();
    const shallow = createWorld({
      seed: 'scaleA',
      depth: 1,
      delvers: [spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' })],
    });
    resetEntityCounter();
    const deep = createWorld({
      seed: 'scaleA',
      depth: 4,
      delvers: [spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' })],
    });
    const shallowAvg = shallow.enemies.reduce((s, e) => s + e.maxHp, 0) / shallow.enemies.length;
    const deepAvg = deep.enemies.reduce((s, e) => s + e.maxHp, 0) / deep.enemies.length;
    expect(deepAvg).toBeGreaterThan(shallowAvg);
  });

  it('cleric revives once per depth', () => {
    resetEntityCounter();
    const cleric = spawnDelver({
      class: 'cleric',
      name: 'M',
      pos: { x: 0, y: 0 },
      script: '',
      mp: 10,
      maxMp: 10,
      range: 2,
    });
    const warrior = spawnDelver({ class: 'warrior', name: 'G', pos: { x: 0, y: 0 }, script: '' });
    const w = createWorld({ seed: 'reviveA', depth: 1, delvers: [cleric, warrior] });
    const c = w.delvers[0];
    const target = w.delvers[1];
    c.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.hp = 0;
    target.downedFor = 10;

    advanceTick(w, { delverActions: new Map([[c.id, { type: 'revive', target: target.id }]]) });

    // Revive restores max(12, 40% of maxHp). Warrior default maxHp is 40
    // (base), so 40% = 16. We assert the rule, not the exact number, so
    // this stays correct if class HP is retuned.
    expect(target.hp).toBe(Math.min(Math.max(12, Math.floor(target.maxHp * 0.4)), target.maxHp));
    expect(target.downedFor).toBe(0);
    expect(c.mp).toBe(0);
    expect(c.reviveUsedDepth).toBe(1);
  });
});
