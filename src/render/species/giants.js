// Gigantes: Ciclope (o "Unicórnio" do jogo), Big Man (ogro do mangual), Astaroth (Behemoth com
// a cara na barriga) e o Dragão (cabeça + segmentos do corpo).
import { C, E, S, Bx, T, LR, chain, layer, humanoidBones, eye, teeth, horn, obj, mottle, compose, hex, mixc } from './kit.js';
import { fbm3 } from '../organic.js';

// cor por região: escurece o interior de uma boca (elipsoide em repouso) para vermelho escuro
const mouthTint = (c0, r, col, k = 1.25) => {
  const m = hex(col);
  return (x, y, z, c) => {
    const q = ((x - c0[0]) / r[0]) ** 2 + ((y - c0[1]) / r[1]) ** 2 + ((z - c0[2]) / r[2]) ** 2;
    return q < k ? mixc(c, m, Math.min(1, (k - q) * 4)) : c;
  };
};
// bainha rasgada (versão local do hemCut: dente simétrico para ângulos negativos e altura
// constante perto do eixo, para não criar superfícies internas em "cata-vento")
function hem(y0, o = {}) {
  const { amp = 0.06, teeth = 12, seed = 1, noise = 0.012, ax = 0.3, az = 0.42, cx = 0 } = o;
  return (x, y, z) => {
    const a = Math.atan2(z, x - cx);
    const u = (a / (Math.PI * 2)) * teeth + seed * 0.37;
    const saw = Math.abs(u - Math.floor(u) - 0.5) * 2;
    const r = Math.hypot((x - cx) / ax, z / az);
    const w = Math.min(1, Math.max(0, (r - 0.45) / 0.35));
    const yy = y0 + w * (amp * saw + noise * (fbm3(x * 9 + seed, 0, z * 9, 2) - 0.5) * 2);
    return yy - y;
  };
}
// corte horizontal plano: remove o que está acima de y0
const above = (y0) => (x, y) => y - y0;
// tecido grosseiro: fibras verticais + manchas
const weave = (x, y, z, c) => {
  const n = fbm3(x * 40, y * 7, z * 40, 2);
  const k = 0.82 + n * 0.36;
  return c.map((v) => v * k);
};

// ================================================================== BRUTAMONTES (ciclope / ogro)
// Escultura em ~1.9 de altura; o 'scale' da espécie leva ao tamanho do hitbox.
const BRUTE_P = {
  hip: [0, 0.72], spine: [0, 0.9], chest: [0, 1.12], neck: [0.06, 1.42], head: [0.14, 1.5],
  thigh: [0, 0.66, 0.22], knee: [0.04, 0.41, 0.29], ankle: [0, 0.12, 0.31],
  shoulder: [0, 1.42, 0.55], elbow: [0.02, 1.08, 0.66], wrist: [0.06, 0.77, 0.7],
  extra: [['jaw', 'head', 0.16, 1.5, 0]],
};

