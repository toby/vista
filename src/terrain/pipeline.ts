/**
 * Terrain generation pipeline with deterministic shaping passes.
 */
import type { TerrainParams, FeatureParams } from '../state/SceneParams';
import { generateTerrain } from './diamondSquare';
import type { Heightmap } from './heightmap';
import { normalize01 } from './heightmap';
import {
  applyCliffs,
  applyValley,
  carveRiver,
  computeLakeLevels,
  smoothHeightmap,
} from './passes';

export interface TerrainResult {
  heightmap: Heightmap;
  lakeLevel: Float32Array | null;
}

export function generateTerrainPipeline(
  terrain: TerrainParams,
  features: FeatureParams,
): TerrainResult {
  const hm = generateTerrain({
    seed: terrain.seed,
    sizeLevel: terrain.sizeLevel,
    roughness: terrain.roughness,
  });

  if (features.smooth > 0) smoothHeightmap(hm, features.smooth);
  if (features.valleyEnabled) applyValley(hm, features.valleyStrength);
  if (features.cliffsEnabled) applyCliffs(hm, features.cliffsStrength);
  if (features.riverEnabled) carveRiver(hm, features.riverStrength, terrain.seed);

  normalize01(hm);
  const lakeLevel = features.lakeEnabled ? computeLakeLevels(hm) : null;

  return { heightmap: hm, lakeLevel };
}
