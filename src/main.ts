import './styles/global.css';
import { App } from './app';

const canvas = document.getElementById('viewport');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#viewport canvas not found');
}

// Expose for debugging / headless verification.
(window as unknown as { app: App }).app = new App(canvas);