function bruteBody(darkCol, nailCol) {
  return [
    // tronco: caixa torácica enorme, dorsais largas, peitorais, abdômen em gomos
    E('chest', [-0.03, 1.19, 0], [0.29, 0.3, 0.48]),
    E('spine', [0.05, 0.96, 0], [0.25, 0.22, 0.33]),
    E('hips', [0, 0.77, 0], [0.24, 0.16, 0.34]),
    ...LR((s) => [
      E('chest', [0.16, 1.25, 0.18 * s], [0.155, 0.135, 0.19], { rot: [0.2 * s, 0, -0.15], k: 0.045 }),
      E('chest', [-0.08, 1.12, 0.3 * s], [0.18, 0.28, 0.19], { k: 0.06 }),
      // omoplatas e lombar
      E('chest', [-0.22, 1.3, 0.17 * s], [0.09, 0.13, 0.13], { rot: [0, 0, 0.2], k: 0.05 }),
      E('spine', [-0.18, 0.96, 0.075 * s], [0.08, 0.15, 0.065], { k: 0.04 }),
      E('hips', [-0.12, 0.7, 0.15 * s], [0.13, 0.14, 0.15], { k: 0.05 }),
      // trapézio subindo até a cabeça
      C('chest', [0.0, 1.58, 0.06 * s], [-0.03, 1.45, 0.4 * s], 0.15, 0.12, { k: 0.08 }),
      // gomos do abdômen e oblíquos
      ...[0, 1, 2].map((r) => E('spine', [0.255 - r * 0.012, 1.06 - r * 0.085, 0.072 * s], [0.055, 0.042, 0.066], { k: 0.035 })),
      E('spine', [0.13, 0.94, 0.25 * s], [0.12, 0.14, 0.1], { k: 0.05 }),
    ]),
    // sulco da coluna
    C('chest', [-0.325, 1.36, 0], [-0.27, 0.9, 0], 0.022, 0.018, { neg: true, k: 0.05 }),
    // pescoço curto e grosso
    C('neck', [0.02, 1.36, 0], [0.12, 1.52, 0], 0.15, 0.14),
    // ---------------------------------------------------------- braços enormes
    ...LR((s, sd) => [
      E('upperarm.' + sd, [0, 1.37, 0.585 * s], [0.19, 0.18, 0.18], { k: 0.07 }),
      C('upperarm.' + sd, [0, 1.42, 0.57 * s], [0.02, 1.1, 0.65 * s], 0.14, 0.115),
      E('upperarm.' + sd, [0.08, 1.25, 0.625 * s], [0.1, 0.14, 0.1], { k: 0.05 }),
      E('upperarm.' + sd, [-0.07, 1.27, 0.615 * s], [0.095, 0.15, 0.1], { k: 0.05 }),
      S('forearm.' + sd, [0.0, 1.08, 0.65 * s], 0.11),
      C('forearm.' + sd, [0.01, 1.07, 0.65 * s], [0.06, 0.79, 0.68 * s], 0.135, 0.1),
      E('forearm.' + sd, [0.04, 1.0, 0.67 * s], [0.13, 0.13, 0.13], { k: 0.05 }),
      // punho fechado: dorso para fora, nós dos dedos embaixo, dedos dobrados para dentro, polegar na frente
      Bx('hand.' + sd, [0.065, 0.66, 0.69 * s], [0.115, 0.1, 0.08], 0.065, { col: darkCol }),
      ...[0, 1, 2, 3].map((f) => C('hand.' + sd, [-0.02 + f * 0.056, 0.585, 0.715 * s], [-0.015 + f * 0.056, 0.565, 0.63 * s], 0.036, 0.032, { k: 0.02, col: darkCol })),
      ...[0, 1, 2, 3].map((f) => S('hand.' + sd, [-0.02 + f * 0.056, 0.6, 0.725 * s], 0.034, { k: 0.025, col: darkCol })),
      C('hand.' + sd, [0.12, 0.7, 0.65 * s], [0.175, 0.62, 0.65 * s], 0.045, 0.036, { k: 0.03, col: darkCol }),
      // ---------------------------------------------------------- pernas curtas e grossas
      C('thigh.' + sd, [0, 0.68, 0.22 * s], [0.04, 0.42, 0.29 * s], 0.17, 0.13),
      E('thigh.' + sd, [0.07, 0.55, 0.26 * s], [0.12, 0.15, 0.13], { k: 0.05 }),
      S('shin.' + sd, [0.06, 0.41, 0.29 * s], 0.115),
      E('shin.' + sd, [0.12, 0.4, 0.29 * s], [0.04, 0.06, 0.07], { k: 0.03 }),
      C('shin.' + sd, [0.04, 0.4, 0.29 * s], [0, 0.14, 0.31 * s], 0.12, 0.09),
      E('shin.' + sd, [-0.045, 0.3, 0.3 * s], [0.1, 0.13, 0.105], { k: 0.05 }),
      // pé largo de dedos gordos
      E('foot.' + sd, [0.08, 0.065, 0.32 * s], [0.19, 0.07, 0.135], { col: darkCol }),
      S('foot.' + sd, [-0.06, 0.08, 0.31 * s], 0.09, { col: darkCol }),
      ...[0, 1, 2, 3, 4].map((t) => {
        const tz = (0.32 + (t - 1.6) * 0.048) * s, tx = 0.245 - Math.abs(t - 1) * 0.018, tr = t === 0 ? 0.048 : 0.038 - t * 0.002;
        return S('foot.' + sd, [tx, 0.042, tz], tr, { k: 0.02, col: darkCol });
      }),
      ...[0, 1, 2, 3, 4].map((t) => {
        const tz = (0.32 + (t - 1.6) * 0.048) * s, tx = 0.245 - Math.abs(t - 1) * 0.018, tr = t === 0 ? 0.048 : 0.038 - t * 0.002;
        return E('foot.' + sd, [tx + tr * 0.62, 0.05 + tr * 0.3, tz], [tr * 0.45, tr * 0.38, tr * 0.62], { k: 0.008, col: nailCol });
      }),
    ]),
  ];
}

// cabeça do brutamontes: eyes = 1 (ciclope) ou 2 (ogro)
function bruteHead(eyes) {
  const prims = [
    E('head', [0.12, 1.7, 0], [0.225, 0.23, 0.215]),
    E('head', [0.2, 1.54, 0], [0.185, 0.155, 0.2]),
    ...LR((s) => [E('head', [0.27, 1.585, 0.115 * s], [0.085, 0.07, 0.075], { k: 0.04 })]),
    // queixo e mandíbula (osso 'jaw')
    E('jaw', [0.2, 1.43, 0], [0.165, 0.085, 0.165]),
    E('jaw', [0.3, 1.41, 0], [0.075, 0.06, 0.11], { k: 0.04 }),
    // nariz achatado e narinas
    E('head', [0.37, 1.615, 0], [0.045, 0.04, 0.065], { k: 0.03 }),
    ...LR((s) => [S('head', [0.405, 1.6, 0.03 * s], 0.017, { neg: true, k: 0.01 })]),
    // boca escancarada
    E('head', [0.375, 1.49, 0], [0.095, 0.052, 0.135], { neg: true, k: 0.02 }),
    // orelhas pontudas
    ...LR((s) => [
      E('head', [0.06, 1.68, 0.195 * s], [0.05, 0.07, 0.03], { rot: [0.3 * s, 0, 0], k: 0.03 }),
      C('head', [0.05, 1.7, 0.21 * s], [-0.03, 1.81, 0.3 * s], 0.045, 0.012, { k: 0.02 }),
    ]),
  ];
  if (eyes === 1) {
    // um olho grande no meio da testa, com pálpebras e sobrancelha pesada
    prims.push(
      S('head', [0.36, 1.725, 0], 0.074, { neg: true, k: 0.018 }),
      T('head', [0.335, 1.725, 0], 0.074, 0.026, { rot: [0, 0, Math.PI / 2 + 0.15], k: 0.03 }),
      E('head', [0.31, 1.815, 0], [0.075, 0.04, 0.12], { rot: [0, 0, -0.25], k: 0.04 }),
      ...LR((s) => [C('head', [0.33, 1.8, 0.06 * s], [0.24, 1.83, 0.17 * s], 0.035, 0.025, { k: 0.04 })]),
    );
  } else {
    // dois olhos fundos sob a testa saliente, nariz largo
    prims.push(
      ...LR((s) => [
        S('head', [0.35, 1.71, 0.075 * s], 0.047, { neg: true, k: 0.014 }),
        C('head', [0.36, 1.77, 0.015 * s], [0.3, 1.78, 0.16 * s], 0.042, 0.032, { k: 0.04 }),
        E('head', [0.375, 1.625, 0.045 * s], [0.035, 0.03, 0.035], { k: 0.03 }),
      ]),
      E('head', [0.39, 1.655, 0], [0.04, 0.055, 0.045], { k: 0.03 }),
    );
  }
  return prims;
}

