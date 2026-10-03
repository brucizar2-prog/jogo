// Kit de escultura (puro, sem three.js): atalhos para primitivas SDF, esqueletos e peças rígidas.
// Convenções do modelo: frente = +x, cima = +y, lado direito do personagem = +z (o lado que fica
// voltado para a câmera quando ele olha para a direita). Unidade = 1 tile (16 px do arcade).
import { roundCone, sphere, ellipsoid, roundBox, torus, fbm3 } from '../organic.js';

export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map((v) => Math.pow(v, 2.2));
const wrap = (p, bone, o = {}) => Object.assign(p, { bone, k: o.k, col: o.col !== undefined ? (Array.isArray(o.col) ? o.col : hex(o.col)) : undefined, neg: !!o.neg });
export const C = (bone, a, b, r1, r2, o) => wrap(roundCone(a, b, r1, r2 ?? r1), bone, o);
export const E = (bone, c, r, o = {}) => wrap(ellipsoid(c, r, o.rot), bone, o);
export const S = (bone, c, r, o) => wrap(sphere(c, r), bone, o);
export const Bx = (bone, c, half, round, o = {}) => wrap(roundBox(c, half, round, o.rot), bone, o);
export const T = (bone, c, R, r, o = {}) => wrap(torus(c, R, r, o.rot), bone, o);

// cadeia de cones arredondados por uma lista de pontos e raios (membros, dedos, caudas)
export function chain(bones, pts, radii, o = {}) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const b = Array.isArray(bones) ? bones[Math.min(i, bones.length - 1)] : bones;
    out.push(C(b, pts[i], pts[i + 1], radii[i], radii[i + 1], o));
  }
  return out;
}
// espelha: fn(s, sd) com s=+1 → lado 'R' (+z), s=-1 → lado 'L' (-z)
export const LR = (fn) => [...fn(1, 'R'), ...fn(-1, 'L')];
export const mir = (p, s) => [p[0], p[1], p[2] * s];

export function layer(name, mat, col, k, prims, extra = {}) {
  const c = hex(col);
  for (const p of prims) { if (p.k === undefined) p.k = k; if (p.col === undefined) p.col = c; }
  return { name, mat, prims, ...extra };
}

// esqueleto: lista [nome, pai, x, y, z]; '$' é trocado por R (+z) e L (-z)
export const bonesLR = (list) => list.flatMap((b) => (b[0].includes('$')
  ? [1, -1].map((s) => [b[0].replace('$', s > 0 ? 'R' : 'L'), b[1].replace('$', s > 0 ? 'R' : 'L'), b[2], b[3], b[4] * s])
  : [b]));

export function humanoidBones(p) {
  return bonesLR([
    ['root', '', 0, 0, 0],
    ['hips', 'root', p.hip[0], p.hip[1], 0],
    ['spine', 'hips', p.spine[0], p.spine[1], 0],
    ['chest', 'spine', p.chest[0], p.chest[1], 0],
    ['neck', 'chest', p.neck[0], p.neck[1], 0],
    ['head', 'neck', p.head[0], p.head[1], 0],
    ['thigh.$', 'hips', p.thigh[0], p.thigh[1], p.thigh[2]],
    ['shin.$', 'thigh.$', p.knee[0], p.knee[1], p.knee[2]],
    ['foot.$', 'shin.$', p.ankle[0], p.ankle[1], p.ankle[2]],
    ['upperarm.$', 'chest', p.shoulder[0], p.shoulder[1], p.shoulder[2]],
    ['forearm.$', 'upperarm.$', p.elbow[0], p.elbow[1], p.elbow[2]],
    ['hand.$', 'forearm.$', p.wrist[0], p.wrist[1], p.wrist[2]],
    ...(p.extra || []),
  ]);
}

