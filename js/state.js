/*************************************************************************
 * アプリケーション状態 & 楽曲データ
 *************************************************************************/
import { DRUM_TRACKS, STEPS_PER_BAR } from './constants.js';

// アプリケーション全体状態
export const state = {
  isPlaying: false,
  isLoop: true, // ループ再生ON/OFF
  bpm: 120,
  totalBars: 2, // 全小節数 (1, 2, 4, 8, 16, 32)
  playbackRatio: 0.0, // 0.0 〜 1.0 (曲全体の進行比率)
  seekRatio: 0.0, // シーク開始位置 (0.0 〜 1.0)
  masterVolume: 0.85,
  canvasVolume: 0.85,
  currentStep: 0,
  // 描画設定
  activeTool: 'pen', // 'pen' | 'slide' | 'eraser'
  activeInstrument: 'piano',
  gridSnap: 'free',
  scaleSnap: 'continuous',
  theme: 'dark',
  // ズーム倍率
  zoomX: 1.0, // 0.5 〜 3.0
  zoomY: 1.0  // 0.6 〜 2.5
};

// 楽曲データ（ストローク、ドラムパターン、アンドゥ履歴）
export const musicData = {
  drumPattern: Array.from({ length: DRUM_TRACKS.length }, () => Array(STEPS_PER_BAR).fill(0)),
  strokes: [],
  undoStack: []
};
