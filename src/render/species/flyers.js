// Voadores e afins: Corvo (azul) / Corvo vermelho, Morcego, Woody Pig, Cavaleiro voador (com a
// metade de baixo de lençol fantasma), Planta carnívora e a Princesa Prin Prin.
import { C, E, S, Bx, T, LR, layer, bonesLR, humanoidBones, eye, obj, stud, mottle, compose, hex, mixc } from './kit.js';
import { fbm3 } from '../organic.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash1 = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// ------------------------------------------------------------------ primitiva local: "drapeado"
// cone (eixo a→b, raios r1→r2) com pregas senoidais em volta do eixo; 'shell' = espessura de casca
// (lençol oco, aberto embaixo), t0..t1 = trecho do eixo (para dividir entre ossos sem emenda)
function drape(bone, a, b, r1, r2, o = {}) {
  const n = o.n ?? 8, amp = o.amp ?? 0.1, ph = o.ph ?? 0, shell = o.shell ?? 0, pw = o.pw ?? 1, tw = o.twist ?? 0;
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1, sz = o.sz ?? 1;
  const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
  const L = Math.hypot(ax, ay, az), ux = ax / L, uy = ay / L, uz = az / L;
  // base perpendicular ao eixo: e1 ~ +x, e2 = u × e1
  let e1 = [1 - ux * ux, -ux * uy, -ux * uz];
  let l1 = Math.hypot(...e1);
  if (l1 < 1e-4) { e1 = [-uy * ux, 1 - uy * uy, -uy * uz]; l1 = Math.hypot(...e1); }
  e1 = e1.map((v) => v / l1);
  const e2 = [uy * e1[2] - uz * e1[1], uz * e1[0] - ux * e1[2], ux * e1[1] - uy * e1[0]];
  const m0 = t0 * L, m1 = t1 * L, tm = (m0 + m1) / 2;
  const p = {
    cx: a[0] + ux * tm, cy: a[1] + uy * tm, cz: a[2] + uz * tm,
    R: (m1 - m0) / 2 + Math.max(r1, r2) * (1 + amp) + shell + 0.02,
    f(x, y, z) {
      const px = x - a[0], py = y - a[1], pz = z - a[2];
      const t = px * ux + py * uy + pz * uz;
      const qx = px - t * ux, qy = py - t * uy, qz = pz - t * uz;
      const c1 = qx * e1[0] + qy * e1[1] + qz * e1[2], c2 = (qx * e2[0] + qy * e2[1] + qz * e2[2]) / sz;
      const tc = clamp01(t / L);
      const rho = Math.hypot(c1, c2);
      const th = Math.atan2(c2, c1);
      const r = (r1 + (r2 - r1) * tc) * (1 + amp * Math.pow(tc, pw) * Math.sin(n * th + ph + tc * tw));
      let d = (rho - r) * 0.8;
      if (shell) d = Math.abs(d + shell * 0.5) - shell * 0.5;
      return Math.max(d, m0 - t, t - m1);
    },
  };
  return Object.assign(p, { bone, k: o.k, col: o.col !== undefined ? hex(o.col) : undefined, neg: !!o.neg });
}

// barra esfarrapada (versão local do hemCut, com módulo correto e farrapos de comprimentos variados):
// remove abaixo de uma linha serrilhada em volta do eixo vertical (cx, cz)
function rags(y0, o = {}) {
  const { amp = 0.3, teeth = 7, cx = 0, cz = 0, seed = 1, noise = 0.03, vary = 0.5, sharp = 0.75, fine = 0, fineTeeth = 23 } = o;
  return (x, y, z) => {
    const a = Math.atan2(z - cz, x - cx) / (Math.PI * 2) + 1;
    const u = a * teeth + seed * 0.37;
    const i = Math.floor(u), f = u - i;
    const L = 1 - vary * hash1((i % teeth) + seed * 13);
    const saw = Math.pow(Math.abs(f - 0.5) * 2, sharp);
    const u2 = a * fineTeeth + seed * 0.61, f2 = u2 - Math.floor(u2);
    const yy = y0 + amp * (1 - L + saw * L) + fine * Math.abs(f2 - 0.5) * 2 + noise * (fbm3(x * 9 + seed, y * 3, z * 9, 2) - 0.5) * 2;
    return yy - y;
  };
}

// tronco de cone vertical de topo e base planos (toco cortado)
function cyl(bone, c, r1, r2, y0, y1, o = {}) {
  const h = y1 - y0;
  const p = {
    cx: c[0], cy: (y0 + y1) / 2, cz: c[2], R: Math.hypot(h / 2, Math.max(r1, r2)) + 0.02,
    f(x, y, z) {
      const t = clamp01((y - y0) / h);
      const d = (Math.hypot(x - c[0], z - c[2]) - (r1 + (r2 - r1) * t)) * 0.95;
      return Math.max(d, y - y1, y0 - y);
    },
  };
  return Object.assign(p, { bone, k: o.k, col: o.col !== undefined ? hex(o.col) : undefined, neg: !!o.neg });
}

// fileira de dentes esculpidos (cones da gengiva até a ponta) ao longo de z, seguindo o arco da boca;
// dir: 1 = para baixo, -1 = para cima
function toothRow(bone, at, span, count, len, r, o = {}) {
  const { dir = 1, curve = 0.04, jag = 0.3, fang = false, lean = 0.2, col } = o;
  const out = [];
  for (let i = 0; i < count; i++) {
    const u = count > 1 ? i / (count - 1) - 0.5 : 0;
    const L = len * (1 - jag * hash1(i * 3 + count)) * (fang && (i === 0 || i === count - 1) ? 1.6 : 1);
    const b = [at[0] - curve * (2 * u) * (2 * u), at[1], at[2] + u * span];
    const tip = [b[0] - L * lean * 0.5, b[1] - dir * L, b[2] - u * L * lean];
    out.push(C(bone, b, tip, r, r * 0.12, { k: 0.004, col }));
  }
  return out;
}

