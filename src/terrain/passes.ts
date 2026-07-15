/**
 * Deterministic terrain-shaping passes over normalized heightmaps.
 */
import type { Heightmap } from './heightmap';
import { recomputeRange } from './heightmap';
import { mulberry32 } from './prng';

interface HeapNode {
  index: number;
  level: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampCoord(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** In-place separable box blur; amount 0..1 scales blur radius/iterations. */
export function smoothHeightmap(hm: Heightmap, amount: number): void {
  const strength = clamp01(amount);
  if (strength <= 0) return;

  const size = hm.size;
  const max = size - 1;
  const radius = Math.max(1, Math.round(strength * 3));
  const iterations = strength > 0.65 ? 2 : 1;
  const tmp = new Float32Array(hm.data.length);
  const src = hm.data;

  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let y = 0; y < size; y++) {
      const row = y * size;
      for (let x = 0; x < size; x++) {
        let sum = 0;
        let count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          sum += src[row + clampCoord(x + dx, max)];
          count++;
        }
        tmp[row + x] = sum / count;
      }
    }

    for (let y = 0; y < size; y++) {
      const row = y * size;
      for (let x = 0; x < size; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          sum += tmp[clampCoord(y + dy, max) * size + x];
          count++;
        }
        src[row + x] = clamp01(sum / count);
      }
    }
  }

  recomputeRange(hm);
}

/** Deepen valleys / keep ridges: bias low-mid heights downward. strength 0..1. */
export function applyValley(hm: Heightmap, strength: number): void {
  const s = clamp01(strength);
  if (s <= 0) return;

  const exponent = 1 + s * 1.5;
  for (let i = 0; i < hm.data.length; i++) {
    const h = clamp01(hm.data[i]);
    const valley = Math.pow(h, exponent);
    hm.data[i] = clamp01(h + (valley - h) * s);
  }

  recomputeRange(hm);
}

/** Sharpen steep gradients into cliff-like steps/terraces. strength 0..1. */
export function applyCliffs(hm: Heightmap, strength: number): void {
  const s = clamp01(strength);
  if (s <= 0) return;

  const size = hm.size;
  const max = size - 1;
  const original = new Float32Array(hm.data);
  const terraces = Math.max(4, Math.round(7 - s * 3));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const h = original[index];
      const left = original[y * size + clampCoord(x - 1, max)];
      const right = original[y * size + clampCoord(x + 1, max)];
      const up = original[clampCoord(y - 1, max) * size + x];
      const down = original[clampCoord(y + 1, max) * size + x];
      const slope = Math.hypot(right - left, down - up) * 0.5;
      const cliffWeight = smoothstep(0.035, 0.18, slope) * s;
      const terraced = Math.round(h * terraces) / terraces;
      const contrasted = clamp01(0.5 + (h - 0.5) * (1 + cliffWeight * 0.8));
      const shaped = contrasted + (terraced - contrasted) * (0.75 * cliffWeight);
      hm.data[index] = clamp01(h + (shaped - h) * cliffWeight);
    }
  }

  recomputeRange(hm);
}

/** Carve a downhill river channel from the highest cell following steepest
 *  descent; lowers a channel (and light banks). strength 0..1, seed deterministic. */
export function carveRiver(hm: Heightmap, strength: number, seed: number): void {
  const s = clamp01(strength);
  if (s <= 0) return;

  const size = hm.size;
  const max = size - 1;
  const rng = mulberry32(seed >>> 0);
  let current = 0;
  let high = -Infinity;

  for (let i = 0; i < hm.data.length; i++) {
    const h = hm.data[i];
    if (h > high || (h === high && rng() < 0.5)) {
      high = h;
      current = i;
    }
  }

  const steps = size * 2;
  const depth = 0.035 + s * 0.09;
  const visited = new Uint8Array(hm.data.length);

  for (let step = 0; step < steps; step++) {
    const x = current % size;
    const y = Math.floor(current / size);
    const progress = 1 - step / steps;
    carveAt(hm, x, y, depth * (0.65 + progress * 0.35) * s);

    if (x === 0 || y === 0 || x === max || y === max) break;
    visited[current] = 1;

    let next = current;
    let nextHeight = hm.data[current];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        const ni = ny * size + nx;
        const nh = hm.data[ni];
        if (visited[ni] === 0 && (nh < nextHeight || (nh === nextHeight && rng() < 0.5))) {
          next = ni;
          nextHeight = nh;
        }
      }
    }

    if (next === current) break;
    current = next;
  }

  recomputeRange(hm);
}

