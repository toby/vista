/**
 * Fast top-down overview map rendered to a 2-D canvas.
 *
 * The map uses terrain grid +Y as world +Z and draws that axis downward on the
 * canvas, matching conventional map/image coordinates while preserving the XZ
 * plane mapping used by the Three.js terrain mesh.
 */
import type { Heightmap } from '../terrain/heightmap';
import type { SceneParams } from '../state/SceneParams';

const TERRAIN_WORLD_SIZE = 400;
const DEFAULT_SIZE = 512;
const CAMERA_COLOR = 'rgba(255, 245, 180, 0.95)';
const CAMERA_STROKE = 'rgba(255, 245, 180, 0.65)';
const TARGET_COLOR = 'rgba(255, 255, 255, 0.95)';

type Rgb = readonly [number, number, number];

export class OverviewMap {
  readonly canvas: HTMLCanvasElement;

  private readonly sourceCanvas: HTMLCanvasElement;
  private readonly sourceContext: CanvasRenderingContext2D;
  private readonly context: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;

  /** @param size pixel resolution of the (square) map canvas (default 512). */
  constructor(size = DEFAULT_SIZE) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;

    this.sourceCanvas = document.createElement('canvas');
    const sourceContext = this.sourceCanvas.getContext('2d');
    const context = this.canvas.getContext('2d');
    if (!sourceContext || !context) {
      throw new Error('OverviewMap requires a 2-D canvas context.');
    }
    this.sourceContext = sourceContext;
    this.context = context;
    this.context.imageSmoothingEnabled = false;
  }

  /** Redraw the elevation map and camera overlay. */
  draw(heightmap: Heightmap, params: SceneParams): void {
    this.drawElevation(heightmap, params);
    this.drawCameraOverlay(params);
  }

  private drawElevation(heightmap: Heightmap, params: SceneParams): void {
    const size = heightmap.size;
    if (this.sourceCanvas.width !== size || this.sourceCanvas.height !== size) {
      this.sourceCanvas.width = size;
      this.sourceCanvas.height = size;
      this.imageData = null;
    }

    const imageData = this.getImageData(size);
    const pixels = imageData.data;
    const colors = this.paletteColors(params);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x;
        const height = this.quantizedHeight(heightmap.data[index], params.palette.numColors);
        const color = colors[this.elevationBand(height, params)];
        const edge = params.palette.cmapMode === 'contour'
          && this.isContourEdge(heightmap, x, y, params);
        const shade = edge ? 0.55 : 1;
        const pixel = index * 4;
        pixels[pixel] = Math.round(color[0] * shade);
        pixels[pixel + 1] = Math.round(color[1] * shade);
        pixels[pixel + 2] = Math.round(color[2] * shade);
        pixels[pixel + 3] = 255;
      }
    }

    this.sourceContext.putImageData(imageData, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(
      this.sourceCanvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
  }

  private drawCameraOverlay(params: SceneParams): void {
    const camera = this.worldToCanvas(params.camera.position.x, params.camera.position.z);
    const target = this.worldToCanvas(params.camera.target.x, params.camera.target.z);
    const heading = Math.atan2(target.y - camera.y, target.x - camera.x);
    const halfLens = (params.camera.lens * Math.PI) / 360;

    this.context.save();
    this.context.lineWidth = 1.5;
    this.context.strokeStyle = CAMERA_STROKE;
    this.context.fillStyle = CAMERA_COLOR;

    this.drawFrustumLine(camera.x, camera.y, heading - halfLens);
    this.drawFrustumLine(camera.x, camera.y, heading + halfLens);

    this.context.beginPath();
    this.context.arc(camera.x, camera.y, 4, 0, Math.PI * 2);
    this.context.fill();
    this.context.stroke();

    this.context.strokeStyle = TARGET_COLOR;
    this.context.beginPath();
    this.context.rect(target.x - 4, target.y - 4, 8, 8);
    this.context.moveTo(target.x - 7, target.y);
    this.context.lineTo(target.x + 7, target.y);
    this.context.moveTo(target.x, target.y - 7);
    this.context.lineTo(target.x, target.y + 7);
    this.context.stroke();
    this.context.restore();
  }

  private drawFrustumLine(x: number, y: number, angle: number): void {
    const end = this.edgePoint(x, y, Math.cos(angle), Math.sin(angle));
    this.context.beginPath();
    this.context.moveTo(x, y);
    this.context.lineTo(end.x, end.y);
    this.context.stroke();
  }

  private edgePoint(
    x: number,
    y: number,
    dx: number,
    dy: number,
  ): { x: number; y: number } {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const epsilon = 1e-6;
    let bestDistance = Infinity;

    if (Math.abs(dx) > epsilon) {
      bestDistance = this.edgeDistance(x, y, dx, dy, 0, height, bestDistance);
      bestDistance = this.edgeDistance(x, y, dx, dy, width, height, bestDistance);
    }
    if (Math.abs(dy) > epsilon) {
      bestDistance = this.edgeDistance(y, x, dy, dx, 0, width, bestDistance);
      bestDistance = this.edgeDistance(y, x, dy, dx, height, width, bestDistance);
    }

    if (!Number.isFinite(bestDistance)) {
      bestDistance = 0;
    }

    return {
      x: this.clamp(x + dx * bestDistance, 0, width),
      y: this.clamp(y + dy * bestDistance, 0, height),
    };
  }

  private edgeDistance(
    origin: number,
    crossOrigin: number,
    direction: number,
    crossDirection: number,
    edge: number,
    crossLimit: number,
    bestDistance: number,
  ): number {
    const distance = (edge - origin) / direction;
    if (distance <= 1e-6 || distance >= bestDistance) return bestDistance;

    const cross = crossOrigin + crossDirection * distance;
    if (cross < -1e-6 || cross > crossLimit + 1e-6) return bestDistance;
    return distance;
  }

  private worldToCanvas(worldX: number, worldZ: number): { x: number; y: number } {
    return {
      x: (worldX / TERRAIN_WORLD_SIZE + 0.5) * this.canvas.width,
      y: (worldZ / TERRAIN_WORLD_SIZE + 0.5) * this.canvas.height,
    };
  }

  private getImageData(size: number): ImageData {
    if (!this.imageData || this.imageData.width !== size || this.imageData.height !== size) {
      this.imageData = this.sourceContext.createImageData(size, size);
    }
    return this.imageData;
  }

  private paletteColors(params: SceneParams): readonly Rgb[] {
    return [
      this.parseHexColor(params.palette.sea),
      this.parseHexColor(params.palette.sand),
      this.parseHexColor(params.palette.grass),
      this.parseHexColor(params.palette.rock),
      this.parseHexColor(params.palette.snow),
    ];
  }

  private parseHexColor(hex: string): Rgb {
    const normalized = hex.trim().replace(/^#/, '');
    const expanded = normalized.length === 3
      ? normalized.split('').map((char) => char + char).join('')
      : normalized;
    const value = Number.parseInt(expanded, 16);
    if (expanded.length !== 6 || Number.isNaN(value)) {
      return [255, 255, 255];
    }
    return [
      (value >> 16) & 255,
      (value >> 8) & 255,
      value & 255,
    ];
  }

  private quantizedHeight(height: number, numColors: number): number {
    const clamped = this.clamp(height, 0, 1);
    const bands = Math.floor(numColors);
    if (bands <= 0) return clamped;
    if (bands === 1) return 0;
    return Math.min(Math.floor(clamped * bands), bands - 1) / (bands - 1);
  }

  private elevationBand(height: number, params: SceneParams): number {
    if (height < params.levels.lake) return 0;
    if (height < params.levels.beach) return 1;
    if (height < params.levels.tree) return 2;
    if (height < params.levels.snow) return 3;
    return 4;
  }

  private contourBand(height: number, params: SceneParams): number {
    const bands = Math.floor(params.palette.numColors);
    if (bands > 1) {
      return Math.min(Math.floor(this.clamp(height, 0, 1) * bands), bands - 1);
    }
    return this.elevationBand(this.clamp(height, 0, 1), params);
  }

  private isContourEdge(
    heightmap: Heightmap,
    x: number,
    y: number,
    params: SceneParams,
  ): boolean {
    const size = heightmap.size;
    const current = this.contourBand(heightmap.data[y * size + x], params);
    if (x > 0 && this.contourBand(heightmap.data[y * size + x - 1], params) !== current) return true;
    if (y > 0 && this.contourBand(heightmap.data[(y - 1) * size + x], params) !== current) return true;
    if (x < size - 1 && this.contourBand(heightmap.data[y * size + x + 1], params) !== current) return true;
    if (y < size - 1 && this.contourBand(heightmap.data[(y + 1) * size + x], params) !== current) return true;
    return false;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
