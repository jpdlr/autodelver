export type EntityId = string;

export type Pos = { x: number; y: number };

export type TileKind = 'wall' | 'floor' | 'door' | 'stairs-down';

export type DelverClass = 'warrior' | 'ranger' | 'cleric';

export type EnemyArchetype = 'slime' | 'goblin' | 'wraith';

export interface BaseEntity {
  id: EntityId;
  pos: Pos;
  hp: number;
  maxHp: number;
}

export interface Delver extends BaseEntity {
  kind: 'delver';
  class: DelverClass;
  name: string;
  mp: number;
  maxMp: number;
  attack: number;
  armor: number;
  range: number;
  script: string;
  memory: Record<string, unknown>;
  cooldowns: {
    heal: number;
  };
  reviveUsedDepth: number | null;
  downedFor: number;
  color: string;
}

export interface Enemy extends BaseEntity {
  kind: 'enemy';
  archetype: EnemyArchetype;
  attack: number;
  armor: number;
  seed: number;
}

export type Entity = Delver | Enemy;

export interface Grid {
  width: number;
  height: number;
  tiles: Uint8Array;
}

export type Action =
  | { type: 'move'; target: Pos }
  | { type: 'attack'; target: EntityId }
  | { type: 'heal'; target: EntityId }
  | { type: 'revive'; target: EntityId }
  | { type: 'wait' }
  | { type: 'retreat' }
  | { type: 'descend' };

export interface LogEvent {
  tick: number;
  kind:
    | 'spawn'
    | 'move'
    | 'attack'
    | 'damage'
    | 'heal'
    | 'death'
    | 'floor-cleared'
    | 'descend'
    | 'script-error'
    | 'budget-miss'
    | 'info';
  actorId?: EntityId;
  targetId?: EntityId;
  message: string;
  data?: Record<string, unknown>;
}

export type RunStatus = 'running' | 'cleared' | 'wiped';

export interface World {
  seed: string;
  depth: number;
  tick: number;
  grid: Grid;
  delvers: Delver[];
  enemies: Enemy[];
  entrance: Pos;
  stairs: Pos;
  events: LogEvent[];
  status: RunStatus;
}

export interface MetaProgression {
  playerId: string;
  username: string;
  insight: number;
  deepestDepth: number;
  totalRuns: number;
  totalDeaths: number;
  unlockedApis: string[];
  runHistory: RunRecord[];
}

export interface RunRecord {
  id: string;
  playerId: string;
  username: string;
  depth: number;
  ticks: number;
  insightEarned: number;
  causeOfDeath: string;
  finishedAt: string;
  /** Scripts as they were at the moment the run launched. Added later —
   *  run history from older builds leaves this undefined. */
  launchScripts?: {
    warrior: string;
    ranger: string;
    cleric: string;
  };
}

/** Compact per-tick snapshot used to rebuild the world for the replay
 *  scrubber. Only entity positions/hp change per tick; the grid is
 *  static so it's not duplicated here. */
export interface TickFrame {
  tick: number;
  delvers: { id: EntityId; x: number; y: number; hp: number; mp: number; downedFor: number }[];
  enemies: { id: EntityId; x: number; y: number; hp: number }[];
}

/** Full trace of the last run, held in memory until a new run starts.
 *  Not persisted — replay only covers the run you just finished. */
export interface RunTrace {
  grid: Grid;
  stairs: Pos;
  entrance: Pos;
  delverMeta: { id: EntityId; class: DelverClass; name: string; maxHp: number; maxMp: number }[];
  enemyMeta: { id: EntityId; archetype: EnemyArchetype; maxHp: number }[];
  frames: TickFrame[];
  events: LogEvent[];
  launchScripts: { warrior: string; ranger: string; cleric: string };
}

export const DEFAULT_META: MetaProgression = {
  playerId: '',
  username: '',
  insight: 0,
  deepestDepth: 0,
  totalRuns: 0,
  totalDeaths: 0,
  unlockedApis: [],
  runHistory: [],
};
