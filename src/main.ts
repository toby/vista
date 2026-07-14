import './styles/global.css';
import { App } from './app';

const canvas = document.getElementById('viewport');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#viewport canvas not found');
}

try {
  // Expose for debugging / headless verification.
  (window as unknown as { app: App }).app = new App(canvas);
} catch (err) {
  const box = document.createElement('pre');
  box.style.cssText =
    'position:absolute;left:8px;top:8px;color:#f66;background:#000;font:12px monospace;padding:8px;white-space:pre-wrap;z-index:9999';
  box.textContent = 'INIT ERROR: ' + (err instanceof Error ? err.stack : String(err));
  document.body.appendChild(box);
  throw err;
}
