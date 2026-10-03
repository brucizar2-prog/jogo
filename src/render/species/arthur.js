// Arthur: cavaleiro robusto de barba, armadura de placas em lâminas (referência do usuário),
// e o corpo por baixo (aparece de cueca quando perde a armadura), mais o sapo e a ossada.
import { C, E, S, Bx, LR, layer, humanoidBones, eye, stud, mottle, compose, hex, mixc, horn } from './kit.js';
import { fbm3 } from '../organic.js';

export const ARTHUR_P = {
  hip: [0, 0.74], spine: [0.02, 0.9], chest: [0.03, 1.1], neck: [0.04, 1.34], head: [0.05, 1.44],
  thigh: [0, 0.72, 0.15], knee: [0.035, 0.41, 0.16], ankle: [0, 0.11, 0.165],
  shoulder: [0, 1.27, 0.34], elbow: [0.03, 1.02, 0.42], wrist: [0.07, 0.8, 0.45],
};

// coraçõezinhos vermelhos na cueca (padrão no plano em volta do quadril)
function hearts(x, y, z, c) {
  // coordenadas no "cilindro" em volta do quadril (ou da coxa)
  const leg = y < 0.66;
  const cz = leg ? Math.sign(z) * 0.15 : 0;
  const u = Math.atan2(z - cz, x) * (leg ? 0.13 : 0.22), v = y;
  const q = 0.115;
  const cu = Math.round(u / q), off = (((cu % 2) + 2) % 2) * q * 0.5;
  const cv = Math.round((v - off) / q);
  const hx = (u - cu * q) / 0.034, hy = (v - (cv * q + off)) / 0.034 + 0.25;
  const a = hx * hx + hy * hy - 1;
  if (a * a * a - hx * hx * hy * hy * hy < 0) return hex(0xd3152a);
  return c;
}

// corpo (tronco e membros) — usado pela pele e, inflado, pela cota por baixo da armadura
function bodyPrims(g = 0) {
  return [
    E('hips', [0, 0.78, 0], [0.19 + g, 0.15 + g, 0.22 + g]),
    E('spine', [0.04, 0.93, 0], [0.19 + g, 0.18 + g, 0.215 + g]),
    E('spine', [0.08, 0.9, 0], [0.11 + g, 0.12 + g, 0.15 + g], { k: 0.06 }),
    E('chest', [0.03, 1.15, 0], [0.19 + g, 0.2 + g, 0.26 + g]),
    ...LR((s) => [
      E('chest', [0.13, 1.18, 0.1 * s], [0.08, 0.08, 0.1], { k: 0.04 }),
      C('chest', [0, 1.28, 0.12 * s], [0.02, 1.36, 0.03 * s], 0.075 + g, 0.065 + g),
    ]),
    ...LR((s, sd) => [
      E('upperarm.' + sd, [0, 1.27, 0.35 * s], [0.11 + g, 0.11 + g, 0.105 + g]),
      C('upperarm.' + sd, [0, 1.27, 0.34 * s], [0.03, 1.02, 0.42 * s], 0.088 + g, 0.07 + g),
      E('upperarm.' + sd, [0.055, 1.15, 0.38 * s], [0.065, 0.085, 0.065], { k: 0.03 }),
      C('forearm.' + sd, [0.03, 1.02, 0.42 * s], [0.07, 0.81, 0.45 * s], 0.075 + g, 0.055 + g),
      E('hand.' + sd, [0.08, 0.75, 0.46 * s], [0.058 + g, 0.075 + g, 0.048 + g]),
      C('hand.' + sd, [0.1, 0.73, 0.46 * s], [0.13, 0.66, 0.455 * s], 0.038 + g, 0.03 + g, { k: 0.02 }),
      C('hand.' + sd, [0.095, 0.775, 0.42 * s], [0.135, 0.745, 0.4 * s], 0.022 + g, 0.018 + g, { k: 0.02 }),
      C('thigh.' + sd, [0, 0.74, 0.15 * s], [0.035, 0.43, 0.16 * s], 0.125 + g, 0.088 + g),
      S('shin.' + sd, [0.05, 0.41, 0.16 * s], 0.078 + g, { k: 0.04 }),
      E('shin.' + sd, [-0.015, 0.28, 0.16 * s], [0.075 + g, 0.1 + g, 0.07 + g]),
      C('shin.' + sd, [0.035, 0.41, 0.16 * s], [0.01, 0.12, 0.165 * s], 0.074 + g, 0.056 + g),
      E('foot.' + sd, [0.08, 0.05, 0.165 * s], [0.14 + g, 0.055 + g, 0.072 + g]),
      S('foot.' + sd, [-0.03, 0.07, 0.165 * s], 0.058 + g, { k: 0.04 }),
    ]),
  ];
}

