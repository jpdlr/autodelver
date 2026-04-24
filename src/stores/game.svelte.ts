import type { Delver, LogEvent, RunTrace, TickFrame, World } from '../engine/types';
import { advanceTick } from '../engine/tick';
import { createWorld, spawnDelver } from '../engine/world';
import { SandboxHost } from '../sandbox/host';
import { loadMeta, saveMeta } from '../persistence/meta';
import { loadScript } from '../persistence/scripts';
import { DEFAULT_META, type MetaProgression, type DelverClass } from '../engine/types';
import { hasFirestoreConfig } from '../persistence/firebase';
import { loadRankings, savePlayerProfile, submitRanking, type RankingEntry } from '../persistence/rankings';
import { loadCloudScripts, makeScriptSync } from '../persistence/cloudScripts';
import { auth } from './auth.svelte';

export type Screen = 'home' | 'tutorial' | 'loadout' | 'run' | 'postmortem' | 'leaderboard';

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
  // In-memory trace of the most recent run — used by the PostMortem replay
  // scrubber. Cleared when a new run starts.
  let lastRunTrace = $state<RunTrace | null>(null);
  // Scripts captured at launch time so the notebook can offer
  // "Restore from last run" and the run record can pin what was used.
  let lastLaunchScripts: { warrior: string; ranger: string; cleric: string } | null = null;
  let onlineRankings = $state<RankingEntry[]>([]);
  let rankingStatus = $state<'disabled' | 'loading' | 'ready' | 'error'>(
    hasFirestoreConfig() ? 'loading' : 'disabled',
  );
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

  // Cross-device script sync: hydrate from Firestore after the user is
  // authenticated, and debounce cloud saves on subsequent edits. Local
  // storage remains the source of truth while offline.
  const cloudSync = makeScriptSync();
  let cloudLoadedForUid: string | null = null;

  if (typeof window !== 'undefined' && hasFirestoreConfig()) {
    void refreshRankings();
  }

  // Watch auth state — when a player signs in (or switches accounts),
  // pull their cloud scripts into the editor. When signed out, stop
  // syncing and fall back to local-only.
  $effect.root(() => {
    $effect(() => {
      const uid = auth.user?.uid ?? null;
      if (!uid) {
        if (cloudLoadedForUid) {
          // Flush any pending edits before the sign-out finalises so nothing
          // is lost when the account is switched.
          void cloudSync.flush();
        }
        cloudLoadedForUid = null;
        return;
      }
      if (cloudLoadedForUid === uid) return;
      cloudLoadedForUid = uid;
      void hydrateFromCloud(uid);
    });
  });

  async function hydrateFromCloud(uid: string): Promise<void> {
    const cloud = await loadCloudScripts(uid);
    if (!cloud) {
      // First time signing in on this device — push the local scripts up
      // so the cloud has a starting state.
      cloudSync.schedule({ ...scripts });
      return;
    }
    // Prefer cloud over local — this is how cross-device continuity works.
    scripts = {
      warrior: cloud.warrior,
      ranger: cloud.ranger,
      cleric: cloud.cleric,
    };
    // Mirror to localStorage so offline play stays in sync.
    for (const cls of ['warrior', 'ranger', 'cleric'] as DelverClass[]) {
      try {
        localStorage.setItem(`autodelver:script:v1:${cls}`, scripts[cls]);
      } catch {
        /* ignore */
      }
    }
  }

  async function refreshRankings(): Promise<void> {
    if (!hasFirestoreConfig()) {
      rankingStatus = 'disabled';
      return;
    }
    rankingStatus = 'loading';
    try {
      onlineRankings = await loadRankings(10);
      rankingStatus = 'ready';
    } catch (err) {
      console.error('Failed to load rankings:', err);
      rankingStatus = 'error';
    }
  }

  async function advance(): Promise<void> {
    if (!world || !host || world.status !== 'running') return;
    const unlocked = new Set(meta.unlockedApis);
    const { actions, events } = await host.step(world, unlocked);
    if (events.length) world.events.push(...events);
    advanceTick(world, { delverActions: actions });
    captureFrame();
    world = { ...world };
  }

  function captureFrame(): void {
    if (!world || !lastRunTrace) return;
    // Cap at 1000 frames (~1000 ticks) — enough for any reasonable run
    // and keeps memory in check. Older frames drop off the front.
    const frame: TickFrame = {
      tick: world.tick,
      delvers: world.delvers.map((d) => ({
        id: d.id,
        x: d.pos.x,
        y: d.pos.y,
        hp: d.hp,
        mp: d.mp,
        downedFor: d.downedFor,
      })),
      enemies: world.enemies.map((e) => ({
        id: e.id,
        x: e.pos.x,
        y: e.pos.y,
        hp: e.hp,
      })),
    };
    lastRunTrace.frames.push(frame);
    if (lastRunTrace.frames.length > 1000) lastRunTrace.frames.shift();
  }

  function finaliseRun(): void {
    if (!world) return;
    const depth = world.depth;
    const insight = depth * 10;
    meta.totalRuns++;
    meta.totalDeaths += world.delvers.filter((d) => d.hp === 0).length;
    meta.deepestDepth = Math.max(meta.deepestDepth, depth);
    meta.insight += insight;
    const causeOfDeath = [...world.events]
      .reverse()
      .find((e) => e.kind === 'death' || e.kind === 'damage')?.message ?? 'The dungeon closes without ceremony.';
    // Prefer the signed-in identity; fall back to persisted meta for offline play.
    const playerId = auth.user?.uid || meta.playerId;
    const username = auth.codename || meta.username || 'Anonymous Delver';
    const runRecord = {
      id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      username,
      depth,
      ticks: world.tick,
      causeOfDeath,
      insightEarned: insight,
      finishedAt: new Date().toISOString(),
      launchScripts: lastLaunchScripts ? { ...lastLaunchScripts } : undefined,
    };
    // Freeze the event log onto the trace so the replay scrubber has
    // it without racing the live world mutations.
    if (lastRunTrace) {
      lastRunTrace.events = [...world.events];
    }
    meta.runHistory = [runRecord, ...meta.runHistory]
      .sort((a, b) => b.depth - a.depth || a.ticks - b.ticks)
      .slice(0, 25);
    void submitRanking(runRecord)
      .then(refreshRankings)
      .catch((err) => {
        console.error('Failed to submit ranking:', err);
        rankingStatus = hasFirestoreConfig() ? 'error' : 'disabled';
      });
    if (depth >= 2 && !meta.unlockedApis.includes('memory')) {
      meta.unlockedApis = [...meta.unlockedApis, 'memory'];
    }
    if (depth >= 4 && !meta.unlockedApis.includes('signal')) {
      meta.unlockedApis = [...meta.unlockedApis, 'signal'];
    }
    saveMeta(meta);

    lastRunSummary = {
      depth,
      ticks: world.tick,
      causeOfDeath,
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

    // Snapshot the scripts that launched this run, for the notebook's
    // "Restore from last run" action and the run record.
    lastLaunchScripts = { ...scripts };

    // Start a fresh trace — frames collect once per advance().
    lastRunTrace = {
      grid: world.grid,
      stairs: world.stairs,
      entrance: world.entrance,
      delverMeta: world.delvers.map((d) => ({
        id: d.id,
        class: d.class,
        name: d.name,
        maxHp: d.maxHp,
        maxMp: d.maxMp,
      })),
      enemyMeta: world.enemies.map((e) => ({
        id: e.id,
        archetype: e.archetype,
        maxHp: e.maxHp,
      })),
      frames: [],
      events: [],
      launchScripts: { ...lastLaunchScripts },
    };
    captureFrame(); // tick 0 baseline

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

    // Reset the trace to cover only the CURRENT floor — replay scope is
    // "show me how this floor went", not the whole descent.
    if (lastRunTrace) {
      lastRunTrace = {
        grid: world.grid,
        stairs: world.stairs,
        entrance: world.entrance,
        delverMeta: world.delvers.map((d) => ({
          id: d.id,
          class: d.class,
          name: d.name,
          maxHp: d.maxHp,
          maxMp: d.maxMp,
        })),
        enemyMeta: world.enemies.map((e) => ({
          id: e.id,
          archetype: e.archetype,
          maxHp: e.maxHp,
        })),
        frames: [],
        events: [],
        launchScripts: lastRunTrace.launchScripts,
      };
      captureFrame();
    }
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
    get lastRunTrace() {
      return lastRunTrace;
    },
    get lastLaunchScripts() {
      return lastLaunchScripts;
    },
    get onlineRankings() {
      return onlineRankings;
    },
    get rankingStatus() {
      return rankingStatus;
    },
    get scripts() {
      return scripts;
    },
    get editingMidRun() {
      return editingMidRun;
    },
    setUsername(name: string): void {
      const clean = name.trim().replace(/\s+/g, ' ').slice(0, 24);
      meta.username = clean;
      saveMeta(meta);
      void savePlayerProfile(meta.playerId, clean).catch((err) => {
        console.error('Failed to save player profile:', err);
      });
    },
    refreshRankings,
    setScript(cls: DelverClass, script: string): void {
      scripts = { ...scripts, [cls]: script };
      if (auth.user) cloudSync.schedule({ ...scripts });
    },
    setScripts(next: Record<DelverClass, string>): void {
      scripts = { ...next };
      if (auth.user) cloudSync.schedule({ ...scripts });
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
