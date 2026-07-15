/**
 * The retro VistaPro-style control panel. Builds grouped controls for every
 * scene parameter and binds them two-way to the store: edits patch the store
 * (the App reconciles the scene), and store changes refresh the widgets (so,
 * e.g., camera fields track mouse orbiting live).
 */
import type { App } from '../app';
import {
  defaultSceneParams,
  type SceneParams,
  type TextureQuality,
} from '../state/SceneParams';
import { exportPng } from '../io/exportImage';
import { saveScene, loadSceneFile } from '../io/sceneFile';
import { importHeightmapFile } from '../io/importHeightmap';
import { exportObj } from '../io/exportMesh';
import { Flythrough, type CameraKeyframe } from '../io/script';
import {
  orientationFromView,
  positionFromOrientation,
  targetFromOrientation,
  viewDeltas,
  type Orientation,
} from '../render/cameraMath';
import {
  button,
  buttonGroup,
  colorField,
  group,
  numberField,
  readoutField,
  selectField,
  slider,
  toggle,
  type Control,
} from './widgets';
import './retro.css';

export class ControlPanel {
  readonly el: HTMLElement;
  private readonly syncers: Array<(p: SceneParams) => void> = [];
  private readonly flythrough: Flythrough;

  constructor(private readonly app: App) {
    this.flythrough = new Flythrough(app.store);
    this.el = this.build();
    app.store.subscribe((p) => this.sync(p));
    this.sync(app.store.get());
  }

  private get store() {
    return this.app.store;
  }

  private sync(p: SceneParams): void {
    for (const s of this.syncers) s(p);
  }

  private build(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'vp-panel';

    const title = document.createElement('div');
    title.className = 'vp-titlebar';
    title.innerHTML =
      '<span>Vista</span><span class="vp-sub">landscape generator</span>';
    panel.append(title);

    const scroll = document.createElement('div');
    scroll.className = 'vp-scroll';
    panel.append(scroll);

    scroll.append(
      this.workflowGroup(),
      this.terrainGroup(),
      this.featuresGroup(),
      this.cameraGroup(),
      this.sunGroup(),
      this.levelsGroup(),
      this.paletteGroup(),
      this.atmosphereGroup(),
      this.qualityGroup(),
      this.scalingGroup(),
      this.actionsGroup(),
    );
    return panel;
  }

  // --- binding helpers ------------------------------------------------------

  private addSlider(
    body: HTMLElement,
    o: {
      label: string;
      min: number;
      max: number;
      step: number;
      format?: (v: number) => string;
      get: (p: SceneParams) => number;
      set: (v: number) => void;
    },
  ): void {
    const c = slider({
      label: o.label,
      min: o.min,
      max: o.max,
      step: o.step,
      format: o.format,
      onInput: o.set,
    });
    body.append(c.el);
    this.syncers.push((p) => c.set(o.get(p)));
  }

  private addNumber(
    body: HTMLElement,
    o: {
      label: string;
      step?: number;
      get: (p: SceneParams) => number;
      set: (v: number) => void;
    },
  ): void {
    const c = numberField({ label: o.label, step: o.step, onInput: o.set });
    body.append(c.el);
    this.syncers.push((p) => c.set(o.get(p)));
  }

  private addColor(
    body: HTMLElement,
    o: {
      label: string;
      get: (p: SceneParams) => string;
      set: (v: string) => void;
    },
  ): void {
    const c: Control<string> = colorField({ label: o.label, onInput: o.set });
    body.append(c.el);
    this.syncers.push((p) => c.set(o.get(p)));
  }

  private addToggle(
    body: HTMLElement,
    o: {
      label: string;
      get: (p: SceneParams) => boolean;
      set: (v: boolean) => void;
    },
  ): void {
    const c = toggle({ label: o.label, onInput: o.set });
    body.append(c.el);
    this.syncers.push((p) => c.set(o.get(p)));
  }

