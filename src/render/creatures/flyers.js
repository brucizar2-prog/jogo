// Animação dos voadores: Corvo/Corvo vermelho, Morcego, Woody Pig, Cavaleiro voador, Planta
// carnívora e Princesa (lado 'R' = +z, voltado para a câmera).
import * as THREE from 'three';
import { OrganicModel, addWing, wingPose } from './core.js';

const Q1 = new THREE.Quaternion(), EU = new THREE.Euler();
const ZA = new THREE.Vector3(0, 0, 1), YA = new THREE.Vector3(0, 1, 0);
// asa dobrada: corda em pé (bordo de ataque para cima, encostado no corpo), envergadura para trás e
// um pouco para baixo
const FOLD = {};
for (const s of [1, -1]) {
  const a = new THREE.Quaternion().setFromAxisAngle(ZA, 0.32);
  const b = new THREE.Quaternion().setFromAxisAngle(YA, -s * Math.PI / 2);
  const c = new THREE.Quaternion().setFromAxisAngle(ZA, Math.PI / 2 + 0.22);
  FOLD[s] = a.multiply(b).multiply(c);
}
// pose de asa esculpida (aberta ao longo de ±z): mistura entre "batendo" (rx) e "dobrada" (sobre o corpo)
function featherWingPose(B, wing, tip, s, flap, fold, dz = 0) {
  const b = B[wing];
  Q1.setFromEuler(EU.set(-s * flap, 0, 0));
  b.quaternion.copy(Q1).slerp(FOLD[s], fold);
  b.position.z += s * dz * fold;
  // dobrada: a corda e o leque das primárias se fecham
  b.scale.x = 1 - 0.28 * fold;
  B[tip].scale.x = 1 - 0.5 * fold;
}

// ------------------------------------------------------------------ corvo
class CrowO extends OrganicModel {
  constructor(key) {
    super(key);
    this.fold = 1;
  }
  update(e) {
    this.face(e.facing, 0.3);
    this.resetPose();
    const B = this.B, st = e.state, T = e.animT;
    const fly = st === 'fly', caw = st === 'caw';
    const target = fly ? 0 : caw ? 0.35 : 1;
    this.fold += (target - this.fold) * 0.25;
    let flap = 0;
    if (fly) flap = Math.sin(T * 0.5) * 0.85 + 0.15;
    else if (caw) flap = 0.5 + Math.sin(T * 0.8) * 0.4;
    for (const [sd, s] of [['R', 1], ['L', -1]]) {
      featherWingPose(B, 'wing.' + sd, 'wtip.' + sd, s, flap, this.fold, 0.03);
      // ponta da asa acompanha a batida com atraso
      B['wtip.' + sd].rotation.x = fly ? -s * Math.sin(T * 0.5 - 0.9) * 0.35 : 0;
    }
    if (fly) {
      // corpo na horizontal, pernas recolhidas, cabeça à frente
      B.body.rotation.z = -0.4 + Math.sin(T * 0.5 + 1) * 0.04;
      B.body.position.y += 0.08;
      B.head.rotation.z = 0.3;
      B['leg.R'].rotation.z = -1.5; B['leg.L'].rotation.z = -1.5;
      B.tail.rotation.z = 0.25 + Math.sin(T * 0.25) * 0.08;
    } else if (caw) {
      // grasnando: cabeça erguida, bico abrindo e fechando
      B.head.rotation.z = 0.25 + Math.sin(T * 0.6) * 0.15;
      B.jaw.rotation.z = -0.25 - Math.abs(Math.sin(T * 0.35)) * 0.35;
      B.body.rotation.z = 0.06;
      B.tail.rotation.z = Math.sin(T * 0.3) * 0.15;
    } else {
      // pousado: olha em volta, cauda balançando
      B.head.rotation.z = Math.sin(T * 0.04) * 0.08;
      B.head.rotation.y = Math.sin(T * 0.023) * 0.35;
      B.tail.rotation.z = Math.sin(T * 0.1) * 0.08;
    }
  }
}

// ------------------------------------------------------------------ morcego
class BatO extends OrganicModel {
  constructor() {
    super('bat');
    const tips = [[0.12, 0.66], [-0.1, 0.7], [-0.32, 0.6], [-0.46, 0.42], [-0.32, 0.22]];
    const o = { color: 0x3446c4, boneColor: 0x1a2470, fr: 0.016, end: [-0.06, 0.15], scallop: 0.34, cup: 0.12, clawColor: 0xe8e0d0 };
    addWing(this, 'wing.R', 1, [0.0, 0.29], tips, { ...o, z: 0.09 });
    addWing(this, 'wing.L', -1, [0.0, 0.29], tips, { ...o, z: -0.09 });
  }
  update(e) {
    this.face(e.facing, 0.2);
    this.resetPose();
    const B = this.B, T = e.animT;
    if (e.state === 'hang') {
      // de cabeça para baixo, asas fechadas junto ao corpo
      B.root.rotation.x = Math.PI;
      B.root.position.y = 0.6;
      // asas fechadas como uma capa em volta do corpo
      B['wing.R'].rotation.set(Math.PI, 2.85, 0); B['wing.L'].rotation.set(-Math.PI, -2.85, 0);
      B['wing.R'].scale.set(0.5, 0.52, 1); B['wing.L'].scale.set(0.5, 0.52, 1);
      B.head.rotation.z = Math.sin(T * 0.03) * 0.1;
      B.body.rotation.x = Math.sin(T * 0.02) * 0.08;
      return;
    }
    const drop = e.state === 'drop';
    wingPose(this, 0.75 + Math.sin(T * 0.7) * 0.75, drop ? -0.3 : 0);
    B.body.rotation.z = drop ? -0.35 : -0.15;
    B.head.rotation.z = drop ? 0.25 : 0.1;
    B['leg.R'].rotation.z = -0.5; B['leg.L'].rotation.z = -0.5;
    B.body.position.y += Math.sin(T * 0.7 + 1.2) * 0.02;
  }
}

