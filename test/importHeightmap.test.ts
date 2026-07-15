import { describe, expect, it } from 'vitest';
import { imageDataToHeightmap } from '../src/io/importHeightmap';

const VALID_EDGES = [65, 129, 257, 513];

function image(width: number, height: number, fill: (x: number, y: number) => number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const value = fill(x, y);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  return { width, height, data } as unknown as ImageData;
}

describe('imageDataToHeightmap', () => {
  it('resamples a gradient image to a normalized valid terrain edge', () => {
    const out = imageDataToHeightmap(image(4, 4, (x, y) => (x + y) * 42.5));
    const values = Array.from(out.data);

    expect(VALID_EDGES).toContain(out.size);
    expect(out.data).toHaveLength(out.size * out.size);
    expect(Math.min(...values)).toBeCloseTo(0);
    expect(Math.max(...values)).toBeCloseTo(1);
  });

  it('normalizes a solid image to all zeros', () => {
    const out = imageDataToHeightmap(image(8, 8, () => 128));

    expect(VALID_EDGES).toContain(out.size);
    expect(out.data).toHaveLength(out.size * out.size);
    expect(Array.from(out.data).every((value) => value === 0)).toBe(true);
  });
});
