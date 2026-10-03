// Demônios: Red Arremer, Petite Devil (azul e de lava), Satã (Firebrand) e o Mago (Morte).
import { C, E, S, LR, layer, humanoidBones, eye, teeth, obj, mottle, compose, hex, mixc } from './kit.js';
import { fbm3 } from '../organic.js';

// barra rasgada (cópia do hemCut do kit com o módulo corrigido para ângulos negativos)
// (jit: encurta a ponta de alguns dentes, sem quebrar a continuidade nos entalhes)
function hemCut(y0, opts = {}) {
  const { amp = 0.04, teeth = 9, cx = 0, cz = 0, seed = 1, noise = 0.02, jit = 0 } = opts;
  return (x, y, z) => {
    const a = Math.atan2(z - cz, x - cx);
    const t = (a / (Math.PI * 2)) * teeth + seed * 0.37;
    const q = ((t % 1) + 1) % 1, i = Math.floor(t);
    const saw = Math.abs(q - 0.5) * 2;
    const h = Math.sin(((i % teeth) + teeth) % teeth * 12.9898 + seed * 7.1) * 43758.5453;
    return y0 + amp * saw + jit * (1 - saw) * (h - Math.floor(h)) + noise * (fbm3(x * 9 + seed, 0, z * 9, 2) - 0.5) * 2 - y;
  };
}

// tom: costas e extremidades mais escuras, frente mais clara
const tone = (dk, amt = 0.35) => {
  const d = hex(dk);
  return (x, y, z, c) => {
    const back = Math.max(0, Math.min(1, (0.02 - x) * 3.5));
    const low = Math.max(0, Math.min(1, (0.16 - y) * 6));
    return mixc(c, d, Math.min(0.75, back * amt + low * 0.45));
  };
};

// ================================================================== GÁRGULA (Red Arremer / Petite Devil)
// corpo musculoso corcunda, cabeça grande em cone, orelhas pontudas, sorriso cheio de dentes,
// mãos e pés grandes com garras claras; braços das asas esculpidos (membrana fica no creature)
export const GARG_P = {
  hip: [-0.01, 0.64], spine: [0.04, 0.8], chest: [0.1, 0.98], neck: [0.17, 1.1], head: [0.27, 1.19],
  thigh: [0, 0.63, 0.16], knee: [0.17, 0.4, 0.23], ankle: [0.02, 0.13, 0.24],
  shoulder: [0.12, 1.06, 0.3], elbow: [0.12, 0.79, 0.39], wrist: [0.24, 0.56, 0.39],
};
export const GARG_HC = [0.31, 1.25];          // centro da cabeça (escala da cabeça gira em torno dele)
// pontos da asa (plano x-y, z do lado): ombro → cotovelo → pulso; a membrana sai do pulso
export const GARG_WING = { base: [-0.06, 1.1, 0.12], elbow: [-0.13, 1.42, 0.15], wrist: [-0.2, 1.86, 0.15] };

