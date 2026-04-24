<script lang="ts">
  import { auth } from '../../stores/auth.svelte';
  import AtmosphereLayer from '../AtmosphereLayer.svelte';
  import SimulationBackdrop from '../SimulationBackdrop.svelte';

  let busy = $state(false);

  async function handleSignIn(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await auth.signInWithGoogle();
    } finally {
      busy = false;
    }
  }
</script>

<section class="landing">
  <div class="bg">
    <SimulationBackdrop />
    <AtmosphereLayer />
  </div>

  <div class="content">
    <div class="sigil" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <path d="M50 6 L88 30 L88 72 L72 90 L50 96 L28 90 L12 72 L12 30 Z" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.5"/>
        <path d="M50 18 L76 34 L76 66 L64 82 L50 86 L36 82 L24 66 L24 34 Z" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35"/>
        <path d="M50 30 L62 50 L50 70 L38 50 Z" fill="currentColor" opacity="0.28"/>
        <circle cx="50" cy="50" r="4" fill="currentColor" opacity="0.55"/>
        <path d="M20 50 L40 50 M60 50 L80 50 M50 20 L50 40 M50 60 L50 80" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
      </svg>
    </div>
    <h1>AutoDelver</h1>
    <p class="tag">You do not descend. You <em>write</em> the descent.</p>

    <div class="card">
      <p class="pitch">
        A roguelite idler. You code a party of three delvers and watch them crawl.
        Sign in to save your scripts, earn insight, and join the leaderboard.
      </p>

      {#if !auth.configured}
        <div class="warn">
          Cloud features are disabled — Firebase is not configured in this build.
        </div>
      {:else}
        <button type="button" class="gbtn" onclick={handleSignIn} disabled={busy}>
          <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.96H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.334z"/>
            <path fill="#EA4335" d="M9 3.579c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.167 6.656 3.58 9 3.58z"/>
          </svg>
          <span>{busy ? 'Opening Google…' : 'Sign in with Google'}</span>
        </button>
      {/if}

      {#if auth.error}
        <div class="err">{auth.error}</div>
      {/if}

      <p class="fine">
        We only store your Google account ID and a codename you pick next. No script
        content is shared — your code stays on your device.
      </p>
    </div>
  </div>
</section>

<style>
  .landing {
    height: 100%;
    position: relative;
    isolation: isolate;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-6);
    overflow: hidden;
  }
  .bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0.55;
    filter: saturate(0.8);
  }
  .content {
    position: relative;
    z-index: 1;
    width: min(460px, 100%);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
  }
  .sigil {
    width: 72px;
    height: 72px;
    color: var(--color-accent);
    filter: drop-shadow(0 0 16px color-mix(in srgb, var(--color-accent) 35%, transparent));
  }
  .sigil svg { width: 100%; height: 100%; }
  h1 {
    margin: 0;
    font-family: var(--font-mono);
    font-size: clamp(2.5rem, 6vw, 3.5rem);
    letter-spacing: -0.03em;
    color: var(--color-text);
    line-height: 1;
  }
  .tag {
    margin: 0;
    color: var(--color-text-muted);
    font-style: italic;
  }
  .tag em { color: var(--color-accent); font-style: italic; font-weight: 600; }

  .card {
    margin-top: var(--sp-3);
    padding: var(--sp-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--elev-2);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    width: 100%;
  }
  .pitch {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
    font-size: var(--fs-sm);
  }
  .gbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: var(--fs-md);
  }
  .gbtn:hover:not(:disabled) {
    background: var(--color-surface-2);
    border-color: var(--color-accent);
  }
  .warn,
  .err {
    margin: 0;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--color-danger, #c94a4a) 10%, var(--color-surface-2));
    border: 1px solid color-mix(in srgb, var(--color-danger, #c94a4a) 35%, transparent);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--fs-sm);
    text-align: left;
  }
  .warn {
    background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface-2));
    border-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
  }
  .fine {
    margin: 0;
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
    line-height: 1.5;
  }
</style>
