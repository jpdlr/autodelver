<script lang="ts">
  let theme = $state<'light' | 'dark'>(
    typeof document !== 'undefined'
      ? ((document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light')
      : 'light',
  );

  function toggle(): void {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('autodelver:theme', theme);
    } catch {
      /* ignore */
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const saved = localStorage.getItem('autodelver:theme') as 'light' | 'dark' | null;
      if (saved) {
        theme = saved;
        document.documentElement.setAttribute('data-theme', saved);
      }
    } catch {
      /* ignore */
    }
  }
</script>

<button type="button" class="ghost theme-toggle" onclick={toggle} aria-label="Toggle theme">
  {theme === 'light' ? '◐' : '◑'} {theme}
</button>

<style>
  .theme-toggle {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
</style>
