/**
 * Interactive camera rig built on OrbitControls, kept in two-way sync with the
 * camera params. Dragging/zooming writes position + target back into the store;
 * programmatic changes (UI edits, loaded scenes) are pushed in via
 * `syncFromParams`. Bank/roll is applied through the camera's up vector (a gesture
 * OrbitControls doesn't provide), and lens maps to field of view.
 */
import { MathUtils, type PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Store } from '../state/store';
import type { CameraParams, SceneParams } from '../state/SceneParams';

export class CameraRig {
  readonly controls: OrbitControls;
  private readonly camera: PerspectiveCamera;
  private readonly store: Store<SceneParams>;
  private applyingFromStore = false;

  constructor(
    camera: PerspectiveCamera,
    domElement: HTMLElement,
    store: Store<SceneParams>,
  ) {
    this.camera = camera;
    this.store = store;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 6000;

    this.syncFromParams(store.get().camera);
    this.controls.addEventListener('change', () => this.onControlsChange());
  }

  /** Advance damping; call once per frame. */
  update(): void {
    this.controls.update();
  }

  /** Push camera params into the live camera + controls (guarded). */
  syncFromParams(p: CameraParams): void {
    this.applyingFromStore = true;
    this.camera.fov = p.lens;
    this.camera.position.set(p.position.x, p.position.y, p.position.z);
    this.controls.target.set(p.target.x, p.target.y, p.target.z);
    this.camera.up.copy(this.bankedUp(p));
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.applyingFromStore = false;
  }

  private onControlsChange(): void {
    if (this.applyingFromStore) return;
    const cam = this.camera;
    const t = this.controls.target;
    this.store.patch({
      camera: {
        position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        target: { x: t.x, y: t.y, z: t.z },
      },
    });
  }

  /** World up rotated about the view axis by the bank angle. */
  private bankedUp(p: CameraParams): Vector3 {
    const up = new Vector3(0, 1, 0);
    if (p.bank === 0) return up;
    const viewDir = new Vector3(
      p.target.x - p.position.x,
      p.target.y - p.position.y,
      p.target.z - p.position.z,
    ).normalize();
    return up.applyAxisAngle(viewDir, MathUtils.degToRad(p.bank)).normalize();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
