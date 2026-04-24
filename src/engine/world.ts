import type { Delver, Enemy, EnemyArchetype, Pos, World } from './types';
import { type Rng, rngInt, rngPick, sfc32 } from './rng';
import { generateDungeon, pickSpawnsInRooms } from './dungeon';

let entityCounter = 0;
function nextId(prefix: string): string {
  entityCounter++;
  return `${prefix}-${entityCounter.toString(36)}`;
}

export function resetEntityCounter(): void {
  entityCounter = 0;
}

const ENEMY_STATS: Record<EnemyArchetype, { hp: number; atk: number; armor: number }> = {
  slime: { hp: 8, atk: 3, armor: 0 },
  goblin: { hp: 12, atk: 5, armor: 1 },
  wraith: { hp: 18, atk: 7, armor: 2 },
};

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

export function spawnEnemy(archetype: EnemyArchetype, pos: Pos, depth: number, seed: number): Enemy {
  const s = ENEMY_STATS[archetype];
  const depthScale = 1 + (depth - 1) * 0.15;
  return {
    id: nextId('e'),
    kind: 'enemy',
    archetype,
    pos,
    hp: Math.round(s.hp * depthScale),
    maxHp: Math.round(s.hp * depthScale),
    attack: Math.round(s.atk * depthScale),
    armor: s.armor,
    seed,
  };
}

export interface NewRunParams {
  seed: string;
  depth: number;
  delvers: Delver[];
}

export function createWorld(params: NewRunParams): World {
  const rng: Rng = sfc32(`${params.seed}:depth${params.depth}`);
  const dungeon = generateDungeon(rng);

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

  // Spawn enemies — count scales with depth
  const enemyCount = 3 + Math.floor(params.depth * 1.5);
  const spawnPositions = pickSpawnsInRooms(dungeon.rooms, rng, enemyCount, [dungeon.entrance]);
  const enemies: Enemy[] = spawnPositions.map((pos) => {
    const archetype = rngPick<EnemyArchetype>(rng, ['slime', 'slime', 'goblin', 'goblin', 'wraith']);
    return spawnEnemy(archetype, pos, params.depth, rngInt(rng, 0, 1e9));
  });

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
        message: `Descent ${params.depth} begins — ${params.delvers.length} delver(s), ${enemies.length} hostile(s).`,
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
