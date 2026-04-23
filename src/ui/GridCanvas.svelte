<script lang="ts">
  import { onMount } from 'svelte';
  import type { World } from '../engine/types';
  import { TILE } from '../engine/grid';
  import { sprites, type SpriteId } from './sprites';

  interface Props {
    world: World | null;
  }
  let { world }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let wrapper: HTMLDivElement | undefined = $state();
  const TILE_SIZE = 24;

  // Preload generated sprite images and redraw when they finish decoding.
  const spriteImgs: Partial<Record<SpriteId, HTMLImageElement>> = {};
  const spritesReady = new Set<SpriteId>();

  function loadSprite(id: SpriteId): HTMLImageElement | null {
    const existing = spriteImgs[id];
    if (existing) return spritesReady.has(id) ? existing : null;
    const img = new Image();
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(sprites[id].svg)}`;
    spriteImgs[id] = img;
    img.onload = () => {
      spritesReady.add(id);
      draw();
    };
    return null;
  }

  const classSprite: Record<string, SpriteId> = {
    warrior: 'grimm-warrior',
    ranger: 'vex-ranger',
    cleric: 'mira-cleric',
  };
  const archetypeSprite: Record<string, SpriteId> = {
    slime: 'slime',
    goblin: 'skitter',
    wraith: 'wraith',
    brute: 'brute',
    lich: 'lich',
  };

  function cssVar(name: string): string {
    if (!canvas) return '#000';
    return getComputedStyle(canvas).getPropertyValue(name).trim();
  }

  function draw(): void {
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = world.grid.width * TILE_SIZE;
    canvas.height = world.grid.height * TILE_SIZE;

    const floorA = cssVar('--color-tile-floor') || '#d9d5c9';
    const floorB = '#cfc9ba';
    const wallDark = cssVar('--color-tile-wall') || '#4a453d';
    const wallLine = '#5a544a';
    const doorC = cssVar('--color-tile-door') || '#8a6b3a';
    const stairsC = cssVar('--color-tile-stairs') || '#6a5d45';
    const bg = cssVar('--color-bg') || '#f5f3ef';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // tiles — stone + ink palette, grid detailing inspired by daemon-delve tiles
    for (let y = 0; y < world.grid.height; y++) {
      for (let x = 0; x < world.grid.width; x++) {
        const t = world.grid.tiles[y * world.grid.width + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        switch (t) {
          case TILE.wall: {
            ctx.fillStyle = wallDark;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = wallLine;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, py + TILE_SIZE * 0.35);
            ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE * 0.35);
            ctx.moveTo(px, py + TILE_SIZE * 0.7);
            ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE * 0.7);
            ctx.stroke();
            break;
          }
          case TILE.floor: {
            ctx.fillStyle = (x + y) % 2 === 0 ? floorA : floorB;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
            break;
          }
          case TILE.door: {
            ctx.fillStyle = floorA;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = doorC;
            ctx.fillRect(px + 4, py + 3, TILE_SIZE - 8, TILE_SIZE - 6);
            ctx.strokeStyle = '#343a42';
            ctx.strokeRect(px + 4.5, py + 3.5, TILE_SIZE - 9, TILE_SIZE - 7);
            break;
          }
          case TILE['stairs-down']: {
            ctx.fillStyle = '#5e496c';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = stairsC;
            for (let i = 0; i < 4; i++) {
              ctx.fillRect(px + 3 + i * 2.5, py + 5 + i * 3.5, TILE_SIZE - 6 - i * 5, 2);
            }
            ctx.strokeStyle = 'rgba(245, 238, 220, 0.6)';
            ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
            break;
          }
        }
      }
    }

    // enemies — generated sprite per archetype; HP bar overlaid
    for (const e of world.enemies) {
      if (e.hp === 0) continue;
      const px = e.pos.x * TILE_SIZE;
      const py = e.pos.y * TILE_SIZE;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 3, TILE_SIZE * 0.38, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const spriteId = archetypeSprite[e.archetype] ?? 'slime';
      const img = loadSprite(spriteId);
      if (img) {
        ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = '#9e3d43';
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      // hp bar
      const hpFrac = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px + 3, py + 1, TILE_SIZE - 6, 2.5);
      ctx.fillStyle = '#9e3d43';
      ctx.fillRect(px + 3, py + 1, (TILE_SIZE - 6) * hpFrac, 2.5);
    }

    // delvers — generated hero sprite per class; dimmed if downed
    for (const d of world.delvers) {
      const px = d.pos.x * TILE_SIZE;
      const py = d.pos.y * TILE_SIZE;
      const alive = d.hp > 0;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 3, TILE_SIZE * 0.38, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const spriteId = classSprite[d.class] ?? 'grimm-warrior';
      const img = loadSprite(spriteId);
      ctx.save();
      if (!alive) ctx.globalAlpha = 0.35;
      if (img) {
        ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
      } else {
        const fallback: Record<string, string> = {
          warrior: '#2f4858',
          ranger: '#3a6a3d',
          cleric: '#6b3a6a',
        };
        ctx.fillStyle = fallback[d.class] ?? '#2f4858';
        ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      }
      ctx.restore();
      // hp bar
      if (alive) {
        const hpFrac = d.hp / d.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(px + 3, py + 1, TILE_SIZE - 6, 2.5);
        ctx.fillStyle = '#5f8f73';
        ctx.fillRect(px + 3, py + 1, (TILE_SIZE - 6) * hpFrac, 2.5);
      }
    }
  }

  $effect(() => {
    void world?.tick;
    draw();
  });

  onMount(() => {
    draw();
    const obs = new ResizeObserver(() => draw());
    if (wrapper) obs.observe(wrapper);
    return () => obs.disconnect();
  });
</script>

<div class="grid-canvas-wrapper" bind:this={wrapper}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .grid-canvas-wrapper {
    width: 100%;
    height: 100%;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: var(--sp-4);
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
  }
  canvas {
    display: block;
    box-shadow: var(--elev-1);
    border-radius: var(--radius-sm);
  }
</style>