function brute(o) {
  const skin = o.skin, dark = o.dark, nail = 0xf0dcc0;
  const mouthC = [0.375, 1.49, 0], mouthR = [0.095, 0.052, 0.135];
  const rigid = [
    teeth('head', [0.385, 1.53, 0], 0.2, 7, 0.05, 0.023, { curve: 0.06, jag: 0.2, wrap: 0.8, fang: true }),
    teeth('jaw', [0.37, 1.452, 0], 0.18, 6, 0.042, 0.022, { dir: -1, curve: 0.06, jag: 0.2, wrap: 0.8, fang: true }),
  ];
  if (o.eyes === 1) rigid.push(eye('head', [0.355, 1.725, 0], 0.07, { iris: 0xd84a10, irisGlow: 0.5, irisSize: 0.62, pupilSize: 0.26, look: [1, 0, 0], name: 'eye' }));
  else rigid.push(...[1, -1].map((s) => eye('head', [0.35, 1.71, 0.075 * s], 0.044, { iris: 0xd84a10, irisGlow: 0.5, irisSize: 0.66, pupilSize: 0.26, look: [1, -0.05, 0.15 * s] })));
  return {
    cell: o.cell,
    scale: o.scale,
    bones: humanoidBones(BRUTE_P),
    layers: [
      layer('skin', 'skin', skin, 0.06, [...bruteBody(dark, nail), ...bruteHead(o.eyes), ...(o.extra || [])], {
        pattern: compose(mottle(0.07, 6), mouthTint(mouthC, mouthR, 0x5a1010, 1.6)),
        rough: { amp: 0.0015, freq: 30 }, keep: o.keep ?? 0.3,
      }),
      // tanga vermelha esfarrapada (acompanha as coxas) com cós enrolado
      layer('cloth', 'cloth', o.cloth, 0.05, [
        E('hips', [0, 0.77, 0], [0.275, 0.17, 0.39]),
        E('hips', [-0.01, 0.65, 0], [0.29, 0.12, 0.41]),
        ...LR((s, sd) => [
          E('hips', [-0.11, 0.7, 0.15 * s], [0.16, 0.16, 0.18]),
          C('thigh.' + sd, [0.0, 0.66, 0.22 * s], [0.03, 0.52, 0.27 * s], 0.2, 0.19),
        ]),
        Bx('hips', [0.18, 0.6, 0], [0.06, 0.12, 0.2], 0.05),
        Bx('hips', [-0.19, 0.6, 0], [0.06, 0.12, 0.2], 0.05),
        E('hips', [0.02, 0.86, 0], [0.305, 0.05, 0.415], { col: o.belt, k: 0.015 }),
      ], {
        cuts: [hem(0.5, { amp: 0.09, teeth: 15, seed: 3 }), above(0.9)],
        pattern: compose(weave, mottle(0.18, 14), (x, y, z, c) => (y < 0.58 ? c.map((v) => v * 0.85) : c)),
        rough: { amp: 0.003, freq: 34 }, keep: o.keep ?? 0.3,
      }),
      // braceletes de couro preto
      layer('bracer', 'leather', 0x26262c, 0.02, LR((s, sd) => [
        C('forearm.' + sd, [0.03, 1.0, 0.675 * s], [0.06, 0.72, 0.705 * s], 0.136, 0.126),
      ]), {
        cuts: [(x, y) => 0.775 - y, above(0.948)],
        pattern: mottle(0.12, 12), cavity: 1.3, keep: 0.3,
      }),
      // rebites de latão nos braceletes + argola da tanga
      layer('studs', 'gold', 0xc89a48, 0.004, [
        ...LR((s, sd) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          return S('forearm.' + sd, [0.045 + Math.cos(a) * 0.134, 0.862, 0.69 * s + Math.sin(a) * 0.134], 0.024);
        })),
        T('hips', [0.315, 0.84, 0], 0.045, 0.013, { rot: [0, 0, Math.PI / 2] }),
      ], { cell: 0.009, cavity: 0.6, keep: 0.3 }),
      ...(o.layers || []),
    ],
    rigid: [...rigid, ...(o.rigid || [])],
  };
}