  private addButtonGroup(
    body: HTMLElement,
    o: {
      label: string;
      options: ReadonlyArray<{ value: string; label: string }>;
      get: (p: SceneParams) => string;
      set: (v: string) => void;
    },
  ): void {
    const c = buttonGroup({
      label: o.label,
      options: o.options,
      onInput: o.set,
    });
    body.append(c.el);
    this.syncers.push((p) => c.set(o.get(p)));
  }

  private addReadout(
    body: HTMLElement,
    o: { label: string; get: (p: SceneParams) => string },
  ): void {
    const c = readoutField(o.label);
    body.append(c.el);
    this.syncers.push((p) => c.set(o.get(p)));
  }

  private addSelect(
    body: HTMLElement,
    o: {
      label: string;
      options: ReadonlyArray<{ value: string; label: string }>;
      get: (p: SceneParams) => string;
      set: (v: string) => void;
    },
  ): void {
    const c = selectField({
      label: o.label,
      options: o.options,
      onInput: o.set,
    });
    body.append(c.el);
    this.syncers.push((p) => c.set(o.get(p)));
  }

  // --- groups ---------------------------------------------------------------

  private workflowGroup(): HTMLElement {
    const g = group('Render');
    this.addReadout(g.body, {
      label: 'View',
      get: (p) => (p.render.showOverview ? 'Overview map' : '3-D render'),
    });
    this.addSelect(g.body, {
      label: 'GrMode',
      options: [
        { value: 'fit', label: 'Fit viewport' },
        { value: '320x240', label: '320 x 240' },
        { value: '640x480', label: '640 x 480' },
        { value: '800x600', label: '800 x 600' },
        { value: '1024x768', label: '1024 x 768' },
      ],
      get: (p) => p.render.grMode,
      set: (v) =>
        this.store.patch({ render: { grMode: v as SceneParams['render']['grMode'] } }),
    });
    this.addSlider(g.body, {
      label: 'IQ',
      min: 0.5,
      max: 3,
      step: 0.5,
      get: (p) => p.render.iq,
      set: (v) => this.store.patch({ render: { iq: v } }),
    });
    const actions = document.createElement('div');
    actions.className = 'vp-actions';
    actions.append(
      button({
        label: 'Render',
        primary: true,
        onClick: () => this.app.requestRender(),
      }),
      button({ label: 'ReDraw', onClick: () => this.app.reDraw() }),
      button({ label: 'View', onClick: () => this.app.toggleView() }),
    );
    g.body.append(actions);
    return g.el;
  }

  private terrainGroup(): HTMLElement {
    const g = group('Terrain');
    this.addNumber(g.body, {
      label: 'Seed',
      step: 1,
      get: (p) => p.terrain.seed,
      set: (v) => this.store.patch({ terrain: { seed: Math.trunc(v) } }),
    });
    this.addSelect(g.body, {
      label: 'Detail',
      options: [
        { value: '6', label: '65 x 65' },
        { value: '7', label: '129 x 129' },
        { value: '8', label: '257 x 257' },
        { value: '9', label: '513 x 513' },
      ],
      get: (p) => String(p.terrain.sizeLevel),
      set: (v) => this.store.patch({ terrain: { sizeLevel: parseInt(v, 10) } }),
    });
    this.addSlider(g.body, {
      label: 'Roughness',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.terrain.roughness,
      set: (v) => this.store.patch({ terrain: { roughness: v } }),
    });
    this.addSlider(g.body, {
      label: 'VScale',
      min: 5,
      max: 160,
      step: 1,
      get: (p) => p.terrain.verticalScale,
      set: (v) => this.store.patch({ terrain: { verticalScale: v } }),
    });
    g.body.append(
      button({
        label: 'New Landscape',
        wide: true,
        primary: true,
        onClick: () =>
          this.store.patch({
            terrain: { seed: Math.floor(Math.random() * 1_000_000_000) },
          }),
      }),
    );
    return g.el;
  }

