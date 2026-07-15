/**
 * Pure bilinear heightmap resampling for square terrain grids.
 */
import {
  createHeightmap,
  recomputeRange,
  type Heightmap,
} from './heightmap';

function averageHeight(hm: Heightmap): number {
  if (hm.data.length === 0) return 0;
  let sum = 0;
  for (const v of hm.data) sum += v;
  return sum / hm.data.length;
}

/**
 * Bilinearly resample a heightmap to a new square edge length.
 * Corner samples map to corners. Returns a new Heightmap; input is unchanged.
 */
export function resampleHeightmap(hm: Heightmap, newSize: number): Heightmap {
  if (!Number.isInteger(newSize) || newSize < 1) {
    throw new RangeError('newSize must be a positive integer');
  }

  const out = createHeightmap(newSize);
  const srcSize = hm.size;

  if (newSize === 1) {
    out.data[0] = averageHeight(hm);
    recomputeRange(out);
    return out;
  }

  if (srcSize <= 1) {
    out.data.fill(hm.data[0] ?? 0);
    recomputeRange(out);
    return out;
  }

  const src = hm.data;
  const dst = out.data;
  const scale = (srcSize - 1) / (newSize - 1);

  for (let oy = 0; oy < newSize; oy++) {
    const sy = oy * scale;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, srcSize - 1);
    const ty = sy - y0;

    for (let ox = 0; ox < newSize; ox++) {
      const sx = ox * scale;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, srcSize - 1);
      const tx = sx - x0;

      const v00 = src[y0 * srcSize + x0];
      const v10 = src[y0 * srcSize + x1];
      const v01 = src[y1 * srcSize + x0];
      const v11 = src[y1 * srcSize + x1];
      const top = v00 + (v10 - v00) * tx;
      const bottom = v01 + (v11 - v01) * tx;
      dst[oy * newSize + ox] = top + (bottom - top) * ty;
    }
  }

  recomputeRange(out);
  return out;
}
