/**
 * Scene save/load. Params serialize to a downloadable JSON file and load back
 * through a file picker. Loaded data is sanitized against the defaults so
 * missing or malformed fields never break the app.
 */
import {
  defaultSceneParams,
  type CameraEditMode,
  type CMapMode,
  type GraphicsMode,
  type QualityParams,
  type RenderMode,
  type SceneParams,
  type TextureQuality,
  type Vec3,
} from '../state/SceneParams';
import { downloadBlob } from './download';

export function saveScene(
  params: SceneParams,
  filename = 'vista-scene.json',
): void {
  const blob = new Blob([JSON.stringify(params, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, filename);
}

/** Open a file picker and resolve with sanitized params from the chosen JSON. */
export function loadSceneFile(): Promise<SceneParams> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(sanitizeParams(JSON.parse(String(reader.result))));
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Invalid scene file'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
      reader.readAsText(file);
    });
    input.click();
  });
}

type Raw = Record<string, unknown>;
const asObj = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {});
const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : d;
const vec = (v: unknown, d: Vec3): Vec3 => {
  const o = asObj(v);
  return { x: num(o.x, d.x), y: num(o.y, d.y), z: num(o.z, d.z) };
};

const POLY_VALUES: ReadonlyArray<QualityParams['poly']> = [1, 2, 4, 8];
const TEXTURE_VALUES: readonly TextureQuality[] = ['off', 'low', 'med', 'high'];
const CMAP_VALUES: readonly CMapMode[] = ['natural', 'contour'];
const EDITMODE_VALUES: readonly CameraEditMode[] = ['camera', 'target'];
const GRMODE_VALUES: readonly GraphicsMode[] = [
  'fit',
  '320x240',
  '640x480',
  '800x600',
  '1024x768',
];

const poly = (v: unknown, d: QualityParams['poly']): QualityParams['poly'] =>
  POLY_VALUES.includes(v as QualityParams['poly'])
    ? (v as QualityParams['poly'])
    : d;

/** Overlay a raw parsed object onto the defaults with per-field type checks. */
export function sanitizeParams(raw: unknown): SceneParams {
  const d = defaultSceneParams();
  const r = asObj(raw);
  const meta = asObj(r.meta);
  const terrain = asObj(r.terrain);
  const features = asObj(r.features);
  const camera = asObj(r.camera);
  const sun = asObj(r.sun);
  const levels = asObj(r.levels);
  const palette = asObj(r.palette);
  const quality = asObj(r.quality);
  const haze = asObj(r.haze);
  const sky = asObj(r.sky);
  const render = asObj(r.render);
  const mode: RenderMode = r.renderMode === 'retro' ? 'retro' : 'modern';

  return {
    meta: {
      name: str(meta.name, d.meta.name),
      location: str(meta.location, d.meta.location),
    },
    terrain: {
      seed: Math.trunc(num(terrain.seed, d.terrain.seed)),
      sizeLevel: Math.trunc(num(terrain.sizeLevel, d.terrain.sizeLevel)),
      roughness: num(terrain.roughness, d.terrain.roughness),
      verticalScale: num(terrain.verticalScale, d.terrain.verticalScale),
    },
    features: {
      lakeEnabled: bool(features.lakeEnabled, d.features.lakeEnabled),
      riverEnabled: bool(features.riverEnabled, d.features.riverEnabled),
      riverStrength: num(features.riverStrength, d.features.riverStrength),
      valleyEnabled: bool(features.valleyEnabled, d.features.valleyEnabled),
      valleyStrength: num(features.valleyStrength, d.features.valleyStrength),
      cliffsEnabled: bool(features.cliffsEnabled, d.features.cliffsEnabled),
      cliffsStrength: num(features.cliffsStrength, d.features.cliffsStrength),
      smooth: num(features.smooth, d.features.smooth),
      treesEnabled: bool(features.treesEnabled, d.features.treesEnabled),
      treeDensity: num(features.treeDensity, d.features.treeDensity),
      starsEnabled: bool(features.starsEnabled, d.features.starsEnabled),
      skyEnabled: bool(features.skyEnabled, d.features.skyEnabled),
      cloudsEnabled: bool(features.cloudsEnabled, d.features.cloudsEnabled),
      horizonEnabled: bool(features.horizonEnabled, d.features.horizonEnabled),
    },
    camera: {
      position: vec(camera.position, d.camera.position),
      target: vec(camera.target, d.camera.target),
      bank: num(camera.bank, d.camera.bank),
      lens: num(camera.lens, d.camera.lens),
      editMode: oneOf(camera.editMode, EDITMODE_VALUES, d.camera.editMode),
    },
    sun: {
      azimuth: num(sun.azimuth, d.sun.azimuth),
      elevation: num(sun.elevation, d.sun.elevation),
      intensity: num(sun.intensity, d.sun.intensity),
      color: str(sun.color, d.sun.color),
    },
    levels: {
      lake: num(levels.lake, d.levels.lake),
      beach: num(levels.beach, d.levels.beach),
      tree: num(levels.tree, d.levels.tree),
      snow: num(levels.snow, d.levels.snow),
    },
    palette: {
      sea: str(palette.sea, d.palette.sea),
      sand: str(palette.sand, d.palette.sand),
      grass: str(palette.grass, d.palette.grass),
      rock: str(palette.rock, d.palette.rock),
      snow: str(palette.snow, d.palette.snow),
      numColors: Math.trunc(num(palette.numColors, d.palette.numColors)),
      locked: bool(palette.locked, d.palette.locked),
      cmapMode: oneOf(palette.cmapMode, CMAP_VALUES, d.palette.cmapMode),
    },
    quality: {
      poly: poly(quality.poly, d.quality.poly),
      gshade: bool(quality.gshade, d.quality.gshade),
      bfcull: bool(quality.bfcull, d.quality.bfcull),
      blend: bool(quality.blend, d.quality.blend),
      dither: num(quality.dither, d.quality.dither),
      pDither: num(quality.pDither, d.quality.pDither),
      texture: oneOf(quality.texture, TEXTURE_VALUES, d.quality.texture),
      bound: bool(quality.bound, d.quality.bound),
    },
    haze: {
      density: num(haze.density, d.haze.density),
      color: str(haze.color, d.haze.color),
    },
    sky: {
      topColor: str(sky.topColor, d.sky.topColor),
      horizonColor: str(sky.horizonColor, d.sky.horizonColor),
      cloudCover: num(sky.cloudCover, d.sky.cloudCover),
      cloudColor: str(sky.cloudColor, d.sky.cloudColor),
    },
    render: {
      grMode: oneOf(render.grMode, GRMODE_VALUES, d.render.grMode),
      iq: num(render.iq, d.render.iq),
      showOverview: bool(render.showOverview, d.render.showOverview),
    },
    renderMode: mode,
  };
}
