// Animação dos demônios: Red Arremer, Petite Devil (azul/lava), Satã e o Mago (lado 'R' = +z, câmera).
import * as THREE from 'three';
import { OrganicModel, membraneGeo, rmat, G } from './core.js';
import { GARG_WING, FIRE_WING } from '../species/demons.js';

// tubo afunilado com faces para fora (o taperTube do core sai com a orientação invertida)
function tubeGeo(pts, radii, radial = 7) {
  const n = pts.length, pos = [], nor = [], idx = [];
  const P = pts.map((p) => new THREE.Vector3(...p));
  const T = new THREE.Vector3(), N = new THREE.Vector3(0, 0, 1), Bv = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    T.copy(P[Math.min(n - 1, i + 1)]).sub(P[Math.max(0, i - 1)]).normalize();
    if (Math.abs(T.z) > 0.9) N.set(1, 0, 0);
    N.sub(T.clone().multiplyScalar(T.dot(N))).normalize();
    Bv.crossVectors(T, N);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(Bv, Math.sin(a));
      pos.push(P[i].x + d.x * radii[i], P[i].y + d.y * radii[i], P[i].z + d.z * radii[i]);
      nor.push(d.x, d.y, d.z);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
// asa de morcego presa a um osso: membrana em leque a partir de 'root' (pulso) + dedos ósseos
function batWing(m, bone, side, root, tips, o) {
  const w = m.rest[bone].world;
  const grp = new THREE.Group();
  grp.position.set(-w.x, -w.y, o.z - w.z);
  const mem = new THREE.Mesh(membraneGeo(root, tips, { scallop: o.scallop ?? 0.3, cup: (o.cup ?? 0.02) * side, end: o.end }), rmat('membrane', o.color));
  mem.castShadow = true;
  grp.add(mem);
  const fm = rmat('leather', o.boneColor);
  for (const t of tips) {
    const pts = [], radii = [];
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      pts.push([root[0] + (t[0] - root[0]) * k, root[1] + (t[1] - root[1]) * k + Math.sin(k * Math.PI) * 0.025, 0.006 * side]);
      radii.push(o.fr * (1 - k * 0.7));
    }
    const f = new THREE.Mesh(G('dwf' + JSON.stringify([root, t, o.fr, side]), () => tubeGeo(pts, radii)), fm);
    f.castShadow = true;
    grp.add(f);
  }
  m.B[bone].add(grp);
  return grp;
}

// pose das asas: tilt abre para fora (batida), spread gira a asa para trás/fora, sweep inclina no plano,
// fold < 1 encolhe o leque (asa fechada)
function wingsPose(m, tilt, spread, sweep = 0, fold = 1) {
  for (const [sd, s] of [['R', 1], ['L', -1]]) {
    const b = m.B['wing.' + sd];
    if (b) { b.rotation.set(s * tilt, s * spread, sweep); b.scale.set(fold, 0.85 + 0.15 * fold, 1); }
  }
}
const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ================================================================== GÁRGULAS
// membrana em leque a partir do pulso (dedos ósseos até as pontas)
function gargWings(m, o) {
  const W = GARG_WING;
  const root = [W.wrist[0], W.wrist[1]];
  const tips = [[-1.08, 1.3], [-0.98, 0.86], [-0.7, 0.6], [-0.4, 0.58]];
  for (const [sd, s] of [['R', 1], ['L', -1]]) {
    batWing(m, 'wing.' + sd, s, root, tips, { color: o.mem, boneColor: o.bone, z: W.wrist[2] * s, fr: 0.03, end: [-0.12, 0.92], scallop: 0.26, cup: 0.015 });
  }
}

