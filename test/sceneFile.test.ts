import { describe, it, expect } from 'vitest';
import { sanitizeParams } from '../src/io/sceneFile';
import { defaultSceneParams } from '../src/state/SceneParams';

describe('sanitizeParams', () => {
  it('round-trips a full, valid params object', () => {
    const p = defaultSceneParams();
    p.terrain.seed = 999;
    p.renderMode = 'retro';
    p.camera.position.x = 12.5;
    p.sun.color = '#abcdef';
    const out = sanitizeParams(JSON.parse(JSON.stringify(p)));
    expect(out).toEqual(p);
  });

  it('fills missing fields from the defaults', () => {
    const d = defaultSceneParams();
    const out = sanitizeParams({ terrain: { seed: 5 } });
    expect(out.terrain.seed).toBe(5);
    expect(out.terrain.roughness).toBe(d.terrain.roughness);
    expect(out.camera).toEqual(d.camera);
    expect(out.renderMode).toBe('modern');
  });

  it('rejects wrong-typed fields and falls back to defaults', () => {
    const d = defaultSceneParams();
    const out = sanitizeParams({
      terrain: { seed: 'nope', roughness: null },
      sun: { color: 123 },
      renderMode: 'weird',
    });
    expect(out.terrain.seed).toBe(d.terrain.seed);
    expect(out.terrain.roughness).toBe(d.terrain.roughness);
    expect(out.sun.color).toBe(d.sun.color);
    expect(out.renderMode).toBe('modern');
  });

  it('handles non-object input safely', () => {
    expect(sanitizeParams(null)).toEqual(defaultSceneParams());
    expect(sanitizeParams('garbage')).toEqual(defaultSceneParams());
    expect(sanitizeParams(42)).toEqual(defaultSceneParams());
  });

  it('truncates seed and sizeLevel to integers', () => {
    const out = sanitizeParams({ terrain: { seed: 42.9, sizeLevel: 8.7 } });
    expect(out.terrain.seed).toBe(42);
    expect(out.terrain.sizeLevel).toBe(8);
  });
});
