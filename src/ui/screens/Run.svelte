<script lang="ts">
  import GridCanvas from '../GridCanvas.svelte';
  import LogPanel from '../LogPanel.svelte';
  import ScriptEditorPanel from '../ScriptEditorPanel.svelte';
  import { game } from '../../stores/game.svelte';

  function abort(): void {
    game.returnHome();
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
    <div class="header-left">
      <button type="button" class="ghost" onclick={abort}>✕ Abandon run</button>
    </div>
    <div class="header-center">
      <div class="depth">Depth <strong>{game.world?.depth ?? 1}</strong></div>
      <div class="divider"></div>
      <div class="tick">t<strong>{game.world?.tick ?? 0}</strong></div>
      <div class="divider"></div>
      <div class="party">
        {#each game.world?.delvers ?? [] as d}
          <div class="party-member {d.class}" class:downed={d.hp === 0} title="{d.class} — {d.hp}/{d.maxHp} HP">
            <span class="pdot" aria-hidden="true"></span>
            <span class="pname">{d.name}</span>
            <span class="pclass">{d.class}</span>
            <span class="hp">{d.hp}/{d.maxHp}</span>
          </div>
        {/each}
      </div>
    </div>
    <div class="header-right">
      <button type="button" class="ghost edit-btn" onclick={openEdit}>✎ Edit scripts</button>
      <div class="speed-ctl">
        <button
          type="button"
          class:active={game.speed === 0}
          onclick={() => game.pause()}
        >⏸</button>
        <button
          type="button"
          class:active={game.speed === 1}
          onclick={() => game.setSpeed(1)}
        >1×</button>
        <button
          type="button"
          class:active={game.speed === 4}
          onclick={() => game.setSpeed(4)}
        >4×</button>
        <button
          type="button"
          class:active={game.speed === 16}
          onclick={() => game.setSpeed(16)}
        >16×</button>
        <button
          type="button"
          class="ghost"
          onclick={() => game.stepOnce()}
          disabled={game.speed !== 0}
        >step ›</button>
      </div>
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
  header {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    position: relative;
  }
  .run {
    position: relative;
  }
  .header-center {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    justify-content: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .depth,
  .tick {
    color: var(--color-text-muted);
  }
  .depth strong,
  .tick strong {
    color: var(--color-text);
    font-weight: 600;
  }
  .divider {
    width: 1px;
    height: 20px;
    background: var(--color-border);
  }
  .party {
    display: flex;
    gap: var(--sp-3);
  }
  .party-member {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 3px 10px;
    background: var(--color-surface-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }
  .party-member.downed {
    opacity: 0.4;
    text-decoration: line-through;
  }
  .pdot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .party-member.warrior .pdot { background: var(--color-warrior); }
  .party-member.ranger .pdot  { background: var(--color-ranger); }
  .party-member.cleric .pdot  { background: var(--color-cleric); }
  .pname {
    font-weight: 600;
    color: var(--color-text);
  }
  .pclass {
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .hp {
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .edit-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
  }
  .edit-btn:hover {
    color: var(--color-text);
  }
  .speed-ctl {
    display: flex;
    gap: 2px;
  }
  .speed-ctl button {
    padding: var(--sp-1) var(--sp-3);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
  }
  .speed-ctl button.active {
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border-color: var(--color-accent);
  }

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