class GargoyleO extends OrganicModel {
  constructor(key, o) {
    super(key);
    gargWings(this, o);
  }
  // braços levemente para dentro, cauda balançando
  base(e) {
    const B = this.B;
    B['upperarm.R'].rotation.x = 0.06; B['upperarm.L'].rotation.x = -0.06;
    B.tail.rotation.z = Math.sin(e.animT * 0.12) * 0.25;
    B.tail2.rotation.z = Math.sin(e.animT * 0.12 + 1) * 0.35;
  }
  legs(rt, lt, rs, ls, rf = 0, lf = 0) {
    const B = this.B;
    B['thigh.R'].rotation.z = rt; B['thigh.L'].rotation.z = lt;
    B['shin.R'].rotation.z = rs; B['shin.L'].rotation.z = ls;
    B['foot.R'].rotation.z = rf; B['foot.L'].rotation.z = lf;
  }
  arms(rz, lz, re, le) {
    const B = this.B;
    B['upperarm.R'].rotation.z = rz; B['upperarm.L'].rotation.z = lz;
    B['forearm.R'].rotation.z = re; B['forearm.L'].rotation.z = le;
  }
  // agachado (meditando no chão), k = 0..1
  crouch(k) {
    const B = this.B;
    B.hips.position.y -= 0.2 * k;
    this.legs(0.75 * k, 0.7 * k, -1.25 * k, -1.2 * k, 0.5 * k, 0.5 * k);
    B.spine.rotation.z = -0.22 * k; B.chest.rotation.z = -0.15 * k;
    B.head.rotation.z = 0.32 * k; B.neck.rotation.z = 0.1 * k;
    this.arms(0.15 * k, 0.15 * k, 0.5 * k, 0.5 * k);
  }
  // voando: pernas encolhidas, braços prontos para agarrar
  flyPose(e, swoop) {
    const B = this.B;
    const s = Math.sin(e.animT * 0.2);
    this.legs(0.35, 0.15, -1.0, -0.8, 0.5, 0.45);
    B.spine.rotation.z = swoop ? -0.45 : 0.08; B.chest.rotation.z = swoop ? -0.15 : 0.05;
    B.head.rotation.z = swoop ? 0.45 : -0.05;
    if (swoop) this.arms(1.2, 1.0, 0.3, 0.35);
    else this.arms(0.25 + s * 0.15, 0.25 - s * 0.15, 0.45, 0.45);
  }
}

// RED ARREMER: medita (perch), acorda, anda, paira e dá rasantes; abre a boca ao cuspir fogo
class ArremerO extends GargoyleO {
  constructor() { super('arremer', { mem: 0x34467e, bone: 0xb01e16 }); }
  update(e) {
    this.face(e.facing);
    this.resetPose();
    this.base(e);
    const B = this.B, st = e.state;
    if (st === 'perch') {
      this.crouch(1);
      B.chest.rotation.z += Math.sin(e.animT * 0.05) * 0.02;
      wingsPose(this, 0.2, 0.3, 0.35, 0.28);
    } else if (st === 'wake') {
      const k = clamp01(e.t / 22);
      this.crouch(1 - k);
      B.head.rotation.z -= 0.25 * Math.sin(k * Math.PI);
      wingsPose(this, mix(0.2, 0.3, k) + Math.sin(e.t * 0.6) * 0.08 * k, mix(0.3, 0.85, k), mix(0.35, 0, k), mix(0.28, 1, k));
    } else if (st === 'walk') {
      const s = Math.sin(e.animT * 0.4);
      this.legs(0.25 + s * 0.6, 0.25 - s * 0.6, -0.55 - Math.max(0, -s) * 0.6, -0.55 - Math.max(0, s) * 0.6, Math.max(0, -s) * 0.3, Math.max(0, s) * 0.3);
      B.hips.position.y += Math.abs(Math.cos(e.animT * 0.4)) * 0.04 - 0.06;
      B.spine.rotation.z = -0.2; B.chest.rotation.z = -0.12; B.head.rotation.z = 0.25;
      this.arms(-s * 0.5 + 0.2, s * 0.5 + 0.2, 0.5, 0.5);
      wingsPose(this, 0.2 + Math.sin(e.animT * 0.2) * 0.08, 0.6);
    } else {
      this.flyPose(e, st === 'swoop');
      const f = Math.sin(e.animT * 0.45);
      wingsPose(this, st === 'swoop' ? 0.45 : 0.55 + f * 0.55, st === 'swoop' ? 0.55 : 0.85 - f * 0.15);
    }
    B.jaw.rotation.z = e.spitT ? -0.5 : 0;
  }
}

// PETITE DEVIL: voa batendo as asas rápido, salta no chão (hop), mergulha (dive)
class DevilO extends GargoyleO {
  constructor(lava) {
    super(lava ? 'lavadevil' : 'devil', lava ? { mem: 0x8a2208, bone: 0xc0400e } : { mem: 0xa8aab8, bone: 0x3456d8 });
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    this.base(e);
    const B = this.B, st = e.state;
    const fl = st === 'hop' ? 0.25 : 1;
    const f = Math.sin(e.animT * 0.55);
    B.head.rotation.z = Math.sin(e.animT * 0.1) * 0.1;
    B.tail.rotation.z = Math.sin(e.animT * 0.2) * 0.4;
    if (st === 'hop') {
      const air = (e.t % 18) / 18;
      const k = Math.sin(air * Math.PI);
      this.legs(0.3 + k * 0.3, 0.25 + k * 0.3, -0.5 - k * 0.5, -0.45 - k * 0.5, 0.2, 0.2);
      this.arms(0.3 + k * 0.6, 0.3 + k * 0.5, 0.5, 0.5);
      B.spine.rotation.z = -0.1;
    } else if (st === 'dive') {
      this.flyPose(e, true);
      B.root.rotation.z = -0.35;
    } else {
      this.flyPose(e, false);
    }
    wingsPose(this, 0.55 + f * 0.55 * fl, 0.8 - f * 0.15 * fl);
  }
}

