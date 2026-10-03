// Animação dos gigantes: Ciclope ("unicorn"), Big Man, Astaroth e Dragão (lado 'R' = +z).
import * as THREE from 'three';
import { OrganicModel, staticSpecies, rmat } from './core.js';
import { DRAGON_HEAD_SCALE } from '../species/giants.js';

// ------------------------------------------------------------------ CICLOPE (Unicórnio)
class UnicornO extends OrganicModel {
  constructor() { super('unicorn'); }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B, st = e.state;
    const s = Math.sin(e.animT * 0.18);
    B['upperarm.R'].rotation.x = 0.08; B['upperarm.L'].rotation.x = -0.08;
    B.spine.rotation.z = -0.08; B.chest.rotation.z = -0.06;
    if (st === 'walk') {
      B['thigh.R'].rotation.z = s * 0.5; B['thigh.L'].rotation.z = -s * 0.5;
      B['shin.R'].rotation.z = -Math.max(0, -s) * 0.7; B['shin.L'].rotation.z = -Math.max(0, s) * 0.7;
      B['foot.R'].rotation.z = Math.max(0, -s) * 0.25; B['foot.L'].rotation.z = Math.max(0, s) * 0.25;
      B['upperarm.R'].rotation.z = -s * 0.4; B['upperarm.L'].rotation.z = s * 0.4;
      B['forearm.R'].rotation.z = 0.25 + Math.max(0, s) * 0.3; B['forearm.L'].rotation.z = 0.25 + Math.max(0, -s) * 0.3;
      B.hips.position.y += Math.abs(Math.cos(e.animT * 0.18)) * 0.04 - 0.02;
      B.chest.rotation.y = -s * 0.1;
    } else if (st === 'jump' || st === 'fall') {
      const k = st === 'jump' ? Math.min(1, e.t / (e.jumpDur || 40)) : 1;
      B['thigh.R'].rotation.z = 0.9; B['thigh.L'].rotation.z = 0.5; B['shin.R'].rotation.z = -1.4; B['shin.L'].rotation.z = -1.1;
      B['foot.R'].rotation.z = 0.4; B['foot.L'].rotation.z = 0.3;
      B['upperarm.R'].rotation.z = 2.4 - k; B['upperarm.L'].rotation.z = 2.2 - k;
      B['forearm.R'].rotation.z = 0.5; B['forearm.L'].rotation.z = 0.5;
    } else if (st === 'angry') {
      B['upperarm.R'].rotation.z = 2.6 + Math.sin(e.animT * 0.8) * 0.2; B['upperarm.L'].rotation.z = 2.6 - Math.sin(e.animT * 0.8) * 0.2;
      B['forearm.R'].rotation.z = 0.5; B['forearm.L'].rotation.z = 0.5;
      B['upperarm.R'].rotation.x = 0.3; B['upperarm.L'].rotation.x = -0.3;
      B.chest.rotation.z = 0.15; B.head.rotation.z = 0.15;
    } else if (st === 'shoot') {
      B.chest.rotation.z = e.t < 10 ? 0.2 : -0.3;
      B.head.rotation.z = e.t < 10 ? 0.15 : -0.1;
      B['upperarm.R'].rotation.z = 0.4; B['upperarm.L'].rotation.z = 0.4;
      B['forearm.R'].rotation.z = 0.4; B['forearm.L'].rotation.z = 0.4;
    } else {
      B['upperarm.R'].rotation.z = 0.15 + s * 0.05; B['upperarm.L'].rotation.z = 0.15 - s * 0.05;
      B['forearm.R'].rotation.z = 0.2; B['forearm.L'].rotation.z = 0.2;
      B.hips.position.y += Math.sin(e.animT * 0.06) * 0.015;
    }
    B.jaw.rotation.z = st === 'shoot' && e.t > 6 && e.t < 20 ? -0.6 : st === 'angry' ? -0.4 : -0.05;
  }
}

// ------------------------------------------------------------------ BIG MAN (ogro do mangual)
class BigManO extends OrganicModel {
  constructor() {
    super('bigman');
    this.flail = this.parts.flail;
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B;
    const moving = Math.abs(e.vx) > 0;
    const sp = e.state === 'charge' ? 0.22 : 0.12;
    const s = Math.sin(e.animT * sp);
    B['thigh.R'].rotation.z = moving ? s * 0.45 : 0; B['thigh.L'].rotation.z = moving ? -s * 0.45 : 0;
    B['shin.R'].rotation.z = moving ? -Math.max(0, -s) * 0.6 : 0; B['shin.L'].rotation.z = moving ? -Math.max(0, s) * 0.6 : 0;
    B.hips.position.y += moving ? Math.abs(Math.cos(e.animT * sp)) * 0.04 - 0.02 : 0;
    B.spine.rotation.z = -0.1; B.chest.rotation.z = -0.08 + (moving ? Math.abs(s) * 0.04 : 0);
    B['upperarm.R'].rotation.x = 0.1; B['upperarm.L'].rotation.x = -0.1;
    const ball = this.flail.userData.ball;
    if (e.state === 'throw') {
      // gira o mangual por trás e por cima da cabeça e solta no t=14
      const k = Math.min(1, e.t / 14);
      B['upperarm.R'].rotation.z = -2.4 + k * 4; B['forearm.R'].rotation.z = 0.4;
      this.flail.visible = e.t < 14;
      this.flail.rotation.z = -0.35 - (1 - k) * 0.3;
    } else {
      // segura o cabo à frente; a corrente pende e balança com o passo
      B['upperarm.R'].rotation.z = 0.15 - s * 0.25; B['forearm.R'].rotation.z = 0.95;
      this.flail.visible = true;
      this.flail.rotation.z = -1.0 + Math.sin(e.animT * sp - 0.9) * (moving ? 0.35 : 0.08);
      this.flail.rotation.x = Math.cos(e.animT * sp * 0.5) * 0.1;
    }
    if (ball) ball.rotation.y = e.animT * 0.05;
    B['upperarm.L'].rotation.z = s * 0.4; B['forearm.L'].rotation.z = 0.3;
    B.jaw.rotation.z = e.state === 'throw' ? -0.35 : -0.08;
  }
}

