import './styles/global.css';
import { App } from './app';
import { ControlPanel } from './ui/ControlPanel';

const canvas = document.getElementById('viewport');
const uiRoot = document.getElementById('ui-root');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#viewport canvas not found');
}
if (!uiRoot) {
  throw new Error('#ui-root not found');
}

try {
  const app = new App(canvas);
  const panel = new ControlPanel(app);
  uiRoot.append(panel.el);

  const hint = document.createElement('div');
  hint.className = 'vp-hint';
  hint.textContent =
    'Drag to orbit \u00B7 Scroll to zoom \u00B7 Right-drag to pan';
  uiRoot.append(hint);

  // Expose for debugging / headless verification.
  (window as unknown as { app: App }).app = app;
} catch (err) {
  const box = document.createElement('pre');
  box.style.cssText =
    'position:absolute;left:8px;top:8px;color:#f66;background:#000;font:12px monospace;padding:8px;white-space:pre-wrap;z-index:9999';
  box.textContent =
    'INIT ERROR: ' + (err instanceof Error ? err.stack : String(err));
  document.body.append(box);
  throw err;
}