// ================================================================== SATÃ (Firebrand)
// asas fechadas envolvendo o corpo: meia-casca de membrana por lado, com nervuras e barra recortada
function wrapGeo(side) {
  const NU = 22, NV = 12, pos = [], idx = [];
  // leque: os dedos saem do pulso (u = 0.5, topo) e descem até a barra
  const fan = (u, v) => 0.5 + (u - 0.5) / Math.max(v, 0.08);
  const P = (u, v) => {
    const a = (-0.04 + u * 1.82) * side;
    const top = u < 0.5 ? 1.6 + 0.62 * Math.sin(u / 0.5 * Math.PI * 0.5) : 2.22 - 0.5 * (u - 0.5) / 0.5;
    const bot = 0.42 + 0.13 * Math.abs(Math.sin(u * Math.PI * 3));
    const y = top + (bot - top) * v;
    const f = fan(u, v);
    const sag = f > 0 && f < 1 ? 1 - 0.09 * Math.abs(Math.sin(f * Math.PI * 3)) * Math.min(1, v * 3) : 1;
    const vv = Math.max(0, Math.min(1, (1.95 - y) / 0.95));
    const b = Math.sin(vv * Math.PI * 0.5) - 0.06 * Math.max(0, (0.9 - y) * 2);
    const rx = (0.3 + 0.3 * b) * sag, rz = (0.54 + 0.22 * b) * sag;
    return [0.06 + rx * Math.cos(a), y, rz * Math.sin(a)];
  };
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) pos.push(...P(i / NU, j / NV));
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const q = j * (NU + 1) + i;
    if (side > 0) idx.push(q, q + NU + 1, q + 1, q + 1, q + NU + 1, q + NU + 2);
    else idx.push(q, q + 1, q + NU + 1, q + 1, q + NU + 2, q + NU + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ribs = [0, 1 / 3, 2 / 3, 1].map((u) => {
    const pts = [], radii = [];
    for (let j = 0; j <= 10; j++) {
      const t = j / 10, p = P(0.5 + (u - 0.5) * t, t);
      pts.push([0.06 + (p[0] - 0.06) * 1.025, p[1], p[2] * 1.025]);
      radii.push(0.036 * (1 - t * 0.6));
    }
    return tubeGeo(pts, radii);
  });
  return { g, ribs };
}
const SAT_OPEN = [0.5, 0.95, 0, 1];          // tilt, spread, sweep, fold (asas abertas no chão)
const SAT_SHUT = [0.3, 0.2, -0.4, 0.3];     // braços das asas erguidos sobre os ombros
class SatanO extends OrganicModel {
  constructor() {
    super('satan');
    const W = FIRE_WING;
    const root = [W.wrist[0], W.wrist[1]];
    const tips = [[-1.46, 1.77], [-1.33, 1.2], [-0.97, 0.86], [-0.58, 0.84]];
    this.mem = [];
    for (const [sd, s] of [['R', 1], ['L', -1]]) {
      this.mem.push(batWing(this, 'wing.' + sd, s, root, tips, { color: 0xa83c14, boneColor: 0xe8622a, z: W.wrist[2] * s, fr: 0.042, end: [-0.22, 1.28], scallop: 0.26, cup: 0.015 }));
    }
    // manto de asas (preso ao peito)
    this.wrap = new THREE.Group();
    const mm = rmat('membrane', 0xa83c14), rm = rmat('leather', 0xe8622a);
    for (const s of [1, -1]) {
      const { g, ribs } = G('satwrap' + s, () => wrapGeo(s));
      const m = new THREE.Mesh(g, mm); m.castShadow = true; this.wrap.add(m);
      for (const r of ribs) { const t = new THREE.Mesh(r, rm); t.castShadow = true; this.wrap.add(t); }
    }
    this.attach('chest', this.wrap, 0, 0, 0);
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B, st = e.state, T = e.animT;
    const w = clamp01(e.wings ?? 1);
    const air = st === 'hover' || st === 'takeoff' || st === 'swoop';
    const closed = !air && w < 0.5;
    B['upperarm.R'].rotation.x = 0.08; B['upperarm.L'].rotation.x = -0.08;
    B.tail.rotation.z = Math.sin(T * 0.08) * 0.08 + (air ? 0.35 : 0);
    B.tail2.rotation.z = Math.sin(T * 0.08 + 1) * 0.12 + (air ? 0.3 : 0);
    B.tail3.rotation.z = Math.sin(T * 0.08 + 2) * 0.15 + (air ? 0.4 : 0);
    // asas: batida no ar, abertas no chão, manto fechado em guarda (bloqueia os tiros)
    this.wrap.visible = closed;
    for (const m of this.mem) m.visible = !closed;
    let pose;
    if (st === 'hover' || st === 'takeoff') { const f = Math.sin(T * 0.25); pose = [0.55 + f * 0.45, 0.95 - f * 0.2, 0, 1]; }
    else if (st === 'swoop') pose = [0.35, 0.6, 0.35, 1];
    else { const k = clamp01((w - 0.5) * 2); pose = SAT_SHUT.map((v, i) => v + (SAT_OPEN[i] - v) * k); }
    wingsPose(this, ...pose);
    if (closed) { const k = 1 + w * 0.3; this.wrap.scale.set(k, 1, k); }
    // braços: abertos para agarrar no rasante, soltos ao lado do corpo
    const s = Math.sin(T * 0.1);
    if (st === 'swoop') {
      B['upperarm.R'].rotation.z = 1.6; B['upperarm.L'].rotation.z = 1.4;
      B['forearm.R'].rotation.z = 0.4; B['forearm.L'].rotation.z = 0.4;
      B.spine.rotation.z = -0.35; B.chest.rotation.z = -0.25; B.head.rotation.z = 0.45;
    } else {
      B['upperarm.R'].rotation.z = 0.25 + s * 0.08; B['upperarm.L'].rotation.z = 0.25 - s * 0.08;
      B['forearm.R'].rotation.z = 0.45; B['forearm.L'].rotation.z = 0.45;
      if (closed) { B['upperarm.R'].rotation.set(0.25, 0, 0); B['upperarm.L'].rotation.set(-0.25, 0, 0); B['forearm.R'].rotation.z = B['forearm.L'].rotation.z = 0.15; }
      B.chest.rotation.z = s * 0.03; B.head.rotation.z = s * 0.04;
    }
    if (air || st === 'land') {
      // pernas penduradas, garras para baixo
      B['thigh.R'].rotation.z = 0.5; B['thigh.L'].rotation.z = 0.2;
      B['shin.R'].rotation.z = -0.5; B['shin.L'].rotation.z = -0.3;
      B['foot.R'].rotation.z = -0.5; B['foot.L'].rotation.z = -0.45;
    }
    // boca abre ao cuspir as estrelas (mesma janela do jogo)
    B.jaw.rotation.z = st === 'hover' && e.t % 34 > 14 && e.t % 34 < 26 ? -0.5 : 0;
  }
}