// ------------------------------------------------------------------ ASTAROTH (chefe final)
class AstarothO extends OrganicModel {
  constructor() { super('astaroth'); }
  update(e) {
    this.face(e.facing, 0.3);
    this.resetPose();
    const B = this.B;
    const s = Math.sin(e.animT * 0.05);
    // postura curvada, braços pendendo à frente com as garras abertas
    B.spine.rotation.z = -0.06; B.chest.rotation.z = -0.08 + s * 0.03;
    B.neck.rotation.z = 0.06;
    // (balanço lento como no original, mas com os braços mais junto ao corpo para caber no hitbox)
    B['upperarm.R'].rotation.z = 0.22 + s * 0.12; B['upperarm.L'].rotation.z = 0.22 - s * 0.12;
    B['upperarm.R'].rotation.x = 0.1; B['upperarm.L'].rotation.x = -0.1;
    B['forearm.R'].rotation.z = 0.55; B['forearm.L'].rotation.z = 0.55;
    B['thigh.R'].rotation.z = 0.12 + s * 0.15; B['thigh.L'].rotation.z = 0.12 - s * 0.15;
    B['shin.R'].rotation.z = -0.22 - Math.max(0, s) * 0.15; B['shin.L'].rotation.z = -0.22 - Math.max(0, -s) * 0.15;
    B['foot.R'].rotation.z = 0.1; B['foot.L'].rotation.z = 0.1;
    B.hips.position.y -= 0.02 + Math.abs(s) * 0.015;
    // bocas: a da cabeça e a da barriga abrem juntas quando ele cospe fogo
    const open = e.mouthT ? Math.min(1, e.mouthT / 6) : 0;
    B.jaw.rotation.z = e.mouthT ? -0.45 * Math.max(0.6, open) : -0.04;
    B.bellyjaw.rotation.z = e.mouthT ? -0.35 * Math.max(0.6, open) : -0.03 + Math.sin(e.animT * 0.07) * 0.03;
    B.head.rotation.z = e.mouthT ? -0.08 : Math.sin(e.animT * 0.031) * 0.04;
  }
}

// ------------------------------------------------------------------ DRAGÃO
const TAIL_GEO = new THREE.ConeGeometry(0.2, 0.75, 10);
TAIL_GEO.rotateZ(Math.PI / 2);
TAIL_GEO.translate(-0.62, 0.02, 0);
class DragonO extends OrganicModel {
  constructor() {
    super('dragonhead');
    // a cabeça inclina em torno do próprio centro conforme sobe/desce
    this.headPivot = new THREE.Group();
    this.obj.add(this.headPivot);
    this.headPivot.add(this.inner);
    this.inner.position.y = -0.62 * DRAGON_HEAD_SCALE;
    this.headPivot.position.y = 0.625;
    this.segs = [];
    this.tail = new THREE.Mesh(TAIL_GEO, rmat('horn', 0xd8b878));
    this.tail.castShadow = true;
  }
  ensureSegs(n) {
    while (this.segs.length < n) {
      const g = staticSpecies('dragonseg');
      this.obj.add(g);
      this.segs.push(g);
    }
  }
  update(e) {
    const n = e.segs.length;
    this.ensureSegs(n);
    this.resetPose();
    this.inner.rotation.y = e.facing > 0 ? -0.3 : Math.PI + 0.3;
    this.headPivot.rotation.z = Math.atan2(-(e.vy || 0), Math.abs(e.vx || 1)) * 0.6 * (e.facing > 0 ? 1 : -1);
    this.B.jaw.rotation.z = e.burst ? -0.42 : -0.06 + Math.sin(e.animT * 0.1) * 0.05;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (i >= n) { s.visible = false; continue; }
      s.visible = true;
      const sg = e.segs[i];
      s.position.set((sg.x - e.x) / 16, -(sg.y - 10 - e.y) / 16, -0.2 - i * 0.02);
      // orienta pelo sentido do corpo (em direção à cabeça), espelhando em vez de virar de ponta-cabeça
      const next = e.segs[i - 1] || { x: e.x, y: e.y + 10 };
      const dx = next.x - sg.x, dyw = -(next.y - sg.y);
      const ang = Math.atan2(dyw, Math.abs(dx) + 1e-6);
      const sc = (sg.r / 7) * 0.95;
      s.scale.set(dx < 0 ? -sc : sc, sc, sc);
      s.rotation.z = dx < 0 ? -ang : ang;
    }
    // ponta da cauda no último segmento
    const last = n ? this.segs[n - 1] : null;
    if (last && this.tail.parent !== last) last.add(this.tail);
    this.tail.visible = !!last;
  }
}

export const CREATURES = {
  unicorn: { keys: ['unicorn'], make: () => new UnicornO() },
  bigman: { keys: ['bigman'], make: () => new BigManO() },
  astaroth: { keys: ['astaroth'], make: () => new AstarothO() },
  dragon: { keys: ['dragonhead', 'dragonseg'], make: () => new DragonO() },
};
