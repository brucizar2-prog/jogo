// Som sintetizado em tempo real (WebAudio): efeitos e trilha original em estilo chiptune gótico.
// Nenhuma amostra de áudio do jogo original é utilizada.

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function freq(n) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  if (!m) return 0;
  const midi = NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// "E5:4 B4:2 -:2" -> [[nota, duração em semicolcheias]]
function seq(str) { return str.trim().split(/\s+/).map((t) => { const [n, d] = t.split(':'); return [n, parseFloat(d || '1')]; }); }

const SONGS = {
  title: {
    bpm: 96, loop: true,
    lead: seq('D5:4 F5:4 A5:8 G5:4 F5:4 E5:8 F5:4 E5:4 D5:4 C#5:4 D5:12 -:4 A5:4 Bb5:4 A5:4 G5:4 F5:6 G5:2 A5:8 Bb5:4 A5:4 G5:4 F5:4 E5:12 -:4'),
    harm: seq('A4:4 D5:4 F5:8 D5:4 Bb4:4 G4:8 A4:4 G4:4 F4:4 E4:4 F4:12 -:4 F5:4 G5:4 F5:4 E5:4 D5:8 F5:8 G5:4 F5:4 E5:4 D5:4 C#5:12 -:4'),
    bass: seq('D2:16 Bb1:16 G1:8 A1:8 D2:16 D2:16 Bb1:16 G1:8 A1:8 A1:16'),
    drums: null, leadVol: 0.12, harmVol: 0.05, bassVol: 0.22, organ: true,
  },
  stage: {
    bpm: 150, loop: true,
    lead: seq(`E5:4 B4:2 E5:2 G5:4 F#5:2 E5:2 D5:4 A4:2 D5:2 F#5:4 E5:2 D5:2 C5:4 G4:2 C5:2 E5:3 D5:1 C5:2 B4:2 B4:6 D#5:2 F#5:4 B5:4
      E5:2 G5:2 B5:4 A5:2 G5:2 F#5:2 G5:2 A5:2 G5:2 F#5:2 E5:2 D5:4 B4:4 C5:2 E5:2 A5:4 G5:2 F#5:2 E5:2 F#5:2 G5:4 F#5:4 E5:8
      B5:4 A5:2 G5:2 A5:4 G5:2 F#5:2 G5:4 F#5:2 E5:2 F#5:4 D#5:4 E5:2 F#5:2 G5:2 A5:2 B5:4 E5:4 C6:4 B5:2 A5:2 B5:8
      A5:2 G5:2 F#5:2 G5:2 A5:4 C6:4 B5:2 A5:2 G5:2 F#5:2 E5:4 D5:4 C5:2 D5:2 E5:2 F#5:2 G5:4 B5:4 B5:4 A#5:4 B5:8`),
    arp: [['E3', 'G3', 'B3'], ['D3', 'F#3', 'A3'], ['C3', 'E3', 'G3'], ['B2', 'D#3', 'F#3'], ['E3', 'G3', 'B3'], ['D3', 'F#3', 'B3'], ['A2', 'C3', 'E3'], ['B2', 'D#3', 'F#3'],
      ['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['B2', 'D#3', 'F#3'], ['D3', 'F#3', 'A3'], ['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['B2', 'D#3', 'F#3']],
    bass: seq(`E2:2 E2:2 E3:2 E2:2 E2:2 E2:2 E3:2 B1:2 D2:2 D2:2 D3:2 D2:2 D2:2 D2:2 D3:2 A1:2 C2:2 C2:2 C3:2 C2:2 C2:2 C2:2 C3:2 G1:2 B1:2 B1:2 B2:2 B1:2 B1:2 B1:2 B2:2 F#2:2
      E2:2 E2:2 E3:2 E2:2 E2:2 E2:2 E3:2 B1:2 D2:2 D2:2 D3:2 D2:2 B1:2 B1:2 B2:2 B1:2 A1:2 A1:2 A2:2 A1:2 C2:2 C2:2 C3:2 C2:2 B1:2 B1:2 B2:2 B1:2 E2:2 E2:2 E3:2 E2:2
      E2:2 E2:2 E3:2 E2:2 C2:2 C2:2 C3:2 C2:2 A1:2 A1:2 A2:2 A1:2 B1:2 B1:2 B2:2 B1:2 D2:2 D2:2 D3:2 D2:2 C2:2 C2:2 C3:2 C2:2 A1:2 A1:2 A2:2 A1:2 B1:2 B1:2 B2:2 B1:2`),
    drums: 'k-h-s-h-k-h-s-hk', leadVol: 0.1, arpVol: 0.035, bassVol: 0.2,
  },
  castle: {
    bpm: 160, loop: true,
    lead: seq(`C5:2 Eb5:2 G5:4 F5:2 Eb5:2 D5:2 Eb5:2 F5:2 Eb5:2 D5:2 C5:2 B4:4 G4:4 Ab4:2 C5:2 Eb5:4 D5:2 C5:2 Bb4:2 C5:2 D5:4 B4:4 G4:8
      C5:2 G5:2 C6:4 Bb5:2 Ab5:2 G5:2 Ab5:2 Bb5:2 Ab5:2 G5:2 F5:2 Eb5:4 C5:4 Ab5:4 G5:2 F5:2 Eb5:2 D5:2 C5:2 D5:2 B4:4 D5:4 C5:8`),
    arp: [['C3', 'Eb3', 'G3'], ['F3', 'Ab3', 'C4'], ['Ab2', 'C3', 'Eb3'], ['G2', 'B2', 'D3'], ['C3', 'Eb3', 'G3'], ['Eb3', 'G3', 'Bb3'], ['F3', 'Ab3', 'C4'], ['G2', 'B2', 'D3']],
    bass: seq(`C2:2 C2:2 G2:2 C2:2 C3:2 C2:2 G1:2 Bb1:2 F2:2 F2:2 C3:2 F2:2 G2:2 G2:2 D2:2 G1:2 Ab1:2 Ab1:2 Eb2:2 Ab1:2 Ab2:2 Ab1:2 Eb2:2 Ab1:2 G1:2 G1:2 D2:2 G1:2 G2:2 G1:2 B1:2 D2:2
      C2:2 C2:2 G2:2 C2:2 C3:2 C2:2 G1:2 C2:2 Eb2:2 Eb2:2 Bb2:2 Eb2:2 Eb3:2 Eb2:2 Bb1:2 Eb2:2 F2:2 F2:2 C3:2 F2:2 Ab2:2 F2:2 C2:2 F2:2 G1:2 G1:2 D2:2 G1:2 C2:2 G1:2 C2:2 C2:2`),
    drums: 'k-hsk-hsk-hsk-hs', leadVol: 0.1, arpVol: 0.035, bassVol: 0.2,
  },
  boss: {
    bpm: 168, loop: true,
    lead: seq('A5:2 -:2 E5:2 -:2 A5:2 C6:2 B5:4 G5:2 -:2 D5:2 -:2 G5:2 B5:2 A5:4 F5:2 -:2 C5:2 -:2 F5:2 A5:2 G#5:4 E5:2 F5:2 G#5:2 B5:2 E6:8'),
    arp: [['A2', 'C3', 'E3'], ['G2', 'B2', 'D3'], ['F2', 'A2', 'C3'], ['E2', 'G#2', 'B2']],
    bass: seq('A1:2 A1:2 A2:2 A1:2 A1:2 A2:2 A1:2 A2:2 G1:2 G1:2 G2:2 G1:2 G1:2 G2:2 G1:2 G2:2 F1:2 F1:2 F2:2 F1:2 F1:2 F2:2 F1:2 F2:2 E1:2 E1:2 E2:2 E1:2 E2:2 E1:2 G#1:2 B1:2'),
    drums: 'kkhskkhskkhskshs', leadVol: 0.1, arpVol: 0.04, bassVol: 0.22,
  },
  start: { bpm: 180, loop: false, lead: seq('E4:2 G4:2 B4:2 E5:2 D5:2 B4:2 E5:12'), bass: seq('E2:4 B1:4 E2:16'), leadVol: 0.12, bassVol: 0.2 },
  clear: { bpm: 170, loop: false, lead: seq('G4:2 C5:2 E5:2 G5:2 E5:2 G5:2 C6:12 B5:2 A5:2 G5:2 F#5:2 G5:12'), harm: seq('E4:2 G4:2 C5:2 E5:2 C5:2 E5:2 G5:12 G5:2 F5:2 E5:2 D5:2 D5:12'), bass: seq('C3:4 G2:4 C3:12 G2:4 G2:4 C3:12'), leadVol: 0.12, harmVol: 0.06, bassVol: 0.2 },
  death: { bpm: 120, loop: false, lead: seq('B4:2 A#4:2 A4:2 G#4:2 G4:4 E4:12'), bass: seq('E2:4 D#2:4 D2:4 E1:12'), leadVol: 0.12, bassVol: 0.2 },
  gameover: { bpm: 80, loop: false, lead: seq('A4:4 F4:4 D4:4 A3:4 Bb3:6 A3:2 A3:16'), bass: seq('D2:16 Bb1:8 A1:16'), leadVol: 0.12, bassVol: 0.2 },
  ending: { bpm: 110, loop: true, lead: seq('C5:4 E5:4 G5:6 F5:2 E5:4 D5:4 C5:8 F5:4 A5:4 C6:6 B5:2 A5:4 G5:4 E5:8 F5:4 E5:4 D5:4 G5:4 C5:16'),
    harm: seq('E4:4 G4:4 C5:6 A4:2 G4:4 F4:4 E4:8 A4:4 C5:4 E5:6 D5:2 C5:4 B4:4 G4:8 A4:4 G4:4 F4:4 B4:4 E4:16'),
    bass: seq('C2:8 C2:8 F1:8 G1:8 F2:8 F2:8 C2:8 C2:8 F1:8 G1:8 C2:16'), leadVol: 0.11, harmVol: 0.05, bassVol: 0.2 },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('gng3d.mute') === '1'; } catch (e) { /* armazenamento indisponível */ }
    this.music = new Music(this);
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.6;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.7; this.musicBus.connect(this.master);
    // eco leve para a música (ambiente de catedral)
    const delay = c.createDelay(); delay.delayTime.value = 0.23;
    const fb = c.createGain(); fb.gain.value = 0.22;
    const wet = c.createGain(); wet.gain.value = 0.25;
    this.musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master);
    // ondas quadradas com ciclo de trabalho (25% e 12.5%)
    this.pulse25 = this.pulseWave(0.25); this.pulse12 = this.pulseWave(0.125);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  pulseWave(duty) {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) { re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty); im[k] = 0; }
    return this.ctx.createPeriodicWave(re, im);
  }
  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('gng3d.mute', this.muted ? '1' : '0'); } catch (e) { /* ignorado */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  // ---------------------------------------------------------------- primitivas
  tone(type, f0, f1, dur, vol, t0 = 0, bus = this.sfxBus, opts = {}) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator();
    if (type === 'p25') o.setPeriodicWave(this.pulse25); else if (type === 'p12') o.setPeriodicWave(this.pulse12); else o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (opts.vib) { const l = c.createOscillator(); const lg = c.createGain(); l.frequency.value = opts.vib; lg.gain.value = f0 * 0.03; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, filter = 'lowpass', fq = 2000, fq1 = null, t0 = 0, q = 1, bus = this.sfxBus) {
    const c = this.ctx, t = c.currentTime + t0;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(fq, t); f.Q.value = q;
    if (fq1) f.frequency.exponentialRampToValueAtTime(fq1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  arp(notes, step, type = 'p25', vol = 0.15, dur = null) {
    notes.forEach((n, i) => this.tone(type, freq(n), freq(n), dur || step * 1.6, vol, i * step));
  }

  sfx(name, v = 1) {
    if (!this.ensure() || this.muted) return;
    const now = this.ctx.currentTime;
    this._last = this._last || {};
    if (this._last[name] && now - this._last[name] < 0.04) return;   // evita empilhar o mesmo som
    this._last[name] = now;
    const V = (x) => x * v;
    switch (name) {
      case 'throw': this.tone('p25', 1100, 260, 0.09, V(0.12)); this.noise(0.05, V(0.08), 'highpass', 3000); break;
      case 'jump': this.tone('p12', 280, 620, 0.1, V(0.07)); break;
      case 'frogjump': this.tone('sine', 180, 520, 0.14, V(0.2)); break;
      case 'land': this.noise(0.07, V(0.12), 'lowpass', 500); break;
      case 'hit': this.noise(0.06, V(0.18), 'bandpass', 2400, 800, 0, 2); this.tone('square', 900, 300, 0.07, V(0.08)); break;
      case 'kill': this.noise(0.28, V(0.22), 'lowpass', 3000, 200); this.tone('p25', 700, 90, 0.25, V(0.1)); break;
      case 'bigkill': this.noise(0.6, V(0.3), 'lowpass', 2500, 100); this.tone('sawtooth', 300, 40, 0.6, V(0.12)); break;
      case 'block': this.tone('square', 2400, 2200, 0.06, V(0.08)); this.tone('square', 3300, 3100, 0.05, V(0.05)); break;
      case 'armor':
        [523, 659, 831, 1046, 1318].forEach((f, i) => this.tone('square', f * 1.5, f, 0.35, V(0.06), i * 0.015));
        this.noise(0.4, V(0.25), 'highpass', 2000, 6000); break;
      case 'armorup': this.arp(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.05, 'p25', V(0.1)); break;
      case 'weapon': this.arp(['G5', 'B5', 'D6', 'G6'], 0.05, 'p25', V(0.1)); break;
      case 'treasure': this.arp(['E6', 'G6', 'E6', 'C7'], 0.045, 'p12', V(0.08)); break;
      case 'key': this.arp(['C5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.06, 'p25', V(0.12)); break;
      case 'secret': this.arp(['A5', 'C#6', 'E6', 'A6', 'E6', 'A6', 'C#7'], 0.05, 'p12', V(0.1)); break;
      case 'extend': this.arp(['C6', 'E6', 'G6', 'C7', 'G6', 'C7'], 0.07, 'p25', V(0.12)); break;
      case 'death': this.noise(0.5, V(0.25), 'lowpass', 1800, 100); break;
      case 'splash': this.noise(0.5, V(0.3), 'bandpass', 1500, 400, 0, 0.8); this.noise(0.25, V(0.2), 'highpass', 4000); break;
      case 'burn': this.noise(0.7, V(0.3), 'bandpass', 800, 3000, 0, 0.6); break;
      case 'zombie': this.tone('sawtooth', 90, 55, 0.6, V(0.12), 0, this.sfxBus, { vib: 9, attack: 0.15 }); this.noise(0.4, V(0.12), 'lowpass', 600); break;
      case 'crow': this.tone('p12', 1100, 700, 0.12, V(0.1)); this.tone('p12', 1000, 650, 0.14, V(0.1), 0.16); break;
      case 'spit': this.noise(0.12, V(0.14), 'bandpass', 1200, 400, 0, 3); this.tone('square', 220, 120, 0.1, V(0.06)); break;
      case 'fireball': case 'dragonfire': this.noise(0.3, V(0.2), 'bandpass', 700, 2200, 0, 1.5); this.tone('sawtooth', 160, 80, 0.25, V(0.08)); break;
      case 'arremer': this.tone('sawtooth', 220, 440, 0.3, V(0.1), 0, this.sfxBus, { vib: 30 }); break;
      case 'knight': this.tone('p12', 160, 140, 0.4, V(0.06), 0, this.sfxBus, { vib: 6 }); break;
      case 'pig': this.tone('square', 500, 350, 0.08, V(0.07)); this.tone('square', 450, 300, 0.08, V(0.07), 0.1); break;
      case 'spear': this.tone('triangle', 700, 300, 0.1, V(0.12)); break;
      case 'bat': this.tone('p12', 2600, 1800, 0.06, V(0.06)); this.tone('p12', 2500, 1700, 0.06, V(0.06), 0.08); break;
      case 'orb': this.tone('sine', 300, 700, 0.18, V(0.15)); break;
      case 'tower': this.tone('sawtooth', 80, 160, 0.8, V(0.12), 0, this.sfxBus, { vib: 12, attack: 0.2 }); break;
      case 'bones': this.noise(0.08, V(0.15), 'highpass', 2500); this.noise(0.08, V(0.15), 'highpass', 2000, null, 0.1); break;
      case 'jet': this.noise(0.6, V(0.18), 'lowpass', 400, 1500); break;
      case 'lavaburst': this.noise(0.5, V(0.22), 'lowpass', 300, 1200); break;
      case 'flail': this.tone('triangle', 300, 150, 0.2, V(0.15)); break;
      case 'stomp': this.tone('sine', 90, 40, 0.18, V(0.3)); this.noise(0.08, V(0.1), 'lowpass', 300); break;
      case 'land_big': this.tone('sine', 70, 30, 0.4, V(0.45)); this.noise(0.3, V(0.25), 'lowpass', 400); break;
      case 'roar': this.tone('sawtooth', 140, 70, 0.6, V(0.14), 0, this.sfxBus, { vib: 18, attack: 0.05 }); this.noise(0.5, V(0.1), 'bandpass', 500, 200, 0, 2); break;
      case 'star': this.tone('triangle', 1800, 900, 0.12, V(0.1)); break;
      case 'satan': this.tone('sawtooth', 110, 220, 0.5, V(0.14), 0, this.sfxBus, { vib: 25 }); break;
      case 'bosshit': this.tone('square', 160, 90, 0.12, V(0.18)); this.noise(0.1, V(0.2), 'bandpass', 1500, 600, 0, 2); break;
      case 'bossdie': this.noise(1.6, V(0.4), 'lowpass', 2000, 60); this.tone('sawtooth', 200, 30, 1.4, V(0.15)); break;
      case 'door': this.noise(1.6, V(0.25), 'lowpass', 200, 600, 0, 4); this.tone('square', 60, 50, 1.5, V(0.06)); break;
      case 'keyfall': this.arp(['E6', 'D6', 'C6', 'B5', 'A5'], 0.06, 'p12', V(0.08)); break;
      case 'pot': this.tone('triangle', 1400, 1300, 0.08, V(0.12)); this.noise(0.12, V(0.12), 'highpass', 3000); break;
      case 'torch': this.noise(0.4, V(0.18), 'bandpass', 900, 2500, 0, 0.8); break;
      case 'magician': case 'spell': case 'transform': this.tone('sine', 400, 1600, 0.4, V(0.12), 0, this.sfxBus, { vib: 14 }); this.tone('sine', 600, 2400, 0.4, V(0.06), 0.05); break;
      case 'hurry': this.arp(['A6', '-0', 'A6', '-0', 'A6'], 0.12, 'p25', V(0.08)); break;
      case 'select': this.tone('p25', 880, 880, 0.06, V(0.1)); break;
      case 'coin': this.arp(['B5', 'E6'], 0.07, 'p25', V(0.12)); break;
    }
  }
}

class Music {
  constructor(audio) { this.a = audio; this.cur = null; this.timer = null; }
  play(name) {
    if (!this.a.ensure()) return;
    if (this.cur === name) return;
    this.stop();
    const song = SONGS[name];
    if (!song) return;
    this.cur = name;
    const c = this.a.ctx;
    const step = 60 / song.bpm / 4;  // semicolcheia
    const tracks = [];
    const add = (notes, voice, vol) => { if (notes) tracks.push({ notes, voice, vol, i: 0, t: c.currentTime + 0.08 }); };
    add(song.lead, song.organ ? 'organ' : 'lead', song.leadVol);
    add(song.harm, 'harm', song.harmVol);
    add(song.bass, 'bass', song.bassVol);
    // arpejo: 16 semicolcheias por compasso, um acorde por compasso
    if (song.arp) {
      const notes = [];
      for (const ch of song.arp) for (let k = 0; k < 16; k++) notes.push([ch[k % 3], 1]);
      add(notes, 'arp', song.arpVol);
    }
    if (song.drums) {
      const total = (song.lead || song.bass).reduce((s, n) => s + n[1], 0);
      const notes = [];
      for (let k = 0; k < total; k++) notes.push([song.drums[k % song.drums.length], 1]);
      add(notes, 'drum', 0.18);
    }
    const tick = () => {
      if (this.cur !== name) return;
      const ahead = c.currentTime + 0.25;
      let alive = false;
      for (const tr of tracks) {
        while (tr.t < ahead) {
          if (tr.i >= tr.notes.length) { if (song.loop) tr.i = 0; else break; }
          const [n, d] = tr.notes[tr.i++];
          this.voice(tr.voice, n, tr.t, d * step, tr.vol);
          tr.t += d * step;
        }
        if (song.loop || tr.i < tr.notes.length) alive = true;
      }
      if (!alive) { this.cur = null; return; }
      this.timer = setTimeout(tick, 60);
    };
    tick();
  }
  voice(v, n, t, dur, vol) {
    const a = this.a, c = a.ctx;
    if (this.a.muted) return;
    if (v === 'drum') {
      if (n === 'k') { const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(vol * 1.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.connect(g); g.connect(a.musicBus); o.start(t); o.stop(t + 0.16); }
      else if (n === 's') this.noiseAt(t, 0.12, vol * 0.9, 'bandpass', 1800);
      else if (n === 'h') this.noiseAt(t, 0.03, vol * 0.4, 'highpass', 7000);
      return;
    }
    const f = freq(n);
    if (!f) return;
    const o = c.createOscillator();
    const g = c.createGain();
    if (v === 'lead') o.setPeriodicWave(a.pulse25);
    else if (v === 'harm' || v === 'arp') o.setPeriodicWave(a.pulse12);
    else if (v === 'organ') o.type = 'square';
    else o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    const rel = Math.min(dur * 0.9, v === 'bass' ? dur * 0.85 : dur * 0.95);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol * (v === 'arp' ? 0.6 : 0.85), t + Math.min(0.05, rel * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + rel);
    if (v === 'lead' && dur > 0.25) { const l = c.createOscillator(); const lg = c.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + dur); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
    o.connect(g); g.connect(a.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noiseAt(t, dur, vol, type, fq) {
    const c = this.a.ctx;
    const s = c.createBufferSource(); s.buffer = this.a.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = fq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.a.musicBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.01);
  }
  stop() { this.cur = null; if (this.timer) clearTimeout(this.timer); this.timer = null; }
}
