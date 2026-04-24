<script lang="ts">
  import { game } from '../../stores/game.svelte';
  import type { DelverClass, World } from '../../engine/types';
  import { advanceTick } from '../../engine/tick';
  import { SandboxHost } from '../../sandbox/host';
  import MonacoEditor from '../MonacoEditor.svelte';
  import GridCanvas from '../GridCanvas.svelte';
  import { LESSONS, type Lesson, type LessonCheck } from '../tutorial/lessons';
  import { onDestroy } from 'svelte';

  // ─── State ─────────────────────────────────────────
  let activeIdx = $state(0);
  const lesson = $derived<Lesson>(LESSONS[activeIdx]);

  let world = $state<World | null>(null);
  let scripts = $state<Partial<Record<DelverClass, string>>>({});
  let activeTab = $state<DelverClass>('warrior');
  let host: SandboxHost | null = null;
  let loopHandle: number | null = null;
  let status = $state<LessonCheck>({ status: 'running' });
  let running = $state(false);
  let lastError = $state<string | null>(null);
  let tickRate = 200;

  const classNames: Record<DelverClass, string> = {
    warrior: 'Grimm',
    ranger: 'Vex',
    cleric: 'Mira',
  };

  // ─── Lifecycle ─────────────────────────────────────
  $effect(() => {
    // Reset when the selected lesson changes.
    resetLesson();
  });

  onDestroy(() => {
    stopLoop();
    host?.dispose();
  });

  function resetLesson(): void {
    stopLoop();
    host?.dispose();
    host = null;
    scripts = { ...lesson.starter };
    activeTab = lesson.focus;
    const { world: w } = lesson.build();
    world = w;
    status = { status: 'running' };
    running = false;
    lastError = null;
  }

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    status = { status: 'running' };
    lastError = null;

    // Rebuild world fresh using current (possibly edited) scripts.
    const built = lesson.build();
    world = built.world;
    // Replace delver scripts with the current editor state.
    for (const d of world.delvers) {
      if (scripts[d.class]) d.script = scripts[d.class]!;
    }

    host?.dispose();
    host = new SandboxHost({ budgetMs: 120 });
    for (const d of world.delvers) {
      await host.load(d);
    }

    startLoop();
  }

  function stop(): void {
    stopLoop();
    running = false;
  }

  function startLoop(): void {
    stopLoop();
    loopHandle = window.setInterval(async () => {
      if (!world || !host) return;
      if (world.status !== 'running') return;
      const { actions, events } = await host.step(world, new Set());
      if (events.length) {
        world.events.push(...events);
        // Surface the most recent script error so the player can fix their code.
        const err = [...events].reverse().find(
          (e) => e.kind === 'script-error' || e.kind === 'budget-miss',
        );
        if (err) lastError = err.message;
      }
      advanceTick(world, { delverActions: actions });
      // Force reactivity.
      world = world;

      // Safety cap — if the party hasn't reached the stairs in 200 ticks,
      // treat it as a failure so the lesson resets instead of looping forever.
      if (world.tick > 200 && world.status === 'running') {
        status = {
          status: 'fail',
          message: lastError
            ? `Script error: ${lastError}`
            : 'Time ran out — your delver never reached the stairs.',
        };
        stopLoop();
        running = false;
        return;
      }

      const res = lesson.check(world);
      if (res.status !== 'running') {
        status = res;
        stopLoop();
        running = false;
      }
    }, tickRate);
  }

  function stopLoop(): void {
    if (loopHandle !== null) {
      clearInterval(loopHandle);
      loopHandle = null;
    }
  }

  function retry(): void {
    resetLesson();
  }

  function nextLesson(): void {
    if (activeIdx < LESSONS.length - 1) activeIdx++;
  }

  function gotoLesson(i: number): void {
    activeIdx = i;
  }

  function home(): void {
    stopLoop();
    host?.dispose();
    game.returnHome();
  }

  function onScriptChange(v: string): void {
    scripts = { ...scripts, [activeTab]: v };
  }

  function resetScript(): void {
    scripts = { ...scripts, [activeTab]: lesson.starter[activeTab] ?? '' };
  }
</script>

