<script lang="ts">
  // Subtle "dev terminal at night" backdrop. Code snippet faded into the
  // dark background, faint grid lines, a single ember glow for accent.
  // Keeps the coding vibe front-and-center; the dungeon is implied, not
  // literally painted.

  const codeLines: string[] = [
    "// tick.ts — runs every 100ms per delver",
    "function tick(ctx) {",
    "  if (ctx.self.hp < 12) return { type: 'retreat' };",
    "",
    "  const near = nearestEnemy(ctx);",
    "  if (near && dist(near) === 1) {",
    "    return { type: 'attack', target: near.id };",
    "  }",
    "",
    "  if (onStairs(ctx)) return { type: 'descend' };",
    "  return { type: 'move', target: ctx.stairs };",
    "}",
    "",
    "// depth 5 reached · 430 insight",
    "// party.warrior ← Grimm",
    "// party.ranger  ← Vex",
    "// party.cleric  ← Mira",
    "",
    "tick(ctx) => { type: 'descend' }",
    "→ floor cleared · descending...",
  ];
</script>

<div class="backdrop" aria-hidden="true">
  <div class="grid"></div>
  <div class="code">
    <div class="gutter">
      {#each codeLines as _, i}
        <span>{String(i + 1).padStart(2, ' ')}</span>
      {/each}
    </div>
    <pre>{codeLines.join('\n')}</pre>
  </div>
  <div class="glow"></div>
  <div class="vignette"></div>
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
    background:
      radial-gradient(ellipse at 50% 35%, #1a1d25 0%, #0d1015 55%, #070a0f 100%);
  }

  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(244, 164, 90, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(244, 164, 90, 0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 50% 45%, black 0%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse at 50% 45%, black 0%, transparent 80%);
  }

  .code {
    position: absolute;
    inset: 0;
    display: flex;
    gap: 16px;
    padding: 48px 6vw;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 13px;
    line-height: 1.8;
    color: rgba(222, 214, 196, 0.08);
    white-space: pre;
    user-select: none;
    mask-image: linear-gradient(180deg, transparent 0%, black 20%, black 80%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 20%, black 80%, transparent 100%);
  }
  .gutter {
    display: flex;
    flex-direction: column;
    color: rgba(244, 164, 90, 0.08);
    text-align: right;
    border-right: 1px solid rgba(244, 164, 90, 0.06);
    padding-right: 12px;
  }
  .code pre {
    margin: 0;
    flex: 1;
  }

  .glow {
    position: absolute;
    left: 50%;
    top: 40%;
    width: 700px;
    height: 300px;
    transform: translate(-50%, -50%);
    background: radial-gradient(
      ellipse at center,
      rgba(244, 164, 90, 0.18) 0%,
      rgba(201, 101, 59, 0.08) 40%,
      transparent 70%
    );
    filter: blur(20px);
    animation: pulse 6s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 50% 55%,
      transparent 40%,
      rgba(0, 0, 0, 0.7) 100%
    );
  }

  @media (max-width: 720px) {
    .code { font-size: 11px; padding: 24px 4vw; }
  }
  @media (prefers-reduced-motion: reduce) {
    .glow { animation: none; }
  }
</style>