  private featuresGroup(): HTMLElement {
    const g = group('Terrain Features');
    this.addToggle(g.body, {
      label: 'Lake',
      get: (p) => p.features.lakeEnabled,
      set: (v) => this.store.patch({ features: { lakeEnabled: v } }),
    });
    this.addToggle(g.body, {
      label: 'River',
      get: (p) => p.features.riverEnabled,
      set: (v) => this.store.patch({ features: { riverEnabled: v } }),
    });
    this.addSlider(g.body, {
      label: 'River Str',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.features.riverStrength,
      set: (v) => this.store.patch({ features: { riverStrength: v } }),
    });
    this.addToggle(g.body, {
      label: 'Valley',
      get: (p) => p.features.valleyEnabled,
      set: (v) => this.store.patch({ features: { valleyEnabled: v } }),
    });
    this.addSlider(g.body, {
      label: 'Valley Str',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.features.valleyStrength,
      set: (v) => this.store.patch({ features: { valleyStrength: v } }),
    });
    this.addToggle(g.body, {
      label: 'Cliffs',
      get: (p) => p.features.cliffsEnabled,
      set: (v) => this.store.patch({ features: { cliffsEnabled: v } }),
    });
    this.addSlider(g.body, {
      label: 'Cliffs Str',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.features.cliffsStrength,
      set: (v) => this.store.patch({ features: { cliffsStrength: v } }),
    });
    this.addSlider(g.body, {
      label: 'Smooth',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.features.smooth,
      set: (v) => this.store.patch({ features: { smooth: v } }),
    });
    this.addToggle(g.body, {
      label: 'Trees',
      get: (p) => p.features.treesEnabled,
      set: (v) => this.store.patch({ features: { treesEnabled: v } }),
    });
    this.addSlider(g.body, {
      label: 'Tree Dens',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.features.treeDensity,
      set: (v) => this.store.patch({ features: { treeDensity: v } }),
    });
    this.addToggle(g.body, {
      label: 'Stars',
      get: (p) => p.features.starsEnabled,
      set: (v) => this.store.patch({ features: { starsEnabled: v } }),
    });
    this.addToggle(g.body, {
      label: 'Sky',
      get: (p) => p.features.skyEnabled,
      set: (v) => this.store.patch({ features: { skyEnabled: v } }),
    });
    this.addToggle(g.body, {
      label: 'Clouds',
      get: (p) => p.features.cloudsEnabled,
      set: (v) => this.store.patch({ features: { cloudsEnabled: v } }),
    });
    this.addToggle(g.body, {
      label: 'Horizon',
      get: (p) => p.features.horizonEnabled,
      set: (v) => this.store.patch({ features: { horizonEnabled: v } }),
    });
    return g.el;
  }

