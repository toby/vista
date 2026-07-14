/**
 * Water surface: a large horizontal plane at the lake level. Terrain below the
 * plane reads as submerged; terrain above pokes through as land, giving the
 * classic VistaPro sea/lake look. The plane extends well past the terrain so it
 * reaches the horizon haze.
 */
import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, type Scene } from 'three';
import { TERRAIN_WORLD_SIZE } from './TerrainMesh';
import type { SceneParams } from '../state/SceneParams';

export class Water {
  readonly mesh: Mesh;
  private readonly material: MeshStandardMaterial;

  constructor() {
    const geometry = new PlaneGeometry(
      TERRAIN_WORLD_SIZE * 12,
      TERRAIN_WORLD_SIZE * 12,
    );
    geometry.rotateX(-Math.PI / 2);
    this.material = new MeshStandardMaterial({
      color: new Color('#2a5d86'),
      transparent: true,
      opacity: 0.82,
      roughness: 0.15,
      metalness: 0.2,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 1;
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh);
  }

  /** Position the surface at lake level (a fraction of the terrain height). */
  apply(params: SceneParams): void {
    const y = params.levels.lake * params.terrain.verticalScale;
    this.mesh.position.y = y;
    this.mesh.visible = params.levels.lake > 0.001;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
