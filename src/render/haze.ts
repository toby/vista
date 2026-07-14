/**
 * Atmospheric haze: exponential-squared distance fog that fades terrain and
 * water toward the haze color, the way VistaPro blends distant land into the
 * horizon. The sky dome opts out of fog, so haze color should sit close to the
 * sky's horizon color for a seamless join.
 */
import { Color, FogExp2, type Scene } from 'three';
import type { HazeParams } from '../state/SceneParams';

export class Haze {
  private readonly fog: FogExp2;

  constructor() {
    this.fog = new FogExp2(new Color('#b9c6d6'), 0.0004);
  }

  addTo(scene: Scene): void {
    scene.fog = this.fog;
  }

  /** Map haze density (0..1) to a usable fog density and update color. */
  apply(params: HazeParams): void {
    this.fog.color.set(params.color);
    this.fog.density = 0.00005 + Math.max(0, Math.min(1, params.density)) * 0.0021;
  }

  get color(): Color {
    return this.fog.color;
  }
}
