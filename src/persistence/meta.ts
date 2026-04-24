import { DEFAULT_META, type MetaProgression } from '../engine/types';

const KEY = 'autodelver:meta:v1';

export function loadMeta(): MetaProgression {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return withPlayerId({ ...DEFAULT_META });
    const parsed = JSON.parse(raw) as Partial<MetaProgression>;
    return withPlayerId({ ...DEFAULT_META, ...parsed });
  } catch {
    return withPlayerId({ ...DEFAULT_META });
  }
}

export function saveMeta(m: MetaProgression): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* quota / private mode */
  }
}

export function resetMeta(): MetaProgression {
  const fresh = withPlayerId({ ...DEFAULT_META });
  saveMeta(fresh);
  return fresh;
}

function withPlayerId(meta: MetaProgression): MetaProgression {
  if (meta.playerId) return meta;
  return {
    ...meta,
    playerId: `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  };
}
