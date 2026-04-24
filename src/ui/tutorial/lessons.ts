import type { Delver, DelverClass, Enemy, Pos, World } from '../../engine/types';
import { TILE, createGrid } from '../../engine/grid';
import { spawnDelver, spawnEnemy, resetEntityCounter } from '../../engine/world';

/**
 * Hand-crafted lesson maps use single-character tiles for readability:
 *   `#` wall        `.` floor        `>` stairs-down
 *   `W` warrior start (Grimm)
 *   `R` ranger start (Vex)
 *   `C` cleric start (Mira)
 *   `s` slime       `g` goblin       `w` wraith
 */
const CHAR_TO_TILE: Record<string, keyof typeof TILE | undefined> = {
  '#': 'wall',
  '.': 'floor',
  ' ': 'floor',
  '>': 'stairs-down',
  W: 'floor',
  R: 'floor',
  C: 'floor',
  s: 'floor',
  g: 'floor',
  w: 'floor',
};

const ENEMY_CHARS: Record<string, 'slime' | 'goblin' | 'wraith'> = {
  s: 'slime',
  g: 'goblin',
  w: 'wraith',
};

type DelverOverride = Partial<Omit<Delver, 'id' | 'kind' | 'class' | 'pos' | 'script'>>;

export interface LessonBuild {
  world: World;
  participating: DelverClass[];
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  briefing: string[];
  hints: string[];
  /** Scripts pre-filled into the editor for each participating class. */
  starter: Partial<Record<DelverClass, string>>;
  /** Which class the player is actively editing (monaco default tab). */
  focus: DelverClass;
  /** Who is on the map. Non-participants are hidden from this lesson. */
  participants: DelverClass[];
  /** Builds the starting world from a hand-drawn map. */
  build: () => LessonBuild;
  /** Called after every tick + once more on status change. */
  check: (world: World) => LessonCheck;
}

export interface LessonCheck {
  /** 'running' = lesson ongoing. 'pass' = objective met. 'fail' = reset. */
  status: 'running' | 'pass' | 'fail';
  message?: string;
}

/** Parse an ASCII map into a Grid + entity start positions. */
function parseMap(
  map: string[],
): {
  width: number;
  height: number;
  tiles: Uint8Array;
  delverStarts: Partial<Record<DelverClass, Pos>>;
  enemyStarts: { archetype: 'slime' | 'goblin' | 'wraith'; pos: Pos }[];
  stairs: Pos;
  entrance: Pos;
} {
  const width = Math.max(...map.map((r) => r.length));
  const height = map.length;
  const tiles = new Uint8Array(width * height);
  const delverStarts: Partial<Record<DelverClass, Pos>> = {};
  const enemyStarts: { archetype: 'slime' | 'goblin' | 'wraith'; pos: Pos }[] = [];
  let stairs: Pos | null = null;
  let firstDelver: Pos | null = null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = map[y][x] ?? '#';
      const tile = CHAR_TO_TILE[ch] ?? 'wall';
      tiles[y * width + x] = TILE[tile];
      if (ch === '>') stairs = { x, y };
      if (ch === 'W') delverStarts.warrior = { x, y };
      if (ch === 'R') delverStarts.ranger = { x, y };
      if (ch === 'C') delverStarts.cleric = { x, y };
      if (ch in ENEMY_CHARS) {
        enemyStarts.push({ archetype: ENEMY_CHARS[ch]!, pos: { x, y } });
      }
      if ((ch === 'W' || ch === 'R' || ch === 'C') && !firstDelver) {
        firstDelver = { x, y };
      }
    }
  }

  if (!stairs) throw new Error('Lesson map missing stairs (>)');
  if (!firstDelver) throw new Error('Lesson map missing at least one delver start');

  return {
    width,
    height,
    tiles,
    delverStarts,
    enemyStarts,
    stairs,
    entrance: firstDelver,
  };
}

