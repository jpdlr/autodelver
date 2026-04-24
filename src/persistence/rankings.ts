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
  // Firestore rules require hasOnly() on a fixed key set — be explicit
  // rather than spreading `run`, which now carries extras like
  // launchScripts that would fail validation.
  await setDoc(doc(db, COLLECTION, run.id), {
    id: run.id,
    playerId: run.playerId,
    username: sanitizeUsername(run.username),
    depth: run.depth,
    ticks: run.ticks,
    insightEarned: run.insightEarned,
    causeOfDeath: run.causeOfDeath.slice(0, 240),
    finishedAt: run.finishedAt,
    score: rankingScore(run),
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
  // Over-fetch so dedup-by-player leaves us with enough distinct players
  // to fill the board. Each run writes its own doc, but the leaderboard
  // should show one row per player (their best run).
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), orderBy('score', 'desc'), limit(count * 5)),
  );
  const entries = snapshot.docs.map((d) => d.data() as RankingEntry);
  return dedupeBestPerPlayer(entries).slice(0, count);
}

export function dedupeBestPerPlayer(entries: RankingEntry[]): RankingEntry[] {
  const best = new Map<string, RankingEntry>();
  for (const e of entries) {
    const key = e.playerId || e.username;
    const prev = best.get(key);
    if (!prev || e.score > prev.score) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function sanitizeUsername(username: string): string {
  return username.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Anonymous Delver';
}
