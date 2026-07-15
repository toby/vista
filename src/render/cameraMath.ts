/**
 * Pure VistaPro-style camera orientation math helpers.
 *
 * These functions convert between camera/target points and Head/Pitch/Range
 * values without depending on Three.js runtime state.
 */

import type { Vec3 } from '../state/SceneParams';

const EPSILON = 1e-12;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export interface Orientation {
  /** Heading in degrees: bearing of the camera→target vector, 0 = +Z (north), clockwise, range (-180,180]. */
  head: number;
  /** Pitch in degrees: angle of the camera→target vector above horizontal; negative = looking down. */
  pitch: number;
  /** Range: Euclidean distance from camera to target (world units). */
  range: number;
}

export interface ViewDeltas {
  dx: number;
  dy: number;
  dz: number;
  dr: number;
}

/** Derive head/pitch/range from a camera position looking at a target. */
export function orientationFromView(position: Vec3, target: Vec3): Orientation {
  const deltas = viewDeltas(position, target);
  const head = normalizeHead(Math.atan2(deltas.dx, deltas.dz) * RAD_TO_DEG);
  const pitch = deltas.dr <= EPSILON ? 0 : Math.asin(deltas.dy / deltas.dr) * RAD_TO_DEG;

  return {
    head,
    pitch,
    range: deltas.dr,
  };
}

/** Camera→target deltas: dx/dy/dz = target - position, dr = range (distance). */
export function viewDeltas(position: Vec3, target: Vec3): ViewDeltas {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dz = target.z - position.z;

  return {
    dx,
    dy,
    dz,
    dr: Math.hypot(dx, dy, dz),
  };
}

/**
 * Given a fixed target and an orientation, compute the camera position
 * (camera sits at target minus the view direction times range).
 */
export function positionFromOrientation(target: Vec3, o: Orientation): Vec3 {
  if (Math.abs(o.range) <= EPSILON) {
    return { ...target };
  }

  const dir = directionFromOrientation(o);

  return {
    x: target.x - dir.x * o.range,
    y: target.y - dir.y * o.range,
    z: target.z - dir.z * o.range,
  };
}

/**
 * Given a fixed camera position and an orientation, compute the target
 * (target sits at position plus the view direction times range).
 */
export function targetFromOrientation(position: Vec3, o: Orientation): Vec3 {
  if (Math.abs(o.range) <= EPSILON) {
    return { ...position };
  }

  const dir = directionFromOrientation(o);

  return {
    x: position.x + dir.x * o.range,
    y: position.y + dir.y * o.range,
    z: position.z + dir.z * o.range,
  };
}

function directionFromOrientation(o: Orientation): Vec3 {
  const headRad = o.head * DEG_TO_RAD;
  const pitchRad = o.pitch * DEG_TO_RAD;
  const horiz = Math.cos(pitchRad);

  return {
    x: horiz * Math.sin(headRad),
    y: Math.sin(pitchRad),
    z: horiz * Math.cos(headRad),
  };
}

function normalizeHead(head: number): number {
  let normalized = ((head + 180) % 360 + 360) % 360 - 180;

  if (normalized <= -180) {
    normalized += 360;
  }

  return normalized;
}