function carveAt(hm: Heightmap, x: number, y: number, depth: number): void {
  const size = hm.size;
  const max = size - 1;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = clampCoord(x + dx, max);
      const ny = clampCoord(y + dy, max);
      const distance = Math.hypot(dx, dy);
      const falloff = distance === 0 ? 1 : 0.35 / distance;
      const index = ny * size + nx;
      hm.data[index] = clamp01(hm.data[index] - depth * falloff);
    }
  }
}

/** Priority-flood: per-cell still-water level that fills enclosed basins up to
 *  their lowest rim (pour point). Returns Float32Array (size*size): water level
 *  (>= terrain) for submerged cells, NaN for dry cells. Does NOT modify hm. */
export function computeLakeLevels(hm: Heightmap): Float32Array {
  const size = hm.size;
  const total = hm.data.length;
  const visited = new Uint8Array(total);
  const levels = new Float32Array(total);
  const heap = new MinHeap();

  for (let x = 0; x < size; x++) {
    pushEdge(x, 0, hm, visited, levels, heap);
    pushEdge(x, size - 1, hm, visited, levels, heap);
  }
  for (let y = 1; y < size - 1; y++) {
    pushEdge(0, y, hm, visited, levels, heap);
    pushEdge(size - 1, y, hm, visited, levels, heap);
  }

  while (heap.length > 0) {
    const node = heap.pop();
    const x = node.index % size;
    const y = Math.floor(node.index / size);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (visited[ni] === 1) continue;
        visited[ni] = 1;
        const level = Math.max(hm.data[ni], node.level);
        levels[ni] = level;
        heap.push({ index: ni, level });
      }
    }
  }

  const result = new Float32Array(total);
  const epsilon = 1e-5;
  for (let i = 0; i < total; i++) {
    result[i] = levels[i] > hm.data[i] + epsilon ? levels[i] : Number.NaN;
  }
  return result;
}

function pushEdge(
  x: number,
  y: number,
  hm: Heightmap,
  visited: Uint8Array,
  levels: Float32Array,
  heap: MinHeap,
): void {
  const index = y * hm.size + x;
  if (visited[index] === 1) return;
  visited[index] = 1;
  levels[index] = hm.data[index];
  heap.push({ index, level: levels[index] });
}

class MinHeap {
  private readonly nodes: HeapNode[] = [];

  public get length(): number {
    return this.nodes.length;
  }

  public push(node: HeapNode): void {
    this.nodes.push(node);
    this.bubbleUp(this.nodes.length - 1);
  }

  public pop(): HeapNode {
    const first = this.nodes[0];
    const last = this.nodes.pop();
    if (last !== undefined && this.nodes.length > 0) {
      this.nodes[0] = last;
      this.sinkDown(0);
    }
    return first;
  }

  private bubbleUp(index: number): void {
    let child = index;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (this.nodes[parent].level <= this.nodes[child].level) break;
      this.swap(parent, child);
      child = parent;
    }
  }

  private sinkDown(index: number): void {
    let parent = index;
    while (true) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;
      if (left < this.nodes.length && this.nodes[left].level < this.nodes[smallest].level) {
        smallest = left;
      }
      if (right < this.nodes.length && this.nodes[right].level < this.nodes[smallest].level) {
        smallest = right;
      }
      if (smallest === parent) break;
      this.swap(parent, smallest);
      parent = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.nodes[a];
    this.nodes[a] = this.nodes[b];
    this.nodes[b] = tmp;
  }
}
