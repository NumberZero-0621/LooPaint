/*************************************************************************
 * ループ再生 & シーク追従エンジン & ビジュアライザー
 *************************************************************************/
import { STEPS_PER_BAR, DRUM_TRACKS } from './constants.js';
import { state, musicData } from './state.js';
import {
  initAudioEngine,
  getAudioCtx,
  getAnalyser,
  getActiveVoices,
  updateStrokeVoice,
  stopStrokeVoice,
  stopAllStrokeVoices,
  triggerDrumVoice
} from './audio.js';
import { clearPlayheadHighlights, highlightDrumColumn } from './drums.js';

let loopStartTime = 0;

export function syncLoopStartTime(ratio) {
  const audioCtx = getAudioCtx();
  if (!audioCtx) return;
  const secondsPerBar = (60.0 / state.bpm) * 4.0;
  const totalDuration = secondsPerBar * state.totalBars;
  loopStartTime = audioCtx.currentTime - (ratio * totalDuration);
}

export function updateTransportUI() {
  const playBtn = document.getElementById('playBtn');
  const playText = document.getElementById('playText');
  if (state.isPlaying) {
    playText.textContent = '一時停止';
    playBtn.classList.add('bg-emerald-900/50', 'border-emerald-500');
  } else {
    playText.textContent = '再生';
    playBtn.classList.remove('bg-emerald-900/50', 'border-emerald-500');
  }
}

export function startPlayback() {
  initAudioEngine();
  if (state.isPlaying) return;

  state.isPlaying = true;

  // シーク位置から再生を開始
  const audioCtx = getAudioCtx();
  const secondsPerBar = (60.0 / state.bpm) * 4.0;
  const totalDuration = secondsPerBar * state.totalBars;
  loopStartTime = audioCtx.currentTime - (state.seekRatio * totalDuration);

  updateTransportUI();
}

export function stopPlayback() {
  state.isPlaying = false;
  stopAllStrokeVoices();
  clearPlayheadHighlights();
  updateTransportUI();
}

export function togglePlayback() {
  if (state.isPlaying) stopPlayback();
  else startPlayback();
}

export function rewindToStart(seekFn) {
  if (typeof seekFn === 'function') {
    seekFn(0.0);
  }
}

// メインアニメーション＆オーディオスケジューラー
export function audioRenderLoop() {
  const audioCtx = getAudioCtx();

  if (audioCtx && state.isPlaying) {
    const curTime = audioCtx.currentTime;
    const secondsPerBar = (60.0 / state.bpm) * 4.0;
    const totalDuration = secondsPerBar * state.totalBars;
    const elapsedTime = curTime - loopStartTime;

    let frac = elapsedTime / totalDuration;

    if (frac >= 1.0) {
      if (state.isLoop) {
        // ループ再生
        loopStartTime = curTime;
        frac = 0.0;
      } else {
        // ワンショット再生終了
        stopPlayback();
        frac = 1.0;
      }
    }

    state.playbackRatio = frac;

    // プレイヘッド位置の更新
    const canvasPlayhead = document.getElementById('canvasPlayhead');
    const rulerSeekMarker = document.getElementById('rulerSeekMarker');
    if (canvasPlayhead) canvasPlayhead.style.left = `${frac * 100}%`;
    if (rulerSeekMarker) rulerSeekMarker.style.left = `${frac * 100}%`;

    // 小節・ステップ表示の更新
    const totalSteps = state.totalBars * STEPS_PER_BAR;
    const curStepTotal = Math.floor(frac * totalSteps);
    const curBar = Math.floor(curStepTotal / STEPS_PER_BAR) + 1;
    const curStepInBar = (curStepTotal % STEPS_PER_BAR);

    if (curStepInBar !== state.currentStep) {
      triggerDrumStep(curStepInBar, curTime);
      highlightDrumColumn(curStepInBar);
      state.currentStep = curStepInBar;
      const stepReadout = document.getElementById('stepReadout');
      if (stepReadout) {
        stepReadout.textContent = `${curBar}小節 / ${String(curStepInBar + 1).padStart(2, '0')}`;
      }
    }

    // アナログ周波数追従（各ストロークの周波数を連続補間）
    const activeIds = new Set();
    musicData.strokes.forEach(s => {
      if (!s.points || s.points.length === 0) return;
      const tMin = Math.min(s.points[0].t, s.points[s.points.length - 1].t);
      const tMax = Math.max(s.points[0].t, s.points[s.points.length - 1].t);

      if (frac >= tMin && frac <= tMax) {
        activeIds.add(s.id);
        let targetFreq = null;
        if (s.points.length === 1) {
          targetFreq = s.points[0].freq;
        } else {
          for (let i = 0; i < s.points.length - 1; i++) {
            const pA = s.points[i];
            const pB = s.points[i + 1];
            const segMin = Math.min(pA.t, pB.t);
            const segMax = Math.max(pA.t, pB.t);
            if (frac >= segMin && frac <= segMax) {
              const r = segMax === segMin ? 0 : (frac - pA.t) / (pB.t - pA.t);
              targetFreq = pA.freq + (pB.freq - pA.freq) * r;
              break;
            }
          }
          if (!targetFreq) targetFreq = s.points[0].freq;
        }
        updateStrokeVoice(s, targetFreq, curTime);
      }
    });

    const activeVoices = getActiveVoices();
    activeVoices.forEach((v, id) => {
      if (!activeIds.has(id)) stopStrokeVoice(id, curTime);
    });
  }

  drawVisualizer();
  requestAnimationFrame(audioRenderLoop);
}

export function triggerDrumStep(step, time) {
  for (let t = 0; t < DRUM_TRACKS.length; t++) {
    const val = musicData.drumPattern[t][step];
    if (val > 0) {
      if (DRUM_TRACKS[t].id === 'oh' && musicData.drumPattern[3][step] > 0) continue;
      triggerDrumVoice(t, time, val === 2 ? 1.35 : 0.95);
    }
  }
}

// ビジュアライザー
export function drawVisualizer() {
  const visCanvas = document.getElementById('visualizerCanvas');
  if (!visCanvas) return;
  const visCtx = visCanvas.getContext('2d');
  const w = visCanvas.width;
  const h = visCanvas.height;
  visCtx.clearRect(0, 0, w, h);

  const analyser = getAnalyser();
  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  const barCount = 18;
  const step = Math.floor(bufferLength / barCount);
  const barWidth = (w / barCount) - 1;

  for (let i = 0; i < barCount; i++) {
    const val = dataArray[i * step] / 255.0;
    const barHeight = Math.max(2, val * (h - 2));
    const x = i * (barWidth + 1);
    const y = h - barHeight;
    visCtx.fillStyle = '#06b6d4';
    visCtx.fillRect(x, y, barWidth, barHeight);
  }
}
