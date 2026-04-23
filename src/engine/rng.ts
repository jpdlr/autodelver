/**
 * sfc32 — small, fast, deterministic PRNG. 128-bit state, period ~2^128.
 * Used for all engine randomness; Math.random is banned in engine code.
 */
export type Rng = () => number;

export function sfc32(seedStr: string): Rng {
  const seed = hashSeed(seedStr);
  let a = seed[0] | 0;
  let b = seed[1] | 0;
  let c = seed[2] | 0;
  let d = seed[3] | 0;

  return function rng(): number {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): [number, number, number, number] {
  let h1 = 1779033703 ^ str.length;
  let h2 = 3144134277 ^ str.length;
  let h3 = 1013904242 ^ str.length;
  let h4 = 2773480762 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ k, 597399067);
    h2 = Math.imul(h2 ^ k, 2869860233);
    h3 = Math.imul(h3 ^ k, 951274213);
    h4 = Math.imul(h4 ^ k, 2716044179);
  }
  h1 ^= h2 ^ h3 ^ h4;
  return [h1 | 0, h2 | 0, h3 | 0, h4 | 0];
}

export function rngInt(rng: Rng, min: number, maxExclusive: number): number {
  return Math.floor(rng() * (maxExclusive - min)) + min;
}

export function rngPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rngInt(rng, 0, arr.length)];
}

export function rngChance(rng: Rng, p: number): boolean {
  return rng() < p;
}
