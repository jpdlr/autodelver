<script lang="ts">
  import MonacoEditor from './MonacoEditor.svelte';
  import ApiReference from './ApiReference.svelte';
  import { game } from '../stores/game.svelte';
  import { DEFAULT_SCRIPTS, saveScript } from '../persistence/scripts';
  import type { DelverClass } from '../engine/types';

  interface Props {
    onClose?: () => void;
    compact?: boolean;
  }
  let { onClose, compact = false }: Props = $props();

  let activeClass = $state<DelverClass>('warrior');
  let showApi = $state<boolean>(true);
  const classes: DelverClass[] = ['warrior', 'ranger', 'cleric'];
  const classNames: Record<DelverClass, string> = {
    warrior: 'Grimm',
    ranger: 'Vex',
    cleric: 'Mira',
  };
  const classRoles: Record<DelverClass, string> = {
    warrior: 'Tank',
    ranger: 'DPS',
    cleric: 'Support',
  };

  function onChange(v: string): void {
    game.setScript(activeClass, v);
    saveScript(activeClass, v);
  }

  function reset(): void {
    const fresh = DEFAULT_SCRIPTS[activeClass];
    game.setScript(activeClass, fresh);
    saveScript(activeClass, fresh);
  }
</script>

<div class="panel" class:compact>
  {#if onClose}
    <div class="pause-strip">
      <span class="ps-icon">⏸</span>
      <strong>Paused</strong>
      <span class="ps-body">— edit live, click Apply & Resume to push changes.</span>
    </div>
  {/if}
  <header>
    <div class="tabs">
      {#each classes as cls}
        <button
          type="button"
          class="tab {cls}"
          class:active={activeClass === cls}
          onclick={() => (activeClass = cls)}
          title={`${classNames[cls]} — ${cls} · ${classRoles[cls]}`}
        >
          <span class="dot" aria-hidden="true"></span>
          <span class="tab-name">{classNames[cls]}</span>
          <span class="tab-role">{classRoles[cls]}</span>
        </button>
      {/each}
    </div>
    <div class="header-actions">
      <button type="button" class="ghost small" onclick={() => (showApi = !showApi)}>
        {showApi ? 'Hide reference' : 'Show reference'}
      </button>
      <button type="button" class="ghost small" onclick={reset}>Reset</button>
      {#if onClose}
        <button type="button" class="primary" onclick={onClose}>Apply & Resume</button>
      {/if}
    </div>
  </header>

  <div class="editor-body" class:has-api={showApi}>
    <div class="editor-col">
      <MonacoEditor value={game.scripts[activeClass]} onChange={onChange} />
    </div>
    {#if showApi}
      <div class="api-col">
        <ApiReference />
      </div>
    {/if}
  </div>
  <footer class="hint">
    Autosaves as you type. Changes go live on resume — reloaded workers start
    running the new script next tick.
  </footer>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--elev-3);
    overflow: hidden;
  }

  .pause-strip {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-4);
    background: var(--color-accent-soft);
    border-bottom: 1px solid var(--color-accent);
    color: var(--color-accent);
    font-size: var(--fs-xs);
    flex-shrink: 0;
  }
  .pause-strip strong {
    color: var(--color-accent);
  }
  .pause-strip .ps-body {
    color: var(--color-text-muted);
  }
  .ps-icon {
    font-size: var(--fs-sm);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-2);
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: var(--sp-1);
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }

  .tab {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    color: var(--color-text-muted);
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab.active {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);
    box-shadow: var(--elev-1);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tab.warrior .dot { background: var(--color-warrior); }
  .tab.ranger .dot  { background: var(--color-ranger); }
  .tab.cleric .dot  { background: var(--color-cleric); }

  .tab-name {
    font-weight: 600;
  }

  .tab-role {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .header-actions {
    display: flex;
    gap: var(--sp-1);
    flex-shrink: 0;
  }
  .header-actions button.small {
    padding: 6px 10px;
    font-size: var(--fs-xs);
  }

  .header-actions {
    display: flex;
    gap: var(--sp-2);
  }

  .editor-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr;
  }

  .editor-body.has-api {
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  .editor-col {
    min-height: 0;
    display: flex;
  }

  .api-col {
    min-height: 0;
    min-width: 0;
    border-left: 1px solid var(--color-border);
    padding: var(--sp-2);
    background: var(--color-surface-2);
  }

  .api-col :global(.api-ref) {
    background: var(--color-surface);
  }

  .editor-body :global(.monaco-host) {
    flex: 1;
    border: none;
    border-radius: 0;
  }

  @media (max-width: 900px) {
    .editor-body.has-api {
      grid-template-columns: 1fr;
    }
    .api-col {
      display: none;
    }
  }

  .hint {
    padding: 6px var(--sp-3);
    font-size: 11px;
    color: var(--color-text-subtle);
    background: var(--color-surface-2);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }
</style>
