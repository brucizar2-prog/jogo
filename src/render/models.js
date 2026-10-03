// Modelos 3D de objetos: torre-monstro, jato de fogo, itens, armas e projéteis.
// Os personagens orgânicos ficam em creatures.js.
import * as THREE from 'three';
import { tex } from './textures.js';
import { M, G, mesh, bx, sp, cy, co, cap, piv, wingGeo, addWing, flap, Model, weaponMesh } from './base.js';
export { M } from './base.js';
import { createCreature, hasCreature } from './creatures.js';

// ================================================================ INIMIGOS
function eyes(parent, x, y, z, r, color = 0xff2020, gap = 0.1) {
  const em = M(color, { e: color, ei: 2.2 });
  parent.add(sp(r, em, x, y, z + gap, 6));
  parent.add(sp(r, em, x, y, z - gap, 6));
}

function potMesh() {
  const g = new THREE.Group();
  const m = M(0x8a5a2a, { r: 0.6 });
  const b = sp(0.2, m, 0, 0, 0, 8); b.scale.set(1, 1.1, 1); g.add(b);
  g.add(cy(0.09, 0.13, 0.14, m, 0, 0.22, 0, 8));
  g.add(cy(0.13, 0.13, 0.04, M(0xd0a040, { m: 0.6, r: 0.3 }), 0, 0.3, 0, 8));
  return g;
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

// ================================================================ ITENS e PROJÉTEIS
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
  if (ent.kind === 'enemy' && hasCreature(ent.type)) return createCreature(ent.type);
  if (ent.kind === 'shot') return new ShotModel(ent.type);
  if (ent.kind === 'eshot') return new EShotModel(ent.type);
  if (ent.kind === 'item') return new ItemModel(ent.type);
  switch (ent.type) {
    case 'tower': return new TowerModel();
    case 'firejet': return new FireJetModel();
  }
  return null;
}

export { weaponMesh };
