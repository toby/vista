/**
 * Elevation- and slope-based ground coloring, VistaPro style: as height rises the
 * terrain moves through sea → beach → grass → rock → snow, and steep slopes show
 * bare rock (cliffs). Colors are written as a per-vertex attribute so both the
 * modern and retro materials reuse them.
 */
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { Heightmap } from '../terrain/heightmap';
import type { LevelParams } from '../state/SceneParams';

const SEA = new Color('#35618f');
const SAND = new Color('#cbb888');
const GRASS = new Color('#4d7a39');
const ROCK = new Color('#786d5b');
const SNOW = new Color('#f2f5fb');

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Compute the ground color for a vertex from its normalized height (0..1) and
 * flatness (normal.y: 1 = flat, 0 = vertical). Writes into and returns `target`.
 */
export function colorForVertex(
  height: number,
  flatness: number,
  levels: LevelParams,
  target: Color,
): Color {
  const { lake, beach, tree, snow } = levels;

  // Progressive band blending: each step only advances once height crosses it.
  target.copy(SEA);
  target.lerp(SAND, smoothstep(lake, Math.max(lake + 0.001, beach), height));
  target.lerp(GRASS, smoothstep(beach, beach + (tree - beach) * 0.2, height));
  target.lerp(ROCK, smoothstep(tree - (tree - beach) * 0.1, tree, height));
  target.lerp(SNOW, smoothstep(snow - (snow - tree) * 0.2, snow, height));

  // Steep, non-submerged slopes expose rock; snow caps resist it somewhat.
  if (height > lake) {
    const steepness = 1 - smoothstep(0.72, 0.92, flatness);
    const snowFactor = height >= snow ? 0.35 : 1;
    target.lerp(ROCK, steepness * 0.85 * snowFactor);
  }

  return target;
}

/**
 * Compute and attach a per-vertex `color` attribute to the terrain geometry.
 * Vertex order matches the heightmap's row-major index.
 */
export function applyTerrainColors(
  geometry: BufferGeometry,
  heightmap: Heightmap,
  levels: LevelParams,
): void {
  const normals = geometry.getAttribute('normal');
  const count = heightmap.data.length;
  const colors = new Float32Array(count * 3);
  const c = new Color();

  for (let i = 0; i < count; i++) {
    const flatness = normals ? normals.getY(i) : 1;
    colorForVertex(heightmap.data[i], flatness, levels, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const existing = geometry.getAttribute('color') as
    | Float32BufferAttribute
    | undefined;
  if (existing && existing.count === count) {
    (existing.array as Float32Array).set(colors);
    existing.needsUpdate = true;
  } else {
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  }
}
