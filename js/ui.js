/*************************************************************************
 * UIイベントバインド & 操作コントローラー
 *************************************************************************/
import { state, musicData } from './state.js';
import { getAudioCtx, getDelayNode, getMasterGain, getCanvasGain } from './audio.js';
import { handleRulerSeek, seekToRatio, applyZoom, undoLast, updateStrokeCount, drawPianoRoll } from './canvas.js';
import { togglePlayback, stopPlayback, rewindToStart } from './playback.js';
import { loadPreset } from './presets.js';

export function setActiveTool(tool) {
  state.activeTool = tool;
  const toolPen = document.getElementById('toolPen');
  const toolSlide = document.getElementById('toolSlide');
  const toolEraser = document.getElementById('toolEraser');
  if (toolPen) toolPen.classList.toggle('border-cyan-500', tool === 'pen');
  if (toolSlide) toolSlide.classList.toggle('border-cyan-500', tool === 'slide');
  if (toolEraser) toolEraser.classList.toggle('border-cyan-500', tool === 'eraser');
}

export function bindUIEvents() {
  // 再生・停止・シーク・巻き戻し
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const rewindBtn = document.getElementById('rewindBtn');

  if (playBtn) playBtn.addEventListener('click', togglePlayback);
  if (stopBtn) stopBtn.addEventListener('click', stopPlayback);
  if (rewindBtn) rewindBtn.addEventListener('click', () => rewindToStart(seekToRatio));

  // ループ切替トグル
  const loopBtn = document.getElementById('loopToggleBtn');
  if (loopBtn) {
    loopBtn.addEventListener('click', () => {
      state.isLoop = !state.isLoop;
      if (state.isLoop) {
        loopBtn.textContent = 'ループ中';
        loopBtn.className = 'px-2 py-1 rounded text-[11px] font-bold border themed-border bg-cyan-500/20 text-cyan-400 transition';
      } else {
        loopBtn.textContent = '1回再生';
        loopBtn.className = 'px-2 py-1 rounded text-[11px] font-bold border themed-border bg-slate-500/20 themed-text-muted transition';
      }
    });
  }

  // タイムラインルーラーでの途中シーク
  const timelineContainer = document.getElementById('timelineRulerContainer');
  let isRulerDragging = false;

  if (timelineContainer) {
    timelineContainer.addEventListener('mousedown', (e) => {
      isRulerDragging = true;
      handleRulerSeek(e.clientX);
    });
    window.addEventListener('mousemove', (e) => {
      if (isRulerDragging) handleRulerSeek(e.clientX);
    });
    window.addEventListener('mouseup', () => {
      isRulerDragging = false;
    });
  }

  // 小節数セレクター
  const barCountSelect = document.getElementById('barCountSelect');
  if (barCountSelect) {
    barCountSelect.addEventListener('change', (e) => {
      state.totalBars = parseInt(e.target.value, 10);
      seekToRatio(0.0);
      applyZoom();
    });
  }

  // テーマセレクター
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      document.body.setAttribute('data-theme', theme);
      state.theme = theme;
      applyZoom();
    });
  }

  // ズーム操作
  const zoomXSlider = document.getElementById('zoomXSlider');
  const zoomYSlider = document.getElementById('zoomYSlider');
  const zoomXInBtn = document.getElementById('zoomXInBtn');
  const zoomXOutBtn = document.getElementById('zoomXOutBtn');
  const zoomYInBtn = document.getElementById('zoomYInBtn');
  const zoomYOutBtn = document.getElementById('zoomYOutBtn');
  const zoomFitBtn = document.getElementById('zoomFitBtn');

  if (zoomXSlider) {
    zoomXSlider.addEventListener('input', (e) => {
      state.zoomX = parseInt(e.target.value, 10) / 100;
      applyZoom();
    });
  }
  if (zoomYSlider) {
    zoomYSlider.addEventListener('input', (e) => {
      state.zoomY = parseInt(e.target.value, 10) / 100;
      applyZoom();
    });
  }

  if (zoomXInBtn && zoomXSlider) {
    zoomXInBtn.addEventListener('click', () => {
      zoomXSlider.value = Math.min(300, parseInt(zoomXSlider.value, 10) + 25);
      state.zoomX = parseInt(zoomXSlider.value, 10) / 100;
      applyZoom();
    });
  }
  if (zoomXOutBtn && zoomXSlider) {
    zoomXOutBtn.addEventListener('click', () => {
      zoomXSlider.value = Math.max(50, parseInt(zoomXSlider.value, 10) - 25);
      state.zoomX = parseInt(zoomXSlider.value, 10) / 100;
      applyZoom();
    });
  }
  if (zoomYInBtn && zoomYSlider) {
    zoomYInBtn.addEventListener('click', () => {
      zoomYSlider.value = Math.min(250, parseInt(zoomYSlider.value, 10) + 25);
      state.zoomY = parseInt(zoomYSlider.value, 10) / 100;
      applyZoom();
    });
  }
  if (zoomYOutBtn && zoomYSlider) {
    zoomYOutBtn.addEventListener('click', () => {
      zoomYSlider.value = Math.max(60, parseInt(zoomYSlider.value, 10) - 25);
      state.zoomY = parseInt(zoomYSlider.value, 10) / 100;
      applyZoom();
    });
  }

  if (zoomFitBtn && zoomXSlider && zoomYSlider) {
    zoomFitBtn.addEventListener('click', () => {
      zoomXSlider.value = 100;
      zoomYSlider.value = 100;
      state.zoomX = 1.0;
      state.zoomY = 1.0;
      applyZoom();
    });
  }

  // マウスホイールでのスクロール＆ズーム
  const canvasWrapper = document.getElementById('canvasScrollWrapper');
  if (canvasWrapper && zoomXSlider) {
    canvasWrapper.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        // Ctrl+ホイール: ズーム
        e.preventDefault();
        const delta = e.deltaY > 0 ? -15 : 15;
        zoomXSlider.value = Math.max(50, Math.min(300, parseInt(zoomXSlider.value, 10) + delta));
        state.zoomX = parseInt(zoomXSlider.value, 10) / 100;
        applyZoom();
      } else if (e.shiftKey) {
        // Shift+ホイール: 横スクロール
        e.preventDefault();
        canvasWrapper.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // 楽器パレット選択
  document.querySelectorAll('.inst-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.inst-btn').forEach(b => {
        b.classList.remove('border-2', 'border-white');
        b.classList.add('border-transparent');
      });
      btn.classList.add('border-2', 'border-white');
      btn.classList.remove('border-transparent');
      state.activeInstrument = btn.dataset.inst;
    });
  });

  // 描画ツール切替
  const toolPen = document.getElementById('toolPen');
  const toolSlide = document.getElementById('toolSlide');
  const toolEraser = document.getElementById('toolEraser');
  const undoBtn = document.getElementById('undoBtn');

  if (toolPen) toolPen.addEventListener('click', () => setActiveTool('pen'));
  if (toolSlide) toolSlide.addEventListener('click', () => setActiveTool('slide'));
  if (toolEraser) toolEraser.addEventListener('click', () => setActiveTool('eraser'));
  if (undoBtn) undoBtn.addEventListener('click', undoLast);

  // ショートカットキー
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      togglePlayback();
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      undoLast();
    }
  });

  // スナップ設定
  const gridSnapSelect = document.getElementById('gridSnapSelect');
  const scaleSnapSelect = document.getElementById('scaleSnapSelect');
  if (gridSnapSelect) {
    gridSnapSelect.addEventListener('change', (e) => {
      state.gridSnap = e.target.value;
    });
  }
  if (scaleSnapSelect) {
    scaleSnapSelect.addEventListener('change', (e) => {
      state.scaleSnap = e.target.value;
    });
  }

  // スライダー
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmVal = document.getElementById('bpmVal');
  if (bpmSlider && bpmVal) {
    bpmSlider.addEventListener('input', (e) => {
      state.bpm = parseInt(e.target.value, 10);
      bpmVal.textContent = state.bpm;
      const delayNode = getDelayNode();
      const audioCtx = getAudioCtx();
      if (delayNode && audioCtx) {
        delayNode.delayTime.setTargetAtTime((60 / state.bpm) * 0.75, audioCtx.currentTime, 0.05);
      }
    });
  }

  const masterVolSlider = document.getElementById('masterVolSlider');
  const masterVolVal = document.getElementById('masterVolVal');
  if (masterVolSlider && masterVolVal) {
    masterVolSlider.addEventListener('input', (e) => {
      state.masterVolume = parseInt(e.target.value, 10) / 100;
      masterVolVal.textContent = `${parseInt(e.target.value, 10)}%`;
      const masterGain = getMasterGain();
      const audioCtx = getAudioCtx();
      if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(state.masterVolume, audioCtx.currentTime, 0.02);
    });
  }

  const synthCanvasVol = document.getElementById('synthCanvasVol');
  if (synthCanvasVol) {
    synthCanvasVol.addEventListener('input', (e) => {
      state.canvasVolume = parseInt(e.target.value, 10) / 100;
      const canvasGain = getCanvasGain();
      const audioCtx = getAudioCtx();
      if (canvasGain && audioCtx) canvasGain.gain.setTargetAtTime(state.canvasVolume, audioCtx.currentTime, 0.02);
    });
  }

  // プリセット & クリア
  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      loadPreset(e.target.value);
    });
  }

  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      musicData.undoStack.push(JSON.parse(JSON.stringify(musicData.strokes)));
      musicData.strokes = [];
      updateStrokeCount();
      drawPianoRoll();
    });
  }
}
