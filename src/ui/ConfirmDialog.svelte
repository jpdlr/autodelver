<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }
  let {
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel,
  }: Props = $props();

  function onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) onCancel();
  }
  function onKey(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') onConfirm();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <div class="backdrop" onclick={onBackdrop} role="presentation">
    <div class="dialog card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <header>
        <p class="eyebrow">Confirm</p>
        <h2 id="confirm-title">{title}</h2>
      </header>
      <p class="msg">{message}</p>
      <footer>
        <button type="button" class="secondary" onclick={onCancel}>{cancelLabel}</button>
        <button
          type="button"
          class={danger ? 'danger' : 'primary'}
          onclick={onConfirm}
          autofocus
        >{confirmLabel}</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 120;
    padding: var(--sp-4);
    backdrop-filter: blur(2px);
  }
  .dialog {
    width: min(420px, 100%);
    padding: var(--sp-5);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  header { display: flex; flex-direction: column; gap: 2px; }
  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  h2 { margin: 0; color: var(--color-text); font-size: var(--fs-lg); }
  .msg {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.5;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
  }
  footer button {
    padding: 8px 16px;
    font-weight: 600;
  }
  footer .secondary {
    background: var(--color-surface-2);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  footer .secondary:hover {
    background: var(--color-surface-3);
    border-color: var(--color-border-strong);
  }
  footer .danger {
    background: var(--color-danger, #c94a4a);
    color: #fff;
    border: 1px solid var(--color-danger, #c94a4a);
  }
  footer .danger:hover {
    background: color-mix(in srgb, var(--color-danger, #c94a4a) 85%, #000);
  }
</style>
