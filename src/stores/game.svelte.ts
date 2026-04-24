import type { Delver, LogEvent, World } from '../engine/types';
import { advanceTick } from '../engine/tick';
import { createWorld, spawnDelver } from '../engine/world';
import { SandboxHost } from '../sandbox/host';
import { loadMeta, saveMeta } from '../persistence/meta';
import { loadScript } from '../persistence/scripts';
import { DEFAULT_META, type MetaProgression, type DelverClass } from '../engine/types';

export type Screen = 'home' | 'tutorial' | 'loadout' | 'run' | 'postmortem';

export interface RunSummary {
  depth: number;
  ticks: number;
  causeOfDeath: string;
  insightEarned: number;
}

function createGame() {
  let screen = $state<Screen>('home');
  let world = $state<World | null>(null);
  let meta = $state<MetaProgression>({ ...DEFAULT_META });
  let speed = $state<number>(1);
  let lastRunSummary = $state<RunSummary | null>(null);
  let editingMidRun = $state<boolean>(false);
  let preEditSpeed = 1;
  let scripts = $state<Record<DelverClass, string>>({
    warrior: '',
    ranger: '',
    cleric: '',
  });

  if (typeof window !== 'undefined') {
    meta = loadMeta();
    scripts = {
      warrior: loadScript('warrior'),
      ranger: loadScript('ranger'),
      cleric: loadScript('cleric'),
    };
  }

  let host: SandboxHost | null = null;
  let timer: number | null = null;

  async function advance(): Promise<void> {
    if (!world || !host || world.status !== 'running') return;
    const unlocked = new Set(meta.unlockedApis);
    const { actions, events } = await host.step(world, unlocked);
    if (events.length) world.events.push(...events);
    advanceTick(world, { delverActions: actions });
    world = { ...world };
  }

  function finaliseRun(): void {
    if (!world) return;
    const depth = world.depth;
    const insight = depth * 10;
    meta.totalRuns++;
    meta.totalDeaths += world.delvers.filter((d) => d.hp === 0).length;
    meta.deepestDepth = Math.max(meta.deepestDepth, depth);
    meta.insight += insight;
    if (depth >= 2 && !meta.unlockedApis.includes('memory')) {
      meta.unlockedApis = [...meta.unlockedApis, 'memory'];
    }
    if (depth >= 4 && !meta.unlockedApis.includes('signal')) {
      meta.unlockedApis = [...meta.unlockedApis, 'signal'];
    }
    saveMeta(meta);

    const lastDeath = [...world.events]
      .reverse()
      .find((e) => e.kind === 'death' || e.kind === 'damage');
    lastRunSummary = {
      depth,
      ticks: world.tick,
      causeOfDeath: lastDeath?.message ?? 'The dungeon closes without ceremony.',
      insightEarned: insight,
    };
    screen = 'postmortem';
  }

  async function loopOnce(): Promise<void> {
    if (!world) return;
    const rate = speed;
    if (rate === 0) {
      timer = window.setTimeout(loopOnce, 100);
      return;
    }
    await advance();
    const status = world?.status;
    if (status === 'running') {
      const delay = Math.max(30, 160 / rate);
      timer = window.setTimeout(loopOnce, delay);
    } else if (status === 'cleared') {
      timer = window.setTimeout(async () => {
        await descendNextFloor();
        loopOnce();
      }, 900);
    } else if (status === 'wiped') {
      finaliseRun();
    }
  }

  async function startRun(): Promise<void> {
    host?.dispose();
    host = new SandboxHost({ budgetMs: 80 });
    editingMidRun = false;
    const seed = `run-${Date.now()}`;
    const delvers: Delver[] = [
      spawnDelver({
        class: 'warrior',
        name: 'Grimm',
        pos: { x: 0, y: 0 },
        script: scripts.warrior,
        hp: 45,
        maxHp: 45,
        mp: 0,
        maxMp: 0,
        attack: 7,
        armor: 3,
        range: 1,
      }),
      spawnDelver({
        class: 'ranger',
        name: 'Vex',
        pos: { x: 0, y: 0 },
        script: scripts.ranger,
        hp: 30,
        maxHp: 30,
        mp: 0,
        maxMp: 0,
        attack: 8,
        armor: 1,
        range: 3,
      }),
      spawnDelver({
        class: 'cleric',
        name: 'Mira',
        pos: { x: 0, y: 0 },
        script: scripts.cleric,
        hp: 30,
        maxHp: 30,
        mp: 10,
        maxMp: 10,
        attack: 5,
        armor: 2,
        range: 2,
      }),
    ];
    try {
      await Promise.all(delvers.map((d) => host!.load(d)));
    } catch (err) {
      console.error('Failed to load delver worker:', err);
    }
    world = createWorld({ seed, depth: 1, delvers });
    screen = 'run';
    speed = 1;
    loopOnce();
  }

  async function descendNextFloor(): Promise<void> {
    if (!world || !host) return;
    const survivors = world.delvers.map((d) => ({
      ...d,
      hp: d.maxHp,
      mp: d.maxMp,
      cooldowns: { ...d.cooldowns, heal: 0 },
      reviveUsedDepth: null,
    }));
    const nextDepth = world.depth + 1;
    world = createWorld({ seed: world.seed, depth: nextDepth, delvers: survivors });
    meta.deepestDepth = Math.max(meta.deepestDepth, nextDepth);
    saveMeta(meta);
    speed = 1;
  }

  return {
    get screen() {
      return screen;
    },
    set screen(v: Screen) {
      screen = v;
    },
    get world() {
      return world;
    },
    get meta() {
      return meta;
    },
    get speed() {
      return speed;
    },
    get lastRunSummary() {
      return lastRunSummary;
    },
    get scripts() {
      return scripts;
    },
    get editingMidRun() {
      return editingMidRun;
    },
    setScript(cls: DelverClass, script: string): void {
      scripts = { ...scripts, [cls]: script };
    },
    setScripts(next: Record<DelverClass, string>): void {
      scripts = { ...next };
    },
    openMidRunEditor(): void {
      if (!world || world.status !== 'running') return;
      preEditSpeed = speed || 1;
      speed = 0;
      editingMidRun = true;
    },
    async closeMidRunEditor(): Promise<void> {
      editingMidRun = false;
      if (!world || !host) {
        speed = preEditSpeed;
        return;
      }
      // Push updated scripts into live workers and flag it in the log
      const changed: string[] = [];
      await Promise.all(
        world.delvers.map(async (d) => {
          const cur = scripts[d.class];
          if (cur && cur !== d.script) {
            d.script = cur;
            await host!.reloadScript(d.id, cur);
            changed.push(d.name);
          }
        }),
      );
      if (changed.length && world) {
        world.events.push({
          tick: world.tick,
          kind: 'info',
          message: `✎ Scripts hot-reloaded: ${changed.join(', ')}`,
        });
        world = { ...world };
      }
      speed = preEditSpeed;
    },
    setSpeed(s: number): void {
      speed = s;
    },
    pause(): void {
      speed = 0;
    },
    resume(): void {
      if (speed === 0) speed = 1;
    },
    async stepOnce(): Promise<void> {
      await advance();
    },
    startRun,
    descendNextFloor,
    returnHome(): void {
      if (timer) clearTimeout(timer);
      host?.dispose();
      host = null;
      world = null;
      screen = 'home';
    },
    recentLog(n = 30): LogEvent[] {
      if (!world) return [];
      return world.events.slice(-n);
    },
  };
}

export const game = createGame();

if (typeof window !== 'undefined') {
  (window as unknown as { __game: typeof game }).__game = game;
}
