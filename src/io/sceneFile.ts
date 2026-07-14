/**
 * Scene save/load. Params serialize to a downloadable JSON file and load back
 * through a file picker. Loaded data is sanitized against the defaults so
 * missing or malformed fields never break the app.
 */
import {
  defaultSceneParams,
  type RenderMode,
  type SceneParams,
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
const vec = (v: unknown, d: Vec3): Vec3 => {
  const o = asObj(v);
  return { x: num(o.x, d.x), y: num(o.y, d.y), z: num(o.z, d.z) };
};

/** Overlay a raw parsed object onto the defaults with per-field type checks. */
export function sanitizeParams(raw: unknown): SceneParams {
  const d = defaultSceneParams();
  const r = asObj(raw);
  const terrain = asObj(r.terrain);
  const camera = asObj(r.camera);
  const sun = asObj(r.sun);
  const levels = asObj(r.levels);
  const haze = asObj(r.haze);
  const sky = asObj(r.sky);
  const mode: RenderMode = r.renderMode === 'retro' ? 'retro' : 'modern';

  return {
    terrain: {
      seed: Math.trunc(num(terrain.seed, d.terrain.seed)),
      sizeLevel: Math.trunc(num(terrain.sizeLevel, d.terrain.sizeLevel)),
      roughness: num(terrain.roughness, d.terrain.roughness),
      verticalScale: num(terrain.verticalScale, d.terrain.verticalScale),
    },
    camera: {
      position: vec(camera.position, d.camera.position),
      target: vec(camera.target, d.camera.target),
      bank: num(camera.bank, d.camera.bank),
      lens: num(camera.lens, d.camera.lens),
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
    renderMode: mode,
  };
}
