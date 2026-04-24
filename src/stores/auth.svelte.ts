import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, googleProvider } from '../persistence/firebase';

function sanitizeCodename(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 24);
}

function createAuthStore() {
  let user = $state<User | null>(null);
  let codename = $state<string | null>(null);
  let loading = $state<boolean>(true);
  let error = $state<string | null>(null);

  // Kick off auth state subscription.
  const authInstance = firebaseAuth();
  if (authInstance) {
    onAuthStateChanged(authInstance, async (u) => {
      user = u;
      if (u) {
        codename = await fetchCodename(u.uid);
      } else {
        codename = null;
      }
      loading = false;
    });
  } else {
    // No firebase config — gate to an "offline" state, app stays usable
    // for local play but cloud features disabled.
    loading = false;
  }

  async function fetchCodename(uid: string): Promise<string | null> {
    const db = firestoreDb();
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, 'players', uid));
      if (snap.exists()) {
        const data = snap.data();
        return typeof data.username === 'string' ? data.username : null;
      }
    } catch (e) {
      console.warn('[auth] fetchCodename failed', e);
    }
    return null;
  }

  async function signInWithGoogle(): Promise<void> {
    const a = firebaseAuth();
    if (!a) {
      error = 'Firebase auth is not configured.';
      return;
    }
    try {
      error = null;
      await signInWithPopup(a, googleProvider());
      // onAuthStateChanged will hydrate user + codename.
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/popup-closed-by-user|cancelled-popup-request/.test(msg)) {
        error = msg;
      }
    }
  }

  async function signOut(): Promise<void> {
    const a = firebaseAuth();
    if (!a) return;
    await fbSignOut(a);
  }

  async function setCodename(raw: string): Promise<{ ok: boolean; message?: string }> {
    const db = firestoreDb();
    const u = user;
    if (!db || !u) return { ok: false, message: 'Not signed in.' };
    const clean = sanitizeCodename(raw);
    if (clean.length < 3) return { ok: false, message: 'Codename must be at least 3 characters.' };
    try {
      await setDoc(
        doc(db, 'players', u.uid),
        { username: clean, updatedAt: serverTimestamp() },
        { merge: true },
      );
      codename = clean;
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  }

  return {
    get user() { return user; },
    get codename() { return codename; },
    get loading() { return loading; },
    get error() { return error; },
    get signedIn() { return user !== null; },
    get configured() { return firebaseAuth() !== null; },
    get ready() { return !loading && (user === null || codename !== null); },
    signInWithGoogle,
    signOut,
    setCodename,
  };
}

export const auth = createAuthStore();
