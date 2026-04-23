import { DEFAULT_META, type MetaProgression } from '../engine/types';

const KEY = 'autodelver:meta:v1';

export function loadMeta(): MetaProgression {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<MetaProgression>;
    return { ...DEFAULT_META, ...parsed };
  } catch {
    return { ...DEFAULT_META };
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
  const fresh = { ...DEFAULT_META };
  saveMeta(fresh);
  return fresh;
}
