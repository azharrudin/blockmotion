import type { TerrainConfig } from './types';

export const TERRAIN_SEGMENTS = 64;
export function isValidTerrain(value: unknown): value is TerrainConfig {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return ['grass', 'mountains', 'jungle', 'desert'].includes(String(c.biome)) &&
    typeof c.size === 'number' && Number.isFinite(c.size) && c.size >= 12 && c.size <= 180 &&
    typeof c.height === 'number' && Number.isFinite(c.height) && c.height >= 0 && c.height <= 40 &&
    typeof c.seed === 'number' && Number.isInteger(c.seed) && c.seed >= 0 && c.seed <= 2147483647;
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
const smooth = (n: number) => n * n * (3 - 2 * n);
function noise(x: number, z: number, seed: number): number {
  const hash = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(seed, 1274126177);
    n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x), iz = Math.floor(z), tx = smooth(x - ix), tz = smooth(z - iz);
  return (hash(ix, iz) * (1 - tx) + hash(ix + 1, iz) * tx) * (1 - tz) +
    (hash(ix, iz + 1) * (1 - tx) + hash(ix + 1, iz + 1) * tx) * tz;
}
/** Height at a terrain vertex, before interpolation over the rendered triangles. */
export function terrainVertexHeight(c: TerrainConfig, x: number, z: number): number {
  if (c.biome === 'grass' || c.height === 0) return 0.04;
  const nx = x / c.size, nz = z / c.size;
  const edge = smooth(Math.min(1, Math.max(0, (0.5 - Math.max(Math.abs(nx), Math.abs(nz))) * 10)));
  const n = noise(nx * 5 + 9, nz * 5 + 13, c.seed);
  if (c.biome === 'mountains') {
    const peaks = seededRandom(c.seed);
    let mountain = 0;
    for (let i = 0; i < 6; i++) {
      const px = (peaks() - 0.5) * 0.7, pz = (peaks() - 0.5) * 0.7;
      const width = 0.055 + peaks() * 0.07, strength = 0.6 + peaks() * 0.4;
      const distance = Math.hypot(nx - px, nz - pz);
      mountain = Math.max(mountain, strength * Math.exp(-distance * distance / width));
    }
    return 0.04 + c.height * edge * Math.max(0, mountain * (0.75 + n * 0.25) + (noise(nx * 19, nz * 19, c.seed + 1) - 0.5) * 0.12);
  }
  if (c.biome === 'jungle') return 0.04 + c.height * edge * (n * 0.7 + noise(nx * 12, nz * 12, c.seed + 1) * 0.3);
  const phase = c.seed * 0.013;
  const dune = (Math.sin(nx * 23 + nz * 7 + n * 3 + phase) + 1) * 0.5;
  return 0.04 + c.height * edge * (Math.pow(dune, 1.5) * 0.75 + n * 0.25);
}
/** Match the exact triangle interpolation used by the terrain mesh so plants sit on it. */
export function terrainHeightAt(c: TerrainConfig, x: number, z: number): number {
  const step = c.size / TERRAIN_SEGMENTS;
  const gx = Math.max(0, Math.min(TERRAIN_SEGMENTS - 0.000001, (x + c.size / 2) / step));
  const gz = Math.max(0, Math.min(TERRAIN_SEGMENTS - 0.000001, (z + c.size / 2) / step));
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const x0 = ix * step - c.size / 2, z0 = iz * step - c.size / 2;
  const a = terrainVertexHeight(c, x0, z0), b = terrainVertexHeight(c, x0 + step, z0);
  const d = terrainVertexHeight(c, x0 + step, z0 + step), e = terrainVertexHeight(c, x0, z0 + step);
  return fx + fz <= 1 ? a + (b - a) * fx + (e - a) * fz : d + (e - d) * (1 - fx) + (b - d) * (1 - fz);
}
