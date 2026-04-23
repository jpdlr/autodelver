import type { DelverClass } from '../engine/types';

const KEY_PREFIX = 'autodelver:script:v1:';

// Shared helpers injected verbatim. Keeping them inside each class lets
// players edit freely without shared-file gymnastics.
const HELPERS = `
function _dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function _nearestEnemy(ctx) {
  let best = null, bestD = Infinity;
  for (const e of ctx.enemies) {
    const d = _dist(ctx.self.pos, e.pos);
    if (d < bestD) { bestD = d; best = e; }
  }
  return { enemy: best, dist: bestD };
}
function _leader(ctx) {
  // Warrior if alive, otherwise self
  const w = ctx.party.find(p => p.hp > 0);
  return w ? w.pos : ctx.self.pos;
}
`;

export const DEFAULT_SCRIPTS: Record<DelverClass, string> = {
  warrior: `// Warrior — front-line tank. Engages anything nearby.
${HELPERS}

function tick(ctx) {
  const self = ctx.self;
  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }
  if (self.hp < 12) return { type: 'retreat' };

  const { enemy, dist } = _nearestEnemy(ctx);
  if (enemy && dist === 1) return { type: 'attack', target: enemy.id };
  if (enemy && dist <= 8) return { type: 'move', target: enemy.pos };
  return { type: 'move', target: ctx.stairs };
}
`,

  ranger: `// Ranger — fragile, keeps distance. Only engages when warrior is tanking.
${HELPERS}

function tick(ctx) {
  const self = ctx.self;
  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }
  // Retreat aggressively — thin HP
  if (self.hp < 18) return { type: 'retreat' };

  const { enemy, dist } = _nearestEnemy(ctx);
  // Only attack if adjacent AND someone else is also adjacent (kite behind tank)
  if (enemy && dist === 1) {
    const flanker = ctx.party.find(p =>
      p.hp > 0 && _dist(p.pos, enemy.pos) === 1
    );
    if (flanker) return { type: 'attack', target: enemy.id };
    // Alone with an adjacent enemy — fall back
    return { type: 'retreat' };
  }
  // Stay near the leader, not running ahead
  const leader = _leader(ctx);
  if (_dist(self.pos, leader) > 3) {
    return { type: 'move', target: leader };
  }
  return { type: 'move', target: ctx.stairs };
}
`,

  cleric: `// Cleric — middle of the pack. Retreats early, stays behind warrior.
${HELPERS}

function tick(ctx) {
  const self = ctx.self;
  if (self.pos.x === ctx.stairs.x && self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }
  if (self.hp < 18) return { type: 'retreat' };

  const { enemy, dist } = _nearestEnemy(ctx);
  if (enemy && dist === 1) return { type: 'attack', target: enemy.id };
  // Stay tight with the group
  const leader = _leader(ctx);
  if (_dist(self.pos, leader) > 2) {
    return { type: 'move', target: leader };
  }
  return { type: 'move', target: ctx.stairs };
}
`,
};

export function loadScript(cls: DelverClass): string {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + cls);
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_SCRIPTS[cls];
}

export function saveScript(cls: DelverClass, script: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + cls, script);
  } catch {
    /* ignore */
  }
}

export function resetScript(cls: DelverClass): string {
  try {
    localStorage.removeItem(KEY_PREFIX + cls);
  } catch {
    /* ignore */
  }
  return DEFAULT_SCRIPTS[cls];
}
