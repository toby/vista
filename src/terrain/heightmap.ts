/**
 * Heightmap: a square, row-major grid of heights plus its value range.
 * Produced by the fractal generator and consumed by the mesh builder.
 */
export interface Heightmap {
  /** Edge length in vertices (a (2^n)+1 square). */
  size: number;
  /** Heights, row-major: index = y * size + x. */
  data: Float32Array;
  /** Minimum height in `data`. */
  min: number;
  /** Maximum height in `data`. */
  max: number;
}

export function createHeightmap(size: number): Heightmap {
  return { size, data: new Float32Array(size * size), min: 0, max: 0 };
}

/** Recompute and store the min/max of the current data. */
export function recomputeRange(hm: Heightmap): void {
  let min = Infinity;
  let max = -Infinity;
  const d = hm.data;
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  hm.min = min;
  hm.max = max;
}

/**
 * Rescale data into [0, 1]. Feature levels (lake/beach/tree/snow) are expressed
 * as fractions of the height range, so normalizing here lets them compare
 * directly against heights. A perfectly flat map collapses to all-zero.
 */
export function normalize01(hm: Heightmap): void {
  recomputeRange(hm);
  const range = hm.max - hm.min;
  const d = hm.data;
  if (range <= 1e-9) {
    d.fill(0);
    hm.min = 0;
    hm.max = 0;
    return;
  }
  const inv = 1 / range;
  const min = hm.min;
  for (let i = 0; i < d.length; i++) {
    d[i] = (d[i] - min) * inv;
  }
  hm.min = 0;
  hm.max = 1;
}

/** Height at grid coordinate (x, y). Assumes in-bounds access. */
export function heightAt(hm: Heightmap, x: number, y: number): number {
  return hm.data[y * hm.size + x];
}
