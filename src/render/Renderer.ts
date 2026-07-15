/**
 * Core Three.js engine: owns the renderer, scene, camera, the terrain mesh, the
 * animation loop, and resize handling. Feature subsystems (lighting, water, sky,
 * haze, camera rig, coloring, retro mode) attach to the exposed `scene`,
 * `camera`, and `terrainMesh`.
 */
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  Color,
  HemisphereLight,
  Material,
  Mesh,
  MeshStandardMaterial,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { CameraParams, GraphicsMode } from '../state/SceneParams';

export type FrameHook = (dtSeconds: number) => void;

const GR_MODE_SIZES: Record<Exclude<GraphicsMode, 'fit'>, [number, number]> = {
  '320x240': [320, 240],
  '640x480': [640, 480],
  '800x600': [800, 600],
  '1024x768': [1024, 768],
};

export class Renderer {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Soft sky/ground fill so terrain is visible before the sun is configured. */
  readonly hemisphere: HemisphereLight;

  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private terrain: Mesh | null = null;
  private defaultMaterial: MeshStandardMaterial;
  private frameHooks = new Set<FrameHook>();
  private rafId = 0;
  private lastTime = 0;
  private running = false;
  private grMode: GraphicsMode = 'fit';
  private iq = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new Scene();
    this.scene.background = new Color('#bcd0e6');

    this.camera = new PerspectiveCamera(55, 1, 0.1, 20000);
    this.camera.position.set(0, 90, 220);
    this.camera.lookAt(0, 20, 0);
    // Added to the scene so camera-attached objects (e.g. the sky dome) render.
    this.scene.add(this.camera);

    this.hemisphere = new HemisphereLight('#dff0ff', '#3a3326', 0.55);
    this.scene.add(this.hemisphere);

    this.defaultMaterial = new MeshStandardMaterial({
      color: 0x8a8a8a,
      roughness: 1,
      metalness: 0,
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  /** Replace the terrain geometry, reusing (or creating) the terrain mesh. */
  setTerrainGeometry(geometry: BufferGeometry): Mesh {
    if (this.terrain) {
      this.terrain.geometry.dispose();
      this.terrain.geometry = geometry;
    } else {
      this.terrain = new Mesh(geometry, this.defaultMaterial);
      this.terrain.name = 'terrain';
      this.scene.add(this.terrain);
    }
    return this.terrain;
  }

  /** Swap the terrain material (used by coloring and retro mode). */
  setTerrainMaterial(material: Material): void {
    if (this.terrain) {
      this.terrain.material = material;
    }
  }

  get terrainMesh(): Mesh | null {
    return this.terrain;
  }

  /** Apply camera params: position, target, field of view, and bank/roll. */
  applyCamera(params: CameraParams): void {
    const { position, target, lens, bank } = params;
    this.camera.fov = lens;
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(new Vector3(target.x, target.y, target.z));
    if (bank !== 0) {
      this.camera.rotateZ(MathUtils.degToRad(bank));
    }
    this.camera.updateProjectionMatrix();
  }

  addFrameHook(hook: FrameHook): () => void {
    this.frameHooks.add(hook);
    return () => {
      this.frameHooks.delete(hook);
    };
  }

  /**
   * Set the output resolution preset (GrMode) and image quality (IQ). `fit`
   * follows the viewport at IQ-scaled device pixels; presets render into a
   * fixed-size buffer that CSS scales to fill the viewport, for a chunkier,
   * period-accurate image.
   */
  setRenderConfig(grMode: GraphicsMode, iq: number): void {
    this.grMode = grMode;
    this.iq = Math.max(0.25, iq);
    this.resize();
  }

  resize(): void {
    const clientW = this.canvas.clientWidth || window.innerWidth;
    const clientH = this.canvas.clientHeight || window.innerHeight;
    if (this.grMode === 'fit') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio * this.iq, 4));
      this.renderer.setSize(clientW, clientH, false);
      this.camera.aspect = clientW / clientH;
    } else {
      const [w, h] = GR_MODE_SIZES[this.grMode];
      this.renderer.setPixelRatio(Math.min(this.iq, 4));
      // updateStyle=false keeps the CSS size at 100% so the buffer is scaled up.
      this.renderer.setSize(w, h, false);
      this.camera.aspect = clientW / clientH;
    }
    this.camera.updateProjectionMatrix();
  }

  renderOnce(): void {
    this.renderer.render(this.scene, this.camera);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (time: number): void => {
      if (!this.running) return;
      const dt = (time - this.lastTime) / 1000;
      this.lastTime = time;
      for (const hook of this.frameHooks) hook(dt);
      this.renderOnce();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.terrain?.geometry.dispose();
    this.defaultMaterial.dispose();
    this.renderer.dispose();
  }
}