export function arthur() {
  const metal = 0xc2c9d6, trim = 0x8a93a6, skin = 0xe3a17a, beard = 0x6a3417;
  const k = 0.012;            // placas: união quase dura (bordas nítidas)
  return {
    cell: 0.0135,
    bones: humanoidBones(ARTHUR_P),
    layers: [
      // ---------------------------------------------------------------- rosto e pescoço (sempre visíveis)
      layer('face', 'skin', skin, 0.05, [
        C('neck', [0.03, 1.28, 0], [0.05, 1.46, 0], 0.1, 0.09),
        E('head', [0.05, 1.62, 0], [0.18, 0.2, 0.17]),
        E('head', [0.13, 1.5, 0], [0.115, 0.09, 0.13]),
        ...LR((s) => [E('head', [0.19, 1.56, 0.08 * s], [0.065, 0.055, 0.055], { k: 0.04 })]),
        E('head', [0.215, 1.67, 0], [0.04, 0.025, 0.12], { k: 0.035 }),
        C('head', [0.228, 1.645, 0], [0.27, 1.575, 0], 0.025, 0.034, { k: 0.03 }),
        E('head', [0.268, 1.57, 0], [0.03, 0.025, 0.036], { k: 0.02 }),
        ...LR((s) => [
          E('head', [0.035, 1.59, 0.165 * s], [0.04, 0.06, 0.022], { k: 0.02 }),
          S('head', [0.222, 1.625, 0.064 * s], 0.034, { neg: true, k: 0.018 }),
        ]),
      ], { pattern: mottle(0.06, 7), rough: { amp: 0.0012, freq: 40 } }),
      // ---------------------------------------------------------------- corpo (sem armadura)
      layer('skin', 'skin', skin, 0.05, bodyPrims(0), { pattern: mottle(0.06, 7), rough: { amp: 0.0012, freq: 40 }, set: 'naked' }),
      // cota acolchoada escura por baixo das placas (só aparece nas frestas)
      layer('mail', 'leather', 0x464852, 0.05, bodyPrims(0), { cavity: 0.5, cell: 0.02, set: 'armored' }),
      // ---------------------------------------------------------------- barba, bigode, sobrancelhas, cabelo
      layer('beard', 'hair', beard, 0.04, [
        E('head', [0.17, 1.5, 0], [0.11, 0.115, 0.145]),
        C('head', [0.21, 1.5, 0], [0.265, 1.4, 0], 0.075, 0.038),
        ...LR((s) => [
          C('head', [0.1, 1.6, 0.152 * s], [0.15, 1.5, 0.13 * s], 0.035, 0.055),
          C('head', [0.274, 1.55, 0.008 * s], [0.255, 1.51, 0.095 * s], 0.026, 0.016, { k: 0.015 }),
          C('head', [0.243, 1.672, 0.022 * s], [0.228, 1.682, 0.105 * s], 0.02, 0.015, { k: 0.012 }),
        ]),
      ], { rough: { amp: 0.005, freq: 45 }, pattern: mottle(0.12, 30) }),
      // cabelo (escondido pelo elmo)
      layer('hair', 'hair', beard, 0.04, [
        E('head', [0.04, 1.7, 0], [0.19, 0.155, 0.176]),
        E('head', [-0.05, 1.62, 0], [0.135, 0.14, 0.158]),
        E('head', [0.19, 1.75, 0], [0.05, 0.03, 0.12], { k: 0.04 }),
      ], { rough: { amp: 0.006, freq: 40 }, pattern: mottle(0.12, 30), set: 'naked' }),
      // ---------------------------------------------------------------- cueca
      layer('boxers', 'cloth', 0xf4efe4, 0.04, [
        E('hips', [0, 0.765, 0], [0.205, 0.155, 0.235]),
        ...LR((s, sd) => [C('thigh.' + sd, [0, 0.74, 0.15 * s], [0.02, 0.55, 0.155 * s], 0.137, 0.125)]),
      ], { pattern: hearts, rough: { amp: 0.002, freq: 25 }, keep: 0.6, cell: 0.0105, set: 'naked' }),
      // ---------------------------------------------------------------- armadura
      layer('armor', 'metal', metal, k, [
        // peitoral com aresta central e gola
        E('chest', [0.05, 1.15, 0], [0.235, 0.235, 0.3], { k: 0.03 }),
        C('chest', [0.28, 1.02, 0], [0.265, 1.3, 0], 0.022, 0.02, { k: 0.04 }),
        E('neck', [0.03, 1.33, 0], [0.145, 0.065, 0.17], { col: trim }),
        E('neck', [0.035, 1.38, 0], [0.12, 0.05, 0.145], { col: trim }),
        // lâminas do abdômen
        E('spine', [0.05, 0.97, 0], [0.225, 0.07, 0.27]),
        E('spine', [0.045, 0.9, 0], [0.23, 0.065, 0.275]),
        // saiote de placas (tassets) abertas na frente
        E('hips', [0.02, 0.78, 0], [0.235, 0.075, 0.282]),
        E('hips', [0.02, 0.7, 0], [0.245, 0.075, 0.29]),
        Bx('hips', [0.25, 0.7, 0], [0.07, 0.12, 0.015], 0.006, { neg: true, k: 0.008 }),
        ...LR((s, sd) => [
          // ombreiras em 3 lâminas
          E('upperarm.' + sd, [-0.01, 1.3, 0.35 * s], [0.165, 0.12, 0.165], { rot: [0.36 * s, 0, 0] }),
          E('upperarm.' + sd, [-0.005, 1.22, 0.38 * s], [0.15, 0.06, 0.145], { rot: [0.46 * s, 0, 0] }),
          E('upperarm.' + sd, [0.0, 1.16, 0.4 * s], [0.13, 0.05, 0.125], { rot: [0.54 * s, 0, 0], col: trim }),
          // braço, cotoveleira, antebraço
          C('upperarm.' + sd, [0.01, 1.2, 0.36 * s], [0.03, 1.05, 0.41 * s], 0.095, 0.085),
          S('forearm.' + sd, [0.035, 1.02, 0.42 * s], 0.095, { col: trim }),
          E('forearm.' + sd, [-0.04, 1.02, 0.45 * s], [0.05, 0.075, 0.04], { col: trim }),
          C('forearm.' + sd, [0.04, 0.98, 0.43 * s], [0.065, 0.84, 0.455 * s], 0.083, 0.075),
          // manopla: punho evasê, mão, dedos e polegar
          E('hand.' + sd, [0.07, 0.805, 0.455 * s], [0.098, 0.05, 0.098]),
          E('hand.' + sd, [0.082, 0.735, 0.462 * s], [0.074, 0.088, 0.058]),
          C('hand.' + sd, [0.105, 0.71, 0.462 * s], [0.14, 0.63, 0.455 * s], 0.05, 0.04),
          C('hand.' + sd, [0.095, 0.765, 0.415 * s], [0.14, 0.735, 0.39 * s], 0.03, 0.025),
          // coxote, joelheira com leque, caneleira com panturrilha, sapato de lâminas
          C('thigh.' + sd, [0, 0.68, 0.15 * s], [0.035, 0.47, 0.16 * s], 0.14, 0.11),
          S('shin.' + sd, [0.065, 0.41, 0.16 * s], 0.095, { col: trim }),
          E('shin.' + sd, [0.11, 0.43, 0.16 * s], [0.035, 0.08, 0.095]),
          C('shin.' + sd, [0.04, 0.37, 0.16 * s], [0.012, 0.15, 0.165 * s], 0.093, 0.078),
          E('shin.' + sd, [-0.02, 0.27, 0.16 * s], [0.088, 0.12, 0.086]),
          E('foot.' + sd, [0.065, 0.07, 0.165 * s], [0.16, 0.07, 0.09]),
          E('foot.' + sd, [0.18, 0.05, 0.165 * s], [0.08, 0.05, 0.072]),
          S('foot.' + sd, [-0.045, 0.075, 0.165 * s], 0.07),
        ]),
      ], { cavity: 1.4, set: 'armored' }),
      // cinto vermelho com fivela
      layer('belt', 'leather', 0xb8181c, 0.01, [E('spine', [0.04, 0.835, 0], [0.242, 0.048, 0.288])], { rough: { amp: 0.0015, freq: 30 }, set: 'armored' }),
      layer('gold', 'gold', 0xe2aa3c, 0.008, [
        Bx('spine', [0.282, 0.835, 0], [0.02, 0.048, 0.062], 0.012),
        Bx('spine', [0.298, 0.835, 0], [0.012, 0.028, 0.042], 0.006, { neg: true, k: 0.004 }),
      ], { set: 'armored' }),
      // ---------------------------------------------------------------- elmo
      layer('helmet', 'metal', metal, 0.02, [
        E('head', [0.04, 1.66, 0], [0.225, 0.225, 0.215]),
        C('head', [0.21, 1.8, 0], [0.04, 1.9, 0], 0.032, 0.03, { k: 0.03 }),
        C('head', [0.04, 1.9, 0], [-0.19, 1.77, 0], 0.03, 0.028, { k: 0.03 }),
        ...LR((s) => [E('head', [0.12, 1.5, 0.14 * s], [0.115, 0.115, 0.042], { rot: [0, -0.38 * s, 0] })]),
        E('head', [-0.12, 1.5, 0], [0.14, 0.14, 0.19]),
        E('head', [0.265, 1.55, 0], [0.13, 0.13, 0.13], { neg: true, k: 0.018 }),
      ], { cavity: 1.4, set: 'armored' }),
      // viseira com frestas de respiro
      layer('visor', 'metal', metal, 0.015, [
        E('head', [0.218, 1.716, 0], [0.068, 0.022, 0.186]),
        E('head', [0.214, 1.752, 0], [0.066, 0.022, 0.184]),
        E('head', [0.272, 1.734, 0], [0.012, 0.006, 0.15], { neg: true, k: 0.004 }),
      ], { cavity: 1.6, set: 'armored' }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.215, 1.625, 0.064 * s], 0.027, { iris: 0x5a3a1c, look: [1, 0, 0.12 * s] })),
      ...[1, -1].flatMap((s) => [stud('head', [0.04, 1.63, 0.208 * s], 0.014, { col: 0xd0d6e2, layer: 'helmet' }), stud('head', [-0.07, 1.63, 0.205 * s], 0.014, { col: 0xd0d6e2, layer: 'helmet' }),
        stud('upperarm.' + (s > 0 ? 'R' : 'L'), [0.1, 1.3, 0.45 * s], 0.016, { col: 0xd0d6e2, layer: 'armor' })]),
    ],
  };
}