export function gargoyle(o) {
  const hk = o.head ?? 1;
  const [hx, hy] = GARG_HC;
  const h = (x, y, z) => [hx + (x - hx) * hk, hy + (y - hy) * hk, z * hk];
  const r = (v) => (Array.isArray(v) ? v.map((q) => q * hk) : v * hk);
  const W = GARG_WING;
  const bones = humanoidBones({
    ...GARG_P,
    extra: [
      ['wing.$', 'chest', ...W.base],
      ['tail', 'hips', -0.13, 0.6, 0], ['tail2', 'tail', -0.3, 0.38, 0],
      ['jaw', 'head', ...h(0.31, 1.19, 0)],
    ],
  });
  const lt = o.belly, dk = o.dark;
  // dedos longos e curvados (3 + polegar), pés de três dedos
  const fingers = (sd, s) => [-1, 0, 1].flatMap((f) => {
    const z0 = (0.395 + f * 0.034) * s, z1 = (0.4 + f * 0.05) * s;
    return [
      C('hand.' + sd, [0.31, 0.5, z0], [0.37, 0.42, z1], 0.03, 0.026, { k: 0.02, col: dk }),
      C('hand.' + sd, [0.37, 0.42, z1], [0.37, 0.34, z1], 0.026, 0.02, { k: 0.015, col: dk }),
    ];
  });
  const toes = (sd, s) => [-1, 0, 1].map((f) => C('foot.' + sd, [0.13, 0.06, (0.24 + f * 0.05) * s], [0.3, 0.042, (0.24 + f * 0.09) * s], 0.05, 0.034, { k: 0.03, col: dk }));
  return {
    cell: o.cell, scale: o.scale,
    bones,
    layers: [
      layer('skin', 'flesh', o.body, 0.05, [
        // tronco curvado para a frente, cintura fina, peito largo
        E('hips', [-0.02, 0.66, 0], [0.15, 0.13, 0.18]),
        E('spine', [0.05, 0.8, 0], [0.13, 0.15, 0.15], { col: lt }),
        ...[1, 2].flatMap((i) => LR((s) => [E('spine', [0.165 - i * 0.012, 0.72 + i * 0.07, 0.048 * s], [0.035, 0.03, 0.04], { col: lt, k: 0.025 })])),
        E('chest', [0.09, 0.98, 0], [0.18, 0.19, 0.24]),
        ...LR((s) => [E('chest', [0.2, 1.0, 0.1 * s], [0.09, 0.085, 0.115], { k: 0.03, col: lt })]),
        // corcunda e trapézio
        E('chest', [-0.03, 1.07, 0], [0.16, 0.14, 0.21]),
        ...LR((s) => [C('chest', [0.04, 1.12, 0.07 * s], [0.13, 1.1, 0.25 * s], 0.085, 0.075)]),
        C('neck', [0.12, 1.08, 0], [0.27, 1.19, 0], 0.1, 0.09),
        // cabeça: crânio em cone, sobrancelha pesada em V, focinho largo, mandíbula
        E('head', h(0.3, 1.27, 0), r([0.17, 0.18, 0.165]), { rot: [0, 0, -0.35] }),
        C('head', h(0.25, 1.38, 0), h(0.16, 1.53, 0), r(0.11), r(0.028)),
        E('head', h(0.42, 1.2, 0), r([0.09, 0.075, 0.135])),
        E('head', h(0.495, 1.245, 0), r([0.04, 0.032, 0.05]), { k: 0.03 * hk }),
        E('head', h(0.47, 1.33, 0), r([0.03, 0.04, 0.03]), { k: 0.03 * hk }),
        ...LR((s) => [
          E('head', h(0.47, 1.31, 0.07 * s), r([0.05, 0.032, 0.085]), { rot: [-0.5 * s, 0, 0], k: 0.022 * hk }),
          E('head', h(0.38, 1.2, 0.13 * s), r([0.07, 0.065, 0.06])),
          E('head', h(0.47, 1.278, 0.072 * s), r([0.045, 0.034, 0.05]), { neg: true, k: 0.014 * hk }),
          S('head', h(0.53, 1.24, 0.02 * s), r(0.013), { neg: true, k: 0.006 }),
          // orelhas pontudas grandes, para fora e para trás
          E('head', h(0.22, 1.33, 0.2 * s), r([0.1, 0.03, 0.1]), { rot: [0.25 * s, -0.55 * s, 0.25], k: 0.03 * hk }),
          C('head', h(0.2, 1.34, 0.22 * s), h(0.04, 1.47, 0.38 * s), r(0.05), r(0.005), { k: 0.035 * hk }),
        ]),
        // boca larga (fenda entre o lábio e a mandíbula)
        E('jaw', h(0.4, 1.1, 0), r([0.11, 0.06, 0.14])),
        E('jaw', h(0.48, 1.08, 0), r([0.045, 0.04, 0.075]), { k: 0.04 * hk }),
        E('head', h(0.47, 1.146, 0), r([0.1, 0.032, 0.165]), { neg: true, k: 0.012 * hk }),
        ...LR((s) => [S('head', h(0.425, 1.162, 0.135 * s), r(0.022), { neg: true, k: 0.012 * hk })]),
        // braços musculosos e mãos enormes
        ...LR((s, sd) => [
          E('upperarm.' + sd, [0.12, 1.07, 0.32 * s], [0.12, 0.11, 0.11], { k: 0.035 }),
          C('upperarm.' + sd, [0.12, 1.05, 0.32 * s], [0.12, 0.8, 0.39 * s], 0.088, 0.066),
          E('upperarm.' + sd, [0.18, 0.94, 0.35 * s], [0.065, 0.085, 0.065], { k: 0.03 }),
          S('forearm.' + sd, [0.12, 0.79, 0.39 * s], 0.062),
          C('forearm.' + sd, [0.12, 0.78, 0.39 * s], [0.24, 0.57, 0.39 * s], 0.07, 0.052),
          E('forearm.' + sd, [0.16, 0.71, 0.4 * s], [0.08, 0.085, 0.075], { k: 0.035 }),
          E('hand.' + sd, [0.28, 0.52, 0.39 * s], [0.075, 0.07, 0.056], { col: dk }),
          ...fingers(sd, s),
          C('hand.' + sd, [0.26, 0.54, 0.35 * s], [0.33, 0.47, 0.33 * s], 0.028, 0.021, { col: dk, k: 0.02 }),
          // pernas: coxa grossa, joelho para a frente, pé grande de três dedos
          C('thigh.' + sd, [0, 0.63, 0.16 * s], [0.17, 0.41, 0.23 * s], 0.13, 0.09),
          E('thigh.' + sd, [0.1, 0.53, 0.21 * s], [0.11, 0.1, 0.1], { k: 0.035 }),
          S('shin.' + sd, [0.17, 0.4, 0.23 * s], 0.082),
          C('shin.' + sd, [0.16, 0.39, 0.23 * s], [0.03, 0.13, 0.24 * s], 0.075, 0.055),
          E('shin.' + sd, [0.06, 0.29, 0.23 * s], [0.075, 0.1, 0.07], { k: 0.035 }),
          E('foot.' + sd, [0.09, 0.065, 0.24 * s], [0.13, 0.065, 0.095], { col: dk }),
          S('foot.' + sd, [-0.02, 0.075, 0.24 * s], 0.062, { col: dk }),
          ...toes(sd, s),
          // braço da asa (ombro → cotovelo → pulso)
          C('wing.' + sd, [W.base[0], W.base[1], W.base[2] * s], [W.elbow[0], W.elbow[1], W.elbow[2] * s], 0.065, 0.045),
          S('wing.' + sd, [W.elbow[0], W.elbow[1], W.elbow[2] * s], 0.048),
          C('wing.' + sd, [W.elbow[0], W.elbow[1], W.elbow[2] * s], [W.wrist[0], W.wrist[1], W.wrist[2] * s], 0.045, 0.032),
          S('wing.' + sd, [W.wrist[0], W.wrist[1], W.wrist[2] * s], 0.033),
        ]),
        // rabinho
        C('tail', [-0.11, 0.62, 0], [-0.3, 0.38, 0], 0.05, 0.03),
        C('tail2', [-0.3, 0.38, 0], [-0.35, 0.2, 0], 0.03, 0.016),
        E('tail2', [-0.36, 0.15, 0], [0.035, 0.05, 0.012], { rot: [0, 0, 0.2] }),
      ], { pattern: compose(mottle(0.1, 6), tone(dk, 0.3)), rough: { amp: 0.0015, freq: 32 } }),
      // boca por dentro
      layer('mouth', 'wet', 0x3a0608, 0.03, [E('head', h(0.43, 1.155, 0), r([0.08, 0.045, 0.12]))], { cavity: 0, cell: 0.022 }),
      // garras e chifrinhos claros
      layer('claws', 'claw', o.claw, 0.01, [
        ...LR((s, sd) => [
          ...[-1, 0, 1].map((f) => C('hand.' + sd, [0.37, 0.345, (0.4 + f * 0.05) * s], [0.34, 0.28, (0.4 + f * 0.053) * s], 0.019, 0.003)),
          C('hand.' + sd, [0.33, 0.47, 0.33 * s], [0.36, 0.42, 0.32 * s], 0.016, 0.003),
          ...[-1, 0, 1].map((f) => C('foot.' + sd, [0.3, 0.048, (0.24 + f * 0.09) * s], [0.38, 0.004, (0.24 + f * 0.1) * s], 0.025, 0.004)),
          C('foot.' + sd, [-0.06, 0.065, 0.24 * s], [-0.12, 0.01, 0.24 * s], 0.02, 0.004),
          C('wing.' + sd, [W.wrist[0], W.wrist[1] + 0.02, W.wrist[2] * s], [W.wrist[0] + 0.04, W.wrist[1] + 0.13, W.wrist[2] * s], 0.026, 0.004),
          C('head', h(0.24, 1.43, 0.07 * s), h(0.12, 1.49, 0.1 * s), r(0.028), r(0.005)),
        ]),
      ], { cell: o.clawCell }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', h(0.452, 1.275, 0.07 * s), r(0.031), { sclera: o.sclera ?? 0xeec25a, iris: o.eye, irisGlow: 1.8, irisSize: 0.8, pupilSize: 0.22, look: [1, 0, 0.25 * s], squash: [0.75, 0.66, 1] })),
      teeth('head', h(0.515, 1.168, 0), r(0.25), 11, r(0.048), r(0.014), { curve: 0.09 * hk, jag: 0.3, wrap: 1.2, fang: true, col: o.teeth ?? 0xf4e6b8 }),
      teeth('jaw', h(0.505, 1.125, 0), r(0.23), 10, r(0.04), r(0.013), { dir: -1, curve: 0.09 * hk, jag: 0.3, wrap: 1.2, fang: true, col: o.teeth ?? 0xf4e6b8 }),
    ],
  };
}

export const arremer = () => gargoyle({ head: 1.15, cell: 0.0148, clawCell: 0.009, body: 0xc4261c, belly: 0xe2563c, dark: 0x8a1610, claw: 0xf2e8d0, eye: 0xffc020 });
// Petite Devil: o mesmo diabinho, menor e de cabeça maior; recolorido para a versão de lava
export const devilSpec = (body, belly, dark, eyeC) => () => gargoyle({ cell: 0.022, clawCell: 0.015, scale: 0.56, head: 1.32, body, belly, dark, claw: 0xf2e8d0, eye: eyeC });
export const devil = devilSpec(0x3456d8, 0x6a86f0, 0x1c2c84, 0xffa020);
export const lavadevil = devilSpec(0xd04a12, 0xf08a2a, 0x7a1e06, 0xfff040);

// ================================================================== SATÃ (Firebrand)
// gárgula dracônica laranja: focinho de réptil, chifres para trás, corpo esguio e musculoso,
// pernas digitígradas com garras, cauda longa, crista de espinhos nas costas e asas enormes
export const FIRE_P = {
  hip: [-0.04, 0.95], spine: [0.03, 1.15], chest: [0.1, 1.4], neck: [0.2, 1.62], head: [0.28, 1.74],
  thigh: [-0.03, 0.93, 0.2], knee: [0.2, 0.58, 0.27], ankle: [-0.06, 0.26, 0.28],
  shoulder: [0.12, 1.6, 0.39], elbow: [0.08, 1.24, 0.5], wrist: [0.22, 0.95, 0.5],
};
export const FIRE_WING = { base: [-0.12, 1.58, 0.17], elbow: [-0.22, 2.0, 0.21], wrist: [-0.32, 2.5, 0.21] };
// barriga em placas mais claras (faixas horizontais na frente)
const plates = (lt) => {
  const L = hex(lt);
  return (x, y, z, c) => {
    if (y < 0.98 || y > 1.56) return c;
    const front = x - (0.12 + (y - 0.98) * 0.12);
    if (front < 0 || Math.abs(z) > 0.15) return c;
    const f = Math.min(1, front * 14) * Math.min(1, (0.15 - Math.abs(z)) * 25);
    const band = 0.9 + 0.1 * Math.abs(Math.sin((y - 0.98) * 46));
    return mixc(c, L.map((v) => v * band), Math.max(0, Math.min(1, f)) * 0.75);
  };
};
export function satan() {
  const body = 0xe8622a, belly = 0xf8b070, dk = 0xa63c14, claw = 0xf2dcb4;
  const W = FIRE_WING;
  // cabeça grande desenhada em torno de hp e levada para P (curvada para a frente)
  const hk = 1.5, hp = [0.2, 1.86], P = [0.27, 1.72];
  const h = (x, y, z) => [P[0] + (x - hp[0]) * hk, P[1] + (y - hp[1]) * hk, z * hk];
  const r = (v) => (Array.isArray(v) ? v.map((q) => q * hk) : v * hk);
  const bones = humanoidBones({
    ...FIRE_P,
    extra: [
      ['wing.$', 'chest', ...W.base],
      ['tail', 'hips', -0.16, 0.92, 0], ['tail2', 'tail', -0.46, 0.6, 0], ['tail3', 'tail2', -0.58, 0.28, -0.03],
      ['jaw', 'head', ...h(0.28, 1.92, 0)],
    ],
  });
  const spikes = [[0.06, 1.74], [-0.07, 1.66], [-0.15, 1.56], [-0.18, 1.44], [-0.16, 1.32], [-0.13, 1.2], [-0.15, 1.07]];
  return {
    cell: 0.0185, scale: 0.9,
    bones,
    layers: [
      layer('skin', 'scales', body, 0.05, [
        // tronco curvado: cintura fina, caixa torácica larga, corcunda
        E('hips', [-0.04, 0.97, 0], [0.17, 0.15, 0.21]),
        E('spine', [0.04, 1.16, 0], [0.15, 0.17, 0.18]),
        ...[0, 1, 2].flatMap((i) => LR((s) => [E('spine', [0.175 - i * 0.008, 1.07 + i * 0.08, 0.05 * s], [0.034, 0.035, 0.045], { k: 0.022 })])),
        E('chest', [0.1, 1.42, 0], [0.2, 0.22, 0.28], { rot: [0, 0, -0.3] }),
        E('chest', [-0.02, 1.52, 0], [0.15, 0.17, 0.24]),
        ...LR((s) => [
          E('chest', [0.22, 1.46, 0.11 * s], [0.09, 0.1, 0.13], { k: 0.03, rot: [0, 0, -0.3] }),
          E('chest', [0.13, 1.3, 0.17 * s], [0.08, 0.1, 0.06], { k: 0.04, rot: [0.3 * s, 0, 0] }),
          C('chest', [0.04, 1.62, 0.06 * s], [0.12, 1.62, 0.33 * s], 0.095, 0.085),
        ]),
        C('neck', [0.1, 1.54, 0], [0.28, 1.74, 0], 0.12, 0.1),
        // cabeça de dragão: crânio, focinho, sobrancelhas, bochechas e mandíbula
        E('head', h(0.24, 2.0, 0), r([0.13, 0.12, 0.115])),
        C('head', h(0.3, 1.99, 0), h(0.52, 1.95, 0), r(0.085), r(0.058)),
        E('head', h(0.42, 1.92, 0), r([0.12, 0.04, 0.078])),
        E('head', h(0.4, 2.02, 0), r([0.12, 0.035, 0.045]), { k: 0.03 }),
        ...LR((s) => [
          E('head', h(0.34, 2.05, 0.06 * s), r([0.07, 0.028, 0.045]), { rot: [-0.5 * s, 0, -0.25], k: 0.02 }),
          S('head', h(0.36, 2.02, 0.072 * s), r(0.032), { neg: true, k: 0.012 }),
          E('head', h(0.26, 1.95, 0.09 * s), r([0.075, 0.06, 0.05]), { k: 0.04 }),
          S('head', h(0.545, 1.97, 0.026 * s), r(0.012), { neg: true, k: 0.006 }),
          // franjas atrás das bochechas
          C('head', h(0.17, 1.97, 0.1 * s), h(0.03, 1.99, 0.17 * s), r(0.04), r(0.006), { k: 0.02 }),
          C('head', h(0.16, 1.91, 0.09 * s), h(0.06, 1.91, 0.15 * s), r(0.03), r(0.005), { k: 0.02 }),
          // base dos chifres
          C('head', h(0.22, 2.08, 0.06 * s), h(0.12, 2.15, 0.1 * s), r(0.045), r(0.034), { k: 0.03 }),
        ]),
        C('head', h(0.3, 2.08, 0), h(0.2, 2.14, 0), r(0.03), r(0.02), { k: 0.03 }),
        C('jaw', h(0.28, 1.9, 0), h(0.5, 1.865, 0), r(0.07), r(0.045)),
        E('jaw', h(0.3, 1.88, 0), r([0.09, 0.05, 0.09]), { k: 0.04 }),
        E('head', h(0.47, 1.895, 0), r([0.11, 0.022, 0.075]), { neg: true, k: 0.012 }),
        // braços grossos, cotovelos para fora, mãos enormes
        ...LR((s, sd) => [
          E('upperarm.' + sd, [0.12, 1.6, 0.39 * s], [0.13, 0.125, 0.115], { k: 0.035 }),
          C('upperarm.' + sd, [0.12, 1.58, 0.39 * s], [0.08, 1.25, 0.5 * s], 0.095, 0.072),
          E('upperarm.' + sd, [0.16, 1.42, 0.43 * s], [0.07, 0.11, 0.07], { k: 0.03 }),
          S('forearm.' + sd, [0.08, 1.24, 0.5 * s], 0.07),
          C('forearm.' + sd, [0.08, 1.23, 0.5 * s], [0.22, 0.96, 0.5 * s], 0.08, 0.056),
          E('forearm.' + sd, [0.12, 1.14, 0.51 * s], [0.075, 0.1, 0.075], { k: 0.03 }),
          E('hand.' + sd, [0.25, 0.9, 0.5 * s], [0.08, 0.085, 0.06]),
          ...[-1, 0, 1].flatMap((f) => [
            C('hand.' + sd, [0.28, 0.85, (0.5 + f * 0.035) * s], [0.34, 0.76, (0.505 + f * 0.055) * s], 0.033, 0.027, { k: 0.018 }),
            C('hand.' + sd, [0.34, 0.76, (0.505 + f * 0.055) * s], [0.34, 0.67, (0.505 + f * 0.058) * s], 0.027, 0.02, { k: 0.014 }),
          ]),
          C('hand.' + sd, [0.24, 0.89, 0.45 * s], [0.31, 0.82, 0.43 * s], 0.03, 0.022, { k: 0.018 }),
          // pernas digitígradas grossas: coxa, joelho para a frente, canela para trás, calcanhar alto
          C('thigh.' + sd, [-0.03, 0.93, 0.2 * s], [0.2, 0.59, 0.27 * s], 0.16, 0.105),
          E('thigh.' + sd, [0.1, 0.78, 0.25 * s], [0.13, 0.16, 0.12], { k: 0.035, rot: [0, 0, -0.6] }),
          S('shin.' + sd, [0.2, 0.58, 0.27 * s], 0.088),
          C('shin.' + sd, [0.19, 0.57, 0.27 * s], [-0.06, 0.27, 0.28 * s], 0.08, 0.058),
          E('shin.' + sd, [0.08, 0.46, 0.27 * s], [0.07, 0.12, 0.072], { k: 0.03, rot: [0, 0, 0.8] }),
          S('foot.' + sd, [-0.06, 0.26, 0.28 * s], 0.06),
          C('foot.' + sd, [-0.06, 0.26, 0.28 * s], [0.08, 0.07, 0.28 * s], 0.058, 0.055),
          E('foot.' + sd, [0.1, 0.055, 0.28 * s], [0.1, 0.055, 0.095]),
          ...[-1, 0, 1].map((f) => C('foot.' + sd, [0.12, 0.05, (0.28 + f * 0.045) * s], [0.28, 0.036, (0.28 + f * 0.085) * s], 0.048, 0.034, { k: 0.025 })),
          // braço da asa
          C('wing.' + sd, [W.base[0], W.base[1], W.base[2] * s], [W.elbow[0], W.elbow[1], W.elbow[2] * s], 0.08, 0.055),
          S('wing.' + sd, [W.elbow[0], W.elbow[1], W.elbow[2] * s], 0.058),
          C('wing.' + sd, [W.elbow[0], W.elbow[1], W.elbow[2] * s], [W.wrist[0], W.wrist[1], W.wrist[2] * s], 0.054, 0.038),
          S('wing.' + sd, [W.wrist[0], W.wrist[1], W.wrist[2] * s], 0.042),
        ]),
        // cauda longa enrolando no chão
        C('tail', [-0.13, 0.94, 0], [-0.46, 0.6, 0], 0.1, 0.07),
        C('tail2', [-0.46, 0.6, 0], [-0.58, 0.28, -0.03], 0.07, 0.05),
        C('tail3', [-0.58, 0.28, -0.03], [-0.46, 0.07, -0.1], 0.05, 0.035),
        C('tail3', [-0.46, 0.07, -0.1], [-0.2, 0.035, -0.22], 0.035, 0.013),
        // crista de espinhos nas costas e na cauda
        ...spikes.map(([x, y], i) => C(i < 1 ? 'neck' : i < 4 ? 'chest' : 'spine', [x + 0.03, y - 0.02, 0], [x - 0.06, y + 0.07, 0], 0.03, 0.004, { k: 0.015, col: 0xc84c1c })),
        ...[0.25, 0.5, 0.75].map((t) => C('tail', [-0.13 - 0.33 * t + 0.03, 0.94 - 0.34 * t + 0.05, 0], [-0.13 - 0.33 * t - 0.05, 0.94 - 0.34 * t + 0.08, 0], 0.03, 0.004, { k: 0.015, col: dk })),
      ], { pattern: compose(mottle(0.08, 7), plates(belly), tone(dk, 0.35)), rough: { amp: 0.002, freq: 34 } }),
      layer('mouth', 'wet', 0x3a0806, 0.03, [E('head', h(0.42, 1.9, 0), r([0.1, 0.03, 0.06]))], { cavity: 0, cell: 0.025 }),
      // chifres para trás, garras e esporas das asas claras
      layer('claws', 'horn', claw, 0.01, [
        ...LR((s, sd) => [
          C('head', h(0.12, 2.15, 0.1 * s), h(-0.02, 2.2, 0.125 * s), r(0.034), r(0.022)),
          C('head', h(-0.02, 2.2, 0.125 * s), h(-0.15, 2.28, 0.12 * s), r(0.022), r(0.004)),
          C('head', h(0.2, 2.06, 0.1 * s), h(0.07, 2.08, 0.17 * s), r(0.026), r(0.004)),
          ...[-1, 0, 1].map((f) => C('hand.' + sd, [0.34, 0.675, (0.505 + f * 0.058) * s], [0.31, 0.6, (0.505 + f * 0.06) * s], 0.021, 0.003)),
          C('hand.' + sd, [0.31, 0.82, 0.43 * s], [0.35, 0.77, 0.42 * s], 0.019, 0.003),
          ...[-1, 0, 1].map((f) => C('foot.' + sd, [0.28, 0.04, (0.28 + f * 0.085) * s], [0.37, 0.004, (0.28 + f * 0.095) * s], 0.028, 0.004)),
          C('foot.' + sd, [-0.04, 0.23, 0.28 * s], [-0.12, 0.19, 0.28 * s], 0.02, 0.003),
          C('wing.' + sd, [W.wrist[0], W.wrist[1] + 0.02, W.wrist[2] * s], [W.wrist[0] + 0.03, W.wrist[1] + 0.09, W.wrist[2] * s], 0.03, 0.02),
          C('wing.' + sd, [W.wrist[0] + 0.03, W.wrist[1] + 0.09, W.wrist[2] * s], [W.wrist[0] + 0.1, W.wrist[1] + 0.16, W.wrist[2] * s], 0.02, 0.003),
        ]),
        C('head', h(0.2, 2.14, 0), h(0.1, 2.22, 0), r(0.022), r(0.004)),
      ], { cell: 0.011 }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', h(0.365, 2.02, 0.07 * s), r(0.026), { sclera: 0xfff4c0, iris: 0xffc010, irisGlow: 1.8, irisSize: 0.7, pupilSize: 0.25, look: [1, 0, 0.3 * s], squash: [0.85, 0.75, 1] })),
      teeth('head', h(0.53, 1.91, 0), r(0.13), 8, r(0.04), r(0.012), { curve: 0.12 * hk, jag: 0.35, wrap: 1.4, fang: true, col: 0xf6eedc }),
      teeth('jaw', h(0.52, 1.882, 0), r(0.12), 7, r(0.032), r(0.011), { dir: -1, curve: 0.12 * hk, jag: 0.35, wrap: 1.4, fang: true, col: 0xf6eedc }),
    ],
  };
}

// ================================================================== MAGO (a Morte)
// manto roxo com capuz pontudo e barra esfarrapada, caveira no fundo do capuz com olhos vermelhos,
// mãos de osso, foice na mão esquerda; asinhas de membrana cinza saem das costas
export const MAGE_P = {
  hip: [0, 0.9], spine: [0, 1.05], chest: [0.02, 1.24], neck: [0.04, 1.4], head: [0.06, 1.48],
  thigh: [0, 0.88, 0.1], knee: [0.02, 0.48, 0.11], ankle: [0, 0.08, 0.11],
  shoulder: [0.02, 1.34, 0.21], elbow: [0.07, 1.1, 0.29], wrist: [0.17, 0.93, 0.32],
};
// interior do capuz escuro (sombra funda em volta da caveira)
const hoodShade = (x, y, z, c) => {
  const d = Math.hypot((x - 0.2) / 0.16, (y - 1.53) / 0.19, z / 0.15);
  return d < 1 ? mixc(c, hex(0x0a0614), Math.min(1, (1 - d) * 3)) : c;
};
// dobras: listras verticais claras/escuras no tecido
const folds = (x, y, z, c) => {
  const a = Math.atan2(z, x);
  const k = 0.88 + 0.12 * Math.sin(a * 10 + Math.sin(y * 3) * 0.6) + (y > 1.2 ? 0.05 : 0);
  return c.map((v) => v * k);
};
export function magician() {
  const robe = 0x5a2ea6, bone = 0xe8e0c8;
  const sleeve = (s, sd) => [
    C('upperarm.' + sd, [0.02, 1.34, 0.2 * s], [0.07, 1.1, 0.29 * s], 0.085, 0.09),
    C('forearm.' + sd, [0.07, 1.1, 0.29 * s], [0.17, 0.95, 0.33 * s], 0.09, 0.13),
    E('forearm.' + sd, [0.1, 0.92, 0.32 * s], [0.1, 0.16, 0.08], { k: 0.06 }),
    S('forearm.' + sd, [0.2, 0.95, 0.335 * s], 0.09, { neg: true, k: 0.03 }),
  ];
  const hand = (s, sd, curl) => [
    E('hand.' + sd, [0.2, 0.9, 0.33 * s], [0.035, 0.04, 0.022]),
    ...[-1, 0, 1, 2].flatMap((f) => {
      const z0 = (0.33 + f * 0.016 - 0.008) * s;
      const p1 = [0.23, 0.86 - Math.abs(f - 0.5) * 0.006, z0], p2 = curl ? [0.26, 0.84, z0] : [0.27, 0.8, z0 * 1.04], p3 = curl ? [0.25, 0.8, z0] : [0.3, 0.75, z0 * 1.08];
      return [S('hand.' + sd, p1, 0.011), C('hand.' + sd, p1, p2, 0.008, 0.007), S('hand.' + sd, p2, 0.009), C('hand.' + sd, p2, p3, 0.007, 0.005)];
    }),
    C('hand.' + sd, [0.19, 0.9, 0.31 * s], [0.23, 0.86, 0.29 * s], 0.009, 0.007),
    C('forearm.' + sd, [0.12, 0.98, 0.31 * s], [0.19, 0.92, 0.33 * s], 0.012, 0.011),
  ];
  const foldsP = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    foldsP.push(C('hips', [Math.cos(a) * 0.11, 1.12, Math.sin(a) * 0.14], [Math.cos(a) * 0.38, 0.02, Math.sin(a) * 0.4], 0.035, 0.075, { k: 0.06 }));
  }
  return {
    cell: 0.0135,
    bones: humanoidBones({ ...MAGE_P, extra: [['wing.$', 'chest', -0.14, 1.3, 0.12]] }),
    layers: [
      layer('robe', 'cloth', robe, 0.05, [
        // corpo do manto em sino, com dobras
        C('hips', [0, 0.06, 0], [0.02, 1.18, 0], 0.4, 0.15),
        ...foldsP,
        E('chest', [0.02, 1.24, 0], [0.15, 0.15, 0.2]),
        ...LR((s) => [E('chest', [0.0, 1.32, 0.15 * s], [0.1, 0.08, 0.11])]),
        // capuz pontudo caído para trás, com abertura funda
        E('neck', [0.0, 1.38, 0], [0.2, 0.1, 0.24]),
        E('head', [0.05, 1.54, 0], [0.19, 0.21, 0.18]),
        C('head', [-0.03, 1.66, 0], [-0.17, 1.8, 0], 0.11, 0.02),
        E('head', [0.2, 1.52, 0], [0.12, 0.16, 0.12], { neg: true, k: 0.03 }),
        ...LR((s, sd) => sleeve(s, sd)),
      ], { cuts: [hemCut(0.0, { amp: 0.15, teeth: 13, seed: 3, noise: 0.008, jit: 0.12 })], pattern: compose(mottle(0.12, 9), folds, hoodShade), rough: { amp: 0.002, freq: 26 }, cell: 0.0165, keep: 0.34 }),
      // caveira e mãos de osso
      layer('bone', 'bone', bone, 0.02, [
        E('head', [0.09, 1.54, 0], [0.095, 0.1, 0.085]),
        E('head', [0.14, 1.47, 0], [0.055, 0.045, 0.06]),
        ...LR((s) => [
          S('head', [0.175, 1.53, 0.036 * s], 0.026, { neg: true, k: 0.01 }),
          E('head', [0.15, 1.49, 0.055 * s], [0.03, 0.02, 0.025], { k: 0.015 }),
        ]),
        E('head', [0.195, 1.495, 0], [0.012, 0.018, 0.01], { neg: true, k: 0.006 }),
        E('head', [0.17, 1.44, 0], [0.04, 0.02, 0.045]),
        ...hand(1, 'R', false),
        ...hand(-1, 'L', true),
      ], { cavity: 1.6, cell: 0.008, pattern: (x, y, z, c) => mixc(c, hex(0xa89c80), Math.max(0, fbm3(x * 16, y * 16, z * 16, 2) - 0.5) * 1.2) }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.168, 1.53, 0.036 * s], 0.014, { glow: 0xff2010, ei: 3.2 })),
      teeth('head', [0.19, 1.462, 0], 0.06, 7, 0.016, 0.007, { curve: 0.03, jag: 0.1, col: 0xf0e8d2 }),
      obj('scythe', 'hips', [0.35, 0.06, -0.345], { rot: [0, Math.PI, 0], scale: 0.88, name: 'scythe' }),
      obj('orb', 'hand.R', [0.29, 0.86, 0.34], { r: 0.06, col: 0xd040ff, name: 'orb' }),
    ],
  };
}

export const SPECIES = { arremer, devil, lavadevil, satan, magician };
