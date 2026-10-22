/*************************************************************************
 * WEB AUDIO API オーディオエンジン & リアル楽器合成 & ドラム合成
 *************************************************************************/
import { DRUM_TRACKS } from './constants.js';
import { state } from './state.js';

let audioCtx = null;
let masterGain = null;
let canvasGain = null;
let analyser = null;
let delayNode = null;
let delayFeedback = null;
let delayWetGain = null;
let noiseBuffer = null;

// 能動的ボイスマップ
const activeVoices = new Map();

export function getAudioCtx() {
  return audioCtx;
}

export function getAnalyser() {
  return analyser;
}

export function getDelayNode() {
  return delayNode;
}

export function getMasterGain() {
  return masterGain;
}

export function getCanvasGain() {
  return canvasGain;
}

export function getActiveVoices() {
  return activeVoices;
}

export function initAudioEngine() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();

  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
  compressor.knee.setValueAtTime(12, audioCtx.currentTime);
  compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
  compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
  compressor.release.setValueAtTime(0.15, audioCtx.currentTime);

  masterGain = audioCtx.createGain();
  masterGain.gain.value = state.masterVolume;

  canvasGain = audioCtx.createGain();
  canvasGain.gain.value = state.canvasVolume;
  canvasGain.connect(compressor);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  // ディレイ
  delayNode = audioCtx.createDelay(2.0);
  delayNode.delayTime.value = (60 / state.bpm) * 0.75;
  delayFeedback = audioCtx.createGain();
  delayFeedback.gain.value = 0.36;

  const delayFilter = audioCtx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 2800;

  delayWetGain = audioCtx.createGain();
  delayWetGain.gain.value = 0.35;

  delayNode.connect(delayFilter);
  delayFilter.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayFilter.connect(delayWetGain);
  delayWetGain.connect(compressor);

  compressor.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  audioCtx.mainBus = compressor;
  audioCtx.canvasBus = canvasGain;
  audioCtx.delaySend = delayNode;

  // ホワイトノイズ生成
  const bufferSize = audioCtx.sampleRate * 2;
  noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const out = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    out[i] = Math.random() * 2 - 1;
  }
}

// 楽器ごとのリアルタイム発音＆ピッチベンド追従
export function updateStrokeVoice(stroke, freq, time) {
  if (!audioCtx) initAudioEngine();
  if (!freq || freq <= 0) return;

  const id = stroke.id;
  let voice = activeVoices.get(id);
  const instType = stroke.instrumentKey || 'piano';

  if (!voice) {
    voice = createInstrumentVoice(instType, freq, time, stroke);
    if (voice) activeVoices.set(id, voice);
  } else {
    // ピッチベンド（アナログ周波数連続更新）
    voice.updatePitch(freq, time);
  }
}

// 多彩な楽器ボイスの生成ファクトリ
export function createInstrumentVoice(type, freq, time, stroke) {
  const v = { nodes: [], stroke };

  switch (type) {
    case 'piano': {
      // 🎹 アコースティック・ピアノ合成 (基本波 + 2倍音 + 3倍音 + 打弦ハンマー)
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const osc3 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc3.type = 'sine';

      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 2, time);
      osc3.frequency.setValueAtTime(freq * 3, time);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(9000, freq * 4), time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.28, time + 0.005);

      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.canvasBus);

      osc1.start(time);
      osc2.start(time);
      osc3.start(time);

      v.nodes = [osc1, osc2, osc3, filter, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        osc1.frequency.setTargetAtTime(f, t, 0.012);
        osc2.frequency.setTargetAtTime(f * 2, t, 0.012);
        osc3.frequency.setTargetAtTime(f * 3, t, 0.012);
        filter.frequency.setTargetAtTime(Math.min(9000, f * 4), t, 0.012);
      };
      break;
    }

    case 'guitar': {
      // 🎸 アコースティックギター (弦振動モデル合成)
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(8000, freq * 3.5), time);
      filter.Q.setValueAtTime(3.0, time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.24, time + 0.008);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.canvasBus);
      gain.connect(audioCtx.delaySend);

      osc.start(time);

      v.nodes = [osc, filter, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        osc.frequency.setTargetAtTime(f, t, 0.012);
        filter.frequency.setTargetAtTime(Math.min(8000, f * 3.5), t, 0.012);
      };
      break;
    }

    case 'strings': {
      // 🎻 ストリングスアンサンブル (デチューン重鋸波 + ビブラート)
      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      oscA.type = 'sawtooth';
      oscB.type = 'sawtooth';
      oscA.frequency.setValueAtTime(freq * 1.004, time);
      oscB.frequency.setValueAtTime(freq * 0.996, time);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4500, time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.22, time + 0.04); // 柔らかいアタック

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.canvasBus);
      gain.connect(audioCtx.delaySend);

      oscA.start(time);
      oscB.start(time);

      v.nodes = [oscA, oscB, filter, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        oscA.frequency.setTargetAtTime(f * 1.004, t, 0.015);
        oscB.frequency.setTargetAtTime(f * 0.996, t, 0.015);
      };
      break;
    }

    case 'brass': {
      // 🎷 ブラス / サックス (倍音開閉フィルター)
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(7000, freq * 2.8), time);
      filter.Q.setValueAtTime(4.0, time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.015);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.canvasBus);

      osc.start(time);

      v.nodes = [osc, filter, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        osc.frequency.setTargetAtTime(f, t, 0.012);
        filter.frequency.setTargetAtTime(Math.min(7000, f * 2.8), t, 0.012);
      };
      break;
    }

    case 'marimba': {
      // 🔔 マリンバ / 木琴 (乾いた木管パーカッション)
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 3.9, time);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.5, time);
      filter.Q.setValueAtTime(1.5, time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.28, time + 0.004);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.canvasBus);

      osc1.start(time);
      osc2.start(time);

      v.nodes = [osc1, osc2, filter, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        osc1.frequency.setTargetAtTime(f, t, 0.01);
        osc2.frequency.setTargetAtTime(f * 3.9, t, 0.01);
        filter.frequency.setTargetAtTime(f * 1.5, t, 0.01);
      };
      break;
    }

    case 'bass': {
      // ⚡ エレキベース (太い三角波＋矩形波スラップ)
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, time);
      filter.Q.setValueAtTime(3.5, time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.32, time + 0.006);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.canvasBus);

      osc.start(time);

      v.nodes = [osc, filter, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        osc.frequency.setTargetAtTime(f, t, 0.012);
      };
      break;
    }

    case 'cosmic': {
      // 🚀 宇宙リードシンセ (ディレイ＆レゾナンス)
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600, time);
      filter.Q.setValueAtTime(4.0, time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.24, time + 0.02);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.canvasBus);
      gain.connect(audioCtx.delaySend);

      osc.start(time);

      v.nodes = [osc, filter, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        osc.frequency.setTargetAtTime(f, t, 0.012);
      };
      break;
    }

    default: {
      // 👾 8bit 矩形波
      const osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, time);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.20, time + 0.005);

      osc.connect(gain);
      gain.connect(audioCtx.canvasBus);

      osc.start(time);

      v.nodes = [osc, gain];
      v.gainNode = gain;
      v.updatePitch = (f, t) => {
        osc.frequency.setTargetAtTime(f, t, 0.012);
      };
      break;
    }
  }

  return v;
}