// ================================================================== MAGO (a Morte)
// aparece abrindo as asinhas, ergue a mão direita para lançar o feitiço e some
class MagicianO extends OrganicModel {
  constructor() {
    super('magician');
    const tips = [[-0.43, 1.75], [-0.71, 1.58], [-0.78, 1.27], [-0.57, 0.99]];
    for (const [sd, s] of [['R', 1], ['L', -1]]) {
      batWing(this, 'wing.' + sd, s, [-0.15, 1.3], tips, { color: 0x9aa0b0, boneColor: 0x6a7080, z: 0.15 * s, fr: 0.02, end: [-0.19, 1.02], scallop: 0.3, cup: 0.03 });
    }
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B, st = e.state, T = e.animT;
    const open = st === 'appear' ? clamp01(e.t / 50) : 1;
    wingsPose(this, 0.2 + Math.sin(T * 0.2) * 0.1, 0.55 * open, -(1 - open) * 1.4, 0.4 + 0.6 * open);
    // manto balançando, flutua de leve
    B.hips.rotation.x = Math.sin(T * 0.07) * 0.03;
    B.hips.position.y += Math.sin(T * 0.05) * 0.015;
    B.head.rotation.z = Math.sin(T * 0.04) * 0.05 - 0.05;
    // braço esquerdo segura a foice; o direito se ergue para lançar o feitiço
    B['upperarm.L'].rotation.z = 0.25; B['forearm.L'].rotation.z = 0.35;
    const cast = st === 'cast';
    const k = cast ? clamp01(e.t / 12) : 0;
    B['upperarm.R'].rotation.z = 0.2 + k * 1.0; B['forearm.R'].rotation.z = 0.25 + k * 0.5;
    B['upperarm.R'].rotation.x = -0.15 * k;
    this.parts.orb.visible = cast && e.t < 30;
    this.parts.orb.scale.setScalar(0.6 + Math.sin(T * 0.4) * 0.25 + (cast ? clamp01(e.t / 24) * 0.5 : 0));
  }
}

export const CREATURES = {
  arremer: { keys: ['arremer'], make: () => new ArremerO() },
  devil: { keys: ['devil'], make: () => new DevilO(false) },
  lavadevil: { keys: ['lavadevil'], make: () => new DevilO(true) },
  satan: { keys: ['satan'], make: () => new SatanO() },
  magician: { keys: ['magician'], make: () => new MagicianO() },
};