export function frog() {
  return {
    cell: 0.016,
    bones: [['root', '', 0, 0, 0]],
    layers: [layer('body', 'flesh', 0x3aa83a, 0.07, [
      E('root', [0, 0.3, 0], [0.36, 0.23, 0.29]),
      E('root', [0.24, 0.42, 0], [0.2, 0.15, 0.22]),
      E('root', [0.12, 0.22, 0], [0.26, 0.12, 0.22], { col: 0xe4e08a, k: 0.04 }),
      E('root', [0.42, 0.38, 0], [0.04, 0.012, 0.16], { neg: true, k: 0.01 }),
      ...LR((s) => [
        S('root', [0.3, 0.57, 0.12 * s], 0.085, { k: 0.04 }),
        E('root', [-0.18, 0.2, 0.28 * s], [0.2, 0.12, 0.1], { rot: [0, 0, -0.4] }),
        E('root', [0.02, 0.035, 0.32 * s], [0.15, 0.03, 0.08], { col: 0x2e8a2e }),
        C('root', [0.24, 0.24, 0.15 * s], [0.32, 0.04, 0.2 * s], 0.05, 0.04),
        E('root', [0.36, 0.03, 0.2 * s], [0.07, 0.025, 0.06], { col: 0x2e8a2e }),
      ]),
    ], { pattern: (x, y, z, c) => (fbm3(x * 9, y * 9, z * 9) > 0.62 && y > 0.3 ? c.map((v) => v * 0.5) : c), rough: { amp: 0.004, freq: 22 } })],
    rigid: [1, -1].map((s) => eye('root', [0.33, 0.6, 0.12 * s], 0.055, { iris: 0xd8b020 })),
  };
}

export function bonepile() {
  return {
    cell: 0.013,
    bones: [['root', '', 0, 0, 0]],
    layers: [layer('bones', 'bone', 0xece2cc, 0.025, [
      E('root', [0.08, 0.16, 0], [0.15, 0.14, 0.13]),
      E('root', [0.17, 0.07, 0], [0.09, 0.05, 0.09]),
      ...LR((s) => [S('root', [0.19, 0.17, 0.055 * s], 0.045, { neg: true, k: 0.012 })]),
      S('root', [0.235, 0.1, 0], 0.022, { neg: true, k: 0.01 }),
      ...[[-0.55, 0.04, 0.12, -0.12, 0.05, 0.2], [-0.4, 0.04, -0.2, 0, 0.03, -0.12], [0.25, 0.03, 0.18, 0.55, 0.035, 0.05], [-0.3, 0.03, 0.3, -0.05, 0.03, 0.35]].flatMap(([a, b, c, d, e, f]) => [
        C('root', [a, b, c], [d, e, f], 0.022), S('root', [a, b, c], 0.036), S('root', [d, e, f], 0.036),
      ]),
      E('root', [-0.25, 0.06, 0], [0.12, 0.05, 0.14]),
    ], { cavity: 1.5 })],
  };
}
