// Texturas procedurais desenhadas em canvas (nenhum asset externo).
import * as THREE from 'three';

const cache = new Map();

// ruído de valor 2D periódico
function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < 256; i++) { s = (s * 9301 + 49297) % 233280; p[i] = Math.floor((s / 233280) * 256); }
  for (let i = 0; i < 256; i++) p[256 + i] = p[i];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y, period = 256) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X0 = ((xi % period) + period) % period, Y0 = ((yi % period) + period) % period;
    const X1 = (X0 + 1) % period, Y1 = (Y0 + 1) % period;
    const h = (a, b) => p[(p[a & 255] + b) & 511] / 255;
    const u = fade(xf), v = fade(yf);
    const a = h(X0, Y0), b = h(X1, Y0), c = h(X0, Y1), d = h(X1, Y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise, x, y, oct, period) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * noise(x * f, y * f, period * f); norm += a; a *= 0.5; f *= 2; }
  return sum / norm;
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function finish(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function pixels(size, fn) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const col = fn(x, y);
    const i = (y * size + x) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = col[3] ?? 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// pedras irregulares (células de Voronoi) — base de quase todos os materiais de rocha
function cobble(size, cells, seed, colA, colB, mortar, opts = {}) {
  const noise = makeNoise(seed);
  const pts = [];
  let s = seed * 7 + 3;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const g = Math.ceil(Math.sqrt(cells));
  for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
    pts.push([(i + 0.15 + r() * 0.7) / g * size, (j + 0.15 + r() * 0.7) / g * size * (opts.squash || 1), r()]);
  }
  return pixels(size, (x, y) => {
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (const p of pts) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const dx = x - (p[0] + ox * size), dy = (y - (p[1] + oy * size)) / (opts.squash || 1);
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; id = p[2]; } else if (d < d2) d2 = d;
      }
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1);
    const n = fbm(noise, x / 16, y / 16, 3, size / 16);
    let c = mix(colA, colB, id * 0.8 + n * 0.4);
    const shade = Math.min(1, edge / (opts.edge || 5));
    const bevel = Math.min(1, Math.sqrt(d1) / (size / g * 0.5));
    c = c.map((v) => v * (0.75 + 0.35 * (1 - bevel)) * (0.85 + n * 0.3));
    if (shade < 1) c = mix(mortar, c, shade);
    return [c[0], c[1], c[2]];
  });
}

function bricks(size, rows, cols, seed, colA, colB, mortar, opts = {}) {
  const noise = makeNoise(seed);
  const bh = size / rows, bw = size / cols;
  return pixels(size, (x, y) => {
    const row = Math.floor(y / bh);
    const off = (row % 2) * bw * 0.5;
    const col = Math.floor((x + off) / bw);
    const lx = (x + off) - col * bw, ly = y - row * bh;
    const m = opts.mortar || 2;
    const n = fbm(noise, x / 12, y / 12, 4, size / 12);
    const idn = ((Math.sin(row * 12.9898 + col * 78.233) * 43758.5453) % 1 + 1) % 1;
    let c = mix(colA, colB, idn * 0.7 + n * 0.5);
    const edgeD = Math.min(lx, bw - lx, ly, bh - ly);
    c = c.map((v) => v * (0.8 + 0.3 * n) * (edgeD < m + 2 ? 0.85 : 1) * (ly < m + 2 ? 1.12 : 1));
    if (lx < m || ly < m) c = mortar.map((v) => v * (0.8 + 0.4 * n));
    return [c[0], c[1], c[2]];
  });
}

