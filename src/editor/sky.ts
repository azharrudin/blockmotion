import type { SkyPreset, SkySettings } from './types';

export const SKY_LABELS: Record<SkyPreset, string> = {
  studio: 'Studio (solid background)', morning: 'Pagi / Morning', day: 'Siang / Day',
  evening: 'Sore / Evening', night: 'Malam / Night', custom: 'Custom',
};

export const SKY_PRESETS: Record<SkyPreset, SkySettings> = {
  studio: { preset: 'studio', top: '#141b2b', horizon: '#141b2b', lightColor: '#fff5e8', elevation: 55, azimuth: -35, intensity: 3.1, ambient: 2.1, stars: false },
  morning: { preset: 'morning', top: '#639bd9', horizon: '#ffd3a1', lightColor: '#ffe0b0', elevation: 18, azimuth: -65, intensity: 2.4, ambient: 1.4, stars: false },
  day: { preset: 'day', top: '#2786d9', horizon: '#d2efff', lightColor: '#fff8e8', elevation: 65, azimuth: -35, intensity: 3.1, ambient: 1.8, stars: false },
  evening: { preset: 'evening', top: '#43376e', horizon: '#ff9a62', lightColor: '#ffab70', elevation: 8, azimuth: 65, intensity: 2.0, ambient: 0.9, stars: false },
  night: { preset: 'night', top: '#030817', horizon: '#202d50', lightColor: '#b5ceff', elevation: 38, azimuth: 120, intensity: 0.6, ambient: 0.45, stars: true },
  custom: { preset: 'custom', top: '#2786d9', horizon: '#d2efff', lightColor: '#fff8e8', elevation: 45, azimuth: -35, intensity: 2.5, ambient: 1.5, stars: false },
};

export function isValidSky(value: unknown): value is SkySettings {
  if (typeof value !== 'object' || value === null) return false;
  const sky = value as Record<string, unknown>;
  if (typeof sky.preset !== 'string' || !Object.hasOwn(SKY_PRESETS, sky.preset) || typeof sky.stars !== 'boolean') return false;
  for (const key of ['top', 'horizon', 'lightColor']) {
    if (typeof sky[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(sky[key])) return false;
  }
  for (const [key, min, max] of [['elevation', 0, 90], ['azimuth', -180, 180], ['intensity', 0, 5], ['ambient', 0, 4]] as const) {
    const n = sky[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) return false;
  }
  return true;
}
