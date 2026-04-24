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
    const base = variant === 'boss' ? 55 : 82.4; // A1 vs E2
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.value = base;
    osc2.frequency.value = base * 1.5 + (variant === 'boss' ? -2 : 1.5);
    lfo.type = 'sine';
    lfo.frequency.value = variant === 'boss' ? 0.15 : 0.08;
    lfoGain.gain.value = variant === 'boss' ? 18 : 9;
    filter.type = 'lowpass';
    filter.frequency.value = variant === 'boss' ? 420 : 520;
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(variant === 'boss' ? 0.18 : 0.12, ctx.currentTime + 1.2);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc1.start();
    osc2.start();
    lfo.start();
    this.ambient = {
      stop: () => {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
        lfo.stop(now + 0.6);
      },
    };
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
