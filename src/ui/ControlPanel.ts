/**
 * The retro VistaPro-style control panel. Builds grouped controls for every
 * scene parameter and binds them two-way to the store: edits patch the store
 * (the App reconciles the scene), and store changes refresh the widgets (so,
 * e.g., camera fields track mouse orbiting live).
 */
import type { App } from '../app';
import type { SceneParams } from '../state/SceneParams';
import { exportPng } from '../io/exportImage';
import { saveScene, loadSceneFile } from '../io/sceneFile';
import {
  button,
  colorField,
  group,
  numberField,
  selectField,
  slider,
  type Control,
} from './widgets';
import './retro.css';

export class ControlPanel {
  readonly el: HTMLElement;
  private readonly syncers: Array<(p: SceneParams) => void> = [];

  constructor(private readonly app: App) {
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
      '<span>VistaPro Web</span><span class="vp-sub">landscape generator</span>';
    panel.append(title);

    const scroll = document.createElement('div');
    scroll.className = 'vp-scroll';
    panel.append(scroll);

    scroll.append(
      this.terrainGroup(),
      this.cameraGroup(),
      this.sunGroup(),
      this.levelsGroup(),
      this.atmosphereGroup(),
      this.renderGroup(),
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

  // --- groups ---------------------------------------------------------------

  private terrainGroup(): HTMLElement {
    const g = group('Terrain');
    this.addNumber(g.body, {
      label: 'Seed',
      step: 1,
      get: (p) => p.terrain.seed,
      set: (v) => this.store.patch({ terrain: { seed: Math.trunc(v) } }),
    });
    const c = selectField({
      label: 'Detail',
      options: [
        { value: '6', label: '65 x 65' },
        { value: '7', label: '129 x 129' },
        { value: '8', label: '257 x 257' },
        { value: '9', label: '513 x 513' },
      ],
      onInput: (v) =>
        this.store.patch({ terrain: { sizeLevel: parseInt(v, 10) } }),
    });
    g.body.append(c.el);
    this.syncers.push((p) => c.set(String(p.terrain.sizeLevel)));

    this.addSlider(g.body, {
      label: 'Roughness',
      min: 0,
      max: 1,
      step: 0.01,
      get: (p) => p.terrain.roughness,
      set: (v) => this.store.patch({ terrain: { roughness: v } }),
    });
    this.addSlider(g.body, {
      label: 'Height',
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

  private cameraGroup(): HTMLElement {
    const g = group('Camera', true);
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    for (const a of axes) {
      this.addNumber(g.body, {
        label: `Pos ${a.toUpperCase()}`,
        step: 1,
        get: (p) => p.camera.position[a],
        set: (v) => this.store.patch({ camera: { position: { [a]: v } } }),
      });
    }
    for (const a of axes) {
      this.addNumber(g.body, {
        label: `Target ${a.toUpperCase()}`,
        step: 1,
        get: (p) => p.camera.target[a],
        set: (v) => this.store.patch({ camera: { target: { [a]: v } } }),
      });
    }
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
    return g.el;
  }

  private sunGroup(): HTMLElement {
    const g = group('Sun & Light');
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
        { key: 'lake', label: 'Water' },
        { key: 'beach', label: 'Beach' },
        { key: 'tree', label: 'Treeline' },
        { key: 'snow', label: 'Snowline' },
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

  private atmosphereGroup(): HTMLElement {
    const g = group('Atmosphere', true);
    this.addSlider(g.body, {
      label: 'Haze',
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

  private renderGroup(): HTMLElement {
    const g = group('Render');
    const c = selectField({
      label: 'Mode',
      options: [
        { value: 'modern', label: 'Modern (smooth)' },
        { value: 'retro', label: 'Retro (faceted)' },
      ],
      onInput: (v) =>
        this.store.patch({ renderMode: v === 'retro' ? 'retro' : 'modern' }),
    });
    g.body.append(c.el);
    this.syncers.push((p) => c.set(p.renderMode));
    return g.el;
  }

  private actionsGroup(): HTMLElement {
    const g = group('File');
    const actions = document.createElement('div');
    actions.className = 'vp-actions';
    actions.append(
      button({
        label: 'Export PNG',
        onClick: () => exportPng(this.app.renderer),
      }),
      button({
        label: 'Save Scene',
        onClick: () => saveScene(this.store.get()),
      }),
      button({
        label: 'Load Scene',
        wide: true,
        onClick: () => {
          loadSceneFile()
            .then((p) => this.store.set(p))
            .catch(() => undefined);
        },
      }),
    );
    g.body.append(actions);
    return g.el;
  }
}
