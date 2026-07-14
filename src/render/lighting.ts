/**
 * Sun lighting: a directional light positioned from azimuth/elevation, plus the
 * scene's hemisphere fill (owned by the renderer). Azimuth is a compass bearing
 * (0 = +Z/north, increasing clockwise toward +X/east); elevation is degrees
 * above the horizon.
 */
import {
  Color,
  DirectionalLight,
  MathUtils,
  type Scene,
  Vector3,
} from 'three';
import type { SunParams } from '../state/SceneParams';

export class Sun {
  readonly light: DirectionalLight;
  private readonly distance: number;

  constructor(distance = 2000) {
    this.distance = distance;
    this.light = new DirectionalLight(new Color('#fff4e0'), 1.1);
    this.light.target.position.set(0, 0, 0);
  }

  addTo(scene: Scene): void {
    scene.add(this.light);
    scene.add(this.light.target);
  }

  /** Update light direction, color, and intensity from sun params. */
  apply(params: SunParams): void {
    const az = MathUtils.degToRad(params.azimuth);
    const el = MathUtils.degToRad(Math.max(-5, Math.min(90, params.elevation)));
    const cosEl = Math.cos(el);
    const dir = new Vector3(
      Math.sin(az) * cosEl,
      Math.sin(el),
      Math.cos(az) * cosEl,
    );
    this.light.position.copy(dir.multiplyScalar(this.distance));
    this.light.color.set(params.color);
    this.light.intensity = params.intensity;
  }

  /** World-space direction pointing toward the sun (unit vector). */
  direction(params: SunParams): Vector3 {
    const az = MathUtils.degToRad(params.azimuth);
    const el = MathUtils.degToRad(Math.max(-5, Math.min(90, params.elevation)));
    const cosEl = Math.cos(el);
    return new Vector3(
      Math.sin(az) * cosEl,
      Math.sin(el),
      Math.cos(az) * cosEl,
    ).normalize();
  }

  dispose(): void {
    this.light.dispose();
  }
}
