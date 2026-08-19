
// ── NOTAS BASE (C4) ──
const BASE_NOTES = [
  {name:'C',  freq:261.63, key:'A'},
  {name:'D',  freq:293.66, key:'S'},
  {name:'E',  freq:329.63, key:'D'},
  {name:'F',  freq:349.23, key:'F'},
  {name:'G',  freq:392.00, key:'G'},
  {name:'A',  freq:440.00, key:'H'},
  {name:'B',  freq:493.88, key:'J'},
  {name:'C5', freq:523.25, key:'K'},
];

let octave = 4;
let bpm = 120;
let waveType = 'sine';
let recording = false;
let recorded = [];
let playbackTimeout = [];

// ── AUDIO ──
let ctx;
function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
}

function getFreq(baseFreq) {
  const diff = octave - 4;
  return baseFreq * Math.pow(2, diff);
}

function getVolume() { return parseFloat(document.getElementById('volume').value); }
function getDecay()  { return parseInt(document.getElementById('decay').value); }

// ── REVERB CONVOLUÇÃO SIMPLES ──
let convolver = null;
async function makeReverb(amount) {
  ensureCtx();
  if (!convolver) {
    convolver = ctx.createConvolver();
    const length = ctx.sampleRate * 2;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random()*2-1) * Math.pow(1 - i/length, 3);
      }
    }
    convolver.buffer = impulse;
  }
  return convolver;
}

async function tocar(noteObj, el) {
  ensureCtx();
  const freq = getFreq(noteObj.freq);
  const vol  = getVolume();
  const dec  = getDecay();
  const revAmt = parseFloat(document.getElementById('reverb').value);

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = waveType;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(vol * 0.7, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dec/1000);

  if (revAmt > 0.01) {
    const rev = await makeReverb(revAmt);
    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();
    wetGain.gain.value = revAmt;
    dryGain.gain.value = 1 - revAmt * 0.5;

    osc.connect(gain);
    gain.connect(dryGain); dryGain.connect(ctx.destination);
    gain.connect(rev);     rev.connect(wetGain); wetGain.connect(ctx.destination);
  } else {
    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  osc.start();
  osc.stop(ctx.currentTime + dec/1000 + 0.05);

  // UI
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), Math.min(dec, 250));

  document.getElementById('freq-display').textContent = Math.round(freq) + ' Hz';
  drawWave(freq);
  logNote(noteObj.name, freq);

  // RECORD
  if (recording) {
    recorded.push({ noteObj, timestamp: Date.now() });
  }
}

// ── VISUALIZER ──
let animId;
function drawWave(freq) {
  cancelAnimationFrame(animId);
  const canvas = document.getElementById('visualizer');
  const ctx2 = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let phase = 0;
  const speed = (freq / 440) * 0.08;

  function frame() {
    ctx2.clearRect(0,0,W,H);
    ctx2.strokeStyle = '#00e5ff';
    ctx2.lineWidth = 2;
    ctx2.shadowColor = '#00e5ff';
    ctx2.shadowBlur = 6;
    ctx2.beginPath();
    for (let x = 0; x < W; x++) {
      const t = x / W;
      const y = H/2 + Math.sin(t * Math.PI * 6 + phase) * (H * 0.35) * Math.exp(-t * 1.5);
      x === 0 ? ctx2.moveTo(x,y) : ctx2.lineTo(x,y);
    }
    ctx2.stroke();
    phase += speed;
    animId = requestAnimationFrame(frame);
    setTimeout(() => cancelAnimationFrame(animId), getDecay() + 300);
  }
  frame();
}

