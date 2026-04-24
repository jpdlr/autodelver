import type { Delver, Enemy, EnemyArchetype, Pos, World } from './types';
import { type Rng, rngInt, rngPick, sfc32 } from './rng';
import { generateDungeon, pickSpawnsInRooms } from './dungeon';
import {
  BOSS,
  DEPTH_SCALING,
  DUNGEON,
  ENEMY_STATS,
  SPAWN,
  archetypePoolForDepth,
} from './balance';

let entityCounter = 0;
function nextId(prefix: string): string {
  entityCounter++;
  return `${prefix}-${entityCounter.toString(36)}`;
}

export function resetEntityCounter(): void {
  entityCounter = 0;
}

export function isBossFloor(depth: number): boolean {
  return depth > 0 && depth % DUNGEON.BOSS_EVERY === 0;
}

/** Pick the boss archetype for a given depth. Cycles through the heavy
 *  hitters so each boss floor feels distinct. */
function bossArchetypeForDepth(depth: number): EnemyArchetype {
  const cycle = BOSS.ROTATION;
  return cycle[(Math.floor(depth / DUNGEON.BOSS_EVERY) - 1) % cycle.length] ?? 'brute';
}

export function spawnDelver(partial: Partial<Delver> & Pick<Delver, 'class' | 'name' | 'script' | 'pos'>): Delver {
  const base: Delver = {
    id: nextId('d'),
    kind: 'delver',
    class: partial.class,
    name: partial.name,
    pos: partial.pos,
    hp: 40,
    maxHp: 40,
    mp: 10,
    maxMp: 10,
    attack: 8,
    armor: 2,
    range: 1,
    script: partial.script,
    memory: {},
    cooldowns: { heal: 0 },
    reviveUsedDepth: null,
    downedFor: 0,
    color: 'var(--color-entity-delver)',
  };
  return { ...base, ...partial };
}

export function spawnEnemy(
  archetype: EnemyArchetype,
  pos: Pos,
  depth: number,
  seed: number,
  opts: { boss?: boolean } = {},
): Enemy {
  const s = ENEMY_STATS[archetype];
  const depthScale = 1 + (depth - 1) * DEPTH_SCALING.PER_DEPTH;
  const boss = opts.boss ?? false;
  const hpMul = boss ? BOSS.HP_MULTIPLIER : 1;
  const atkMul = boss ? BOSS.ATK_MULTIPLIER : 1;
  const armorBonus = boss ? BOSS.ARMOR_BONUS : 0;
  return {
    id: nextId('e'),
    kind: 'enemy',
    archetype,
    pos,
    hp: Math.round(s.hp * depthScale * hpMul),
    maxHp: Math.round(s.hp * depthScale * hpMul),
    attack: Math.round(s.atk * depthScale * atkMul),
    armor: s.armor + armorBonus,
    seed,
    ...(boss ? { isBoss: true } : {}),
  };
}

export interface NewRunParams {
  seed: string;
  depth: number;
  delvers: Delver[];
}

export function createWorld(params: NewRunParams): World {
  const rng: Rng = sfc32(`${params.seed}:depth${params.depth}`);
  const boss = isBossFloor(params.depth);
  // Dungeons grow subtly with depth so late floors breathe more.
  // Boss floors get a larger grid with fewer, bigger rooms — the goal
  // is a dedicated arena for the boss encounter.
  const sizeBump = Math.min(
    DUNGEON.SIZE_BUMP_CAP,
    Math.floor((params.depth - 1) / DUNGEON.SIZE_BUMP_EVERY),
  );
  const dungeon = generateDungeon(rng, {
    width: (boss ? DUNGEON.BOSS_WIDTH : DUNGEON.NORMAL_WIDTH) + sizeBump,
    height: (boss ? DUNGEON.BOSS_HEIGHT : DUNGEON.NORMAL_HEIGHT) + Math.floor(sizeBump / 2),
    minRoomSize: boss ? DUNGEON.BOSS_MIN_ROOM : DUNGEON.NORMAL_MIN_ROOM + Math.floor(sizeBump / 4),
    maxRoomSize: boss ? DUNGEON.BOSS_MAX_ROOM : DUNGEON.NORMAL_MAX_ROOM + Math.floor(sizeBump / 3),
    roomAttempts: boss ? DUNGEON.BOSS_ROOM_ATTEMPTS : DUNGEON.NORMAL_ROOM_ATTEMPTS,
  });

  // Place delvers at entrance in a tight cluster of walkable tiles
  const offsets: Pos[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  const placed = params.delvers.map((d, i) => {
    const off = offsets[i] ?? { x: 0, y: i - 4 };
    return {
      ...d,
      pos: { x: dungeon.entrance.x + off.x, y: dungeon.entrance.y + off.y },
    };
  });

  // Spawn enemies. Normal floors scale count with depth and pick from the
  // depth-weighted archetype pool. Boss floors spawn a single elite plus
  // a few minions to break up the encounter.
  const pool = archetypePoolForDepth(params.depth);
  const enemies: Enemy[] = [];
  if (boss) {
    const bossArch = bossArchetypeForDepth(params.depth);
    // Boss sits in the far (stairs) room.
    enemies.push(spawnEnemy(bossArch, dungeon.stairs, params.depth, rngInt(rng, 0, 1e9), { boss: true }));
    const minionCount = SPAWN.BOSS_MINION_BASE + Math.floor(params.depth / SPAWN.BOSS_MINION_PER_DIV);
    const minionPositions = pickSpawnsInRooms(dungeon.rooms, rng, minionCount, [
      dungeon.entrance,
      dungeon.stairs,
    ]);
    for (const pos of minionPositions) {
      const archetype = rngPick<EnemyArchetype>(rng, pool);
      enemies.push(spawnEnemy(archetype, pos, params.depth, rngInt(rng, 0, 1e9)));
    }
  } else {
    const enemyCount = SPAWN.NORMAL_BASE + Math.floor(params.depth * SPAWN.NORMAL_PER_DEPTH);
    const spawnPositions = pickSpawnsInRooms(dungeon.rooms, rng, enemyCount, [dungeon.entrance]);
    for (const pos of spawnPositions) {
      const archetype = rngPick<EnemyArchetype>(rng, pool);
      enemies.push(spawnEnemy(archetype, pos, params.depth, rngInt(rng, 0, 1e9)));
    }
  }

  return {
    seed: params.seed,
    depth: params.depth,
    tick: 0,
    grid: dungeon.grid,
    delvers: placed,
    enemies,
    entrance: dungeon.entrance,
    stairs: dungeon.stairs,
    events: [
      {
        tick: 0,
        kind: 'info',
        message: boss
          ? `Depth ${params.depth}: a boss stirs. ${params.delvers.length} delver(s) against ${enemies.length} hostile(s).`
          : `Descent ${params.depth} begins — ${params.delvers.length} delver(s), ${enemies.length} hostile(s).`,
      },
    ],
    status: 'running',
  };
}

export function entityAt(world: World, pos: Pos): Delver | Enemy | undefined {
  return (
    world.delvers.find((d) => d.hp > 0 && d.pos.x === pos.x && d.pos.y === pos.y) ??
    world.enemies.find((e) => e.hp > 0 && e.pos.x === pos.x && e.pos.y === pos.y)
  );
}
