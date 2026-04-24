"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveScripts = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
(0, v2_1.setGlobalOptions)({ region: 'us-central1', maxInstances: 10 });
const MAX_BYTES_PER_SCRIPT = 50_000;
const CLASSES = ['warrior', 'ranger', 'cleric'];
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
exports.saveScripts = (0, https_1.onCall)({ cors: true, memory: '256MiB', timeoutSeconds: 10 }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required.');
    }
    const input = request.data?.scripts;
    if (!input || typeof input !== 'object') {
        throw new https_1.HttpsError('invalid-argument', 'Missing scripts payload.');
    }
    const payload = {
        warrior: '',
        ranger: '',
        cleric: '',
    };
    for (const cls of CLASSES) {
        const v = input[cls];
        if (typeof v !== 'string') {
            throw new https_1.HttpsError('invalid-argument', `scripts.${cls} must be a string.`);
        }
        // Count bytes in UTF-8 (rules run on serialized JSON so we charge
        // fairly for non-ASCII too).
        const bytes = Buffer.byteLength(v, 'utf8');
        if (bytes > MAX_BYTES_PER_SCRIPT) {
            throw new https_1.HttpsError('invalid-argument', `scripts.${cls} is ${bytes} bytes, max is ${MAX_BYTES_PER_SCRIPT}.`);
        }
        payload[cls] = v;
    }
    await (0, firestore_1.getFirestore)()
        .doc(`scripts/${uid}`)
        .set({
        ...payload,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
});
//# sourceMappingURL=index.js.map