// ------------------------------------------------------------------ woody pig
class PigO extends OrganicModel {
  constructor() {
    super('pig');
    this.spearX = this.parts.spear.position.x;
  }
  update(e) {
    this.face(e.facing, 0.3);
    this.resetPose();
    const B = this.B, T = e.animT, st = e.state;
    const f = Math.sin(T * 0.6);
    for (const [sd, s] of [['R', 1], ['L', -1]]) {
      B['wing.' + sd].rotation.x = -s * (0.95 + f * 0.55);
      B['wtip.' + sd].rotation.x = -s * Math.sin(T * 0.6 - 0.9) * 0.3;
      // patinhas "pedalando"
      B['fleg.' + sd].rotation.z = -0.25 + Math.sin(T * 0.3 + (s > 0 ? 0 : 1.5)) * 0.18;
      B['bleg.' + sd].rotation.z = -0.35 + Math.sin(T * 0.3 + (s > 0 ? 1.5 : 0)) * 0.18;
    }
    B.body.position.y += Math.sin(T * 0.15) * 0.05;
    B.body.rotation.z = Math.sin(T * 0.15 + 0.6) * 0.04;
    B.tail.rotation.x = Math.sin(T * 0.4) * 0.4;
    B.head.rotation.z = Math.sin(T * 0.08) * 0.05;
    // atirando: estocada com a cebolinha para a frente/baixo
    const sh = st === 'shoot', k = sh ? Math.sin(Math.min(1, (e.t || 0) / 18) * Math.PI) : 0;
    if (sh) B['fleg.R'].rotation.z = 0.2 + k * 0.5;
    this.parts.spear.rotation.z = -B['fleg.R'].rotation.z + 0.05 - k * 0.45;
    this.parts.spear.position.x = this.spearX + k * 0.14;
    // curva: meia-volta em arco (rola o corpo)
    this.inner.rotation.z = st === 'turn' ? Math.sin((e.t / 48) * Math.PI) * 0.8 : 0;
  }
}

// ------------------------------------------------------------------ cavaleiro voador
class KnightO extends OrganicModel {
  constructor() { super('knight'); }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B, T = e.animT;
    const tilt = Math.atan2(-(e.vyNow || 0), 1.0) * 0.8;
    B.body.rotation.z = tilt;
    B.head.rotation.z = Math.sin(T * 0.05) * 0.06;
    // lençol ondulando e ficando para trás conforme a inclinação
    B.cloth1.rotation.z = Math.sin(T * 0.11) * 0.07 - tilt * 0.35;
    B.cloth2.rotation.z = Math.sin(T * 0.11 - 0.9) * 0.12 - tilt * 0.25;
    B.cloth2.rotation.x = Math.sin(T * 0.07) * 0.08;
    // braços: escudo à frente, lança firme
    B['upperarm.L'].rotation.z = 0.15; B['upperarm.R'].rotation.z = 0.05;
    B.chest.rotation.y = Math.sin(T * 0.05) * 0.04;
  }
}

// ------------------------------------------------------------------ planta carnívora
class PlantO extends OrganicModel {
  constructor() { super('plant'); }
  update(e) {
    this.face(e.facing, 0.25);
    this.resetPose();
    const B = this.B, T = e.animT;
    const open = e.mouth ? Math.sin((e.mouth / 16) * Math.PI) * 0.6 : 0.05 + Math.sin(T * 0.1) * 0.04;
    B.jaw.rotation.z = -open * 0.9;
    B.head.rotation.z = open * 0.3 + Math.sin(T * 0.04) * 0.08;
    B.stem2.rotation.z = Math.sin(T * 0.05) * 0.08;
    B.stem1.rotation.z = Math.sin(T * 0.05 + 1) * 0.04;
  }
}

// ------------------------------------------------------------------ princesa
class PrincessO extends OrganicModel {
  constructor() { super('princess'); }
  update(e) {
    this.face(-1, 0.4);
    this.resetPose();
    const B = this.B, T = e.animT || 0;
    B.chest.rotation.z = Math.sin(T * 0.04) * 0.02;
    B.head.rotation.x = Math.sin(T * 0.03) * 0.06;
    B.head.rotation.z = Math.sin(T * 0.021) * 0.04;
    B.hairb.rotation.x = -Math.sin(T * 0.03) * 0.05;
    B.hips.rotation.y = Math.sin(T * 0.025) * 0.04;
  }
}

export const CREATURES = {
  crow: { keys: ['crow'], make: () => new CrowO('crow') },
  raven: { keys: ['raven'], make: () => new CrowO('raven') },
  bat: { keys: ['bat'], make: () => new BatO() },
  pig: { keys: ['pig'], make: () => new PigO() },
  knight: { keys: ['knight'], make: () => new KnightO() },
  plant: { keys: ['plant'], make: () => new PlantO() },
  princess: { keys: ['princess'], make: () => new PrincessO() },
};
