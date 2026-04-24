<script lang="ts">
  import { game } from '../../stores/game.svelte';
  import AtmosphereLayer from '../AtmosphereLayer.svelte';
  import SimulationBackdrop from '../SimulationBackdrop.svelte';
  import { sprites, type SpriteId } from '../sprites';

  async function onDescend(): Promise<void> {
    await game.startRun();
  }

  function onLoadout(): void {
    game.screen = 'loadout';
  }

  const isFirstRun = $derived(game.meta.totalRuns === 0);

  interface Classmeta {
    cls: 'warrior' | 'ranger' | 'cleric';
    name: string;
    role: string;
    blurb: string;
    hp: number;
    atk: number;
    range: number;
    mp: number;
    abilities?: string[];
    sprite: SpriteId;
  }
  const party: Classmeta[] = [
    { cls: 'warrior', name: 'Grimm', role: 'Tank', blurb: 'Front-line. High armour. Takes the hits.', hp: 45, atk: 7, range: 1, mp: 0, sprite: 'grimm-warrior' },
    { cls: 'ranger', name: 'Vex', role: 'DPS', blurb: 'Fragile. Deadly from three tiles away. Needs a tank.', hp: 30, atk: 8, range: 3, mp: 0, sprite: 'vex-ranger' },
    { cls: 'cleric', name: 'Mira', role: 'Support', blurb: 'Short-range support. Heals wounds and can revive once per depth.', hp: 30, atk: 5, range: 2, mp: 10, abilities: ['Heal 5 HP', 'Revive 5 HP'], sprite: 'mira-cleric' },
  ];
</script>

