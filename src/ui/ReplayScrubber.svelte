<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { LogEvent, RunTrace, TickFrame } from '../engine/types';
  import { TILE } from '../engine/grid';
  import { sprites, type SpriteId } from './sprites';

  interface Props {
    trace: RunTrace;
  }
  let { trace }: Props = $props();

  // ─── Canvas drawing ───────────────────────────────────────────
  let canvas: HTMLCanvasElement | undefined = $state();
  let wrapper: HTMLDivElement | undefined = $state();
  let tileSize = $state(16);

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

  function cssVar(name: string, fallback: string): string {
    if (!canvas) return fallback;
    const v = getComputedStyle(canvas).getPropertyValue(name).trim();
    return v || fallback;
  }
  function shade(hex: string, amt: number): string {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
    const adj = (c: number) => {
      const t = amt < 0 ? 0 : 255;
      return Math.round(c + (t - c) * Math.abs(amt));
    };
    return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
  }
  function isDark(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // ─── Scrubber state ───────────────────────────────────────────
  const lastTick = $derived(trace.frames.at(-1)?.tick ?? 0);
  let currentTick = $state(0);

  // Find the frame whose tick <= currentTick (nearest preceding state).
  const currentFrame = $derived<TickFrame | null>(
    trace.frames.length === 0
      ? null
      : trace.frames.reduce<TickFrame | null>((acc, f) => {
          if (f.tick <= currentTick) return f;
          return acc;
        }, null) ?? trace.frames[0],
  );

  // One-shot: on mount, default to the last tick so players land on the
  // endgame state. Must NOT be reactive — otherwise scrubbing to 0 would
  // instantly snap back to the end.
  onMount(() => {
    if (lastTick > 0) currentTick = lastTick;
  });

  // ─── Event filter ─────────────────────────────────────────────
  type EventKind = LogEvent['kind'];
  const KINDS: EventKind[] = [
    'spawn',
    'move',
    'attack',
    'damage',
    'heal',
    'death',
    'floor-cleared',
    'descend',
    'script-error',
    'budget-miss',
    'info',
  ];
  // Sensible defaults: the stuff players usually want to see.
  let enabledKinds = $state<Record<EventKind, boolean>>({
    spawn: false,
    move: false,
    attack: true,
    damage: true,
    heal: true,
    death: true,
    'floor-cleared': true,
    descend: true,
    'script-error': true,
    'budget-miss': true,
    info: false,
  });

  const visibleEvents = $derived(
    trace.events.filter((e) => enabledKinds[e.kind] && e.tick <= currentTick),
  );
  const eventCounts = $derived({
    all: trace.events.filter((e) => e.tick <= currentTick).length,
    actions: trace.events.filter(
      (e) => e.tick <= currentTick && (e.kind === 'attack' || e.kind === 'heal' || e.kind === 'descend'),
    ).length,
    danger: trace.events.filter(
      (e) => e.tick <= currentTick && (e.kind === 'damage' || e.kind === 'death' || e.kind === 'script-error'),
    ).length,
  });

  const currentRoom = $derived.by<string>(() => {
    if (!currentFrame) return '—';
    const alive = currentFrame.delvers.filter((d) => d.hp > 0);
    if (alive.length === 0) return 'Party down';
    // Average delver position → "approximate room center" tag; useful as a
    // shorthand rather than pinpoint accuracy.
    const avgX = Math.round(alive.reduce((s, d) => s + d.x, 0) / alive.length);
    const avgY = Math.round(alive.reduce((s, d) => s + d.y, 0) / alive.length);
    return `~(${avgX}, ${avgY})`;
  });

  // ─── Drawing ─────────────────────────────────────────────────
  function fit(): void {
    if (!wrapper) return;
    const availW = wrapper.clientWidth - 16;
    const availH = wrapper.clientHeight - 16;
    if (availW <= 0 || availH <= 0) return;
    const byW = Math.floor(availW / trace.grid.width);
    const byH = Math.floor(availH / trace.grid.height);
    const next = Math.max(6, Math.min(byW, byH));
    if (next !== tileSize) tileSize = next;
    draw();
  }

  function draw(): void {
    if (!canvas || !currentFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = trace.grid.width * tileSize;
    canvas.height = trace.grid.height * tileSize;

    const floorA = cssVar('--color-tile-floor', '#d9d5c9');
    const wallDark = cssVar('--color-tile-wall', '#4a453d');
    const stairsC = cssVar('--color-tile-stairs', '#6a5d45');
    const bg = cssVar('--color-bg', '#f5f3ef');
    const dark = isDark();
    const floorB = dark ? shade(floorA, 0.06) : shade(floorA, -0.05);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tiles
    for (let y = 0; y < trace.grid.height; y++) {
      for (let x = 0; x < trace.grid.width; x++) {
        const t = trace.grid.tiles[y * trace.grid.width + x];
        const px = x * tileSize;
        const py = y * tileSize;
        switch (t) {
          case TILE.wall:
            ctx.fillStyle = wallDark;
            ctx.fillRect(px, py, tileSize, tileSize);
            break;
          case TILE.floor:
            ctx.fillStyle = (x + y) % 2 === 0 ? floorA : floorB;
            ctx.fillRect(px, py, tileSize, tileSize);
            break;
          case TILE.door:
            ctx.fillStyle = floorA;
            ctx.fillRect(px, py, tileSize, tileSize);
            ctx.fillStyle = cssVar('--color-tile-door', '#8a6b3a');
            ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
            break;
          case TILE['stairs-down']:
            ctx.fillStyle = '#5e496c';
            ctx.fillRect(px, py, tileSize, tileSize);
            ctx.fillStyle = stairsC;
            for (let i = 0; i < 3; i++) {
              ctx.fillRect(px + 2 + i * 1.5, py + 3 + i * 2, tileSize - 4 - i * 3, 1);
            }
            break;
        }
      }
    }

    // Enemies
    for (const e of currentFrame.enemies) {
      if (e.hp <= 0) continue;
      const meta = trace.enemyMeta.find((m) => m.id === e.id);
      const archetype = meta?.archetype ?? 'slime';
      const img = loadSprite(archetypeSprite[archetype] ?? 'slime');
      if (img) ctx.drawImage(img, e.x * tileSize, e.y * tileSize, tileSize, tileSize);
    }

    // Delvers
    for (const d of currentFrame.delvers) {
      const meta = trace.delverMeta.find((m) => m.id === d.id);
      const img = loadSprite(classSprite[meta?.class ?? 'warrior'] ?? 'grimm-warrior');
      ctx.save();
      if (d.hp <= 0) ctx.globalAlpha = 0.35;
      if (img) ctx.drawImage(img, d.x * tileSize, d.y * tileSize, tileSize, tileSize);
      ctx.restore();
      if (d.hp > 0) {
        const frac = d.hp / (meta?.maxHp ?? d.hp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(d.x * tileSize + 2, d.y * tileSize + 1, tileSize - 4, 2);
        ctx.fillStyle = '#5f8f73';
        ctx.fillRect(d.x * tileSize + 2, d.y * tileSize + 1, (tileSize - 4) * frac, 2);
      }
    }

    // "You are here" marker — a pulsing ring around the current room
    // center, so a glance tells you where the action is at this tick.
    const alive = currentFrame.delvers.filter((d) => d.hp > 0);
    if (alive.length > 0) {
      const avgX = alive.reduce((s, d) => s + d.x, 0) / alive.length;
      const avgY = alive.reduce((s, d) => s + d.y, 0) / alive.length;
      ctx.strokeStyle = 'rgba(244, 164, 90, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(
        avgX * tileSize + tileSize / 2,
        avgY * tileSize + tileSize / 2,
        Math.max(14, tileSize * 1.4),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  $effect(() => {
    // Redraw when tick or frame changes.
    void currentFrame;
    draw();
  });

  onMount(() => {
    fit();
    const obs = new ResizeObserver(() => fit());
    if (wrapper) obs.observe(wrapper);
    return () => obs.disconnect();
  });

  let playTimer: ReturnType<typeof setInterval> | null = null;
  let playing = $state(false);

  function togglePlay(): void {
    if (playing) {
      stopPlay();
      return;
    }
    if (currentTick >= lastTick) currentTick = 0;
    playing = true;
    playTimer = setInterval(() => {
      if (currentTick >= lastTick) {
        stopPlay();
        return;
      }
      currentTick++;
    }, 120);
  }
  function stopPlay(): void {
    playing = false;
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  onDestroy(stopPlay);

  function stepBack(): void { currentTick = Math.max(0, currentTick - 1); stopPlay(); }
  function stepFwd(): void { currentTick = Math.min(lastTick, currentTick + 1); stopPlay(); }
  function jumpStart(): void { currentTick = 0; stopPlay(); }
  function jumpEnd(): void { currentTick = lastTick; stopPlay(); }
</script>

<section class="replay">
  <header class="r-head">
    <div>
      <p class="eyebrow">Replay</p>
      <h3>Scrub through the run</h3>
    </div>
    <div class="stats">
      <div class="stat"><span class="lbl">Tick</span><strong>{currentTick}</strong><em>/ {lastTick}</em></div>
      <div class="stat"><span class="lbl">Events</span><strong>{eventCounts.all}</strong></div>
      <div class="stat"><span class="lbl">Actions</span><strong>{eventCounts.actions}</strong></div>
      <div class="stat danger"><span class="lbl">Danger</span><strong>{eventCounts.danger}</strong></div>
      <div class="stat"><span class="lbl">Room</span><strong class="room">{currentRoom}</strong></div>
    </div>
  </header>

  <div class="body">
    <div class="sim-frame" bind:this={wrapper}>
      <canvas bind:this={canvas}></canvas>
    </div>

    <aside class="side">
      <div class="filters">
        <p class="eyebrow sm">Event types</p>
        <div class="kinds">
          {#each KINDS as k}
            <label class="kind-chip" class:on={enabledKinds[k]}>
              <input type="checkbox" bind:checked={enabledKinds[k]} />
              {k}
            </label>
          {/each}
        </div>
      </div>

      <div class="log">
        <p class="eyebrow sm">Timeline</p>
        <ol class="log-list">
          {#each visibleEvents.slice(-20).reverse() as e}
            <li class="log-row {e.kind}">
              <span class="t">t{e.tick}</span>
              <span class="msg">{e.message}</span>
            </li>
          {/each}
          {#if visibleEvents.length === 0}
            <li class="log-empty">Nothing matches the current filter yet.</li>
          {/if}
        </ol>
      </div>
    </aside>
  </div>

  <footer class="scrubber">
    <div class="transport">
      <button type="button" class="icon" onclick={jumpStart} title="Jump to start">⏮</button>
      <button type="button" class="icon" onclick={stepBack} title="Step back">◀</button>
      <button type="button" class="icon primary-ish" onclick={togglePlay} title={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button type="button" class="icon" onclick={stepFwd} title="Step forward">▶|</button>
      <button type="button" class="icon" onclick={jumpEnd} title="Jump to end">⏭</button>
    </div>
    <input
      type="range"
      min="0"
      max={lastTick}
      step="1"
      bind:value={currentTick}
      class="range"
      aria-label="Replay tick"
      oninput={stopPlay}
    />
  </footer>
</section>

<style>
  .replay {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    min-height: 0;
  }
  .r-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  .eyebrow.sm { margin-bottom: 4px; }
  h3 { margin: 2px 0 0; color: var(--color-text); font-size: var(--fs-md); }

  .stats {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-family: var(--font-mono);
  }
  .stat .lbl {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  .stat strong {
    font-size: var(--fs-md);
    color: var(--color-text);
    line-height: 1;
  }
  .stat em {
    font-style: normal;
    font-size: 10px;
    color: var(--color-text-subtle);
    margin-left: 4px;
  }
  .stat.danger strong { color: var(--color-danger, #c94a4a); }
  .room { font-size: var(--fs-sm); }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: var(--sp-3);
    min-height: 0;
  }
  .sim-frame {
    aspect-ratio: 4 / 3;
    width: 100%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  canvas { max-width: 100%; max-height: 100%; display: block; border-radius: var(--radius-sm); }

  .side {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }
  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .kind-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-text-subtle);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    cursor: pointer;
  }
  .kind-chip input { display: none; }
  .kind-chip.on {
    background: color-mix(in srgb, var(--color-accent) 15%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-accent) 50%, transparent);
    color: var(--color-text);
  }

  .log {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    max-height: 240px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .log-row {
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 6px;
    padding: 2px 4px;
    border-left: 2px solid transparent;
    color: var(--color-text-muted);
  }
  .log-row.damage, .log-row.death, .log-row.script-error, .log-row.budget-miss {
    border-left-color: var(--color-danger, #c94a4a);
    color: var(--color-text);
  }
  .log-row.attack, .log-row.heal, .log-row.descend, .log-row.floor-cleared {
    border-left-color: var(--color-accent);
  }
  .log-row .t { color: var(--color-text-subtle); }
  .log-empty {
    padding: var(--sp-2);
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
    text-align: center;
  }

  .scrubber {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding-top: var(--sp-2);
    border-top: 1px solid var(--color-border);
  }
  .transport {
    display: inline-flex;
    gap: 2px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 2px;
  }
  .transport .icon {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    border-radius: var(--radius-sm);
  }
  .transport .icon:hover { color: var(--color-text); background: var(--color-surface); }
  .transport .primary-ish {
    background: var(--color-accent);
    color: var(--color-text-inverse);
  }
  .transport .primary-ish:hover { background: var(--color-accent-hover); color: var(--color-text-inverse); }

  .range {
    flex: 1;
    accent-color: var(--color-accent);
  }

  @media (max-width: 900px) {
    .body { grid-template-columns: 1fr; }
    .sim-frame { aspect-ratio: 16 / 10; }
  }
  @media (max-width: 520px) {
    .scrubber { flex-wrap: wrap; }
    .range { flex: 1 1 100%; order: 2; }
  }
</style>