// ------------------------------------------------------------------ cortes e padrões
// corte de bainha rasgada: remove tudo abaixo de uma linha serrilhada em torno do eixo (cx, cz)
export function hemCut(y0, opts = {}) {
  const { amp = 0.04, teeth = 9, cx = 0, cz = 0, seed = 1, below = true, noise = 0.02 } = opts;
  return (x, y, z) => {
    const a = Math.atan2(z - cz, x - cx);
    const saw = Math.abs(((a / (Math.PI * 2)) * teeth + seed * 0.37) % 1 - 0.5) * 2;
    const yy = y0 + amp * saw + noise * (fbm3(x * 9 + seed, 0, z * 9, 2) - 0.5) * 2;
    return below ? yy - y : y - yy;
  };
}
// corte de um tubo (manga/perna da calça) ao longo do eixo do membro: mantém só o trecho perto de 'a'
export function sleeveCut(a, b, frac, opts = {}) {
  const { amp = 0.03, teeth = 6, seed = 2 } = opts;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  const u = d.map((v) => v / L);
  return (x, y, z) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2];
    const t = px * u[0] + py * u[1] + pz * u[2];
    // ângulo em volta do eixo para serrilhar
    const ang = Math.atan2(pz * u[0] - px * u[2], py);
    const saw = Math.abs(((ang / (Math.PI * 2)) * teeth + seed * 0.31) % 1 - 0.5) * 2;
    const lim = L * frac + amp * saw;
    // só corta a parte "abaixo" do limite e ainda dentro do cilindro de influência do membro
    const radial = Math.hypot(px - t * u[0], py - t * u[1], pz - t * u[2]);
    if (radial > 0.35) return -1;
    return t - lim;
  };
}
// mistura de cor
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// variação de cor por ruído (pele, tecido, couro)
export function mottle(amount = 0.15, freq = 9, tint = null) {
  return (x, y, z, c) => {
    const n = fbm3(x * freq, y * freq, z * freq, 3) - 0.5;
    const k = 1 + n * 2 * amount;
    let r = [c[0] * k, c[1] * k, c[2] * k];
    if (tint && n > 0.15) r = mixc(r, tint, Math.min(1, (n - 0.15) * 4));
    return r;
  };
}
export const compose = (...fns) => (x, y, z, c) => fns.reduce((acc, f) => f(x, y, z, acc), c);

// ------------------------------------------------------------------ peças rígidas (montadas no main thread)
// eye: olho (esclera + íris + pupila) ou brilhante; horn: chifre/garra curvo afunilado;
// teeth: fileira de dentes; stud: rebite/esfera; obj: objeto especial (espada, escudo...)
const tag = (o) => ({ ...(o.layer ? { layer: o.layer } : {}), ...(o.name ? { name: o.name } : {}) });
export const eye = (bone, at, r, o = {}) => ({ t: 'eye', bone, at, r, ...o });
export const horn = (bone, at, dir, len, r, o = {}) => ({ t: 'horn', bone, at, dir, len, r, bend: o.bend || [0, 0, 0], col: o.col ?? 0xeee4cc, mat: o.mat || 'horn', tip: o.tip ?? 0.12, ...tag(o) });
export const teeth = (bone, at, span, count, len, r, o = {}) => ({ t: 'teeth', bone, at, span, count, len, r, dir: o.dir ?? 1, curve: o.curve ?? 0.04, col: o.col ?? 0xf2ead2, jag: o.jag ?? 0.3, tilt: o.tilt ?? 0, wrap: o.wrap ?? 0.6, fang: !!o.fang, ...tag(o) });
export const stud = (bone, at, r, o = {}) => ({ t: 'stud', bone, at, r, col: o.col ?? 0xb0b0b8, mat: o.mat || 'metal', ...tag(o) });
export const obj = (kind, bone, at, o = {}) => ({ t: 'obj', kind, bone, at, rot: o.rot || [0, 0, 0], scale: o.scale || 1, ...o });

// garras numa mão/pé: lista de pontas e direção comum
export function claws(bone, tips, dir, len, r, o = {}) {
  return tips.map((p) => horn(bone, p, dir, len, r, { bend: o.bend || [0, -len * 0.35, 0], col: o.col ?? 0x2a2420, mat: o.mat || 'claw', tip: 0.05, ...o }));
}