  private cameraGroup(): HTMLElement {
    const g = group('Camera', true);
    this.addSelect(g.body, {
      label: 'Edit',
      options: [
        { value: 'camera', label: 'Camera' },
        { value: 'target', label: 'Target' },
      ],
      get: (p) => p.camera.editMode,
      set: (v) =>
        this.store.patch({
          camera: { editMode: v === 'target' ? 'target' : 'camera' },
        }),
    });
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    for (const a of axes) {
      this.addNumber(g.body, {
        label: `Cam ${a.toUpperCase()}`,
        step: 1,
        get: (p) => p.camera.position[a],
        set: (v) => this.store.patch({ camera: { position: { [a]: v } } }),
      });
    }
    for (const a of axes) {
      this.addNumber(g.body, {
        label: `Tgt ${a.toUpperCase()}`,
        step: 1,
        get: (p) => p.camera.target[a],
        set: (v) => this.store.patch({ camera: { target: { [a]: v } } }),
      });
    }
    this.addNumber(g.body, {
      label: 'Head',
      step: 1,
      get: (p) => orientationFromView(p.camera.position, p.camera.target).head,
      set: (v) => this.patchOrientation({ head: v }),
    });
    this.addNumber(g.body, {
      label: 'Pitch',
      step: 1,
      get: (p) => orientationFromView(p.camera.position, p.camera.target).pitch,
      set: (v) => this.patchOrientation({ pitch: v }),
    });
    this.addNumber(g.body, {
      label: 'Range',
      step: 1,
      get: (p) => orientationFromView(p.camera.position, p.camera.target).range,
      set: (v) => this.patchOrientation({ range: v }),
    });
    this.addSlider(g.body, {
      label: 'Bank',
      min: -180,
      max: 180,
      step: 1,
      get: (p) => p.camera.bank,
      set: (v) => this.store.patch({ camera: { bank: v } }),
    });
    this.addSlider(g.body, {
      label: 'Lens (FOV)',
      min: 20,
      max: 100,
      step: 1,
      get: (p) => p.camera.lens,
      set: (v) => this.store.patch({ camera: { lens: v } }),
    });
    const fmt = (n: number): string => n.toFixed(0);
    this.addReadout(g.body, {
      label: 'dX dY dZ',
      get: (p) => {
        const d = viewDeltas(p.camera.position, p.camera.target);
        return `${fmt(d.dx)}  ${fmt(d.dy)}  ${fmt(d.dz)}`;
      },
    });
    this.addReadout(g.body, {
      label: 'dR',
      get: (p) => fmt(viewDeltas(p.camera.position, p.camera.target).dr),
    });
    return g.el;
  }

  /** Apply a Head/Pitch/Range edit, moving the camera or the target per edit mode. */
  private patchOrientation(partial: Partial<Orientation>): void {
    const cam = this.store.get().camera;
    const current = orientationFromView(cam.position, cam.target);
    const next: Orientation = { ...current, ...partial };
    if (cam.editMode === 'target') {
      const target = targetFromOrientation(cam.position, next);
      this.store.patch({ camera: { target } });
    } else {
      const position = positionFromOrientation(cam.target, next);
      this.store.patch({ camera: { position } });
    }
  }

  private sunGroup(): HTMLElement {
    const g = group('Sun & Light', true);
    this.addSlider(g.body, {
      label: 'Azimuth',
      min: 0,
      max: 360,
      step: 1,
      get: (p) => p.sun.azimuth,
      set: (v) => this.store.patch({ sun: { azimuth: v } }),
    });
    this.addSlider(g.body, {
      label: 'Elevation',
      min: 0,
      max: 90,
      step: 1,
      get: (p) => p.sun.elevation,
      set: (v) => this.store.patch({ sun: { elevation: v } }),
    });
    this.addSlider(g.body, {
      label: 'Intensity',
      min: 0,
      max: 3,
      step: 0.05,
      get: (p) => p.sun.intensity,
      set: (v) => this.store.patch({ sun: { intensity: v } }),
    });
    this.addColor(g.body, {
      label: 'Color',
      get: (p) => p.sun.color,
      set: (v) => this.store.patch({ sun: { color: v } }),
    });
    return g.el;
  }

  private levelsGroup(): HTMLElement {
    const g = group('Terrain Levels');
    const levels: Array<{ key: 'lake' | 'beach' | 'tree' | 'snow'; label: string }> =
      [
        { key: 'lake', label: 'SeaLvl' },
        { key: 'beach', label: 'Beach' },
        { key: 'tree', label: 'TreeLn' },
        { key: 'snow', label: 'SnowLn' },
      ];
    for (const l of levels) {
      this.addSlider(g.body, {
        label: l.label,
        min: 0,
        max: 1,
        step: 0.01,
        get: (p) => p.levels[l.key],
        set: (v) => this.store.patch({ levels: { [l.key]: v } }),
      });
    }
    return g.el;
  }

