/*************************************************************************
 * タイムライン・シークバー＆ピアノロールキャンバス
 *************************************************************************/
import { MIN_MIDI, MAX_MIDI, INSTRUMENTS, STEPS_PER_BAR, midiToFreq, midiToNoteString } from './constants.js';
import { state, musicData } from './state.js';
import { initAudioEngine, getAudioCtx, updateStrokeVoice, stopStrokeVoice, previewPitch } from './audio.js';
import { syncLoopStartTime } from './playback.js';

let isDrawing = false;
let currentStroke = null;
let slideStartPoint = null;

// ズーム更新
export function applyZoom() {
  const canvasWrapper = document.getElementById('canvasScrollWrapper');
  const canvasContainer = document.getElementById('canvasVirtualContainer');
  const drawingCanvas = document.getElementById('drawingCanvas');
  const rulerCanvas = document.getElementById('rulerCanvas');
  if (!canvasWrapper || !canvasContainer || !drawingCanvas || !rulerCanvas) return;

  const baseWidth = canvasWrapper.clientWidth;
  const baseHeight = 380;

  const newWidth = Math.round(baseWidth * state.zoomX);
  const newHeight = Math.round(baseHeight * state.zoomY);

  canvasContainer.style.width = `${newWidth}px`;
  canvasContainer.style.height = `${newHeight}px`;

  const dpr = window.devicePixelRatio || 1;
  drawingCanvas.width = newWidth * dpr;
  drawingCanvas.height = newHeight * dpr;

  // タイムラインルーラー
  const rulerRect = rulerCanvas.parentElement.getBoundingClientRect();
  rulerCanvas.width = rulerRect.width * dpr;
  rulerCanvas.height = rulerRect.height * dpr;

  drawRuler();
  drawPianoRoll();
}

// タイムラインルーラーの描画（小節線・拍表示・シークマーカー）
export function drawRuler() {
  const rulerCanvas = document.getElementById('rulerCanvas');
  if (!rulerCanvas) return;
  const rulerCtx = rulerCanvas.getContext('2d');

  const w = rulerCanvas.width;
  const h = rulerCanvas.height;
  const dpr = window.devicePixelRatio || 1;

  rulerCtx.clearRect(0, 0, w, h);

  // 背景
  rulerCtx.fillStyle = 'transparent';
  rulerCtx.fillRect(0, 0, w, h);

  const totalBars = state.totalBars;
  const barWidth = w / totalBars;

  for (let b = 0; b < totalBars; b++) {
    const x = b * barWidth;
    // 小節線
    rulerCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    rulerCtx.lineWidth = 1.5 * dpr;
    rulerCtx.beginPath();
    rulerCtx.moveTo(x, 0);
    rulerCtx.lineTo(x, h);
    rulerCtx.stroke();

    // 小節番号テキスト
    rulerCtx.fillStyle = '#f59e0b';
    rulerCtx.font = `bold ${10 * dpr}px JetBrains Mono`;
    rulerCtx.fillText(`${b + 1}小節`, x + 5 * dpr, 14 * dpr);

    // 4拍の区切り
    for (let beat = 1; beat < 4; beat++) {
      const beatX = x + (barWidth / 4) * beat;
      rulerCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      rulerCtx.lineWidth = 1 * dpr;
      rulerCtx.beginPath();
      rulerCtx.moveTo(beatX, h * 0.4);
      rulerCtx.lineTo(beatX, h);
      rulerCtx.stroke();
    }
  }
}

