<script lang="ts">
  import { game } from '../../stores/game.svelte';

  function home(): void {
    game.returnHome();
  }
  function edit(): void {
    game.screen = 'loadout';
  }
  async function retry(): Promise<void> {
    await game.startRun();
  }
</script>

<section class="pm">
  <div class="pm-card card">
    <div class="sigil">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 4 L52 24 L52 44 L44 56 L32 60 L20 56 L12 44 L12 24 Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45" />
        <path d="M32 12 L32 52 M16 26 L48 26 M20 42 L44 42" stroke="currentColor" stroke-width="1" opacity="0.55" />
        <circle cx="32" cy="32" r="6" fill="currentColor" opacity="0.3"/>
      </svg>
    </div>
    <h2>The party has fallen.</h2>

    {#if game.lastRunSummary}
      <div class="headline">
        Reached depth <strong>{game.lastRunSummary.depth}</strong>
        in <strong>{game.lastRunSummary.ticks}</strong> ticks.
      </div>

      <div class="cause mono">
        <div class="cause-label">last event</div>
        <div class="cause-msg">{game.lastRunSummary.causeOfDeath}</div>
      </div>

      <div class="reward">
        <div class="reward-icon">✦</div>
        <div>
          <div class="reward-label">Insight earned</div>
          <div class="reward-value">+{game.lastRunSummary.insightEarned}</div>
        </div>
      </div>
    {/if}

    {#if game.world}
      <div class="diagnostics">
        <div class="diag-label">party state</div>
        <div class="party-state">
          {#each game.world.delvers as d}
            <div class="party-row" class:downed={d.hp === 0}>
              <span>{d.name}</span>
              <code>{d.hp}/{d.maxHp} HP · {d.mp}/{d.maxMp} MP</code>
            </div>
          {/each}
        </div>
        <div class="diag-label">last events</div>
        <div class="event-list">
          {#each game.recentLog(8) as ev}
            <div class="event-row">
              <code>t{ev.tick}</code>
              <span>{ev.message}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="actions">
      <button type="button" onclick={home}>Home</button>
      <button type="button" onclick={edit}>Edit scripts</button>
      <button type="button" class="primary" onclick={retry}>Descend again</button>
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
  }
  .pm-card {
    max-width: 540px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .sigil {
    color: var(--color-accent);
    width: 72px;
    height: 72px;
    margin: 0 auto;
  }
  .sigil svg {
    width: 100%;
    height: 100%;
  }
  h2 {
    margin: 0;
    color: var(--color-text);
  }
  .headline {
    color: var(--color-text-muted);
    font-size: var(--fs-md);
  }
  .headline strong {
    color: var(--color-text);
  }
  .cause {
    background: var(--color-surface-2);
    padding: var(--sp-3);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-danger);
    text-align: left;
    font-size: var(--fs-sm);
  }
  .cause-label {
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: var(--sp-1);
  }
  .cause-msg {
    color: var(--color-text);
  }
  .reward {
    display: flex;
    gap: var(--sp-3);
    align-items: center;
    justify-content: center;
  }
  .reward-icon {
    font-size: var(--fs-2xl);
    color: var(--color-accent);
  }
  .reward-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-subtle);
  }
  .reward-value {
    font-size: var(--fs-xl);
    font-weight: 600;
    color: var(--color-text);
  }
  .diagnostics {
    text-align: left;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .diag-label {
    color: var(--color-text-subtle);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .party-state,
  .event-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .party-row,
  .event-row {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
    color: var(--color-text-muted);
    font-size: var(--fs-xs);
  }
  .party-row span,
  .event-row span {
    color: var(--color-text);
  }
  .party-row.downed span {
    color: var(--color-danger);
  }
  .event-row {
    justify-content: flex-start;
  }
  .actions {
    display: flex;
    gap: var(--sp-3);
    justify-content: center;
    margin-top: var(--sp-3);
  }
</style>
