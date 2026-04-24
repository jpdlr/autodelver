<script lang="ts">
  import Home from './ui/screens/Home.svelte';
  import Tutorial from './ui/screens/Tutorial.svelte';
  import Loadout from './ui/screens/Loadout.svelte';
  import Run from './ui/screens/Run.svelte';
  import PostMortem from './ui/screens/PostMortem.svelte';
  import ThemeToggle from './ui/ThemeToggle.svelte';
  import { game } from './stores/game.svelte';
</script>

<div class="app">
  <nav class="app-nav">
    <div class="brand mono">autodelver</div>
    <ThemeToggle />
  </nav>

  <main>
    {#if game.screen === 'home'}
      <Home />
    {:else if game.screen === 'tutorial'}
      <Tutorial />
    {:else if game.screen === 'loadout'}
      <Loadout />
    {:else if game.screen === 'run'}
      <Run />
    {:else if game.screen === 'postmortem'}
      <PostMortem />
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
  .brand {
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text);
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
</style>
