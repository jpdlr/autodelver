<script lang="ts">
  // Live mini-simulation of an AutoDelver run, rendered into the hero
  // background. Uses the same engine as the real game — not a recording.
  // Party auto-descends using a built-in decision function; when the
  // floor clears or they wipe, a fresh world spins up after a pause.

  import { onMount, onDestroy } from 'svelte';
  import { createWorld, spawnDelver, entityAt } from '../engine/world';
  import { advanceTick } from '../engine/tick';
  import { findPath } from '../engine/pathfind';
  import { TILE, isWalkable, distManhattan } from '../engine/grid';
  import type { Action, Delver, World, Pos } from '../engine/types';
  import { sprites, type SpriteId } from './sprites';

  let canvas: HTMLCanvasElement | undefined = $state();
  let container: HTMLDivElement | undefined = $state();
  let world: World | null = null;
  let tickHandle: number | null = null;
  let restartHandle: number | null = null;
  let seed = 0;

  const TILE_SIZE = 18;
  const TICK_MS = 220;

  const classSprite: Record<string, SpriteId> = {
    warrior: 'grimm-warrior',
    ranger: 'vex-ranger',
    cleric: 'mira-cleric',
  };
  const archetypeSprite: Record<string, SpriteId> = {
    slime: 'slime',
    goblin: 'skitter',
    wraith: 'wraith',
  };

  const imgs: Partial<Record<SpriteId, HTMLImageElement>> = {};
  const ready = new Set<SpriteId>();
  function loadSprite(id: SpriteId): HTMLImageElement | null {
    const existing = imgs[id];
    if (existing) return ready.has(id) ? existing : null;
    const img = new Image();
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(sprites[id].svg)}`;
    imgs[id] = img;
    img.onload = () => {
      ready.add(id);
      draw();
    };
    return null;
  }

  function newWorld(): World {
    seed++;
    const ws = `sim-${seed}-${Date.now()}`;
    const placeholder: Pos = { x: 0, y: 0 };
    const delvers: Delver[] = [
      spawnDelver({ class: 'warrior', name: 'Grimm', script: '', pos: placeholder }),
      spawnDelver({ class: 'ranger', name: 'Vex', script: '', pos: placeholder }),
      spawnDelver({ class: 'cleric', name: 'Mira', script: '', pos: placeholder }),
    ];
    return createWorld({ seed: ws, depth: 1, delvers });
  }

  // Built-in decision function — mirrors the default scripts.
  function decideAction(w: World, d: Delver): Action {
    if (d.hp === 0) return { type: 'wait' };
    if (d.pos.x === w.stairs.x && d.pos.y === w.stairs.y) return { type: 'descend' };

    // nearest living enemy
    let near: typeof w.enemies[number] | null = null;
    let best = Infinity;
    for (const e of w.enemies) {
      if (e.hp === 0) continue;
      const dist = distManhattan(d.pos, e.pos);
      if (dist < best) { best = dist; near = e; }
    }

    if (near && best === 1) return { type: 'attack', target: near.id };

    // plan a path toward target
    let target: Pos;
    if (near && best <= 8) target = near.pos;
    else target = w.stairs;

    const blocked = new Set(
      w.delvers.filter((o) => o.id !== d.id && o.hp > 0).map((o) => `${o.pos.x},${o.pos.y}`)
    );
    const path = findPath(w.grid, d.pos, target, blocked);
    if (path && path.length > 1) {
      const next = path[1];
      const occ = entityAt(w, next);
      if (occ && occ.kind === 'delver' && occ.hp > 0) return { type: 'wait' };
      return { type: 'move', target: next };
    }
    return { type: 'wait' };
  }

  function step(): void {
    if (!world) return;
    if (world.status !== 'running') {
      // floor cleared or wiped — spin up a new world after a pause
      if (restartHandle === null) {
        restartHandle = window.setTimeout(() => {
          restartHandle = null;
          world = newWorld();
          draw();
        }, 1400);
      }
      return;
    }
    const actions = new Map<string, Action>();
    for (const d of world.delvers) actions.set(d.id, decideAction(world, d));
    world = advanceTick(world, { delverActions: actions });

    // safety: bail runs that go nowhere (rare — would loop forever)
    if (world.tick > 400 && world.status === 'running') {
      world.status = 'wiped';
    }

    draw();
  }

  function cssVar(name: string, fallback: string): string {
    if (!canvas) return fallback;
    const v = getComputedStyle(canvas).getPropertyValue(name).trim();
    return v || fallback;
  }

  function draw(): void {
    if (!canvas || !world || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = world.grid.width * TILE_SIZE;
    const H = world.grid.height * TILE_SIZE;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    // Theme-aware palette — blends with the page background in both modes.
    const bg = cssVar('--color-bg', '#f5f3ef');
    const surface = cssVar('--color-surface-2', '#ecebe6');
    const surface3 = cssVar('--color-surface-3', '#dedcd4');
    const border = cssVar('--color-border', '#cfccc3');
    const accent = cssVar('--color-accent', '#a86b2c');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < world.grid.height; y++) {
      for (let x = 0; x < world.grid.width; x++) {
        const t = world.grid.tiles[y * world.grid.width + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        switch (t) {
          case TILE.wall:
            ctx.fillStyle = surface3;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            break;
          case TILE.floor:
            ctx.fillStyle = (x + y) % 2 === 0 ? surface : bg;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = border;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px + 0.25, py + 0.25, TILE_SIZE - 0.5, TILE_SIZE - 0.5);
            break;
          case TILE.door:
            ctx.fillStyle = surface;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = accent;
            ctx.fillRect(px + 3, py + 2, TILE_SIZE - 6, TILE_SIZE - 4);
            break;
          case TILE['stairs-down']:
            ctx.fillStyle = surface;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = accent;
            for (let i = 0; i < 3; i++) {
              ctx.fillRect(px + 3 + i * 2, py + 4 + i * 3, TILE_SIZE - 6 - i * 4, 1.5);
            }
            break;
          default:
            ctx.fillStyle = bg;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // enemies
    for (const e of world.enemies) {
      if (e.hp === 0) continue;
      const px = e.pos.x * TILE_SIZE;
      const py = e.pos.y * TILE_SIZE;
      const img = loadSprite(archetypeSprite[e.archetype] ?? 'slime');
      if (img) {
        ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = '#9e3d43';
        ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      }
    }

    // delvers
    for (const d of world.delvers) {
      const px = d.pos.x * TILE_SIZE;
      const py = d.pos.y * TILE_SIZE;
      const alive = d.hp > 0;
      const img = loadSprite(classSprite[d.class] ?? 'grimm-warrior');
      ctx.save();
      if (!alive) ctx.globalAlpha = 0.35;
      if (img) ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
      ctx.restore();
    }
  }

  onMount(() => {
    world = newWorld();
    draw();
    tickHandle = window.setInterval(step, TICK_MS);
    const obs = new ResizeObserver(() => draw());
    if (container) obs.observe(container);
    return () => obs.disconnect();
  });

  onDestroy(() => {
    if (tickHandle !== null) clearInterval(tickHandle);
    if (restartHandle !== null) clearTimeout(restartHandle);
    void isWalkable; // keep import tree-shakable-safe
  });
</script>

<div class="sim-backdrop" bind:this={container} aria-hidden="true">
  <canvas bind:this={canvas}></canvas>
  <div class="glow"></div>
  <div class="edge-fade"></div>
</div>

<style>
  .sim-backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
    background: var(--color-bg);
  }

  canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 130%;
    height: auto;
    opacity: 0.85;
  }

  /* Soft paper glow behind the title so the wordmark stays legible. */
  .glow {
    position: absolute;
    left: 50%;
    top: 45%;
    width: 760px;
    height: 280px;
    transform: translate(-50%, -50%);
    background: radial-gradient(
      ellipse at center,
      var(--color-bg) 0%,
      color-mix(in srgb, var(--color-bg) 70%, transparent) 45%,
      transparent 75%
    );
    filter: blur(20px);
  }

  /* Gentle fade so the sim edges merge with the page rather than hard-cutting. */
  .edge-fade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, var(--color-bg) 0%, transparent 10%, transparent 90%, var(--color-bg) 100%),
      linear-gradient(90deg, var(--color-bg) 0%, transparent 8%, transparent 92%, var(--color-bg) 100%);
  }
</style>
