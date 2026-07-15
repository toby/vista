/**
 * Instanced tree scatterer for the terrain. Trees are rebuilt from the current
 * heightmap and scene parameters, placing simple low-poly trunks and foliage on
 * gentle land between the lake level and treeline.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  type Material,
  MeshStandardMaterial,
  Object3D,
  type Scene,
} from 'three';
import type { Heightmap } from '../terrain/heightmap';
import type { SceneParams } from '../state/SceneParams';
import { TERRAIN_WORLD_SIZE } from './TerrainMesh';

const MAX_TREES = 4000;
const MAX_SLOPE = 0.6;

export class Trees {
  readonly group: Object3D;
  private foliage?: InstancedMesh;
  private trunks?: InstancedMesh;

  constructor() {
    this.group = new Object3D();
    this.group.name = 'trees';
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  /** Rebuild tree instances for the current terrain + params. */
  update(heightmap: Heightmap, params: SceneParams): void {
    this.clearMeshes();

    if (!params.features.treesEnabled || params.features.treeDensity <= 0) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;

    const size = heightmap.size;
    if (size < 3) return;

    const lower = params.levels.lake + 0.006;
    const upper = params.levels.tree;
    if (lower >= upper) return;

    const density = clamp(params.features.treeDensity, 0, 1);
    const stride = this.strideFor(size);
    const candidates: TreeInstance[] = [];

    for (let y = 1; y < size - 1; y += stride) {
      for (let x = 1; x < size - 1; x += stride) {
        const height = heightmap.data[y * size + x];
        if (height <= lower || height >= upper) continue;
        if (this.slopeAt(heightmap, x, y, params.terrain.verticalScale) > MAX_SLOPE) {
          continue;
        }

        const random = randomCell(params.terrain.seed, x, y);
        if (random > density) continue;

        candidates.push(
          this.makeInstance(heightmap, params, x, y, stride, random),
        );
        if (candidates.length >= MAX_TREES) break;
      }
      if (candidates.length >= MAX_TREES) break;
    }

    this.buildMeshes(candidates);
  }

  dispose(): void {
    this.clearMeshes();
  }

  private strideFor(size: number): number {
    const interior = Math.max(1, size - 2);
    return Math.max(1, Math.ceil(Math.sqrt((interior * interior) / MAX_TREES)));
  }

  private slopeAt(
    heightmap: Heightmap,
    x: number,
    y: number,
    verticalScale: number,
  ): number {
    const size = heightmap.size;
    const cellWorldSize = TERRAIN_WORLD_SIZE / (size - 1);
    const data = heightmap.data;
    const dx =
      ((data[y * size + x + 1] - data[y * size + x - 1]) * verticalScale) /
      (cellWorldSize * 2);
    const dz =
      ((data[(y + 1) * size + x] - data[(y - 1) * size + x]) * verticalScale) /
      (cellWorldSize * 2);
    return Math.sqrt(dx * dx + dz * dz);
  }

  private makeInstance(
    heightmap: Heightmap,
    params: SceneParams,
    x: number,
    y: number,
    stride: number,
    random: number,
  ): TreeInstance {
    const size = heightmap.size;
    const cellWorldSize = TERRAIN_WORLD_SIZE / (size - 1);
    const jitterScale = Math.min(stride * cellWorldSize * 0.35, cellWorldSize * 2);
    const jx = (randomCell(params.terrain.seed + 17, x, y) - 0.5) * jitterScale;
    const jz = (randomCell(params.terrain.seed + 31, x, y) - 0.5) * jitterScale;
    const wx = (x / (size - 1) - 0.5) * TERRAIN_WORLD_SIZE + jx;
    const wz = (y / (size - 1) - 0.5) * TERRAIN_WORLD_SIZE + jz;
    const wy = heightmap.data[y * size + x] * params.terrain.verticalScale;
    const baseScale = clamp(2.2 + params.terrain.verticalScale * 0.025, 2.4, 4.2);
    const scale = baseScale * (0.75 + random * 0.55);
    return {
      x: wx,
      y: wy,
      z: wz,
      scale,
      rotation: randomCell(params.terrain.seed + 47, x, y) * Math.PI * 2,
    };
  }

  private buildMeshes(instances: TreeInstance[]): void {
    if (instances.length === 0) return;

    const foliageGeometry = new ConeGeometry(0.9, 2.8, 6);
    const trunkGeometry = new CylinderGeometry(0.16, 0.22, 1.5, 5);
    const foliageMaterial = new MeshStandardMaterial({
      color: '#2f6f2f',
      roughness: 0.9,
      metalness: 0,
    });
    const trunkMaterial = new MeshStandardMaterial({
      color: '#6b4425',
      roughness: 0.85,
      metalness: 0,
    });

    this.foliage = new InstancedMesh(
      foliageGeometry,
      foliageMaterial,
      instances.length,
    );
    this.trunks = new InstancedMesh(trunkGeometry, trunkMaterial, instances.length);
    this.foliage.name = 'tree-foliage';
    this.trunks.name = 'tree-trunks';
    this.foliage.count = instances.length;
    this.trunks.count = instances.length;

    const dummy = new Object3D();
    for (let i = 0; i < instances.length; i++) {
      const tree = instances[i];

      dummy.position.set(tree.x, tree.y + tree.scale * 2.15, tree.z);
      dummy.rotation.set(0, tree.rotation, 0);
      dummy.scale.set(tree.scale, tree.scale, tree.scale);
      dummy.updateMatrix();
      this.foliage.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tree.x, tree.y + tree.scale * 0.75, tree.z);
      dummy.rotation.set(0, tree.rotation, 0);
      dummy.scale.set(tree.scale, tree.scale, tree.scale);
      dummy.updateMatrix();
      this.trunks.setMatrixAt(i, dummy.matrix);
    }

    this.foliage.instanceMatrix.needsUpdate = true;
    this.trunks.instanceMatrix.needsUpdate = true;
    this.group.add(this.trunks, this.foliage);
  }

  private clearMeshes(): void {
    if (this.foliage) {
      this.group.remove(this.foliage);
      this.foliage.geometry.dispose();
      disposeMaterial(this.foliage.material);
      this.foliage = undefined;
    }
    if (this.trunks) {
      this.group.remove(this.trunks);
      this.trunks.geometry.dispose();
      disposeMaterial(this.trunks.material);
      this.trunks = undefined;
    }
  }
}

interface TreeInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
}

function randomCell(seed: number, x: number, y: number): number {
  let h = Math.imul(x ^ seed, 0x45d9f3b);
  h = Math.imul(h ^ y, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
    return;
  }
  material.dispose();
}
