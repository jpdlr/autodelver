<script lang="ts">
  import MonacoEditor from './MonacoEditor.svelte';
  import ApiReference from './ApiReference.svelte';
  import ScriptNotebook from './ScriptNotebook.svelte';
  import { game } from '../stores/game.svelte';
  import { DEFAULT_SCRIPTS, saveScript } from '../persistence/scripts';
  import type { DelverClass } from '../engine/types';

  interface Props {
    onClose?: () => void;
    compact?: boolean;
  }
  let { onClose, compact = false }: Props = $props();

  let activeClass = $state<DelverClass>('warrior');
  // In the side-panel (compact) layout the API reference takes space away
  // from the actual editor and the dungeon, so default it to closed there.
  let showApi = $state<boolean>(!compact);
  let showNotebook = $state<boolean>(false);
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

  function applyScript(script: string): void {
    game.setScript(activeClass, script);
    saveScript(activeClass, script);
  }

  // Prefer the in-memory launch snapshot (same session) but fall back to
  // the most recent persisted runHistory entry that has launchScripts.
  const lastRunScript = $derived<string | null>(
    game.lastLaunchScripts?.[activeClass]
      ?? game.meta.runHistory.find((r) => r.launchScripts?.[activeClass])?.launchScripts?.[activeClass]
      ?? null,
  );
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
      <button
        type="button"
        class="icon-toggle"
        class:toggle-active={showNotebook}
        onclick={() => (showNotebook = !showNotebook)}
        title={showNotebook ? 'Hide notebook' : 'Show notebook — save, name, and restore drafts'}
        aria-pressed={showNotebook}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/>
          <path d="M3 2v12" stroke="currentColor" stroke-width="1.3"/>
          <path d="M6 5h5M6 8h5M6 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        <span>Notebook</span>
      </button>
      <button
        type="button"
        class="icon-toggle"
        class:toggle-active={showApi}
        onclick={() => (showApi = !showApi)}
        title={showApi ? 'Hide reference' : 'Show the ctx/action reference'}
        aria-pressed={showApi}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3" fill="none"/>
          <path d="M6.2 6.2a1.8 1.8 0 1 1 2.3 2.3c-.5.2-.8.5-.8 1v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>
          <circle cx="8" cy="12" r="0.7" fill="currentColor"/>
        </svg>
        <span>Reference</span>
      </button>
      {#if onClose}
        <button type="button" class="primary" onclick={onClose}>Apply & Resume</button>
      {/if}
    </div>
  </header>

  <div class="editor-body" class:has-api={showApi} class:has-notebook={showNotebook}>
    <div class="editor-col">
      <MonacoEditor value={game.scripts[activeClass]} onChange={onChange} />
      {#if showNotebook}
        <div class="notebook-host">
          <ScriptNotebook
            cls={activeClass}
            currentScript={game.scripts[activeClass]}
            defaultScript={DEFAULT_SCRIPTS[activeClass]}
            lastRunScript={lastRunScript}
            onRestore={applyScript}
          />
        </div>
      {/if}
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

  .icon-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: var(--fs-xs);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    transition: color var(--dur-fast) var(--ease-out),
                background var(--dur-fast) var(--ease-out),
                border-color var(--dur-fast) var(--ease-out);
  }
  .icon-toggle:hover {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  }
  .icon-toggle svg {
    flex-shrink: 0;
    color: inherit;
  }
  .icon-toggle.toggle-active {
    color: var(--color-accent);
    border-color: color-mix(in srgb, var(--color-accent) 55%, transparent);
    background: color-mix(in srgb, var(--color-accent) 14%, transparent);
  }
  .icon-toggle.toggle-active:hover {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
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
    flex-direction: column;
  }
  .notebook-host {
    flex-shrink: 0;
    padding: var(--sp-2);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
    max-height: 40%;
    overflow-y: auto;
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
