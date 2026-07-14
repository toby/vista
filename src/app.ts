/**
 * Application wiring: owns the store and the renderer, and rebuilds terrain from
 * params. Feature subsystems are attached here as they come online; the
 * integration phase adds regenerate/update flows, worker offloading, and error
 * handling on top of this skeleton.
 */
import { Store } from './state/store';
import { defaultSceneParams, type SceneParams } from './state/SceneParams';
import { generateTerrain } from './terrain/diamondSquare';
import type { Heightmap } from './terrain/heightmap';
import { buildTerrainGeometry } from './render/TerrainMesh';
import { Renderer } from './render/Renderer';

export class App {
  readonly store: Store<SceneParams>;
  readonly renderer: Renderer;
  private heightmap: Heightmap;

  constructor(canvas: HTMLCanvasElement) {
    this.store = new Store(defaultSceneParams());
    this.renderer = new Renderer(canvas);

    this.heightmap = this.buildTerrain();
    this.renderer.applyCamera(this.store.get().camera);
    this.renderer.start();
  }

  /** Regenerate the heightmap and mesh from the current terrain params. */
  private buildTerrain(): Heightmap {
    const params = this.store.get();
    const hm = generateTerrain(params.terrain);
    const geometry = buildTerrainGeometry(hm, {
      verticalScale: params.terrain.verticalScale,
    });
    this.renderer.setTerrainGeometry(geometry);
    return hm;
  }

  /** Current heightmap (used by coloring and other height-aware subsystems). */
  get currentHeightmap(): Heightmap {
    return this.heightmap;
  }
}
