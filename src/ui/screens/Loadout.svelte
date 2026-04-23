<script lang="ts">
  import ScriptEditorPanel from '../ScriptEditorPanel.svelte';
  import { game } from '../../stores/game.svelte';

  function back(): void {
    game.screen = 'home';
  }
</script>

<section class="loadout">
  <header>
    <button type="button" class="ghost" onclick={back}>← Home</button>
    <h2>Edit Scripts</h2>
  </header>

  <div class="body">
    <ScriptEditorPanel />
  </div>
</section>

<style>
  .loadout {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-5);
    border-bottom: 1px solid var(--color-border);
  }
  header h2 {
    flex: 1;
    margin: 0;
  }
  .body {
    flex: 1;
    padding: var(--sp-4);
    min-height: 0;
    display: flex;
  }
  .body :global(.panel) {
    width: 100%;
  }
</style>
