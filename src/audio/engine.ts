/**
 * Lightweight WebAudio engine — synthesised SFX + a procedural ambient pad.
 * No asset files; every sound is built from oscillators and envelopes so
 * the bundle stays tiny and the vibe can be tuned numerically.
 *
 * AudioContext must be created after a user gesture (browser policy), so
 * the engine holds `null` until `ensure()` is called from a click/keypress.
 */

export type Sfx =
  | 'hit'
  | 'crit'
  | 'heal'
  | 'descend'
  | 'death'
  | 'wipe'
  | 'boss-intro'
  | 'click';

export interface AudioSettings {
  enabled: boolean;
  sfxVolume: number;
  musicVolume: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambient: { stop: () => void } | null = null;
  private settings: AudioSettings = { enabled: true, sfxVolume: 0.4, musicVolume: 0.25 };
  private ambientVariant: 'calm' | 'boss' = 'calm';

  configure(s: AudioSettings): void {
    this.settings = s;
    if (this.master) this.master.gain.value = s.enabled ? 1 : 0;
    if (this.sfxBus) this.sfxBus.gain.value = s.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = s.musicVolume;
  }

  /** Must be called from a user gesture the first time. Cheap no-op after. */
  ensure(): void {
    if (this.ctx) return;
    const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    const sfxBus = ctx.createGain();
    const musicBus = ctx.createGain();
    master.gain.value = this.settings.enabled ? 1 : 0;
    sfxBus.gain.value = this.settings.sfxVolume;
    musicBus.gain.value = this.settings.musicVolume;
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.sfxBus = sfxBus;
    this.musicBus = musicBus;
  }

  play(id: Sfx): void {
    if (!this.settings.enabled) return;
    this.ensure();
    if (!this.ctx || !this.sfxBus) return;
    switch (id) {
      case 'hit':        return this.blip(220, 0.08, 'square', 0.7);
      case 'crit':       return this.blip(440, 0.14, 'sawtooth', 1.0);
      case 'heal':       return this.chord([523, 659, 784], 0.25, 'triangle', 0.6);
      case 'descend':    return this.chord([330, 415, 523], 0.35, 'sine', 0.7);
      case 'death':      return this.blip(110, 0.35, 'sawtooth', 0.8, 55);
      case 'wipe':       return this.chord([196, 123, 98], 0.9, 'sawtooth', 0.8);
      case 'boss-intro': return this.chord([65, 98, 130], 0.8, 'sawtooth', 0.85);
      case 'click':      return this.blip(880, 0.03, 'square', 0.25);
    }
  }

