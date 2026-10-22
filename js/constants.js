/*************************************************************************
 * 定数 & 楽器定義 & 音楽ユーティリティ
 *************************************************************************/

export const STEPS_PER_BAR = 16;

// 楽器音色パレット定義（アコースティック＆エレクトリック楽器）
export const INSTRUMENTS = {
  piano: {
    name: 'ピアノ',
    color: '#3b82f6',
    category: 'acoustic',
    type: 'piano'
  },
  guitar: {
    name: 'ギター',
    color: '#f59e0b',
    category: 'acoustic',
    type: 'guitar'
  },
  strings: {
    name: '弦楽器',
    color: '#8b5cf6',
    category: 'acoustic',
    type: 'strings'
  },
  brass: {
    name: 'ブラス',
    color: '#eab308',
    category: 'acoustic',
    type: 'brass'
  },
  marimba: {
    name: 'マリンバ',
    color: '#10b981',
    category: 'acoustic',
    type: 'marimba'
  },
  bass: {
    name: 'ベース',
    color: '#ef4444',
    category: 'electric',
    type: 'bass'
  },
  cosmic: {
    name: '宇宙リード',
    color: '#06b6d4',
    category: 'synth',
    type: 'cosmic'
  },
  chiptune: {
    name: '8bit',
    color: '#f97316',
    category: 'synth',
    type: 'chiptune'
  }
};

// ドラムトラック
export const DRUM_TRACKS = [
  { id: 'kick', name: 'バスドラム', short: 'キック', color: '#ff5722', volume: 0.95, tune: 50, muted: false },
  { id: 'snare', name: 'スネア', short: 'スネア', color: '#f59e0b', volume: 0.85, tune: 50, muted: false },
  { id: 'clap', name: '手拍子', short: '手拍子', color: '#f43f5e', volume: 0.78, tune: 50, muted: false },
  { id: 'ch', name: 'C.ハット', short: 'C.ハット', color: '#14b8a6', volume: 0.70, tune: 50, muted: false },
  { id: 'oh', name: 'O.ハット', short: 'O.ハット', color: '#0ea5e9', volume: 0.65, tune: 50, muted: false }
];

// 8オクターブMIDI範囲 (C1=24 〜 C8=108 / 84半音)
export const MIN_MIDI = 24;
export const MAX_MIDI = 108;

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

export const NOTE_NAMES = ['ド', 'ド#', 'レ', 'レ#', 'ミ', 'ファ', 'ファ#', 'ソ', 'ソ#', 'ラ', 'ラ#', 'シ'];

export function midiToNoteString(midi) {
  const rounded = Math.round(midi);
  const noteIdx = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[noteIdx]}${octave} (${rounded})`;
}