// ピアノロールキャンバス背景とストロークの描画
export function drawPianoRoll() {
  const drawingCanvas = document.getElementById('drawingCanvas');
  if (!drawingCanvas) return;
  const drawCtx = drawingCanvas.getContext('2d');

  const w = drawingCanvas.width;
  const h = drawingCanvas.height;
  const dpr = window.devicePixelRatio || 1;
  const totalNotes = MAX_MIDI - MIN_MIDI;

  drawCtx.clearRect(0, 0, w, h);

  // 1. 背景のオクターブ線＆C音ガイド
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
    const normY = (MAX_MIDI - m) / totalNotes;
    const y = normY * h;
    const noteIdx = ((m % 12) + 12) % 12;

    if (noteIdx === 0) {
      // C音 (オクターブ境界)
      drawCtx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      drawCtx.fillRect(0, y - (h / totalNotes) * 0.5, w, h / totalNotes);

      drawCtx.strokeStyle = '#ef4444';
      drawCtx.lineWidth = 1.2 * dpr;
      drawCtx.beginPath();
      drawCtx.moveTo(0, y);
      drawCtx.lineTo(w, y);
      drawCtx.stroke();

      const oct = Math.floor(m / 12) - 1;
      drawCtx.fillStyle = '#f87171';
      drawCtx.font = `bold ${9 * dpr}px JetBrains Mono`;
      drawCtx.fillText(`C${oct}`, 8 * dpr, y - 3 * dpr);
    } else if (noteIdx === 7) {
      // G音 (5度)
      drawCtx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      drawCtx.lineWidth = 0.8 * dpr;
      drawCtx.beginPath();
      drawCtx.moveTo(0, y);
      drawCtx.lineTo(w, y);
      drawCtx.stroke();
    }
  }

  // 2. 小節線＆拍線の縦軸描画
  const totalBars = state.totalBars;
  for (let b = 0; b <= totalBars; b++) {
    const x = (b / totalBars) * w;
    drawCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    drawCtx.lineWidth = 1.5 * dpr;
    drawCtx.beginPath();
    drawCtx.moveTo(x, 0);
    drawCtx.lineTo(x, h);
    drawCtx.stroke();

    // 各拍 (4拍/小節)
    if (b < totalBars) {
      for (let beat = 1; beat < 4; beat++) {
        const bx = x + ((1 / totalBars) / 4) * beat * w;
        drawCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        drawCtx.lineWidth = 0.8 * dpr;
        drawCtx.beginPath();
        drawCtx.moveTo(bx, 0);
        drawCtx.lineTo(bx, h);
        drawCtx.stroke();
      }
    }
  }

  // 3. ストロークの描画
  musicData.strokes.forEach(stroke => {
    if (!stroke.points || stroke.points.length === 0) return;

    drawCtx.strokeStyle = stroke.color;
    drawCtx.lineWidth = 3.5 * dpr;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    drawCtx.beginPath();
    const p0 = stroke.points[0];
    drawCtx.moveTo(p0.t * w, p0.y * h);

    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      drawCtx.lineTo(p.t * w, p.y * h);
    }
    drawCtx.stroke();

    // 終点サークル
    const pLast = stroke.points[stroke.points.length - 1];
    drawCtx.fillStyle = '#ffffff';
    drawCtx.beginPath();
    drawCtx.arc(pLast.t * w, pLast.y * h, 2.5 * dpr, 0, Math.PI * 2);
    drawCtx.fill();
  });

  // 描画中のストローク
  if (currentStroke && currentStroke.points && currentStroke.points.length > 0) {
    drawCtx.strokeStyle = currentStroke.color;
    drawCtx.lineWidth = 3.5 * dpr;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    drawCtx.beginPath();
    const p0 = currentStroke.points[0];
    drawCtx.moveTo(p0.t * w, p0.y * h);
    for (let i = 1; i < currentStroke.points.length; i++) {
      const p = currentStroke.points[i];
      drawCtx.lineTo(p.t * w, p.y * h);
    }
    drawCtx.stroke();
  }
}

// 画面座標から正規化座標 (t: 0..1, y: 0..1) ＆ スナップ
export function canvasPosToNormalized(clientX, clientY) {
  const drawingCanvas = document.getElementById('drawingCanvas');
  const rect = drawingCanvas.getBoundingClientRect();
  let x = (clientX - rect.left) / rect.width;
  let y = (clientY - rect.top) / rect.height;
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));

  // グリッドスナップ
  if (state.gridSnap !== 'free') {
    const totalSteps = state.totalBars * parseInt(state.gridSnap, 10);
    x = Math.round(x * totalSteps) / totalSteps;
  }

  // 音階スナップ
  let midi = MAX_MIDI - y * (MAX_MIDI - MIN_MIDI);
  if (state.scaleSnap === 'semitone') {
    midi = Math.round(midi);
  } else if (state.scaleSnap === 'major') {
    const major = [0, 2, 4, 5, 7, 9, 11];
    const oct = Math.floor(midi / 12);
    const pitchInOct = midi % 12;
    let closest = major[0];
    let minDist = 999;
    for (let o of major) {
      const d = Math.abs(pitchInOct - o);
      if (d < minDist) { minDist = d; closest = o; }
    }
    midi = oct * 12 + closest;
  } else if (state.scaleSnap === 'pentatonic') {
    const penta = [0, 2, 4, 7, 9];
    const oct = Math.floor(midi / 12);
    const pitchInOct = midi % 12;
    let closest = penta[0];
    let minDist = 999;
    for (let o of penta) {
      const d = Math.abs(pitchInOct - o);
      if (d < minDist) { minDist = d; closest = o; }
    }
    midi = oct * 12 + closest;
  }

  const freq = midiToFreq(midi);
  const snappedY = (MAX_MIDI - midi) / (MAX_MIDI - MIN_MIDI);

  return { t: x, y: snappedY, midi, freq };
}

// タイムラインルーラーでのシーク（途中から再生）
export function handleRulerSeek(clientX) {
  const rulerCanvas = document.getElementById('rulerCanvas');
  if (!rulerCanvas) return;
  const rect = rulerCanvas.getBoundingClientRect();
  let ratio = (clientX - rect.left) / rect.width;
  ratio = Math.max(0, Math.min(1, ratio));

  seekToRatio(ratio);
}

