import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { DelverClass } from '../engine/types';
import { firestoreDb } from './firebase';

const COLLECTION = 'scripts';
export const MAX_SCRIPT_BYTES = 50_000;

export interface CloudScripts {
  warrior: string;
  ranger: string;
  cleric: string;
  updatedAt?: number;
}

/** Fetch the player's saved scripts from Firestore. Returns null if none or
 *  Firestore isn't configured. */
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

/** Persist all three scripts under the player's uid. Size-capped to
 *  MAX_SCRIPT_BYTES per class before being sent. */
export async function saveCloudScripts(
  uid: string,
  scripts: Record<DelverClass, string>,
): Promise<void> {
  const db = firestoreDb();
  if (!db) return;
  const payload = {
    warrior: capBytes(scripts.warrior),
    ranger: capBytes(scripts.ranger),
    cleric: capBytes(scripts.cleric),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, COLLECTION, uid), payload, { merge: true });
  } catch (err) {
    console.warn('[cloudScripts] save failed', err);
  }
}

function capBytes(s: string): string {
  // Guard against pathological scripts. We cap by UTF-16 length as a proxy
  // for byte count — rules will reject anything larger on the server.
  return s.length > MAX_SCRIPT_BYTES ? s.slice(0, MAX_SCRIPT_BYTES) : s;
}

/** Create a debounced saver scoped to a given uid. */
export function makeScriptSync(uid: string, debounceMs = 1500) {
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
          void saveCloudScripts(uid, snap);
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
        await saveCloudScripts(uid, snap);
      }
    },
  };
}
