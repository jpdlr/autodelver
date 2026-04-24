import type { Entity, LogEvent } from './types';
import { type Rng } from './rng';
import { COMBAT } from './balance';

export interface AttackResult {
  damage: number;
  crit: boolean;
  killed: boolean;
  events: LogEvent[];
}

/** Deterministic combat resolution. See COMBAT in balance.ts for knobs. */
export function resolveAttack(
  tick: number,
  attacker: Entity,
  target: Entity,
  rng: Rng,
): AttackResult {
  const rollRange = COMBAT.ROLL_MAX - COMBAT.ROLL_MIN + 1;
  const roll = Math.floor(rng() * rollRange) + COMBAT.ROLL_MIN;
  const crit = rng() < COMBAT.CRIT_CHANCE;
  let dmg = Math.max(1, attacker.attack + roll - target.armor);
  if (crit) dmg = Math.floor(dmg * COMBAT.CRIT_MULTIPLIER);

  target.hp = Math.max(0, target.hp - dmg);
  const killed = target.hp === 0;

  const events: LogEvent[] = [
    {
      tick,
      kind: 'attack',
      actorId: attacker.id,
      targetId: target.id,
      message: `${labelFor(attacker)} hits ${labelFor(target)} for ${dmg}${crit ? ' (CRIT)' : ''}`,
      data: { dmg, crit },
    },
  ];
  if (killed) {
    events.push({
      tick,
      kind: 'death',
      actorId: target.id,
      message: `${labelFor(target)} falls`,
    });
  }
  return { damage: dmg, crit, killed, events };
}

function labelFor(e: Entity): string {
  if (e.kind === 'delver') return `${e.name} (${e.class})`;
  return `${e.archetype} ${e.id.slice(-3)}`;
}
