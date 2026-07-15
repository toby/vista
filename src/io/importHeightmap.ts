/**
 * Heightmap image import. Images are decoded in the browser, resampled to a
 * valid terrain edge, and normalized into a square Float32 height field.
 */

export interface ImportedHeightmap {
  size: number;
  data: Float32Array;
}

const VALID_EDGES = [65, 129, 257, 513] as const;

function targetEdge(width: number, height: number): number {
  const shortest = Math.max(1, Math.min(width, height));
  return VALID_EDGES.reduce((best, edge) =>
    Math.abs(edge - shortest) < Math.abs(best - shortest) ? edge : best,
  );
}

function luminanceAt(img: ImageData, x: number, y: number): number {
  const clampedX = Math.max(0, Math.min(img.width - 1, x));
  const clampedY = Math.max(0, Math.min(img.height - 1, y));
  const i = (clampedY * img.width + clampedX) * 4;
  return (
    0.299 * img.data[i] +
    0.587 * img.data[i + 1] +
    0.114 * img.data[i + 2]
  ) / 255;
}

function sampleBilinear(img: ImageData, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;
  const a = luminanceAt(img, x0, y0);
  const b = luminanceAt(img, x1, y0);
  const c = luminanceAt(img, x0, y1);
  const d = luminanceAt(img, x1, y1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/** PURE: convert decoded image pixels to a square normalized heightmap. */
export function imageDataToHeightmap(img: ImageData): ImportedHeightmap {
  const size = targetEdge(img.width, img.height);
  const data = new Float32Array(size * size);
  const scaleX = img.width > 1 ? (img.width - 1) / (size - 1) : 0;
  const scaleY = img.height > 1 ? (img.height - 1) / (size - 1) : 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = sampleBilinear(img, x * scaleX, y * scaleY);
      const i = y * size + x;
      data[i] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  const range = max - min;
  if (range <= 0) {
    data.fill(0);
  } else {
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (data[i] - min) / range;
    }
  }

  return { size, data };
}

/** Open a file picker, decode the chosen image, and return a heightmap. */
export function importHeightmapFile(): Promise<ImportedHeightmap> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    let settled = false;
    const cleanup = (): boolean => {
      if (settled) {
        return false;
      }
      settled = true;
      window.removeEventListener('focus', onFocus);
      return true;
    };
    const settleResolve = (value: ImportedHeightmap): void => {
      if (cleanup()) {
        resolve(value);
      }
    };
    const settleReject = (err: Error): void => {
      if (cleanup()) {
        reject(err);
      }
    };
    const onFocus = (): void => {
      setTimeout(() => {
        if (!settled && !input.files?.[0]) {
          settleReject(new Error('No file selected'));
        }
      }, 0);
    };

    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        settleReject(new Error('No file selected'));
        return;
      }
      void (async () => {
        let bitmap: ImageBitmap | undefined;
        try {
          bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not decode image');
          }
          ctx.drawImage(bitmap, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          settleResolve(imageDataToHeightmap(img));
        } catch (err) {
          settleReject(err instanceof Error ? err : new Error('Image import failed'));
        } finally {
          bitmap?.close();
        }
      })();
    });
    setTimeout(() => window.addEventListener('focus', onFocus), 0);
    input.click();
  });
}
