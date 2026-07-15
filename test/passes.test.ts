/**
 * Tests for deterministic terrain-shaping passes and pipeline composition.
 */
import { describe, it, expect } from 'vitest';
import { generateTerrain } from '../src/terrain/diamondSquare';
import { createHeightmap, normalize01, type Heightmap } from '../src/terrain/heightmap';
import {
  applyCliffs,
  applyValley,
  carveRiver,
  computeLakeLevels,
  smoothHeightmap,
} from '../src/terrain/passes';
import { generateTerrainPipeline } from '../src/terrain/pipeline';
import type { FeatureParams, TerrainParams } from '../src/state/SceneParams';

const terrain: TerrainParams = {
  seed: 4242,
  sizeLevel: 5,
  roughness: 0.55,
  verticalScale: 60,
};

const disabledFeatures: FeatureParams = {
  lakeEnabled: false,
  riverEnabled: false,
  riverStrength: 0,
  valleyEnabled: false,
  valleyStrength: 0,
  cliffsEnabled: false,
  cliffsStrength: 0,
  smooth: 0,
  treesEnabled: false,
  treeDensity: 0,
  starsEnabled: false,
  skyEnabled: true,
  cloudsEnabled: false,
  horizonEnabled: true,
};

const shapedFeatures: FeatureParams = {
  ...disabledFeatures,
  lakeEnabled: true,
  riverEnabled: true,
  riverStrength: 0.7,
  valleyEnabled: true,
  valleyStrength: 0.6,
  cliffsEnabled: true,
  cliffsStrength: 0.5,
  smooth: 0.4,
};

function sampleHeightmap(): Heightmap {
  const hm = createHeightmap(5);
  hm.data.set([
    0.2, 0.3, 0.4, 0.5, 0.6,
    0.3, 0.4, 0.6, 0.7, 0.7,
    0.2, 0.5, 1.0, 0.8, 0.6,
    0.1, 0.3, 0.5, 0.4, 0.3,
    0.0, 0.1, 0.2, 0.3, 0.4,
  ]);
  normalize01(hm);
  return hm;
}

function basinHeightmap(): Heightmap {
  const hm = createHeightmap(5);
  hm.data.fill(1);
  for (let y = 1; y < 4; y++) {
    for (let x = 1; x < 4; x++) {
      hm.data[y * hm.size + x] = 0.2;
    }
  }
  hm.data[2 * hm.size + 2] = 0.05;
  hm.min = 0.05;
  hm.max = 1;
  return hm;
}

function expectFiniteAndSameSize(beforeSize: number, hm: Heightmap): void {
  expect(hm.size).toBe(beforeSize);
  expect(hm.data.length).toBe(beforeSize * beforeSize);
  for (const value of hm.data) {
    expect(Number.isFinite(value)).toBe(true);
  }
}

describe('terrain passes', () => {
  it('generateTerrainPipeline is deterministic for identical params', () => {
    const a = generateTerrainPipeline(terrain, shapedFeatures);
    const b = generateTerrainPipeline(terrain, shapedFeatures);

    expect(Array.from(a.heightmap.data)).toEqual(Array.from(b.heightmap.data));
    expect(a.lakeLevel === null).toBe(false);
    expect(b.lakeLevel === null).toBe(false);
    expect(Array.from(a.lakeLevel ?? [])).toEqual(Array.from(b.lakeLevel ?? []));
  });

  it('passes keep data finite and preserve heightmap size', () => {
    const passes: Array<(hm: Heightmap) => void> = [
      (hm) => smoothHeightmap(hm, 0.8),
      (hm) => applyValley(hm, 0.8),
      (hm) => applyCliffs(hm, 0.8),
      (hm) => carveRiver(hm, 0.8, 99),
    ];

    for (const pass of passes) {
      const hm = sampleHeightmap();
      pass(hm);
      expectFiniteAndSameSize(5, hm);
    }
  });

  it('computeLakeLevels marks wet cells above terrain and dry cells as NaN', () => {
    const hm = basinHeightmap();
    const levels = computeLakeLevels(hm);

    expect(levels.length).toBe(hm.data.length);
    for (let i = 0; i < levels.length; i++) {
      if (Number.isNaN(levels[i])) {
        expect(levels[i]).toBeNaN();
      } else {
        expect(levels[i]).toBeGreaterThanOrEqual(hm.data[i]);
      }
    }
    expect(levels[2 * hm.size + 2]).toBeGreaterThan(hm.data[2 * hm.size + 2]);
    expect(levels[0]).toBeNaN();
  });

  it('disabling shaping features returns the normalized base terrain', () => {
    const result = generateTerrainPipeline(terrain, disabledFeatures);
    const base = generateTerrain({
      seed: terrain.seed,
      sizeLevel: terrain.sizeLevel,
      roughness: terrain.roughness,
    });
    normalize01(base);

    expect(result.lakeLevel).toBeNull();
    expect(Array.from(result.heightmap.data)).toEqual(Array.from(base.data));
  });
});
