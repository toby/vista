import { describe, it, expect } from 'vitest';
import { generateTerrain } from '../src/terrain/diamondSquare';
import { terrainEdge } from '../src/state/SceneParams';

describe('generateTerrain', () => {
  it('produces a (2^n)+1 square normalized to [0, 1]', () => {
    const hm = generateTerrain({ seed: 1, sizeLevel: 6, roughness: 0.5 });
    expect(hm.size).toBe(terrainEdge(6));
    expect(hm.data.length).toBe(hm.size * hm.size);
    expect(hm.min).toBe(0);
    expect(hm.max).toBe(1);
    for (const v of hm.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for identical options', () => {
    const a = generateTerrain({ seed: 9, sizeLevel: 7, roughness: 0.6 });
    const b = generateTerrain({ seed: 9, sizeLevel: 7, roughness: 0.6 });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('varies with the seed', () => {
    const a = generateTerrain({ seed: 1, sizeLevel: 6, roughness: 0.5 });
    const c = generateTerrain({ seed: 2, sizeLevel: 6, roughness: 0.5 });
    expect(Array.from(a.data)).not.toEqual(Array.from(c.data));
  });

  it('contains no NaN even at high roughness', () => {
    const hm = generateTerrain({ seed: 3, sizeLevel: 6, roughness: 1 });
    expect(hm.data.some((v) => Number.isNaN(v))).toBe(false);
  });

  it('reaches both extremes of the normalized range', () => {
    const hm = generateTerrain({ seed: 5, sizeLevel: 6, roughness: 0.5 });
    let hasMin = false;
    let hasMax = false;
    for (const v of hm.data) {
      if (v === 0) hasMin = true;
      if (v === 1) hasMax = true;
    }
    expect(hasMin).toBe(true);
    expect(hasMax).toBe(true);
  });
});
