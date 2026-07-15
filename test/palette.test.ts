import { describe, it, expect } from 'vitest';
import { Color } from 'three';
import { colorForVertex, resolvePalette } from '../src/render/coloring';
import { defaultSceneParams, type LevelParams } from '../src/state/SceneParams';

const levels: LevelParams = { lake: 0.3, beach: 0.35, tree: 0.6, snow: 0.8 };

function color(height: number, palette = resolvePalette(defaultSceneParams().palette)): Color {
  const c = new Color();
  colorForVertex(height, 1, levels, c, palette);
  return c;
}

describe('palette coloring', () => {
  it('resolvePalette parses the band hex colors', () => {
    const p = resolvePalette({
      sea: '#000000',
      sand: '#ffffff',
      grass: '#00ff00',
      rock: '#808080',
      snow: '#ffffff',
      numColors: 0,
      locked: false,
      cmapMode: 'natural',
    });
    expect(p.grass.getHexString()).toBe('00ff00');
    expect(p.sea.getHexString()).toBe('000000');
  });

  it('uses the supplied band colors', () => {
    const palette = resolvePalette({
      sea: '#123456',
      sand: '#cbb888',
      grass: '#4d7a39',
      rock: '#786d5b',
      snow: '#f2f5fb',
      numColors: 0,
      locked: false,
      cmapMode: 'natural',
    });
    const submerged = color(0.05, palette);
    expect(submerged.getHexString()).toBe('123456');
  });

  it('quantizes into flat bands when numColors is set', () => {
    const palette = resolvePalette({
      ...defaultSceneParams().palette,
      numColors: 4,
    });
    // Two nearby heights that round to the same quantized band match exactly.
    const a = color(0.50, palette);
    const b = color(0.505, palette);
    expect(a.getHexString()).toBe(b.getHexString());
  });

  it('contour mode produces hard-edged bands (no smooth blend)', () => {
    const palette = resolvePalette({
      ...defaultSceneParams().palette,
      cmapMode: 'contour',
    });
    // Within a single contour band, color is constant.
    const a = color(0.45, palette);
    const b = color(0.46, palette);
    expect(a.getHexString()).toBe(b.getHexString());
  });
});
