/**
 * Application wiring: owns the store and the renderer, and rebuilds terrain from
 * params. Feature subsystems are attached here as they come online; the
 * integration phase adds regenerate/update flows, worker offloading, and error
 * handling on top of this skeleton.
 */
import { MeshStandardMaterial } from 'three';
import { Store } from './state/store';
import { defaultSceneParams, type SceneParams } from './state/SceneParams';
import { generateTerrain } from './terrain/diamondSquare';
import type { Heightmap } from './terrain/heightmap';
import { buildTerrainGeometry } from './render/TerrainMesh';
import { applyTerrainColors } from './render/coloring';
import { Sun } from './render/lighting';
import { Water } from './render/water';
import { Renderer } from './render/Renderer';

export class App {
  readonly store: Store<SceneParams>;
  readonly renderer: Renderer;
  private heightmap: Heightmap;
  private readonly modernMaterial: MeshStandardMaterial;
  private readonly sun: Sun;
  private readonly water: Water;

  constructor(canvas: HTMLCanvasElement) {
    this.store = new Store(defaultSceneParams());
    this.renderer = new Renderer(canvas);

    this.modernMaterial = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    });

    this.sun = new Sun();
    this.sun.addTo(this.renderer.scene);
    this.sun.apply(this.store.get().sun);

    this.water = new Water();
    this.water.addTo(this.renderer.scene);
    this.water.apply(this.store.get());

    this.heightmap = this.buildTerrain();
    this.renderer.applyCamera(this.store.get().camera);
    this.renderer.renderOnce();
    this.renderer.start();
  }

  /** Regenerate the heightmap and mesh from the current terrain params. */
  private buildTerrain(): Heightmap {
    const params = this.store.get();
    const hm = generateTerrain(params.terrain);
    const geometry = buildTerrainGeometry(hm, {
      verticalScale: params.terrain.verticalScale,
    });
    applyTerrainColors(geometry, hm, params.levels);
    this.renderer.setTerrainGeometry(geometry);
    this.renderer.setTerrainMaterial(this.modernMaterial);
    return hm;
  }

  /** Current heightmap (used by coloring and other height-aware subsystems). */
  get currentHeightmap(): Heightmap {
    return this.heightmap;
  }
}