function buildWorld(opts: {
  map: string[];
  participants: DelverClass[];
  scripts: Partial<Record<DelverClass, string>>;
  overrides?: Partial<Record<DelverClass, DelverOverride>>;
  seed?: string;
}): World {
  resetEntityCounter();
  const parsed = parseMap(opts.map);
  const grid = createGrid(parsed.width, parsed.height, 'wall');
  grid.tiles.set(parsed.tiles);

  const classNames: Record<DelverClass, string> = {
    warrior: 'Grimm',
    ranger: 'Vex',
    cleric: 'Mira',
  };

  const delvers: Delver[] = opts.participants.map((cls) => {
    const pos = parsed.delverStarts[cls] ?? parsed.entrance;
    const base = spawnDelver({
      class: cls,
      name: classNames[cls],
      pos,
      script: opts.scripts[cls] ?? '',
    });
    return { ...base, ...(opts.overrides?.[cls] ?? {}) };
  });

  const enemies: Enemy[] = parsed.enemyStarts.map((e, i) =>
    spawnEnemy(e.archetype, e.pos, 1, i + 1),
  );

  return {
    seed: opts.seed ?? 'tutorial',
    depth: 1,
    tick: 0,
    grid,
    delvers,
    enemies,
    entrance: parsed.entrance,
    stairs: parsed.stairs,
    events: [
      { tick: 0, kind: 'info', message: 'Lesson begins.' },
    ],
    status: 'running',
  };
}

// ═════════════════════════════════════════════════════════════════
// LESSON 1 — Warrior moves to stairs
// ═════════════════════════════════════════════════════════════════
const L1_MAP = [
  '############',
  '#W........>#',
  '############',
];
const L1_STARTER = `// Your warrior needs to reach the stairs.
// ctx.self.pos is his current tile. ctx.stairs is the target.
// Return a "move" action to walk one tile toward target,
// or a "descend" action when already standing on the stairs.

function tick(ctx) {
  // Already on the stairs? Go down.
  // TODO: check if ctx.self.pos matches ctx.stairs, return { type: 'descend' }.

  // Otherwise walk toward the stairs.
  return { type: 'move', target: ctx.stairs };
}
`;

// ═════════════════════════════════════════════════════════════════
// LESSON 2 — Warrior kills a slime in the way
// ═════════════════════════════════════════════════════════════════
const L2_MAP = [
  '############',
  '#W...s....>#',
  '############',
];
const L2_STARTER = `// A slime blocks the path. Walk up to it, attack it, then descend.
//
// Helpers:
//   ctx.enemies is a list of enemies with .id and .pos.
//   Math.abs(a - b) gives you a distance component.
//   You attack with { type: 'attack', target: enemy.id } when adjacent.

function tick(ctx) {
  const self = ctx.self;

  // On the stairs? Descend.
  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }

  // Find the nearest enemy.
  let near = null, best = Infinity;
  for (const e of ctx.enemies) {
    const d = Math.abs(e.pos.x - self.pos.x) + Math.abs(e.pos.y - self.pos.y);
    if (d < best) { best = d; near = e; }
  }

  // TODO: if near is adjacent (best === 1), return an attack action.
  // TODO: if near exists, walk toward it; otherwise walk to the stairs.

  return { type: 'move', target: ctx.stairs };
}
`;

// ═════════════════════════════════════════════════════════════════
// LESSON 3 — Ranger kites a slime from range 3
// ═════════════════════════════════════════════════════════════════
const L3_MAP = [
  '###############',
  '#R.........s.>#',
  '###############',
];
const L3_STARTER = `// Vex's attack reaches ctx.self.range tiles away (range 3).
// Don't let the slime touch you — shoot it from a distance.

function tick(ctx) {
  const self = ctx.self;

  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }

  // Nearest enemy.
  let near = null, best = Infinity;
  for (const e of ctx.enemies) {
    const d = Math.abs(e.pos.x - self.pos.x) + Math.abs(e.pos.y - self.pos.y);
    if (d < best) { best = d; near = e; }
  }

  // TODO: if near is within self.range, attack it — don't move closer.
  // TODO: if near is too far, walk toward it (but not into melee).

  return { type: 'move', target: ctx.stairs };
}
`;

