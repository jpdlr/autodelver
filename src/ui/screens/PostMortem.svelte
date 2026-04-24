<script lang="ts">
  import { game } from '../../stores/game.svelte';
  import { sprites, type SpriteId } from '../sprites';
  import ReplayScrubber from '../ReplayScrubber.svelte';

  function home(): void {
    game.returnHome();
  }
  function edit(): void {
    game.screen = 'loadout';
  }
  async function retry(): Promise<void> {
    await game.startRun();
  }

  const classSprite: Record<string, SpriteId> = {
    warrior: 'grimm-warrior',
    ranger: 'vex-ranger',
    cleric: 'mira-cleric',
  };
</script>

<section class="pm">
  <div class="pm-card card">
    <header class="pm-head">
      <div class="sigil" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <path d="M32 4 L52 24 L52 44 L44 56 L32 60 L20 56 L12 44 L12 24 Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>
          <path d="M32 12 L32 52 M16 26 L48 26 M20 42 L44 42" stroke="currentColor" stroke-width="1" opacity="0.55"/>
          <circle cx="32" cy="32" r="6" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>
      <h2>The party has fallen.</h2>
      {#if game.lastRunSummary}
        <p class="sub">
          <span class="sub-cause">{game.lastRunSummary.causeOfDeath}</span>
        </p>
      {/if}
    </header>

    {#if game.lastRunSummary}
      <div class="summary-grid">
        <div class="stat-cell">
          <span class="lbl">Depth</span>
          <span class="val">{game.lastRunSummary.depth}</span>
        </div>
        <div class="stat-cell">
          <span class="lbl">Ticks</span>
          <span class="val">{game.lastRunSummary.ticks}</span>
        </div>
        <div class="stat-cell accent">
          <span class="lbl">Insight</span>
          <span class="val">+{game.lastRunSummary.insightEarned}</span>
        </div>
      </div>
    {/if}

    {#if game.world}
      <div class="detail-grid">
        <section class="panel">
          <div class="panel-label">Party</div>
          <ul class="party-list">
            {#each game.world.delvers as d}
              <li class="party-row {d.class}" class:downed={d.hp === 0}>
                <div class="portrait-sm" aria-hidden="true">
                  {@html sprites[classSprite[d.class] ?? 'grimm-warrior'].svg}
                </div>
                <div class="party-info">
                  <div class="party-top">
                    <span class="pname">{d.name}</span>
                    <span class="pstatus">{d.hp === 0 ? 'Downed' : 'Alive'}</span>
                  </div>
                  <div class="bars">
                    <div class="bar hp" title="HP">
                      <span class="bar-fill" style="width: {(d.hp / d.maxHp) * 100}%"></span>
                    </div>
                    <div class="bar-meta">
                      <span>{d.hp}/{d.maxHp} HP</span>
                      <span class="sep">·</span>
                      <span>{d.mp}/{d.maxMp} MP</span>
                    </div>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        </section>

        <section class="panel">
          <div class="panel-label">Last events</div>
          <ol class="event-list">
            {#each game.recentLog(8) as ev}
              <li class="event-row {ev.kind}">
                <span class="tick">t{ev.tick}</span>
                <span class="msg">{ev.message}</span>
              </li>
            {/each}
          </ol>
        </section>
      </div>
    {/if}

    {#if game.lastRunTrace && game.lastRunTrace.frames.length > 1}
      <ReplayScrubber trace={game.lastRunTrace} />
    {/if}

    <div class="actions">
      <button type="button" class="secondary" onclick={home}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 8L8 3l5.5 5M4 7v6h8V7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Home</span>
      </button>
      <button type="button" class="secondary" onclick={edit}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 13l2-0.5 7-7-1.5-1.5-7 7L3 13zM10.5 3.5l1.5-1.5 1.5 1.5-1.5 1.5z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/></svg>
        <span>Edit scripts</span>
      </button>
      <button type="button" class="primary" onclick={retry}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        <span>Descend again</span>
      </button>
    </div>
  </div>
</section>

<style>
  .pm {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-6);
    overflow: auto;
  }
  .pm-card {
    width: min(880px, 100%);
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    padding: var(--sp-6);
  }

  /* ─── HEADER ─────────────────────────────── */
  .pm-head {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
  }
  .sigil {
    color: var(--color-accent);
    width: 56px;
    height: 56px;
    opacity: 0.75;
  }
  .sigil svg { width: 100%; height: 100%; }
  h2 {
    margin: 0;
    color: var(--color-text);
    font-size: var(--fs-2xl);
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .sub {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--fs-sm);
    max-width: 560px;
  }
  .sub-cause {
    color: var(--color-danger, #c94a4a);
    font-family: var(--font-mono);
  }

  /* ─── SUMMARY STATS ─────────────────────── */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-3);
  }
  .stat-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--sp-3) var(--sp-2);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .stat-cell .lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  .stat-cell .val {
    font-family: var(--font-mono);
    font-size: var(--fs-2xl);
    font-weight: 700;
    color: var(--color-text);
    line-height: 1;
  }
  .stat-cell.accent {
    background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-2));
    border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
  }
  .stat-cell.accent .val {
    color: var(--color-accent);
  }

  /* ─── DETAIL: PARTY + LOG ───────────────── */
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
  }
  @media (max-width: 720px) {
    .detail-grid { grid-template-columns: 1fr; }
  }
  .panel {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-height: 0;
  }
  .panel-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }

  /* Party list */
  .party-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .party-row {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: var(--sp-2);
    align-items: center;
    padding: 6px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  .party-row.downed {
    opacity: 0.7;
  }
  .portrait-sm {
    width: 36px;
    height: 36px;
    padding: 2px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .portrait-sm :global(svg) {
    width: 100%;
    height: 100%;
  }
  .party-info { min-width: 0; }
  .party-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  .pname {
    color: var(--color-text);
    font-weight: 600;
    font-size: var(--fs-sm);
  }
  .pstatus {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  .party-row.downed .pstatus {
    color: var(--color-danger, #c94a4a);
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 4px;
  }
  .bar {
    height: 4px;
    background: var(--color-bg);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar-fill {
    display: block;
    height: 100%;
    transition: width var(--dur-base) var(--ease-out);
  }
  .party-row.warrior .bar-fill { background: var(--color-warrior); }
  .party-row.ranger  .bar-fill { background: var(--color-ranger); }
  .party-row.cleric  .bar-fill { background: var(--color-cleric); }
  .bar-meta {
    display: flex;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-subtle);
    letter-spacing: 0.04em;
  }
  .bar-meta .sep { color: var(--color-border-strong); }

  /* Event list */
  .event-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
    border-left: 1px solid var(--color-border);
    padding-left: var(--sp-3);
  }
  .event-row {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: var(--sp-2);
    align-items: baseline;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    line-height: 1.5;
    position: relative;
  }
  .event-row::before {
    content: '';
    position: absolute;
    left: calc(-1 * var(--sp-3) - 3px);
    top: 8px;
    width: 5px;
    height: 5px;
    background: var(--color-border-strong);
    border-radius: 50%;
  }
  .event-row.death::before,
  .event-row.damage::before {
    background: var(--color-danger, #c94a4a);
  }
  .event-row.descend::before,
  .event-row.heal::before {
    background: var(--color-accent);
  }
  .tick {
    color: var(--color-text-subtle);
  }
  .msg {
    color: var(--color-text-muted);
    word-break: break-word;
  }
  .event-row.death .msg,
  .event-row.damage .msg {
    color: var(--color-text);
  }

  /* ─── ACTIONS ───────────────────────────── */
  .actions {
    display: flex;
    gap: var(--sp-2);
    justify-content: flex-end;
    align-items: center;
    padding-top: var(--sp-4);
    border-top: 1px solid var(--color-border);
  }
  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .actions .secondary {
    background: var(--color-surface-2);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  .actions .secondary:hover:not(:disabled) {
    background: var(--color-surface-3);
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }
  .actions .primary {
    padding: 10px 20px;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 18%, transparent);
  }
  .actions svg { flex-shrink: 0; }
  @media (max-width: 540px) {
    .actions { justify-content: stretch; flex-direction: column-reverse; }
    .actions button { width: 100%; justify-content: center; }
    .summary-grid { grid-template-columns: 1fr; }
  }
</style>
