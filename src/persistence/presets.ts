import type { DelverClass } from '../engine/types';

/**
 * Named script presets ("notebook") per hero class. Pure-localStorage for
 * now — cross-device sync for the active draft already lives in
 * cloudScripts; presets are a local scratchpad.
 */

const KEY_PREFIX = 'autodelver:presets:v1:';
const MAX_PER_CLASS = 20;
const MAX_NAME = 48;

export interface ScriptPreset {
  id: string;
  name: string;
  script: string;
  createdAt: number;
  updatedAt: number;
}

function storageKey(cls: DelverClass): string {
  return KEY_PREFIX + cls;
}

function nextId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
}

export function loadPresets(cls: DelverClass): ScriptPreset[] {
  try {
    const raw = localStorage.getItem(storageKey(cls));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is ScriptPreset =>
        !!p &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.script === 'string',
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        script: p.script,
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function writePresets(cls: DelverClass, presets: ScriptPreset[]): void {
  try {
    localStorage.setItem(storageKey(cls), JSON.stringify(presets.slice(0, MAX_PER_CLASS)));
  } catch {
    /* storage full or disabled — swallow */
  }
}

export function savePreset(cls: DelverClass, name: string, script: string): ScriptPreset[] {
  const clean = sanitizeName(name) || 'Untitled';
  const now = Date.now();
  const list = loadPresets(cls);
  // If a preset with the same name already exists, overwrite it in place
  // rather than duplicating — matches the natural user expectation.
  const existingIdx = list.findIndex((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], script, updatedAt: now };
  } else {
    list.unshift({ id: nextId(), name: clean, script, createdAt: now, updatedAt: now });
  }
  writePresets(cls, list);
  return loadPresets(cls);
}

export function deletePreset(cls: DelverClass, id: string): ScriptPreset[] {
  const list = loadPresets(cls).filter((p) => p.id !== id);
  writePresets(cls, list);
  return list;
}

export function renamePreset(cls: DelverClass, id: string, newName: string): ScriptPreset[] {
  const clean = sanitizeName(newName);
  if (!clean) return loadPresets(cls);
  const list = loadPresets(cls).map((p) =>
    p.id === id ? { ...p, name: clean, updatedAt: Date.now() } : p,
  );
  writePresets(cls, list);
  return list;
}

/** Propose a non-colliding name for a "Duplicate" action. */
export function suggestDuplicateName(cls: DelverClass, base = 'Draft'): string {
  const names = new Set(loadPresets(cls).map((p) => p.name.toLowerCase()));
  let n = 1;
  while (names.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}
