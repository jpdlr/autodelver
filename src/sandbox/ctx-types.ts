/**
 * The Context API type definition — shipped as a string to Monaco so players
 * get autocomplete and inline docs on `ctx.*`.
 * Source of truth for the in-game scripting surface.
 */
export const CTX_DTS = `
/** Position on the dungeon grid, integers. */
interface Pos { x: number; y: number; }

/** A read-only snapshot of another entity (party member or enemy). */
interface EntitySnapshot {
  id: string;
  kind: 'delver' | 'enemy';
  pos: Pos;
  hp: number;
  maxHp: number;
  class?: string;
  range?: number;
}

interface Self extends EntitySnapshot {
  kind: 'delver';
  mp: number;
  maxMp: number;
  class: string;
  name: string;
  attack: number;
  range: number;
  cooldowns: { heal: number };
  reviveReady: boolean;
}

/** A signal broadcast from another delver on the previous tick. */
interface Signal {
  /** ID of the delver who broadcast the signal. */
  from: string;
  /** Name passed to ctx.signal(). */
  name: string;
  /** Payload passed to ctx.signal() (JSON-serializable). */
  payload: any;
  /** Tick number when the signal was broadcast (always tick - 1). */
  tick: number;
}

/** Per-tick snapshot of the world, visible to your delver. */
interface Context {
  /** Current tick number (monotonic, increases each turn). */
  tick: number;
  /** Current dungeon depth, starting at 1. */
  depth: number;
  /** Your delver: hp, mp, pos, class. */
  self: Self;
  /** Other delvers in your party (excludes self). */
  party: EntitySnapshot[];
  /** Living enemies currently in the world. */
  enemies: EntitySnapshot[];
  /** Position of the stairs down (goal of this floor). */
  stairs: Pos;
  /** Position of the entrance to this floor. */
  entrance: Pos;
  /** Persistent per-delver scratch object; survives between ticks but not between runs. */
  memory: Record<string, any>;
  /** List of API identifiers you have unlocked this run (e.g. 'memory', 'signal'). */
  unlocked: string[];
  /** Signals broadcast by allies during the previous tick. Never includes your own. */
  signals: Signal[];
  /** Broadcast a named message to other delvers. Delivered next tick via ctx.signals.
   *  Payload must be JSON-serializable (no functions, Maps, etc). */
  signal(name: string, payload?: any): void;
}

/** Actions are plain data returned from tick(). Return one or nothing (= wait). */
type Action =
  | { type: 'wait' }
  | { type: 'move'; target: Pos }
  | { type: 'attack'; target: string }  // enemy id, uses ctx.self.range
  | { type: 'heal'; target: string }    // cleric: 2 MP, 4 tick CD, restores 5 HP
  | { type: 'revive'; target: string }  // cleric: 10 MP, once per depth, restores 5 HP
  | { type: 'retreat' }
  | { type: 'descend' };

/**
 * REQUIRED. Called every tick with a fresh snapshot.
 * Return an Action or nothing (treated as wait).
 */
declare function tick(ctx: Context): Action | void;

/** OPTIONAL. Called once at the start of the run. Use to seed memory. */
declare function onDeploy(ctx: Context): void;
`;