export function stopStrokeVoice(id, time) {
  const v = activeVoices.get(id);
  if (!v) return;

  if (v.gainNode) {
    v.gainNode.gain.setValueAtTime(v.gainNode.gain.value, time);
    v.gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  }

  setTimeout(() => {
    v.nodes.forEach(n => {
      try { if (n.stop) n.stop(); } catch (e) { }
      try { n.disconnect(); } catch (e) { }
    });
    activeVoices.delete(id);
  }, 80);
}

export function stopAllStrokeVoices() {
  if (!audioCtx) return;
  activeVoices.forEach((v, id) => {
    if (v.gainNode) {
      v.gainNode.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.02);
    }
    v.nodes.forEach(n => {
      try { if (n.stop) n.stop(audioCtx.currentTime + 0.03); } catch (e) { }
    });
  });
  activeVoices.clear();
}

// 単音プレビュー
export function previewPitch(freq, instrumentKey = state.activeInstrument) {
  initAudioEngine();
  const v = createInstrumentVoice(instrumentKey, freq, audioCtx.currentTime, { id: 'preview' });
  setTimeout(() => {
    if (v && v.gainNode) {
      v.gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      setTimeout(() => {
        v.nodes.forEach(n => {
          try { if (n.stop) n.stop(); } catch (e) { }
          try { n.disconnect(); } catch (e) { }
        });
      }, 350);
    }
  }, 250);
}

/*************************************************************************
 * ドラム音声合成
 *************************************************************************/
export function triggerDrumVoice(trackIdx, time, velocity = 1.0) {
  if (!audioCtx) initAudioEngine();
  const track = DRUM_TRACKS[trackIdx];
  if (track.muted) return;

  const gainLevel = track.volume * velocity;
  const tune = 0.75 + (track.tune / 100) * 0.5;

  switch (track.id) {
    case 'kick': {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 * tune, time);
      osc.frequency.exponentialRampToValueAtTime(40 * tune, time + 0.08);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.35);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(gainLevel * 1.1, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
      osc.connect(gain);
      gain.connect(audioCtx.mainBus);
      osc.start(time);
      osc.stop(time + 0.40);
      break;
    }
    case 'snare': {
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(185 * tune, time);
      osc.frequency.exponentialRampToValueAtTime(90 * tune, time + 0.1);
      oscGain.gain.setValueAtTime(gainLevel * 0.6, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
      osc.connect(oscGain);
      oscGain.connect(audioCtx.mainBus);
      osc.start(time);
      osc.stop(time + 0.14);

      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1100 * tune, time);
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(gainLevel * 0.72, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.21);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioCtx.mainBus);
      noise.start(time);
      noise.stop(time + 0.23);
      break;
    }
    case 'clap': {
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1300 * tune, time);
      filter.Q.setValueAtTime(1.8, time);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      const burst = 0.011;
      for (let i = 0; i < 3; i++) {
        const t = time + i * burst;
        gain.gain.setValueAtTime(gainLevel * 0.62, t);
        gain.gain.exponentialRampToValueAtTime(0.02, t + burst * 0.9);
      }
      const tail = time + 3 * burst;
      gain.gain.setValueAtTime(gainLevel * 0.68, tail);
      gain.gain.exponentialRampToValueAtTime(0.001, tail + 0.23);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.mainBus);
      noise.start(time);
      noise.stop(tail + 0.25);
      break;
    }
    case 'ch':
    case 'oh': {
      const decay = track.id === 'ch' ? 0.045 : 0.28;
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const bandpass = audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(8500 * tune, time);
      bandpass.Q.setValueAtTime(1.2, time);
      const highpass = audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(6500 * tune, time);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(gainLevel * 0.62, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
      noise.connect(bandpass);
      bandpass.connect(highpass);
      highpass.connect(gain);
      gain.connect(audioCtx.mainBus);
      noise.start(time);
      noise.stop(time + decay + 0.02);
      break;
    }
  }
}
