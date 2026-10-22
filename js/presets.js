/*************************************************************************
 * 楽曲プリセットデータ ＆ プリセット読み込み処理
 *************************************************************************/
import { midiToFreq, DRUM_TRACKS, STEPS_PER_BAR } from './constants.js';
import { state, musicData } from './state.js';
import { updateStrokeCount, seekToRatio, applyZoom } from './canvas.js';
import { renderDrumPad } from './drums.js';

export const PRESETS = {
  starry: {
    bpm: 110,
    bars: 2,
    drums: [
      [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]
    ],
    strokes: [
      // ピアノアルペジオ (1小節目)
      {
        id: 'p1', type: 'slide', instrumentKey: 'piano', color: '#3b82f6', points: [
          { t: 0.0, y: 0.57, freq: midiToFreq(60) }, // C4
          { t: 0.2, y: 0.45, freq: midiToFreq(72) }  // C5
        ]
      },
      {
        id: 'p2', type: 'slide', instrumentKey: 'piano', color: '#3b82f6', points: [
          { t: 0.22, y: 0.45, freq: midiToFreq(72) },
          { t: 0.45, y: 0.38, freq: midiToFreq(79) }  // G5
        ]
      },
      // ギターの波形ビブラート (2小節目)
      {
        id: 'g1', type: 'freehand', instrumentKey: 'guitar', color: '#f59e0b', points: [
          { t: 0.50, y: 0.45, freq: midiToFreq(72) },
          { t: 0.60, y: 0.42, freq: midiToFreq(76) },
          { t: 0.70, y: 0.47, freq: midiToFreq(71) },
          { t: 0.85, y: 0.45, freq: midiToFreq(72) }
        ]
      },
      // ベース重低音スライド
      {
        id: 'b1', type: 'slide', instrumentKey: 'bass', color: '#ef4444', points: [
          { t: 0.00, y: 0.85, freq: midiToFreq(36) },
          { t: 0.48, y: 0.78, freq: midiToFreq(43) }
        ]
      },
      {
        id: 'b2', type: 'slide', instrumentKey: 'bass', color: '#ef4444', points: [
          { t: 0.50, y: 0.78, freq: midiToFreq(43) },
          { t: 0.98, y: 0.85, freq: midiToFreq(36) }
        ]
      }
    ]
  },
  piano_melody: {
    bpm: 100,
    bars: 4,
    drums: [
      [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
    ],
    strokes: [
      // ピアノの優雅なメロディ
      {
        id: 'pm1', type: 'slide', instrumentKey: 'piano', color: '#3b82f6', points: [
          { t: 0.02, y: 0.55, freq: midiToFreq(62) },
          { t: 0.22, y: 0.48, freq: midiToFreq(69) }
        ]
      },
      {
        id: 'pm2', type: 'slide', instrumentKey: 'piano', color: '#3b82f6', points: [
          { t: 0.25, y: 0.44, freq: midiToFreq(74) },
          { t: 0.45, y: 0.38, freq: midiToFreq(81) }
        ]
      },
      // 弦楽器アンサンブル
      {
        id: 'st1', type: 'slide', instrumentKey: 'strings', color: '#8b5cf6', points: [
          { t: 0.50, y: 0.52, freq: midiToFreq(65) },
          { t: 0.95, y: 0.50, freq: midiToFreq(67) }
        ]
      },
      // マリンバ
      {
        id: 'mar1', type: 'slide', instrumentKey: 'marimba', color: '#10b981', points: [
          { t: 0.75, y: 0.35, freq: midiToFreq(84) },
          { t: 0.95, y: 0.30, freq: midiToFreq(89) }
        ]
      }
    ]
  },
  slide_acid: {
    bpm: 132,
    bars: 2,
    drums: [
      [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0]
    ],
    strokes: [
      {
        id: 'a1', type: 'slide', instrumentKey: 'chiptune', color: '#f97316', points: [
          { t: 0.00, y: 0.75, freq: midiToFreq(36) },
          { t: 0.22, y: 0.58, freq: midiToFreq(51) }
        ]
      },
      {
        id: 'a2', type: 'slide', instrumentKey: 'cosmic', color: '#06b6d4', points: [
          { t: 0.25, y: 0.58, freq: midiToFreq(51) },
          { t: 0.48, y: 0.70, freq: midiToFreq(43) }
        ]
      },
      {
        id: 'a3', type: 'slide', instrumentKey: 'chiptune', color: '#f97316', points: [
          { t: 0.50, y: 0.70, freq: midiToFreq(43) },
          { t: 0.98, y: 0.50, freq: midiToFreq(60) }
        ]
      }
    ]
  },
  empty: {
    bpm: 120,
    bars: 2,
    drums: [
      [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ],
    strokes: []
  }
};

export function loadPreset(key) {
  const p = PRESETS[key];
  if (!p) return;

  state.bpm = p.bpm;
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmVal = document.getElementById('bpmVal');
  if (bpmSlider) bpmSlider.value = p.bpm;
  if (bpmVal) bpmVal.textContent = p.bpm;

  state.totalBars = p.bars || 2;
  const barSelect = document.getElementById('barCountSelect');
  if (barSelect) barSelect.value = String(state.totalBars);

  musicData.drumPattern = p.drums.map(row => [...row]);
  musicData.strokes = JSON.parse(JSON.stringify(p.strokes));
  musicData.undoStack = [];

  updateStrokeCount();
  seekToRatio(0.0);
  for (let t = 0; t < DRUM_TRACKS.length; t++) {
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      renderDrumPad(t, s);
    }
  }
  applyZoom();
}
