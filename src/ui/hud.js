// HUD em DOM sobre o canvas 3D + telas (título, mapa, mensagens).
const $ = (id) => document.getElementById(id);

const STAGE_NAMES = { 1: 'Cemitério e Floresta', 2: 'Palácio de Gelo e Cidade Fantasma', 3: 'Cavernas', 4: 'Ponte de Fogo', 5: 'Torre', 6: 'Castelo', 7: 'Sala do Trono' };

export class Hud {
  constructor() {
    this.el = $('hud');
    this.score = $('hud-score'); this.top = $('hud-top'); this.time = $('hud-time');
    this.lives = $('hud-lives'); this.weapon = $('hud-weapon'); this.stage = $('hud-stage');
    this.screen = $('screen'); this.banner = $('banner'); this.fade = $('fade');
    this.cache = {};
    this.weaponCanvas = document.createElement('canvas');
    this.weaponCanvas.width = 32; this.weaponCanvas.height = 32;
    this.weapon.appendChild(this.weaponCanvas);
  }
  show(on) { this.el.classList.toggle('hidden', !on); }
  set(k, el, v) { if (this.cache[k] !== v) { this.cache[k] = v; el.textContent = v; } }
  update(game, session) {
    this.set('score', this.score, String(session.score));
    this.set('top', this.top, String(Math.max(session.top, session.score)));
    const secs = Math.ceil(game.time / 60);
    this.set('time', this.time, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    this.time.classList.toggle('hurry', secs <= 30);
    const lv = Math.max(0, session.lives - 1);
    if (this.cache.lives !== lv) { this.cache.lives = lv; this.lives.innerHTML = '<i></i>'.repeat(Math.min(lv, 9)); }
    this.set('stage', this.stage, `FASE ${Math.min(game.stage, 6)}${game.stage === 7 ? ' · FINAL' : ''}`);
    const w = game.player.weapon;
    if (this.cache.weapon !== w) { this.cache.weapon = w; drawWeaponIcon(this.weaponCanvas, w); }
  }
  setScreen(html, interactive = false) {
    this.screen.innerHTML = html;
    this.screen.classList.toggle('interactive', interactive);
  }
  setBanner(html) {
    if (!html) { this.banner.classList.add('hidden'); return; }
    this.banner.innerHTML = html; this.banner.classList.remove('hidden');
  }
  fadeTo(on) { this.fade.classList.toggle('on', on); }
}

export function drawWeaponIcon(c, w) {
  const x = c.getContext('2d');
  x.clearRect(0, 0, 32, 32);
  x.save();
  x.translate(16, 16);
  x.lineCap = 'round';
  if (w === 'lance') {
    x.rotate(-0.6);
    x.strokeStyle = '#8a5a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(-13, 0); x.lineTo(7, 0); x.stroke();
    x.fillStyle = '#e8eef8'; x.beginPath(); x.moveTo(6, -4); x.lineTo(15, 0); x.lineTo(6, 4); x.fill();
  } else if (w === 'dagger') {
    x.rotate(-0.6);
    x.fillStyle = '#e8eef8'; x.beginPath(); x.moveTo(-2, -3); x.lineTo(13, 0); x.lineTo(-2, 3); x.fill();
    x.fillStyle = '#d8a038'; x.fillRect(-5, -6, 3, 12);
    x.fillStyle = '#6a3a1a'; x.fillRect(-12, -2, 7, 4);
  } else if (w === 'torch') {
    x.rotate(-0.6);
    x.fillStyle = '#7a4a22'; x.fillRect(-12, -2, 16, 4);
    const g = x.createRadialGradient(8, 0, 1, 8, 0, 9); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.5, '#ff8a20'); g.addColorStop(1, 'rgba(255,40,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(8, 0, 9, 0, 7); x.fill();
  } else if (w === 'axe') {
    x.fillStyle = '#7a4a22'; x.fillRect(-2, -12, 4, 24);
    x.fillStyle = '#e8eef8'; x.beginPath(); x.moveTo(2, -10); x.quadraticCurveTo(14, -8, 12, 2); x.lineTo(2, -2); x.fill();
  } else if (w === 'cross') {
    x.fillStyle = '#f0c040'; x.fillRect(-3, -12, 6, 24); x.fillRect(-10, -6, 20, 6);
    x.fillStyle = '#e02a2a'; x.beginPath(); x.arc(0, -3, 2.5, 0, 7); x.fill();
  }
  x.restore();
}

// ---------------------------------------------------------------- mapa entre fases
export function drawMap(canvas, stage, t) {
  const W = canvas.width, H = canvas.height, x = canvas.getContext('2d');
  // céu noturno
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05061a'); sky.addColorStop(0.6, '#1a1636'); sky.addColorStop(1, '#2a1a2a');
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  // estrelas
  for (let i = 0; i < 120; i++) {
    const sx = (i * 137.5) % W, sy = (i * 71.3) % (H * 0.5);
    x.fillStyle = `rgba(220,230,255,${0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i))})`;
    x.fillRect(sx, sy, 1.5, 1.5);
  }
  // lua
  const mg = x.createRadialGradient(W * 0.12, H * 0.16, 2, W * 0.12, H * 0.16, 60);
  mg.addColorStop(0, '#fff8e0'); mg.addColorStop(0.25, '#f0ecd8'); mg.addColorStop(0.3, 'rgba(200,210,255,.3)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = mg; x.beginPath(); x.arc(W * 0.12, H * 0.16, 60, 0, 7); x.fill();
  const gy = H * 0.78;
  // montanha central e castelo de Astaroth (o caminho sobe até ele, como no mapa do arcade)
  x.fillStyle = '#4a3a2a';
  x.beginPath(); x.moveTo(W * 0.42, gy); x.lineTo(W * 0.55, H * 0.42); x.lineTo(W * 0.66, H * 0.3); x.lineTo(W * 0.74, H * 0.36); x.lineTo(W * 0.86, H * 0.22); x.lineTo(W, H * 0.5); x.lineTo(W, gy); x.closePath(); x.fill();
  x.fillStyle = '#5c4a34';
  x.beginPath(); x.moveTo(W * 0.5, gy); x.lineTo(W * 0.6, H * 0.5); x.lineTo(W * 0.7, H * 0.45); x.lineTo(W * 0.8, gy); x.closePath(); x.fill();
  // castelo
  const cx = W * 0.86, cyy = H * 0.22;
  x.fillStyle = '#6a50a8'; x.fillRect(cx - 34, cyy - 60, 68, 64);
  x.fillRect(cx - 46, cyy - 40, 14, 44); x.fillRect(cx + 32, cyy - 40, 14, 44);
  x.fillStyle = '#8a70c8'; for (let i = -3; i <= 3; i++) x.fillRect(cx + i * 10 - 3, cyy - 70, 6, 10);
  x.fillStyle = '#1a1030'; x.fillRect(cx - 6, cyy - 16, 12, 20);
  x.fillStyle = '#ffd060'; x.fillRect(cx - 20, cyy - 44, 6, 8); x.fillRect(cx + 14, cyy - 44, 6, 8);
  // chão
  x.fillStyle = '#1e3a14'; x.fillRect(0, gy, W, H - gy);
  // regiões
  const regions = [
    { x: 0.04, w: 0.16, c: '#2e6a22', label: '1' },
    { x: 0.2, w: 0.16, c: '#3a6aa8', label: '2' },
    { x: 0.36, w: 0.14, c: '#7a5a30', label: '3' },
    { x: 0.5, w: 0.13, c: '#a83a1a', label: '4' },
    { x: 0.63, w: 0.12, c: '#7a5a8a', label: '5' },
    { x: 0.75, w: 0.2, c: '#6a50a8', label: '6' },
  ];
  // túmulos (fase 1)
  x.fillStyle = '#8a8a96';
  for (let i = 0; i < 8; i++) { const tx = W * (0.05 + i * 0.018); x.fillRect(tx, gy - 10, 8, 10); x.beginPath(); x.arc(tx + 4, gy - 10, 4, Math.PI, 0); x.fill(); }
  // casas (fase 2)
  for (let i = 0; i < 5; i++) {
    const hx = W * (0.21 + i * 0.03), hh = 26 + (i % 3) * 12;
    x.fillStyle = ['#5a5040', '#8a4a20', '#4a5a50'][i % 3]; x.fillRect(hx, gy - hh, W * 0.026, hh);
    x.fillStyle = '#1e6a5a'; x.beginPath(); x.moveTo(hx - 2, gy - hh); x.lineTo(hx + W * 0.013, gy - hh - 10); x.lineTo(hx + W * 0.028, gy - hh); x.fill();
  }
  // lava (fase 4)
  const lg = x.createLinearGradient(0, gy - 6, 0, gy + 6); lg.addColorStop(0, '#ffd040'); lg.addColorStop(1, '#a01000');
  x.fillStyle = lg; x.fillRect(W * 0.5, gy - 4, W * 0.13, 10);
  // caminho pontilhado
  const pts = [[0.06, 0.8], [0.2, 0.8], [0.34, 0.8], [0.46, 0.72], [0.58, 0.62], [0.68, 0.5], [0.78, 0.38], [0.86, 0.26]];
  x.setLineDash([6, 8]); x.lineWidth = 3; x.strokeStyle = 'rgba(255,240,200,.75)';
  x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px * W, py * H) : x.moveTo(px * W, py * H))); x.stroke();
  x.setLineDash([]);
  // marcadores de fase
  const stops = [[0.1, 0.8], [0.27, 0.8], [0.41, 0.77], [0.55, 0.66], [0.66, 0.53], [0.8, 0.35]];
  stops.forEach(([px, py], i) => {
    const done = i + 1 < stage, cur = i + 1 === Math.min(stage, 6);
    x.fillStyle = done ? '#ffcf4a' : cur ? '#ff3b2f' : '#2a2a3a';
    x.strokeStyle = '#000'; x.lineWidth = 3;
    x.beginPath(); x.arc(px * W, py * H, cur ? 13 : 10, 0, 7); x.fill(); x.stroke();
    x.fillStyle = done || cur ? '#000' : '#aaa'; x.font = 'bold 12px "Press Start 2P", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(i + 1), px * W, py * H + 1);
  });
  // Arthur pulsando sobre a fase atual
  const [ax, ay] = stops[Math.min(stage, 6) - 1];
  const bob = Math.sin(t * 6) * 4;
  const X0 = ax * W, Y0 = ay * H - 34 + bob;
  x.fillStyle = '#c8d0e0'; x.fillRect(X0 - 6, Y0, 12, 14);
  x.beginPath(); x.arc(X0, Y0 - 2, 7, 0, 7); x.fill();
  x.fillStyle = '#e8a878'; x.fillRect(X0, Y0 - 3, 5, 5);
  x.fillStyle = '#c8202a'; x.beginPath(); x.moveTo(X0 - 6, Y0 - 6); x.lineTo(X0 - 13, Y0 - 12); x.lineTo(X0 - 4, Y0 - 9); x.fill();
  x.fillStyle = '#8a8a96'; x.fillRect(X0 - 6, Y0 + 14, 4, 8); x.fillRect(X0 + 2, Y0 + 14, 4, 8);
  // brilho
  x.globalCompositeOperation = 'lighter';
  const hg = x.createRadialGradient(X0, Y0 + 8, 2, X0, Y0 + 8, 40); hg.addColorStop(0, 'rgba(255,200,120,.35)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = hg; x.beginPath(); x.arc(X0, Y0 + 8, 40, 0, 7); x.fill();
  x.globalCompositeOperation = 'source-over';
}

export { STAGE_NAMES };
