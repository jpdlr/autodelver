import type { Action, Delver, EntityId, LogEvent, Signal, World } from '../engine/types';
import { buildSnapshot } from './ctx';

/**
 * Host-side sandbox: one Worker per delver. Sends snapshots, awaits actions, enforces timeout.
 * Fallback: if the worker fails to respond in budget, we treat the delver as `wait` and
 * log a budget-miss event.
 */

interface DelverWorker {
  worker: Worker;
  ready: Promise<void>;
  lastError?: string;
}

export class SandboxHost {
  private workers = new Map<EntityId, DelverWorker>();
  private budgetMs: number;
  /** Signals broadcast on the previous tick, visible to all workers this
   *  tick. Reset between floors via resetSignals(). */
  private lastTickSignals: Signal[] = [];

  constructor(opts: { budgetMs?: number } = {}) {
    this.budgetMs = opts.budgetMs ?? 50;
  }

  /** Clear the signal buffer. Call between floor transitions so signals
   *  from the previous floor don't bleed into the new one. */
  resetSignals(): void {
    this.lastTickSignals = [];
  }

  async load(delver: Delver): Promise<void> {
    const existing = this.workers.get(delver.id);
    if (existing) {
      existing.worker.terminate();
      this.workers.delete(delver.id);
    }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const ready = new Promise<void>((resolve, reject) => {
      const onMsg = (ev: MessageEvent) => {
        if (ev.data?.type === 'ready') {
          worker.removeEventListener('message', onMsg);
          resolve();
        } else if (ev.data?.type === 'error') {
          worker.removeEventListener('message', onMsg);
          reject(new Error(ev.data.message));
        }
      };
      worker.addEventListener('message', onMsg);
    });
    worker.postMessage({ type: 'load', script: delver.script });
    this.workers.set(delver.id, { worker, ready });
    await ready.catch((err) => {
      const w = this.workers.get(delver.id);
      if (w) w.lastError = err instanceof Error ? err.message : String(err);
    });
  }

  /** Reload a single delver's script mid-run without recreating the worker. */
  async reloadScript(delverId: EntityId, script: string): Promise<void> {
    const dw = this.workers.get(delverId);
    if (!dw) return;
    const ready = new Promise<void>((resolve, reject) => {
      const onMsg = (ev: MessageEvent) => {
        if (ev.data?.type === 'ready') {
          dw.worker.removeEventListener('message', onMsg);
          resolve();
        } else if (ev.data?.type === 'error') {
          dw.worker.removeEventListener('message', onMsg);
          reject(new Error(ev.data.message));
        }
      };
      dw.worker.addEventListener('message', onMsg);
    });
    dw.worker.postMessage({ type: 'load', script });
    dw.ready = ready;
    await ready.catch((err) => {
      dw.lastError = err instanceof Error ? err.message : String(err);
    });
  }

  async step(world: World, unlocked: Set<string>): Promise<{
    actions: Map<EntityId, Action>;
    events: LogEvent[];
  }> {
    const actions = new Map<EntityId, Action>();
    const events: LogEvent[] = [];
    const newSignals: Signal[] = [];
    const visibleSignals = this.lastTickSignals;
    await Promise.all(
      world.delvers
        .filter((d) => d.hp > 0)
        .map(async (d) => {
          const snapshot = buildSnapshot(
            d,
            world.delvers,
            world.enemies,
            world.tick,
            world.depth,
            world.stairs,
            world.entrance,
            unlocked,
            visibleSignals,
          );
          try {
            const result = await this.queryTick(d.id, snapshot);
            const validated = validateAction(result.action);
            if (validated) actions.set(d.id, validated);
            for (const s of result.signals) {
              if (typeof s?.name !== 'string') continue;
              newSignals.push({
                from: d.id,
                name: s.name,
                payload: s.payload,
                tick: world.tick,
              });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            events.push({
              tick: world.tick,
              kind: message.startsWith('BUDGET:') ? 'budget-miss' : 'script-error',
              actorId: d.id,
              message: message.replace(/^BUDGET:/, ''),
            });
          }
        }),
    );
    this.lastTickSignals = newSignals;
    return { actions, events };
  }

  private async queryTick(
    delverId: EntityId,
    snapshot: unknown,
  ): Promise<{ action: unknown; signals: Array<{ name: string; payload: unknown }> }> {
    const dw = this.workers.get(delverId);
    if (!dw) throw new Error('no worker loaded');
    await dw.ready;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        dw.worker.removeEventListener('message', onMsg);
        reject(new Error(`BUDGET:tick exceeded ${this.budgetMs}ms`));
      }, this.budgetMs);
      const onMsg = (ev: MessageEvent) => {
        if (ev.data?.type === 'action') {
          clearTimeout(timer);
          dw.worker.removeEventListener('message', onMsg);
          resolve({ action: ev.data.action, signals: ev.data.signals ?? [] });
        } else if (ev.data?.type === 'error') {
          clearTimeout(timer);
          dw.worker.removeEventListener('message', onMsg);
          reject(new Error(ev.data.message));
        }
      };
      dw.worker.addEventListener('message', onMsg);
      dw.worker.postMessage({ type: 'tick', snapshot });
    });
  }

  dispose(): void {
    for (const { worker } of this.workers.values()) worker.terminate();
    this.workers.clear();
  }
}

function validateAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== 'object') return { type: 'wait' };
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case 'wait':
    case 'retreat':
    case 'descend':
      return { type: a.type };
    case 'move':
      if (a.target && typeof a.target === 'object') {
        const t = a.target as Record<string, unknown>;
        if (typeof t.x === 'number' && typeof t.y === 'number') {
          return { type: 'move', target: { x: Math.round(t.x), y: Math.round(t.y) } };
        }
      }
      return null;
    case 'attack':
      if (typeof a.target === 'string') {
        return { type: 'attack', target: a.target };
      }
      return null;
    case 'heal':
      if (typeof a.target === 'string') {
        return { type: 'heal', target: a.target };
      }
      return null;
    case 'revive':
      if (typeof a.target === 'string') {
        return { type: 'revive', target: a.target };
      }
      return null;
    default:
      return null;
  }
}
