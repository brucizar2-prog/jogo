// Mortos-vivos que andam pelo chão: Zumbi e Esqueleto soldado (com espada e escudo) + caveira.
import { C, E, S, Bx, T, LR, layer, humanoidBones, eye, teeth, obj, mottle, compose, hex, mixc, hemCut } from './kit.js';
import { fbm3 } from '../organic.js';

// ================================================================== ZUMBI
// pele azul-acinzentada com manchas, cabelo vermelho desgrenhado, camisa e calção vermelhos
// rasgados, cinto preto, corcunda, braços compridos com mãos grandes de garras.
const ZOMBIE_P = {
  hip: [0, 0.78], spine: [0.03, 0.92], chest: [0.08, 1.1], neck: [0.15, 1.3], head: [0.2, 1.38],
  thigh: [0, 0.76, 0.12], knee: [0.06, 0.43, 0.13], ankle: [0, 0.1, 0.13],
  shoulder: [0.1, 1.24, 0.23], elbow: [0.16, 0.98, 0.3], wrist: [0.22, 0.76, 0.32],
};
// manchas arroxeadas e pele mais escura nas extremidades
const bruises = (x, y, z, c) => {
  const n = fbm3(x * 6 + 3, y * 6, z * 6, 3);
  let r = c;
  if (n > 0.6) r = mixc(r, hex(0x6a5a92), Math.min(1, (n - 0.6) * 5) * 0.7);
  if (y < 0.12 || (y < 0.8 && Math.abs(z) > 0.3)) r = r.map((v) => v * 0.82);
  return r;
};
// a cabeça do zumbi é desenhada em escala 1 e ampliada em volta do pescoço
const ZK = 1.22, ZP = [0.17, 1.36, 0];
const zh = (p) => [ZP[0] + (p[0] - ZP[0]) * ZK, ZP[1] + (p[1] - ZP[1]) * ZK, p[2] * ZK];
const zr = (r) => r.map((v) => v * ZK);
const zhead = (list) => list;
export function zombie() {
  const skin = 0x8ea4c8, dk = 0x5e7096, red = 0xb3261e, darkred = 0x7a1612;
  const hairStrands = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, s = Math.sin(i * 2.3), c = Math.cos(i * 1.7);
    const b = zh([0.16 - Math.cos(a) * 0.08, 1.6 + Math.abs(Math.sin(a)) * 0.02, Math.sin(a) * 0.1]);
    const out = [b[0] - 0.12 - 0.07 * Math.abs(s) - Math.max(0, -Math.cos(a)) * 0.08, b[1] + 0.06 + 0.07 * c, b[2] * 1.6 + 0.05 * s];
    hairStrands.push(C('head', b, out, 0.065, 0.012, { k: 0.04 }));
  }
  return {
    cell: 0.0125,
    bones: humanoidBones(ZOMBIE_P),
    layers: [
      layer('skin', 'flesh', skin, 0.045, [
        E('hips', [0, 0.8, 0], [0.12, 0.1, 0.14]),
        E('spine', [0.04, 0.93, 0], [0.105, 0.12, 0.125]),
        E('chest', [0.09, 1.1, 0], [0.12, 0.14, 0.17]),
        ...LR((s) => [E('chest', [0.08, 1.21, 0.15 * s], [0.075, 0.06, 0.085])]),
        C('neck', [0.12, 1.2, 0], [0.19, 1.4, 0], 0.06, 0.055),
        // cabeça grande, inclinada para frente (ampliada em volta do pescoço)
        ...zhead([
          E('head', zh([0.22, 1.5, 0]), zr([0.15, 0.165, 0.135]), { rot: [0, 0, -0.2] }),
          E('head', zh([0.3, 1.4, 0]), zr([0.105, 0.072, 0.11])),
          ...LR((s) => [
            E('head', zh([0.315, 1.47, 0.072 * s]), zr([0.045, 0.035, 0.04]), { k: 0.03 }),
            S('head', zh([0.345, 1.5, 0.056 * s]), 0.04 * ZK, { neg: true, k: 0.016 }),
            C('head', zh([0.2, 1.5, 0.125 * s]), zh([0.12, 1.62, 0.22 * s]), 0.038, 0.007, { k: 0.02 }),
            E('head', zh([0.27, 1.43, 0.11 * s]), zr([0.04, 0.03, 0.02]), { neg: true, k: 0.02 }),
          ]),
          ...LR((s) => [C('head', zh([0.355, 1.52, 0.012 * s]), zh([0.328, 1.552, 0.1 * s]), 0.026, 0.022, { k: 0.025 })]),
          C('head', zh([0.35, 1.52, 0]), zh([0.38, 1.47, 0]), 0.02, 0.026, { k: 0.02 }),
          E('head', zh([0.37, 1.425, 0]), zr([0.06, 0.032, 0.1]), { neg: true, k: 0.012 }),
          E('head', zh([0.335, 1.425, 0]), zr([0.04, 0.028, 0.085]), { col: 0x3a0c0c, k: 0.006 }),
        ]),
        // braços compridos e mãos grandes
        ...LR((s, sd) => [
          C('upperarm.' + sd, [0.1, 1.24, 0.23 * s], [0.16, 0.98, 0.3 * s], 0.056, 0.042),
          S('forearm.' + sd, [0.16, 0.98, 0.3 * s], 0.042),
          C('forearm.' + sd, [0.16, 0.98, 0.3 * s], [0.22, 0.77, 0.32 * s], 0.046, 0.034),
          E('forearm.' + sd, [0.18, 0.92, 0.305 * s], [0.04, 0.07, 0.04], { k: 0.03 }),
          E('hand.' + sd, [0.24, 0.72, 0.33 * s], [0.055, 0.06, 0.032], { col: dk }),
          ...[-1, 0, 1, 2].map((f) => C('hand.' + sd, [0.26 + f * 0.012, 0.69, (0.33 + f * 0.018 - 0.01) * s], [0.29 + f * 0.012, 0.58 - Math.abs(f - 0.5) * 0.015, (0.335 + f * 0.024 - 0.01) * s], 0.016, 0.01, { col: dk, k: 0.012 })),
          C('hand.' + sd, [0.22, 0.72, 0.3 * s], [0.26, 0.66, 0.27 * s], 0.016, 0.011, { col: dk, k: 0.012 }),
          // pernas finas, joelhos ossudos, pés grandes
          C('thigh.' + sd, [0, 0.78, 0.12 * s], [0.06, 0.44, 0.13 * s], 0.065, 0.045),
          S('shin.' + sd, [0.065, 0.43, 0.13 * s], 0.05),
          C('shin.' + sd, [0.06, 0.42, 0.13 * s], [0.01, 0.1, 0.13 * s], 0.046, 0.034),
          E('foot.' + sd, [0.08, 0.045, 0.13 * s], [0.13, 0.045, 0.065], { col: dk }),
          ...[-1, 0, 1].map((f) => S('foot.' + sd, [0.2, 0.035, (0.13 + f * 0.035) * s], 0.025, { col: dk, k: 0.015 })),
        ]),
      ], { pattern: compose(mottle(0.12, 7), bruises), rough: { amp: 0.002, freq: 30 } }),
      // camisa sem mangas rasgada (barra serrilhada e furos)
      layer('shirt', 'cloth', red, 0.04, [
        E('chest', [0.09, 1.1, 0], [0.135, 0.155, 0.185]),
        E('spine', [0.04, 0.94, 0], [0.12, 0.14, 0.142]),
        E('hips', [0.0, 0.82, 0], [0.134, 0.1, 0.155]),
        ...LR((s) => [C('chest', [0.09, 1.21, 0.15 * s], [0.11, 1.17, 0.22 * s], 0.065, 0.058)]),
        E('neck', [0.17, 1.27, 0], [0.08, 0.06, 0.09], { neg: true, k: 0.02 }),
        S('chest', [0.2, 1.06, 0.1], 0.03, { neg: true, k: 0.01 }),
        S('spine', [-0.06, 0.98, -0.11], 0.035, { neg: true, k: 0.01 }),
        S('chest', [0.05, 1.12, -0.18], 0.028, { neg: true, k: 0.01 }),
      ], { cuts: [hemCut(0.75, { amp: 0.045, teeth: 17, cx: 0.03, seed: 2 })], pattern: compose(mottle(0.18, 14), (x, y, z, c) => (y < 0.8 ? c.map((v) => v * 0.8) : c)), rough: { amp: 0.003, freq: 28 } }),
      // calção rasgado na altura do joelho
      layer('pants', 'cloth', darkred, 0.04, [
        E('hips', [0, 0.8, 0], [0.13, 0.11, 0.15]),
        ...LR((s, sd) => [C('thigh.' + sd, [0, 0.77, 0.12 * s], [0.06, 0.47, 0.13 * s], 0.076, 0.062)]),
      ], { cuts: [hemCut(0.52, { amp: 0.06, teeth: 14, cx: 0.03, seed: 5 })], pattern: mottle(0.2, 16), rough: { amp: 0.003, freq: 28 } }),
      layer('belt', 'leather', 0x1c1814, 0.01, [E('spine', [0.035, 0.86, 0], [0.13, 0.03, 0.155])]),
      // cabelo vermelho desgrenhado
      layer('hair', 'hair', 0xc8342a, 0.04, [
        E('head', zh([0.17, 1.6, 0]), zr([0.135, 0.09, 0.135]), { rot: [0, 0, -0.2] }),
        E('head', zh([0.08, 1.52, 0]), zr([0.095, 0.115, 0.125])),
        ...hairStrands,
      ], { rough: { amp: 0.005, freq: 40 }, pattern: mottle(0.22, 24) }),
      // garras escuras
      layer('claws', 'claw', 0x2a2220, 0.008, LR((s, sd) => [
        ...[-1, 0, 1, 2].map((f) => C('hand.' + sd, [0.29 + f * 0.012, 0.585 - Math.abs(f - 0.5) * 0.015, (0.335 + f * 0.024 - 0.01) * s], [0.3 + f * 0.012, 0.545 - Math.abs(f - 0.5) * 0.015, (0.336 + f * 0.024 - 0.01) * s], 0.011, 0.003)),
      ]), { cell: 0.009 }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', zh([0.338, 1.5, 0.056 * s]), 0.036, { sclera: 0xeedc9a, iris: 0xd01010, irisGlow: 0.9, irisSize: 0.7, pupilSize: 0.22, look: [1, 0, 0.18 * s], squash: [1, 0.78, 1] })),
      teeth('head', zh([0.362, 1.44, 0]), 0.2, 10, 0.038, 0.013, { curve: 0.08, jag: 0.4 }),
      teeth('head', zh([0.357, 1.408, 0]), 0.19, 9, 0.034, 0.012, { dir: -1, curve: 0.08, jag: 0.4 }),
      obj('pot', 'hand.L', [0.33, 0.66, -0.3], { name: 'pot' }),
    ],
  };
}

