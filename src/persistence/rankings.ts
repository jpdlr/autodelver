import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import type { RunRecord } from '../engine/types';
import { firestoreDb } from './firebase';

export interface RankingEntry extends RunRecord {
  score: number;
}

const COLLECTION = 'rankings';

export function rankingScore(run: Pick<RunRecord, 'depth' | 'ticks'>): number {
  return run.depth * 1_000_000 - run.ticks;
}

export async function submitRanking(run: RunRecord): Promise<void> {
  const db = firestoreDb();
  if (!db) return;
  const entry: RankingEntry = {
    ...run,
    username: sanitizeUsername(run.username),
    score: rankingScore(run),
  };
  await setDoc(doc(db, COLLECTION, run.id), {
    ...entry,
    submittedAt: serverTimestamp(),
  });
}

export async function savePlayerProfile(playerId: string, username: string): Promise<void> {
  const db = firestoreDb();
  if (!db || !username.trim()) return;
  await setDoc(
    doc(db, 'players', playerId),
    {
      username: sanitizeUsername(username),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function loadRankings(count = 10): Promise<RankingEntry[]> {
  const db = firestoreDb();
  if (!db) return [];
  const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('score', 'desc'), limit(count)));
  return snapshot.docs.map((d) => d.data() as RankingEntry);
}

function sanitizeUsername(username: string): string {
  return username.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Anonymous Delver';
}