// ------------------------------------------------------------------ asa de penas esculpida
// pose de repouso: aberta na horizontal ao longo de ±z (lado s), bordo de ataque em +x e as penas
// para trás (-x). sh = ombro [x, y, z>0]; arm = comprimento do braço (até o pulso), hand = mão.
function featherWing(s, sd, o) {
  const { sh, arm, hand, chord, q = 1, nSec = 4, nPri = 5, col, dk, lt, wb = 'wing.', tb = 'wtip.' } = o;
  const [sx, sy, sz] = sh;
  const Z = (v) => v * s;
  const W = [sx + 0.015 * q, sy + 0.008 * q, sz + arm];
  const P = [];
  // bordo de ataque (braço e mão)
  P.push(C(wb + sd, [sx, sy, Z(sz)], [W[0], W[1], Z(W[2])], 0.042 * q, 0.03 * q, { col: lt }));
  P.push(C(tb + sd, [W[0], W[1], Z(W[2])], [W[0] - 0.03 * q, W[1], Z(W[2] + hand * 0.5)], 0.03 * q, 0.014 * q, { col: lt }));
  // coberteiras: painel e uma fileira de penas curtas de ponta redonda
  P.push(E(wb + sd, [sx - 0.05 * q, sy, Z(sz + arm * 0.5)], [0.07 * q, 0.024 * q, arm * 0.55], { col }));
  const nc = nSec + 1;
  for (let i = 0; i < nc; i++) {
    const z = sz + arm * (i + 0.5) / nc;
    P.push(E(wb + sd, [sx - 0.085 * q, sy - 0.003 * q, Z(z)], [0.065 * q, 0.02 * q, (arm / nc) * 0.62], { col }));
  }
  // secundárias (bordo de fuga recortado)
  for (let i = 0; i < nSec; i++) {
    const z = sz + arm * (i + 0.55) / nSec;
    P.push(E(wb + sd, [sx - chord * 0.55, sy - 0.008 * q, Z(z)], [chord * 0.46, 0.014 * q, (arm / nSec) * 0.6], { col: dk, rot: [0, -s * 0.06 * (i - 1), 0] }));
  }
  // primárias em leque a partir do pulso (de "para fora" até "para trás")
  const fan = o.fan ?? 1.2, pw = o.pw ?? 0.034;
  for (let i = 0; i < nPri; i++) {
    const th = 0.1 + i * (fan / (nPri - 1));
    const L = (0.34 - i * 0.03) * q * (o.pri ?? 1);
    const bz = W[2] + hand * (0.42 - i * 0.1), bx = W[0] - 0.015 * q - i * 0.012 * q;
    const dir = [-Math.sin(th), Math.cos(th)];
    const c = [bx + dir[0] * L * 0.5, W[1] - 0.006 * q, Z(bz + dir[1] * L * 0.5)];
    P.push(E(tb + sd, c, [L * 0.5, 0.012 * q, pw * q], { rot: [0, -s * (Math.PI / 2 + th), 0], col: dk }));
  }
  return P;
}

// ================================================================== CORVO / CORVO VERMELHO
// corvo de brinquedo: cabeça grande, olhos brilhantes, bico amarelo grosso, peito felpudo, crista,
// asas de penas (dobradas quando pousado), cauda em leque e pés com garras.
function crowSpec(o) {
  return () => {
    const { body, dk, lt, tip, eyeCol } = o;
    const beak = 0xf2b41c, claw = 0x2a2018;
    const bones = bonesLR([
      ['root', '', 0, 0, 0],
      ['body', 'root', 0, 0.28, 0],
      ['head', 'body', 0.13, 0.46, 0],
      ['jaw', 'head', 0.29, 0.52, 0],
      ['tail', 'body', -0.15, 0.25, 0],
      ['leg.$', 'body', 0.02, 0.18, 0.065],
      ['wing.$', 'body', 0.02, 0.43, 0.12],
      ['wtip.$', 'wing.$', 0.035, 0.44, 0.36],
    ]);
    // padrão das penas do corpo: costas mais escuras, peito claro, leves "escamas"
    const bodyPat = (x, y, z, c) => {
      let r = c;
      const u = (x * 0.8 + Math.abs(z) * 0.5) * 26, v = y * 30;
      const row = Math.floor(v);
      const fu = u + (row & 1) * 0.5;
      const cu = fu - Math.floor(fu) - 0.5, cv = v - row;
      const rr = Math.hypot(cu, (1 - cv) * 0.85);
      const edge = Math.max(0, 1 - Math.abs(rr - 0.55) / 0.14);
      r = r.map((q) => q * (1 - 0.18 * edge));
      if (y > 0.36 && x < 0.1) r = mixc(r, hex(dk), 0.25 * sstep(0.36, 0.5, y));
      return r;
    };
    const tailP = [];
    for (let i = -2; i <= 2; i++) {
      const th = i * 0.24, al = 0.32, L = 0.21 - Math.abs(i) * 0.02;
      const d = [-Math.cos(al) * Math.cos(th), -Math.sin(al), Math.cos(al) * Math.sin(th)];
      const b0 = [-0.14, 0.25 + (2 - Math.abs(i)) * 0.006, 0];
      tailP.push(E('tail', [b0[0] + d[0] * L, b0[1] + d[1] * L, b0[2] + d[2] * L], [L, 0.016, 0.046], { rot: [0, th, Math.PI + al], col: Math.abs(i) === 2 ? dk : body }));
    }
    return {
      cell: 0.011,
      bones,
      layers: [
        layer('body', 'feather', body, 0.05, [
          // corpo em ovo inclinado (peito para cima), peito claro e coxas felpudas
          E('body', [-0.01, 0.28, 0], [0.2, 0.16, 0.15], { rot: [0, 0, 0.5] }),
          E('body', [0.09, 0.29, 0], [0.11, 0.15, 0.13], { col: lt }),
          E('body', [0.02, 0.17, 0], [0.11, 0.07, 0.11], { col: lt }),
          ...LR((s) => [E('body', [0.02, 0.17, 0.075 * s], [0.07, 0.065, 0.05], { col: dk })]),
          C('body', [0.06, 0.36, 0], [0.14, 0.48, 0], 0.11, 0.1),
          // babado de penas no peito
          ...[-3, -2, -1, 0, 1, 2, 3].map((i) => C('body', [0.175 - Math.abs(i) * 0.01, 0.41 - Math.abs(i) * 0.01, i * 0.03], [0.215 - Math.abs(i) * 0.012, 0.35 - Math.abs(i) * 0.015, i * 0.036], 0.026, 0.006, { k: 0.025, col: lt })),
          // cabeça grande
          E('head', [0.18, 0.55, 0], [0.15, 0.14, 0.135]),
          E('head', [0.26, 0.52, 0], [0.08, 0.07, 0.1]),
          ...LR((s) => [
            // sobrancelha zangada e órbita
            E('head', [0.285, 0.635, 0.068 * s], [0.06, 0.022, 0.045], { rot: [-0.45 * s, 0, -0.3], k: 0.02, col: dk }),
            S('head', [0.305, 0.59, 0.072 * s], 0.038, { neg: true, k: 0.014 }),
            // tufos das bochechas
            C('head', [0.1, 0.53, 0.1 * s], [0.0, 0.48, 0.13 * s], 0.045, 0.008, { k: 0.03 }),
            C('head', [0.12, 0.6, 0.1 * s], [0.02, 0.6, 0.14 * s], 0.035, 0.006, { k: 0.03 }),
          ]),
          // crista
          ...[-1, 0, 1].map((i) => C('head', [0.16 - 0.02 * Math.abs(i), 0.67, 0.035 * i], [0.05 - 0.03 * Math.abs(i), 0.79 - 0.035 * Math.abs(i), 0.06 * i], 0.042, 0.008, { k: 0.03, col: dk })),
          ...tailP,
        ], { pattern: compose(bodyPat, mottle(0.08, 9)), rough: { amp: 0.0012, freq: 40 }, set: 'b' }),
        // asas (dobradas/abertas pelos ossos)
        layer('wings', 'feather', body, 0.012, LR((s, sd) => featherWing(s, sd, { sh: [0.02, 0.43, 0.12], arm: 0.24, hand: 0.14, chord: 0.24, col: body, dk: tip, lt })),
          { pattern: (x, y, z, c) => mixc(c, hex(tip), 0.35 * sstep(0.25, 0.6, Math.abs(z) - x * 0.5)), set: 'w' }),
        // bico e pés (córneo amarelo, garras escuras)
        layer('beak', 'horn', beak, 0.02, [
          E('head', [0.31, 0.545, 0], [0.05, 0.042, 0.055]),
          C('head', [0.3, 0.555, 0], [0.45, 0.51, 0], 0.048, 0.014),
          C('head', [0.45, 0.51, 0], [0.465, 0.485, 0], 0.014, 0.006, { k: 0.01 }),
          C('head', [0.36, 0.575, 0], [0.43, 0.53, 0], 0.016, 0.01, { k: 0.02 }),
          C('jaw', [0.3, 0.515, 0], [0.42, 0.497, 0], 0.036, 0.01),
          E('head', [0.4, 0.522, 0], [0.085, 0.0095, 0.07], { neg: true, k: 0.008 }),
          ...LR((s, sd) => [
            C('leg.' + sd, [0.025, 0.14, 0.065 * s], [0.04, 0.035, 0.065 * s], 0.022, 0.017),
            ...[-1, 0, 1].flatMap((j) => [
              C('leg.' + sd, [0.04, 0.025, 0.065 * s], [0.12, 0.018, (0.065 + j * 0.032) * s], 0.016, 0.012, { k: 0.012 }),
              C('leg.' + sd, [0.12, 0.018, (0.065 + j * 0.032) * s], [0.15, 0.002, (0.065 + j * 0.036) * s], 0.011, 0.004, { k: 0.006, col: claw }),
            ]),
            C('leg.' + sd, [0.04, 0.025, 0.065 * s], [-0.03, 0.016, 0.065 * s], 0.014, 0.011, { k: 0.012 }),
            C('leg.' + sd, [-0.03, 0.016, 0.065 * s], [-0.055, 0.0, 0.065 * s], 0.01, 0.004, { k: 0.006, col: claw }),
          ]),
        ], { cell: 0.008, set: 'b' }),
      ],
      rigid: [1, -1].map((s) => eye('head', [0.298, 0.59, 0.07 * s], 0.041, { sclera: 0xfff0d0, iris: eyeCol, irisGlow: 0.9, irisSize: 0.86, pupilSize: 0.3, look: [1, 0, 0.6 * s] })),
    };
  };
}
export const crow = crowSpec({ body: 0x2a3aa0, dk: 0x1a2468, lt: 0x4e6ad8, tip: 0x121a52, eyeCol: 0xe80c0c });
export const raven = crowSpec({ body: 0xb81e24, dk: 0x6e0e12, lt: 0xe8483e, tip: 0x4a0808, eyeCol: 0xffe23a });

