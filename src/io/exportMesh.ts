/**
 * Wavefront OBJ mesh export for Three.js BufferGeometry terrain meshes.
 */
import type { BufferGeometry } from 'three';
import { downloadBlob } from './download';

/** Serialize a BufferGeometry to OBJ text and trigger a download. */
export function exportObj(
  geometry: BufferGeometry,
  filename = 'vista-terrain.obj',
): void {
  const position = geometry.getAttribute('position');
  if (!position) {
    throw new Error('Geometry has no position attribute');
  }

  const lines: string[] = [];
  for (let i = 0; i < position.count; i += 1) {
    lines.push(`v ${position.getX(i)} ${position.getY(i)} ${position.getZ(i)}`);
  }

  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const a = index.getX(i) + 1;
      const b = index.getX(i + 1) + 1;
      const c = index.getX(i + 2) + 1;
      lines.push(`f ${a} ${b} ${c}`);
    }
  } else {
    for (let i = 0; i + 2 < position.count; i += 3) {
      lines.push(`f ${i + 1} ${i + 2} ${i + 3}`);
    }
  }

  downloadBlob(new Blob([`${lines.join('\n')}\n`], { type: 'text/plain' }), filename);
}
