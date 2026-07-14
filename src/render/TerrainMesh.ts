/**
 * Builds a Three.js geometry from a heightmap: a centered grid on the XZ plane
 * with height along +Y. Coloring and materials are applied separately so the
 * same geometry works for both the modern and retro render modes.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
} from 'three';
import type { Heightmap } from '../terrain/heightmap';

/** World-space edge length of the terrain, independent of grid resolution. */
export const TERRAIN_WORLD_SIZE = 400;

export interface TerrainGeometryOptions {
  /** World edge length; defaults to TERRAIN_WORLD_SIZE. */
  worldSize?: number;
  /** Multiplier from normalized height (0..1) to world Y. */
  verticalScale: number;
}

export function buildTerrainGeometry(
  hm: Heightmap,
  opts: TerrainGeometryOptions,
): BufferGeometry {
  const size = hm.size;
  const worldSize = opts.worldSize ?? TERRAIN_WORLD_SIZE;
  const vScale = opts.verticalScale;
  const vertexCount = size * size;
  const inv = 1 / (size - 1);

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const wx = (x * inv - 0.5) * worldSize;
      const wz = (y * inv - 0.5) * worldSize;
      const wy = hm.data[i] * vScale;
      positions[i * 3] = wx;
      positions[i * 3 + 1] = wy;
      positions[i * 3 + 2] = wz;
      uvs[i * 2] = x * inv;
      uvs[i * 2 + 1] = y * inv;
    }
  }

  // Two triangles per grid cell, wound CCW so face normals point up (+Y).
  const quadCount = (size - 1) * (size - 1);
  const indices = new Uint32Array(quadCount * 6);
  let o = 0;
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const a = y * size + x;
      const b = a + 1;
      const c = a + size;
      const d = c + 1;
      indices[o++] = a;
      indices[o++] = c;
      indices[o++] = b;
      indices[o++] = b;
      indices[o++] = c;
      indices[o++] = d;
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geom.setIndex(new Uint32BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}
