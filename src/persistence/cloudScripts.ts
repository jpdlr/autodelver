import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { DelverClass } from '../engine/types';
import { firestoreDb } from './firebase';
import { initializeApp, getApps } from 'firebase/app';

const COLLECTION = 'scripts';
export const MAX_SCRIPT_BYTES = 50_000;

export interface CloudScripts {
  warrior: string;
  ranger: string;
  cleric: string;
  updatedAt?: number;
}

function functionsInstance() {
  // Reuse the already-initialized app from firebase.ts by name lookup.
  const app = getApps()[0];
  if (!app) {
    // Shouldn't happen — firebase.ts always initializes first — but guard.
    initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
  }
  return getFunctions(getApps()[0], 'us-central1');
}

/** Reads the player's saved scripts directly from Firestore. The rule
 *  allows auth.uid == doc id, so this is one round-trip. Returns null if
 *  no doc exists or Firestore isn't configured. */
export async function loadCloudScripts(uid: string): Promise<CloudScripts | null> {
  const db = firestoreDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (
      typeof data.warrior !== 'string' ||
      typeof data.ranger !== 'string' ||
      typeof data.cleric !== 'string'
    ) {
      return null;
    }
    return {
      warrior: data.warrior,
      ranger: data.ranger,
      cleric: data.cleric,
      updatedAt: data.updatedAt?.toMillis?.() ?? 0,
    };
  } catch (err) {
    console.warn('[cloudScripts] load failed', err);
    return null;
  }
}

/** Persist all three scripts via the saveScripts Cloud Function. Writes
 *  to scripts/* are rejected by rules unless coming from the Admin SDK,
 *  so the function is the only path in. */
export async function saveCloudScripts(
  scripts: Record<DelverClass, string>,
): Promise<void> {
  try {
    const call = httpsCallable<{ scripts: Record<DelverClass, string> }, { ok: boolean }>(
      functionsInstance(),
      'saveScripts',
    );
    await call({ scripts: capAll(scripts) });
  } catch (err) {
    // Don't surface to UI — scripts remain in localStorage as a fallback.
    console.warn('[cloudScripts] save failed', err);
  }
}

function capAll(s: Record<DelverClass, string>): Record<DelverClass, string> {
  return {
    warrior: capBytes(s.warrior),
    ranger: capBytes(s.ranger),
    cleric: capBytes(s.cleric),
  };
}

function capBytes(s: string): string {
  // Match the function's MAX_BYTES_PER_SCRIPT. Use TextEncoder for an
  // accurate UTF-8 byte count; fall back to length if unavailable.
  try {
    const bytes = new TextEncoder().encode(s);
    if (bytes.length <= MAX_SCRIPT_BYTES) return s;
    // Slice conservatively — character boundary isn't critical; the
    // function just rejects oversize, this is a safety trim.
    return new TextDecoder().decode(bytes.slice(0, MAX_SCRIPT_BYTES));
  } catch {
    return s.length > MAX_SCRIPT_BYTES ? s.slice(0, MAX_SCRIPT_BYTES) : s;
  }
}

/** Debounced saver — coalesces rapid script edits into a single call. */
export function makeScriptSync(debounceMs = 1500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Record<DelverClass, string> | null = null;
  return {
    schedule(next: Record<DelverClass, string>): void {
      pending = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (pending) {
          const snap = pending;
          pending = null;
          void saveCloudScripts(snap);
        }
      }, debounceMs);
    },
    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (pending) {
        const snap = pending;
        pending = null;
        await saveCloudScripts(snap);
      }
    },
  };
}
