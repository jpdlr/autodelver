<script lang="ts">
  import { audio } from '../stores/audio.svelte';

  interface Props { onClose: () => void; }
  let { onClose }: Props = $props();

  function onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }

  function preview(): void {
    audio.play('click');
  }
</script>

<div class="backdrop" onclick={onBackdrop} role="presentation">
  <div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header class="head">
      <div>
        <p class="eyebrow">Preferences</p>
        <h2 id="settings-title">Settings</h2>
      </div>
      <button type="button" class="close" onclick={onClose} aria-label="Close">
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </header>

    <section class="group">
      <p class="group-label">Audio</p>

      <label class="row toggle">
        <span class="lbl">Sound enabled</span>
        <span class="switch" class:on={audio.settings.enabled}>
          <input
            type="checkbox"
            checked={audio.settings.enabled}
            onchange={(e) => audio.setEnabled((e.currentTarget as HTMLInputElement).checked)}
          />
          <span class="knob" aria-hidden="true"></span>
        </span>
      </label>

      <label class="row slider" class:disabled={!audio.settings.enabled}>
        <span class="lbl">SFX volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audio.settings.sfxVolume}
          disabled={!audio.settings.enabled}
          oninput={(e) => audio.setSfxVolume(Number((e.currentTarget as HTMLInputElement).value))}
          onchange={preview}
        />
        <span class="pct">{Math.round(audio.settings.sfxVolume * 100)}%</span>
      </label>

      <label class="row slider" class:disabled={!audio.settings.enabled}>
        <span class="lbl">Ambient music</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audio.settings.musicVolume}
          disabled={!audio.settings.enabled}
          oninput={(e) => audio.setMusicVolume(Number((e.currentTarget as HTMLInputElement).value))}
        />
        <span class="pct">{Math.round(audio.settings.musicVolume * 100)}%</span>
      </label>

    </section>

    <footer class="foot">
      <button type="button" class="primary" onclick={onClose}>Done</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--sp-4);
  }
  .dialog {
    width: min(440px, 100%);
    padding: var(--sp-5);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .head {
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
  h2 { margin: 2px 0 0; color: var(--color-text); font-size: var(--fs-lg); }
  .close {
    width: 28px;
    height: 28px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    color: var(--color-text-subtle);
    border-radius: var(--radius-sm);
  }
  .close:hover { color: var(--color-text); border-color: var(--color-border); background: var(--color-surface-2); }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .group-label {
    margin: 0 0 var(--sp-1);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--sp-2);
    align-items: center;
    padding: 6px 2px;
  }
  .row.slider {
    grid-template-columns: 110px 1fr 42px;
  }
  .row.disabled { opacity: 0.55; }
  .row .lbl { color: var(--color-text); font-size: var(--fs-sm); }
  .row input[type="range"] { width: 100%; accent-color: var(--color-accent); }

  .switch {
    position: relative;
    display: inline-flex;
    width: 38px;
    height: 22px;
    border-radius: 999px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    cursor: pointer;
    transition: background var(--dur-base) var(--ease-out),
                border-color var(--dur-base) var(--ease-out);
  }
  .switch input {
    position: absolute;
    inset: 0;
    opacity: 0;
    margin: 0;
    cursor: pointer;
  }
  .switch .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--color-text-subtle);
    border-radius: 50%;
    transition: transform var(--dur-base) var(--ease-out),
                background var(--dur-base) var(--ease-out);
  }
  .switch.on {
    background: color-mix(in srgb, var(--color-accent) 70%, transparent);
    border-color: var(--color-accent);
  }
  .switch.on .knob {
    background: var(--color-text-inverse, #fff);
    transform: translateX(16px);
  }
  .switch:focus-within {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 35%, transparent);
  }
  .row .pct {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
    text-align: right;
  }
  .hint {
    margin: var(--sp-1) 0 0;
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
    line-height: 1.45;
  }
  .foot {
    display: flex;
    justify-content: flex-end;
  }
  .foot .primary {
    padding: 8px 18px;
  }
</style>
