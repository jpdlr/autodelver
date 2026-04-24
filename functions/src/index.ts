import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const MAX_BYTES_PER_SCRIPT = 50_000;
const CLASSES = ['warrior', 'ranger', 'cleric'] as const;
type DelverClass = (typeof CLASSES)[number];

interface SaveScriptsInput {
  scripts: Record<DelverClass, string>;
}

/**
 * Stores the caller's per-class scripts under scripts/{uid}. We use a
 * callable Function rather than direct Firestore writes so:
 *   - scripts/* is locked down to admin writes only via security rules
 *   - we can enforce per-field size caps and schema centrally
 *   - future work (rate limiting, abuse audit, offensive-content checks)
 *     has a natural home here.
 *
 * Reads stay direct from the client (the 'scripts/{uid}' rule allows the
 * owner to read their own doc), so startup is one round-trip.
 */
export const saveScripts = onCall<SaveScriptsInput>(
  { cors: true, memory: '256MiB', timeoutSeconds: 10 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const input = request.data?.scripts;
    if (!input || typeof input !== 'object') {
      throw new HttpsError('invalid-argument', 'Missing scripts payload.');
    }

    const payload: Record<DelverClass, string> = {
      warrior: '',
      ranger: '',
      cleric: '',
    };

    for (const cls of CLASSES) {
      const v = (input as Record<string, unknown>)[cls];
      if (typeof v !== 'string') {
        throw new HttpsError(
          'invalid-argument',
          `scripts.${cls} must be a string.`,
        );
      }
      // Count bytes in UTF-8 (rules run on serialized JSON so we charge
      // fairly for non-ASCII too).
      const bytes = Buffer.byteLength(v, 'utf8');
      if (bytes > MAX_BYTES_PER_SCRIPT) {
        throw new HttpsError(
          'invalid-argument',
          `scripts.${cls} is ${bytes} bytes, max is ${MAX_BYTES_PER_SCRIPT}.`,
        );
      }
      payload[cls] = v;
    }

    await getFirestore()
      .doc(`scripts/${uid}`)
      .set(
        {
          ...payload,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return { ok: true };
  },
);
