import { describe, expect, it } from 'vitest';
import { sfc32, rngInt, rngPick, rngChance } from './rng';

describe('sfc32', () => {
  it('is deterministic for same seed', () => {
    const a = sfc32('hello');
    const b = sfc32('hello');
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('differs for different seeds', () => {
    const a = sfc32('hello');
    const b = sfc32('world');
    let differences = 0;
    for (let i = 0; i < 100; i++) {
      if (a() !== b()) differences++;
    }
    expect(differences).toBeGreaterThan(95);
  });

  it('produces values in [0,1)', () => {
    const r = sfc32('x');
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rngInt', () => {
  it('returns values in range', () => {
    const r = sfc32('s');
    for (let i = 0; i < 200; i++) {
      const v = rngInt(r, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });
});

describe('rngPick', () => {
  it('picks from array', () => {
    const r = sfc32('s');
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rngPick(r, arr));
    }
  });
});

describe('rngChance', () => {
  it('0 is never true, 1 is always true', () => {
    const r = sfc32('s');
    for (let i = 0; i < 50; i++) {
      expect(rngChance(r, 0)).toBe(false);
      expect(rngChance(r, 1)).toBe(true);
    }
  });
});
