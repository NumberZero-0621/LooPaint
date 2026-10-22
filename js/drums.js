/*************************************************************************
 * ドラムUI ＆ パッド描画 ＆ ステップハイライト
 *************************************************************************/
import { STEPS_PER_BAR, DRUM_TRACKS } from './constants.js';
import { state, musicData } from './state.js';
import { initAudioEngine, getAudioCtx, triggerDrumVoice } from './audio.js';

export function buildDrumUI() {
  const ruler = document.getElementById('drumStepRuler');
  ruler.innerHTML = '';
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    const div = document.createElement('div');
    div.id = `drum-ruler-${s}`;
    div.className = `h-5 rounded flex items-center justify-center font-mono text-[10px] border themed-border transition ${s % 4 === 0 ? 'themed-surface text-white font-bold' : 'themed-text-muted'
      }`;
    div.textContent = String(s + 1).padStart(2, '0');
    ruler.appendChild(div);
  }

  const container = document.getElementById('drumTracksContainer');
  container.innerHTML = '';

  DRUM_TRACKS.forEach((track, tIdx) => {
    const row = document.createElement('div');
    row.className = 'flex items-center';

    const header = document.createElement('div');
    header.className = 'w-48 flex-shrink-0 pr-2 flex items-center justify-between themed-surface border themed-border rounded-l px-2 py-1 mr-1';
    header.innerHTML = `
      <div class="flex items-center space-x-1.5">
        <button data-audition="${tIdx}" class="px-1.5 py-0.5 rounded border themed-border hover:bg-slate-500/20 text-left transition flex items-center space-x-1" title="試聴">
          <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${track.color};"></span>
          <span class="font-bold text-[11px]">${track.short}</span>
        </button>
      </div>
      <div class="flex items-center space-x-1.5">
        <input type="range" min="0" max="100" value="${Math.round(track.volume * 100)}" data-drum-vol="${tIdx}" class="flat-slider w-12" title="音量" />
        <button data-drum-mute="${tIdx}" class="px-1 py-0.5 rounded text-[9px] font-bold border themed-border themed-text-muted hover:text-white transition" title="消音">消音</button>
      </div>
    `;

    const stepsGrid = document.createElement('div');
    stepsGrid.className = 'flex-1 grid grid-cols-16 gap-1';

    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const btn = document.createElement('button');
      btn.id = `drum-pad-${tIdx}-${s}`;
      btn.className = `step-pad h-6 rounded border themed-border flex items-center justify-center ${Math.floor(s / 4) % 2 === 1 ? 'themed-surface' : 'themed-panel'
        } hover:border-slate-400`;

      btn.addEventListener('click', (e) => {
        initAudioEngine();
        const cur = musicData.drumPattern[tIdx][s];
        musicData.drumPattern[tIdx][s] = e.shiftKey ? (cur === 2 ? 0 : 2) : (cur > 0 ? 0 : 1);
        if (musicData.drumPattern[tIdx][s] > 0 && !state.isPlaying) {
          const audioCtx = getAudioCtx();
          triggerDrumVoice(tIdx, audioCtx.currentTime, musicData.drumPattern[tIdx][s] === 2 ? 1.35 : 0.95);
        }
        renderDrumPad(tIdx, s);
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        musicData.drumPattern[tIdx][s] = musicData.drumPattern[tIdx][s] === 2 ? 0 : 2;
        renderDrumPad(tIdx, s);
      });

      stepsGrid.appendChild(btn);
    }

    row.appendChild(header);
    row.appendChild(stepsGrid);
    container.appendChild(row);
  });

  container.querySelectorAll('[data-audition]').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudioEngine();
      const audioCtx = getAudioCtx();
      triggerDrumVoice(parseInt(btn.dataset.audition, 10), audioCtx.currentTime, 1.0);
    });
  });
  container.querySelectorAll('[data-drum-vol]').forEach(slider => {
    slider.addEventListener('input', (e) => {
      DRUM_TRACKS[parseInt(slider.dataset.drumVol, 10)].volume = parseInt(e.target.value, 10) / 100;
    });
  });
  container.querySelectorAll('[data-drum-mute]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tIdx = parseInt(btn.dataset.drumMute, 10);
      DRUM_TRACKS[tIdx].muted = !DRUM_TRACKS[tIdx].muted;
      btn.classList.toggle('bg-rose-500', DRUM_TRACKS[tIdx].muted);
      btn.classList.toggle('text-white', DRUM_TRACKS[tIdx].muted);
    });
  });
}

export function renderDrumPad(tIdx, s) {
  const btn = document.getElementById(`drum-pad-${tIdx}-${s}`);
  if (!btn) return;
  const val = musicData.drumPattern[tIdx][s];
  const track = DRUM_TRACKS[tIdx];

  if (val === 1) {
    btn.style.backgroundColor = track.color;
    btn.style.borderColor = track.color;
    btn.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-white"></span>`;
  } else if (val === 2) {
    btn.style.backgroundColor = track.color;
    btn.style.borderColor = '#ffffff';
    btn.innerHTML = `<span class="w-2.5 h-2.5 rounded-sm bg-white"></span>`;
  } else {
    btn.style.backgroundColor = '';
    btn.style.borderColor = '';
    btn.innerHTML = '';
  }
}

export function clearPlayheadHighlights() {
  document.querySelectorAll('.playhead-active').forEach(el => el.classList.remove('playhead-active'));
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    const r = document.getElementById(`drum-ruler-${s}`);
    if (r) {
      r.className = `h-5 rounded flex items-center justify-center font-mono text-[10px] border themed-border transition ${s % 4 === 0 ? 'themed-surface text-white font-bold' : 'themed-text-muted'
        }`;
    }
  }
}

export function highlightDrumColumn(step) {
  clearPlayheadHighlights();
  const r = document.getElementById(`drum-ruler-${step}`);
  if (r) {
    r.className = 'h-5 rounded flex items-center justify-center font-mono text-[10px] border bg-amber-500 text-white border-amber-400 font-bold';
  }
  for (let t = 0; t < DRUM_TRACKS.length; t++) {
    const pad = document.getElementById(`drum-pad-${t}-${step}`);
    if (pad) pad.classList.add('playhead-active');
  }
}
