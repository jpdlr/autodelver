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

    // ─── Flowy pad: soft triangles in a low register so the whole bed
    // sits in the low-mids. Held oscillator refs let the chord scheduler
    // slide them slowly.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = variant === 'boss' ? 200 : 260;
    padFilter.Q.value = 1.1;
    const padGain = ctx.createGain();
    padGain.gain.value = variant === 'boss' ? 0.18 : 0.15;
    padFilter.connect(padGain).connect(bed);
    // Pad lives one octave above the sub drone (was two). Calm floors
    // get a 5th; boss gets root + 5th + low octave for extra weight.
    const padIntervals = variant === 'boss' ? [1, 1.5, 0.5] : [1, 1.5, 0.5];
    const detunes = [-4, 0, 3];
    const padOscs: OscillatorNode[] = [];
    padIntervals.forEach((mul, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = rootHz * mul * 2;
      o.detune.value = detunes[i];
      o.connect(padFilter);
      o.start();
      starts.push(o);
      padOscs.push(o);
    });
    // Store sub for chord shifts too.
    const subRoot = sub;

    // LFO slowly sweeps the pad filter so the tone breathes.
    const sweepLfo = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepLfo.type = 'sine';
    // Very slow breath — filter opens/closes over ~30–45s, no audible wobble.
    sweepLfo.frequency.value = variant === 'boss' ? 0.028 : 0.022;
    sweepGain.gain.value = variant === 'boss' ? 90 : 70;
    sweepLfo.connect(sweepGain).connect(padFilter.frequency);
    sweepLfo.start();
    starts.push(sweepLfo);

    // ─── Chord shifts: every 40–70s the root slides to a related note ─
    // Minor-mode related intervals relative to root. Boss leans darker.
    const chordChoices = variant === 'boss'
      ? [1, 0.944, 0.89, 1.122]     // tonic, semitone-down, minor-3rd-down, minor-2nd-up
      : [1, 1.122, 0.944, 0.841];   // tonic, minor-2nd-up, semitone-down, minor-6th-down
    let chordIdx = 0;
    let currentChordRatio = 1;
    const chordTimer = setInterval(() => {
      if (!this.ctx || !this.settings.enabled) return;
      chordIdx = (chordIdx + 1 + Math.floor(Math.random() * (chordChoices.length - 1))) % chordChoices.length;
      const ratio = chordChoices[chordIdx];
      const now = ctx.currentTime;
      const glide = 12; // seconds — very slow slide, barely perceptible
      subRoot.frequency.cancelScheduledValues(now);
      subRoot.frequency.setValueAtTime(subRoot.frequency.value, now);
      subRoot.frequency.linearRampToValueAtTime(rootHz * ratio, now + glide);
      padOscs.forEach((o, i) => {
        const target = rootHz * padIntervals[i] * 2 * ratio;
        o.frequency.cancelScheduledValues(now);
        o.frequency.setValueAtTime(o.frequency.value, now);
        o.frequency.linearRampToValueAtTime(target, now + glide);
      });
      // Remember current ratio so melody scheduler can pick from a
      // scale rooted on the CURRENT chord.
      currentChordRatio = ratio;
    }, (variant === 'boss' ? 40 : 55) * 1000);
    intervals.push(chordTimer);

    // ─── Cave wind: brown noise through a wandering bandpass ─────────
    const noise = ctx.createBufferSource();
    noise.buffer = this.getBrownNoiseBuffer(ctx);
    noise.loop = true;
    const windBand = ctx.createBiquadFilter();
    windBand.type = 'bandpass';
    windBand.frequency.value = variant === 'boss' ? 180 : 280;
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

    // ─── Environmental texture: varied one-shots picked at random ────
    // Every couple of seconds, maybe (40%) play one of several different
    // creepy dungeon sounds so the atmosphere keeps evolving.
    const envTimer = setInterval(() => {
      if (!this.ctx || !this.settings.enabled) return;
      // Sparser so the bed breathes. ~25% chance per tick.
      if (Math.random() > 0.25) return;
      const kinds: Array<() => void> = [
        () => {
          const pitch = variant === 'boss'
            ? 140 + Math.random() * 120
            : 320 + Math.random() * 440;
          this.drip(pitch, variant === 'boss' ? 0.5 : 0.3, bed);
        },
        () => this.creak(variant === 'boss' ? 0.9 : 0.7, bed),
        () => this.whisper(variant === 'boss' ? 1.2 : 0.9, bed),
        () => this.distantRumble(variant === 'boss' ? 0.9 : 0.7, bed),
        () => {
          // high chime, sparse, shimmering. Pitched in a minor scale.
          const scale = [1, 1.189, 1.335, 1.498, 1.682, 1.782, 2];
          const mul = scale[Math.floor(Math.random() * scale.length)];
          const f = rootHz * 4 * mul * currentChordRatio;
          this.chime(f, 1.2, bed);
        },
      ];
      const pick = kinds[Math.floor(Math.random() * kinds.length)];
      pick();
    }, 3200);
    intervals.push(envTimer);

    // ─── Slow melodic phrases — 3-4 notes from a minor scale ─────────
    // These are the "a noise every now and then" musical motifs. Plays
    // every 22–45s, short enough to feel like a haunted-thought, not a
    // tune.
    const melodyTimer = setInterval(() => {
      if (!this.ctx || !this.settings.enabled) return;
      if (Math.random() > 0.7) return;
      // Minor scale degrees rooted on the current chord. Stays sparse:
      // pick 2–4 notes with small steps, not leaping.
      const minor = [1, 1.122, 1.189, 1.335, 1.498, 1.587, 1.782];
      let idx = Math.floor(Math.random() * 3) + 1;
      const noteCount = 2 + Math.floor(Math.random() * 3);
      let delay = 0;
      for (let n = 0; n < noteCount; n++) {
        const mul = minor[Math.max(0, Math.min(minor.length - 1, idx))];
        const f = rootHz * 4 * mul * currentChordRatio;
        this.phraseNote(f, 2.2, bed, delay);
        delay += 0.9 + Math.random() * 0.5;
        idx += (Math.random() < 0.5 ? -1 : 1);
      }
    }, variant === 'boss' ? 28000 : 34000);
    intervals.push(melodyTimer);

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

  /** Soft water-drip / distant ping — slower attack and longer tail than
   *  before so it sits inside the bed rather than pricking through it. */
  private drip(freq: number, dur: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.6, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + dur * 0.8);
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 4;
    const peak = 0.14;
    const total = dur * 1.8;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + total);
    osc.connect(bp).connect(gain).connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + total + 0.05);
  }

  /** Creaking-wood / stressed-stone sound: short filtered noise swell with
   *  a wobbling pitch. */
  private creak(dur: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getBrownNoiseBuffer(ctx);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 14;
    const startF = 180 + Math.random() * 180;
    const endF = startF * (0.6 + Math.random() * 0.3);
    bp.frequency.setValueAtTime(startF, ctx.currentTime);
    bp.frequency.linearRampToValueAtTime(endF, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    noise.connect(bp).connect(gain).connect(dest);
    noise.start();
    noise.stop(ctx.currentTime + dur + 0.05);
  }

  /** Breathy whisper/air swell — high narrow-band noise, slow envelope. */
  private whisper(dur: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getBrownNoiseBuffer(ctx);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.value = 500 + Math.random() * 600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    // Panned off-centre so whispers come from "somewhere else".
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() - 0.5) * 1.6;
    noise.connect(bp).connect(gain).connect(panner).connect(dest);
    noise.start();
    noise.stop(ctx.currentTime + dur + 0.05);
  }

  /** Sub-bass rumble that fades in and out like a distant collapse. */
  private distantRumble(dur: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(45 + Math.random() * 20, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(28, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + dur * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  /** Soft sine bell — slow attack, long shimmering tail. */
  private chime(freq: number, dur: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const total = dur * 2.2;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + total);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + total + 0.05);
  }

  /** One note of a slow melodic phrase — soft triangle, slow attack, very
   *  long tail so phrases overlap and blur into the bed. */
  private phraseNote(freq: number, dur: number, dest: AudioNode, startDelay: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + startDelay;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    const gain = ctx.createGain();
    const total = dur * 2.4;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.09, t0 + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + total);
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() - 0.5) * 0.6;
    osc.connect(filter).connect(gain).connect(panner).connect(dest);
    osc.start(t0);
    osc.stop(t0 + total + 0.05);
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
