/**
 * Application wiring: owns the store, renderer, and feature subsystems, and keeps
 * the Three.js scene reconciled with the params. The UI only patches the store;
 * this class diffs each change and does the minimum work.
 *
 * Render workflow (VistaPro-style): a fast 2-D overview map is the default view.
 * Terrain edits keep the overview live but defer the expensive 3-D rebuild until
 * an explicit Render / ReDraw, at which point the perspective scene is shown.
 */
import {
  BoxHelper,
  type BufferGeometry,
  DoubleSide,
  FrontSide,
  MeshStandardMaterial,
  type Texture,
} from 'three';
import { Store } from './state/store';
import { defaultSceneParams, type SceneParams } from './state/SceneParams';
import { generateTerrainPipeline } from './terrain/pipeline';
import { computeLakeLevels } from './terrain/passes';
import { decimateHeightmap, recomputeRange, type Heightmap } from './terrain/heightmap';
import { buildTerrainGeometry } from './render/TerrainMesh';
import { applyTerrainColors } from './render/coloring';
import { Sun } from './render/lighting';
import { Water } from './render/water';
import { SkyDome } from './render/sky';
import { Haze } from './render/haze';
import { Trees } from './render/trees';
import { CameraRig } from './render/cameraRig';
import { OverviewMap } from './render/OverviewMap';
import { makeDetailTexture } from './render/detailTexture';
import { RetroTerrainMaterial } from './render/retro/retroMaterial';
import { Renderer } from './render/Renderer';

