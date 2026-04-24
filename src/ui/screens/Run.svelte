<script lang="ts">
  import GridCanvas from '../GridCanvas.svelte';
  import LogPanel from '../LogPanel.svelte';
  import ScriptEditorPanel from '../ScriptEditorPanel.svelte';
  import { game } from '../../stores/game.svelte';

  function abort(): void {
    game.returnHome();
  }
  async function restart(): Promise<void> {
    await game.startRun();
  }
  function openEdit(): void {
    game.openMidRunEditor();
  }
  async function closeEdit(): Promise<void> {
    await game.closeMidRunEditor();
  }
</script>

<section class="run">
  <header>
    <div class="group left">
      <button type="button" class="icon-btn danger" onclick={abort} title="Abandon run" aria-label="Abandon run">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>
      </button>
      <button type="button" class="icon-btn" onclick={restart} title="Restart run (new seed)" aria-label="Restart run">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      </button>
    </div>

    <div class="group center">
      <div class="stat"><span class="stat-label">Depth</span><strong>{game.world?.depth ?? 1}</strong></div>
      <div class="stat"><span class="stat-label">Tick</span><strong>{game.world?.tick ?? 0}</strong></div>
      <div class="divider"></div>
      <div class="party">
        {#each game.world?.delvers ?? [] as d}
          <div
            class="party-member {d.class}"
            class:downed={d.hp === 0}
            title="{d.name} · {d.class} · {d.hp}/{d.maxHp} HP"
          >
            <span class="pdot" aria-hidden="true"></span>
            <span class="pname">{d.name}</span>
            <span class="hp" aria-hidden="true">
              <span class="hp-bar" style="width: {Math.max(0, (d.hp / d.maxHp) * 100)}%"></span>
            </span>
          </div>
        {/each}
      </div>
    </div>

    <div class="group right">
      <div class="speed-ctl" role="group" aria-label="Playback speed">
        <button
          type="button"
          class="icon-btn"
          class:active={game.speed === 0}
          onclick={() => game.pause()}
          title="Pause"
          aria-label="Pause"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="4" y="3" width="3" height="10" fill="currentColor"/><rect x="9" y="3" width="3" height="10" fill="currentColor"/></svg>
        </button>
        <button
          type="button"
          class="spd-btn"
          class:active={game.speed === 1}
          onclick={() => game.setSpeed(1)}
          title="Play at normal speed"
          aria-label="1× speed"
        >1×</button>
        <button
          type="button"
          class="spd-btn"
          class:active={game.speed === 4}
          onclick={() => game.setSpeed(4)}
          title="Play at 4× speed"
          aria-label="4× speed"
        >4×</button>
        <button
          type="button"
          class="spd-btn"
          class:active={game.speed === 16}
          onclick={() => game.setSpeed(16)}
          title="Play at 16× speed"
          aria-label="16× speed"
        >16×</button>
        <button
          type="button"
          class="icon-btn"
          onclick={() => game.stepOnce()}
          disabled={game.speed !== 0}
          title="Step one tick (paused only)"
          aria-label="Step one tick"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M5 4l6 4-6 4z" fill="currentColor"/><rect x="11" y="4" width="1.6" height="8" fill="currentColor"/></svg>
        </button>
      </div>
      <button type="button" class="icon-btn" onclick={openEdit} title="Edit scripts (pauses run)" aria-label="Edit scripts">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 13l2-0.5 7-7-1.5-1.5-7 7L3 13zM10.5 3.5l1.5-1.5 1.5 1.5-1.5 1.5z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </header>

  <div class="body">
    <div class="grid-col">
      <GridCanvas world={game.world} />
    </div>
    <div class="log-col">
      <div class="log-label">Combat log</div>
      <LogPanel events={game.recentLog(80)} />
    </div>
  </div>

  {#if game.editingMidRun}
    <div class="edit-overlay" role="dialog" aria-modal="true">
      <div class="edit-backdrop" onclick={closeEdit} aria-hidden="true"></div>
      <div class="edit-shell">
        <ScriptEditorPanel onClose={closeEdit} />
      </div>
    </div>
  {/if}
</section>

<style>
  .run {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .run {
    position: relative;
  }
  header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    position: relative;
  }
  .group {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .group.center {
    justify-content: center;
    gap: var(--sp-3);
    min-width: 0;
  }

  /* Icon buttons — sit on surface-2, turn accent on hover, active state for speed. */
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-out),
                background var(--dur-fast) var(--ease-out),
                border-color var(--dur-fast) var(--ease-out);
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .icon-btn.active {
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border-color: var(--color-accent);
  }
  .icon-btn.danger:hover:not(:disabled) {
    color: var(--color-danger, #c94a4a);
    border-color: var(--color-danger, #c94a4a);
  }
  .icon-btn svg { display: block; }

  .spd-btn {
    height: 30px;
    padding: 0 var(--sp-2);
    min-width: 34px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease-out),
                background var(--dur-fast) var(--ease-out),
                border-color var(--dur-fast) var(--ease-out);
  }
  .spd-btn:hover { color: var(--color-accent); border-color: var(--color-accent); }
  .spd-btn.active {
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border-color: var(--color-accent);
  }

  .speed-ctl {
    display: inline-flex;
    gap: 4px;
    padding: 2px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .speed-ctl .icon-btn,
  .speed-ctl .spd-btn {
    border: 1px solid transparent;
    background: transparent;
  }
  .speed-ctl .icon-btn:hover:not(:disabled),
  .speed-ctl .spd-btn:hover {
    background: var(--color-surface-2);
    border-color: transparent;
    color: var(--color-accent);
  }
  .speed-ctl .icon-btn.active,
  .speed-ctl .spd-btn.active {
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border-color: transparent;
  }

  /* Depth / tick stat pills */
  .stat {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .stat-label {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-subtle);
  }
  .stat strong {
    color: var(--color-text);
    font-size: var(--fs-sm);
    font-weight: 600;
  }

  .divider {
    width: 1px;
    height: 22px;
    background: var(--color-border);
  }

  /* Party pills with HP bar */
  .party {
    display: flex;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }
  .party-member {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
  }
  .party-member.downed {
    opacity: 0.4;
    text-decoration: line-through;
  }
  .pdot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .party-member.warrior .pdot { background: var(--color-warrior); }
  .party-member.ranger .pdot  { background: var(--color-ranger); }
  .party-member.cleric .pdot  { background: var(--color-cleric); }
  .pname {
    font-weight: 600;
    color: var(--color-text);
    font-size: var(--fs-xs);
  }
  .hp {
    position: relative;
    width: 48px;
    height: 4px;
    background: var(--color-bg);
    border-radius: 2px;
    overflow: hidden;
  }
  .hp-bar {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 60%, var(--color-warrior)) 100%);
    transition: width var(--dur-base) var(--ease-out);
  }
  .party-member.warrior .hp-bar { background: var(--color-warrior); }
  .party-member.ranger .hp-bar  { background: var(--color-ranger); }
  .party-member.cleric .hp-bar  { background: var(--color-cleric); }

  .body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--sp-3);
    padding: var(--sp-3);
    min-height: 0;
  }
  .grid-col {
    min-height: 0;
    overflow: hidden;
  }
  .log-col {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-height: 0;
  }
  .log-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-subtle);
  }

  @media (max-width: 900px) {
    .body {
      grid-template-columns: 1fr;
    }
  }

  .edit-overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: var(--sp-3);
  }
  .edit-backdrop {
    position: absolute;
    inset: 0;
    background: var(--color-overlay);
    backdrop-filter: blur(2px);
  }
  .edit-shell {
    position: relative;
    width: min(1600px, 100%);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
</style>