<section class="home-scroll">
  <div class="hero">
    <SimulationBackdrop />
    <AtmosphereLayer />
    <div class="hero-content">
    <div class="hero-sigil" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <path d="M50 6 L88 30 L88 72 L72 90 L50 96 L28 90 L12 72 L12 30 Z" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.5" />
        <path d="M50 18 L76 34 L76 66 L64 82 L50 86 L36 82 L24 66 L24 34 Z" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35" />
        <path d="M50 30 L62 50 L50 70 L38 50 Z" fill="currentColor" opacity="0.28" />
        <circle cx="50" cy="50" r="4" fill="currentColor" opacity="0.55" />
        <path d="M20 50 L40 50 M60 50 L80 50 M50 20 L50 40 M50 60 L50 80" stroke="currentColor" stroke-width="0.8" opacity="0.4" />
      </svg>
    </div>
    <h1 class="wordmark">AutoDelver</h1>
    <p class="tagline">You do not descend. You <em>write</em> the descent.</p>

    <div class="cta-row">
      <button type="button" class="primary cta" onclick={onDescend}>
        {isFirstRun ? 'Begin First Descent' : 'Descend'}
      </button>
      <button type="button" onclick={onLoadout}>Edit Scripts</button>
    </div>

    {#if game.meta.totalRuns > 0}
      <div class="legacy-compact">
        <span><strong>Depth {game.meta.deepestDepth}</strong> reached</span>
        <span class="divider">·</span>
        <span><strong>{game.meta.insight}</strong> Insight</span>
        <span class="divider">·</span>
        <span><strong>{game.meta.totalRuns}</strong> run{game.meta.totalRuns === 1 ? '' : 's'}</span>
      </div>
    {/if}
    </div>
  </div>

  <div class="page-body">
  <div class="story card">
    <p>
      You are not a hero. You are the <strong>necromancer-programmer</strong>. Your party of three delvers descends an
      infinite dungeon on its own — each driven by a short <code>tick(ctx)</code> function <em>you</em> write.
      Watch them thrive. Watch them die to a null-reference. Patch the bug. Descend deeper.
    </p>
  </div>

  <section class="section">
    <h3 class="sec-head">The Party</h3>
    <p class="sec-sub">Three delvers. Each runs their own script, on their own worker.</p>

    <div class="roster">
      {#each party as p}
        <div class="role {p.cls}">
          <div class="role-head">
            <div class="portrait" aria-hidden="true">
              {@html sprites[p.sprite].svg}
            </div>
            <div class="role-meta">
              <div class="role-name">{p.name}</div>
              <div class="role-role">{p.cls} · {p.role}</div>
            </div>
          </div>
          <div class="role-blurb">{p.blurb}</div>
          <div class="role-stats">
            <div class="stat-cell"><span class="lbl">HP</span><span class="val">{p.hp}</span></div>
            <div class="stat-cell"><span class="lbl">ATK</span><span class="val">{p.atk}</span></div>
            <div class="stat-cell"><span class="lbl">RNG</span><span class="val">{p.range}</span></div>
            <div class="stat-cell"><span class="lbl">MP</span><span class="val">{p.mp}</span></div>
          </div>
          {#if p.abilities}
            <div class="role-abilities">
              {#each p.abilities as ab}
                <span class="ability-chip">{ab}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="section">
    <h3 class="sec-head">The Loop</h3>
    <p class="sec-sub">One minute per cycle. Iterate until the code actually clears the floor.</p>

    <div class="steps">
      <div class="step">
        <div class="step-num">01</div>
        <h4>Write</h4>
        <p>
          Each delver owns a <code>tick(ctx)</code> function. Full Monaco editor, autocomplete on
          <code>ctx.*</code>, inline API reference.
        </p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <h4>Deploy</h4>
        <p>
          Hit <em>Descend</em>. Scripts run in sandboxed Web Workers — one per delver. Grid, pathfinding,
          combat, all deterministic.
        </p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <h4>Diagnose</h4>
        <p>
          Something died. The combat log tells you who, where, and why. You pause, edit the script mid-run,
          and try again.
        </p>
      </div>
    </div>
  </section>

  <section class="section">
    <h3 class="sec-head">A First Script</h3>
    <p class="sec-sub">This is everything you need for the Warrior to reach the stairs.</p>

    <pre class="code-preview">{`function tick(ctx) {
  // On the stairs? Go down.
  if (ctx.self.pos.x === ctx.stairs.x &&
      ctx.self.pos.y === ctx.stairs.y) {
    return { type: 'descend' };
  }

  // Bleeding? Retreat.
  if (ctx.self.hp < 12) return { type: 'retreat' };

  // Nearest enemy.
  let near = null, best = Infinity;
  for (const e of ctx.enemies) {
    const d = Math.abs(e.pos.x - ctx.self.pos.x) + Math.abs(e.pos.y - ctx.self.pos.y);
    if (d < best) { best = d; near = e; }
  }

  if (near && best === 1) return { type: 'attack', target: near.id };
  if (near && best <= 6) return { type: 'move',   target: near.pos };
  return { type: 'move', target: ctx.stairs };
}`}</pre>
  </section>

  {#if game.meta.totalRuns > 0}
    <section class="section legacy">
      <h3 class="sec-head">Your Legacy</h3>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Deepest</div>
          <div class="stat-value">{game.meta.deepestDepth}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Insight</div>
          <div class="stat-value">{game.meta.insight}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Runs</div>
          <div class="stat-value">{game.meta.totalRuns}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Deaths</div>
          <div class="stat-value">{game.meta.totalDeaths}</div>
        </div>
      </div>

      {#if game.meta.unlockedApis.length > 0}
        <div class="unlocks">
          <span class="unlocks-label">Unlocked</span>
          {#each game.meta.unlockedApis as api}
            <code>ctx.{api}</code>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <footer class="site-foot">
    <div>AutoDelver · Svelte 5 + Vite + TypeScript</div>
    <div class="foot-mono">roguelite · idler · programmable</div>
  </footer>
  </div>
</section>

<style>
  .home-scroll {
    height: 100%;
    overflow-y: auto;
    padding: 0 0 var(--sp-8);
    background: var(--color-bg);
  }
  .page-body {
    padding: var(--sp-8) var(--sp-5) 0;
  }

  /* ─── HERO (dark dungeon diorama) ─────────── */
  .hero {
    width: 100%;
    padding: var(--sp-10) var(--sp-4) var(--sp-12);
    text-align: center;
    position: relative;
    isolation: isolate;
    min-height: 640px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text);
  }
  .hero-content {
    position: relative;
    z-index: 2;
    max-width: 960px;
    margin: 0 auto;
  }

  .hero-sigil {
    width: 88px;
    height: 88px;
    margin: 0 auto var(--sp-4);
    color: var(--color-accent);
    filter: drop-shadow(0 0 12px color-mix(in srgb, var(--color-accent) 40%, transparent));
    animation: pulse 4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.03); }
  }
  .hero-sigil svg {
    width: 100%;
    height: 100%;
  }

  .wordmark {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: clamp(3rem, 8vw, 5.5rem);
    letter-spacing: -0.04em;
    color: var(--color-text);
    margin: 0 0 var(--sp-3);
    line-height: 1;
    text-shadow: 0 1px 0 var(--color-bg), 0 0 20px var(--color-bg);
  }
  .wordmark::after {
    content: '_';
    color: var(--color-accent);
    margin-left: 4px;
    animation: blink 1.2s steps(2, end) infinite;
  }
  @keyframes blink {
    50% { opacity: 0; }
  }

  .tagline {
    color: var(--color-text-muted);
    font-size: clamp(1rem, 1.8vw, 1.25rem);
    margin: 0 0 var(--sp-6);
    font-style: italic;
    letter-spacing: 0.01em;
  }
  .tagline em {
    color: var(--color-accent);
    font-style: italic;
    font-weight: 600;
  }

  .cta-row {
    display: flex;
    gap: var(--sp-3);
    justify-content: center;
    margin-bottom: var(--sp-5);
  }
  .cta-row .cta {
    padding: var(--sp-3) var(--sp-6);
    font-size: var(--fs-md);
    font-weight: 600;
    letter-spacing: 0.01em;
    box-shadow: var(--elev-2);
  }
  .cta-row button:not(.cta) {
    padding: var(--sp-3) var(--sp-5);
  }

  .legacy-compact {
    display: flex;
    justify-content: center;
    gap: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .legacy-compact strong {
    color: var(--color-text);
    font-weight: 600;
  }
  .legacy-compact .divider {
    color: var(--color-border-strong);
  }

  /* ─── STORY ───────────────────────────────── */
  .story {
    max-width: 740px;
    margin: var(--sp-5) auto var(--sp-8);
    padding: var(--sp-5) var(--sp-6);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-lg);
    box-shadow: var(--elev-1);
  }
  .story p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--fs-md);
    line-height: 1.7;
  }
  .story strong {
    color: var(--color-text);
  }
  .story em {
    color: var(--color-accent);
    font-style: normal;
    font-weight: 600;
  }
  .story code {
    font-family: var(--font-mono);
    background: var(--color-surface-2);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.9em;
  }

  /* ─── SECTIONS ────────────────────────────── */
  .section {
    max-width: 1080px;
    margin: 0 auto var(--sp-8);
  }
  .sec-head {
    font-size: var(--fs-xl);
    color: var(--color-text);
    margin: 0 0 var(--sp-1);
    text-align: center;
  }
  .sec-sub {
    color: var(--color-text-subtle);
    text-align: center;
    margin: 0 0 var(--sp-5);
    font-size: var(--fs-sm);
  }

  /* ─── ROSTER ──────────────────────────────── */
  .roster {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-4);
  }
  .role {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--sp-5);
    box-shadow: var(--elev-1);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    transition: transform var(--dur-base) var(--ease-out),
                box-shadow var(--dur-base) var(--ease-out);
  }
  .role:hover {
    transform: translateY(-2px);
    box-shadow: var(--elev-2);
  }
  .role-head {
    display: flex;
    gap: var(--sp-3);
    align-items: center;
  }
  .portrait {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .portrait :global(svg) {
    width: 100%;
    height: 100%;
  }
  .role.warrior { color: var(--color-warrior); }
  .role.ranger  { color: var(--color-ranger); }
  .role.cleric  { color: var(--color-cleric); }
  .role-meta {
    min-width: 0;
  }
  .role-name {
    font-weight: 700;
    font-size: var(--fs-lg);
    color: var(--color-text);
  }
  .role-role {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .role-blurb {
    color: var(--color-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.5;
  }
  .role-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--color-border);
  }
  .stat-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px 4px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  .stat-cell .lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  .stat-cell .val {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--color-text);
    line-height: 1;
  }
  .role-abilities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }
  .ability-chip {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: currentColor;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* ─── STEPS ───────────────────────────────── */
  .steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-4);
  }
  .step {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--sp-5);
    position: relative;
  }
  .step-num {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--color-accent);
    letter-spacing: 0.1em;
    margin-bottom: var(--sp-2);
  }
  .step h4 {
    font-size: var(--fs-lg);
    margin: 0 0 var(--sp-2);
    color: var(--color-text);
  }
  .step p {
    margin: 0;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--color-text-muted);
  }
  .step code {
    font-family: var(--font-mono);
    background: var(--color-surface-2);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    font-size: 0.92em;
  }
  .step em {
    color: var(--color-accent);
    font-style: normal;
    font-weight: 600;
  }

  /* ─── CODE PREVIEW ────────────────────────── */
  .code-preview {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-md);
    padding: var(--sp-5);
    max-width: 800px;
    margin: 0 auto;
    overflow-x: auto;
    line-height: 1.5;
    box-shadow: var(--elev-1);
  }

  /* ─── LEGACY STATS ────────────────────────── */
  .legacy .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-3);
    max-width: 720px;
    margin: 0 auto;
  }
  .stat-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--sp-4);
    text-align: center;
  }
  .stat-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-subtle);
    margin-bottom: var(--sp-1);
  }
  .stat-value {
    font-size: var(--fs-2xl);
    font-weight: 700;
    color: var(--color-text);
  }
  .unlocks {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-4);
    flex-wrap: wrap;
  }
  .unlocks-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-subtle);
  }
  .unlocks code {
    font-family: var(--font-mono);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
    font-weight: 600;
  }

  /* ─── FOOTER ──────────────────────────────── */
  .site-foot {
    max-width: 1080px;
    margin: var(--sp-6) auto 0;
    padding-top: var(--sp-5);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
  }
  .foot-mono {
    font-family: var(--font-mono);
    letter-spacing: 0.05em;
  }

  /* ─── RESPONSIVE ──────────────────────────── */
  @media (max-width: 720px) {
    .roster,
    .steps {
      grid-template-columns: 1fr;
    }
    .legacy .stats {
      grid-template-columns: repeat(2, 1fr);
    }
    .legacy-compact {
      flex-wrap: wrap;
      gap: var(--sp-2);
    }
    .site-foot {
      flex-direction: column;
      gap: var(--sp-2);
      text-align: center;
    }
  }
</style>