export function seekToRatio(ratio) {
  state.seekRatio = ratio;
  state.playbackRatio = ratio;

  // タイムラインマーカー更新
  const rulerSeekMarker = document.getElementById('rulerSeekMarker');
  const canvasPlayhead = document.getElementById('canvasPlayhead');
  if (rulerSeekMarker) rulerSeekMarker.style.left = `${ratio * 100}%`;
  if (canvasPlayhead) canvasPlayhead.style.left = `${ratio * 100}%`;

  // 現在小節・ステップ計算
  const totalSteps = state.totalBars * STEPS_PER_BAR;
  const curStepTotal = Math.floor(ratio * totalSteps);
  const curBar = Math.floor(curStepTotal / STEPS_PER_BAR) + 1;
  const curStepInBar = (curStepTotal % STEPS_PER_BAR) + 1;
  const stepReadout = document.getElementById('stepReadout');
  if (stepReadout) {
    stepReadout.textContent = `${curBar}小節 / ${String(curStepInBar).padStart(2, '0')}`;
  }

  // 再生中であれば、再生開始基準時間を更新して瞬時にシーク位置から継続
  if (state.isPlaying) {
    syncLoopStartTime(ratio);
  }
}

export function eraseAtPoint(normT, normY) {
  const threshold = 0.025 / state.zoomX;
  const len = musicData.strokes.length;
  musicData.strokes = musicData.strokes.filter(s => {
    for (let pt of s.points) {
      if (Math.hypot(pt.t - normT, pt.y - normY) < threshold) return false;
    }
    return true;
  });
  if (musicData.strokes.length !== len) {
    updateStrokeCount();
    drawPianoRoll();
  }
}

export function updateStrokeCount() {
  const strokeCountText = document.getElementById('strokeCountText');
  if (strokeCountText) {
    strokeCountText.textContent = musicData.strokes.length;
  }
}

export function undoLast() {
  if (musicData.undoStack.length > 0) {
    musicData.strokes = musicData.undoStack.pop();
    updateStrokeCount();
    drawPianoRoll();
  }
}

// キャンバス描画イベントの初期化
export function initCanvasEvents() {
  const drawingCanvas = document.getElementById('drawingCanvas');
  if (!drawingCanvas) return;

  window.addEventListener('resize', applyZoom);

  drawingCanvas.addEventListener('mousedown', (e) => {
    initAudioEngine();
    isDrawing = true;
    const p = canvasPosToNormalized(e.clientX, e.clientY);

    musicData.undoStack.push(JSON.parse(JSON.stringify(musicData.strokes)));
    if (musicData.undoStack.length > 25) musicData.undoStack.shift();

    if (state.activeTool === 'eraser') {
      eraseAtPoint(p.t, p.y);
    } else if (state.activeTool === 'slide') {
      slideStartPoint = p;
      currentStroke = {
        id: 's_' + Date.now(),
        type: 'slide',
        instrumentKey: state.activeInstrument,
        color: INSTRUMENTS[state.activeInstrument].color,
        points: [p, p]
      };
      previewPitch(p.freq);
    } else {
      currentStroke = {
        id: 's_' + Date.now(),
        type: 'freehand',
        instrumentKey: state.activeInstrument,
        color: INSTRUMENTS[state.activeInstrument].color,
        points: [p]
      };
      previewPitch(p.freq);
    }
    drawPianoRoll();
  });

  window.addEventListener('mousemove', (e) => {
    const rect = drawingCanvas.getBoundingClientRect();
    const inCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

    if (inCanvas) {
      const p = canvasPosToNormalized(e.clientX, e.clientY);
      const curBar = Math.floor(p.t * state.totalBars) + 1;
      const noteEl = document.getElementById('cursorNoteText');
      const freqEl = document.getElementById('cursorFreqText');
      const timeEl = document.getElementById('cursorTimeText');
      if (noteEl) noteEl.textContent = midiToNoteString(p.midi);
      if (freqEl) freqEl.textContent = `${Math.round(p.freq)} Hz`;
      if (timeEl) timeEl.textContent = `${curBar}小節目 (${Math.round(p.t * 100)}%)`;
    }

    if (!isDrawing) return;
    const p = canvasPosToNormalized(e.clientX, e.clientY);

    if (state.activeTool === 'eraser') {
      eraseAtPoint(p.t, p.y);
    } else if (state.activeTool === 'slide') {
      if (currentStroke && slideStartPoint) {
        currentStroke.points = [slideStartPoint, p];
        drawPianoRoll();
      }
    } else if (state.activeTool === 'pen') {
      if (currentStroke) {
        const lastP = currentStroke.points[currentStroke.points.length - 1];
        if (Math.hypot(p.t - lastP.t, p.y - lastP.y) > 0.003) {
          currentStroke.points.push(p);
          if (!state.isPlaying) {
            const audioCtx = getAudioCtx();
            updateStrokeVoice(currentStroke, p.freq, audioCtx.currentTime);
          }
          drawPianoRoll();
        }
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDrawing) {
      isDrawing = false;
      if (!state.isPlaying && currentStroke) {
        const audioCtx = getAudioCtx();
        if (audioCtx) stopStrokeVoice(currentStroke.id, audioCtx.currentTime);
      }
      if (currentStroke && currentStroke.points.length > 0) {
        musicData.strokes.push(currentStroke);
        currentStroke = null;
        slideStartPoint = null;
        updateStrokeCount();
        drawPianoRoll();
      }
    }
  });
}