// ================================================================== MORCEGO
export function bat() {
  const fur = 0x3446b8, dk = 0x1c2878, belly = 0x5a70dc, ear = 0xd85a9a, claw = 0x1a1420;
  const pat = (x, y, z, c) => {
    // parte interna das orelhas rosada
    const hd = ((x - 0.05) / 0.125) ** 2 + ((y - 0.39) / 0.12) ** 2 + (z / 0.125) ** 2;
    if (y > 0.47 && hd > 1.2 && Math.abs(z) > 0.04 && x > 0.035 + (y - 0.5) * -0.3) return mixc(c, hex(ear), 0.85);
    return c;
  };
  return {
    cell: 0.0095,
    bones: bonesLR([
      ['root', '', 0, 0, 0],
      ['body', 'root', 0, 0.22, 0],
      ['head', 'body', 0.03, 0.33, 0],
      ['wing.$', 'body', 0.0, 0.3, 0.09],
      ['leg.$', 'body', -0.04, 0.13, 0.05],
    ]),
    layers: [
      layer('fur', 'hair', fur, 0.04, [
        E('body', [-0.01, 0.22, 0], [0.1, 0.12, 0.095]),
        E('body', [0.04, 0.21, 0], [0.07, 0.09, 0.08], { col: belly }),
        E('head', [0.05, 0.39, 0], [0.125, 0.12, 0.125]),
        E('head', [0.15, 0.355, 0], [0.06, 0.05, 0.075]),
        E('head', [0.2, 0.37, 0], [0.024, 0.022, 0.034], { col: dk, k: 0.015 }),
        ...LR((s) => [
          S('head', [0.222, 0.372, 0.014 * s], 0.009, { neg: true, k: 0.005 }),
          // sobrancelha zangada e órbita
          E('head', [0.15, 0.452, 0.055 * s], [0.045, 0.018, 0.04], { rot: [-0.5 * s, 0, -0.2], k: 0.015, col: dk }),
          S('head', [0.165, 0.418, 0.058 * s], 0.029, { neg: true, k: 0.01 }),
          // orelhas grandes e pontudas
          E('head', [0.02, 0.53, 0.085 * s], [0.03, 0.11, 0.06], { rot: [-0.35 * s, 0, 0.12], k: 0.03 }),
          C('head', [0.015, 0.58, 0.1 * s], [-0.02, 0.69, 0.14 * s], 0.04, 0.006, { k: 0.03 }),
          E('head', [0.055, 0.53, 0.088 * s], [0.02, 0.08, 0.042], { rot: [-0.35 * s, 0, 0.12], neg: true, k: 0.015 }),
          // tufo de pelo no peito
          C('body', [0.08, 0.3, 0.03 * s], [0.12, 0.24, 0.04 * s], 0.03, 0.006, { k: 0.02, col: belly }),
          // perninhas com garras
          C('leg.' + (s > 0 ? 'R' : 'L'), [-0.04, 0.13, 0.05 * s], [-0.05, 0.055, 0.055 * s], 0.022, 0.014),
          ...[-1, 0, 1].map((j) => C('leg.' + (s > 0 ? 'R' : 'L'), [-0.05, 0.05, 0.055 * s], [-0.03, 0.02, (0.055 + j * 0.016) * s], 0.009, 0.004, { k: 0.008, col: claw })),
        ]),
        E('head', [0.19, 0.322, 0], [0.04, 0.011, 0.05], { neg: true, k: 0.008 }),
      ], { pattern: compose(pat, mottle(0.1, 20)), rough: { amp: 0.0025, freq: 55 } }),
      layer('fangs', 'bone', 0xf4eedc, 0.004, toothRow('head', [0.192, 0.33, 0], 0.052, 2, 0.055, 0.012, { jag: 0, lean: 0.1 }), { cell: 0.005 }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.163, 0.418, 0.058 * s], 0.03, { glow: 0xff1408, ei: 2.0, core: 0xffa070, look: [1, 0, 0.3 * s] })),
    ],
  };
}

