import type { Action, Delver, Enemy, EntityId, Pos } from '../engine/types';

export interface CtxEntitySnapshot {
  id: EntityId;
  kind: 'delver' | 'enemy';
  pos: Pos;
  hp: number;
  maxHp: number;
}

export interface CtxSelf extends CtxEntitySnapshot {
  kind: 'delver';
  mp: number;
  maxMp: number;
  class: string;
  name: string;
}

export interface CtxSnapshot {
  tick: number;
  depth: number;
  self: CtxSelf;
  party: CtxEntitySnapshot[];
  enemies: CtxEntitySnapshot[];
  stairs: Pos;
  entrance: Pos;
  memory: Record<string, unknown>;
  unlocked: string[];
}

export function buildSnapshot(
  self: Delver,
  party: Delver[],
  enemies: Enemy[],
  tick: number,
  depth: number,
  stairs: Pos,
  entrance: Pos,
  unlocked: Set<string>,
): CtxSnapshot {
  // Deep-unproxy via JSON round-trip — Svelte 5 $state objects are Proxies
  // that can't be structured-cloned across postMessage.
  const snapshot: CtxSnapshot = {
    tick,
    depth,
    self: {
      id: self.id,
      kind: 'delver',
      pos: { x: self.pos.x, y: self.pos.y },
      hp: self.hp,
      maxHp: self.maxHp,
      mp: self.mp,
      maxMp: self.maxMp,
      class: self.class,
      name: self.name,
    },
    party: party
      .filter((d) => d.id !== self.id)
      .map((d) => ({
        id: d.id,
        kind: 'delver' as const,
        pos: { x: d.pos.x, y: d.pos.y },
        hp: d.hp,
        maxHp: d.maxHp,
      })),
    enemies: enemies
      .filter((e) => e.hp > 0)
      .map((e) => ({
        id: e.id,
        kind: 'enemy' as const,
        pos: { x: e.pos.x, y: e.pos.y },
        hp: e.hp,
        maxHp: e.maxHp,
      })),
    stairs: { x: stairs.x, y: stairs.y },
    entrance: { x: entrance.x, y: entrance.y },
    memory: JSON.parse(JSON.stringify(self.memory ?? {})),
    unlocked: [...unlocked],
  };
  return snapshot;
}

export type WorkerAction = Action;
