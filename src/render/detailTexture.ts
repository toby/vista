/**
 * Procedural detail texture used by the Texture quality knob (O/L/M/H). A small
 * tiled grayscale noise canvas is used as a bump map on the modern terrain
 * material, adding fine micro-relief whose resolution follows the chosen quality.
 * Off produces no texture (null); higher levels use larger canvases.
 */
import { CanvasTexture, RepeatWrapping, type Texture } from 'three';
import type { TextureQuality } from '../state/SceneParams';

const SIZE_FOR: Record<TextureQuality, number> = {
  off: 0,
  low: 128,
  med: 256,
  high: 512,
};

/** Build a tiled grayscale noise texture for the given quality, or null if off. */
export function makeDetailTexture(quality: TextureQuality): Texture | null {
  const size = SIZE_FOR[quality];
  if (size === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = 110 + Math.floor(Math.random() * 145);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}