  startAmbient(variant: 'calm' | 'boss' = 'calm'): void {
    if (!this.settings.enabled) return;
    this.ensure();
    if (!this.ctx || !this.musicBus) return;
    if (this.ambient && this.ambientVariant === variant) return;
    this.stopAmbient();
    this.ambientVariant = variant;
    const ctx = this.ctx;
    const nodes: AudioNode[] = [];
    const starts: AudioScheduledSourceNode[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    // ─── Bus + "cave" space (feedback delay gives cheap reverb tail) ──
    const bed = ctx.createGain();
    bed.gain.setValueAtTime(0, ctx.currentTime);
    bed.gain.linearRampToValueAtTime(variant === 'boss' ? 1.0 : 0.9, ctx.currentTime + 2.5);
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = variant === 'boss' ? 0.55 : 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = variant === 'boss' ? 0.55 : 0.48;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    const dampen = ctx.createBiquadFilter();
    dampen.type = 'lowpass';
    dampen.frequency.value = 1600;
    bed.connect(delay);
    delay.connect(dampen);
    dampen.connect(feedback);
    feedback.connect(delay);
    dampen.connect(wet);
    bed.connect(this.musicBus);
    wet.connect(this.musicBus);
    nodes.push(bed, delay, feedback, wet, dampen);

    // ─── Sub drone (foundation) ──────────────────────────────────────
    const rootHz = variant === 'boss' ? 41.2 : 55; // E1 boss, A1 calm
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = rootHz;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.45;
    sub.connect(subGain).connect(bed);
    sub.start();
    starts.push(sub);

    // ─── Detuned pad: 3 sawtooths through a slow-sweeping LPF ────────
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = variant === 'boss' ? 360 : 480;
    padFilter.Q.value = 3;
    const padGain = ctx.createGain();
    padGain.gain.value = variant === 'boss' ? 0.11 : 0.09;
    padFilter.connect(padGain).connect(bed);
    // Intervals: root + minor 2nd (creepy) for boss, root + perfect 5th for calm
    const padIntervals = variant === 'boss' ? [1, 2.12, 0.5] : [1, 1.5, 0.5];
    const detunes = [-7, 0, 5];
    padIntervals.forEach((mul, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = rootHz * mul * 4; // move pad to audible range
      o.detune.value = detunes[i];
      o.connect(padFilter);
      o.start();
      starts.push(o);
    });

    // LFO slowly sweeps the pad filter so the tone breathes.
    const sweepLfo = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepLfo.type = 'sine';
    sweepLfo.frequency.value = variant === 'boss' ? 0.06 : 0.04;
    sweepGain.gain.value = variant === 'boss' ? 180 : 140;
    sweepLfo.connect(sweepGain).connect(padFilter.frequency);
    sweepLfo.start();
    starts.push(sweepLfo);

    // ─── Cave wind: brown noise through a wandering bandpass ─────────
    const noise = ctx.createBufferSource();
    noise.buffer = this.getBrownNoiseBuffer(ctx);
    noise.loop = true;
    const windBand = ctx.createBiquadFilter();
    windBand.type = 'bandpass';
    windBand.frequency.value = variant === 'boss' ? 280 : 420;
    windBand.Q.value = 0.8;
    const windGain = ctx.createGain();
    windGain.gain.value = variant === 'boss' ? 0.18 : 0.13;
    const windLfo = ctx.createOscillator();
    const windLfoGain = ctx.createGain();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.07;
    windLfoGain.gain.value = 160;
    windLfo.connect(windLfoGain).connect(windBand.frequency);
    noise.connect(windBand).connect(windGain).connect(bed);
    noise.start();
    windLfo.start();
    starts.push(noise, windLfo);

    // ─── Sparse random drips / metallic pings ────────────────────────
    const dripTimer = setInterval(() => {
      if (!this.ctx || !this.settings.enabled) return;
      // Only fire ~40% of intervals so it feels scattered, not rhythmic.
      if (Math.random() > 0.4) return;
      const pitch = variant === 'boss'
        ? 240 + Math.random() * 180
        : 900 + Math.random() * 1400;
      this.drip(pitch, variant === 'boss' ? 0.45 : 0.22, bed);
    }, 2200);
    intervals.push(dripTimer);

    // ─── Boss-only: slow heartbeat ────────────────────────────────────
    if (variant === 'boss') {
      const heartTimer = setInterval(() => {
        if (!this.ctx || !this.settings.enabled) return;
        this.heartbeat(bed);
      }, 1400);
      intervals.push(heartTimer);
    }

    this.ambient = {
      stop: () => {
        const now = ctx.currentTime;
        for (const t of intervals) clearInterval(t);
        bed.gain.cancelScheduledValues(now);
        bed.gain.setValueAtTime(bed.gain.value, now);
        bed.gain.linearRampToValueAtTime(0, now + 0.6);
        for (const s of starts) {
          try { s.stop(now + 0.7); } catch { /* already stopped */ }
        }
        // Let the delay tail decay out, then drop everything.
        setTimeout(() => {
          for (const n of nodes) {
            try { n.disconnect(); } catch { /* ignore */ }
          }
        }, 1500);
      },
    };
  }

  /** Cached brown noise buffer — generated once per context, reused. */
  private brownNoiseBuffer: AudioBuffer | null = null;
  private getBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.brownNoiseBuffer) return this.brownNoiseBuffer;
    const len = ctx.sampleRate * 4; // 4-second loop
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    this.brownNoiseBuffer = buf;
    return buf;
  }

  /** Short metallic/water ping used by the ambient drip scheduler. */
  private drip(freq: number, dur: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + dur * 0.7);
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 8;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(bp).connect(gain).connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  /** Low thud used by the boss ambient variant. */
  private heartbeat(dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const thud = (delaySec: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, ctx.currentTime + delaySec);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + delaySec + 0.18);
      gain.gain.setValueAtTime(0, ctx.currentTime + delaySec);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + delaySec + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delaySec + 0.22);
      osc.connect(gain).connect(dest);
      osc.start(ctx.currentTime + delaySec);
      osc.stop(ctx.currentTime + delaySec + 0.25);
    };
    thud(0);
    thud(0.28); // second "lub-dub" beat
  }

  stopAmbient(): void {
    this.ambient?.stop();
    this.ambient = null;
  }

  private blip(freq: number, dur: number, type: OscillatorType, peak: number, endFreq?: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), ctx.currentTime + dur);
    }
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private chord(freqs: number[], dur: number, type: OscillatorType, peak: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peak / freqs.length, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    gain.connect(this.sfxBus);
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.05);
    }
  }
}

export const audioEngine = new AudioEngine();