// ═════════════════════════════════════════════════════════════════
// LESSON 4 — Cleric heals herself before descending
// ═════════════════════════════════════════════════════════════════
const L4_MAP = [
  '############',
  '#C........>#',
  '############',
];
const L4_STARTER = `// Mira starts at low HP. A heal costs 2 MP and restores 5 HP, with a
// 4-tick cooldown. Heal herself at least once before reaching the stairs.
//
// Heal yourself with: { type: 'heal', target: ctx.self.id }.
// ctx.self.cooldowns.heal tells you remaining cooldown ticks.

function tick(ctx) {
  const self = ctx.self;

  // TODO: if self.hp is low AND self.cooldowns.heal === 0 AND self.mp >= 2,
  //       return a heal action targeting self.id.

  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }
  return { type: 'move', target: ctx.stairs };
}
`;

// ═════════════════════════════════════════════════════════════════
// LESSON 5 — Warrior + Cleric finale
// ═════════════════════════════════════════════════════════════════
const L5_MAP = [
  '###############',
  '#W..C....ss..>#',
  '###############',
];
const L5_WARRIOR = `// Classic tank loop — engage, attack, descend.
function tick(ctx) {
  const self = ctx.self;
  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }
  let near = null, best = Infinity;
  for (const e of ctx.enemies) {
    const d = Math.abs(e.pos.x - self.pos.x) + Math.abs(e.pos.y - self.pos.y);
    if (d < best) { best = d; near = e; }
  }
  if (near && best === 1) return { type: 'attack', target: near.id };
  if (near) return { type: 'move', target: near.pos };
  return { type: 'move', target: ctx.stairs };
}
`;
const L5_CLERIC = `// Keep the party alive. Heal the most-wounded ally when you can.
// Otherwise follow the warrior so you stay in heal range (2 tiles).

function tick(ctx) {
  const self = ctx.self;

  // TODO: look through ctx.party for an ally with hp < maxHp.
  //       If found and cooldowns.heal === 0 and mp >= 2, heal them.
  //       Remember: target by id, not by position.

  // Follow the warrior.
  const warrior = ctx.party.find(p => p.class === 'warrior' && p.hp > 0);
  if (warrior) return { type: 'move', target: warrior.pos };

  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }
  return { type: 'move', target: ctx.stairs };
}
`;

