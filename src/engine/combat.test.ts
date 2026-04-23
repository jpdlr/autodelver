import { describe, expect, it } from 'vitest';
import { resolveAttack } from './combat';
import { sfc32 } from './rng';
import type { Delver, Enemy } from './types';

function makeDelver(overrides: Partial<Delver> = {}): Delver {
  return {
    id: 'd1',
    kind: 'delver',
    class: 'warrior',
    name: 'Test',
    pos: { x: 0, y: 0 },
    hp: 40,
    maxHp: 40,
    mp: 10,
    maxMp: 10,
    attack: 8,
    armor: 2,
    script: '',
    memory: {},
    downedFor: 0,
    color: '',
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'e1',
    kind: 'enemy',
    archetype: 'slime',
    pos: { x: 1, y: 0 },
    hp: 10,
    maxHp: 10,
    attack: 3,
    armor: 0,
    seed: 1,
    ...overrides,
  };
}

describe('resolveAttack', () => {
  it('deals at least 1 damage', () => {
    const rng = sfc32('combat-test');
    const d = makeDelver({ attack: 1 });
    const e = makeEnemy({ armor: 100, hp: 100, maxHp: 100 });
    const res = resolveAttack(1, d, e, rng);
    expect(res.damage).toBeGreaterThanOrEqual(1);
  });

  it('kills enemy when hp reaches zero', () => {
    const rng = sfc32('kill');
    const d = makeDelver({ attack: 100 });
    const e = makeEnemy({ hp: 5 });
    const res = resolveAttack(1, d, e, rng);
    expect(res.killed).toBe(true);
    expect(e.hp).toBe(0);
    expect(res.events.some((ev) => ev.kind === 'death')).toBe(true);
  });

  it('is deterministic with same rng seed', () => {
    const rngA = sfc32('det');
    const rngB = sfc32('det');
    const dA = makeDelver();
    const dB = makeDelver();
    const eA = makeEnemy();
    const eB = makeEnemy();
    const a = resolveAttack(1, dA, eA, rngA);
    const b = resolveAttack(1, dB, eB, rngB);
    expect(a.damage).toBe(b.damage);
    expect(a.crit).toBe(b.crit);
  });
});
