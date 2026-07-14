/**
 * Central parameter model — the single source of truth for a scene.
 *
 * The retro UI edits these params; the renderer reads them and (re)builds the
 * Three.js scene. Everything needed to reproduce a landscape lives here, so the
 * whole object round-trips cleanly to JSON for save/load.
 */

export type RenderMode = 'modern' | 'retro';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TerrainParams {
  /** Seed for the fractal generator; a given seed reproduces the landscape. */
  seed: number;
  /** Grid detail level: terrain edge length = 2^sizeLevel + 1. */
  sizeLevel: number;
  /** Fractal roughness (0 = smooth, 1 = very jagged). */
  roughness: number;
  /** Vertical exaggeration applied to the normalized heightfield. */
  verticalScale: number;
}

export interface CameraParams {
  /** Camera position in world units. */
  position: Vec3;
  /** Look-at target in world units. */
  target: Vec3;
  /** Bank / roll angle in degrees. */
  bank: number;
  /** Vertical field of view in degrees (the "lens"). */
  lens: number;
}

export interface SunParams {
  /** Compass direction of the sun in degrees (0 = +Z/north, clockwise). */
  azimuth: number;
  /** Height of the sun above the horizon in degrees (0..90). */
  elevation: number;
  /** Directional light intensity. */
  intensity: number;
  /** Sun/light color as a hex string. */
  color: string;
}

/**
 * Terrain feature levels expressed as fractions (0..1) of the terrain's height
 * range, so they stay meaningful regardless of vertical scale or seed.
 */
export interface LevelParams {
  /** Water surface height. Terrain below this is submerged. */
  lake: number;
  /** Upper bound of the beach band. */
  beach: number;
  /** Treeline: boundary between vegetated ground and bare rock. */
  tree: number;
  /** Snowline: above this, terrain is snow-capped. */
  snow: number;
}

export interface HazeParams {
  /** Haze strength (0 = clear, 1 = thick). */
  density: number;
  /** Haze color as a hex string (distant terrain fades toward this). */
  color: string;
}

export interface SkyParams {
  /** Zenith sky color. */
  topColor: string;
  /** Horizon sky color. */
  horizonColor: string;
  /** Cloud coverage (0 = clear, 1 = overcast). */
  cloudCover: number;
  /** Cloud color as a hex string. */
  cloudColor: string;
}

export interface SceneParams {
  terrain: TerrainParams;
  camera: CameraParams;
  sun: SunParams;
  levels: LevelParams;
  haze: HazeParams;
  sky: SkyParams;
  renderMode: RenderMode;
}

/** Terrain edge length (vertices per side) for a given detail level. */
export function terrainEdge(sizeLevel: number): number {
  return 2 ** sizeLevel + 1;
}

/** VistaPro-like starting scene. */
export function defaultSceneParams(): SceneParams {
  return {
    terrain: {
      seed: 12345,
      sizeLevel: 8,
      roughness: 0.5,
      verticalScale: 60,
    },
    camera: {
      position: { x: 40, y: 140, z: 300 },
      target: { x: 0, y: 10, z: -20 },
      bank: 0,
      lens: 50,
    },
    sun: {
      azimuth: 135,
      elevation: 35,
      intensity: 1.1,
      color: '#fff4e0',
    },
    levels: {
      lake: 0.28,
      beach: 0.32,
      tree: 0.62,
      snow: 0.82,
    },
    haze: {
      density: 0.35,
      color: '#b9c6d6',
    },
    sky: {
      topColor: '#2b5c9c',
      horizonColor: '#bcd0e6',
      cloudCover: 0.4,
      cloudColor: '#ffffff',
    },
    renderMode: 'modern',
  };
}
