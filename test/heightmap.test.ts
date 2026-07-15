import { describe, it, expect } from 'vitest';
import {
  createHeightmap,
  decimateHeightmap,
  recomputeRange,
} from '../src/terrain/heightmap';

describe('decimateHeightmap', () => {
  it('returns the same heightmap for stride <= 1', () => {
    const hm = createHeightmap(5);
    expect(decimateHeightmap(hm, 1)).toBe(hm);
    expect(decimateHeightmap(hm, 0)).toBe(hm);
  });

  it('halves a (2^n)+1 grid and preserves corner samples', () => {
    const hm = createHeightmap(5);
    for (let i = 0; i < hm.data.length; i++) hm.data[i] = i;
    recomputeRange(hm);

    const out = decimateHeightmap(hm, 2);
    expect(out.size).toBe(3); // floor((5-1)/2)+1

    // Corners: (0,0), (4,0), (0,4), (4,4) in the source map to out corners.
    expect(out.data[0]).toBe(hm.data[0]);
    expect(out.data[2]).toBe(hm.data[4]);
    expect(out.data[6]).toBe(hm.data[4 * 5 + 0]);
    expect(out.data[8]).toBe(hm.data[4 * 5 + 4]);
  });

  it('point-samples every stride-th vertex', () => {
    const hm = createHeightmap(9);
    for (let i = 0; i < hm.data.length; i++) hm.data[i] = i;
    const out = decimateHeightmap(hm, 4); // 3x3
    expect(out.size).toBe(3);
    // Row 0 samples x = 0, 4, 8.
    expect(out.data[0]).toBe(0);
    expect(out.data[1]).toBe(4);
    expect(out.data[2]).toBe(8);
  });
});
