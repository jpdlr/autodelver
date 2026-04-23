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
  script: string;
  memory: Record<string, unknown>;
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
  insight: number;
  deepestDepth: number;
  totalRuns: number;
  totalDeaths: number;
  unlockedApis: string[];
}

export const DEFAULT_META: MetaProgression = {
  insight: 0,
  deepestDepth: 0,
  totalRuns: 0,
  totalDeaths: 0,
  unlockedApis: [],
};
