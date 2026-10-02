// Modelos 3D procedurais (low-poly, flat shading) com animação por estado.
// Cada personagem é 2.5D: modelo 3D articulado preso ao plano de jogo (z=0), virado 3/4 para a câmera.
import * as THREE from 'three';
import { tex } from './textures.js';

const mats = new Map();
export function M(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) {
    mats.set(k, new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.7, metalness: o.m ?? 0, flatShading: o.flat ?? true,
      emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map || null,
      transparent: !!o.t, opacity: o.op ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.dw ?? true,
    }));
  }
  return mats.get(k);
}

const geoCache = new Map();
function G(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
export const bx = (w, h, d, mat, x, y, z) => mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat, x, y, z);
export const sp = (r, mat, x, y, z, seg = 8) => mesh(G(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(4, seg * 0.75 | 0))), mat, x, y, z);
export const cy = (r0, r1, h, mat, x, y, z, seg = 8) => mesh(G(`c${r0},${r1},${h},${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg)), mat, x, y, z);
export const co = (r, h, mat, x, y, z, seg = 6) => mesh(G(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat, x, y, z);
export const cap = (r, len, mat, x, y, z) => mesh(G(`p${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8)), mat, x, y, z);
function piv(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// asa membranosa (morcego/demônio) desenhada como forma 2D extrudada fina
function wingGeo(span = 1.2, h = 0.8, fingers = 3) {
  return G(`wing${span},${h},${fingers}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(span * 0.35, h * 0.55);
    s.lineTo(span, h * 0.75);
    for (let i = 0; i < fingers; i++) {
      const fx = span - (i + 0.5) * (span / fingers);
      const fy = h * 0.75 - (i + 1) * (h * 0.85 / fingers);
      s.quadraticCurveTo(fx + span / fingers * 0.25, (fy + h * 0.2), fx, fy);
    }
    s.lineTo(0.05, -h * 0.12);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
    g.translate(0, 0, -0.015);
    return g;
  });
}

function addWing(parent, x, y, z, s, span, h, mat, back = 0.35, fingers = 3) {
  const p = piv(parent, x, y, z);
  const m = mesh(wingGeo(span, h, fingers), mat);
  m.rotation.z = Math.PI / 2 + back;
  m.castShadow = true;
  p.add(m);
  p.userData.s = s;
  return p;
}
// angle: 0 = asa erguida (silhueta completa), ~1.3 = asa abaixada em direção à câmera
function flap(p, angle) { p.rotation.x = p.userData.s * angle; }

// ---------------------------------------------------------------- base comum
class Model {
  constructor() {
    this.obj = new THREE.Group();
    this.inner = piv(this.obj);         // gira para olhar esquerda/direita
    this.yaw = 0;
    this.flashMats = [];
  }
  face(facing, bias = 0.42, instant = false) {
    const target = facing >= 0 ? -bias : Math.PI + bias;
    if (instant) this.yaw = target;
    else {
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * 0.35;
    }
    this.inner.rotation.y = this.yaw;
  }
  // pisca em branco ao ser atingido
  setFlash(on) {
    if (on === this._flash) return;
    this._flash = on;
    this.obj.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      if (on) {
        if (!o.userData.baseMat) o.userData.baseMat = o.material;
        o.material = flashMat(o.userData.baseMat);
      } else if (o.userData.baseMat) o.material = o.userData.baseMat;
    });
  }
  setOpacity(a) {
    if (a === this._alpha) return;
    this._alpha = a;
    this.obj.traverse((o) => {
      if (!o.isMesh) return;
      if (a < 1) {
        if (!o.userData.solidMat) o.userData.solidMat = o.material;
        const m = fadeMat(o.userData.solidMat);
        m.opacity = a;
        o.material = m;
      } else if (o.userData.solidMat) { o.material = o.userData.solidMat; }
    });
  }
}
const flashCache = new Map();
function flashMat(base) {
  if (!flashCache.has(base)) { const m = base.clone(); m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 1.6; flashCache.set(base, m); }
  return flashCache.get(base);
}
const fadeCache = new Map();
function fadeMat(base) {
  if (!fadeCache.has(base)) { const m = base.clone(); m.transparent = true; m.depthWrite = false; fadeCache.set(base, m); }
  return fadeCache.get(base);
}

// ================================================================ ARTHUR
export class ArthurModel extends Model {
  constructor(env) {
    super();
    const armor = M(0xaeb8cc, { m: 0.85, r: 0.38 });
    const armorDark = M(0x6e7890, { m: 0.85, r: 0.35 });
    const gold = M(0xd9a43a, { m: 0.9, r: 0.3 });
    const skin = M(0xe8a878, { r: 0.65 });
    const beard = M(0x6a3a1c, { r: 0.9 });
    const boxers = new THREE.MeshStandardMaterial({ map: tex('boxers'), roughness: 0.8 });
    const red = M(0xc8202a, { r: 0.6 });
    this.armorMats = [armor, armorDark];
    const r = this.inner;
    this.hips = piv(r, 0, 0.92, 0);
    // pernas
    const mkLeg = (z) => {
      const leg = piv(this.hips, 0, 0, z);
      const thighA = cap(0.12, 0.26, armor, 0, -0.22, 0); leg.add(thighA);
      const thighS = cap(0.1, 0.26, skin, 0, -0.22, 0); leg.add(thighS);
      const knee = piv(leg, 0, -0.45, 0);
      const kneeCap = sp(0.1, armorDark, 0.06, 0, 0, 6); knee.add(kneeCap);
      const shinA = cap(0.11, 0.24, armor, 0, -0.2, 0); knee.add(shinA);
      const shinS = cap(0.09, 0.24, skin, 0, -0.2, 0); knee.add(shinS);
      const boot = bx(0.3, 0.14, 0.2, armorDark, 0.05, -0.42, 0); knee.add(boot);
      const foot = bx(0.24, 0.1, 0.16, skin, 0.04, -0.42, 0); knee.add(foot);
      return { leg, knee, armor: [thighA, kneeCap, shinA, boot], skin: [thighS, shinS, foot] };
    };
    this.legL = mkLeg(0.13); this.legR = mkLeg(-0.13);
    // quadril / cueca
    this.pelvisA = bx(0.44, 0.26, 0.42, armorDark, 0, 0.02, 0); this.hips.add(this.pelvisA);
    this.tassets = bx(0.5, 0.16, 0.46, armor, 0, -0.1, 0); this.hips.add(this.tassets);
    this.boxers = bx(0.46, 0.3, 0.44, boxers, 0, -0.02, 0); this.hips.add(this.boxers);
    // tronco
    this.torso = piv(this.hips, 0, 0.12, 0);
    this.chestA = mesh(G('arthurChest', () => { const g = new THREE.CylinderGeometry(0.27, 0.22, 0.56, 8); g.scale(0.9, 1, 1.15); return g; }), armor, 0, 0.3, 0);
    this.torso.add(this.chestA);
    this.chestRidge = bx(0.06, 0.4, 0.04, armorDark, 0.24, 0.32, 0); this.torso.add(this.chestRidge);
    this.belt = cy(0.25, 0.25, 0.08, gold, 0, 0.04, 0, 10); this.belt.scale.z = 1.15; this.torso.add(this.belt);
    this.chestS = mesh(G('arthurChestS', () => { const g = new THREE.CylinderGeometry(0.24, 0.2, 0.54, 8); g.scale(0.85, 1, 1.1); return g; }), skin, 0, 0.3, 0);
    this.torso.add(this.chestS);
    // cabeça
    this.head = piv(this.torso, 0.02, 0.66, 0);
    this.face_ = sp(0.17, skin, 0.05, 0.02, 0, 8); this.head.add(this.face_);
    this.beard = bx(0.12, 0.12, 0.22, beard, 0.14, -0.08, 0); this.head.add(this.beard);
    this.helmet = mesh(G('helm', () => { const g = new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62); g.scale(1, 1.08, 0.96); return g; }), armor, -0.02, 0.04, 0);
    this.head.add(this.helmet);
    this.helmBack = bx(0.18, 0.3, 0.4, armor, -0.12, -0.06, 0); this.head.add(this.helmBack);
    this.cheekL = bx(0.16, 0.2, 0.05, armor, 0.07, -0.06, 0.2); this.head.add(this.cheekL);
    this.cheekR = bx(0.16, 0.2, 0.05, armor, 0.07, -0.06, -0.2); this.head.add(this.cheekR);
    this.crest = bx(0.36, 0.06, 0.06, gold, -0.02, 0.26, 0); this.head.add(this.crest);
    this.plume = co(0.07, 0.34, red, -0.18, 0.3, 0, 5); this.plume.rotation.z = 1.1; this.head.add(this.plume);
    this.hair = mesh(G('hair', () => { const g = new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); return g; }), beard, 0.0, 0.05, 0);
    this.head.add(this.hair);
    this.eyeL = bx(0.03, 0.03, 0.03, M(0x101010), 0.21, 0.04, 0.06); this.head.add(this.eyeL);
    this.eyeR = bx(0.03, 0.03, 0.03, M(0x101010), 0.21, 0.04, -0.06); this.head.add(this.eyeR);
    // braços
    const mkArm = (z) => {
      const arm = piv(this.torso, 0, 0.5, z);
      const paul = sp(0.15, armor, 0, 0.02, 0, 7); paul.scale.set(1, 0.8, 1); arm.add(paul);
      const upA = cap(0.085, 0.2, armor, 0, -0.17, 0); arm.add(upA);
      const upS = cap(0.075, 0.2, skin, 0, -0.17, 0); arm.add(upS);
      const elbow = piv(arm, 0, -0.33, 0);
      const foA = cap(0.08, 0.18, armorDark, 0, -0.14, 0); elbow.add(foA);
      const foS = cap(0.07, 0.18, skin, 0, -0.14, 0); elbow.add(foS);
      const hand = sp(0.075, skin, 0, -0.3, 0, 6); elbow.add(hand);
      const glove = sp(0.085, armorDark, 0, -0.3, 0, 6); elbow.add(glove);
      return { arm, elbow, armor: [paul, upA, foA, glove], skin: [upS, foS, hand] };
    };
    this.armL = mkArm(0.3); this.armR = mkArm(-0.3);
    // arma na mão (aparece no arremesso)
    this.handWeapon = piv(this.armR.elbow, 0, -0.32, 0);
    this.handWeapon.rotation.z = -Math.PI / 2;
    this.heldType = null;
    this.head.scale.setScalar(1.18);
    this.armorParts = [this.pelvisA, this.tassets, this.chestA, this.chestRidge, this.belt, this.helmet, this.helmBack, this.cheekL, this.cheekR, this.crest, this.plume,
      ...this.legL.armor, ...this.legR.armor, ...this.armL.armor, ...this.armR.armor];
    this.skinParts = [this.boxers, this.chestS, this.hair, ...this.legL.skin, ...this.legR.skin, ...this.armL.skin, ...this.armR.skin];
    // sapo
    this.frog = piv(this.obj);
    const fg = M(0x3cae3c, { r: 0.5 }), fy = M(0xe8e070, { r: 0.6 });
    const fb = sp(0.42, fg, 0, 0.36, 0, 10); fb.scale.set(1.2, 0.8, 1); this.frog.add(fb);
    const belly = sp(0.34, fy, 0.12, 0.3, 0, 8); belly.scale.set(1, 0.7, 0.9); this.frog.add(belly);
    for (const z of [0.18, -0.18]) {
      const e = sp(0.12, fg, 0.28, 0.66, z, 8); this.frog.add(e);
      const p = sp(0.06, M(0x111111), 0.36, 0.7, z, 6); this.frog.add(p);
      const leg = sp(0.16, fg, -0.32, 0.16, z * 1.8, 6); leg.scale.set(1.6, 0.6, 0.8); this.frog.add(leg);
    }
    this.frog.visible = false;
    // ossada (morte)
    this.bones = piv(this.obj);
    const bone = M(0xeee8d8, { r: 0.6 });
    const skull = sp(0.2, bone, 0.1, 0.18, 0, 8); this.bones.add(skull);
    const jaw = bx(0.18, 0.08, 0.2, bone, 0.18, 0.06, 0); this.bones.add(jaw);
    for (let i = 0; i < 7; i++) {
      const b = cy(0.035, 0.035, 0.5, bone, -0.5 + i * 0.16, 0.05, (i % 3 - 1) * 0.2, 5);
      b.rotation.z = Math.PI / 2 + (i - 3) * 0.4; this.bones.add(b);
    }
    this.bones.visible = false;
    this.phase = 0;
    this.throwAnim = 0;
  }

  update(p, dt, time) {
    const st = p.state;
    const armored = p.armor && !p.dead;
    // visibilidade de conjuntos
    const frog = p.frog && !p.dead;
    this.inner.visible = !frog && !(p.dead && p.deathT > 50);
    this.frog.visible = frog;
    this.bones.visible = p.dead && p.deathT > 40 && (p.deathKind === 'touch' || p.deathKind === 'shot' || p.deathKind === 'timeup' || p.deathKind === 'spell');
    for (const m of this.armorParts) m.visible = armored || (p.dead && p.deathT < 40 && p.armorAtDeath);
    for (const m of this.skinParts) m.visible = !armored;
    this.beard.visible = true; this.face_.visible = true;
    this.hair.visible = !armored;
    // reset de pose
    const L = this.legL, R = this.legR, AL = this.armL, AR = this.armR;
    let hipsY = 0.92, lean = 0, headTilt = 0;
    L.leg.rotation.set(0, 0, 0); R.leg.rotation.set(0, 0, 0); L.knee.rotation.set(0, 0, 0); R.knee.rotation.set(0, 0, 0);
    AL.arm.rotation.set(0, 0, 0); AR.arm.rotation.set(0, 0, 0); AL.elbow.rotation.set(0, 0, 0); AR.elbow.rotation.set(0, 0, 0);
    this.inner.position.set(0, 0, 0);
    let climbing = false;

    if (p.dead) {
      // desaba
      const k = Math.min(1, p.deathT / 30);
      this.inner.rotation.z = -k * 1.3 * (p.facing || 1);
      hipsY = 0.92 - k * 0.6;
      this.bones.rotation.y = this.yaw;
    } else {
      this.inner.rotation.z = 0;
      if (st === 'walk') {
        this.phase += 0.16;
        const s = Math.sin(this.phase);
        L.leg.rotation.z = s * 0.62; R.leg.rotation.z = -s * 0.62;
        L.knee.rotation.z = -Math.max(0, -s) * 0.9 - 0.1; R.knee.rotation.z = -Math.max(0, s) * 0.9 - 0.1;
        AL.arm.rotation.z = -s * 0.55; AR.arm.rotation.z = s * 0.55;
        AL.elbow.rotation.z = 0.5; AR.elbow.rotation.z = 0.5;
        hipsY = 0.92 + Math.abs(Math.cos(this.phase)) * 0.05;
        lean = -0.08;
      } else if (st === 'jump' || st === 'fall' || st === 'hit') {
        const up = p.vy < 0;
        L.leg.rotation.z = up ? 0.9 : 0.4; R.leg.rotation.z = up ? 0.2 : -0.2;
        L.knee.rotation.z = up ? -1.5 : -0.6; R.knee.rotation.z = up ? -0.9 : -0.3;
        AL.arm.rotation.z = up ? 1.6 : 0.8; AR.arm.rotation.z = up ? -0.4 : 0.6;
        AL.elbow.rotation.z = 0.6; AR.elbow.rotation.z = 0.6;
        if (st === 'hit') { lean = 0.5; AL.arm.rotation.z = 2.4; AR.arm.rotation.z = 2.2; }
      } else if (st === 'crouch' || st === 'crouchthrow') {
        hipsY = 0.5;
        L.leg.rotation.z = 1.5; L.knee.rotation.z = -2.5;
        R.leg.rotation.z = 0.2; R.knee.rotation.z = -1.7;
        lean = -0.25;
        AL.arm.rotation.z = 0.6; AL.elbow.rotation.z = 0.8;
        AR.arm.rotation.z = 0.4; AR.elbow.rotation.z = 0.6;
      } else if (st === 'climb') {
        climbing = true;
        const c = (p.climbAnim || 0) * 0.14;
        const s = Math.sin(c);
        AL.arm.rotation.x = 0; AL.arm.rotation.z = 2.6 + s * 0.4; AR.arm.rotation.z = 2.6 - s * 0.4;
        AL.elbow.rotation.z = 0.6; AR.elbow.rotation.z = 0.6;
        L.leg.rotation.z = 0.4 + s * 0.4; R.leg.rotation.z = 0.4 - s * 0.4;
        L.knee.rotation.z = -0.8 - s * 0.3; R.knee.rotation.z = -0.8 + s * 0.3;
      } else if (st === 'win') {
        AR.arm.rotation.z = 2.8; AR.elbow.rotation.z = 0.2;
        AL.arm.rotation.z = 0.3;
      } else {
        // parado: respiração
        hipsY = 0.92 + Math.sin(time * 2.4) * 0.008;
        AL.arm.rotation.z = 0.12; AR.arm.rotation.z = -0.08;
        AL.elbow.rotation.z = 0.25; AR.elbow.rotation.z = 0.25;
      }
      // arremesso (em qualquer estado não-escada)
      if ((st === 'throw' || st === 'crouchthrow') || p.airThrowT > 0) {
        const k = st === 'throw' || st === 'crouchthrow' ? 1 - p.throwT / 8 : 1 - p.airThrowT / 10;
        AR.arm.rotation.z = -2.2 + k * 3.6;
        AR.elbow.rotation.z = 0.3;
        if (p.airThrowT > 0) p.airThrowT--;
        // a arma aparece na mão só no começo do movimento
        if (this.heldType !== p.weapon) {
          this.handWeapon.clear();
          const w = weaponMesh(p.weapon); w.scale.setScalar(0.7); w.position.x = 0.15;
          this.handWeapon.add(w); this.heldType = p.weapon;
        }
        this.handWeapon.visible = k < 0.55;
      } else this.handWeapon.visible = false;
    }
    this.hips.position.y = hipsY;
    this.torso.rotation.z = lean;
    this.head.rotation.z = headTilt;
    if (climbing) {
      this.yaw += (Math.PI / 2 - this.yaw) * 0.4;
      this.inner.rotation.y = this.yaw;
    } else if (!p.dead) this.face(p.facing);
    // sapo pulando
    if (frog) {
      this.frog.rotation.y = p.facing > 0 ? -0.4 : Math.PI + 0.4;
      this.frog.scale.set(1, p.onGround ? 1 : 1.2, 1);
    }
    // piscar durante invulnerabilidade
    this.obj.visible = !(p.invuln > 1 && !p.dead && Math.floor(p.invuln / 3) % 2 === 0);
  }
}

// ================================================================ INIMIGOS
function eyes(parent, x, y, z, r, color = 0xff2020, gap = 0.1) {
  const em = M(color, { e: color, ei: 2.2 });
  parent.add(sp(r, em, x, y, z + gap, 6));
  parent.add(sp(r, em, x, y, z - gap, 6));
}

class ZombieModel extends Model {
  constructor() {
    super();
    const skin = M(0x5a76a6, { r: 0.8 }), hair = M(0xb8381c, { r: 0.9 }), rag = M(0x4a3a2a, { r: 1 }), dark = M(0x2a3a5a);
    const r = this.inner;
    this.body = piv(r, 0, 0, 0);
    this.hips = piv(this.body, 0, 0.85, 0);
    this.legs = [];
    for (const z of [0.12, -0.12]) {
      const l = piv(this.hips, 0, 0, z);
      l.add(cap(0.09, 0.55, rag, 0, -0.4, 0));
      l.add(bx(0.22, 0.08, 0.14, dark, 0.04, -0.82, 0));
      this.legs.push(l);
    }
    this.torso = piv(this.hips, 0, 0.05, 0);
    const ch = cap(0.2, 0.32, rag, 0, 0.32, 0); ch.scale.set(0.9, 1, 1.1); this.torso.add(ch);
    this.torso.add(cap(0.17, 0.3, skin, 0.03, 0.34, 0));
    this.head = piv(this.torso, 0.08, 0.72, 0);
    const hd = sp(0.18, skin, 0, 0, 0, 8); hd.scale.set(1, 1.1, 0.95); this.head.add(hd);
    const hr = sp(0.2, hair, -0.05, 0.08, 0, 7); hr.scale.set(1, 0.8, 1.05); this.head.add(hr);
    eyes(this.head, 0.15, 0.02, 0, 0.035, 0xffe060, 0.07);
    this.head.add(bx(0.06, 0.04, 0.1, M(0x200808), 0.16, -0.09, 0));
    this.arms = [];
    for (const z of [0.24, -0.24]) {
      const a = piv(this.torso, 0, 0.52, z);
      a.add(cap(0.07, 0.42, skin, 0, -0.26, 0));
      a.rotation.z = 1.35;
      this.arms.push(a);
    }
    this.pot = potMesh(); this.pot.position.set(0.45, 0.95, 0); this.pot.visible = false; r.add(this.pot);
  }
  update(e) {
    this.face(e.facing);
    const rise = e.state === 'walk' ? 1 : (e.rise ?? 0);
    this.body.position.y = -1.9 * (1 - rise);
    this.body.rotation.z = (1 - rise) * 0.4;
    const s = Math.sin(e.animT * 0.14);
    this.legs[0].rotation.z = e.state === 'walk' ? s * 0.4 : 0;
    this.legs[1].rotation.z = e.state === 'walk' ? -s * 0.4 : 0;
    this.torso.rotation.z = -0.25 + Math.sin(e.animT * 0.07) * 0.06;
    this.arms[0].rotation.z = 1.3 + s * 0.15; this.arms[1].rotation.z = 1.3 - s * 0.15;
    this.head.rotation.x = Math.sin(e.animT * 0.05) * 0.2;
    this.pot.visible = !!e.pot && rise > 0.6;
  }
}

function potMesh() {
  const g = new THREE.Group();
  const m = M(0x8a5a2a, { r: 0.6 });
  const b = sp(0.2, m, 0, 0, 0, 8); b.scale.set(1, 1.1, 1); g.add(b);
  g.add(cy(0.09, 0.13, 0.14, m, 0, 0.22, 0, 8));
  g.add(cy(0.13, 0.13, 0.04, M(0xd0a040, { m: 0.6, r: 0.3 }), 0, 0.3, 0, 8));
  return g;
}

class CrowModel extends Model {
  constructor(red) {
    super();
    const body = M(red ? 0xb82020 : 0x26346c, { r: 0.6 }), beak = M(0xe0b030), wingM = M(red ? 0x801010 : 0x1a2450, { r: 0.7, side: THREE.DoubleSide });
    const r = this.inner;
    const b = sp(0.22, body, 0, 0.3, 0, 8); b.scale.set(1.5, 0.9, 0.9); r.add(b);
    this.head = sp(0.14, body, 0.3, 0.46, 0, 8); r.add(this.head);
    const bk = co(0.06, 0.22, beak, 0.48, 0.44, 0, 5); bk.rotation.z = -Math.PI / 2; r.add(bk);
    eyes(r, 0.38, 0.5, 0, 0.03, 0xff3030, 0.08);
    const tail = bx(0.3, 0.05, 0.18, body, -0.38, 0.32, 0); tail.rotation.z = 0.3; r.add(tail);
    r.add(bx(0.03, 0.18, 0.03, beak, 0.05, 0.08, 0.06)); r.add(bx(0.03, 0.18, 0.03, beak, 0.05, 0.08, -0.06));
    this.wings = [addWing(r, 0.05, 0.4, 0.12, 1, 0.75, 0.42, wingM, 0.9, 4), addWing(r, 0.05, 0.4, -0.12, -1, 0.75, 0.42, wingM, 0.9, 4)];
  }
  update(e) {
    this.face(e.facing, 0.3);
    const flying = e.state === 'fly';
    const a = flying ? 0.75 + Math.sin(e.animT * 0.5) * 0.7 : (e.state === 'caw' ? 0.4 + Math.sin(e.animT * 0.8) * 0.4 : 1.45);
    for (const w of this.wings) { flap(w, a); w.children[0].rotation.z = Math.PI / 2 + (flying || e.state === 'caw' ? 0.5 : 1.5); }
    this.head.position.y = 0.46 + (e.state === 'perch' ? Math.sin(e.animT * 0.05) * 0.02 : 0);
    this.inner.rotation.z = flying ? -0.15 : 0;
  }
}

class PlantModel extends Model {
  constructor() {
    super();
    const green = M(0x2f9a3a, { r: 0.6 }), dark = M(0x1a5a20), mouth = M(0x9a0a18, { r: 0.5 }), tooth = M(0xf0f0e0);
    const r = this.inner;
    for (let i = 0; i < 5; i++) {
      const l = co(0.12, 0.6, dark, Math.cos(i * 1.3) * 0.2, 0.18, Math.sin(i * 1.3) * 0.2, 4);
      l.rotation.set(Math.sin(i * 1.3) * 0.9, 0, -Math.cos(i * 1.3) * 0.9); r.add(l);
    }
    this.stalk = cy(0.06, 0.09, 0.9, green, 0, 0.5, 0, 6); r.add(this.stalk);
    this.head = piv(r, 0.05, 1.05, 0);
    this.jawU = piv(this.head, 0, 0, 0);
    const u = sp(0.34, green, 0, 0, 0, 10); u.scale.set(1, 0.75, 0.9);
    const spotM = M(0xe0e070, { r: 0.6 });
    this.jawU.add(u);
    for (let i = 0; i < 5; i++) this.jawU.add(sp(0.05, spotM, -0.1 + Math.cos(i) * 0.15, 0.18, Math.sin(i * 2) * 0.22, 5));
    this.jawL = piv(this.head, 0, 0, 0);
    const lo = sp(0.3, green, 0, -0.06, 0, 10); lo.scale.set(1, 0.55, 0.85); this.jawL.add(lo);
    const inner = sp(0.24, mouth, 0.12, -0.04, 0, 8); inner.scale.set(1, 0.4, 0.75); this.head.add(inner);
    for (let i = 0; i < 4; i++) {
      const t = co(0.03, 0.1, tooth, 0.2 + i * 0.03, -0.02, -0.15 + i * 0.1, 4); t.rotation.z = Math.PI; this.jawU.add(t);
    }
    this.eye = sp(0.08, M(0xffffff), 0.12, 0.22, 0, 8); this.head.add(this.eye);
    this.head.add(sp(0.04, M(0x101010), 0.18, 0.23, 0, 6));
  }
  update(e) {
    this.face(e.facing, 0.25);
    const open = e.mouth ? Math.sin((e.mouth / 16) * Math.PI) * 0.6 : 0.05 + Math.sin(e.animT * 0.1) * 0.04;
    this.jawU.rotation.z = open * 0.6; this.jawL.rotation.z = -open * 0.6;
    this.head.position.x = 0.05 + Math.sin(e.animT * 0.05) * 0.04;
    this.head.rotation.z = Math.sin(e.animT * 0.04) * 0.1;
  }
}

class ArremerModel extends Model {
  constructor() {
    super();
    const red = M(0xc4241a, { r: 0.55 }), dark = M(0x7a1010, { r: 0.6 }), horn = M(0xe8e0c8), wingM = M(0x7e7290, { r: 0.6, side: THREE.DoubleSide }), boneM = M(0x5e4a6a);
    const r = this.inner;
    this.body = piv(r, 0, 0, 0);
    this.hips = piv(this.body, 0, 0.6, 0);
    this.legs = [];
    for (const z of [0.14, -0.14]) {
      const l = piv(this.hips, 0, 0, z);
      const th = cap(0.1, 0.22, red, 0.05, -0.15, 0); th.rotation.z = 0.5; l.add(th);
      const kn = piv(l, 0.12, -0.3, 0);
      kn.add(cap(0.07, 0.22, dark, -0.04, -0.15, 0));
      kn.add(bx(0.18, 0.06, 0.14, dark, 0.02, -0.3, 0));
      this.legs.push({ l, kn });
    }
    this.torso = piv(this.hips, 0, 0.05, 0);
    const t = sp(0.3, red, 0.02, 0.28, 0, 9); t.scale.set(0.9, 1.15, 1); this.torso.add(t);
    this.torso.add(sp(0.16, M(0xe05030), 0.17, 0.28, 0, 6));
    this.head = piv(this.torso, 0.15, 0.62, 0);
    const h = sp(0.22, red, 0, 0, 0, 9); h.scale.set(1.1, 1, 1); this.head.add(h);
    this.jaw = piv(this.head, 0.1, -0.08, 0);
    this.jaw.add(bx(0.22, 0.08, 0.26, dark, 0.06, -0.03, 0));
    for (const z of [0.12, -0.12]) {
      const hn = co(0.05, 0.28, horn, -0.05, 0.22, z, 5); hn.rotation.set(z * 2, 0, 0.5); this.head.add(hn);
      this.head.add(sp(0.05, M(0xffd020, { e: 0xffb000, ei: 2.5 }), 0.18, 0.06, z * 0.7, 6));
    }
    this.head.add(bx(0.08, 0.04, 0.2, M(0xfafafa), 0.2, -0.08, 0));
    this.arms = [];
    for (const z of [0.3, -0.3]) {
      const a = piv(this.torso, 0.05, 0.45, z);
      a.add(cap(0.075, 0.28, red, 0.08, -0.18, 0));
      a.add(co(0.06, 0.16, horn, 0.18, -0.42, 0, 4));
      a.rotation.z = 0.6;
      this.arms.push(a);
    }
    this.wings = [addWing(this.torso, -0.15, 0.5, 0.16, 1, 1.4, 1.0, wingM, 0.45), addWing(this.torso, -0.15, 0.5, -0.16, -1, 1.4, 1.0, wingM, 0.45)];
    for (const w of this.wings) { const b = cy(0.035, 0.03, 1.2, boneM, -0.25, 0.55, 0, 4); b.rotation.z = 0.45; w.add(b); }
    this.tail = cy(0.04, 0.02, 0.7, dark, -0.4, 0.55, 0, 5); this.tail.rotation.z = 1.2; this.body.add(this.tail);
  }
  update(e) {
    this.face(e.facing);
    const st = e.state;
    const ground = st === 'perch' || st === 'walk' || st === 'wake';
    const fl = st === 'perch' ? 0.15 : ground ? 0.35 + Math.sin(e.animT * 0.2) * 0.1 : 0.6 + Math.sin(e.animT * 0.45) * 0.55;
    for (const w of this.wings) { flap(w, fl); w.rotation.z = st === 'perch' ? 0.9 : 0; }
    if (st === 'perch') {
      this.hips.position.y = 0.42;
      this.legs[0].l.rotation.z = 1.4; this.legs[1].l.rotation.z = 1.4;
      this.legs[0].kn.rotation.z = -2.2; this.legs[1].kn.rotation.z = -2.2;
      this.torso.rotation.z = -0.35;
      this.head.rotation.z = -0.2 + Math.sin(e.animT * 0.03) * 0.05;
    } else if (st === 'walk') {
      const s = Math.sin(e.animT * 0.4);
      this.hips.position.y = 0.6;
      this.legs[0].l.rotation.z = 0.4 + s * 0.7; this.legs[1].l.rotation.z = 0.4 - s * 0.7;
      this.legs[0].kn.rotation.z = -0.8; this.legs[1].kn.rotation.z = -0.8;
      this.torso.rotation.z = -0.5;
      this.head.rotation.z = 0.3;
    } else {
      this.hips.position.y = 0.6;
      this.legs[0].l.rotation.z = 0.7; this.legs[1].l.rotation.z = 0.5;
      this.legs[0].kn.rotation.z = -1.3; this.legs[1].kn.rotation.z = -1.2;
      this.torso.rotation.z = st === 'swoop' ? -0.8 : -0.15;
      this.head.rotation.z = st === 'swoop' ? 0.5 : 0;
    }
    this.jaw.rotation.z = e.spitT ? -0.6 : -0.05;
    this.arms[0].rotation.z = 0.6 + Math.sin(e.animT * 0.2) * 0.2;
    this.arms[1].rotation.z = 0.6 - Math.sin(e.animT * 0.2) * 0.2;
    this.tail.rotation.z = 1.2 + Math.sin(e.animT * 0.15) * 0.2;
  }
}

class KnightModel extends Model {
  constructor() {
    super();
    const arm = M(0x5a4aa8, { m: 0.8, r: 0.3 }), trim = M(0xc0c4d4, { m: 0.9, r: 0.25 }), plume = M(0xd02a2a), ghost = M(0x6a60c0, { t: true, op: 0.45, e: 0x2a2060, dw: false });
    const r = this.inner;
    this.tilt = piv(r, 0, 0.9, 0);
    const t = sp(0.3, arm, 0, 0.05, 0, 9); t.scale.set(0.9, 1.1, 1.05); this.tilt.add(t);
    const cl = co(0.32, 0.8, ghost, 0, -0.5, 0, 8); cl.rotation.z = Math.PI; this.tilt.add(cl);
    const h = sp(0.2, arm, 0.05, 0.5, 0, 9); this.tilt.add(h);
    this.tilt.add(bx(0.06, 0.04, 0.26, M(0x050505), 0.22, 0.5, 0));
    this.tilt.add(bx(0.3, 0.06, 0.06, trim, 0.0, 0.68, 0));
    const pl = co(0.06, 0.4, plume, -0.15, 0.78, 0, 5); pl.rotation.z = 1; this.tilt.add(pl);
    this.shield = piv(this.tilt, 0.32, 0.05, 0);
    const sh = cy(0.36, 0.36, 0.08, trim, 0, 0, 0, 12); sh.rotation.z = Math.PI / 2; this.shield.add(sh);
    const em = cy(0.18, 0.18, 0.1, M(0xb02020), 0.02, 0, 0, 3); em.rotation.z = Math.PI / 2; this.shield.add(em);
    const lance = co(0.06, 1.2, trim, 0.2, -0.1, -0.3, 6); lance.rotation.z = -Math.PI / 2 - 0.2; this.tilt.add(lance);
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.tilt.rotation.z = Math.atan2(-(e.vyNow || 0), 1.0) * 0.8;
  }
}

class PigModel extends Model {
  constructor() {
    super();
    const pink = M(0xb87458, { r: 0.6 }), snout = M(0xd89878), wood = M(0x6a4222, { r: 0.9 }), onion = M(0x6ad040), white = M(0xf0f0e0), wingM = M(0xd8c8a8, { side: THREE.DoubleSide });
    const r = this.inner;
    const b = sp(0.32, pink, 0, 0.2, 0, 9); b.scale.set(1.2, 0.9, 0.95); r.add(b);
    r.add(cy(0.12, 0.12, 0.12, snout, 0.42, 0.22, 0, 8).rotateZ(Math.PI / 2));
    for (const z of [0.15, -0.15]) {
      const ear = co(0.08, 0.16, pink, 0.2, 0.45, z, 4); ear.rotation.x = z * 2; r.add(ear);
      r.add(sp(0.04, M(0x101010), 0.32, 0.34, z * 0.6, 5));
    }
    const stump = cy(0.22, 0.25, 0.3, wood, -0.02, 0.58, 0, 8); r.add(stump);
    r.add(cy(0.2, 0.2, 0.02, M(0xb08040), -0.02, 0.74, 0, 8));
    this.wings = [addWing(r, -0.1, 0.35, 0.25, 1, 0.5, 0.32, wingM, 0.6), addWing(r, -0.1, 0.35, -0.25, -1, 0.5, 0.32, wingM, 0.6)];
    this.spear = piv(r, 0.1, 0.0, 0.3);
    const s1 = cy(0.03, 0.03, 0.9, onion, 0, 0, 0, 5); s1.rotation.z = Math.PI / 2; this.spear.add(s1);
    const s2 = sp(0.08, white, -0.45, 0, 0, 6); this.spear.add(s2);
  }
  update(e) {
    this.face(e.facing, 0.3);
    for (const w of this.wings) flap(w, 0.6 + Math.sin(e.animT * 0.6) * 0.6);
    this.inner.position.y = Math.sin(e.animT * 0.15) * 0.05;
    this.spear.rotation.z = e.state === 'shoot' ? -0.6 : 0;
    this.inner.rotation.z = e.state === 'turn' ? Math.sin(e.t / 48 * Math.PI) * 0.8 : 0;
  }
}

class DevilModel extends Model {
  constructor(lava) {
    super();
    const blue = M(lava ? 0xd04a10 : 0x3050c8, { r: 0.5 }), dark = M(lava ? 0x801800 : 0x1a2a70), wingM = M(lava ? 0xa03010 : 0x4a60d0, { side: THREE.DoubleSide, r: 0.6 });
    const r = this.inner;
    const b = sp(0.2, blue, 0, 0.3, 0, 8); b.scale.set(0.9, 1.1, 0.9); r.add(b);
    const h = sp(0.17, blue, 0.08, 0.6, 0, 8); r.add(h);
    for (const z of [0.09, -0.09]) {
      const hn = co(0.04, 0.16, M(0xf0e8d0), 0.02, 0.78, z, 4); hn.rotation.x = z * 3; r.add(hn);
      r.add(sp(0.035, M(0xffee40, { e: 0xffd000, ei: 2 }), 0.22, 0.63, z * 0.8, 5));
      r.add(cap(0.05, 0.16, dark, 0, 0.08, z * 1.4));
    }
    this.wings = [addWing(r, -0.05, 0.42, 0.12, 1, 0.65, 0.48, wingM, 0.5), addWing(r, -0.05, 0.42, -0.12, -1, 0.65, 0.48, wingM, 0.5)];
    const tail = cy(0.025, 0.015, 0.4, dark, -0.24, 0.25, 0, 4); tail.rotation.z = 1; r.add(tail);
  }
  update(e) {
    this.face(e.facing, 0.35);
    const fl = e.state === 'hop' ? 0.25 : 1;
    for (const w of this.wings) flap(w, 0.55 + Math.sin(e.animT * 0.55) * 0.55 * fl);
  }
}

class BigManModel extends Model {
  constructor() {
    super();
    const skin = M(0xc89a6a, { r: 0.6 }), dark = M(0x8a6040), cloth = M(0xa02020, { r: 0.8 }), metal = M(0x666670, { m: 0.8, r: 0.4 });
    const r = this.inner;
    this.hips = piv(r, 0, 1.2, 0);
    this.legs = [];
    for (const z of [0.22, -0.22]) {
      const l = piv(this.hips, 0, 0, z);
      l.add(cap(0.17, 0.5, skin, 0, -0.45, 0));
      l.add(bx(0.36, 0.14, 0.28, dark, 0.06, -0.95, 0));
      this.legs.push(l);
    }
    r.add(bx(0.62, 0.32, 0.7, cloth, 0, 1.15, 0));
    this.torso = piv(this.hips, 0, 0.1, 0);
    const t = sp(0.5, skin, 0, 0.5, 0, 10); t.scale.set(0.9, 1, 1.15); this.torso.add(t);
    this.torso.add(sp(0.26, skin, 0.25, 0.45, 0.18, 7)); this.torso.add(sp(0.26, skin, 0.25, 0.45, -0.18, 7));
    this.head = piv(this.torso, 0.25, 1.0, 0);
    this.head.add(sp(0.22, skin, 0, 0, 0, 8));
    this.head.add(bx(0.1, 0.08, 0.32, dark, 0.15, 0.08, 0));
    eyes(this.head, 0.2, 0.0, 0, 0.04, 0xff3010, 0.08);
    this.head.add(co(0.06, 0.22, M(0xeee6d0), 0.05, 0.28, 0, 5));
    this.arms = [];
    for (const z of [0.55, -0.55]) {
      const a = piv(this.torso, 0.05, 0.75, z);
      a.add(cap(0.14, 0.4, skin, 0, -0.3, 0));
      a.add(sp(0.17, dark, 0, -0.62, 0, 7));
      this.arms.push(a);
    }
    this.flail = sp(0.16, metal, 0, -0.9, 0, 6);
    this.arms[1].add(this.flail);
    for (let i = 0; i < 6; i++) { const s = co(0.04, 0.12, metal, Math.cos(i) * 0.15, -0.9 + Math.sin(i) * 0.15, (i % 2 - 0.5) * 0.15, 4); this.arms[1].add(s); }
  }
  update(e) {
    this.face(e.facing, 0.35);
    const s = Math.sin(e.animT * (e.state === 'charge' ? 0.22 : 0.12));
    const moving = Math.abs(e.vx) > 0;
    this.legs[0].rotation.z = moving ? s * 0.45 : 0; this.legs[1].rotation.z = moving ? -s * 0.45 : 0;
    this.torso.rotation.z = -0.15 + (moving ? Math.abs(s) * 0.05 : 0);
    if (e.state === 'throw') {
      const k = Math.min(1, e.t / 14);
      this.arms[1].rotation.z = -2.4 + k * 4;
      this.flail.visible = e.t < 14;
    } else {
      this.arms[1].rotation.z = -s * 0.4; this.flail.visible = true;
    }
    this.arms[0].rotation.z = s * 0.4;
  }
}

class BatModel extends Model {
  constructor() {
    super();
    const b = M(0x2a3a98, { r: 0.6 }), wingM = M(0x3a4ab0, { side: THREE.DoubleSide, r: 0.7 });
    const r = this.inner;
    const body = sp(0.16, b, 0, 0.2, 0, 7); body.scale.set(1.1, 1, 1); r.add(body);
    for (const z of [0.07, -0.07]) { r.add(co(0.04, 0.12, b, 0.06, 0.38, z, 4)); r.add(sp(0.03, M(0xff3030, { e: 0xff2020, ei: 2 }), 0.14, 0.26, z, 5)); }
    this.wings = [addWing(r, 0, 0.26, 0.1, 1, 0.7, 0.45, wingM, 0.15), addWing(r, 0, 0.26, -0.1, -1, 0.7, 0.45, wingM, 0.15)];
  }
  update(e) {
    this.face(e.facing, 0.2);
    if (e.state === 'hang') { this.inner.rotation.z = Math.PI; for (const w of this.wings) flap(w, 0.05); this.inner.position.y = 0.45; return; }
    this.inner.rotation.z = 0; this.inner.position.y = 0;
    for (const w of this.wings) flap(w, 0.75 + Math.sin(e.animT * 0.7) * 0.75);
  }
}

class TowerModel extends Model {
  constructor() {
    super();
    const stone = new THREE.MeshStandardMaterial({ map: tex('tomb'), color: 0xb8b8c0, roughness: 0.9, flatShading: true });
    const r = this.inner;
    this.col = mesh(G('towercol', () => { const g = new THREE.CylinderGeometry(0.42, 0.5, 3, 7, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 1.4) p.setY(i, p.getY(i) + (i % 3) * 0.12); return g; }), stone, 0, 1.5, 0);
    r.add(this.col);
    this.faces = [];
    for (const y of [0.75, 2.25]) {
      const f = piv(r, 0.38, y, 0);
      f.add(bx(0.08, 0.12, 0.42, M(0x200000), 0.0, -0.14, 0));
      eyes(f, 0.03, 0.1, 0, 0.06, 0xff2a10, 0.12);
      f.visible = false;
      this.faces.push(f);
    }
    this.glowM = M(0xff4020, { e: 0xff2000, ei: 0 });
  }
  update(e) {
    this.face(e.facing, 0.35);
    const active = e.state !== 'dormant';
    const k = e.state === 'wake' ? (Math.floor(e.t / 4) % 2) : 0;
    this.col.material.emissive = this.col.material.emissive || new THREE.Color();
    if (e.state === 'wake') this.col.material.color.setHex(k ? 0xe05040 : 0xb8b8c0);
    else this.col.material.color.setHex(active ? 0xc08a80 : 0xb8b8c0);
    // as faces aparecem quando a torre desperta (12 e 36 px acima da base)
    const oys = (e.faces || []).map((f) => f.oy / 16);
    this.faces[0].visible = active && e.state === 'active' && oys.some((o) => o < 1.5);
    this.faces[1].visible = active && e.state === 'active' && oys.some((o) => o >= 1.5);
    this.faces[0].position.y = 0.75; this.faces[1].position.y = 2.25;
  }
}

class SkeletonModel extends Model {
  constructor() {
    super();
    const bone = M(0xeae4d4, { r: 0.6 });
    const r = this.inner;
    this.skull = piv(r, 0, 0.18, 0);
    const s = sp(0.18, bone, 0, 0, 0, 8); s.scale.set(1, 0.95, 0.9); this.skull.add(s);
    this.skull.add(bx(0.14, 0.07, 0.2, bone, 0.08, -0.14, 0));
    for (const z of [0.07, -0.07]) this.skull.add(sp(0.045, M(0x1a0000, { e: 0xff2000, ei: 0.8 }), 0.15, 0.02, z, 5));
    this.body = piv(r, 0, 0, 0);
    this.body.add(cy(0.03, 0.03, 0.55, bone, 0, 1.05, 0, 5));
    for (let i = 0; i < 4; i++) { const rb = mesh(G('rib', () => new THREE.TorusGeometry(0.15, 0.025, 4, 10, Math.PI * 1.2)), bone, 0.02, 1.25 - i * 0.1, 0); rb.rotation.set(Math.PI / 2, 0, 0.3); this.body.add(rb); }
    this.body.add(bx(0.2, 0.08, 0.28, bone, 0, 0.78, 0));
    this.legs = [];
    for (const z of [0.1, -0.1]) { const l = piv(this.body, 0, 0.76, z); l.add(cy(0.03, 0.03, 0.7, bone, 0, -0.36, 0, 5)); l.add(bx(0.16, 0.05, 0.08, bone, 0.05, -0.72, 0)); this.legs.push(l); }
    this.arms = [];
    for (const z of [0.2, -0.2]) { const a = piv(this.body, 0, 1.38, z); a.add(cy(0.025, 0.025, 0.6, bone, 0, -0.3, 0, 5)); this.arms.push(a); }
  }
  update(e) {
    this.face(e.facing, 0.35);
    if (e.state === 'skull') { this.body.visible = false; this.skull.position.set(0, 0.16, 0); this.skull.rotation.z = 0; return; }
    this.body.visible = true;
    const k = e.state === 'rise' ? Math.min(1, e.t / 30) : 1;
    this.body.scale.y = k;
    this.skull.position.set(0.05, 0.16 + k * 1.42, 0);
    const s = Math.sin(e.animT * 0.25);
    this.legs[0].rotation.z = s * 0.5; this.legs[1].rotation.z = -s * 0.5;
    this.arms[0].rotation.z = 1.2 + s * 0.3; this.arms[1].rotation.z = 1.2 - s * 0.3;
    this.skull.rotation.z = e.state === 'jump' ? 0.4 : Math.sin(e.animT * 0.3) * 0.15;
  }
}

class MagicianModel extends Model {
  constructor() {
    super();
    const robe = M(0x6a7088, { r: 0.8 }), dark = M(0x2a2c3a), wingM = M(0x9aa0b0, { side: THREE.DoubleSide });
    const r = this.inner;
    const body = co(0.4, 1.4, robe, 0, 0.7, 0, 8); r.add(body);
    const head = sp(0.2, robe, 0.04, 1.5, 0, 8); r.add(head);
    r.add(co(0.18, 0.4, robe, -0.05, 1.75, 0, 6));
    r.add(sp(0.12, dark, 0.14, 1.46, 0, 6));
    eyes(r, 0.22, 1.5, 0, 0.035, 0x40ffb0, 0.06);
    const staff = cy(0.03, 0.03, 1.6, M(0x5a3a1a), 0.38, 0.8, 0.15, 5); r.add(staff);
    this.orb = sp(0.1, M(0x60ffe0, { e: 0x30ffd0, ei: 3 }), 0.38, 1.65, 0.15, 8); r.add(this.orb);
    this.wings = [addWing(r, -0.1, 1.2, 0.2, 1, 1.1, 0.85, wingM, 0.5, 4), addWing(r, -0.1, 1.2, -0.2, -1, 1.1, 0.85, wingM, 0.5, 4)];
  }
  update(e) {
    this.face(e.facing, 0.35);
    const open = e.state === 'appear' ? Math.min(1, e.t / 50) : 1;
    for (const w of this.wings) { flap(w, 0.2 + Math.sin(e.animT * 0.2) * 0.1); w.rotation.z = (1 - open) * 1.4; }
    this.orb.scale.setScalar(1 + Math.sin(e.animT * 0.4) * 0.3);
  }
}

class FireJetModel extends Model {
  constructor() {
    super();
    this.core = mesh(G('jetcore', () => { const g = new THREE.CylinderGeometry(0.25, 0.42, 1, 8, 4, true); g.translate(0, 0.5, 0); return g; }), M(0xffc040, { e: 0xff8a10, ei: 3, t: true, op: 0.85, dw: false, side: THREE.DoubleSide }));
    this.core.castShadow = false;
    this.outer = mesh(G('jetouter', () => { const g = new THREE.CylinderGeometry(0.35, 0.6, 1, 8, 4, true); g.translate(0, 0.5, 0); return g; }), M(0xff4a10, { e: 0xff3000, ei: 2.2, t: true, op: 0.55, dw: false, side: THREE.DoubleSide }));
    this.outer.castShadow = false;
    this.inner.add(this.core); this.inner.add(this.outer);
  }
  update(e, dt, time) {
    const h = Math.max(0.01, e.h / 16);
    this.core.scale.set(1 + Math.sin(time * 20) * 0.08, h, 1);
    this.outer.scale.set(1 + Math.sin(time * 13 + 1) * 0.1, h * 0.92, 1);
    this.obj.visible = e.h > 1;
  }
}

class PrincessModel extends Model {
  constructor() {
    super();
    const hair = M(0x9a50d0, { r: 0.6 }), dress = M(0xf4f0f8, { r: 0.7 }), skin = M(0xf0c0a0), red = M(0xc0204a);
    const r = this.inner;
    r.add(co(0.45, 1.2, dress, 0, 0.6, 0, 10));
    r.add(cap(0.13, 0.3, red, 0, 1.25, 0));
    r.add(sp(0.17, skin, 0.03, 1.62, 0, 8));
    const h = sp(0.21, hair, -0.04, 1.66, 0, 8); h.scale.set(1, 1, 1.05); r.add(h);
    r.add(cap(0.12, 0.6, hair, -0.14, 1.3, 0));
    r.add(co(0.08, 0.14, M(0xffd040, { m: 0.8, r: 0.3 }), 0, 1.86, 0, 5));
  }
  update(e) { this.face(-1, 0.4); this.inner.position.y = Math.sin(e.animT * 0.04) * 0.01; }
}

// ================================================================ CHEFES
class UnicornModel extends Model {
  constructor() {
    super();
    const skin = M(0xd6d6de, { r: 0.6 }), shade = M(0x9a9aa6), vest = M(0xb81c1c, { r: 0.7 }), gold = M(0xe0b040, { m: 0.8, r: 0.3 }), horn = M(0xfff4d0);
    const r = this.inner;
    this.hips = piv(r, 0, 1.15, 0);
    this.legs = [];
    for (const z of [0.25, -0.25]) {
      const l = piv(this.hips, 0, 0, z);
      l.add(cap(0.18, 0.42, skin, 0, -0.38, 0));
      const k = piv(l, 0, -0.68, 0);
      k.add(cap(0.15, 0.25, shade, 0, -0.18, 0));
      k.add(bx(0.4, 0.14, 0.3, shade, 0.08, -0.42, 0));
      this.legs.push({ l, k });
    }
    this.hips.add(bx(0.6, 0.3, 0.7, M(0x6a5a50), 0, 0.02, 0));
    this.torso = piv(this.hips, 0, 0.1, 0);
    const t = sp(0.55, skin, 0, 0.55, 0, 10); t.scale.set(0.85, 1, 1.1); this.torso.add(t);
    const v = sp(0.58, vest, 0.02, 0.5, 0, 10); v.scale.set(0.82, 0.85, 1.12); this.torso.add(v);
    for (let i = 0; i < 4; i++) this.torso.add(sp(0.05, gold, 0.46, 0.3 + i * 0.16, 0, 5));
    this.head = piv(this.torso, 0.22, 1.1, 0);
    const h = sp(0.3, skin, 0, 0, 0, 9); h.scale.set(1, 0.95, 1); this.head.add(h);
    this.head.add(sp(0.13, M(0xffffff), 0.24, 0.06, 0, 8));
    this.pupil = sp(0.07, M(0x101010), 0.33, 0.06, 0, 6); this.head.add(this.pupil);
    this.head.add(co(0.08, 0.42, horn, 0.08, 0.38, 0, 6));
    this.jaw = piv(this.head, 0.15, -0.16, 0);
    this.jaw.add(bx(0.32, 0.1, 0.36, shade, 0.02, -0.04, 0));
    this.jaw.add(bx(0.06, 0.06, 0.3, M(0xffffff), 0.17, 0.03, 0));
    this.arms = [];
    for (const z of [0.68, -0.68]) {
      const a = piv(this.torso, 0, 0.9, z);
      a.add(sp(0.22, skin, 0, 0, 0, 8));
      a.add(cap(0.16, 0.4, skin, 0.05, -0.38, 0));
      a.add(sp(0.22, shade, 0.08, -0.78, 0, 8));
      this.arms.push(a);
    }
  }
  update(e) {
    if (e.state !== 'jump') this.face(e.facing, 0.35); else this.face(e.facing, 0.35);
    const st = e.state;
    const s = Math.sin(e.animT * 0.18);
    this.legs.forEach((l, i) => { l.l.rotation.z = 0; l.k.rotation.z = 0; });
    this.torso.rotation.z = 0;
    if (st === 'walk') {
      this.legs[0].l.rotation.z = s * 0.5; this.legs[1].l.rotation.z = -s * 0.5;
      this.legs[0].k.rotation.z = -Math.max(0, -s) * 0.7; this.legs[1].k.rotation.z = -Math.max(0, s) * 0.7;
      this.arms[0].rotation.z = -s * 0.4; this.arms[1].rotation.z = s * 0.4;
      this.hips.position.y = 1.15 + Math.abs(Math.cos(e.animT * 0.18)) * 0.06;
    } else if (st === 'jump') {
      const k = e.t / (e.jumpDur || 40);
      this.legs[0].l.rotation.z = 0.9; this.legs[1].l.rotation.z = 0.5; this.legs[0].k.rotation.z = -1.4; this.legs[1].k.rotation.z = -1.1;
      this.arms[0].rotation.z = 2.4 - k; this.arms[1].rotation.z = 2.2 - k;
      this.hips.position.y = 1.15;
    } else if (st === 'angry') {
      this.arms[0].rotation.z = 2.6 + Math.sin(e.animT * 0.8) * 0.2; this.arms[1].rotation.z = 2.6 - Math.sin(e.animT * 0.8) * 0.2;
      this.torso.rotation.z = 0.15;
      this.hips.position.y = 1.15;
    } else if (st === 'shoot') {
      this.torso.rotation.z = e.t < 10 ? 0.2 : -0.3;
      this.arms[0].rotation.z = 0.4; this.arms[1].rotation.z = 0.4;
      this.hips.position.y = 1.15;
    } else {
      this.arms[0].rotation.z = 0.15 + s * 0.05; this.arms[1].rotation.z = 0.15 - s * 0.05;
      this.hips.position.y = 1.15 + Math.sin(e.animT * 0.06) * 0.02;
    }
    this.jaw.rotation.z = st === 'shoot' && e.t > 6 && e.t < 20 ? -0.6 : st === 'angry' ? -0.4 : -0.05;
  }
}

class DragonModel extends Model {
  constructor(game) {
    super();
    const purple = M(0x6a38b0, { r: 0.5, m: 0.2 }), dark = M(0x3a1a70), horn = M(0xf0d070, { m: 0.5, r: 0.4 }), silver = M(0xc8ccdc, { m: 0.7, r: 0.35 }), red = M(0xd02020);
    this.headG = piv(this.obj);
    const hd = piv(this.headG, 0, 0.6, 0);
    this.hd = hd;
    const skull = bx(0.9, 0.5, 0.6, purple, 0, 0.1, 0); hd.add(skull);
    const snout = bx(0.6, 0.32, 0.44, purple, 0.55, 0.0, 0); hd.add(snout);
    this.jaw = piv(hd, 0.2, -0.18, 0);
    this.jaw.add(bx(0.8, 0.12, 0.4, dark, 0.3, -0.04, 0));
    for (let i = 0; i < 4; i++) { const t = co(0.04, 0.12, M(0xffffff), 0.3 + i * 0.15, 0.05, 0.12, 4); this.jaw.add(t); }
    for (const z of [0.2, -0.2]) {
      const hn = co(0.08, 0.6, horn, -0.25, 0.55, z, 5); hn.rotation.z = 0.7; hd.add(hn);
      hd.add(sp(0.08, M(0xff2020, { e: 0xff1010, ei: 2.5 }), 0.3, 0.25, z * 1.1, 6));
    }
    const fr = co(0.25, 0.5, red, -0.45, 0.1, 0, 4); fr.rotation.z = Math.PI / 2; hd.add(fr);
    this.segs = [];
    this.segMat = silver;
    this.spikeMat = purple;
  }
  ensureSegs(n) {
    while (this.segs.length < n) {
      const g = new THREE.Group();
      const i = this.segs.length;
      const b = sp(0.5, this.segMat, 0, 0, 0, 8); g.add(b);
      for (let k = 0; k < 3; k++) { const s = co(0.12, 0.42, this.spikeMat, (k - 1) * 0.25, 0.48, 0, 4); g.add(s); }
      this.obj.add(g);
      this.segs.push(g);
    }
  }
  update(e) {
    // a cabeça segue a posição lógica; os segmentos usam coordenadas absolutas convertidas
    const n = e.segs.length;
    this.ensureSegs(n);
    this.headG.rotation.y = e.facing > 0 ? -0.3 : Math.PI + 0.3;
    this.headG.rotation.z = Math.atan2(-(e.vy || 0), Math.abs(e.vx || 1)) * (e.facing > 0 ? 1 : 1) * 0.6;
    this.jaw.rotation.z = e.burst ? -0.5 : -0.08 + Math.sin(e.animT * 0.1) * 0.05;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (i >= n) { s.visible = false; continue; }
      s.visible = true;
      const sg = e.segs[i];
      s.position.set((sg.x - e.x) / 16, -(sg.y - 10 - e.y) / 16, -0.2 - i * 0.02);
      const sc = (sg.r / 7) * 0.95;
      s.scale.setScalar(sc);
      s.rotation.z = Math.sin(e.animT * 0.1 + i) * 0.3;
    }
  }
}

class SatanModel extends Model {
  constructor() {
    super();
    const red = M(0xc42418, { r: 0.5 }), dark = M(0x701010), purple = M(0x6a2aa0, { r: 0.55, side: THREE.DoubleSide }), horn = M(0xf0e0b0), gold = M(0xe0a020, { m: 0.8 });
    const r = this.inner;
    this.hips = piv(r, 0, 0.9, 0);
    this.legs = [];
    for (const z of [0.22, -0.22]) { const l = piv(this.hips, 0, 0, z); l.add(cap(0.14, 0.45, red, 0.05, -0.38, 0)); l.add(bx(0.32, 0.1, 0.22, dark, 0.12, -0.82, 0)); this.legs.push(l); }
    this.torso = piv(this.hips, 0, 0.1, 0);
    const t = sp(0.5, red, 0, 0.5, 0, 10); t.scale.set(0.8, 1.05, 1.1); this.torso.add(t);
    this.head = piv(this.torso, 0.2, 1.05, 0);
    this.head.add(sp(0.3, red, 0, 0, 0, 9));
    for (const z of [0.16, -0.16]) {
      const hn = co(0.07, 0.4, horn, -0.05, 0.3, z, 5); hn.rotation.set(z * 2.5, 0, 0.4); this.head.add(hn);
      this.head.add(sp(0.06, M(0xfff040, { e: 0xffd000, ei: 3 }), 0.24, 0.06, z * 0.7, 6));
    }
    this.jaw = piv(this.head, 0.18, -0.12, 0);
    this.jaw.add(bx(0.24, 0.1, 0.34, dark, 0.04, -0.04, 0));
    this.head.add(bx(0.06, 0.05, 0.3, M(0xffffff), 0.27, -0.08, 0));
    this.arms = [];
    for (const z of [0.55, -0.55]) { const a = piv(this.torso, 0.05, 0.8, z); a.add(cap(0.12, 0.42, red, 0.05, -0.3, 0)); a.add(co(0.08, 0.2, horn, 0.12, -0.68, 0, 4)); this.arms.push(a); }
    this.wings = [addWing(this.torso, -0.25, 0.9, 0.28, 1, 2.4, 1.8, purple, 0.4, 4), addWing(this.torso, -0.25, 0.9, -0.28, -1, 2.4, 1.8, purple, 0.4, 4)];
    // asas fechadas envolvem o corpo como um manto
    this.cloak = mesh(G('cloak', () => { const g = new THREE.CylinderGeometry(0.55, 0.85, 1.9, 10, 1, true, -Math.PI * 0.85, Math.PI * 1.7); return g; }), purple, -0.05, 1.0, 0);
    r.add(this.cloak);
    this.torso.add(sp(0.1, gold, 0.36, 0.5, 0, 6));
  }
  update(e) {
    this.face(e.facing, 0.35);
    const w = e.wings ?? 1;
    this.cloak.visible = w < 0.5;
    this.cloak.scale.set(1, 1, 1);
    for (const x of this.wings) x.visible = w >= 0.5;
    const fa = e.state === 'hover' || e.state === 'takeoff' ? 0.5 + Math.sin(e.animT * 0.25) * 0.45 : e.state === 'swoop' ? 0.9 : 0.25;
    for (const x of this.wings) flap(x, fa);
    this.jaw.rotation.z = e.state === 'hover' && e.t % 34 > 14 && e.t % 34 < 26 ? -0.5 : -0.05;
    const s = Math.sin(e.animT * 0.1);
    this.arms[0].rotation.z = e.state === 'swoop' ? 1.8 : 0.4 + s * 0.1;
    this.arms[1].rotation.z = e.state === 'swoop' ? 1.6 : 0.4 - s * 0.1;
    this.torso.rotation.z = e.state === 'swoop' ? -0.6 : 0;
    this.legs[0].rotation.z = e.state === 'guard' ? 0 : 0.5; this.legs[1].rotation.z = e.state === 'guard' ? 0 : 0.2;
  }
}

class AstarothModel extends Model {
  constructor() {
    super();
    const face = M(0x8a58b8, { r: 0.5 }), body = M(0xe6d6b8, { r: 0.6 }), cape = M(0xc8281c, { r: 0.6, side: THREE.DoubleSide }), white = M(0xffffff), hair = M(0xb080e0), gold = M(0xe0b030, { m: 0.8, r: 0.3 });
    const r = this.inner;
    this.hips = piv(r, 0, 1.4, 0);
    this.legs = [];
    for (const z of [0.4, -0.4]) { const l = piv(this.hips, 0, 0, z); l.add(cap(0.25, 0.6, body, 0, -0.6, 0)); l.add(bx(0.6, 0.25, 0.5, M(0xb8b8c8), 0.1, -1.25, 0)); this.legs.push(l); }
    this.torso = piv(this.hips, 0, 0.1, 0);
    const t = sp(0.95, body, 0, 0.9, 0, 12); t.scale.set(0.75, 1, 1.05); this.torso.add(t);
    // rosto da barriga
    this.belly = piv(this.torso, 0.6, 0.65, 0);
    this.belly.add(bx(0.1, 0.24, 0.7, M(0x200808), 0.02, 0, 0));
    for (let i = 0; i < 5; i++) this.belly.add(co(0.04, 0.12, white, 0.05, 0.1, -0.24 + i * 0.12, 4));
    eyes(this.belly, 0.02, 0.32, 0, 0.07, 0xff3010, 0.2);
    // capa
    const cg = mesh(G('cape', () => new THREE.CylinderGeometry(0.9, 1.5, 3.2, 12, 1, true, Math.PI * 0.5, Math.PI)), cape, -0.25, 1.4, 0);
    r.add(cg);
    for (const z of [1.0, -1.0]) { const sh = sp(0.5, cape, 0, 2.65, z * 0.95, 8); sh.scale.set(1, 0.8, 0.9); r.add(sh); }
    this.head = piv(this.torso, 0.15, 2.05, 0);
    const h = sp(0.62, face, 0, 0, 0, 10); h.scale.set(1, 0.9, 1.05); this.head.add(h);
    const hr = sp(0.7, hair, -0.15, 0.2, 0, 9); hr.scale.set(0.9, 0.8, 1.15); this.head.add(hr);
    for (const z of [0.4, -0.4]) {
      const hn = co(0.1, 0.6, M(0xf4ecd0), 0.0, 0.62, z, 5); hn.rotation.set(z * 1.2, 0, 0.3); this.head.add(hn);
      this.head.add(sp(0.1, M(0xfff060, { e: 0xffe000, ei: 3 }), 0.5, 0.15, z * 0.45, 6));
    }
    this.jaw = piv(this.head, 0.35, -0.3, 0);
    this.jaw.add(bx(0.4, 0.18, 0.8, M(0x5a2a80), 0.05, -0.05, 0));
    for (let i = 0; i < 6; i++) this.jaw.add(co(0.05, 0.16, white, 0.22, 0.08, -0.32 + i * 0.13, 4));
    this.head.add(bx(0.3, 0.3, 0.7, M(0x9a70d0), 0.35, -0.42, 0)); // barba
    this.arms = [];
    for (const z of [1.0, -1.0]) { const a = piv(this.torso, 0, 1.5, z); a.add(cap(0.25, 0.7, body, 0.1, -0.5, 0)); a.add(sp(0.3, M(0xb8a888), 0.2, -1.05, 0, 8)); this.arms.push(a); }
    this.torso.add(cy(0.9, 0.9, 0.12, gold, 0, 0.2, 0, 12).rotateZ(0.0));
  }
  update(e) {
    this.face(e.facing, 0.3);
    const s = Math.sin(e.animT * 0.05);
    this.arms[0].rotation.z = 0.5 + s * 0.15; this.arms[1].rotation.z = 0.5 - s * 0.15;
    this.jaw.rotation.z = e.mouthT ? -0.5 : -0.05;
    this.legs[0].rotation.z = s * 0.15; this.legs[1].rotation.z = -s * 0.15;
  }
}

// ================================================================ ITENS e PROJÉTEIS
function weaponMesh(type) {
  const g = new THREE.Group();
  const metal = M(0xdde4f0, { m: 0.9, r: 0.2 }), wood = M(0x7a4a22), gold = M(0xf0c040, { m: 0.9, r: 0.25 });
  if (type === 'lance') {
    const shaft = cy(0.04, 0.04, 1.4, wood, 0, 0, 0, 6); shaft.rotation.z = Math.PI / 2; g.add(shaft);
    const tip = co(0.09, 0.4, metal, 0.85, 0, 0, 6); tip.rotation.z = -Math.PI / 2; g.add(tip);
    const guard = cy(0.08, 0.08, 0.08, gold, 0.6, 0, 0, 6); guard.rotation.z = Math.PI / 2; g.add(guard);
  } else if (type === 'dagger') {
    const blade = co(0.08, 0.6, metal, 0.25, 0, 0, 4); blade.rotation.z = -Math.PI / 2; blade.scale.set(1, 1, 0.3); g.add(blade);
    g.add(bx(0.06, 0.26, 0.06, gold, -0.06, 0, 0));
    g.add(bx(0.22, 0.07, 0.07, wood, -0.2, 0, 0));
  } else if (type === 'torch') {
    g.add(bx(0.5, 0.08, 0.08, wood, 0, 0, 0));
    const f = sp(0.16, M(0xffb040, { e: 0xff8020, ei: 3 }), 0.3, 0.05, 0, 6); g.add(f);
  } else if (type === 'axe') {
    g.add(bx(0.08, 0.6, 0.08, wood, 0, 0, 0));
    const head = mesh(G('axehead', () => { const s = new THREE.Shape(); s.moveTo(0, 0.1); s.quadraticCurveTo(0.35, 0.3, 0.3, 0.05); s.lineTo(0.3, -0.05); s.quadraticCurveTo(0.35, -0.3, 0, -0.1); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); }), metal, 0.03, 0.2, -0.025);
    g.add(head);
  } else if (type === 'cross') {
    const c1 = bx(0.12, 0.6, 0.1, gold, 0, 0, 0); g.add(c1);
    const c2 = bx(0.44, 0.12, 0.1, gold, 0, 0.1, 0); g.add(c2);
    g.add(sp(0.08, M(0xff3030, { e: 0xff2020, ei: 1.5 }), 0, 0.1, 0.06, 6));
  }
  return g;
}

function itemMesh(type) {
  if (['lance', 'dagger', 'torch', 'axe', 'cross'].includes(type)) { const w = weaponMesh(type); w.scale.setScalar(0.9); return w; }
  const g = new THREE.Group();
  const gold = M(0xf0c040, { m: 0.9, r: 0.25, e: 0x302000 });
  switch (type) {
    case 'coin': {
      const c = cy(0.32, 0.32, 0.08, M(0x9a5ad8, { m: 0.6, r: 0.3, e: 0x301050 }), 0, 0.4, 0, 14); c.rotation.x = Math.PI / 2; g.add(c);
      const s = mesh(G('swirl', () => new THREE.TorusGeometry(0.17, 0.035, 4, 14, Math.PI * 1.6)), M(0xe0c0ff, { e: 0x6030a0 }), 0, 0.4, 0.05); g.add(s);
      break;
    }
    case 'bag': {
      const b = sp(0.3, M(0x9a9aa0, { r: 0.8 }), 0, 0.3, 0, 9); b.scale.set(1, 0.95, 0.9); g.add(b);
      g.add(cy(0.08, 0.14, 0.14, M(0x9a9aa0), 0, 0.62, 0, 7));
      g.add(cy(0.1, 0.1, 0.04, M(0xc02020), 0, 0.58, 0, 7));
      const d = bx(0.05, 0.22, 0.04, gold, 0, 0.32, 0.27); g.add(d);
      break;
    }
    case 'necklace': {
      const t = mesh(G('neck', () => new THREE.TorusGeometry(0.25, 0.04, 6, 16)), gold, 0, 0.4, 0); g.add(t);
      g.add(sp(0.1, M(0x40c0ff, { e: 0x2080ff, ei: 1.5 }), 0, 0.15, 0, 6));
      break;
    }
    case 'doll': {
      g.add(co(0.22, 0.45, M(0xd04070), 0, 0.25, 0, 8));
      g.add(sp(0.14, M(0xf0c8a0), 0, 0.56, 0, 8));
      g.add(sp(0.15, M(0x302010), -0.03, 0.62, 0, 7));
      break;
    }
    case 'king': {
      g.add(bx(0.3, 0.5, 0.3, gold, 0, 0.3, 0));
      g.add(sp(0.15, gold, 0, 0.65, 0, 8));
      for (let i = 0; i < 5; i++) g.add(co(0.04, 0.12, gold, Math.cos(i * 1.25) * 0.12, 0.82, Math.sin(i * 1.25) * 0.12, 4));
      break;
    }
    case 'yashichi': {
      const y = new THREE.Group();
      for (let i = 0; i < 4; i++) { const b = mesh(G('yash', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.35, 0.05); s.lineTo(0.25, 0.25); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }); }), M([0xe03030, 0xf0d040, 0x3060e0, 0x30c050][i], { e: [0x601010, 0x605010, 0x102060, 0x105020][i] }), 0, 0, 0); b.rotation.z = i * Math.PI / 2; y.add(b); }
      y.position.y = 0.4; g.add(y); g.userData.spin = y;
      break;
    }
    case 'armor': {
      const a = M(0xc0c8dc, { m: 0.9, r: 0.25 });
      const c = cy(0.3, 0.24, 0.5, a, 0, 0.35, 0, 8); c.scale.z = 1.1; g.add(c);
      g.add(sp(0.13, a, 0, 0.62, 0.32, 6)); g.add(sp(0.13, a, 0, 0.62, -0.32, 6));
      g.add(cy(0.27, 0.27, 0.06, gold, 0, 0.12, 0, 10));
      break;
    }
    case 'key': {
      const k = new THREE.Group();
      k.add(mesh(G('keyring', () => new THREE.TorusGeometry(0.2, 0.06, 6, 14)), gold, 0, 0.35, 0));
      k.add(bx(0.08, 0.6, 0.08, gold, 0, -0.08, 0));
      k.add(bx(0.2, 0.08, 0.08, gold, 0.1, -0.3, 0));
      k.add(bx(0.14, 0.08, 0.08, gold, 0.07, -0.16, 0));
      k.position.y = 0.5; g.add(k); g.userData.spin = k;
      break;
    }
    case 'pot': { const p = potMesh(); p.position.y = 0.25; g.add(p); break; }
  }
  return g;
}

class ItemModel extends Model {
  constructor(type) {
    super();
    this.type = type;
    this.m = itemMesh(type);
    this.inner.add(this.m);
    if (['lance', 'dagger', 'torch', 'axe', 'cross'].includes(type)) { this.m.position.y = 0.45; }
    this.lightReq = { color: type === 'key' ? 0xffd060 : 0xfff0d0, intensity: type === 'key' ? 6 : 2.5, dist: 3.5, oy: 0.6 };
  }
  update(e, dt, time) {
    const spin = time * 2;
    if (this.type === 'coin' || this.type === 'key' || this.type === 'yashichi' || this.type === 'necklace') this.inner.rotation.y = spin;
    else this.inner.rotation.y = Math.sin(time * 1.5) * 0.4;
    if (this.m.userData.spin && this.type === 'yashichi') this.m.userData.spin.rotation.z = time * 6;
    this.inner.position.y = e.onGround ? 0.05 + Math.sin(time * 3 + e.x) * 0.06 : 0;
    // armas piscam como no original
    const blink = ['lance', 'dagger', 'torch', 'axe', 'cross'].includes(this.type) && Math.floor(time * 6) % 2 === 0;
    this.lightReq.intensity = this.type === 'key' ? 7 : blink ? 4 : 1.5;
  }
}

class ShotModel extends Model {
  constructor(type) {
    super();
    this.type = type;
    this.m = weaponMesh(type);
    if (type === 'torch' || type === 'axe' || type === 'cross') this.m.scale.setScalar(1.1);
    this.inner.add(this.m);
    if (type === 'torch') {
      this.lightReq = { color: 0xff8a30, intensity: 6, dist: 6, oy: 0.3 };
      this.fire = new THREE.Group();
      for (let i = 0; i < 3; i++) this.fire.add(co(0.25 - i * 0.05, 0.8 + i * 0.3, M([0xff3a10, 0xff8a20, 0xffd060][i], { e: [0xff2000, 0xff6000, 0xffb000][i], ei: 2.5, t: true, op: 0.8, dw: false }), (i - 1) * 0.2, 0.4, 0, 6));
      this.fire.visible = false;
      this.obj.add(this.fire);
    }
  }
  update(e, dt, time) {
    const dir = e.dir;
    this.inner.rotation.y = dir > 0 ? 0 : Math.PI;
    if (this.type === 'torch' || this.type === 'axe') this.m.rotation.z = -e.t * 0.35;
    if (this.type === 'cross') this.m.rotation.z = -e.t * 0.5;
    if (this.type === 'torch') {
      this.m.visible = !e.burning; this.fire.visible = e.burning;
      if (e.burning) { const k = 1 - e.t / 46; this.fire.scale.set(1.2, 0.6 + k * 0.8 + Math.sin(time * 30) * 0.1, 1); this.lightReq.intensity = 25 * k; }
    }
  }
}

function glowBall(color, r = 0.28, light = true) {
  const g = new THREE.Group();
  g.add(sp(r, M(color, { e: color, ei: 3 }), 0, 0, 0, 8));
  g.add(sp(r * 1.7, M(color, { e: color, ei: 1.5, t: true, op: 0.3, dw: false }), 0, 0, 0, 8));
  return g;
}

class EShotModel extends Model {
  constructor(type) {
    super();
    this.type = type;
    let m;
    switch (type) {
      case 'eyeball': {
        m = new THREE.Group();
        m.add(sp(0.25, M(0xffffff, { e: 0x404040 }), 0, 0, 0, 8));
        m.add(sp(0.13, M(0x2050ff, { e: 0x1030a0 }), 0.15, 0, 0, 6));
        m.add(sp(0.07, M(0x000000), 0.22, 0, 0, 5));
        break;
      }
      case 'fireball': case 'ufire': case 'dfire': case 'afire': m = glowBall(type === 'dfire' ? 0xff6a10 : type === 'afire' ? 0xff3060 : 0xff8a20, type === 'afire' ? 0.42 : 0.3); break;
      case 'orb': m = glowBall(0xb050ff, 0.3); break;
      case 'spell': {
        m = new THREE.Group();
        const t = mesh(G('spellring', () => new THREE.TorusGeometry(0.5, 0.08, 6, 20)), M(0x60ffd0, { e: 0x30ffb0, ei: 3, t: true, op: 0.9 }));
        m.add(t); m.add(sp(0.2, M(0xb0fff0, { e: 0x60ffe0, ei: 3 }), 0, 0, 0, 8));
        break;
      }
      case 'star': {
        m = new THREE.Group();
        for (let i = 0; i < 4; i++) { const b = co(0.1, 0.5, M(0xe0e0ff, { e: 0x8080ff, ei: 2, m: 0.8 }), 0, 0.2, 0, 4); const p = new THREE.Group(); p.add(b); p.rotation.z = i * Math.PI / 2; m.add(p); }
        break;
      }
      case 'flail': {
        m = new THREE.Group();
        m.add(sp(0.28, M(0x5a5a64, { m: 0.8, r: 0.4 }), 0, 0, 0, 7));
        for (let i = 0; i < 8; i++) { const s = co(0.06, 0.2, M(0x9a9aa4, { m: 0.8 }), Math.cos(i * 0.8) * 0.28, Math.sin(i * 0.8) * 0.28, (i % 2 - 0.5) * 0.2, 4); s.rotation.z = i * 0.8 - Math.PI / 2; m.add(s); }
        break;
      }
      case 'spear': case 'spearDown': {
        m = new THREE.Group();
        const s = cy(0.04, 0.04, 0.9, M(0x6ad040), 0, 0, 0, 5); s.rotation.z = Math.PI / 2; m.add(s);
        m.add(sp(0.1, M(0xf4f4e8), -0.45, 0, 0, 6));
        const tip = co(0.06, 0.2, M(0x9ae070), 0.5, 0, 0, 4); tip.rotation.z = -Math.PI / 2; m.add(tip);
        if (type === 'spearDown') m.rotation.z = -Math.PI / 2;
        break;
      }
      default: m = glowBall(0xffffff);
    }
    this.m = m;
    this.inner.add(m);
    const lc = { fireball: 0xff8a20, ufire: 0xff8a20, dfire: 0xff6a10, afire: 0xff3060, orb: 0xb050ff, spell: 0x60ffd0 }[type];
    if (lc) this.lightReq = { color: lc, intensity: 5, dist: 4, oy: 0 };
  }
  update(e, dt, time) {
    if (this.type === 'spear') this.inner.rotation.y = e.vx < 0 ? Math.PI : 0;
    if (this.type === 'star' || this.type === 'flail') this.m.rotation.z = time * 12;
    if (this.type === 'spell') this.m.rotation.y = time * 5;
    if (this.type === 'eyeball') this.m.rotation.z = Math.atan2(-e.vy, e.vx);
    if (this.type.endsWith('fire') || this.type === 'fireball') this.m.scale.setScalar(1 + Math.sin(time * 25) * 0.12);
  }
}

// ================================================================ fábrica
export function createModel(ent) {
  if (ent.kind === 'shot') return new ShotModel(ent.type);
  if (ent.kind === 'eshot') return new EShotModel(ent.type);
  if (ent.kind === 'item') return new ItemModel(ent.type);
  switch (ent.type) {
    case 'zombie': return new ZombieModel();
    case 'crow': return new CrowModel(false);
    case 'raven': return new CrowModel(true);
    case 'plant': return new PlantModel();
    case 'arremer': return new ArremerModel();
    case 'knight': return new KnightModel();
    case 'pig': return new PigModel();
    case 'devil': return new DevilModel(false);
    case 'lavadevil': return new DevilModel(true);
    case 'bigman': return new BigManModel();
    case 'bat': return new BatModel();
    case 'tower': return new TowerModel();
    case 'skeleton': return new SkeletonModel();
    case 'magician': return new MagicianModel();
    case 'firejet': return new FireJetModel();
    case 'princess': return new PrincessModel();
    case 'unicorn': return new UnicornModel();
    case 'dragon': return new DragonModel();
    case 'satan': return new SatanModel();
    case 'astaroth': return new AstarothModel();
  }
  return null;
}

export { weaponMesh };
