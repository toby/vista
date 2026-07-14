/**
 * Fractal terrain generation via the Diamond–Square algorithm (midpoint
 * displacement on a (2^n)+1 grid). Deterministic for a given seed, so the same
 * parameters always reproduce the same landscape.
 */
import { mulberry32 } from './prng';
import { terrainEdge } from '../state/SceneParams';
import {
  createHeightmap,
  normalize01,
  type Heightmap,
} from './heightmap';

export interface TerrainGenOptions {
  seed: number;
  /** Grid detail level: edge = 2^sizeLevel + 1. */
  sizeLevel: number;
  /** 0 = smooth, 1 = very rough (controls amplitude falloff per subdivision). */
  roughness: number;
}

export function generateTerrain(opts: TerrainGenOptions): Heightmap {
  const size = terrainEdge(opts.sizeLevel);
  const hm = createHeightmap(size);
  const data = hm.data;
  const max = size - 1;

  const rng = mulberry32(opts.seed >>> 0);
  // Symmetric random displacement in [-1, 1).
  const jitter = (): number => rng() * 2 - 1;

  const get = (x: number, y: number): number => data[y * size + x];
  const set = (x: number, y: number, v: number): void => {
    data[y * size + x] = v;
  };

  // Roughness -> per-step amplitude ratio (persistence). Lower persistence
  // damps fine detail into smooth, rolling terrain; higher keeps it jagged.
  // roughness 0.5 -> 0.50 (natural), 0 -> 0.30 (smooth), 1 -> 0.70 (rugged).
  const roughness = Math.min(1, Math.max(0, opts.roughness));
  const ratio = 0.3 + roughness * 0.4;

  let scale = 1.0;

  // Seed the four corners.
  set(0, 0, jitter() * scale);
  set(max, 0, jitter() * scale);
  set(0, max, jitter() * scale);
  set(max, max, jitter() * scale);

  const diamond = (x: number, y: number, half: number): void => {
    const avg =
      (get(x - half, y - half) +
        get(x + half, y - half) +
        get(x - half, y + half) +
        get(x + half, y + half)) *
      0.25;
    set(x, y, avg + jitter() * scale);
  };

  const square = (x: number, y: number, half: number): void => {
    let sum = 0;
    let count = 0;
    if (x - half >= 0) {
      sum += get(x - half, y);
      count++;
    }
    if (x + half <= max) {
      sum += get(x + half, y);
      count++;
    }
    if (y - half >= 0) {
      sum += get(x, y - half);
      count++;
    }
    if (y + half <= max) {
      sum += get(x, y + half);
      count++;
    }
    set(x, y, sum / count + jitter() * scale);
  };

  for (let step = max; step > 1; step >>= 1) {
    const half = step >> 1;

    // Diamond step: centers of each square.
    for (let y = half; y < max; y += step) {
      for (let x = half; x < max; x += step) {
        diamond(x, y, half);
      }
    }

    // Square step: edge midpoints, on an alternating checkerboard.
    for (let y = 0; y <= max; y += half) {
      const rowIsOffset = (y / half) % 2 === 0;
      for (let x = rowIsOffset ? half : 0; x <= max; x += step) {
        square(x, y, half);
      }
    }

    scale *= ratio;
  }

  normalize01(hm);
  return hm;
}