// ================================================================== WOODY PIG
// porco voador rosado-castanho com toco de árvore nas costas, asinhas de penas e lança de cebolinha
export function pig() {
  const skin = 0xe0a084, pink = 0xf0a0a4, belly = 0xf2c4a8, hoof = 0x4a3028, wood = 0x8a5a34;
  const pat = (x, y, z, c) => {
    // parte de dentro das orelhas rosada
    if (y > 0.66 && x > 0.2 && Math.abs(z) > 0.07 && x > 0.24 + (y - 0.7) * 0.4) return mixc(c, hex(pink), 0.7);
    return c;
  };
  const TOP = 0.96;
  const woodPat = (x, y, z, c) => {
    // topo cortado com anéis e borda de casca; casca com sulcos verticais
    const cx = x + 0.06, r = Math.hypot(cx, z);
    if (y > TOP - 0.012 && r < 0.2) {
      if (r > 0.14) return hex(0x4a2e18);
      const w = Math.sin(r * 110 + fbm3(x * 20, 0, z * 20, 2) * 2);
      return mixc(hex(0xe2b878), hex(0xb8864a), w > 0.3 ? 1 : 0);
    }
    const a = Math.atan2(z, cx);
    const g = Math.sin(a * 11 + y * 9 + fbm3(x * 7, y * 7, z * 7, 2) * 5);
    return g > 0.5 ? c.map((v) => v * 0.6) : c;
  };
  return {
    cell: 0.013,
    bones: bonesLR([
      ['root', '', 0, 0, 0],
      ['body', 'root', 0, 0.45, 0],
      ['head', 'body', 0.22, 0.5, 0],
      ['tail', 'body', -0.33, 0.5, 0],
      ['fleg.$', 'body', 0.15, 0.3, 0.14],
      ['bleg.$', 'body', -0.17, 0.3, 0.14],
      ['wing.$', 'body', 0.1, 0.62, 0.2],
      ['wtip.$', 'wing.$', 0.115, 0.625, 0.36],
    ]),
    layers: [
      layer('skin', 'flesh', skin, 0.05, [
        E('body', [-0.03, 0.46, 0], [0.33, 0.27, 0.26]),
        E('body', [0.0, 0.35, 0], [0.26, 0.15, 0.21], { col: belly }),
        E('head', [0.27, 0.52, 0], [0.2, 0.2, 0.205]),
        ...LR((s) => [E('head', [0.34, 0.44, 0.1 * s], [0.09, 0.08, 0.085])]),
        C('head', [0.4, 0.47, 0], [0.52, 0.46, 0], 0.1, 0.094, { col: pink }),
        E('head', [0.535, 0.46, 0], [0.03, 0.088, 0.1], { col: pink, k: 0.02 }),
        ...LR((s, sd) => [
          E('head', [0.565, 0.46, 0.035 * s], [0.02, 0.032, 0.018], { neg: true, k: 0.01 }),
          // sobrancelha zangada e órbita
          E('head', [0.4, 0.665, 0.085 * s], [0.07, 0.024, 0.05], { rot: [-0.4 * s, 0, -0.32], k: 0.02 }),
          S('head', [0.425, 0.605, 0.085 * s], 0.043, { neg: true, k: 0.015 }),
          // orelhas pontudas caídas para a frente
          E('head', [0.24, 0.71, 0.12 * s], [0.035, 0.1, 0.07], { rot: [-0.45 * s, 0, -0.55], k: 0.03 }),
          C('head', [0.27, 0.76, 0.14 * s], [0.36, 0.8, 0.17 * s], 0.04, 0.008, { k: 0.03 }),
          // patinhas com cascos
          C('fleg.' + sd, [0.15, 0.3, 0.14 * s], [0.2, 0.13, 0.15 * s], 0.075, 0.058),
          E('fleg.' + sd, [0.205, 0.1, 0.15 * s], [0.058, 0.04, 0.058], { col: hoof, k: 0.02 }),
          C('bleg.' + sd, [-0.17, 0.3, 0.14 * s], [-0.22, 0.14, 0.15 * s], 0.08, 0.06),
          E('bleg.' + sd, [-0.225, 0.11, 0.15 * s], [0.058, 0.04, 0.058], { col: hoof, k: 0.02 }),
        ]),
        E('head', [0.45, 0.375, 0], [0.09, 0.01, 0.12], { neg: true, k: 0.01 }),
        // rabinho enrolado
        T('tail', [-0.4, 0.55, 0], 0.035, 0.014, { rot: [Math.PI / 2, 0, 0], k: 0.02 }),
        C('tail', [-0.33, 0.52, 0], [-0.38, 0.52, 0], 0.025, 0.016, { k: 0.02 }),
      ], { pattern: compose(pat, mottle(0.08, 8)), rough: { amp: 0.0015, freq: 35 }, cell: 0.014, set: 'b' }),
      // toco de árvore nas costas (raízes agarradas, galho quebrado e um broto)
      layer('stump', 'wood', wood, 0.03, [
        cyl('body', [-0.06, 0, 0], 0.17, 0.15, 0.6, TOP),
        ...[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
          return C('body', [-0.06 + ca * 0.13, 0.78, sa * 0.13], [-0.06 + ca * 0.29, 0.64 - Math.abs(ca) * 0.05, sa * 0.24], 0.06, 0.022, { k: 0.035 });
        }),
        C('body', [-0.18, 0.86, 0.07], [-0.29, 0.94, 0.11], 0.042, 0.032, { k: 0.03 }),
        C('body', [-0.02, TOP - 0.02, 0.03], [0.01, TOP + 0.08, 0.03], 0.012, 0.01, { col: 0x4aa030, k: 0.01 }),
        E('body', [0.055, TOP + 0.09, 0.05], [0.05, 0.012, 0.026], { rot: [0.3, 0.6, 0.45], col: 0x5cc038, k: 0.008 }),
        E('body', [-0.03, TOP + 0.09, 0.0], [0.045, 0.012, 0.024], { rot: [-0.3, -0.5, -0.5], col: 0x5cc038, k: 0.008 }),
      ], { pattern: woodPat, rough: { amp: 0.003, freq: 30 }, set: 'b' }),
      // asinhas de penas creme
      layer('wings', 'bone', 0xf4ead2, 0.014, LR((s, sd) => featherWing(s, sd, { sh: [0.1, 0.62, 0.2], arm: 0.16, hand: 0.1, chord: 0.22, q: 0.9, nSec: 3, nPri: 4, col: 0xfff6e4, dk: 0xf2e2c2, lt: 0xffffff, pri: 0.78, fan: 0.95, pw: 0.05 })),
        { pattern: (x, y, z, c) => mixc(c, hex(0xf0dcb4), 0.3 * sstep(0.3, 0.7, Math.abs(z) - x * 0.4)), set: 'w', cavity: 0.4 }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.415, 0.6, 0.085 * s], 0.045, { iris: 0x2a1408, sclera: 0xfff8ea, irisSize: 0.7, pupilSize: 0.36, look: [1, 0, 0.3 * s] })),
      obj('onion', 'fleg.R', [0.24, 0.13, 0.22], { name: 'spear' }),
    ],
  };
}

