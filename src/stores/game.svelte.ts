import type { Delver, LogEvent, RunTrace, TickFrame, World } from '../engine/types';
import { advanceTick } from '../engine/tick';
import { createWorld, isBossFloor, spawnDelver } from '../engine/world';
import { CLASS_STATS, SANDBOX } from '../engine/balance';
import { SandboxHost } from '../sandbox/host';
import { loadMeta, saveMeta } from '../persistence/meta';
import { loadScript } from '../persistence/scripts';
import { DEFAULT_META, type MetaProgression, type DelverClass } from '../engine/types';
import { hasFirestoreConfig } from '../persistence/firebase';
import { loadRankings, savePlayerProfile, submitRanking, type RankingEntry } from '../persistence/rankings';
import { loadCloudScripts, makeScriptSync } from '../persistence/cloudScripts';
import { auth } from './auth.svelte';
import { audio } from './audio.svelte';

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
  // How many boss floors the party cleared during the current run.
  // Resets on startRun; rolled into the final insight payout.
  let bossesClearedThisRun = 0;
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
    const beforeLen = world.events.length;
    advanceTick(world, { delverActions: actions });
    // Sonify any events the tick produced. Done here rather than in the
    // engine so the engine stays pure/testable.
    sonifyEvents(world.events, beforeLen);
    captureFrame();
    world = { ...world };
  }

  function sonifyEvents(events: LogEvent[], fromIdx: number): void {
    for (let i = fromIdx; i < events.length; i++) {
      const e = events[i];
      switch (e.kind) {
        case 'attack':
          audio.play(e.data?.crit === true ? 'crit' : 'hit');
          break;
        case 'heal':
          audio.play('heal');
          break;
        case 'death':
          audio.play('death');
          break;
        case 'descend':
          audio.play('descend');
          break;
        default:
          break;
      }
    }
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
    // +25 insight per boss cleared during the run. Counter is captured
    // locally so it can be reset here without a race.
    const bossBonus = bossesClearedThisRun * 25;
    const insight = depth * 10 + bossBonus;
    bossesClearedThisRun = 0;
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
    audio.stopAmbient();
    audio.play('wipe');
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
      // Base 260ms/tick at 1x so the action is readable; higher speeds
      // divide in, floor at 35ms so 8x still feels fast but rendering
      // can keep up.
      const delay = Math.max(35, 260 / rate);
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
    host = new SandboxHost({ budgetMs: SANDBOX.BUDGET_MS });
    editingMidRun = false;
    bossesClearedThisRun = 0;
    const seed = `run-${Date.now()}`;
    const delvers: Delver[] = [
      spawnDelver({
        class: 'warrior',
        name: 'Grimm',
        pos: { x: 0, y: 0 },
        script: scripts.warrior,
        hp: CLASS_STATS.warrior.hp,
        maxHp: CLASS_STATS.warrior.hp,
        mp: CLASS_STATS.warrior.mp,
        maxMp: CLASS_STATS.warrior.mp,
        attack: CLASS_STATS.warrior.attack,
        armor: CLASS_STATS.warrior.armor,
        range: CLASS_STATS.warrior.range,
      }),
      spawnDelver({
        class: 'ranger',
        name: 'Vex',
        pos: { x: 0, y: 0 },
        script: scripts.ranger,
        hp: CLASS_STATS.ranger.hp,
        maxHp: CLASS_STATS.ranger.hp,
        mp: CLASS_STATS.ranger.mp,
        maxMp: CLASS_STATS.ranger.mp,
        attack: CLASS_STATS.ranger.attack,
        armor: CLASS_STATS.ranger.armor,
        range: CLASS_STATS.ranger.range,
      }),
      spawnDelver({
        class: 'cleric',
        name: 'Mira',
        pos: { x: 0, y: 0 },
        script: scripts.cleric,
        hp: CLASS_STATS.cleric.hp,
        maxHp: CLASS_STATS.cleric.hp,
        mp: CLASS_STATS.cleric.mp,
        maxMp: CLASS_STATS.cleric.mp,
        attack: CLASS_STATS.cleric.attack,
        armor: CLASS_STATS.cleric.armor,
        range: CLASS_STATS.cleric.range,
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
    audio.startAmbient(isBossFloor(world.depth) ? 'boss' : 'calm');
    if (isBossFloor(world.depth)) audio.play('boss-intro');
    loopOnce();
  }

  async function descendNextFloor(): Promise<void> {
    if (!world || !host) return;
    // Signals don't carry across floors — clear the buffer before the new
    // world spins up, same way cooldowns and revive-used are reset.
    host.resetSignals();
    // Count any boss the party cleared on this floor for the end-of-run
    // bonus. Checked before we rebuild the world.
    if (isBossFloor(world.depth)) bossesClearedThisRun++;
    // Death is permanent: anyone who fell on this floor stays dead on the
    // next one. Bringing them back is what the cleric's revive action is
    // for — and it has a once-per-depth cost. Heals and cooldown resets
    // only apply to survivors.
    const survivors = world.delvers.map((d) => {
      if (d.hp === 0) return d;
      return {
        ...d,
        hp: d.maxHp,
        mp: d.maxMp,
        cooldowns: { ...d.cooldowns, heal: 0 },
        reviveUsedDepth: null,
      };
    });
    const nextDepth = world.depth + 1;
    world = createWorld({ seed: world.seed, depth: nextDepth, delvers: survivors });
    meta.deepestDepth = Math.max(meta.deepestDepth, nextDepth);
    saveMeta(meta);
    // Keep whatever speed the player had on the previous floor. Only
    // resume playback if we happen to be paused (speed 0), so the new
    // floor actually starts ticking.
    if (speed === 0) speed = 1;
    // Swap ambient beds between normal / boss floors so the music cue
    // lines up with the visual change.
    audio.startAmbient(isBossFloor(nextDepth) ? 'boss' : 'calm');
    if (isBossFloor(nextDepth)) audio.play('boss-intro');

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
    markTutorialCompleted(): void {
      if (meta.tutorialCompleted) return;
      meta = { ...meta, tutorialCompleted: true };
      saveMeta(meta);
    },
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
