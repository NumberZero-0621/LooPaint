/*************************************************************************
 * LooPaint - メインエントリーポイント
 *************************************************************************/
import { buildDrumUI } from './drums.js';
import { initCanvasEvents, applyZoom } from './canvas.js';
import { bindUIEvents } from './ui.js';
import { loadPreset } from './presets.js';
import { audioRenderLoop } from './playback.js';

function initApp() {
  buildDrumUI();
  initCanvasEvents();
  bindUIEvents();
  loadPreset('clear');
  applyZoom();
  requestAnimationFrame(audioRenderLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
