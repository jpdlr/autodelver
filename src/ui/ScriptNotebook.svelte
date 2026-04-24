<script lang="ts">
  import type { DelverClass } from '../engine/types';
  import {
    deletePreset,
    loadPresets,
    renamePreset,
    savePreset,
    suggestDuplicateName,
    type ScriptPreset,
  } from '../persistence/presets';
  import ConfirmDialog from './ConfirmDialog.svelte';

  interface Props {
    cls: DelverClass;
    /** Current draft script — used when saving a new preset. */
    currentScript: string;
    /** Default script to restore (class starter). */
    defaultScript: string;
    /** Last run's launch script for this class, if available. */
    lastRunScript: string | null;
    /** Called when the parent should replace the editor contents. */
    onRestore: (script: string) => void;
  }
  let { cls, currentScript, defaultScript, lastRunScript, onRestore }: Props = $props();

  let presets = $state<ScriptPreset[]>([]);
  let saving = $state(false);
  let draftName = $state('');
  let renameTargetId = $state<string | null>(null);
  let renameDraft = $state('');
  let feedback = $state<{ text: string; kind: 'ok' | 'err' } | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  // Modal-backed confirmation state — replaces the browser confirm() dialog
  // for destructive actions (delete, overwrite).
  type PendingAction =
    | { kind: 'delete'; preset: ScriptPreset }
    | { kind: 'overwrite'; preset: ScriptPreset };
  let pending = $state<PendingAction | null>(null);

  // Refresh presets list whenever the active class changes.
  $effect(() => {
    presets = loadPresets(cls);
    // Clear rename state when class flips.
    renameTargetId = null;
    draftName = '';
  });

  function flash(text: string, kind: 'ok' | 'err' = 'ok'): void {
    feedback = { text, kind };
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      feedback = null;
    }, 2200);
  }

  function handleSave(): void {
    const name = draftName.trim() || `Preset ${presets.length + 1}`;
    saving = true;
    presets = savePreset(cls, name, currentScript);
    draftName = '';
    saving = false;
    flash(`Saved "${name}"`);
  }

  function handleDuplicate(): void {
    const name = suggestDuplicateName(cls);
    presets = savePreset(cls, name, currentScript);
    flash(`Duplicated as "${name}"`);
  }

  function handleDelete(p: ScriptPreset): void {
    pending = { kind: 'delete', preset: p };
  }

  function handleOverwrite(p: ScriptPreset): void {
    pending = { kind: 'overwrite', preset: p };
  }

  function confirmPending(): void {
    if (!pending) return;
    if (pending.kind === 'delete') {
      const p = pending.preset;
      presets = deletePreset(cls, p.id);
      flash(`Deleted "${p.name}"`, 'ok');
    } else if (pending.kind === 'overwrite') {
      const p = pending.preset;
      presets = savePreset(cls, p.name, currentScript);
      flash(`Overwrote "${p.name}"`);
    }
    pending = null;
  }

  function cancelPending(): void {
    pending = null;
  }

  function handleLoad(p: ScriptPreset): void {
    onRestore(p.script);
    flash(`Loaded "${p.name}" into editor`);
  }

  function beginRename(p: ScriptPreset): void {
    renameTargetId = p.id;
    renameDraft = p.name;
  }

  function commitRename(): void {
    if (!renameTargetId || !renameDraft.trim()) {
      renameTargetId = null;
      return;
    }
    presets = renamePreset(cls, renameTargetId, renameDraft);
    renameTargetId = null;
    flash('Renamed');
  }

  function handleRestoreDefault(): void {
    onRestore(defaultScript);
    flash('Restored default script');
  }

  function handleRestoreLastRun(): void {
    if (!lastRunScript) return;
    onRestore(lastRunScript);
    flash('Restored script from last run');
  }

  function formatDate(ms: number): string {
    try {
      const d = new Date(ms);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }
</script>

<section class="notebook">
  <header class="n-head">
    <div>
      <p class="eyebrow">Notebook</p>
      <h4>Saved drafts for {cls}</h4>
    </div>
    <div class="restore-row">
      <button
        type="button"
        class="restore-btn"
        onclick={handleRestoreDefault}
        title="Replace the editor contents with the class default"
      >↺ Default</button>
      <button
        type="button"
        class="restore-btn"
        onclick={handleRestoreLastRun}
        disabled={!lastRunScript}
        title={lastRunScript ? 'Restore the script used in the last run' : 'No previous run recorded'}
      >↶ Last run</button>
    </div>
  </header>

  <div class="save-row">
    <input
      type="text"
      bind:value={draftName}
      placeholder="Name this draft (optional)"
      maxlength="48"
      onkeydown={(e) => { if (e.key === 'Enter') handleSave(); }}
    />
    <button type="button" class="primary" onclick={handleSave} disabled={saving || !currentScript}>Save</button>
    <button type="button" onclick={handleDuplicate} disabled={!currentScript} title="Save a copy with an auto-generated name">Duplicate</button>
  </div>

  {#if feedback}
    <div class="flash {feedback.kind}">{feedback.text}</div>
  {/if}

  {#if presets.length === 0}
    <p class="empty">No saved drafts yet. Name a version and hit Save to pin it here.</p>
  {:else}
    <ul class="list">
      {#each presets as p (p.id)}
        <li class="row">
          {#if renameTargetId === p.id}
            <input
              type="text"
              class="rename-input"
              bind:value={renameDraft}
              maxlength="48"
              onblur={commitRename}
              onkeydown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') renameTargetId = null;
              }}
            />
          {:else}
            <button
              type="button"
              class="name"
              onclick={() => handleLoad(p)}
              title="Load into editor"
            >{p.name}</button>
          {/if}
          <span class="meta">{formatDate(p.updatedAt)}</span>
          <span class="row-actions">
            <button
              type="button"
              class="mini"
              onclick={() => handleOverwrite(p)}
              title="Overwrite this preset with the current editor contents"
              aria-label="Overwrite preset"
              disabled={!currentScript}
            >
              <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M8 3v8M4.5 7.5L8 11l3.5-3.5M3 13h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            </button>
            <button
              type="button"
              class="mini"
              onclick={() => beginRename(p)}
              title="Rename"
              aria-label="Rename preset"
            >
              <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M3 13l2-0.5 7-7-1.5-1.5-7 7L3 13zM10.5 3.5l1.5-1.5 1.5 1.5-1.5 1.5z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/></svg>
            </button>
            <button
              type="button"
              class="mini danger"
              onclick={() => handleDelete(p)}
              title="Delete"
              aria-label="Delete preset"
            >
              <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>
            </button>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<ConfirmDialog
  open={pending !== null}
  danger={pending?.kind === 'delete'}
  title={pending?.kind === 'delete'
    ? `Delete "${pending.preset.name}"?`
    : pending?.kind === 'overwrite'
      ? `Overwrite "${pending.preset.name}"?`
      : ''}
  message={pending?.kind === 'delete'
    ? 'This preset will be removed from this device. This can’t be undone.'
    : pending?.kind === 'overwrite'
      ? 'The saved contents will be replaced with what’s currently in the editor.'
      : ''}
  confirmLabel={pending?.kind === 'delete' ? 'Delete' : 'Overwrite'}
  onConfirm={confirmPending}
  onCancel={cancelPending}
/>

<style>
  .notebook {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .n-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sp-3);
  }
  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  h4 {
    margin: 2px 0 0;
    font-size: var(--fs-sm);
    color: var(--color-text);
    font-weight: 600;
  }
  .restore-row {
    display: flex;
    gap: 6px;
  }
  .restore-btn {
    padding: 4px 10px;
    font-size: var(--fs-xs);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
  }
  .restore-btn:hover:not(:disabled) {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .save-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 6px;
  }
  .save-row input {
    padding: 6px 10px;
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
  }
  .save-row input:focus { outline: none; border-color: var(--color-accent); }
  .save-row button {
    padding: 6px 12px;
    font-size: var(--fs-xs);
  }

  .flash {
    padding: 4px 10px;
    font-size: 10px;
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    border-radius: var(--radius-sm);
  }
  .flash.ok {
    background: color-mix(in srgb, var(--color-ranger) 15%, var(--color-surface));
    color: var(--color-ranger);
    border: 1px solid color-mix(in srgb, var(--color-ranger) 40%, transparent);
  }
  .flash.err {
    background: color-mix(in srgb, var(--color-danger, #c94a4a) 15%, var(--color-surface));
    color: var(--color-danger, #c94a4a);
  }

  .empty {
    margin: 0;
    padding: var(--sp-2) 0;
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
    text-align: center;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 180px;
    overflow-y: auto;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
    padding: 4px 6px;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
  }
  .row:hover { background: var(--color-surface); }
  .name {
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--color-text);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name:hover { color: var(--color-accent); background: transparent; border: none; }
  .rename-input {
    padding: 2px 6px;
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    background: var(--color-surface);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    min-width: 0;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-subtle);
    white-space: nowrap;
  }
  .row-actions { display: inline-flex; gap: 2px; }
  .mini {
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 11px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-text-subtle);
  }
  .mini:hover { color: var(--color-text); background: var(--color-surface); border-color: var(--color-border); }
  .mini.danger:hover { color: var(--color-danger, #c94a4a); border-color: color-mix(in srgb, var(--color-danger, #c94a4a) 50%, transparent); }
</style>
