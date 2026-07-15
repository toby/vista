/**
 * Unit tests for pure VistaPro-style camera orientation math.
 */

import { describe, it, expect } from 'vitest';
import {
  orientationFromView,
  positionFromOrientation,
  targetFromOrientation,
  viewDeltas,
  type Orientation,
} from '../src/render/cameraMath';
import type { Vec3 } from '../src/state/SceneParams';

const TOLERANCE = 1e-6;

function expectVecClose(actual: Vec3, expected: Vec3): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.z).toBeCloseTo(expected.z, 6);
}

describe('cameraMath', () => {
  it('round-trips positions and targets through orientation', () => {
    const cases: Array<{ position: Vec3; target: Vec3 }> = [
      {
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 10 },
      },
      {
        position: { x: 4, y: 2, z: -3 },
        target: { x: -6, y: 9, z: 12 },
      },
      {
        position: { x: -100.5, y: 30.25, z: 44 },
        target: { x: 13, y: -5.75, z: -88 },
      },
      {
        position: { x: 7, y: 7, z: 7 },
        target: { x: 7, y: 7, z: 7 },
      },
    ];

    for (const { position, target } of cases) {
      const orientation = orientationFromView(position, target);

      expectVecClose(targetFromOrientation(position, orientation), target);
      expectVecClose(positionFromOrientation(target, orientation), position);
    }
  });

  it('reports known heading and pitch cases', () => {
    const camera = { x: 0, y: 0, z: 0 };

    expect(orientationFromView(camera, { x: 0, y: 0, z: 10 }).head).toBeCloseTo(0, 6);
    expect(orientationFromView(camera, { x: 10, y: 0, z: 0 }).head).toBeCloseTo(90, 6);
    expect(orientationFromView(camera, { x: 0, y: 10, z: 0 }).pitch).toBeGreaterThan(0);
    expect(orientationFromView(camera, { x: 0, y: -10, z: 0 }).pitch).toBeLessThan(0);
  });

  it('returns view deltas and distance', () => {
    const position = { x: 1, y: 2, z: 3 };
    const target = { x: 5, y: -4, z: 15 };
    const deltas = viewDeltas(position, target);

    expect(deltas.dx).toBe(4);
    expect(deltas.dy).toBe(-6);
    expect(deltas.dz).toBe(12);
    expect(deltas.dr).toBeCloseTo(14, 6);
  });

  it('returns anchor copies for zero-range reconstructs', () => {
    const anchor = { x: 3, y: 4, z: 5 };
    const orientation: Orientation = { head: 45, pitch: 30, range: 0 };

    expect(positionFromOrientation(anchor, orientation)).toEqual(anchor);
    expect(positionFromOrientation(anchor, orientation)).not.toBe(anchor);
    expect(targetFromOrientation(anchor, orientation)).toEqual(anchor);
    expect(targetFromOrientation(anchor, orientation)).not.toBe(anchor);
  });

  it('keeps heading normalized to (-180, 180]', () => {
    expect(orientationFromView({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }).head).toBeCloseTo(180, 6);
    expect(Math.abs(orientationFromView({ x: 0, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }).head)).toBeLessThanOrEqual(180 + TOLERANCE);
  });
});
