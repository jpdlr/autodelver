<script lang="ts">
  import type { LogEvent } from '../engine/types';

  interface Props {
    events: LogEvent[];
  }
  let { events }: Props = $props();

  function kindClass(k: LogEvent['kind']): string {
    switch (k) {
      case 'damage':
      case 'attack':
        return 'log-attack';
      case 'death':
        return 'log-death';
      case 'descend':
      case 'floor-cleared':
        return 'log-good';
      case 'script-error':
      case 'budget-miss':
        return 'log-error';
      default:
        return 'log-info';
    }
  }
</script>

<div class="log" role="log" aria-live="polite">
  {#each events as ev, i (i)}
    <div class="log-row {kindClass(ev.kind)}">
      <span class="tick">t{ev.tick}</span>
      <span class="msg">{ev.message}</span>
    </div>
  {/each}
</div>

<style>
  .log {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: var(--sp-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow-y: auto;
    display: flex;
    flex-direction: column-reverse;
    height: 100%;
  }
  .log-row {
    display: flex;
    gap: var(--sp-2);
    padding: 2px 0;
    line-height: 1.4;
  }
  .tick {
    color: var(--color-text-subtle);
    min-width: 36px;
    flex-shrink: 0;
  }
  .msg {
    color: var(--color-text-muted);
  }
  .log-attack .msg { color: var(--color-text); }
  .log-death .msg { color: var(--color-danger); }
  .log-good .msg { color: var(--color-success); }
  .log-error .msg { color: var(--color-warn); }
</style>