<section class="tut">
  <aside class="sidebar">
    <button type="button" class="home-btn" onclick={home} title="Back to home" aria-label="Back to home">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M6 13V8H10V13M2.5 8L8 3l5.5 5M4 7v6h8V7" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Home</span>
    </button>
    <div class="sb-label">Lessons</div>
    <ol class="lesson-list">
      {#each LESSONS as l, i}
        <li>
          <button
            type="button"
            class="lesson-item"
            class:active={i === activeIdx}
            onclick={() => gotoLesson(i)}
          >
            <span class="num">{(i + 1).toString().padStart(2, '0')}</span>
            <span class="txt">
              <span class="t-title">{l.title}</span>
              <span class="t-sub">{l.subtitle}</span>
            </span>
          </button>
        </li>
      {/each}
    </ol>
  </aside>

  <div class="main">
    <header class="brief">
      <div class="brief-top">
        <div>
          <p class="eyebrow">Lesson {activeIdx + 1} of {LESSONS.length}</p>
          <h2>{lesson.title}</h2>
          <p class="subtitle">{lesson.subtitle}</p>
        </div>
        <div class="pips" role="progressbar" aria-valuemin="0" aria-valuemax={LESSONS.length} aria-valuenow={activeIdx + 1}>
          {#each LESSONS as _, i}
            <span class="pip" class:done={i < activeIdx} class:active={i === activeIdx}></span>
          {/each}
        </div>
      </div>
      <div class="briefing">
        {#each lesson.briefing as p}<p>{p}</p>{/each}
      </div>
      <details class="hints">
        <summary>Hints</summary>
        <ul>
          {#each lesson.hints as h}<li>{h}</li>{/each}
        </ul>
      </details>
    </header>

    <div class="workspace">
      <div class="editor-col">
        {#if lesson.participants.length > 1}
          <div class="tabs">
            {#each lesson.participants as cls}
              <button
                type="button"
                class="tab {cls}"
                class:active={activeTab === cls}
                onclick={() => (activeTab = cls)}
              >
                <span class="dot" aria-hidden="true"></span>
                {classNames[cls]}
              </button>
            {/each}
          </div>
        {/if}
        <div class="editor-host">
          <MonacoEditor
            value={scripts[activeTab] ?? ''}
            onChange={onScriptChange}
          />
        </div>
        <div class="editor-actions">
          <button type="button" class="ghost small" onclick={resetScript} title="Reset script to starter template">Reset</button>
        </div>
      </div>

      <div class="sim-col">
        <div class="sim-frame">
          <GridCanvas world={world} />
        </div>
        <div class="sim-controls">
          <div class="sim-status" class:pass={status.status === 'pass'} class:fail={status.status === 'fail'} class:warn={lastError && status.status === 'running'}>
            {#if status.status === 'pass'}
              <span class="s-ico">✓</span>
              <span>{status.message ?? 'Objective complete.'}</span>
            {:else if status.status === 'fail'}
              <span class="s-ico">✕</span>
              <span>{status.message ?? 'Lesson failed — retry.'}</span>
            {:else if running && lastError}
              <span class="s-ico">!</span>
              <span class="err-msg">Script error: <code>{lastError}</code></span>
            {:else if running}
              <span class="s-ico spin">◐</span>
              <span>Running — tick {world?.tick ?? 0}</span>
            {:else}
              <span class="s-ico">▸</span>
              <span>Edit your script, then press Run.</span>
            {/if}
          </div>
          <div class="buttons">
            {#if running}
              <button type="button" onclick={stop} title="Stop the simulation">Stop</button>
            {/if}
            <button type="button" onclick={retry} title="Reset the lesson and clear your script back to the starter">Retry</button>
            {#if status.status === 'pass' && activeIdx < LESSONS.length - 1}
              <button type="button" class="primary" onclick={nextLesson}>Next lesson →</button>
            {:else if status.status === 'pass'}
              <button type="button" class="primary" onclick={home}>Finish</button>
            {:else}
              <button type="button" class="primary" onclick={run} disabled={running}>
                {running ? 'Running…' : 'Run'}
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .tut {
    height: 100%;
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 0;
    overflow: hidden;
  }

  /* ─── Sidebar ──────────────────────────────── */
  .sidebar {
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    overflow-y: auto;
  }
  .home-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: var(--fs-xs);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    align-self: flex-start;
  }
  .home-btn:hover { color: var(--color-text); background: var(--color-surface-3); }
  .sb-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
    padding: 0 6px;
  }
  .lesson-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    counter-reset: lsn;
  }
  .lesson-item {
    width: 100%;
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    text-align: left;
    color: var(--color-text-muted);
  }
  .lesson-item:hover:not(.active) {
    background: var(--color-surface-2);
    color: var(--color-text);
  }
  .lesson-item.active {
    background: var(--color-surface-2);
    border-color: var(--color-accent);
    color: var(--color-text);
  }
  .lesson-item .num {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-subtle);
    text-align: right;
  }
  .lesson-item.active .num { color: var(--color-accent); }
  .lesson-item .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .t-title {
    font-weight: 600;
    font-size: var(--fs-sm);
  }
  .t-sub {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--color-text-subtle);
  }

  /* ─── Main area ────────────────────────────── */
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .brief {
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    flex-shrink: 0;
  }
  .brief-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--sp-4);
  }
  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-subtle);
  }
  .brief h2 { margin: 2px 0 0; font-size: var(--fs-xl); color: var(--color-text); }
  .subtitle {
    margin: 2px 0 0;
    color: var(--color-text-muted);
    font-size: var(--fs-sm);
  }
  .pips {
    display: flex;
    gap: 4px;
  }
  .pip {
    width: 24px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
  }
  .pip.done { background: color-mix(in srgb, var(--color-accent) 60%, var(--color-border)); }
  .pip.active { background: var(--color-accent); }
  .briefing p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }
  .briefing p + p { margin-top: 4px; }
  .hints summary {
    cursor: pointer;
    color: var(--color-text-subtle);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .hints ul {
    margin: 6px 0 0;
    padding-left: 20px;
    color: var(--color-text-muted);
    font-size: var(--fs-sm);
  }
  .hints li { margin: 2px 0; }

  /* ─── Workspace ────────────────────────────── */
  .workspace {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-3);
    padding: var(--sp-3);
    min-height: 0;
  }
  .editor-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .tabs {
    display: flex;
    gap: 4px;
    padding: 6px;
    background: var(--color-surface-2);
    border-bottom: 1px solid var(--color-border);
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: var(--fs-xs);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
  }
  .tab.active {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .tab .dot {
    width: 8px; height: 8px; border-radius: 50%;
  }
  .tab.warrior .dot { background: var(--color-warrior); }
  .tab.ranger .dot { background: var(--color-ranger); }
  .tab.cleric .dot { background: var(--color-cleric); }

  .editor-host { flex: 1; min-height: 0; display: flex; }
  .editor-host :global(.monaco-host) {
    flex: 1;
    border: none;
    border-radius: 0;
  }
  .editor-actions {
    padding: 6px;
    border-top: 1px solid var(--color-border);
    background: var(--color-surface-2);
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .editor-actions .small { padding: 4px 10px; font-size: var(--fs-xs); }

  .sim-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: var(--sp-2);
  }
  .sim-frame {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-surface-2);
  }
  .sim-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .sim-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--fs-sm);
    color: var(--color-text-muted);
    min-width: 0;
  }
  .sim-status.pass { color: var(--color-ranger); }
  .sim-status.fail { color: var(--color-danger, #c94a4a); }
  .sim-status.warn { color: var(--color-danger, #c94a4a); }
  .err-msg code {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: color-mix(in srgb, var(--color-danger, #c94a4a) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger, #c94a4a) 35%, transparent);
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--color-text);
  }
  .sim-status .s-ico {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    font-size: 12px;
    flex-shrink: 0;
  }
  .sim-status.pass .s-ico {
    background: color-mix(in srgb, var(--color-ranger) 20%, transparent);
    border-color: color-mix(in srgb, var(--color-ranger) 50%, transparent);
  }
  .sim-status.fail .s-ico {
    background: color-mix(in srgb, var(--color-danger, #c94a4a) 20%, transparent);
    border-color: color-mix(in srgb, var(--color-danger, #c94a4a) 50%, transparent);
  }
  .s-ico.spin { animation: spin 1.2s linear infinite; }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .buttons { display: flex; gap: 6px; flex-shrink: 0; }

  @media (max-width: 1000px) {
    .tut { grid-template-columns: 1fr; }
    .sidebar {
      flex-direction: row;
      overflow-x: auto;
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }
    .lesson-list { flex-direction: row; }
    .lesson-item { width: auto; }
    .workspace { grid-template-columns: 1fr; }
  }
</style>
