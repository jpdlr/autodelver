<script lang="ts">
  import { game } from '../../stores/game.svelte';
  import { auth } from '../../stores/auth.svelte';
  import { loadRankings, rankingScore, type RankingEntry } from '../../persistence/rankings';
  import type { RunRecord } from '../../engine/types';
  import { onMount } from 'svelte';

  let onlineEntries = $state<RankingEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Local fallback: dedupe runHistory by player so each shows their best
  // run — matches the Home screen's leaderboard behaviour so the two
  // surfaces never disagree.
  const localEntries = $derived.by<RankingEntry[]>(() => {
    const best = new Map<string, RunRecord>();
    for (const r of game.meta.runHistory) {
      const key = r.playerId || r.username;
      const prev = best.get(key);
      if (!prev || rankingScore(r) > rankingScore(prev)) best.set(key, r);
    }
    return [...best.values()]
      .sort((a, b) => rankingScore(b) - rankingScore(a))
      .map((r) => ({ ...r, score: rankingScore(r) }));
  });

  const entries = $derived<RankingEntry[]>(
    onlineEntries.length ? onlineEntries : localEntries,
  );
  const showingLocal = $derived(onlineEntries.length === 0 && localEntries.length > 0);

  async function refresh(): Promise<void> {
    loading = true;
    error = null;
    try {
      onlineEntries = await loadRankings(50);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Seed with whatever the game store already has so users don't see a
    // flash of empty state on mount.
    if (game.onlineRankings.length) onlineEntries = game.onlineRankings;
    void refresh();
  });

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  function back(): void {
    game.returnHome();
  }

  const ownUid = $derived(auth.user?.uid ?? null);
</script>

<section class="lb">
  <header>
    <button type="button" class="back" onclick={back} title="Back to home">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      <span>Home</span>
    </button>
    <div>
      <p class="eyebrow">Hall of the Deepest</p>
      <h2>Leaderboard</h2>
    </div>
    <button type="button" class="refresh" onclick={refresh} disabled={loading} title="Refresh">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" class:spin={loading}><path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    </button>
  </header>

  <div class="body">
    {#if error}
      <div class="err">Could not load leaderboard: {error}</div>
    {:else if loading && entries.length === 0}
      <div class="empty">Fetching the deepest delves…</div>
    {:else if entries.length === 0}
      <div class="empty">No runs submitted yet. Be the first to fall in public.</div>
    {:else}
      <div class="col">
        {#if showingLocal}
          <div class="local-note">Showing local run history — Firestore returned no entries.</div>
        {/if}
        <ol class="rows">
        {#each entries as e, i}
          <li class="row" class:you={e.playerId === ownUid}>
            <span class="rank">{i + 1}</span>
            <div class="who">
              <span class="name">{e.username}</span>
              {#if e.playerId === ownUid}<span class="chip">You</span>{/if}
            </div>
            <div class="stats">
              <span class="depth"><strong>{e.depth}</strong><em>depth</em></span>
              <span class="ticks"><strong>{e.ticks}</strong><em>ticks</em></span>
              <span class="insight"><strong>{e.insightEarned}</strong><em>insight</em></span>
            </div>
            <div class="meta">
              <span class="cause" title={e.causeOfDeath}>{e.causeOfDeath}</span>
              <span class="date">{formatDate(e.finishedAt)}</span>
            </div>
          </li>
        {/each}
        </ol>
      </div>
    {/if}
  </div>
</section>

<style>
  .lb {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-5);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  header > div {
    text-align: center;
  }
  .back,
  .refresh {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: var(--fs-xs);
  }
  .refresh { padding: 6px; }
  .back:hover, .refresh:hover:not(:disabled) { color: var(--color-text); }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  h2 { margin: 2px 0 0; color: var(--color-text); font-size: var(--fs-xl); }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--sp-5);
    display: flex;
    justify-content: center;
  }
  .empty, .err {
    align-self: center;
    padding: var(--sp-4) var(--sp-6);
    color: var(--color-text-muted);
    text-align: center;
  }
  .err { color: var(--color-danger, #c94a4a); }

  .col {
    width: min(880px, 100%);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .local-note {
    padding: var(--sp-2) var(--sp-3);
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
    text-align: center;
  }
  .rows {
    width: 100%;
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    grid-template-areas:
      'rank who stats'
      'rank meta meta';
    gap: 8px 16px;
    padding: var(--sp-3) var(--sp-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    align-items: center;
  }
  .row.you {
    background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
  }
  .rank {
    grid-area: rank;
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    color: var(--color-text-subtle);
    text-align: center;
  }
  .row:nth-child(1) .rank { color: var(--color-accent); font-weight: 700; }
  .row:nth-child(2) .rank { color: color-mix(in srgb, var(--color-accent) 70%, var(--color-text-subtle)); }
  .row:nth-child(3) .rank { color: color-mix(in srgb, var(--color-accent) 40%, var(--color-text-subtle)); }
  .who {
    grid-area: who;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    color: var(--color-text);
  }
  .chip {
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 2px 6px;
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border-radius: 999px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .stats {
    grid-area: stats;
    display: flex;
    gap: var(--sp-3);
    flex-shrink: 0;
  }
  .stats span {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-family: var(--font-mono);
  }
  .stats strong {
    font-size: var(--fs-md);
    color: var(--color-text);
    font-weight: 700;
    line-height: 1;
  }
  .stats em {
    font-size: 10px;
    color: var(--color-text-subtle);
    font-style: normal;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }
  .meta {
    grid-area: meta;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--sp-3);
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
  }
  .cause {
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .date { flex-shrink: 0; }

  @media (max-width: 640px) {
    .row { grid-template-columns: 32px 1fr; grid-template-areas: 'rank who' 'stats stats' 'meta meta'; }
    .stats { justify-content: flex-start; }
  }
</style>