// ─── Exported lessons ────────────────────────────────────────────
export const LESSONS: Lesson[] = [
  {
    id: 'l1-move',
    title: 'First steps',
    subtitle: 'Warrior — movement',
    briefing: [
      'Grimm (warrior) alone in an empty corridor. His only job: walk to the stairs and descend.',
      'Read ctx.self.pos, compare to ctx.stairs, and return the right action.',
    ],
    hints: [
      'ctx.stairs is a { x, y }.',
      'A "move" action needs target: { x, y }.',
      'Return { type: "descend" } only when standing on the stairs.',
    ],
    starter: { warrior: L1_STARTER },
    focus: 'warrior',
    participants: ['warrior'],
    build: () =>
      ({
        world: buildWorld({
          map: L1_MAP,
          participants: ['warrior'],
          scripts: { warrior: L1_STARTER },
        }),
        participating: ['warrior'],
      }),
    check: (w) => {
      if (w.status === 'cleared') return { status: 'pass', message: 'Grimm reached the stairs.' };
      if (w.status === 'wiped') return { status: 'fail', message: 'Grimm fell.' };
      return { status: 'running' };
    },
  },
  {
    id: 'l2-combat',
    title: 'Strike the foe',
    subtitle: 'Warrior — combat',
    briefing: [
      'A slime stands between Grimm and the stairs. Close the gap, attack until it dies, then descend.',
    ],
    hints: [
      'Melee range = ctx.self.range (1 for the warrior).',
      'Attack with { type: "attack", target: enemy.id }.',
      'Distance: Math.abs(e.pos.x - self.pos.x) + Math.abs(e.pos.y - self.pos.y).',
    ],
    starter: { warrior: L2_STARTER },
    focus: 'warrior',
    participants: ['warrior'],
    build: () =>
      ({
        world: buildWorld({
          map: L2_MAP,
          participants: ['warrior'],
          scripts: { warrior: L2_STARTER },
        }),
        participating: ['warrior'],
      }),
    check: (w) => {
      if (w.status === 'cleared') return { status: 'pass', message: 'Slime down. Stairs taken.' };
      if (w.status === 'wiped') return { status: 'fail', message: 'Grimm fell to a slime.' };
      return { status: 'running' };
    },
  },
  {
    id: 'l3-range',
    title: 'Keep your distance',
    subtitle: 'Ranger — range',
    briefing: [
      'Vex has range 3 and paper armour. Shoot the slime from afar; do not let it reach you.',
    ],
    hints: [
      'Vex.range is 3 — attacks work at that distance.',
      'If the enemy is already in range, attack. Do not waste ticks walking in.',
      'If the enemy is closer than range, step back (move toward stairs or away).',
    ],
    starter: { ranger: L3_STARTER },
    focus: 'ranger',
    participants: ['ranger'],
    build: () =>
      ({
        world: buildWorld({
          map: L3_MAP,
          participants: ['ranger'],
          scripts: { ranger: L3_STARTER },
        }),
        participating: ['ranger'],
      }),
    check: (w) => {
      if (w.status === 'cleared') return { status: 'pass', message: 'Clean clear — no melee required.' };
      if (w.status === 'wiped') return { status: 'fail', message: 'Vex folded in melee.' };
      return { status: 'running' };
    },
  },
  {
    id: 'l4-heal',
    title: 'Mend the wounded',
    subtitle: 'Cleric — heal + MP',
    briefing: [
      'Mira starts wounded (12/30 HP) and must reach the stairs with more HP than she started with.',
      'Heal herself along the way. Heal: 2 MP cost, 5 HP restored, 4-tick cooldown.',
    ],
    hints: [
      '{ type: "heal", target: ctx.self.id } casts heal on herself.',
      'ctx.self.cooldowns.heal — 0 means ready.',
      'ctx.self.mp must be >= 2 to cast.',
    ],
    starter: { cleric: L4_STARTER },
    focus: 'cleric',
    participants: ['cleric'],
    build: () =>
      ({
        world: buildWorld({
          map: L4_MAP,
          participants: ['cleric'],
          scripts: { cleric: L4_STARTER },
          overrides: { cleric: { hp: 12 } },
        }),
        participating: ['cleric'],
      }),
    check: (w) => {
      const mira = w.delvers[0];
      if (w.status === 'cleared') {
        if (!mira) return { status: 'pass', message: 'Lesson complete.' };
        if (mira.hp > 12) return { status: 'pass', message: 'Mira healed herself and descended.' };
        return { status: 'fail', message: 'You descended without healing. Heal at least once before the stairs.' };
      }
      if (w.status === 'wiped') return { status: 'fail', message: 'Mira fell before reaching the stairs.' };
      return { status: 'running' };
    },
  },
  {
    id: 'l5-duo',
    title: 'Holding the line',
    subtitle: 'Warrior + Cleric — coordination',
    briefing: [
      'Two slimes block the way. Grimm tanks. Mira keeps him alive and follows at range 2.',
      'Pass: both delvers stand on/past the stairs, alive.',
    ],
    hints: [
      'ctx.party lists your allies (excluding self). Each has .id, .class, .hp, .maxHp, .pos.',
      'Heal any ally with { type: "heal", target: ally.id }.',
      'Stay close to the warrior so he remains in heal range.',
    ],
    starter: { warrior: L5_WARRIOR, cleric: L5_CLERIC },
    focus: 'cleric',
    participants: ['warrior', 'cleric'],
    build: () =>
      ({
        world: buildWorld({
          map: L5_MAP,
          participants: ['warrior', 'cleric'],
          scripts: { warrior: L5_WARRIOR, cleric: L5_CLERIC },
        }),
        participating: ['warrior', 'cleric'],
      }),
    check: (w) => {
      if (w.status === 'cleared') {
        const allAlive = w.delvers.every((d) => d.hp > 0);
        if (allAlive) return { status: 'pass', message: 'Full party, stairs reached. Graduation.' };
        return { status: 'fail', message: 'You cleared the floor but lost someone. Try again.' };
      }
      if (w.status === 'wiped') return { status: 'fail', message: 'Party wipe. Check your heal logic.' };
      return { status: 'running' };
    },
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