  private paletteGroup(): HTMLElement {
    const g = group('Palette', true);
    const bands: Array<{ key: 'sea' | 'sand' | 'grass' | 'rock' | 'snow'; label: string }> =
      [
        { key: 'sea', label: 'Sea' },
        { key: 'sand', label: 'Beach' },
        { key: 'grass', label: 'Grass' },
        { key: 'rock', label: 'Rock' },
        { key: 'snow', label: 'Snow' },
      ];
    for (const b of bands) {
      this.addColor(g.body, {
        label: b.label,
        get: (p) => p.palette[b.key],
        set: (v) => this.store.patch({ palette: { [b.key]: v } }),
      });
    }
    this.addSlider(g.body, {
      label: 'NumClr',
      min: 0,
      max: 64,
      step: 1,
      format: (v) => (v === 0 ? 'full' : String(v)),
      get: (p) => p.palette.numColors,
      set: (v) => this.store.patch({ palette: { numColors: Math.trunc(v) } }),
    });
    this.addToggle(g.body, {
      label: 'LckPal',
      get: (p) => p.palette.locked,
      set: (v) => this.store.patch({ palette: { locked: v } }),
    });
    this.addSelect(g.body, {
      label: 'CMap',
      options: [
        { value: 'natural', label: 'Natural' },
        { value: 'contour', label: 'Contour' },
      ],
      get: (p) => p.palette.cmapMode,
      set: (v) =>
        this.store.patch({
          palette: { cmapMode: v === 'contour' ? 'contour' : 'natural' },
        }),
    });
    return g.el;
  }

  private atmosphereGroup(): HTMLElement {
    const g = group('Atmosphere', true);
    this.addSlider(g.body, {
      label: 'HazeDn',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.haze.density,
      set: (v) => this.store.patch({ haze: { density: v } }),
    });
    this.addColor(g.body, {
      label: 'Haze Color',
      get: (p) => p.haze.color,
      set: (v) => this.store.patch({ haze: { color: v } }),
    });
    this.addColor(g.body, {
      label: 'Sky Top',
      get: (p) => p.sky.topColor,
      set: (v) => this.store.patch({ sky: { topColor: v } }),
    });
    this.addColor(g.body, {
      label: 'Horizon',
      get: (p) => p.sky.horizonColor,
      set: (v) => this.store.patch({ sky: { horizonColor: v } }),
    });
    this.addSlider(g.body, {
      label: 'Clouds',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.sky.cloudCover,
      set: (v) => this.store.patch({ sky: { cloudCover: v } }),
    });
    this.addColor(g.body, {
      label: 'Cloud Color',
      get: (p) => p.sky.cloudColor,
      set: (v) => this.store.patch({ sky: { cloudColor: v } }),
    });
    return g.el;
  }

