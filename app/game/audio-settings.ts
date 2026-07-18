export type AudioChannel = "sfx" | "music" | "voice";
export type AudioLevels = { master: number; sfx: number; music: number; voice: number };

export const DEFAULT_AUDIO_LEVELS: AudioLevels = { master: 100, sfx: 100, music: 100, voice: 100 };

export function clampAudioLevel(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 100)));
}

export function effectiveVolume(levels: AudioLevels, channel: AudioChannel, muted: boolean, baseVolume = 1) {
  if (muted) return 0;
  return Math.max(0, Math.min(1, baseVolume * clampAudioLevel(levels.master) / 100 * clampAudioLevel(levels[channel]) / 100));
}

export function parseAudioLevels(raw: string | null): AudioLevels {
  if (!raw) return { ...DEFAULT_AUDIO_LEVELS };
  try {
    const value = JSON.parse(raw) as Partial<AudioLevels>;
    return {
      master: clampAudioLevel(value.master ?? 100),
      sfx: clampAudioLevel(value.sfx ?? 100),
      music: clampAudioLevel(value.music ?? 100),
      voice: clampAudioLevel(value.voice ?? 100),
    };
  } catch {
    return { ...DEFAULT_AUDIO_LEVELS };
  }
}
