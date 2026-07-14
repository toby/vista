import { describe, it, expect } from 'vitest';
import { Color } from 'three';
import { colorForVertex } from '../src/render/coloring';
import type { LevelParams } from '../src/state/SceneParams';

const levels: LevelParams = { lake: 0.3, beach: 0.35, tree: 0.6, snow: 0.8 };

function col(height: number, flatness = 1): Color {
  const c = new Color();
  colorForVertex(height, flatness, levels, c);
  return c;
}

describe('colorForVertex', () => {
  it('colors submerged terrain as blue-dominant sea', () => {
    const c = col(0.1);
    expect(c.b).toBeGreaterThan(c.r);
    expect(c.b).toBeGreaterThan(c.g);
  });

  it('colors flat mid elevations as green-dominant grass', () => {
    const c = col(0.45, 1);
    expect(c.g).toBeGreaterThan(c.r);
    expect(c.g).toBeGreaterThan(c.b);
  });

  it('colors high flat ground as bright snow', () => {
    const c = col(0.95, 1);
    expect(c.r).toBeGreaterThan(0.6);
    expect(c.g).toBeGreaterThan(0.6);
    expect(c.b).toBeGreaterThan(0.6);
  });

  it('shows more rock on steep slopes than on flat grass', () => {
    const flat = col(0.45, 1);
    const steep = col(0.45, 0.4);
    // Rock is browner than grass, so its red channel is higher.
    expect(steep.r).toBeGreaterThan(flat.r);
  });
});
