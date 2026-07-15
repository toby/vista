import { describe, it, expect } from 'vitest';
import { recomputeRange, type Heightmap } from '../src/terrain/heightmap';
import { resampleHeightmap } from '../src/terrain/resample';

function hm(size: number, values: number[]): Heightmap {
  const out: Heightmap = {
    size,
    data: new Float32Array(values),
    min: 0,
    max: 0,
  };
  recomputeRange(out);
  return out;
}

function expectCloseArray(actual: Float32Array, expected: Float32Array): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 6);
  }
}

describe('resampleHeightmap', () => {
  it('resampling to the same size reproduces the data', () => {
    const src = hm(3, [0, 0.25, 1, 0.4, 0.5, 0.6, 0.2, 0.75, 0.9]);
    const out = resampleHeightmap(src, 3);

    expect(out).not.toBe(src);
    expect(out.data).not.toBe(src.data);
    expectCloseArray(out.data, src.data);
  });

  it('preserves corners when upsampling and downsampling', () => {
    const src = hm(3, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    const up = resampleHeightmap(src, 5);
    const down = resampleHeightmap(src, 2);

    expect(up.data[0]).toBeCloseTo(0.1, 6);
    expect(up.data[4]).toBeCloseTo(0.3, 6);
    expect(up.data[20]).toBeCloseTo(0.7, 6);
    expect(up.data[24]).toBeCloseTo(0.9, 6);
    expect(down.data[0]).toBeCloseTo(0.1, 6);
    expect(down.data[1]).toBeCloseTo(0.3, 6);
    expect(down.data[2]).toBeCloseTo(0.7, 6);
    expect(down.data[3]).toBeCloseTo(0.9, 6);
  });

  it('keeps an upsampled linear ramp monotonic with matching endpoints', () => {
    const src = hm(2, [0, 1, 1, 2]);
    const out = resampleHeightmap(src, 5);

    expect(out.data[0]).toBeCloseTo(0, 6);
    expect(out.data[24]).toBeCloseTo(2, 6);
    for (let y = 0; y < out.size; y++) {
      for (let x = 1; x < out.size; x++) {
        expect(out.data[y * out.size + x]).toBeGreaterThanOrEqual(out.data[y * out.size + x - 1]);
      }
    }
    for (let y = 1; y < out.size; y++) {
      for (let x = 0; x < out.size; x++) {
        expect(out.data[y * out.size + x]).toBeGreaterThanOrEqual(out.data[(y - 1) * out.size + x]);
      }
    }
  });

  it('sets output size and data length from newSize', () => {
    const src = hm(2, [0, 1, 2, 3]);
    const out = resampleHeightmap(src, 4);

    expect(out.size).toBe(4);
    expect(out.data.length).toBe(16);
  });
});