export function unicorn() {
  const hornCol = 0xe0ad6a;
  return brute({
    skin: 0xd8864a, dark: 0xc4733a, cloth: 0x9c2228, belt: 0x861c22, eyes: 1, cell: 0.015, scale: 1.5,
    // chifre único na testa (esculpido junto da pele)
    extra: [
      C('head', [0.2, 1.84, 0], [0.24, 1.97, 0], 0.075, 0.055, { col: hornCol, k: 0.025 }),
      C('head', [0.24, 1.97, 0], [0.24, 2.07, 0], 0.055, 0.03, { col: hornCol, k: 0.01 }),
      C('head', [0.24, 2.07, 0], [0.2, 2.15, 0], 0.03, 0.006, { col: hornCol, k: 0.01 }),
    ],
  });
}

export function bigman() {
  const hair = 0x3a2416;
  return brute({
    skin: 0xc88a58, dark: 0xb47a4a, cloth: 0xa22424, belt: 0x6a3a1c, eyes: 2, cell: 0.0205, scale: 1.43, keep: 0.26,
    layers: [
      // coque no alto da cabeça e sobrancelhas grossas
      layer('hair', 'hair', hair, 0.03, [
        E('head', [0.0, 1.915, 0], [0.08, 0.055, 0.075]),
        S('head', [-0.05, 1.95, 0], 0.05),
        C('head', [-0.09, 1.94, 0], [-0.17, 1.82, 0], 0.045, 0.04),
        C('head', [-0.17, 1.82, 0], [-0.2, 1.62, 0], 0.04, 0.012),
        ...LR((s) => [C('head', [0.385, 1.775, 0.015 * s], [0.33, 1.79, 0.16 * s], 0.022, 0.016, { k: 0.02 })]),
      ], { rough: { amp: 0.004, freq: 40 }, pattern: mottle(0.2, 30), keep: 0.4 }),
    ],
    rigid: [
      ...[1, -1].map((s) => horn('head', [0.16, 1.87, 0.12 * s], [0.25, 1, 0.45 * s], 0.08, 0.034, { bend: [-0.02, 0, 0], col: 0xe8d8b0 })),
      // presas saindo da mandíbula
      ...[1, -1].map((s) => horn('jaw', [0.37, 1.45, 0.095 * s], [0.25, 1, 0.12 * s], 0.075, 0.019, { bend: [-0.02, 0, 0], col: 0xf0e6cc, tip: 0.15 })),
      obj('flail', 'hand.R', [0.08, 0.62, 0.72], { name: 'flail', scale: 0.75 }),
    ],
  });
}

// ================================================================== ASTAROTH (Behemoth)
// Demônio lilás curvado, chifres creme, casco escuro nas costas com cravos de bronze e espinhos,
// e a segunda cara na barriga (olhos acesos + bocarra com presas, osso 'bellyjaw').
// Escultura em ~2.2 de altura; scale 2 → hitbox de 70 px.
const AST_P = {
  hip: [0, 0.62], spine: [0.02, 0.85], chest: [0.02, 1.2], neck: [0.12, 1.5], head: [0.24, 1.66],
  thigh: [0, 0.58, 0.27], knee: [0.1, 0.34, 0.34], ankle: [0, 0.11, 0.35],
  shoulder: [0, 1.45, 0.6], elbow: [0.06, 1.06, 0.74], wrist: [0.15, 0.7, 0.77],
  extra: [['jaw', 'head', 0.3, 1.64, 0], ['bellyjaw', 'spine', 0.22, 0.74, 0]],
};
// superfície do casco (elipsoide) para assentar cravos e espinhos
const SHELL = { c: [-0.2, 1.36, 0], r: [0.34, 0.52, 0.62] };
// pontos em volta de uma boca elíptica, seguindo a curva da barriga (a0..a1: 0..π em cima)
const lipPts = (c, r, a0, a1, n) => Array.from({ length: n }, (_, i) => {
  const a = a0 + (a1 - a0) * (i / (n - 1));
  const z = Math.cos(a) * r[2] * 1.05, y = c[1] + Math.sin(a) * r[1] * 1.15;
  return [c[0] - 0.02 - (z * z) * 0.9, y, z];
});
const shellPt = (y, z, out = 0) => {
  const q = 1 - ((y - SHELL.c[1]) / SHELL.r[1]) ** 2 - ((z - SHELL.c[2]) / SHELL.r[2]) ** 2;
  return [SHELL.c[0] - SHELL.r[0] * Math.sqrt(Math.max(0, q)) - out, y, z];
};
// escamas: sulcos escuros numa grade deslocada
const scaly = (f, amt) => (x, y, z, c) => {
  const u = y * f, v = (Math.atan2(z, -x - 0.1) * 1.3) * f * 0.6 + (Math.floor(u) % 2) * 0.5;
  const du = Math.abs(u - Math.round(u)), dv = Math.abs(v - Math.round(v));
  const e = Math.min(du * 2.2, dv * 1.4);
  return e < 0.22 ? c.map((w) => w * (1 - amt * (1 - e / 0.22))) : c;
};

