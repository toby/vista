/**
 * PNG export: renders one fresh frame and saves the canvas as a PNG. Relies on
 * the renderer being created with preserveDrawingBuffer so the pixels are still
 * readable when toBlob runs.
 */
import type { Renderer } from '../render/Renderer';
import { downloadBlob } from './download';

export function exportPng(renderer: Renderer, filename = 'vista.png'): void {
  renderer.renderOnce();
  renderer.renderer.domElement.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}
