/**
 * Elevation- and slope-based ground coloring, VistaPro style: as height rises the
 * terrain moves through sea → beach → grass → rock → snow, and steep slopes show
 * bare rock (cliffs). Colors are written as a per-vertex attribute so both the
 * modern and retro materials reuse them.
 *
 * The five band colors come from the editable palette (RGBPal); `numColors`
 * posterizes the ramp (NumClr), `cmapMode` switches natural vs banded contour
 * coloring (CMap), and `blend` toggles smooth vs hard-edged band transitions
 * (the Blend quality flag). When no palette is supplied the original defaults and
 * smooth blending are used, so existing callers/tests are unaffected.
 */
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { Heightmap } from '../terrain/heightmap';
import type {
  CMapMode,
  LevelParams,
  PaletteParams,
} from '../state/SceneParams';

const SEA = new Color('#35618f');
const SAND = new Color('#cbb888');
const GRASS = new Color('#4d7a39');
const ROCK = new Color('#786d5b');
const SNOW = new Color('#f2f5fb');

/** Palette resolved to three.js Colors + coloring options for the hot loop. */
export interface ResolvedPalette {
  sea: Color;
  sand: Color;
  grass: Color;
  rock: Color;
  snow: Color;
  /** Posterize the height ramp into this many bands; 0 = unquantized. */
  numColors: number;
  /** Natural bands or banded contour map. */
  cmapMode: CMapMode;
  /** Smooth band transitions (true) or hard-edged steps (false). */
  blend: boolean;
}

const DEFAULT_PALETTE: ResolvedPalette = {
  sea: SEA,
  sand: SAND,
  grass: GRASS,
  rock: ROCK,
  snow: SNOW,
  numColors: 0,
  cmapMode: 'natural',
  blend: true,
};

/** Build a ResolvedPalette (parsed Colors) from the serializable params. */
export function resolvePalette(
  p: PaletteParams,
  blend = true,
): ResolvedPalette {
  return {
    sea: new Color(p.sea),
    sand: new Color(p.sand),
    grass: new Color(p.grass),
    rock: new Color(p.rock),
    snow: new Color(p.snow),
    numColors: p.numColors,
    cmapMode: p.cmapMode,
    blend,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Hard step for posterized / non-blended bands: 0 below the midpoint, else 1. */
function hardstep(edge0: number, edge1: number, x: number): number {
  const mid = (edge0 + edge1) * 0.5;
  return x < mid ? 0 : 1;
}

/**
 * Compute the ground color for a vertex from its normalized height (0..1) and
 * flatness (normal.y: 1 = flat, 0 = vertical). Writes into and returns `target`.
 * An optional resolved palette overrides the default colors/quantization.
 */
export function colorForVertex(
  height: number,
  flatness: number,
  levels: LevelParams,
  target: Color,
  palette: ResolvedPalette = DEFAULT_PALETTE,
): Color {
  const { lake, beach, tree, snow } = levels;

  // Contour mode (or NumClr) posterizes height into flat bands before coloring.
  let h = height;
  const bands =
    palette.numColors > 0
      ? palette.numColors
      : palette.cmapMode === 'contour'
        ? 16
        : 0;
  if (bands > 1) {
    h = Math.round(height * (bands - 1)) / (bands - 1);
  }

  // Hard steps when blending is off or we're in contour mode; smooth otherwise.
  const stepped = !palette.blend || palette.cmapMode === 'contour';
  const step = stepped ? hardstep : smoothstep;

  // Progressive band blending: each step only advances once height crosses it.
  target.copy(palette.sea);
  target.lerp(palette.sand, step(lake, Math.max(lake + 0.001, beach), h));
  target.lerp(palette.grass, step(beach, beach + (tree - beach) * 0.2, h));
  target.lerp(palette.rock, step(tree - (tree - beach) * 0.1, tree, h));
  target.lerp(palette.snow, step(snow - (snow - tree) * 0.2, snow, h));

  // Steep, non-submerged slopes expose rock; snow caps resist it somewhat.
  if (h > lake) {
    const steepness = 1 - smoothstep(0.72, 0.92, flatness);
    const snowFactor = h >= snow ? 0.35 : 1;
    target.lerp(palette.rock, steepness * 0.85 * snowFactor);
  }

  return target;
}

/**
 * Compute and attach a per-vertex `color` attribute to the terrain geometry.
 * Vertex order matches the heightmap's row-major index. An optional palette
 * (with Blend flag) customizes the ramp; omitted → the original defaults.
 */
export function applyTerrainColors(
  geometry: BufferGeometry,
  heightmap: Heightmap,
  levels: LevelParams,
  palette?: PaletteParams,
  blend = true,
  lakeLevel?: Float32Array | null,
): void {
  const resolved = palette ? resolvePalette(palette, blend) : DEFAULT_PALETTE;
  const normals = geometry.getAttribute('normal');
  const count = heightmap.data.length;
  const colors = new Float32Array(count * 3);
  const c = new Color();

  for (let i = 0; i < count; i++) {
    const flatness = normals ? normals.getY(i) : 1;
    colorForVertex(heightmap.data[i], flatness, levels, c, resolved);

    // Local lakes: cells submerged under a filled basin read as water, tinted
    // deeper toward the sea color the further below the water line they sit.
    if (lakeLevel) {
      const w = lakeLevel[i];
      if (Number.isFinite(w) && w > heightmap.data[i]) {
        const depth = Math.min(1, (w - heightmap.data[i]) * 8);
        c.lerp(resolved.sea, 0.55 + 0.35 * depth);
      }
    }

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
