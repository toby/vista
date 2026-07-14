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
import { SkyDome } from './render/sky';
import { Haze } from './render/haze';
import { Renderer } from './render/Renderer';

export class App {
  readonly store: Store<SceneParams>;
  readonly renderer: Renderer;
  private heightmap: Heightmap;
  private readonly modernMaterial: MeshStandardMaterial;
  private readonly sun: Sun;
  private readonly water: Water;
  private readonly sky: SkyDome;
  private readonly haze: Haze;

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
    this.water = new Water();
    this.water.addTo(this.renderer.scene);
    this.sky = new SkyDome(this.renderer.camera);
    this.haze = new Haze();
    this.haze.addTo(this.renderer.scene);

    this.heightmap = this.buildTerrain();
    this.applyAtmosphere();
    this.renderer.applyCamera(this.store.get().camera);
    this.renderer.addFrameHook((dt) => this.sky.update(dt));
    this.renderer.renderOnce();
    this.renderer.start();
  }

  /** Push sun, water, sky, and haze params into their subsystems. */
  private applyAtmosphere(): void {
    const params = this.store.get();
    this.sun.apply(params.sun);
    this.water.apply(params);
    this.sky.apply(params, this.sun.direction(params.sun));
    this.haze.apply(params.haze);
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