// ================================================================== CAVALEIRO VOADOR
// tronco e elmo de armadura azul-arroxeada com friso dourado, viseira com brilho vermelho, pluma,
// escudo e lança; da cintura para baixo é um lençol fantasma esfarrapado (como o GHOST da referência)
export function knight() {
  const ar = 0x4a3cb4, lt = 0x6c5ee0, trim = 0xe0b04a, ghost = 0xe6e2f4;
  const k = 0.014;
  const ghostPat = (x, y, z, c) => {
    const n = fbm3(x * 5, y * 5, z * 5, 3);
    let r = mixc(c, hex(0xb8b0dc), clamp01((n - 0.45) * 2) * 0.5);
    r = mixc(r, hex(0xa49cd0), 0.4 * sstep(0.45, 0.05, y));
    return r;
  };
  const A = [-0.03, 0.84, 0], Bt = [-0.3, 0.02, 0];
  const dr = { n: 8, amp: 0.13, shell: 0.03, pw: 0.6, twist: 1.4 };
  return {
    cell: 0.0125,
    bones: bonesLR([
      ['root', '', 0, 0, 0],
      ['body', 'root', 0, 0.82, 0],
      ['chest', 'body', 0.01, 1.0, 0],
      ['head', 'chest', 0.04, 1.27, 0],
      ['upperarm.$', 'chest', 0.0, 1.18, 0.26],
      ['forearm.$', 'upperarm.$', 0.03, 0.98, 0.3],
      ['hand.$', 'forearm.$', 0.17, 0.92, 0.3],
      ['cloth1', 'body', -0.03, 0.74, 0],
      ['cloth2', 'cloth1', -0.12, 0.4, 0],
    ]),
    layers: [
      layer('armor', 'metal', ar, k, [
        // peitoral com aresta, gorjal e lâminas do abdômen
        E('chest', [0.02, 1.04, 0], [0.2, 0.2, 0.24], { k: 0.03 }),
        E('chest', [0.08, 1.06, 0], [0.16, 0.17, 0.2], { col: lt, k: 0.03 }),
        C('chest', [0.235, 0.93, 0], [0.205, 1.17, 0], 0.018, 0.015, { col: lt, k: 0.03 }),
        E('chest', [0.03, 1.2, 0], [0.13, 0.055, 0.15], { col: trim }),
        E('body', [0.0, 0.88, 0], [0.19, 0.055, 0.225]),
        E('body', [-0.01, 0.825, 0], [0.2, 0.05, 0.235], { col: trim }),
        E('body', [-0.02, 0.77, 0], [0.205, 0.05, 0.24]),
        ...LR((s, sd) => [
          // ombreiras em 3 lâminas
          E('upperarm.' + sd, [-0.01, 1.21, 0.25 * s], [0.15, 0.11, 0.14], { rot: [0.3 * s, 0, 0] }),
          E('upperarm.' + sd, [0.0, 1.14, 0.28 * s], [0.135, 0.05, 0.125], { rot: [0.45 * s, 0, 0], col: trim }),
          E('upperarm.' + sd, [0.0, 1.09, 0.3 * s], [0.115, 0.045, 0.105], { rot: [0.55 * s, 0, 0] }),
          C('upperarm.' + sd, [0.0, 1.16, 0.27 * s], [0.03, 0.98, 0.3 * s], 0.07, 0.06),
          S('forearm.' + sd, [0.03, 0.98, 0.3 * s], 0.068, { col: trim }),
          C('forearm.' + sd, [0.03, 0.98, 0.3 * s], [0.15, 0.925, 0.3 * s], 0.06, 0.055),
          E('forearm.' + sd, [0.135, 0.928, 0.3 * s], [0.05, 0.072, 0.072], { col: trim }),
          E('hand.' + sd, [0.2, 0.92, 0.3 * s], [0.06, 0.055, 0.05]),
        ]),
        // elmo: cúpula, viseira em bico com aresta e respiros, crista e aba
        E('head', [0.04, 1.43, 0], [0.18, 0.19, 0.168]),
        E('head', [0.13, 1.395, 0], [0.115, 0.13, 0.13]),
        C('head', [0.243, 1.3, 0], [0.236, 1.52, 0], 0.016, 0.014, { col: lt, k: 0.02 }),
        C('head', [0.19, 1.58, 0], [-0.14, 1.61, 0], 0.026, 0.024, { col: trim, k: 0.02 }),
        T('head', [0.03, 1.3, 0], 0.135, 0.022, { col: trim }),
        Bx('head', [0.24, 1.435, 0], [0.08, 0.016, 0.11], 0.008, { neg: true, k: 0.008 }),
        ...LR((s) => [0, 1, 2].map((i) => S('head', [0.225 - i * 0.012, 1.35 - i * 0.012, (0.04 + i * 0.022) * s], 0.009, { neg: true, k: 0.004 }))).flat(),
      ], { cavity: 1.4, cell: 0.0132 }),
      // pluma vermelha
      layer('plume', 'cloth', 0xd8242e, 0.04, [
        C('head', [0.06, 1.62, 0], [-0.1, 1.7, 0], 0.045, 0.062),
        C('head', [-0.1, 1.7, 0], [-0.28, 1.65, 0], 0.062, 0.042),
        C('head', [-0.28, 1.65, 0], [-0.42, 1.5, 0], 0.042, 0.012),
      ], { rough: { amp: 0.006, freq: 30 }, pattern: mottle(0.15, 20) }),
      // lençol fantasma (oco, pregueado, barra esfarrapada)
      layer('ghost', 'ghost', ghost, 0.03, [
        E('cloth1', [-0.04, 0.76, 0], [0.21, 0.09, 0.235]),
        drape('cloth1', A, Bt, 0.2, 0.38, { ...dr, t1: 0.45 }),
        drape('cloth2', A, Bt, 0.2, 0.38, { ...dr, t0: 0.45 }),
      ], {
        cuts: [rags(0.0, { amp: 0.46, teeth: 7, cx: -0.28, seed: 3, noise: 0.04, vary: 0.55, fine: 0.07, fineTeeth: 19 })],
        pattern: ghostPat, rough: { amp: 0.004, freq: 18 }, cavity: 1.6, cell: 0.0135,
      }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.215, 1.435, 0.05 * s], 0.024, { glow: 0xff1208, ei: 2.2, pupil: false, squash: [0.6, 0.7, 1.4] })),
      obj('kshield', 'forearm.L', [0.16, 0.95, -0.38], { rot: [0, 2.35, 0], scale: 0.85, name: 'shield' }),
      obj('lance', 'hand.R', [0.27, 0.92, 0.3], { rot: [0, 0, 0.14], scale: 0.7, name: 'lance' }),
    ],
  };
}

