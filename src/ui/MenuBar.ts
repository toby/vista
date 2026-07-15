/**
 * Top menu bar matching VistaPro's chrome: Project · Load · Save · GrMode ·
 * Script · ImpExp · IQ. Each button triggers a store/app action; the visual
 * treatment is handled in retro.css. This complements the right-hand control
 * panel, which remains the detailed parameter surface.
 */
import type { App } from '../app';
import { defaultSceneParams, type GraphicsMode } from '../state/SceneParams';
import { saveScene, loadSceneFile } from '../io/sceneFile';
import { importHeightmapFile } from '../io/importHeightmap';
import { exportObj } from '../io/exportMesh';
import { exportPng } from '../io/exportImage';
import { Flythrough, type CameraKeyframe } from '../io/script';

/** Public project repository, opened by the GitHub menu button. */
const REPO_URL = 'https://github.com/toby/vista';

const GR_MODES: GraphicsMode[] = [
  'fit',
  '320x240',
  '640x480',
  '800x600',
  '1024x768',
];
const IQ_STEPS = [0.5, 1, 1.5, 2, 2.5, 3];

export class MenuBar {
  readonly el: HTMLElement;
  private readonly flythrough: Flythrough;

  constructor(private readonly app: App) {
    this.flythrough = new Flythrough(app.store);
    this.el = this.build();
  }

  private get store() {
    return this.app.store;
  }

  private build(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'vp-menubar';
    bar.append(
      this.item('Project', () => this.store.set(defaultSceneParams())),
      this.item('Load', () => {
        loadSceneFile()
          .then((p) => this.store.set(p))
          .catch(() => undefined);
      }),
      this.item('Save', () => saveScene(this.store.get())),
      this.item('GrMode', () => this.cycleGrMode()),
      this.item('Script', () => this.toggleScript()),
      this.item('ImpExp', () => this.impExp()),
      this.item('IQ', () => this.cycleIq()),
      this.item('GitHub', () => this.openRepo()),
    );
    return bar;
  }

  /** Open the project repository in a new tab. */
  private openRepo(): void {
    window.open(REPO_URL, '_blank', 'noopener,noreferrer');
  }

  private item(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'vp-menu-item';
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private cycleGrMode(): void {
    const cur = this.store.get().render.grMode;
    const next = GR_MODES[(GR_MODES.indexOf(cur) + 1) % GR_MODES.length];
    this.store.patch({ render: { grMode: next } });
  }

  private cycleIq(): void {
    const cur = this.store.get().render.iq;
    let idx = IQ_STEPS.findIndex((v) => v >= cur);
    idx = (idx + 1) % IQ_STEPS.length;
    this.store.patch({ render: { iq: IQ_STEPS[idx] } });
  }

  /** ImpExp: import a heightmap image, or export the mesh/PNG when held. */
  private impExp(): void {
    const choice = window.prompt(
      'ImpExp — type: dem (import), obj (export mesh), png (export image)',
      'dem',
    );
    if (!choice) return;
    const c = choice.trim().toLowerCase();
    if (c === 'obj') {
      const geom = this.app.renderer.terrainMesh?.geometry;
      if (geom) exportObj(geom);
    } else if (c === 'png') {
      exportPng(this.app.renderer);
    } else {
      importHeightmapFile()
        .then((h) => this.app.applyImportedHeightmap(h.data, h.size))
        .catch(() => undefined);
    }
  }

  private toggleScript(): void {
    if (this.flythrough.running) {
      this.flythrough.stop();
      return;
    }
    const cam = this.store.get().camera;
    const t = cam.target;
    const radius =
      Math.hypot(cam.position.x - t.x, cam.position.z - t.z) || 200;
    const y = cam.position.y;
    const start = Math.atan2(cam.position.x - t.x, cam.position.z - t.z);
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
