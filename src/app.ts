/**
 * Application wiring: owns the store, renderer, and feature subsystems, and keeps
 * the Three.js scene reconciled with the params. The UI only patches the store;
 * this class diffs each change and does the minimum work (regenerate terrain,
 * rebuild geometry, recolor, move the sun, resync the camera, swap render mode).
 */
import { type BufferGeometry, MeshStandardMaterial } from 'three';
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
import { CameraRig } from './render/cameraRig';
import { RetroTerrainMaterial } from './render/retro/retroMaterial';
import { Renderer } from './render/Renderer';

const eq = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export class App {
  readonly store: Store<SceneParams>;
  readonly renderer: Renderer;
  private heightmap: Heightmap;
  private geometry: BufferGeometry;
  private params: SceneParams;
  private readonly modernMaterial: MeshStandardMaterial;
  private readonly retroMaterial: RetroTerrainMaterial;
  private readonly sun: Sun;
  private readonly water: Water;
  private readonly sky: SkyDome;
  private readonly haze: Haze;
  private readonly cameraRig: CameraRig;

  constructor(canvas: HTMLCanvasElement) {
    this.store = new Store(defaultSceneParams());
    this.params = this.store.get();
    this.renderer = new Renderer(canvas);

    this.modernMaterial = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    });
    this.retroMaterial = new RetroTerrainMaterial();

    this.sun = new Sun();
    this.sun.addTo(this.renderer.scene);
    this.water = new Water();
    this.water.addTo(this.renderer.scene);
    this.sky = new SkyDome(this.renderer.camera);
    this.haze = new Haze();
    this.haze.addTo(this.renderer.scene);

    this.heightmap = generateTerrain(this.params.terrain);
    this.geometry = this.buildGeometry();
    this.recolor();
    this.applyAtmosphere();
    this.applyRenderMode();

    this.cameraRig = new CameraRig(
      this.renderer.camera,
      this.renderer.renderer.domElement,
      this.store,
    );

    this.store.subscribe((next) => this.reconcile(next));
    this.renderer.addFrameHook((dt) => {
      this.cameraRig.update();
      this.sky.update(dt);
    });
    this.renderer.renderOnce();
    this.renderer.start();
  }

  /** React to a param change with the minimum necessary scene updates. */
  private reconcile(next: SceneParams): void {
    const prev = this.params;
    if (next === prev) return;
    this.params = next;

    const t = next.terrain;
    const pt = prev.terrain;
    const needRegen =
      t.seed !== pt.seed ||
      t.sizeLevel !== pt.sizeLevel ||
      t.roughness !== pt.roughness;
    const needGeometry = needRegen || t.verticalScale !== pt.verticalScale;
    const levelsChanged = !eq(prev.levels, next.levels);
    const needRecolor = needGeometry || levelsChanged;
    const needAtmosphere =
      needGeometry ||
      levelsChanged ||
      !eq(prev.sun, next.sun) ||
      !eq(prev.haze, next.haze) ||
      !eq(prev.sky, next.sky);

    if (needRegen) this.heightmap = generateTerrain(t);
    if (needGeometry) this.geometry = this.buildGeometry();
    if (needRecolor) this.recolor();
    if (needAtmosphere) this.applyAtmosphere();
    if (prev.renderMode !== next.renderMode) this.applyRenderMode();
    if (!this.cameraRig.writingToStore && !eq(prev.camera, next.camera)) {
      this.cameraRig.syncFromParams(next.camera);
    }
  }

  private buildGeometry(): BufferGeometry {
    const geometry = buildTerrainGeometry(this.heightmap, {
      verticalScale: this.params.terrain.verticalScale,
    });
    this.renderer.setTerrainGeometry(geometry);
    return geometry;
  }

  private recolor(): void {
    applyTerrainColors(this.geometry, this.heightmap, this.params.levels);
  }

  /** Push sun, water, sky, and haze params into their subsystems. */
  private applyAtmosphere(): void {
    const p = this.params;
    const sunDir = this.sun.direction(p.sun);
    this.sun.apply(p.sun);
    this.water.apply(p);
    this.sky.apply(p, sunDir);
    this.haze.apply(p.haze);
    this.retroMaterial.apply(p.sun, sunDir);
  }

  /** Select the terrain material for the current render mode (modern/retro). */
  private applyRenderMode(): void {
    const material =
      this.params.renderMode === 'retro'
        ? this.retroMaterial
        : this.modernMaterial;
    this.renderer.setTerrainMaterial(material);
  }

  /** Current heightmap (used by height-aware subsystems). */
  get currentHeightmap(): Heightmap {
    return this.heightmap;
  }
}