// ================================================================== PLANTA CARNÍVORA
// cabeça bulbosa verde com bocarra (mandíbula), lábios vermelhos, dentes, um olho só no topo,
// caule grosso em gomos e folhas largas na base
export function plant() {
  const g = 0x3cb448, dg = 0x1e7a2c, lg = 0x9ae868, lip = 0xd8284a, leafC = 0x34a83a, jawC = 0x62c24e;
  const LEAVES = [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2 + 0.3);
  const pat = (x, y, z, c) => {
    let r = c;
    if (y < 0.2) {
      // nervura central e bordas mais escuras das folhas
      const a = Math.atan2(z, x), rr = Math.hypot(x, z);
      let best = 9;
      for (const la of LEAVES) { let d = a - la; d = Math.atan2(Math.sin(d), Math.cos(d)); best = Math.min(best, Math.abs(d)); }
      if (rr > 0.13 && best * rr < 0.013) r = mixc(r, hex(lg), 0.75);
      else if (rr > 0.13 && best * rr > 0.08) r = r.map((v) => v * 0.75);
    }
    if (y > 1.2) {
      // pintas claras na cabeça
      const n = fbm3(x * 11, y * 11, z * 11, 2);
      if (n > 0.6) r = mixc(r, hex(0xe0f070), Math.min(1, (n - 0.6) * 8) * 0.85);
    }
    if (y > 0.2 && y < 0.88) r = r.map((v) => v * (0.86 + 0.14 * Math.sin(y * 38)));
    return r;
  };
  const stemP = [[0, 0.03, 0], [0.05, 0.33, 0], [-0.02, 0.6, 0], [0.03, 0.86, 0]];
  return {
    cell: 0.013,
    bones: bonesLR([
      ['root', '', 0, 0, 0],
      ['stem1', 'root', 0, 0.05, 0],
      ['stem2', 'stem1', 0.0, 0.45, 0],
      ['head', 'stem2', 0.03, 0.86, 0],
      ['jaw', 'head', -0.1, 1.12, 0],
    ]),
    layers: [
      layer('body', 'plant', g, 0.05, [
        // folhas largas na base (roseta), com a ponta curvada para cima
        ...LEAVES.flatMap((a, i) => {
          const L = 1 + (i % 2) * 0.15, ca = Math.cos(a), sa = Math.sin(a);
          return [
            E('root', [ca * 0.22 * L, 0.07, sa * 0.22 * L], [0.17 * L, 0.026, 0.12], { rot: [0, -a, 0.22], col: leafC, k: 0.02 }),
            E('root', [ca * 0.38 * L, 0.13 * L, sa * 0.38 * L], [0.1, 0.024, 0.1], { rot: [0, -a, 0.75], col: leafC, k: 0.03 }),
            C('root', [ca * 0.44 * L, 0.19 * L, sa * 0.44 * L], [ca * 0.48 * L, 0.27 * L, sa * 0.48 * L], 0.045, 0.008, { col: leafC, k: 0.035 }),
          ];
        }),
        ...LEAVES.slice(0, 3).flatMap((a0) => {
          const a = a0 + 1.83, ca = Math.cos(a), sa = Math.sin(a);
          return [
            E('root', [ca * 0.13, 0.15, sa * 0.13], [0.12, 0.024, 0.085], { rot: [0, -a, 0.95], col: leafC, k: 0.02 }),
            C('root', [ca * 0.19, 0.24, sa * 0.19], [ca * 0.21, 0.31, sa * 0.21], 0.045, 0.008, { col: leafC, k: 0.03 }),
          ];
        }),
        // caule grosso em gomos
        C('stem1', stemP[0], stemP[1], 0.135, 0.1),
        C('stem1', stemP[1], stemP[2], 0.1, 0.092),
        C('stem2', stemP[2], stemP[3], 0.092, 0.1),
        ...[0.2, 0.4, 0.58, 0.75].map((y, i) => T(i < 2 ? 'stem1' : 'stem2', [0.02 * Math.sin(y * 9), y, 0], 0.09 - i * 0.003, 0.017, { k: 0.03 })),
        E('stem2', [0.12, 0.62, 0.07], [0.14, 0.02, 0.06], { rot: [0.3, -0.4, 0.45], col: leafC, k: 0.02 }),
        E('stem1', [-0.11, 0.4, -0.07], [0.13, 0.02, 0.055], { rot: [-0.3, 2.6, 0.45], col: leafC, k: 0.02 }),
        // cabeça: pescoço, mandíbula, crânio e lábios
        C('head', [0.03, 0.86, 0], [0.05, 1.0, 0], 0.09, 0.13),
        E('jaw', [0.07, 1.03, 0], [0.26, 0.12, 0.25], { col: jawC }),
        E('jaw', [-0.03, 0.98, 0], [0.17, 0.09, 0.18], { col: jawC }),
        E('head', [0.06, 1.31, 0], [0.28, 0.22, 0.27]),
        E('head', [-0.08, 1.27, 0], [0.19, 0.19, 0.21]),
        E('head', [0.15, 1.175, 0], [0.21, 0.04, 0.245], { col: lip, k: 0.03 }),
        E('jaw', [0.15, 1.1, 0], [0.2, 0.04, 0.235], { col: lip, k: 0.03 }),
        E('head', [0.28, 1.138, 0], [0.25, 0.058, 0.23], { neg: true, k: 0.02 }),
        // pálpebra pesada sobre o olho único e órbita
        E('head', [0.25, 1.465, 0], [0.125, 0.042, 0.125], { rot: [0, 0, -0.42], col: dg, k: 0.025 }),
        E('head', [0.25, 1.33, 0], [0.08, 0.03, 0.1], { col: dg, k: 0.03 }),
        S('head', [0.28, 1.39, 0], 0.098, { neg: true, k: 0.015 }),
        // espinhos na nuca
        ...[0, 1, 2].map((i) => C('head', [-0.12 - i * 0.07, 1.45 - i * 0.08, 0], [-0.23 - i * 0.07, 1.54 - i * 0.08, 0], 0.045, 0.006, { col: dg, k: 0.03 })),
        ...LR((s) => [C('head', [-0.02, 1.4, 0.2 * s], [-0.1, 1.48, 0.28 * s], 0.04, 0.006, { col: dg, k: 0.03 })]),
      ], { pattern: compose(pat, mottle(0.08, 10)), rough: { amp: 0.002, freq: 30 }, cell: 0.015, keep: 0.32 }),
      // dentes de cima e de baixo (camadas separadas: não se fundem quando a boca fecha)
      layer('teeth', 'bone', 0xf6f0dc, 0.004, toothRow('head', [0.33, 1.17, 0], 0.36, 10, 0.075, 0.021, { curve: 0.18, jag: 0.35, lean: 0.25 }), { cell: 0.0092, keep: 0.28 }),
      layer('teethlo', 'bone', 0xf6f0dc, 0.004, toothRow('jaw', [0.32, 1.095, 0], 0.34, 9, 0.062, 0.019, { dir: -1, curve: 0.17, jag: 0.35, lean: 0.25 }), { cell: 0.0092, keep: 0.28 }),
      // interior da boca (vermelho escuro) e língua
      layer('mouth', 'wet', 0x5a0818, 0.04, [
        E('head', [0.1, 1.165, 0], [0.21, 0.06, 0.2]),
        E('jaw', [0.1, 1.1, 0], [0.21, 0.06, 0.2]),
        E('jaw', [0.16, 1.115, 0], [0.13, 0.03, 0.09], { col: 0xd04a68 }),
      ], { cell: 0.016 }),
    ],
    rigid: [
      eye('head', [0.27, 1.39, 0], 0.1, { iris: 0x2050ff, irisGlow: 0.5, sclera: 0xf6f2e2, irisSize: 0.62, pupilSize: 0.27, look: [1, -0.1, 0.1] }),
    ],
  };
}

