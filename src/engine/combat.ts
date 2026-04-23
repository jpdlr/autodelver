import type { Entity, LogEvent } from './types';
import { type Rng } from './rng';

export interface AttackResult {
  damage: number;
  crit: boolean;
  killed: boolean;
  events: LogEvent[];
}

/**
 * Deterministic combat resolution.
 *   damage = max(1, attack + roll - armor), roll in [-2..+2], 10% crit → *1.5 floored.
 */
export function resolveAttack(
  tick: number,
  attacker: Entity,
  target: Entity,
  rng: Rng,
): AttackResult {
  const roll = Math.floor(rng() * 5) - 2; // -2..+2
  const crit = rng() < 0.1;
  let dmg = Math.max(1, attacker.attack + roll - target.armor);
  if (crit) dmg = Math.floor(dmg * 1.5);

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