const eq = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export class App {
  readonly store: Store<SceneParams>;
  readonly renderer: Renderer;
  /** Full-resolution shaped heightmap (drives the overview + trees). */
  private master: Heightmap;
  /** Poly-decimated heightmap actually turned into 3-D geometry. */
  private renderHm: Heightmap;
  private lakeLevel: Float32Array | null = null;
  private geometry: BufferGeometry;
  private params: SceneParams;
  private readonly modernMaterial: MeshStandardMaterial;
  private readonly retroMaterial: RetroTerrainMaterial;
  private readonly sun: Sun;
  private readonly water: Water;
  private readonly sky: SkyDome;
  private readonly haze: Haze;
  private readonly trees: Trees;
  private readonly cameraRig: CameraRig;
  private readonly overview: OverviewMap;
  private boundHelper: BoxHelper | null = null;
  private detailTexture: Texture | null = null;

  private dirtyRegen = false;
  private dirtyGeometry = false;
  private dirtyRecolor = false;
  private dirtyTrees = false;
  private dirtyOverview = false;
  /** Force a 3-D rebuild + switch to the perspective view on the next frame. */
  private renderRequested = false;

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
    this.trees = new Trees();
    this.trees.addTo(this.renderer.scene);

    // Fast 2-D overview map, overlaid on the viewport and toggled with the 3-D view.
    this.overview = new OverviewMap(512);
    this.mountOverview(canvas);

    const result = generateTerrainPipeline(
      this.params.terrain,
      this.params.features,
    );
    this.master = result.heightmap;
    this.renderHm = this.buildRenderHeightmap();
    this.geometry = this.buildGeometry();
    this.recolor();
    this.updateTrees();
    this.applyAtmosphere();
    this.applyRenderMode();
    this.applyQuality();
    this.overview.draw(this.master, this.params);

    this.cameraRig = new CameraRig(
      this.renderer.camera,
      this.renderer.renderer.domElement,
      this.store,
    );

    this.renderer.setRenderConfig(this.params.render.grMode, this.params.render.iq);

    this.store.subscribe((next) => this.reconcile(next));
    this.renderer.addFrameHook((dt) => {
      this.processDirty();
      this.cameraRig.update();
      this.sky.update(dt);
    });
    this.updateView();
    this.renderer.renderOnce();
    this.renderer.start();
  }

  /** Place the overview canvas over the 3-D viewport (display-only). */
  private mountOverview(canvas: HTMLCanvasElement): void {
    const c = this.overview.canvas;
    c.className = 'vp-overview';
    c.style.cssText =
      'position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;' +
      'image-rendering:pixelated;background:#2a2f38;pointer-events:none;z-index:1';
    canvas.parentElement?.append(c);
  }

  /**
   * React to a param change. Cheap updates (atmosphere, quality, camera) run
   * immediately; expensive terrain work is flagged and coalesced per frame, and
   * the 3-D rebuild is deferred while the overview map is showing.
   */
  private reconcile(next: SceneParams): void {
    const prev = this.params;
    if (next === prev) return;
    this.params = next;

    const t = next.terrain;
    const pt = prev.terrain;
    const featuresChanged = !eq(prev.features, next.features);
    const regen =
      t.seed !== pt.seed ||
      t.sizeLevel !== pt.sizeLevel ||
      t.roughness !== pt.roughness ||
      featuresChanged;
    const polyChanged = prev.quality.poly !== next.quality.poly;
    const geometry = regen || polyChanged || t.verticalScale !== pt.verticalScale;
    const levelsChanged = !eq(prev.levels, next.levels);
    const paletteChanged = !eq(prev.palette, next.palette);
    const blendChanged = prev.quality.blend !== next.quality.blend;

    if (regen) this.dirtyRegen = true;
    if (geometry) this.dirtyGeometry = true;
    if (geometry || levelsChanged || paletteChanged || blendChanged) {
      this.dirtyRecolor = true;
    }
    if (regen || levelsChanged || !eq(prev.features, next.features)) {
      this.dirtyTrees = true;
    }
    // Anything that changes the map picture or the camera overlay redraws it.
    if (
      regen ||
      geometry ||
      levelsChanged ||
      paletteChanged ||
      !eq(prev.camera, next.camera)
    ) {
      this.dirtyOverview = true;
    }

    const atmosphere =
      geometry ||
      levelsChanged ||
      !eq(prev.sun, next.sun) ||
      !eq(prev.haze, next.haze) ||
      !eq(prev.sky, next.sky) ||
      featuresChanged;
    if (atmosphere) this.applyAtmosphere();
    if (prev.renderMode !== next.renderMode) this.applyRenderMode();
    if (!eq(prev.quality, next.quality)) this.applyQuality();
    if (prev.render.showOverview !== next.render.showOverview) this.updateView();
    if (
      prev.render.grMode !== next.render.grMode ||
      prev.render.iq !== next.render.iq
    ) {
      this.renderer.setRenderConfig(next.render.grMode, next.render.iq);
    }

    if (!this.cameraRig.writingToStore && !eq(prev.camera, next.camera)) {
      this.cameraRig.syncFromParams(next.camera);
    }
  }

  /** Apply pending work once per frame; defers the 3-D rebuild in overview mode. */
  private processDirty(): void {
    if (this.dirtyRegen) {
      const result = generateTerrainPipeline(
        this.params.terrain,
        this.params.features,
      );
      this.master = result.heightmap;
      this.dirtyRegen = false;
    }

    // The overview map is cheap and always kept current.
    if (this.dirtyOverview) {
      this.overview.draw(this.master, this.params);
      this.dirtyOverview = false;
    }

    // Expensive 3-D work is skipped while the overview is showing, unless an
    // explicit Render/ReDraw asked for it.
    const build = !this.params.render.showOverview || this.renderRequested;
    if (!build) return;

    if (this.dirtyGeometry) {
      this.renderHm = this.buildRenderHeightmap();
      this.geometry = this.buildGeometry();
      this.dirtyGeometry = false;
    }
    if (this.dirtyRecolor) {
      this.recolor();
      this.dirtyRecolor = false;
    }
    if (this.dirtyTrees) {
      this.updateTrees();
      this.dirtyTrees = false;
    }
    if (this.renderRequested) {
      this.renderRequested = false;
      if (this.params.render.showOverview) {
        this.store.patch({ render: { showOverview: false } });
      }
    }
  }

  /** Decimate the master heightmap by the Poly LOD factor for 3-D geometry. */
  private buildRenderHeightmap(): Heightmap {
    const hm = decimateHeightmap(this.master, this.params.quality.poly);
    this.lakeLevel = this.params.features.lakeEnabled
      ? computeLakeLevels(hm)
      : null;
    return hm;
  }

  private buildGeometry(): BufferGeometry {
    const geometry = buildTerrainGeometry(this.renderHm, {
      verticalScale: this.params.terrain.verticalScale,
    });
    this.renderer.setTerrainGeometry(geometry);
    this.boundHelper = null; // recreated lazily against the new mesh
    return geometry;
  }

  private recolor(): void {
    applyTerrainColors(
      this.geometry,
      this.renderHm,
      this.params.levels,
      this.params.palette,
      this.params.quality.blend,
      this.lakeLevel,
    );
  }

  private updateTrees(): void {
    this.trees.update(this.master, this.params);
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
    this.applyQuality();
  }

  /** Configure materials + helpers from the render-quality params. */
  private applyQuality(): void {
    const q = this.params.quality;
    const side = q.bfcull ? FrontSide : DoubleSide;

    // Gouraud (smooth) vs faceted flat shading + backface culling on the modern
    // material; the retro material is inherently faceted.
    this.modernMaterial.flatShading = !q.gshade;
    this.modernMaterial.side = side;
    this.retroMaterial.side = side;

    // Detail texture (Texture O/L/M/H) → bump map on the modern material.
    const wantTexture = q.texture;
    this.detailTexture?.dispose();
    this.detailTexture = makeDetailTexture(wantTexture);
    this.modernMaterial.bumpMap = this.detailTexture;
    this.modernMaterial.bumpScale = this.detailTexture ? 0.4 : 0;
    this.modernMaterial.needsUpdate = true;

    // Retro dither (Dither + PDithr) and posterization (NumClr).
    this.retroMaterial.setDither(((q.dither + q.pDither) / 100) * 0.12);
    this.retroMaterial.setColorLevels(
      this.params.palette.numColors > 0 ? this.params.palette.numColors : 6,
    );

    this.updateBound();
  }

  /** Show/hide the terrain bounding box (Bound). */
  private updateBound(): void {
    const mesh = this.renderer.terrainMesh;
    if (!mesh) return;
    if (this.params.quality.bound) {
      if (!this.boundHelper) {
        this.boundHelper = new BoxHelper(mesh, 0xffcc33);
        this.renderer.scene.add(this.boundHelper);
      }
      this.boundHelper.update();
      this.boundHelper.visible = true;
    } else if (this.boundHelper) {
      this.boundHelper.visible = false;
    }
  }

  /** Toggle the 2-D overview map vs the 3-D perspective view. */
  private updateView(): void {
    const showOverview = this.params.render.showOverview;
    this.overview.canvas.style.display = showOverview ? 'block' : 'none';
    if (!showOverview) {
      // Entering the 3-D view flushes any deferred rebuild.
      this.renderRequested = true;
    }
  }

  // --- render workflow actions (menu buttons) --------------------------------

  /** Render: build the 3-D scene from the current params and show it. */
  requestRender(): void {
    this.dirtyGeometry = true;
    this.dirtyRecolor = true;
    this.dirtyTrees = true;
    this.renderRequested = true;
    this.store.patch({ render: { showOverview: false } });
  }

  /** ReDraw: rebuild + refresh the current view. */
  reDraw(): void {
    this.dirtyRegen = true;
    this.dirtyGeometry = true;
    this.dirtyRecolor = true;
    this.dirtyTrees = true;
    this.dirtyOverview = true;
    this.renderRequested = !this.params.render.showOverview;
  }

  /** View: flip between the overview map and the 3-D render. */
  toggleView(): void {
    this.store.patch({
      render: { showOverview: !this.params.render.showOverview },
    });
  }

  /**
   * Replace the terrain with an imported heightmap (ImpExp). The map becomes the
   * live surface until the terrain is regenerated from parameters again.
   */
  applyImportedHeightmap(data: Float32Array, size: number): void {
    const hm: Heightmap = { size, data, min: 0, max: 1 };
    recomputeRange(hm);
    this.master = hm;
    this.dirtyGeometry = true;
    this.dirtyRecolor = true;
    this.dirtyTrees = true;
    this.dirtyOverview = true;
    this.renderRequested = true;
    this.store.patch({ render: { showOverview: false } });
  }

  /** Current full-resolution heightmap (used by height-aware subsystems). */
  get currentHeightmap(): Heightmap {
    return this.master;
  }
}
