/**
 * Camera flythrough script runner. Keyframes are interpolated over time and
 * applied to the scene store as camera patches.
 */
import type { SceneParams, Vec3 } from '../state/SceneParams';
import type { Store } from '../state/store';

export interface CameraKeyframe {
  position: Vec3;
  target: Vec3;
  lens?: number;
  bank?: number;
}

interface ResolvedKeyframe {
  position: Vec3;
  target: Vec3;
  lens: number;
  bank: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

/** Plays a camera flythrough by interpolating between keyframes over time. */
export class Flythrough {
  private frameId: number | null = null;

  constructor(private readonly store: Store<SceneParams>) {}

  /** Animate through keyframes, secondsPerLeg between consecutive frames. */
  play(keyframes: CameraKeyframe[], secondsPerLeg: number): void {
    this.stop();
    if (keyframes.length === 0) {
      return;
    }

    const current = this.store.get().camera;
    const frames = keyframes.map((frame): ResolvedKeyframe => ({
      position: frame.position,
      target: frame.target,
      lens: frame.lens ?? current.lens,
      bank: frame.bank ?? current.bank,
    }));

    if (frames.length === 1 || secondsPerLeg <= 0) {
      this.patchCamera(frames[frames.length - 1]);
      return;
    }

    const start = performance.now();
    const legMs = secondsPerLeg * 1000;
    const animate = (now: number): void => {
      const elapsed = Math.max(0, now - start);
      const leg = Math.min(frames.length - 2, Math.floor(elapsed / legMs));
      const t = Math.min(1, (elapsed - leg * legMs) / legMs);
      const a = frames[leg];
      const b = frames[leg + 1];

      this.patchCamera({
        position: lerpVec(a.position, b.position, t),
        target: lerpVec(a.target, b.target, t),
        lens: lerp(a.lens, b.lens, t),
        bank: lerp(a.bank, b.bank, t),
      });

      if (elapsed >= legMs * (frames.length - 1)) {
        this.patchCamera(frames[frames.length - 1]);
        this.frameId = null;
        return;
      }
      this.frameId = requestAnimationFrame(animate);
    };

    this.frameId = requestAnimationFrame(animate);
  }

  stop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  get running(): boolean {
    return this.frameId !== null;
  }

  private patchCamera(frame: ResolvedKeyframe): void {
    this.store.patch({
      camera: {
        position: frame.position,
        target: frame.target,
        lens: frame.lens,
        bank: frame.bank,
      },
    });
  }
}
