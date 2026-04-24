/**
 * Single source of truth for game balance knobs. Tune here, not in tick.ts
 * or world.ts. Anything that feels like "a number with meaning" belongs here.
 */
import type { DelverClass, EnemyArchetype } from './types';

// ——— Combat roll ———
export const COMBAT = {
  /** Damage roll is attack + rng[ROLL_MIN..ROLL_MAX] - armor, floored at 1. */
  ROLL_MIN: -2,
  ROLL_MAX: 2,
  CRIT_CHANCE: 0.1,
  CRIT_MULTIPLIER: 1.5,
} as const;

// ——— Healing & support ———
export const HEAL = {
  /** HP restored per heal cast. Cap at target.maxHp - target.hp. */
  AMOUNT: 5,
  MP_COST: 2,
  COOLDOWN_TICKS: 4,
} as const;

export const REVIVE = {
  MP_COST: 10,
  /** HP restored on revive: max(MIN_HP, floor(maxHp * HP_FRACTION)). */
  HP_FRACTION: 0.4,
  MIN_HP: 12,
} as const;

// ——— Regen ———
export const REGEN = {
  /** +1 MP every MP_EVERY_TICKS while living, until maxMp. */
  MP_EVERY_TICKS: 4,
  /** +1 HP every HP_EVERY_TICKS while out-of-combat and below maxHp. */
  HP_EVERY_TICKS: 3,
  /** Out-of-combat = no enemy within this Chebyshev distance of any delver. */
  OOC_THRESHOLD_CHEB: 4,
} as const;

// ——— Downed / revive windows ———
export const DOWN = {
  /** Ticks a downed delver remains revivable before being permanently out. */
  REVIVE_WINDOW: 20,
} as const;

// ——— Enemy AI ———
export const ENEMY_AI = {
  /** Enemy idles if no delver within this Manhattan distance. */
  AGGRO_RANGE_MANH: 12,
} as const;

// ——— Enemy stats (base, pre-depth-scaling) ———
export const ENEMY_STATS: Record<EnemyArchetype, { hp: number; atk: number; armor: number }> = {
  slime:  { hp: 8,  atk: 3, armor: 0 },
  goblin: { hp: 12, atk: 5, armor: 1 },
  wraith: { hp: 18, atk: 7, armor: 2 },
  brute:  { hp: 28, atk: 9, armor: 3 },
  lich:   { hp: 22, atk: 10, armor: 2 },
};

export const DEPTH_SCALING = {
  /** Multiplier applied to enemy hp/atk per depth: 1 + (depth-1) * PER_DEPTH. */
  PER_DEPTH: 0.10,
} as const;

export const BOSS = {
  HP_MULTIPLIER: 2.5,
  ATK_MULTIPLIER: 1.35,
  ARMOR_BONUS: 1,
  /** Cycled through in boss rotation; index = floor(depth/5) - 1. */
  ROTATION: ['brute', 'wraith', 'lich', 'brute', 'lich'] as EnemyArchetype[],
} as const;

// ——— Spawning ———
export const SPAWN = {
  /** Normal floor enemy count: BASE + floor(depth * PER_DEPTH). */
  NORMAL_BASE: 2,
  NORMAL_PER_DEPTH: 1.2,
  /** Boss-floor minion count: BASE + floor(depth / PER_DIV). */
  BOSS_MINION_BASE: 2,
  BOSS_MINION_PER_DIV: 5,
} as const;

// ——— Dungeon sizing ———
export const DUNGEON = {
  NORMAL_WIDTH: 48,
  NORMAL_HEIGHT: 28,
  BOSS_WIDTH: 54,
  BOSS_HEIGHT: 32,
  SIZE_BUMP_CAP: 8,
  SIZE_BUMP_EVERY: 3,
  NORMAL_MIN_ROOM: 5,
  NORMAL_MAX_ROOM: 9,
  BOSS_MIN_ROOM: 7,
  BOSS_MAX_ROOM: 13,
  NORMAL_ROOM_ATTEMPTS: 16,
  BOSS_ROOM_ATTEMPTS: 8,
  /** Boss floors are every N depths. */
  BOSS_EVERY: 5,
} as const;

// ——— Class loadouts ———
export const CLASS_STATS: Record<DelverClass, {
  hp: number;
  mp: number;
  attack: number;
  armor: number;
  range: number;
}> = {
  warrior: { hp: 55, mp: 0,  attack: 10, armor: 4, range: 1 },
  ranger:  { hp: 34, mp: 0,  attack: 11, armor: 1, range: 3 },
  cleric:  { hp: 34, mp: 12, attack: 6,  armor: 2, range: 2 },
};

// ——— Sandbox ———
export const SANDBOX = {
  /** Per-tick CPU budget per delver worker, in milliseconds. */
  BUDGET_MS: 80,
} as const;

/** Weighted archetype pool by depth. Entries appear as they unlock and
 *  higher-tier archetypes weight up so late floors feel distinctly nastier. */
export function archetypePoolForDepth(depth: number): EnemyArchetype[] {
  const pool: EnemyArchetype[] = [];
  pool.push('slime', 'slime', 'goblin');
  if (depth >= 2) pool.push('goblin');
  if (depth >= 3) pool.push('wraith');
  if (depth >= 4) pool.push('wraith');
  if (depth >= 5) pool.push('brute');
  if (depth >= 6) pool.push('goblin', 'wraith');
  if (depth >= 7) pool.push('lich');
  if (depth >= 9) pool.push('brute', 'lich');
  if (depth >= 12) pool.push('brute', 'lich', 'wraith');
  return pool;
}
