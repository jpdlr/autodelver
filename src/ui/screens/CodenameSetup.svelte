<script lang="ts">
  import { auth } from '../../stores/auth.svelte';

  let value = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy) return;
    busy = true;
    error = null;
    const res = await auth.setCodename(value);
    busy = false;
    if (!res.ok) error = res.message ?? 'Could not save codename.';
  }

  const charCount = $derived(value.trim().length);
</script>

<section class="setup">
  <div class="card">
    <p class="eyebrow">One last thing</p>
    <h2>Pick your codename</h2>
    <p class="sub">
      This is how you appear on the leaderboard. 3–24 characters. You can change it later
      by signing out and back in — not really, but we might add that.
    </p>

    <form onsubmit={submit} class="form">
      <label>
        <span class="lbl">Codename</span>
        <input
          type="text"
          bind:value
          placeholder="Shadowlight"
          maxlength="24"
          autocomplete="off"
        />
      </label>
      <div class="row">
        <span class="count" class:ok={charCount >= 3} class:over={charCount > 24}>
          {charCount}/24
        </span>
        <button type="submit" class="primary" disabled={busy || charCount < 3}>
          {busy ? 'Saving…' : 'Enter the dungeon'}
        </button>
      </div>
      {#if error}
        <div class="err">{error}</div>
      {/if}
    </form>

    <button type="button" class="signout" onclick={() => auth.signOut()} disabled={busy}>
      Sign out
    </button>
  </div>
</section>

<style>
  .setup {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-6);
  }
  .card {
    width: min(460px, 100%);
    padding: var(--sp-6);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--elev-2);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-accent);
  }
  h2 {
    margin: 2px 0 0;
    color: var(--color-text);
  }
  .sub {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.55;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    margin-top: var(--sp-2);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  input {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    padding: 10px 12px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    transition: border-color var(--dur-fast) var(--ease-out);
  }
  input:focus {
    outline: none;
    border-color: var(--color-accent);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
  }
  .count {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
  }
  .count.ok { color: var(--color-ranger); }
  .count.over { color: var(--color-danger, #c94a4a); }
  .primary { padding: 10px 16px; font-weight: 600; }
  .err {
    padding: 8px 12px;
    background: color-mix(in srgb, var(--color-danger, #c94a4a) 10%, var(--color-surface-2));
    border: 1px solid color-mix(in srgb, var(--color-danger, #c94a4a) 35%, transparent);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--fs-sm);
  }
  .signout {
    align-self: center;
    background: transparent;
    border: none;
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
    text-decoration: underline;
    padding: 4px 8px;
  }
  .signout:hover:not(:disabled) { color: var(--color-text); background: transparent; }
</style>