export function tex(name) {
  if (cache.has(name)) return cache.get(name);
  let c, t;
  switch (name) {
    case 'grass': {
      const n = makeNoise(11);
      c = pixels(256, (x, y) => {
        const v = fbm(n, x / 8, y / 8, 4, 32);
        const blade = Math.abs(Math.sin(x * 0.9 + n(x / 4, y / 30, 64) * 6)) > 0.85 ? 1.25 : 1;
        const c0 = mix([38, 72, 22], [96, 140, 38], v);
        return c0.map((k) => k * blade);
      });
      break;
    }
    case 'dirt': {
      const n = makeNoise(5);
      c = pixels(256, (x, y) => {
        const v = fbm(n, x / 10, y / 10, 5, 25.6);
        const pebble = n(x / 3, y / 3, 85.33) > 0.8 ? 1.3 : 1;
        const c0 = mix([58, 34, 16], [128, 84, 40], v);
        return c0.map((k) => k * pebble);
      });
      break;
    }
    case 'roots': {
      // terra com raízes e camadas (lateral do morro)
      const n = makeNoise(21);
      c = pixels(256, (x, y) => {
        const v = fbm(n, x / 14, y / 7, 5, 18.3);
        const root = Math.abs(Math.sin(x / 9 + fbm(n, x / 30, y / 30, 3, 8.53) * 9));
        let c0 = mix([48, 26, 10], [120, 74, 30], v);
        if (root < 0.12) c0 = [140, 100, 50];
        return c0;
      });
      break;
    }
    case 'stone': c = cobble(256, 30, 3, [92, 92, 100], [150, 148, 150], [30, 30, 36]); break;
    case 'tomb': {
      const n = makeNoise(4);
      c = pixels(128, (x, y) => {
        const v = fbm(n, x / 6, y / 6, 5, 21.3);
        const moss = fbm(n, x / 20 + 9, y / 20, 3, 6.4) > 0.62 ? 1 : 0;
        let c0 = mix([80, 82, 90], [170, 170, 176], v);
        if (moss) c0 = mix(c0, [60, 90, 40], 0.6);
        return c0;
      });
      break;
    }
    case 'brownrock': c = cobble(256, 28, 7, [96, 64, 36], [170, 130, 92], [40, 24, 12]); break;
    case 'tealrock': c = cobble(256, 40, 8, [10, 92, 80], [40, 170, 150], [4, 30, 26]); break;
    case 'tealdark': c = cobble(256, 40, 9, [4, 40, 32], [12, 70, 56], [0, 14, 10]); break;
    case 'cavewall': {
      const n = makeNoise(31);
      c = pixels(256, (x, y) => {
        const v = fbm(n, x / 18, y / 9, 5, 14.2);
        const streak = Math.abs(Math.sin(x / 6 + v * 8));
        return mix([34, 18, 8], [86, 54, 26], v * 0.8 + (streak < 0.2 ? 0.25 : 0));
      });
      break;
    }
    case 'tanrock': c = cobble(256, 24, 12, [110, 92, 74], [176, 160, 140], [50, 40, 30]); break;
    case 'purplebrick': c = bricks(256, 2, 4, 13, [100, 66, 86], [160, 120, 144], [40, 22, 34], { mortar: 4 }); break;
    case 'castle': c = bricks(256, 4, 4, 17, [120, 120, 124], [176, 176, 180], [50, 50, 56], { mortar: 5 }); break;
    case 'castledark': c = bricks(256, 8, 6, 19, [52, 52, 58], [86, 86, 92], [24, 24, 28], { mortar: 3 }); break;
    case 'ice': {
      c = bricks(256, 8, 4, 23, [30, 110, 170], [110, 190, 230], [10, 40, 90], { mortar: 3 });
      break;
    }
    case 'icetop': {
      const n = makeNoise(29);
      c = pixels(128, (x, y) => mix([170, 210, 240], [250, 252, 255], fbm(n, x / 8, y / 8, 4, 16)));
      break;
    }
    case 'street': c = cobble(256, 36, 41, [70, 70, 74], [120, 118, 120], [26, 26, 30]); break;
    case 'house': c = bricks(256, 16, 6, 43, [96, 88, 76], [130, 120, 104], [50, 44, 40], { mortar: 2 }); break;
    case 'redbrick': c = bricks(256, 16, 6, 47, [140, 66, 26], [190, 104, 50], [60, 30, 14], { mortar: 2 }); break;
    case 'greenbuilding': c = bricks(256, 4, 2, 53, [86, 88, 70], [118, 120, 98], [56, 56, 46], { mortar: 4 }); break;
    case 'roof': {
      c = pixels(128, (x, y) => {
        const row = Math.floor(y / 10);
        const sx = (x + (row % 2) * 8) % 16;
        const edge = (y % 10) < 2 || sx < 1;
        return edge ? [10, 50, 46] : mix([20, 96, 86], [40, 130, 118], ((row * 7 + Math.floor((x + (row % 2) * 8) / 16) * 13) % 10) / 10);
      });
      break;
    }
    case 'wood': {
      const n = makeNoise(61);
      c = pixels(128, (x, y) => {
        const v = fbm(n, x / 40, y / 3, 4, 3.2);
        const plank = (y % 32) < 2 ? 0.5 : 1;
        return mix([70, 44, 22], [140, 96, 54], v).map((k) => k * plank);
      });
      break;
    }
    case 'bark': {
      const n = makeNoise(67);
      c = pixels(128, (x, y) => {
        const v = fbm(n, x / 4, y / 20, 4, 32);
        const groove = Math.abs(Math.sin(x / 3 + v * 6)) < 0.25 ? 0.55 : 1;
        return mix([50, 30, 16], [118, 80, 44], v).map((k) => k * groove);
      });
      break;
    }
    case 'leaves': {
      const n = makeNoise(71);
      c = pixels(128, (x, y) => {
        const v = fbm(n, x / 5, y / 5, 4, 25.6);
        const hole = n(x / 3, y / 3, 42.6) > 0.7;
        return hole ? mix([10, 30, 10], [20, 50, 16], v) : mix([24, 70, 20], [90, 150, 50], v);
      });
      break;
    }
    case 'lava': {
      const n = makeNoise(81);
      c = pixels(256, (x, y) => {
        const v = fbm(n, x / 20, y / 20, 5, 12.8);
        const crack = Math.abs(v - 0.5) < 0.05;
        return crack ? [255, 240, 140] : mix([120, 10, 0], [255, 120, 10], Math.pow(v, 1.4));
      });
      break;
    }
    case 'bridge': {
      const n = makeNoise(83);
      c = pixels(128, (x, y) => {
        const gap = (x % 32) < 3;
        const v = fbm(n, x / 40, y / 4, 4, 3.2);
        return gap ? [20, 10, 6] : mix([64, 40, 22], [126, 86, 50], v);
      });
      break;
    }
    case 'drape': {
      const n = makeNoise(91);
      c = pixels(128, (x, y) => {
        const fold = 0.5 + 0.5 * Math.sin(x / 6);
        const v = fbm(n, x / 10, y / 10, 3, 12.8);
        return mix([60, 0, 4], [170, 16, 20], fold * 0.8 + v * 0.2);
      });
      break;
    }
    case 'metal': {
      const n = makeNoise(97);
      c = pixels(128, (x, y) => {
        const v = fbm(n, x / 30, y / 2, 3, 4.26);
        return mix([150, 156, 170], [220, 226, 236], v);
      });
      break;
    }
    case 'boxers': {
      c = canvas(64, 64);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#d0202a';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = i * 16 + (j % 2) * 8 + 4, y = j * 16 + 4;
        ctx.beginPath(); ctx.moveTo(x + 4, y + 8);
        ctx.bezierCurveTo(x - 2, y + 3, x + 1, y - 1, x + 4, y + 2);
        ctx.bezierCurveTo(x + 7, y - 1, x + 10, y + 3, x + 4, y + 8); ctx.fill();
      }
      break;
    }
    case 'moonglow': {
      c = canvas(256, 256);
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.18, 'rgba(255,245,215,1)');
      g.addColorStop(0.2, 'rgba(220,230,255,0.55)'); g.addColorStop(0.45, 'rgba(120,150,255,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      // crateras
      ctx.globalCompositeOperation = 'multiply';
      const craters = [[110, 110, 9], [140, 128, 6], [124, 146, 7], [146, 104, 5]];
      for (const [x, y, r] of craters) { ctx.fillStyle = 'rgba(200,190,170,0.7)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      t = finish(c, false); break;
    }
    case 'soft': {
      c = canvas(64, 64);
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      t = finish(c, false); break;
    }
    case 'mist': {
      const n = makeNoise(101);
      c = pixels(256, (x, y) => {
        const v = fbm(n, x / 32, y / 24, 5, 8);
        const fy = Math.sin((y / 256) * Math.PI);
        return [210, 220, 255, Math.max(0, (v - 0.35)) * 255 * fy * 1.3];
      });
      t = finish(c, true); break;
    }
    case 'cloud': {
      const n = makeNoise(103);
      c = pixels(256, (x, y) => {
        const dx = (x - 128) / 128, dy = (y - 128) / 70;
        const r = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        const v = fbm(n, x / 28, y / 28, 5, 9.14);
        return [40, 40, 64, Math.max(0, Math.min(255, (v * 1.6 - 0.55) * r * 2.2 * 255))];
      });
      t = finish(c, false); break;
    }
    case 'window': {
      c = canvas(64, 64);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0a0d10'; ctx.fillRect(0, 0, 64, 64);
      const g = ctx.createRadialGradient(32, 36, 2, 32, 36, 34);
      g.addColorStop(0, '#2c6f66'); g.addColorStop(1, '#081814');
      ctx.fillStyle = g; ctx.fillRect(6, 6, 52, 52);
      ctx.fillStyle = '#1a1410'; ctx.fillRect(30, 6, 4, 52); ctx.fillRect(6, 30, 52, 4);
      ctx.strokeStyle = '#3d3226'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 58, 58);
      t = finish(c, false); break;
    }
    case 'litwindow': {
      c = canvas(64, 64);
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 40, 2, 32, 36, 36);
      g.addColorStop(0, '#ffd88a'); g.addColorStop(1, '#7a3d10');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#1a1006'; ctx.fillRect(29, 0, 6, 64); ctx.fillRect(0, 29, 64, 6);
      ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, 64, 64);
      t = finish(c, false); break;
    }
    case 'bars': {
      c = canvas(64, 128);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, 64, 128);
      ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 8, 0); ctx.lineTo(i * 8 + 64, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 8, 0); ctx.lineTo(i * 8 - 64, 128); ctx.stroke(); }
      t = finish(c, false); break;
    }
  }
  if (!t) t = finish(c, true);
  cache.set(name, t);
  return t;
}

// texto em canvas para sprites (pontuação, mensagens 3D)
export function textTexture(text, color = '#ffffff', size = 48) {
  const key = 'txt:' + text + color + size;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 64);
  const ctx = c.getContext('2d');
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(text, 128, 34);
  ctx.fillStyle = color; ctx.fillText(text, 128, 34);
  const t = finish(c, false);
  cache.set(key, t);
  return t;
}
