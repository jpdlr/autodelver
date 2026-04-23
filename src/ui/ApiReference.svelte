<script lang="ts">
  interface Props {
    compact?: boolean;
  }
  let { compact = false }: Props = $props();

  interface Entry {
    name: string;
    desc: string;
    example?: string;
  }

  const ctxFields: Entry[] = [
    { name: 'ctx.self', desc: 'Your delver.', example: 'ctx.self.hp' },
    { name: 'ctx.self.pos', desc: 'Your x/y tile.', example: 'ctx.self.pos.x' },
    { name: 'ctx.self.hp / maxHp', desc: 'Current / max health.' },
    { name: 'ctx.self.mp / maxMp', desc: 'Current / max magic.' },
    { name: 'ctx.self.class', desc: `"warrior" | "ranger" | "cleric"` },
    { name: 'ctx.self.name', desc: `"Grimm" | "Vex" | "Mira"` },
    { name: 'ctx.enemies', desc: 'Living enemies: id, pos, hp.', example: 'ctx.enemies.length' },
    { name: 'ctx.party', desc: 'Other delvers (not self).' },
    { name: 'ctx.stairs', desc: 'Goal of this floor (a Pos).', example: 'ctx.stairs.x' },
    { name: 'ctx.entrance', desc: 'Where the floor began.' },
    { name: 'ctx.tick', desc: 'Tick number this run.' },
    { name: 'ctx.depth', desc: 'Current dungeon depth.' },
    { name: 'ctx.memory', desc: 'Per-delver scratch object.' },
    { name: 'ctx.unlocked', desc: 'Array of unlocked API names.' },
  ];

  const actions: Entry[] = [
    {
      name: "{ type: 'move', target: Pos }",
      desc: 'Step toward a tile (pathfinds 1 step).',
      example: `return { type: 'move', target: ctx.stairs };`,
    },
    {
      name: "{ type: 'attack', target: id }",
      desc: 'Attack an adjacent enemy by id.',
      example: `return { type: 'attack', target: enemy.id };`,
    },
    {
      name: "{ type: 'retreat' }",
      desc: 'Move one step toward the entrance.',
    },
    {
      name: "{ type: 'descend' }",
      desc: 'When standing on the stairs, go to next floor.',
    },
    {
      name: "{ type: 'wait' }",
      desc: 'Do nothing this tick. Regens a little MP.',
    },
  ];

  const patterns: Entry[] = [
    {
      name: 'Nearest enemy',
      desc: 'Find the closest hostile.',
      example: `let nearest = null, best = Infinity;
for (const e of ctx.enemies) {
  const d = Math.abs(e.pos.x - ctx.self.pos.x)
          + Math.abs(e.pos.y - ctx.self.pos.y);
  if (d < best) { best = d; nearest = e; }
}`,
    },
    {
      name: 'Adjacent check',
      desc: 'Am I next to this enemy?',
      example: `if (nearest && best === 1) {
  return { type:'attack', target: nearest.id };
}`,
    },
    {
      name: 'Retreat when hurt',
      desc: 'Back off below 30% HP.',
      example: `if (ctx.self.hp < ctx.self.maxHp * 0.3) {
  return { type: 'retreat' };
}`,
    },
  ];

  const howToUse = {
    head: 'Your script',
    body: 'Write a function named tick(ctx). It is called once per tick. Return one Action object — or nothing (= wait).',
  };
</script>

<aside class="api-ref" class:compact>
  <header>
    <h4>API Reference</h4>
    <p class="lead">Everything your <code>tick(ctx)</code> can read or do.</p>
  </header>

  <section>
    <div class="sec-label">How scripts work</div>
    <p class="body-text">
      <strong>{howToUse.head}:</strong> {howToUse.body}
    </p>
    <pre class="code-block">{`function tick(ctx) {
  // ...read ctx, return an action
  return { type: 'wait' };
}`}</pre>
  </section>

  <section>
    <div class="sec-label">ctx — what you can read</div>
    {#each ctxFields as f}
      <div class="entry">
        <code class="name">{f.name}</code>
        <span class="desc">{f.desc}</span>
        {#if f.example}<code class="ex">{f.example}</code>{/if}
      </div>
    {/each}
  </section>

  <section>
    <div class="sec-label">Actions — what you can return</div>
    {#each actions as a}
      <div class="entry">
        <code class="name">{a.name}</code>
        <span class="desc">{a.desc}</span>
        {#if a.example}<pre class="ex-block">{a.example}</pre>{/if}
      </div>
    {/each}
  </section>

  <section>
    <div class="sec-label">Common patterns</div>
    {#each patterns as p}
      <div class="entry">
        <code class="name">{p.name}</code>
        <span class="desc">{p.desc}</span>
        {#if p.example}<pre class="ex-block">{p.example}</pre>{/if}
      </div>
    {/each}
  </section>

  <footer class="foot">
    Tip: type <code>ctx.</code> in the editor to see inline autocomplete.
  </footer>
</aside>

<style>
  .api-ref {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--sp-4);
    overflow-y: auto;
    height: 100%;
    min-width: 0;
  }

  header {
    margin-bottom: var(--sp-4);
  }

  h4 {
    margin: 0 0 var(--sp-1) 0;
    font-size: var(--fs-md);
    color: var(--color-text);
    font-weight: 600;
  }

  .lead {
    margin: 0;
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
  }

  section {
    margin-bottom: var(--sp-4);
  }

  .sec-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-accent);
    margin-bottom: var(--sp-2);
  }

  .body-text {
    margin: 0 0 var(--sp-2) 0;
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  .body-text strong {
    color: var(--color-text);
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding: var(--sp-2) 0;
    border-bottom: 1px dashed var(--color-border);
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry .name {
    font-family: var(--font-mono);
    color: var(--color-text);
    font-weight: 600;
    font-size: var(--fs-xs);
    background: var(--color-surface-2);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    align-self: flex-start;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .entry .desc {
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .entry .ex {
    font-family: var(--font-mono);
    color: var(--color-accent);
    font-size: var(--fs-xs);
  }

  .ex-block,
  .code-block {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: var(--color-surface-2);
    color: var(--color-text);
    padding: var(--sp-2);
    border-radius: var(--radius-sm);
    margin: 0;
    overflow-x: auto;
    line-height: 1.4;
    border-left: 2px solid var(--color-accent);
  }

  code {
    font-family: var(--font-mono);
    background: var(--color-surface-2);
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    font-size: 0.92em;
  }

  .foot {
    margin-top: var(--sp-4);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--color-border);
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
  }
</style>
