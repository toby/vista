/**
 * Central parameter model — the single source of truth for a scene.
 *
 * The retro UI edits these params; the renderer reads them and (re)builds the
 * Three.js scene. Everything needed to reproduce a landscape lives here, so the
 * whole object round-trips cleanly to JSON for save/load.
 */

export type RenderMode = 'modern' | 'retro';

/** Which point the numeric/Head-Pitch-Range edits move: the eye or the target. */
export type CameraEditMode = 'camera' | 'target';

/** Palette coloring style: natural elevation bands or banded contour map. */
export type CMapMode = 'natural' | 'contour';

/** Detail texture quality (VistaPro's Texture O/L/M/H). */
export type TextureQuality = 'off' | 'low' | 'med' | 'high';

/** Output resolution preset (VistaPro's GrMode). `fit` = follow the viewport. */
export type GraphicsMode = 'fit' | '320x240' | '640x480' | '800x600' | '1024x768';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectMeta {
  /** Project name. */
  name: string;
  /** Human label shown under the map (e.g. "Crater Lake, OR"). */
  location: string;
}

export interface TerrainParams {
  /** Seed for the fractal generator; a given seed reproduces the landscape. */
  seed: number;
  /** Grid detail level: terrain edge length = 2^sizeLevel + 1. */
  sizeLevel: number;
  /** Fractal roughness (0 = smooth, 1 = very jagged). */
  roughness: number;
  /** Vertical exaggeration applied to the normalized heightfield (VScale). */
  verticalScale: number;
}

/**
 * Terrain-shaping and scenery features. The shaping options (smooth, valley,
 * cliffs, river, lake) are deterministic post-passes over the generated
 * heightmap, so landscapes stay seed-reproducible and JSON-serializable. The
 * scenery options (trees, stars, sky, clouds, horizon) gate render subsystems.
 */
export interface FeatureParams {
  /** Fill enclosed basins with water up to their rim (local lakes). */
  lakeEnabled: boolean;
  /** Carve a downhill river channel from the high ground. */
  riverEnabled: boolean;
  /** River carving strength (0..1). */
  riverStrength: number;
  /** Bias the fractal toward carved valleys (hydraulic-style). */
  valleyEnabled: boolean;
  /** Valley biasing strength (0..1). */
  valleyStrength: number;
  /** Sharpen steep faces into cliffs. */
  cliffsEnabled: boolean;
  /** Cliff sharpening strength (0..1). */
  cliffsStrength: number;
  /** Heightmap smoothing amount (0 = none, 1 = heavy blur). */
  smooth: number;
  /** Scatter trees between the waterline and treeline on gentle slopes. */
  treesEnabled: boolean;
  /** Tree density (0..1). */
  treeDensity: number;
  /** Show a star field when the sky is dark. */
  starsEnabled: boolean;
  /** Render the sky dome + gradient. */
  skyEnabled: boolean;
  /** Render drifting clouds. */
  cloudsEnabled: boolean;
  /** Render the distant horizon haze band. */
  horizonEnabled: boolean;
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
  /** Whether Head/Pitch/Range + numeric edits move the camera or the target. */
  editMode: CameraEditMode;
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
  /** Water surface height (SeaLvl). Terrain below this is submerged. */
  lake: number;
  /** Upper bound of the beach band. */
  beach: number;
  /** Treeline (TreeLn): boundary between vegetated ground and bare rock. */
  tree: number;
  /** Snowline (SnowLn): above this, terrain is snow-capped. */
  snow: number;
}

/**
 * Elevation color ramp. The five band colors map onto the level bands
 * (sea → beach → grass → rock → snow) and are editable (RGBPal); `numColors`
 * posterizes the result (NumClr), `locked` keeps the palette across reseeds
 * (LckPal), and `cmapMode` switches between natural and contour coloring (CMap).
 */
export interface PaletteParams {
  sea: string;
  sand: string;
  grass: string;
  rock: string;
  snow: string;
  /** Quantization levels; 0 = unquantized (full color). */
  numColors: number;
  /** Keep the palette fixed when the terrain is reseeded. */
  locked: boolean;
  /** Natural bands or banded contour map. */
  cmapMode: CMapMode;
}

/**
 * Render-quality knobs mirroring VistaPro's lower panel. These drive material
 * and geometry configuration; most are most visible in retro mode.
 */
export interface QualityParams {
  /** Geometry detail stride: 1 = full, 2/4/8 = decimated (Poly). */
  poly: 1 | 2 | 4 | 8;
  /** Gouraud (smooth) shading vs faceted flat shading (GShade). */
  gshade: boolean;
  /** Backface culling (BFCull). */
  bfcull: boolean;
  /** Soft blending between color bands / surfaces (Blend). */
  blend: boolean;
  /** Ordered dither amount, 0..100 (Dither). */
  dither: number;
  /** Palette-space dither amount, 0..100 (PDithr). */
  pDither: number;
  /** Detail texture quality (Texture O/L/M/H). */
  texture: TextureQuality;
  /** Show the terrain bounding box (Bound). */
  bound: boolean;
}

export interface HazeParams {
  /** Haze strength (0 = clear, 1 = thick) — VistaPro's HazeDn. */
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

/**
 * Output/render-workflow settings: resolution preset (GrMode), image quality /
 * supersampling (IQ), and whether the fast top-down overview map is shown
 * instead of the rendered 3-D perspective.
 */
export interface RenderSettings {
  grMode: GraphicsMode;
  /** Supersample factor for the rendered image (1..4). */
  iq: number;
  /** True = show the 2-D overview map; false = show the 3-D render. */
  showOverview: boolean;
}

export interface SceneParams {
  meta: ProjectMeta;
  terrain: TerrainParams;
  features: FeatureParams;
  camera: CameraParams;
  sun: SunParams;
  levels: LevelParams;
  palette: PaletteParams;
  quality: QualityParams;
  haze: HazeParams;
  sky: SkyParams;
  render: RenderSettings;
  renderMode: RenderMode;
}

/** Terrain edge length (vertices per side) for a given detail level. */
export function terrainEdge(sizeLevel: number): number {
  return 2 ** sizeLevel + 1;
}

/** VistaPro-like starting scene. */
export function defaultSceneParams(): SceneParams {
  return {
    meta: {
      name: 'Untitled',
      location: 'Crater Lake, OR',
    },
    terrain: {
      seed: 12345,
      sizeLevel: 8,
      roughness: 0.5,
      verticalScale: 60,
    },
    features: {
      lakeEnabled: false,
      riverEnabled: false,
      riverStrength: 0.5,
      valleyEnabled: false,
      valleyStrength: 0.5,
      cliffsEnabled: false,
      cliffsStrength: 0.5,
      smooth: 0,
      treesEnabled: false,
      treeDensity: 0.5,
      starsEnabled: false,
      skyEnabled: true,
      cloudsEnabled: true,
      horizonEnabled: true,
    },
    camera: {
      position: { x: 40, y: 140, z: 300 },
      target: { x: 0, y: 10, z: -20 },
      bank: 0,
      lens: 50,
      editMode: 'camera',
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
    palette: {
      sea: '#35618f',
      sand: '#cbb888',
      grass: '#4d7a39',
      rock: '#786d5b',
      snow: '#f2f5fb',
      numColors: 0,
      locked: false,
      cmapMode: 'natural',
    },
    quality: {
      poly: 1,
      gshade: true,
      bfcull: false,
      blend: true,
      dither: 100,
      pDither: 0,
      texture: 'high',
      bound: false,
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
    render: {
      grMode: 'fit',
      iq: 1,
      showOverview: false,
    },
    renderMode: 'modern',
  };
}
