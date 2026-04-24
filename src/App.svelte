<script lang="ts">
  import Home from './ui/screens/Home.svelte';
  import Tutorial from './ui/screens/Tutorial.svelte';
  import Loadout from './ui/screens/Loadout.svelte';
  import Run from './ui/screens/Run.svelte';
  import PostMortem from './ui/screens/PostMortem.svelte';
  import Landing from './ui/screens/Landing.svelte';
  import CodenameSetup from './ui/screens/CodenameSetup.svelte';
  import Leaderboard from './ui/screens/Leaderboard.svelte';
  import ThemeToggle from './ui/ThemeToggle.svelte';
  import { game } from './stores/game.svelte';
  import { auth } from './stores/auth.svelte';
</script>

<div class="app">
  <nav class="app-nav">
    <div class="brand mono">autodelver</div>
    <div class="nav-right">
      {#if auth.signedIn && auth.codename}
        <span class="me" title="Signed in">
          <span class="dot" aria-hidden="true"></span>
          <span class="me-name">{auth.codename}</span>
        </span>
        <button type="button" class="signout" onclick={() => auth.signOut()}>Sign out</button>
      {/if}
      <ThemeToggle />
    </div>
  </nav>

  <main>
    {#if auth.loading}
      <div class="loading">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading…</p>
      </div>
    {:else if auth.configured && !auth.signedIn}
      <Landing />
    {:else if auth.configured && auth.signedIn && auth.codename === null}
      <CodenameSetup />
    {:else if game.screen === 'home'}
      <Home />
    {:else if game.screen === 'tutorial'}
      <Tutorial />
    {:else if game.screen === 'loadout'}
      <Loadout />
    {:else if game.screen === 'run'}
      <Run />
    {:else if game.screen === 'postmortem'}
      <PostMortem />
    {:else if game.screen === 'leaderboard'}
      <Leaderboard />
    {/if}
  </main>
</div>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .app-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-3) var(--sp-5);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .nav-right {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .brand {
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text);
  }
  .me {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
  }
  .me .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-ranger);
  }
  .me-name {
    font-family: var(--font-mono);
    color: var(--color-text);
  }
  .signout {
    padding: 4px 10px;
    font-size: var(--fs-xs);
    background: transparent;
    border: 1px solid transparent;
    color: var(--color-text-subtle);
  }
  .signout:hover {
    color: var(--color-text);
    border-color: var(--color-border);
    background: var(--color-surface-2);
  }
  main {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }
  main :global(.home-scroll) {
    height: 100%;
    overflow: auto;
  }
  .loading {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-3);
    color: var(--color-text-muted);
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
