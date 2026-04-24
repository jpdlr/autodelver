import { audioEngine, type AudioSettings, type Sfx } from '../audio/engine';

const STORAGE_KEY = 'autodelver:audio:v1';
const DEFAULTS: AudioSettings = { enabled: true, sfxVolume: 0.4, musicVolume: 0.25 };

function load(): AudioSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      enabled: parsed.enabled ?? DEFAULTS.enabled,
      sfxVolume: clamp(parsed.sfxVolume ?? DEFAULTS.sfxVolume, 0, 1),
      musicVolume: clamp(parsed.musicVolume ?? DEFAULTS.musicVolume, 0, 1),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: AudioSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota, private mode, etc. — silently skip */
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function createAudioStore() {
  let settings = $state<AudioSettings>(load());
  audioEngine.configure(settings);

  function apply(next: AudioSettings): void {
    settings = next;
    audioEngine.configure(next);
    save(next);
  }

  return {
    get settings() {
      return settings;
    },
    setEnabled(v: boolean) {
      apply({ ...settings, enabled: v });
      if (!v) audioEngine.stopAmbient();
    },
    setSfxVolume(v: number) {
      apply({ ...settings, sfxVolume: clamp(v, 0, 1) });
    },
    setMusicVolume(v: number) {
      apply({ ...settings, musicVolume: clamp(v, 0, 1) });
      if (v === 0) audioEngine.stopAmbient();
    },
    play(id: Sfx) {
      audioEngine.play(id);
    },
    startAmbient(variant: 'calm' | 'boss' = 'calm') {
      audioEngine.startAmbient(variant);
    },
    stopAmbient() {
      audioEngine.stopAmbient();
    },
  };
}

export const audio = createAudioStore();