// ================================================================== PRINCESA PRIN PRIN
// cabeça grande, olhos grandes, cabelo violeta longo, vestido branco e rosa de saia em sino
// pregueada, mangas bufantes, luvas brancas e coroinha de ouro com pedras
const PRIN_P = {
  hip: [0, 0.84], spine: [0.01, 0.96], chest: [0.02, 1.1], neck: [0.03, 1.24], head: [0.04, 1.3],
  thigh: [0, 0.82, 0.08], knee: [0.02, 0.45, 0.08], ankle: [0, 0.08, 0.08],
  shoulder: [0.02, 1.19, 0.145], elbow: [0.04, 0.99, 0.175], wrist: [0.15, 0.92, 0.08],
  extra: [['hairb', 'head', -0.1, 1.45, 0]],
};
export function princess() {
  const skin = 0xffcaa8, white = 0xfbf4fa, pink = 0xf590c0, hot = 0xe0428e, hair = 0x9a4ad0, gold = 0xf2c23a;
  const H = 1.45;            // centro da cabeça
  const facePat = (x, y, z, c) => {
    // bochechas coradas e sorriso
    let r = c;
    const ck = Math.hypot(x - 0.17, y - (H - 0.055), Math.abs(z) - 0.09);
    if (ck < 0.05) r = mixc(r, hex(0xf47a90), 0.55 * (1 - ck / 0.05));
    return r;
  };
  const hairPat = (x, y, z, c) => {
    // reflexo em anel no alto da cabeça
    if (y > H + 0.11 && y < H + 0.2 && x < 0.17) return mixc(c, hex(0xdcaaff), 0.45 * (1 - Math.abs(y - (H + 0.155)) / 0.045));
    return c;
  };
  // mechas: cones encadeados com leve ondulação
  const strand = (bones, pts, radii, k = 0.014) => pts.slice(0, -1).map((p, i) => C(bones[Math.min(i, bones.length - 1)], p, pts[i + 1], radii[i], radii[i + 1], { k }));
  const back = [];
  for (let i = 0; i < 8; i++) {
    const a = -1.6 + (i / 7) * 3.2, ca = Math.cos(a), sa = Math.sin(a), w = Math.sin(i * 1.7) * 0.02;
    const len = 0.56 - Math.abs(a) * 0.07;
    back.push(...strand(['head', 'hairb', 'hairb'], [
      [-0.03 - ca * 0.12, H + 0.1, sa * 0.13],
      [-0.1 - ca * 0.1 + w, H - 0.14, sa * 0.135],
      [-0.13 - ca * 0.08 - w, H - 0.14 - len * 0.6, sa * 0.13],
      [-0.14 - ca * 0.06 + w, H - 0.14 - len, sa * 0.11],
    ], [0.06, 0.058, 0.045, 0.014]));
  }
  const sd2 = (s) => (s > 0 ? 'R' : 'L');
  return {
    cell: 0.0115,
    bones: humanoidBones(PRIN_P),
    layers: [
      layer('skin', 'skin', skin, 0.04, [
        C('neck', [0.03, 1.19, 0], [0.04, 1.33, 0], 0.044, 0.042),
        E('head', [0.05, H, 0], [0.18, 0.185, 0.17]),
        E('head', [0.12, H - 0.075, 0], [0.095, 0.08, 0.105]),
        ...LR((s) => [
          E('head', [0.16, H - 0.05, 0.08 * s], [0.06, 0.055, 0.05], { k: 0.04 }),
          S('head', [0.2, H + 0.005, 0.066 * s], 0.034, { neg: true, k: 0.014 }),
          // pálpebra de cima (olhar meigo)
          E('head', [0.19, H + 0.03, 0.066 * s], [0.03, 0.014, 0.044], { rot: [0, 0, -0.3], k: 0.01 }),
          // sorriso
          C('head', [0.212, H - 0.088, 0.027 * s], [0.221, H - 0.097, 0.0], 0.0075, 0.0085, { col: 0xd03858, k: 0.005 }),
        ]),
        S('head', [0.232, H - 0.035, 0], 0.016, { k: 0.02 }),
      ], { pattern: compose(facePat, mottle(0.035, 7)), rough: { amp: 0.0008, freq: 40 }, cell: 0.0085 }),
      layer('gown', 'cloth', white, 0.04, [
        // corpete rosa de gola alta, cintura, faixa com laço atrás
        E('chest', [0.03, 1.07, 0], [0.115, 0.135, 0.145], { col: pink }),
        E('chest', [0.06, 1.12, 0], [0.09, 0.07, 0.125], { col: pink }),
        E('chest', [0.03, 1.18, 0], [0.07, 0.04, 0.09], { col: pink }),
        E('spine', [0.01, 0.96, 0], [0.1, 0.08, 0.12], { col: pink }),
        T('spine', [0.01, 0.92, 0], 0.115, 0.026, { col: hot, k: 0.015 }),
        ...LR((s) => [E('spine', [-0.14, 0.945, 0.065 * s], [0.04, 0.055, 0.065], { rot: [0.6 * s, 0, 0], col: hot, k: 0.015 })]),
        ...LR((s) => [C('spine', [-0.125, 0.91, 0.02 * s], [-0.17, 0.7, 0.06 * s], 0.026, 0.016, { col: hot, k: 0.015 })]),
        // gola de babado
        T('neck', [0.035, 1.235, 0], 0.062, 0.024, { k: 0.015 }),
        C('neck', [0.03, 1.18, 0], [0.034, 1.235, 0], 0.06, 0.052, { col: pink, k: 0.02 }),
        // saia em sino pregueada, barra de babado rosa e lacinhos
        drape('hips', [0.01, 0.93, 0], [-0.03, 0.03, 0], 0.12, 0.4, { n: 12, amp: 0.065, pw: 1.4, k: 0.04 }),
        T('hips', [-0.03, 0.065, 0], 0.4, 0.048, { col: pink, k: 0.02 }),
        ...[-0.75, 0, 0.75].map((a) => E('hips', [Math.cos(a) * 0.4 - 0.02, 0.16, Math.sin(a) * 0.4], [0.02, 0.035, 0.045], { col: hot, rot: [0, -a, 0], k: 0.012 })),
        // mangas bufantes e braços de luva branca
        ...LR((s) => [
          E('upperarm.' + sd2(s), [0.02, 1.15, 0.155 * s], [0.08, 0.075, 0.075], { col: pink }),
          C('upperarm.' + sd2(s), [0.02, 1.14, 0.155 * s], [0.04, 0.99, 0.175 * s], 0.04, 0.034),
          C('forearm.' + sd2(s), [0.04, 0.99, 0.175 * s], [0.15, 0.92, 0.08 * s], 0.034, 0.03),
          E('hand.' + sd2(s), [0.18, 0.91, 0.06 * s], [0.045, 0.04, 0.03]),
        ]),
      ], { pattern: mottle(0.04, 14), rough: { amp: 0.001, freq: 30 }, cell: 0.016, keep: 0.34 }),
      layer('hair', 'hair', hair, 0.03, [
        E('head', [0.02, H + 0.08, 0], [0.19, 0.16, 0.18]),
        E('head', [-0.06, H, 0], [0.15, 0.17, 0.165]),
        E('head', [0.25, H - 0.03, 0], [0.15, 0.16, 0.16], { neg: true, k: 0.03 }),
        // franja repartida
        ...[-3, -2, -1, 1, 2, 3].flatMap((i) => strand(['head'], [
          [0.06, H + 0.235, 0.018 * i], [0.185, H + 0.155, 0.04 * i], [0.222, H + 0.085 + Math.abs(i) * 0.008 - (Math.abs(i) % 2) * 0.03, 0.046 * i],
        ], [0.032, 0.028, 0.006], 0.008)),
        // mechas laterais terminando em cachos
        ...LR((s) => [
          ...strand(['head'], [[0.07, H + 0.12, 0.16 * s], [0.12, H - 0.07, 0.175 * s], [0.115, H - 0.21, 0.16 * s], [0.135, H - 0.26, 0.13 * s]], [0.04, 0.036, 0.026, 0.016]),
          // cílios e sobrancelhas
          C('head', [0.226, H + 0.03, 0.035 * s], [0.208, H + 0.04, 0.1 * s], 0.009, 0.007, { col: 0x3a1050, k: 0.006 }),
          C('head', [0.208, H + 0.04, 0.1 * s], [0.19, H + 0.06, 0.118 * s], 0.007, 0.004, { col: 0x3a1050, k: 0.006 }),
        ]),
        ...back,
      ], { rough: { amp: 0.0008, freq: 40 }, pattern: compose(hairPat, mottle(0.05, 10)), cell: 0.0125 }),
      layer('crown', 'gold', gold, 0.012, [
        T('head', [0.03, H + 0.245, 0], 0.088, 0.018, { rot: [0, 0, -0.22] }),
        ...[0, 1, 2, 3, 4].flatMap((i) => {
          const a = (i / 5) * Math.PI * 2, cx = 0.03 + Math.cos(a) * 0.086, cz = Math.sin(a) * 0.086, cy = H + 0.245 - Math.cos(a) * 0.019;
          return [C('head', [cx, cy, cz], [cx - 0.012, cy + 0.08, cz], 0.02, 0.006), S('head', [cx - 0.012, cy + 0.086, cz], 0.014)];
        }),
      ]),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.187, H + 0.004, 0.066 * s], 0.037, { iris: 0x5a3ab8, irisSize: 0.85, pupilSize: 0.4, look: [1, 0.05, 0.14 * s] })),
      stud('head', [0.118, H + 0.23, 0], 0.02, { col: 0xe0203a, mat: 'wet' }),
      stud('chest', [0.135, 1.13, 0], 0.017, { col: 0xe0203a, mat: 'wet' }),
    ],
  };
}

export const SPECIES = { crow, raven, bat, pig, knight, plant, princess };
