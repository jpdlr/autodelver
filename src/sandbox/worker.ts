/**
 * Sandbox worker — one per delver.
 * Receives { type: 'load', script } once, then { type: 'tick', snapshot } per tick.
 * Responds with { type: 'action', action } or { type: 'error', message }.
 *
 * Security: we remove dangerous globals before compiling the user script.
 * The script is wrapped in a function that takes `ctx` and returns an action.
 */

// Strip obvious no-nos from global scope
const _self = self as unknown as Record<string, unknown>;
// Note: we intentionally keep `postMessage` and `self` alive — the worker needs them to reply.
const KILLS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'importScripts',
  'EventSource',
  'indexedDB',
];
for (const k of KILLS) {
  try {
    _self[k] = undefined;
  } catch {
    /* frozen */
  }
}

let compiledTick: ((ctx: unknown) => unknown) | null = null;
let compiledDeploy: ((ctx: unknown) => void) | null = null;

type Msg =
  | { type: 'load'; script: string }
  | { type: 'tick'; snapshot: unknown }
  | { type: 'deploy'; snapshot: unknown };

type WorkerResponse =
  | { type: 'action'; action: unknown }
  | { type: 'ready' }
  | { type: 'error'; message: string; line?: number };

function reply(port: MessagePort | null, r: WorkerResponse): void {
  if (port) port.postMessage(r);
  else (self as unknown as { postMessage(r: WorkerResponse): void }).postMessage(r);
}

function compile(script: string): { tick: ((ctx: unknown) => unknown) | null; deploy: ((ctx: unknown) => void) | null; error?: string } {
  try {
    const stripped = script
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // User code declares `function tick(ctx) {...}` and optionally `function onDeploy(ctx) {...}`.
    // We reference them by name after the script body. `typeof` avoids ReferenceError in strict mode.
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      `
        'use strict';
        ${stripped}
        return {
          tick: typeof tick === 'function' ? tick : null,
          onDeploy: typeof onDeploy === 'function' ? onDeploy : null,
        };
      `,
    );
    const result = factory();
    return { tick: result.tick, deploy: result.onDeploy };
  } catch (err) {
    return { tick: null, deploy: null, error: err instanceof Error ? err.message : String(err) };
  }
}

self.onmessage = (ev: MessageEvent<Msg>) => {
  const msg = ev.data;
  if (msg.type === 'load') {
    const { tick, deploy, error } = compile(msg.script);
    if (error) {
      reply(null, { type: 'error', message: error });
      return;
    }
    compiledTick = tick;
    compiledDeploy = deploy;
    reply(null, { type: 'ready' });
    return;
  }
  if (msg.type === 'deploy') {
    if (compiledDeploy) {
      try {
        compiledDeploy(msg.snapshot);
      } catch (err) {
        reply(null, { type: 'error', message: err instanceof Error ? err.message : String(err) });
        return;
      }
    }
    reply(null, { type: 'ready' });
    return;
  }
  if (msg.type === 'tick') {
    if (!compiledTick) {
      reply(null, { type: 'action', action: { type: 'wait' } });
      return;
    }
    try {
      const action = compiledTick(msg.snapshot);
      reply(null, { type: 'action', action: action ?? { type: 'wait' } });
    } catch (err) {
      reply(null, {
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
};