export function astaroth() {
  const skin = 0x8a78d8, dk = 0x7262c2, shell = 0x3c3656, cream = 0xeee0bc, bronze = 0xc08a3c;
  const headMouthC = [0.55, 1.6, 0], headMouthR = [0.13, 0.085, 0.22];
  const bellyMouthC = [0.49, 0.74, 0], bellyMouthR = [0.11, 0.09, 0.27];
  // dedos com garras (mãos e pés)
  const fingers = (sd, s) => [0, 1, 2, 3].map((f) => {
    const z = (0.77 + (f - 1.5) * 0.065) * s, th = f === 0;
    const a = th ? [0.22, 0.62, (0.77 - 0.11) * s] : [0.25, 0.53, z];
    const b = th ? [0.32, 0.56, (0.77 - 0.12) * s] : [0.32, 0.43, z * 1.01];
    const c = th ? [0.37, 0.5, (0.77 - 0.11) * s] : [0.33, 0.35, z * 1.01];
    return { a, b, c };
  });
  const toes = (s) => [0, 1, 2, 3].map((t) => [0.31 - Math.abs(t - 1.5) * 0.025, 0.05, (0.35 + (t - 1.5) * 0.075) * s]);
  return {
    cell: 0.02,
    scale: 2,
    bones: humanoidBones(AST_P),
    layers: [
      layer('skin', 'skin', skin, 0.08, [
        // tronco: barriga enorme (com a segunda cara), peito, corcunda
        E('spine', [0.08, 0.86, 0], [0.42, 0.4, 0.48]),
        E('chest', [0.03, 1.26, 0], [0.38, 0.31, 0.54]),
        E('chest', [-0.12, 1.38, 0], [0.32, 0.3, 0.46]),
        E('hips', [0, 0.6, 0], [0.32, 0.2, 0.42]),
        ...LR((s) => [
          E('chest', [0.22, 1.31, 0.2 * s], [0.17, 0.14, 0.22], { rot: [0.2 * s, 0, -0.2], k: 0.06 }),
          E('spine', [0.12, 0.88, 0.36 * s], [0.2, 0.26, 0.14], { k: 0.07 }),
          E('hips', [-0.14, 0.56, 0.18 * s], [0.18, 0.18, 0.18], { k: 0.06 }),
        ]),
        // pescoço/trapézio grosso empurrando a cabeça para a frente
        C('neck', [0.0, 1.45, 0], [0.26, 1.66, 0], 0.27, 0.22),
        ...LR((s) => [C('chest', [0.02, 1.58, 0.08 * s], [0.0, 1.52, 0.45 * s], 0.17, 0.14, { k: 0.1 })]),
        // ---- cara da barriga: sobrancelhas, olhos fundos, bocarra
        ...LR((s) => [
          S('spine', [0.465, 1.04, 0.17 * s], 0.066, { neg: true, k: 0.02 }),
          // sobrancelhas arqueadas e bochechas
          ...chain('spine', [[0.535, 1.08, 0.03 * s], [0.5, 1.13, 0.13 * s], [0.44, 1.12, 0.25 * s], [0.38, 1.07, 0.32 * s]], [0.03, 0.045, 0.04, 0.025], { k: 0.04 }),
          E('spine', [0.42, 0.86, 0.27 * s], [0.08, 0.09, 0.07], { k: 0.06 }),
        ]),
        E('spine', [0.53, 0.93, 0], [0.05, 0.06, 0.06], { k: 0.05 }),
        // lábios em volta da bocarra (o de baixo vai com 'bellyjaw')
        ...chain('spine', lipPts(bellyMouthC, bellyMouthR, 0, Math.PI, 9), Array(9).fill(0.032), { k: 0.035 }),
        ...chain('bellyjaw', lipPts(bellyMouthC, bellyMouthR, Math.PI, Math.PI * 2, 9), Array(9).fill(0.036), { k: 0.035 }),
        E('bellyjaw', [0.42, 0.63, 0], [0.12, 0.06, 0.25], { k: 0.05 }),
        E('spine', bellyMouthC, bellyMouthR, { neg: true, k: 0.025 }),
        // ---- cabeça de Behemoth
        E('head', [0.26, 1.8, 0], [0.29, 0.27, 0.3]),
        E('head', [0.43, 1.68, 0], [0.2, 0.14, 0.25]),
        ...LR((s) => [
          E('head', [0.44, 1.63, 0.22 * s], [0.12, 0.11, 0.09], { k: 0.05 }),
          // sobrancelha franzida
          C('head', [0.57, 1.86, 0.03 * s], [0.47, 1.91, 0.23 * s], 0.055, 0.045, { k: 0.05 }),
          S('head', [0.56, 1.83, 0.13 * s], 0.052, { neg: true, k: 0.02 }),
          // orelhas pontudas
          E('head', [0.16, 1.82, 0.28 * s], [0.07, 0.08, 0.04], { rot: [0.4 * s, 0, 0], k: 0.04 }),
          C('head', [0.15, 1.85, 0.3 * s], [0.05, 1.99, 0.43 * s], 0.06, 0.012, { k: 0.03 }),
          S('head', [0.66, 1.76, 0.05 * s], 0.027, { neg: true, k: 0.012 }),
        ]),
        // focinho achatado
        E('head', [0.62, 1.75, 0], [0.07, 0.065, 0.11], { k: 0.04 }),
        E('jaw', [0.41, 1.51, 0], [0.22, 0.1, 0.25]),
        E('jaw', [0.55, 1.49, 0], [0.08, 0.075, 0.17], { k: 0.05 }),
        E('head', headMouthC, headMouthR, { neg: true, k: 0.025 }),
        // ---- braços enormes com mãos de garras
        ...LR((s, sd) => [
          E('upperarm.' + sd, [0, 1.47, 0.63 * s], [0.24, 0.22, 0.22], { k: 0.08 }),
          C('upperarm.' + sd, [0, 1.44, 0.62 * s], [0.06, 1.07, 0.74 * s], 0.17, 0.14),
          E('upperarm.' + sd, [0.1, 1.25, 0.69 * s], [0.12, 0.16, 0.12], { k: 0.06 }),
          S('forearm.' + sd, [0.06, 1.06, 0.74 * s], 0.13),
          C('forearm.' + sd, [0.06, 1.05, 0.74 * s], [0.15, 0.72, 0.77 * s], 0.16, 0.115),
          E('forearm.' + sd, [0.08, 0.96, 0.76 * s], [0.15, 0.15, 0.15], { k: 0.06 }),
          E('hand.' + sd, [0.19, 0.6, 0.77 * s], [0.14, 0.14, 0.11], { col: dk }),
          ...fingers(sd, s).flatMap(({ a, b, c }) => [C('hand.' + sd, a, b, 0.055, 0.047, { k: 0.03, col: dk }), C('hand.' + sd, b, c, 0.047, 0.038, { k: 0.02, col: dk })]),
          // pernas curtas e grossas, pés de garras
          C('thigh.' + sd, [0, 0.6, 0.27 * s], [0.1, 0.35, 0.34 * s], 0.21, 0.16),
          E('thigh.' + sd, [0.1, 0.5, 0.31 * s], [0.14, 0.15, 0.15], { k: 0.06 }),
          S('shin.' + sd, [0.1, 0.34, 0.34 * s], 0.14),
          C('shin.' + sd, [0.08, 0.32, 0.34 * s], [0, 0.12, 0.35 * s], 0.15, 0.11),
          E('shin.' + sd, [-0.06, 0.25, 0.34 * s], [0.11, 0.12, 0.12], { k: 0.06 }),
          E('foot.' + sd, [0.1, 0.075, 0.35 * s], [0.22, 0.075, 0.17], { col: dk }),
          S('foot.' + sd, [-0.07, 0.09, 0.35 * s], 0.1, { col: dk }),
          ...toes(s).map((p) => S('foot.' + sd, p, 0.05, { k: 0.03, col: dk })),
        ]),
      ], {
        pattern: compose(mottle(0.08, 5), mouthTint(headMouthC, headMouthR, 0x4a0c18, 1.5), mouthTint(bellyMouthC, bellyMouthR, 0x4a0c18, 1.5)),
        rough: { amp: 0.002, freq: 24 }, keep: 0.3,
      }),
      // casco escuro nas costas: cobre os ombros, desce pela lombar e cai entre as pernas
      layer('shell', 'scales', shell, 0.06, [
        E('chest', SHELL.c, SHELL.r),
        E('spine', [-0.27, 0.86, 0], [0.18, 0.36, 0.38]),
        E('hips', [-0.29, 0.5, 0], [0.08, 0.26, 0.17]),
        // crista central e faixas do casco
        ...[0, 1, 2, 3, 4].map((i) => {
          const y = 1.72 - i * 0.2;
          return C('chest', shellPt(y, 0, -0.01), shellPt(y - 0.2, 0, -0.01), 0.05, 0.04, { k: 0.04 });
        }),
        // juba escura no alto da cabeça
        E('head', [0.1, 1.94, 0], [0.24, 0.13, 0.27], { k: 0.08 }),
        E('neck', [-0.05, 1.72, 0], [0.18, 0.22, 0.3], { k: 0.08 }),
        ...[-2, -1, 0, 1, 2].map((i) => C('head', [0.16, 1.99, i * 0.08], [0.0, 2.12, i * 0.11], 0.055, 0.01, { k: 0.04 })),
      ], {
        cuts: [(x, y, z) => (y > 1.62 ? -1 : x - (0.0 + (1.36 - y) * 0.05))],
        pattern: compose(scaly(9, 0.55), mottle(0.2, 10)), rough: { amp: 0.004, freq: 22 }, cavity: 1.4, keep: 0.3,
      }),
      // sunga escura com aba pontuda na frente
      layer('trunks', 'leather', 0x2e2a40, 0.04, [
        E('hips', [0.01, 0.57, 0], [0.35, 0.18, 0.455]),
        ...LR((s, sd) => [
          C('thigh.' + sd, [0, 0.58, 0.27 * s], [0.04, 0.45, 0.3 * s], 0.235, 0.225),
          E('hips', [-0.14, 0.56, 0.18 * s], [0.2, 0.2, 0.2]),
        ]),
        C('hips', [0.31, 0.56, 0], [0.33, 0.36, 0], 0.08, 0.015, { k: 0.03 }),
      ], { cuts: [hem(0.45, { amp: 0.06, teeth: 12, seed: 7, ax: 0.36, az: 0.46 }), above(0.66)], pattern: mottle(0.15, 14), keep: 0.3 }),
      // chifres, espinhos do casco e garras (creme)
      layer('horn', 'horn', cream, 0.02, [
        ...LR((s) => [
          C('head', [0.2, 1.93, 0.17 * s], [0.23, 2.06, 0.33 * s], 0.09, 0.07),
          C('head', [0.23, 2.06, 0.33 * s], [0.33, 2.17, 0.46 * s], 0.07, 0.045),
          C('head', [0.33, 2.17, 0.46 * s], [0.5, 2.2, 0.52 * s], 0.045, 0.008),
        ]),
        // espinhos na borda do casco
        ...[-1.35, -1.0, -0.62, 0.62, 1.0, 1.35].map((a) => {
          const y = SHELL.c[1] + Math.cos(a) * SHELL.r[1] * 0.92, z = Math.sin(a) * SHELL.r[2] * 0.92;
          const b = shellPt(y, z, -0.06);
          return C('chest', b, [b[0] - 0.08, b[1] + Math.cos(a) * 0.12, b[2] + Math.sin(a) * 0.12], 0.05, 0.006);
        }),
        // garras das mãos e dos pés
        ...LR((s, sd) => [
          ...fingers(sd, s).map(({ b, c }) => {
            const d = [c[0] - b[0], c[1] - b[1], c[2] - b[2]], L = Math.hypot(...d);
            return C('hand.' + sd, c, [c[0] + d[0] / L * 0.11 + 0.015, c[1] + d[1] / L * 0.11, c[2] + d[2] / L * 0.11], 0.036, 0.004);
          }),
          ...toes(s).map((p) => C('foot.' + sd, [p[0] + 0.03, p[1], p[2]], [p[0] + 0.1, p[1] - 0.03, p[2] * 1.02], 0.032, 0.004)),
        ]),
      ], { cell: 0.012, keep: 0.35 }),
      // cravos cônicos de bronze nas costas
      layer('studs', 'gold', bronze, 0.01, [0, 1, 2].flatMap((r) => [1, -1].map((s) => {
        const b = shellPt(1.6 - r * 0.26, 0.19 * s, -0.04);
        return C('chest', b, [b[0] - 0.1, b[1], b[2] * 1.05], 0.07, 0.012);
      })), { cell: 0.014, keep: 0.4 }),
    ],
    rigid: [
      ...[1, -1].map((s) => eye('head', [0.555, 1.83, 0.13 * s], 0.048, { glow: 0xffa020, ei: 2.6 })),
      ...[1, -1].map((s) => eye('spine', [0.46, 1.04, 0.17 * s], 0.058, { glow: 0xff3a10, ei: 2.8 })),
      teeth('head', [0.58, 1.675, 0], 0.34, 7, 0.09, 0.032, { curve: 0.09, jag: 0.35, wrap: 0.9, fang: true }),
      teeth('jaw', [0.57, 1.54, 0], 0.3, 6, 0.075, 0.03, { dir: -1, curve: 0.09, jag: 0.3, wrap: 0.9, fang: true }),
      teeth('spine', [0.52, 0.815, 0], 0.42, 8, 0.09, 0.032, { curve: 0.08, jag: 0.35, wrap: 1.0, fang: true }),
      teeth('bellyjaw', [0.5, 0.665, 0], 0.38, 7, 0.075, 0.03, { dir: -1, curve: 0.08, jag: 0.3, wrap: 1.0, fang: true }),
    ],
  };
}