// ================================================================== ESQUELETO SOLDADO
const SKEL_P = {
  hip: [0, 0.8], spine: [0, 0.92], chest: [0.02, 1.1], neck: [0.04, 1.31], head: [0.06, 1.38],
  thigh: [0, 0.78, 0.1], knee: [0.03, 0.44, 0.11], ankle: [0, 0.08, 0.11],
  shoulder: [0.02, 1.27, 0.19], elbow: [0.05, 1.03, 0.25], wrist: [0.08, 0.8, 0.27],
};
// crânio grande com órbitas fundas, cavidade nasal e maçãs do rosto
const skullPrims = (b, y0, x0 = 0) => [
  E(b, [x0 + 0.07, y0 + 0.18, 0], [0.14, 0.145, 0.128]),
  E(b, [x0 + 0.02, y0 + 0.16, 0], [0.1, 0.11, 0.105]),
  E(b, [x0 + 0.155, y0 + 0.085, 0], [0.085, 0.068, 0.088]),
  ...LR((s) => [
    E(b, [x0 + 0.17, y0 + 0.118, 0.08 * s], [0.048, 0.03, 0.036], { k: 0.02 }),
    S(b, [x0 + 0.215, y0 + 0.158, 0.058 * s], 0.052, { neg: true, k: 0.014 }),
    E(b, [x0 + 0.07, y0 + 0.13, 0.13 * s], [0.05, 0.035, 0.025], { neg: true, k: 0.02 }),
  ]),
  E(b, [x0 + 0.236, y0 + 0.1, 0], [0.018, 0.03, 0.016], { neg: true, k: 0.008 }),
  E(b, [x0 + 0.14, y0 + 0.005, 0], [0.068, 0.032, 0.072]),
  E(b, [x0 + 0.19, y0 + 0.0, 0], [0.03, 0.026, 0.04], { k: 0.02 }),
  E(b, [x0 + 0.215, y0 + 0.042, 0], [0.032, 0.011, 0.068], { neg: true, k: 0.006 }),
];
export function skeleton() {
  const bone = 0xe9e0c8, dark = 0xb8ab8a;
  const sd2 = (s) => (s > 0 ? 'R' : 'L');
  return {
    cell: 0.0115,
    bones: humanoidBones(SKEL_P),
    layers: [layer('bone', 'bone', bone, 0.02, [
      ...skullPrims('head', 1.38),
      // coluna
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => S(i < 3 ? 'spine' : i < 7 ? 'chest' : 'neck', [-0.02 + i * 0.006, 0.84 + i * 0.058, 0], 0.033, { k: 0.015 })),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => C(i < 3 ? 'spine' : 'chest', [-0.02 + i * 0.006, 0.86 + i * 0.058, 0], [-0.06 + i * 0.006, 0.85 + i * 0.058, 0], 0.012, 0.008, { k: 0.01 })),
      // costelas, esterno e clavículas
      ...[0, 1, 2, 3, 4].map((i) => T('chest', [0.05, 1.23 - i * 0.055, 0], 0.12 - i * 0.004 - (i > 3 ? 0.01 : 0), 0.017, { rot: [0, 0, -0.18], k: 0.01 })),
      Bx('chest', [0.19, 1.04, 0], [0.06, 0.16, 0.045], 0.02, { neg: true, k: 0.008 }),
      C('chest', [0.165, 1.25, 0], [0.165, 1.04, 0], 0.016, 0.012, { k: 0.01 }),
      ...LR((s) => [C('chest', [0.15, 1.27, 0.02 * s], [0.03, 1.29, 0.18 * s], 0.013, 0.011, { k: 0.01 })]),
      // bacia
      E('hips', [0, 0.83, 0], [0.07, 0.06, 0.115]),
      ...LR((s) => [E('hips', [-0.01, 0.87, 0.085 * s], [0.042, 0.075, 0.07], { rot: [0.5 * s, 0, 0] })]),
      // braços
      ...LR((s) => [
        S('upperarm.' + sd2(s), [0.02, 1.27, 0.19 * s], 0.042),
        C('upperarm.' + sd2(s), [0.02, 1.27, 0.19 * s], [0.05, 1.03, 0.25 * s], 0.025, 0.022),
        S('forearm.' + sd2(s), [0.05, 1.03, 0.25 * s], 0.034),
        C('forearm.' + sd2(s), [0.05, 1.03, 0.24 * s], [0.08, 0.81, 0.26 * s], 0.017, 0.015),
        C('forearm.' + sd2(s), [0.05, 1.03, 0.262 * s], [0.08, 0.81, 0.282 * s], 0.015, 0.014),
        E('hand.' + sd2(s), [0.09, 0.77, 0.27 * s], [0.045, 0.05, 0.026]),
        ...[-1, 0, 1].map((f) => C('hand.' + sd2(s), [0.1, 0.74, (0.27 + f * 0.017) * s], [0.125, 0.67, (0.272 + f * 0.022) * s], 0.011, 0.008, { k: 0.006 })),
        // pernas
        S('thigh.' + sd2(s), [0, 0.79, 0.1 * s], 0.04),
        C('thigh.' + sd2(s), [0, 0.79, 0.1 * s], [0.03, 0.45, 0.11 * s], 0.03, 0.025),
        S('shin.' + sd2(s), [0.03, 0.44, 0.11 * s], 0.042),
        C('shin.' + sd2(s), [0.03, 0.43, 0.105 * s], [0, 0.08, 0.11 * s], 0.026, 0.021),
        C('shin.' + sd2(s), [0.02, 0.42, 0.13 * s], [-0.01, 0.09, 0.127 * s], 0.015, 0.013),
        E('foot.' + sd2(s), [0.06, 0.04, 0.11 * s], [0.095, 0.036, 0.055]),
        ...[-1, 0, 1].map((f) => C('foot.' + sd2(s), [0.12, 0.03, (0.11 + f * 0.024) * s], [0.18, 0.022, (0.11 + f * 0.03) * s], 0.013, 0.01, { k: 0.006 })),
      ]),
    ], { cavity: 1.6, pattern: (x, y, z, c) => { const n = fbm3(x * 14, y * 14, z * 14, 2); return mixc(c, hex(dark), Math.max(0, n - 0.5) * 1.4); } })],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.185, 1.535, 0.056 * s], 0.018, { glow: 0xff2a10, ei: 3 })),
      teeth('head', [0.222, 1.448, 0], 0.13, 8, 0.03, 0.013, { curve: 0.06, jag: 0.15, col: 0xf4ecd6 }),
      teeth('head', [0.212, 1.418, 0], 0.12, 7, 0.026, 0.012, { dir: -1, curve: 0.06, jag: 0.15, col: 0xf4ecd6 }),
      obj('sword', 'hand.R', [0.1, 0.76, 0.27], { rot: [0, 0, -1.25], name: 'sword' }),
      obj('shield', 'forearm.L', [0.17, 0.92, -0.29], { rot: [0, 2.0, 0], R: 0.17, name: 'shield' }),
    ],
  };
}
export function skull() {
  return {
    cell: 0.011,
    bones: [['root', '', 0, 0, 0]],
    layers: [layer('bone', 'bone', 0xe9e0c8, 0.02, skullPrims('root', -0.03, -0.06), { cavity: 1.6 })],
    rigid: [...[1, -1].map((s) => eye('root', [0.125, 0.125, 0.056 * s], 0.018, { glow: 0xff2a10, ei: 3 }))],
  };
}

export const SPECIES = { zombie, skeleton, skull };
