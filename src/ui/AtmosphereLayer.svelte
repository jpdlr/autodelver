<script lang="ts">
  // Hand-drawn SVG sprites that drift around the background. Sprites come from
  // the procedural asset set in sprites.ts — same palette + ink outlines as the
  // in-game art, so the atmosphere reads as "game world" rather than UI icons.
  import { sprites, type SpriteId } from './sprites';

  interface Drift {
    id: string;
    sprite: SpriteId;
    left: string;
    top: string;
    size: number;
    dur: number;
    delay: number;
    rotStart: number;
    opacity: number;
  }

  const floaters: Drift[] = [
    { id: 'a-sword',   sprite: 'sword',   left: '6%',  top: '22%', size: 52, dur: 22, delay: -3,  rotStart: -18, opacity: 0.28 },
    { id: 'a-bow',     sprite: 'bow',     left: '92%', top: '20%', size: 54, dur: 26, delay: -8,  rotStart: 14,  opacity: 0.28 },
    { id: 'a-staff',   sprite: 'staff',   left: '88%', top: '74%', size: 56, dur: 28, delay: -1,  rotStart: -6,  opacity: 0.3 },
    { id: 'a-potion',  sprite: 'potion',  left: '10%', top: '72%', size: 46, dur: 19, delay: -12, rotStart: 8,   opacity: 0.35 },
    { id: 'a-key',     sprite: 'key',     left: '14%', top: '48%', size: 42, dur: 18, delay: -9,  rotStart: 12,  opacity: 0.3 },
    { id: 'a-gem',     sprite: 'gem',     left: '94%', top: '50%', size: 38, dur: 21, delay: -7,  rotStart: 22,  opacity: 0.4 },
    { id: 'a-skull',   sprite: 'skull',   left: '8%',  top: '88%', size: 44, dur: 20, delay: -2,  rotStart: 4,   opacity: 0.3 },
    { id: 'a-coin',    sprite: 'coin',    left: '90%', top: '90%', size: 36, dur: 17, delay: -6,  rotStart: 0,   opacity: 0.4 },
  ];
</script>

<div class="atmosphere" aria-hidden="true">
  {#each floaters as f}
    <span
      class="drift"
      style="
        left: {f.left};
        top: {f.top};
        --size: {f.size}px;
        --dur: {f.dur}s;
        --delay: {f.delay}s;
        --rot: {f.rotStart}deg;
        --op: {f.opacity};
      "
    >
      {@html sprites[f.sprite].svg}
    </span>
  {/each}
</div>

<style>
  .atmosphere {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .drift {
    position: absolute;
    display: inline-block;
    width: var(--size);
    height: var(--size);
    opacity: var(--op);
    transform: translate(-50%, -50%) rotate(var(--rot));
    animation: float var(--dur) ease-in-out var(--delay) infinite alternate;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12));
  }

  .drift :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  @keyframes float {
    0% {
      transform: translate(-50%, -50%) translate(0, 0) rotate(var(--rot));
    }
    100% {
      transform: translate(-50%, -50%) translate(12px, -20px) rotate(calc(var(--rot) + 8deg));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drift {
      animation: none;
    }
  }

  @media (max-width: 720px) {
    .drift {
      display: none;
    }
  }
</style>
