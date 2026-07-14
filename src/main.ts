import './styles/global.css';

// Entry point. The full application (state + renderer + UI) is assembled in
// app.ts during the integration phase; this bootstrap keeps the module graph
// valid and the dev server serving from phase 0 onward.
const ui = document.getElementById('ui-root');
if (ui) {
  const boot = document.createElement('div');
  boot.textContent = 'VistaPro Web — booting…';
  boot.style.cssText =
    'position:absolute;left:12px;top:12px;color:#8fdcff;font:12px monospace';
  ui.appendChild(boot);
}