// ================================================================== DRAGÃO
// cabeça (osso 'jaw') e segmentos do corpo (sem esqueleto); unidades reais (sem scale)
const dscales = (f, amt) => (x, y, z, c) => {
  const u = x * f + (Math.floor(y * f * 1.2) % 2) * 0.5, v = y * f * 1.2;
  const du = Math.abs(u - Math.round(u)), dv = Math.abs(v - Math.round(v));
  const e = Math.min(du * 2, dv * 2.4);
  return e < 0.25 ? c.map((w) => w * (1 - amt * (1 - e / 0.25))) : c;
};
// a cabeça é esculpida com centro em y=0.62 e ampliada (hitbox 24x20 px)
export const DRAGON_HEAD_SCALE = 1.55;
export function dragonhead() {
  const top = 0x5636ae, belly = 0xb8a2ea, hornC = 0xf0d890, toothC = hex(0xf6f0dc);
  const mC = [0.34, 0.54, 0], mR = [0.3, 0.042, 0.1];
  const fangs = [];
  for (let i = 0; i < 4; i++) {
    const x = 0.56 - i * 0.1;
    for (const s of [1, -1]) {
      const z = (0.1 + i * 0.016) * s, big = i === 0 || i === 2;
      fangs.push(C('root', [x, 0.575, z], [x + 0.012, big ? 0.47 : 0.5, z * 1.02], big ? 0.024 : 0.018, 0.004, { col: toothC }));
      fangs.push(C('jaw', [x - 0.05, 0.495, z * 0.95], [x - 0.04, big ? 0.585 : 0.56, z * 0.97], big ? 0.022 : 0.017, 0.004, { col: toothC }));
    }
  }
  return {
    cell: 0.0155,
    scale: DRAGON_HEAD_SCALE,
    bones: [['root', '', 0, 0, 0], ['jaw', 'root', -0.1, 0.55, 0]],
    layers: [
      layer('scales', 'scales', top, 0.06, [
        // crânio alto e focinho curto e largo
        E('root', [-0.06, 0.73, 0], [0.3, 0.27, 0.27]),
        C('root', [0.1, 0.69, 0], [0.5, 0.67, 0], 0.21, 0.155),
        E('root', [0.56, 0.67, 0], [0.11, 0.105, 0.135], { k: 0.05 }),
        ...LR((s) => [
          S('root', [0.65, 0.71, 0.05 * s], 0.026, { neg: true, k: 0.012 }),
          E('root', [0.6, 0.77, 0.055 * s], [0.045, 0.035, 0.035], { k: 0.03 }),
          // arcadas pesadas e órbitas
          C('root', [0.3, 0.88, 0.07 * s], [0.05, 0.95, 0.2 * s], 0.065, 0.06, { k: 0.05 }),
          S('root', [0.23, 0.82, 0.17 * s], 0.07, { neg: true, k: 0.02 }),
          E('root', [0.12, 0.62, 0.2 * s], [0.15, 0.11, 0.09], { k: 0.06 }),
          // barbatanas das bochechas
          C('root', [-0.12, 0.6, 0.22 * s], [-0.46, 0.5, 0.36 * s], 0.085, 0.012, { k: 0.04 }),
          C('root', [-0.08, 0.7, 0.25 * s], [-0.42, 0.68, 0.42 * s], 0.065, 0.01, { k: 0.04 }),
        ]),
        // mandíbula inferior (osso 'jaw') com a garganta clara
        E('jaw', [0.2, 0.475, 0], [0.36, 0.08, 0.17], { col: belly }),
        E('jaw', [-0.04, 0.47, 0], [0.22, 0.11, 0.21], { col: belly }),
        E('root', [-0.14, 0.5, 0], [0.22, 0.14, 0.23], { col: belly, k: 0.08 }),
        E('root', mC, mR, { neg: true, k: 0.02 }),
      ], {
        pattern: compose(dscales(15, 0.25), mottle(0.1, 8), mouthTint(mC, mR, 0x500a14, 1.8)),
        cavity: 1.2, keep: 0.4,
      }),
      // língua e garganta (aparecem quando a boca abre)
      layer('mouth', 'wet', 0x6a1020, 0.05, [
        E('jaw', [0.26, 0.515, 0], [0.3, 0.035, 0.085]),
        E('root', [0.05, 0.55, 0], [0.22, 0.07, 0.1]),
      ], { cell: 0.016, keep: 0.3, cavity: 0 }),
      // chifres, crista e dentes
      layer('horn', 'horn', hornC, 0.02, [
        ...LR((s) => [
          C('root', [-0.06, 0.9, 0.14 * s], [-0.3, 1.07, 0.21 * s], 0.08, 0.055),
          C('root', [-0.3, 1.07, 0.21 * s], [-0.6, 1.12, 0.25 * s], 0.055, 0.008),
          C('root', [-0.22, 0.76, 0.22 * s], [-0.52, 0.8, 0.34 * s], 0.05, 0.006),
          C('root', [0.6, 0.79, 0.04 * s], [0.6, 0.86, 0.05 * s], 0.025, 0.004),
        ]),
        ...[0, 1, 2].map((i) => C('root', [0.08 - i * 0.17, 0.98 - i * 0.03, 0], [-0.1 - i * 0.17, 1.15 - i * 0.05, 0], 0.05, 0.006)),
        ...fangs,
      ], { cell: 0.012, keep: 0.3 }),
    ],
    rigid: [1, -1].map((s) => eye('root', [0.245, 0.82, 0.17 * s], 0.06, { glow: 0xf00000, pupil: false, ei: 1.35 })),
  };
}
export function dragonseg() {
  const top = 0x5e3cb6, belly = 0xbca6ec, hornC = 0xf0d890;
  return {
    cell: 0.052,
    bones: [['root', '', 0, 0, 0]],
    layers: [
      layer('scales', 'scales', top, 0.08, [
        E('root', [0, 0.02, 0], [0.5, 0.46, 0.44]),
        E('root', [0, -0.17, 0], [0.4, 0.3, 0.36], { col: belly }),
        // dorso com crista e placas laterais
        E('root', [-0.02, 0.33, 0], [0.44, 0.14, 0.14], { k: 0.06 }),
        ...LR((s) => [E('root', [-0.04, 0.12, 0.33 * s], [0.36, 0.2, 0.12], { k: 0.07 })]),
      ], {
        // placas da barriga em faixas + escamas no dorso
        pattern: compose(dscales(11, 0.16), mottle(0.08, 6), (x, y, z, c) => (y < -0.12 && Math.abs(((x * 6) % 1 + 1) % 1 - 0.5) > 0.4 ? c.map((w) => w * 0.72) : c)),
        cavity: 1.2, keep: 0.3,
      }),
      layer('spikes', 'horn', hornC, 0.03, [
        C('root', [0.08, 0.38, 0], [-0.16, 0.8, 0], 0.11, 0.008),
        ...LR((s) => [C('root', [-0.02, 0.22, 0.3 * s], [-0.18, 0.44, 0.5 * s], 0.06, 0.006)]),
      ], { cell: 0.034, keep: 0.3 }),
    ],
  };
}

export const SPECIES = { unicorn, bigman, astaroth, dragonhead, dragonseg };
