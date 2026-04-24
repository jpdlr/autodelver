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
  let tileSize = $state(24);

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

  function shade(hex: string, amount: number): string {
    // amount: -1..1 — negative darkens, positive lightens. Falls back to input
    // on parse errors (empty strings, var() forms).
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const adj = (c: number): number => {
      const t = amount < 0 ? 0 : 255;
      const k = Math.abs(amount);
      return Math.round(c + (t - c) * k);
    };
    const toHex = (c: number): string => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
    return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
  }

  function isDarkTheme(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function draw(): void {
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = world.grid.width * tileSize;
    canvas.height = world.grid.height * tileSize;

    const floorA = cssVar('--color-tile-floor') || '#d9d5c9';
    const wallDark = cssVar('--color-tile-wall') || '#4a453d';
    const doorC = cssVar('--color-tile-door') || '#8a6b3a';
    const stairsC = cssVar('--color-tile-stairs') || '#6a5d45';
    const bg = cssVar('--color-bg') || '#f5f3ef';
    // Derive the checker companion from the floor token so themes stay
    // in-palette — avoids the dark-mode glitch where a hardcoded light
    // color bled through every other floor tile.
    const dark = isDarkTheme();
    const floorB = dark ? shade(floorA, 0.06) : shade(floorA, -0.05);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // tiles — stone + ink palette, grid detailing inspired by daemon-delve tiles
    for (let y = 0; y < world.grid.height; y++) {
      for (let x = 0; x < world.grid.width; x++) {
        const t = world.grid.tiles[y * world.grid.width + x];
        const px = x * tileSize;
        const py = y * tileSize;
        switch (t) {
          case TILE.wall: {
            ctx.fillStyle = wallDark;
            ctx.fillRect(px, py, tileSize, tileSize);
            break;
          }
          case TILE.floor: {
            ctx.fillStyle = (x + y) % 2 === 0 ? floorA : floorB;
            ctx.fillRect(px, py, tileSize, tileSize);
            ctx.strokeStyle = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
            break;
          }
          case TILE.door: {
            ctx.fillStyle = floorA;
            ctx.fillRect(px, py, tileSize, tileSize);
            ctx.fillStyle = doorC;
            ctx.fillRect(px + 4, py + 3, tileSize - 8, tileSize - 6);
            ctx.strokeStyle = '#343a42';
            ctx.strokeRect(px + 4.5, py + 3.5, tileSize - 9, tileSize - 7);
            break;
          }
          case TILE['stairs-down']: {
            ctx.fillStyle = '#5e496c';
            ctx.fillRect(px, py, tileSize, tileSize);
            ctx.fillStyle = stairsC;
            for (let i = 0; i < 4; i++) {
              ctx.fillRect(px + 3 + i * 2.5, py + 5 + i * 3.5, tileSize - 6 - i * 5, 2);
            }
            ctx.strokeStyle = 'rgba(245, 238, 220, 0.6)';
            ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
            break;
          }
        }
      }
    }

    // enemies — generated sprite per archetype; HP bar overlaid
    for (const e of world.enemies) {
      if (e.hp === 0) continue;
      const px = e.pos.x * tileSize;
      const py = e.pos.y * tileSize;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(px + tileSize / 2, py + tileSize - 3, tileSize * 0.38, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const spriteId = archetypeSprite[e.archetype] ?? 'slime';
      const img = loadSprite(spriteId);
      if (img) {
        ctx.drawImage(img, px, py, tileSize, tileSize);
      } else {
        ctx.fillStyle = '#9e3d43';
        ctx.beginPath();
        ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
      // hp bar
      const hpFrac = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px + 3, py + 1, tileSize - 6, 2.5);
      ctx.fillStyle = '#9e3d43';
      ctx.fillRect(px + 3, py + 1, (tileSize - 6) * hpFrac, 2.5);
    }

    // delvers — generated hero sprite per class; dimmed if downed
    for (const d of world.delvers) {
      const px = d.pos.x * tileSize;
      const py = d.pos.y * tileSize;
      const alive = d.hp > 0;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(px + tileSize / 2, py + tileSize - 3, tileSize * 0.38, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const spriteId = classSprite[d.class] ?? 'grimm-warrior';
      const img = loadSprite(spriteId);
      ctx.save();
      if (!alive) ctx.globalAlpha = 0.35;
      if (img) {
        ctx.drawImage(img, px, py, tileSize, tileSize);
      } else {
        const fallback: Record<string, string> = {
          warrior: '#2f4858',
          ranger: '#3a6a3d',
          cleric: '#6b3a6a',
        };
        ctx.fillStyle = fallback[d.class] ?? '#2f4858';
        ctx.fillRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
      }
      ctx.restore();
      // hp bar
      if (alive) {
        const hpFrac = d.hp / d.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(px + 3, py + 1, tileSize - 6, 2.5);
        ctx.fillStyle = '#5f8f73';
        ctx.fillRect(px + 3, py + 1, (tileSize - 6) * hpFrac, 2.5);
      }
    }
  }

  function fit(): void {
    if (!wrapper || !world) return;
    const padding = 16; // matches wrapper padding so the dungeon breathes
    const availW = wrapper.clientWidth - padding * 2;
    const availH = wrapper.clientHeight - padding * 2;
    if (availW <= 0 || availH <= 0) return;
    const byW = Math.floor(availW / world.grid.width);
    const byH = Math.floor(availH / world.grid.height);
    const next = Math.max(6, Math.min(byW, byH));
    if (next !== tileSize) {
      tileSize = next;
    }
    draw();
  }

  $effect(() => {
    // refit when the world (and therefore grid dimensions) changes
    void world?.grid.width;
    void world?.grid.height;
    fit();
  });

  $effect(() => {
    void world?.tick;
    draw();
  });

  onMount(() => {
    fit();
    const obs = new ResizeObserver(() => fit());
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
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--sp-2);
    background: var(--color-surface-2);
    border-radius: var(--radius-md);
  }
  canvas {
    display: block;
    box-shadow: var(--elev-1);
    border-radius: var(--radius-sm);
    max-width: 100%;
    max-height: 100%;
  }
</style>