  private qualityGroup(): HTMLElement {
    const g = group('Render Quality', true);
    this.addSelect(g.body, {
      label: 'Mode',
      options: [
        { value: 'modern', label: 'Modern (smooth)' },
        { value: 'retro', label: 'Retro (faceted)' },
      ],
      get: (p) => p.renderMode,
      set: (v) =>
        this.store.patch({ renderMode: v === 'retro' ? 'retro' : 'modern' }),
    });
    this.addButtonGroup(g.body, {
      label: 'Poly',
      options: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '4', label: '4' },
        { value: '8', label: '8' },
      ],
      get: (p) => String(p.quality.poly),
      set: (v) => {
        const poly = parseInt(v, 10) as 1 | 2 | 4 | 8;
        this.store.patch({ quality: { poly } });
      },
    });
    this.addToggle(g.body, {
      label: 'GShade',
      get: (p) => p.quality.gshade,
      set: (v) => this.store.patch({ quality: { gshade: v } }),
    });
    this.addToggle(g.body, {
      label: 'BFCull',
      get: (p) => p.quality.bfcull,
      set: (v) => this.store.patch({ quality: { bfcull: v } }),
    });
    this.addToggle(g.body, {
      label: 'Blend',
      get: (p) => p.quality.blend,
      set: (v) => this.store.patch({ quality: { blend: v } }),
    });
    this.addSlider(g.body, {
      label: 'Dither',
      min: 0,
      max: 100,
      step: 1,
      get: (p) => p.quality.dither,
      set: (v) => this.store.patch({ quality: { dither: v } }),
    });
    this.addSlider(g.body, {
      label: 'PDithr',
      min: 0,
      max: 100,
      step: 1,
      get: (p) => p.quality.pDither,
      set: (v) => this.store.patch({ quality: { pDither: v } }),
    });
    this.addButtonGroup(g.body, {
      label: 'Texture',
      options: [
        { value: 'off', label: 'O' },
        { value: 'low', label: 'L' },
        { value: 'med', label: 'M' },
        { value: 'high', label: 'H' },
      ],
      get: (p) => p.quality.texture,
      set: (v) =>
        this.store.patch({ quality: { texture: v as TextureQuality } }),
    });
    this.addToggle(g.body, {
      label: 'Bound',
      get: (p) => p.quality.bound,
      set: (v) => this.store.patch({ quality: { bound: v } }),
    });
    return g.el;
  }

  private scalingGroup(): HTMLElement {
    const g = group('Scaling', true);
    const row = document.createElement('div');
    row.className = 'vp-actions';
    row.append(
      button({
        label: 'Enlarge',
        onClick: () => {
          const level = this.store.get().terrain.sizeLevel;
          this.store.patch({ terrain: { sizeLevel: Math.min(9, level + 1) } });
        },
      }),
      button({
        label: 'Shrink',
        onClick: () => {
          const level = this.store.get().terrain.sizeLevel;
          this.store.patch({ terrain: { sizeLevel: Math.max(6, level - 1) } });
        },
      }),
      button({
        label: 'Smooth',
        onClick: () => {
          const s = this.store.get().features.smooth;
          this.store.patch({ features: { smooth: Math.min(1, s + 0.2) } });
        },
      }),
    );
    g.body.append(row);
    return g.el;
  }

  private actionsGroup(): HTMLElement {
    const g = group('Project / File');
    const actions = document.createElement('div');
    actions.className = 'vp-actions';
    actions.append(
      button({
        label: 'New',
        onClick: () => this.store.set(defaultSceneParams()),
      }),
      button({
        label: 'Save',
        onClick: () => saveScene(this.store.get()),
      }),
      button({
        label: 'Load',
        onClick: () => {
          loadSceneFile()
            .then((p) => this.store.set(p))
            .catch(() => undefined);
        },
      }),
      button({
        label: 'Import DEM',
        onClick: () => {
          importHeightmapFile()
            .then((h) => this.app.applyImportedHeightmap(h.data, h.size))
            .catch(() => undefined);
        },
      }),
      button({
        label: 'Export PNG',
        onClick: () => exportPng(this.app.renderer),
      }),
      button({
        label: 'Export OBJ',
        onClick: () => {
          const geom = this.app.renderer.terrainMesh?.geometry;
          if (geom) exportObj(geom);
        },
      }),
      button({
        label: 'Fly',
        wide: true,
        onClick: () => this.startFlythrough(),
      }),
    );
    g.body.append(actions);
    return g.el;
  }

  /** Build a simple orbit path around the current target and play it. */
  private startFlythrough(): void {
    if (this.flythrough.running) {
      this.flythrough.stop();
      return;
    }
    const cam = this.store.get().camera;
    const t = cam.target;
    const dx = cam.position.x - t.x;
    const dz = cam.position.z - t.z;
    const radius = Math.hypot(dx, dz) || 200;
    const y = cam.position.y;
    const start = Math.atan2(dx, dz);
    const frames: CameraKeyframe[] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * Math.PI * 2;
      frames.push({
        position: {
          x: t.x + Math.sin(a) * radius,
          y,
          z: t.z + Math.cos(a) * radius,
        },
        target: { x: t.x, y: t.y, z: t.z },
        lens: cam.lens,
        bank: cam.bank,
      });
    }
    this.flythrough.play(frames, 1.2);
  }
}