// ── LOG ──
function logNote(name, freq) {
  const log = document.getElementById('notes-log');
  const now = new Date();
  const time = now.toTimeString().slice(0,8);
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="note-name">${name}${octave}  •  ${Math.round(freq)}Hz</span><span class="note-time">${time}</span>`;
  if (log.firstChild && log.firstChild.textContent === 'Nenhuma nota registrada ainda.') log.innerHTML = '';
  log.prepend(entry);
  if (log.children.length > 30) log.removeChild(log.lastChild);
}

// ── CRIAR TECLAS ──
const tecladoDiv = document.getElementById('teclado');
BASE_NOTES.forEach((n, i) => {
  const div = document.createElement('div');
  div.className = 'key';
  div.dataset.idx = i;
  div.innerHTML = `<span class="key-label">${n.key}</span><span class="key-note">${n.name}</span>`;
  div.addEventListener('mousedown', () => tocar(n, div));
  tecladoDiv.appendChild(div);
});

// ── TECLADO PC ──
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const tecla = e.key.toUpperCase();
  BASE_NOTES.forEach((n, i) => {
    if (tecla === n.key) {
      const el = document.querySelector(`.key[data-idx="${i}"]`);
      tocar(n, el);
    }
  });
});

// ── CONTROLES UI ──
document.getElementById('volume').addEventListener('input', e => {
  document.getElementById('vol-val').textContent = Math.round(e.target.value * 100) + '%';
});

document.getElementById('decay').addEventListener('input', e => {
  document.getElementById('decay-val').textContent = e.target.value + 'ms';
});

document.getElementById('reverb').addEventListener('input', e => {
  document.getElementById('rev-val').textContent = Math.round(e.target.value * 100) + '%';
});

// ── WAVE BUTTONS ──
document.querySelectorAll('.wave-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.wave-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    waveType = btn.dataset.wave;
  });
});

// ── OCTAVE ──
let octMin = 2, octMax = 7;
document.getElementById('oct-up').addEventListener('click', () => {
  if (octave < octMax) { octave++; document.getElementById('oct-val').textContent = octave; }
});
document.getElementById('oct-down').addEventListener('click', () => {
  if (octave > octMin) { octave--; document.getElementById('oct-val').textContent = octave; }
});

// ── BPM ──
document.getElementById('bpm-up').addEventListener('click', () => {
  bpm = Math.min(240, bpm + 5);
  document.getElementById('bpm-val').textContent = bpm;
});
document.getElementById('bpm-down').addEventListener('click', () => {
  bpm = Math.max(40, bpm - 5);
  document.getElementById('bpm-val').textContent = bpm;
});

// ── GRAVAÇÃO ──
const recBtn   = document.getElementById('rec-btn');
const playBtn  = document.getElementById('play-btn');
const clearBtn = document.getElementById('clear-btn');
const recStat  = document.getElementById('rec-status');

recBtn.addEventListener('click', () => {
  recording = !recording;
  if (recording) {
    recorded = [];
    recBtn.classList.add('recording');
    recBtn.textContent = '■ STOP';
    recStat.style.color = '#ef4444';
    recStat.textContent = 'GRAVANDO...';
    playBtn.disabled = true;
  } else {
    recBtn.classList.remove('recording');
    recBtn.textContent = '● REC';
    recStat.style.color = 'var(--accent3)';
    recStat.textContent = `${recorded.length} NOTAS GRAVADAS`;
    if (recorded.length > 0) playBtn.disabled = false;
  }
});

playBtn.addEventListener('click', () => {
  if (recorded.length === 0) return;
  playBtn.disabled = true;
  recStat.style.color = 'var(--accent3)';
  recStat.textContent = 'REPRODUZINDO...';

  const start = recorded[0].timestamp;
  playbackTimeout = recorded.map(r => {
    const delay = r.timestamp - start;
    return setTimeout(() => {
      const idx = BASE_NOTES.findIndex(n => n.name === r.noteObj.name);
      const el = document.querySelector(`.key[data-idx="${idx}"]`);
      if (el) tocar(r.noteObj, el);
    }, delay);
  });

  const total = recorded[recorded.length - 1].timestamp - start + 500;
  setTimeout(() => {
    playBtn.disabled = false;
    recStat.textContent = `${recorded.length} NOTAS GRAVADAS`;
  }, total);
});

clearBtn.addEventListener('click', () => {
  playbackTimeout.forEach(clearTimeout);
  recorded = [];
  recording = false;
  recBtn.classList.remove('recording');
  recBtn.textContent = '● REC';
  playBtn.disabled = true;
  recStat.style.color = 'var(--muted)';
  recStat.textContent = 'AGUARDANDO GRAVAÇÃO...';
  document.getElementById('notes-log').innerHTML = '<div style="color:var(--muted);font-size:10px;">Nenhuma nota registrada ainda.</div>';
});
