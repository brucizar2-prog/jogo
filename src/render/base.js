// Base comum dos modelos: cache de materiais/geometrias, primitivas, asas e a classe Model
// (orientação 3/4 para a câmera, piscar ao levar dano e transparência).
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
export function G(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
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
export function piv(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// asa membranosa (morcego/demônio) desenhada como forma 2D extrudada fina
export function wingGeo(span = 1.2, h = 0.8, fingers = 3) {
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

export function addWing(parent, x, y, z, s, span, h, mat, back = 0.35, fingers = 3) {
  const p = piv(parent, x, y, z);
  const m = mesh(wingGeo(span, h, fingers), mat);
  m.rotation.z = Math.PI / 2 + back;
  m.castShadow = true;
  p.add(m);
  p.userData.s = s;
  return p;
}
// angle: 0 = asa erguida (silhueta completa), ~1.3 = asa abaixada em direção à câmera
export function flap(p, angle) { p.rotation.x = p.userData.s * angle; }

// ---------------------------------------------------------------- base comum
export class Model {
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

// armas do Arthur (na mão, voando e como item)
export function weaponMesh(type) {
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

