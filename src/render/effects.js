// Partículas, fragmentos de armadura e números de pontuação.
import * as THREE from 'three';
import { tex, textTexture } from './textures.js';
import { M, bx, sp } from './base.js';

const MAX = 2400;

class ParticleLayer {
  constructor(blending) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.p = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex('soft') }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize = size*uScale/(-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ vec4 t=texture2D(uMap, gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA); if(gl_FragColor.a<0.01) discard; }`,
      transparent: true, depthWrite: false, blending,
    });
    this.mat = m;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }
  add(o) { if (this.p.length < MAX) this.p.push(o); }
  update(dt) {
    let n = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life -= dt;
      if (q.life <= 0) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); continue; }
      q.vy -= (q.g || 0) * dt;
      q.vx *= q.drag ?? 1; q.vy *= q.drag ?? 1;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += (q.vz || 0) * dt;
    }
    for (const q of this.p) {
      const k = q.life / q.max;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
      const c = q.c2 ? [q.c[0] * k + q.c2[0] * (1 - k), q.c[1] * k + q.c2[1] * (1 - k), q.c[2] * k + q.c2[2] * (1 - k)] : q.c;
      this.col[n * 3] = c[0]; this.col[n * 3 + 1] = c[1]; this.col[n * 3 + 2] = c[2];
      this.size[n] = q.s * (q.grow ? (1 + (1 - k) * q.grow) : 1);
      this.alpha[n] = Math.min(1, k * 2) * (q.a ?? 1);
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
  }
}

const C = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.add = new ParticleLayer(THREE.AdditiveBlending);
    this.norm = new ParticleLayer(THREE.NormalBlending);
    scene.add(this.add.points); scene.add(this.norm.points);
    this.debris = [];
    this.popups = [];
    this.flashes = [];
  }
  clear() {
    this.add.p.length = 0; this.norm.p.length = 0;
    for (const d of this.debris) this.scene.remove(d.m);
    for (const p of this.popups) this.scene.remove(p.s);
    this.debris = []; this.popups = []; this.flashes = [];
  }
  setScale(h) { this.add.mat.uniforms.uScale.value = h; this.norm.mat.uniforms.uScale.value = h; }

  burst(layer, x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * (0.3 + Math.random() * 0.7);
      const up = o.up ?? 0;
      layer.add({ x: x + (Math.random() - 0.5) * (o.spread || 0.2), y: y + (Math.random() - 0.5) * (o.spread || 0.2), z: z + (Math.random() - 0.5) * (o.zs ?? 0.6),
        vx: Math.cos(a) * sp * (o.sx ?? 1), vy: Math.sin(a) * sp * (o.sy ?? 1) + up, vz: (Math.random() - 0.5) * (o.vz ?? 1),
        life: o.life * (0.6 + Math.random() * 0.6), max: o.life * 1.2, s: o.size * (0.6 + Math.random() * 0.8), c: o.c, c2: o.c2, g: o.g || 0, drag: o.drag, grow: o.grow, a: o.a });
    }
  }
  // clarões de luz: não criam luzes novas (isso recompilaria shaders); o renderer usa um pool fixo
  light(x, y, z, color, intensity, life, dist = 8) {
    this.flashes.push({ x, y, z, color, i: intensity, intensity, dist, life, max: life });
  }

  // eventos vindos da lógica (coordenadas do arcade)
  emit(ev) {
    const x = ev.x / 16, y = -ev.y / 16, z = 0.3;
    switch (ev.type) {
      case 'dust': this.burst(this.norm, x, y + 0.1, z, 8, { speed: 1.5, sy: 0.4, up: 0.6, life: 0.5, size: 0.5, c: C(0x9a8a7a), g: 1, drag: 0.94, grow: 1.5, a: 0.6 }); break;
      case 'dirt': this.burst(this.norm, x, y + 0.1, z, 18, { speed: 2.5, sy: 1, up: 2.5, life: 0.8, size: 0.35, c: C(0x6a4a2a), g: 9, a: 0.9 }); break;
      case 'spark': this.burst(this.add, x, y, z, 10, { speed: 6, life: 0.25, size: 0.25, c: C(0xffe8a0), c2: C(0xff6010), g: 6 }); break;
      case 'hit': this.burst(this.add, x, y, z, ev.boss ? 16 : 10, { speed: ev.boss ? 7 : 5, life: 0.3, size: 0.35, c: C(0xffffff), c2: C(0xffa030) }); this.light(x, y, 1, 0xffc070, 12, 0.12); break;
      case 'clink': this.burst(this.add, x, y, z, 8, { speed: 5, life: 0.2, size: 0.25, c: C(0xd0e0ff), c2: C(0x6080ff), g: 4 }); break;
      case 'poof': case 'burst': case 'bigburst': case 'bossburst': {
        const big = ev.type === 'bossburst' ? 3 : ev.type === 'bigburst' ? 2 : ev.type === 'burst' ? 1.3 : 1;
        this.burst(this.add, x, y, z, Math.floor(20 * big), { speed: 4 * big, life: 0.55, size: 0.6 * big, c: C(0xfff0a0), c2: C(0xff3000), drag: 0.9, grow: 1, spread: 0.4 * big });
        this.burst(this.norm, x, y, z, Math.floor(10 * big), { speed: 1.5 * big, up: 1, life: 1.0, size: 0.9 * big, c: C(0x403030), c2: C(0x101010), drag: 0.92, grow: 2, a: 0.7, spread: 0.5 * big });
        this.light(x, y, 1.2, 0xff8030, 30 * big, 0.3, 10 * big);
        break;
      }
      case 'fire': this.burst(this.add, x, y + 0.2, z, 22, { speed: 1.5, sy: 0.5, up: 3, life: 0.6, size: 0.6, c: C(0xffe060), c2: C(0xff2000), drag: 0.95, grow: 0.5 }); break;
      case 'splash': this.burst(this.norm, x, y + 0.2, z, 30, { speed: 3, sy: 0.6, up: 5, life: 0.9, size: 0.35, c: C(0x9ac8ff), g: 12, a: 0.9 }); break;
      case 'deathpuff': this.burst(this.norm, x, y + 1, z, 20, { speed: 1.5, up: 1, life: 1.2, size: 0.9, c: C(0x7a7a8a), drag: 0.93, grow: 2, a: 0.5 }); break;
      case 'pickup': this.burst(this.add, x, y, z, 18, { speed: 3, life: 0.5, size: 0.3, c: C(0xffffa0), c2: C(0x80a0ff) }); this.light(x, y, 1, 0xffffa0, 14, 0.25); break;
      case 'sparkle': this.burst(this.add, x, y, z, 30, { speed: 4, life: 0.8, size: 0.35, c: C(0xffffff), c2: C(0xffd040) }); this.light(x, y, 1, 0xffffff, 20, 0.4); break;
      case 'potbreak': this.burst(this.norm, x, y + 0.3, z, 12, { speed: 3, up: 3, life: 0.6, size: 0.3, c: C(0x8a5a2a), g: 10 }); break;
      case 'magic': case 'transform': this.burst(this.add, x, y, z, 40, { speed: 3, life: 0.9, size: 0.4, c: C(0x80ffd0), c2: C(0x6040ff), drag: 0.95 }); this.light(x, y, 1, 0x60ffc0, 25, 0.6); break;
      case 'vanish': this.burst(this.add, x, y, z, 10, { speed: 2, life: 0.3, size: 0.3, c: C(0xffe080) }); break;
      case 'armorup': this.burst(this.add, x, y, z, 40, { speed: 4, life: 0.8, size: 0.4, c: C(0xd0e0ff), c2: C(0xffffff) }); this.light(x, y, 1, 0xc0d0ff, 25, 0.5); break;
      case 'armorbreak': this.armorBreak(x, y, ev.dir || 1); break;
      case 'score': this.popup(x, y, String(ev.value)); break;
    }
  }

  armorBreak(x, y, dir) {
    const m = M(0xb8c2d6, { m: 0.9, r: 0.26 });
    const pieces = [[0.4, 0.4, 0.4], [0.3, 0.25, 0.3], [0.2, 0.3, 0.2], [0.2, 0.3, 0.2], [0.18, 0.3, 0.2], [0.18, 0.3, 0.2], [0.3, 0.2, 0.3]];
    for (const [w, h, d] of pieces) {
      const mesh = bx(w, h, d, m, 0, 0, 0);
      mesh.position.set(x + (Math.random() - 0.5) * 0.5, y + Math.random() * 1.2, 0.3);
      this.scene.add(mesh);
      this.debris.push({ m: mesh, vx: (Math.random() - 0.5) * 6 + dir * 2, vy: 4 + Math.random() * 5, vz: (Math.random() - 0.2) * 4, rx: Math.random() * 10, ry: Math.random() * 10, life: 1.6 });
    }
    this.burst(this.add, x, y + 1, 0.3, 20, { speed: 5, life: 0.4, size: 0.3, c: C(0xffffff), c2: C(0x8090ff) });
  }

  popup(x, y, text) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(text, '#ffffff', 40), transparent: true, depthTest: false }));
    s.scale.set(3.2, 0.8, 1);
    s.position.set(x, y + 0.5, 1.5);
    s.renderOrder = 20;
    this.scene.add(s);
    this.popups.push({ s, life: 1.0 });
  }

  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vy -= 18 * dt;
      d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
      d.m.rotation.x += d.rx * dt; d.m.rotation.y += d.ry * dt;
      if (d.life <= 0) { this.scene.remove(d.m); this.debris.splice(i, 1); }
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.s.position.y += dt * 1.2;
      p.s.material.opacity = Math.min(1, p.life * 2);
      if (p.life <= 0) { this.scene.remove(p.s); p.s.material.dispose(); this.popups.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      f.intensity = f.i * Math.max(0, f.life / f.max);
      if (f.life <= 0) this.flashes.splice(i, 1);
    }
  }

  // emissões contínuas (fogo das tochas no chão, brasas da lava)
  ambient(game, dt, view) {
    for (const s of game.shots) if (s.burning && Math.random() < 0.7) this.burst(this.add, s.x / 16, -s.y / 16 + 0.2, 0.3, 1, { speed: 0.6, up: 2.5, life: 0.5, size: 0.5, c: C(0xffd060), c2: C(0xff2000), grow: 0.4 });
    for (const e of game.enemies) {
      if (e.type === 'firejet' && e.h > 4 && Math.random() < 0.9) {
        const top = -(e.y - e.h) / 16;
        this.burst(this.add, e.x / 16, top, 0.2, 2, { speed: 0.8, up: 2, life: 0.4, size: 0.7, c: C(0xffe070), c2: C(0xff2000), grow: 0.5 });
      }
    }
    for (const s of game.eshots) {
      if ((s.type.endsWith('fire') || s.type === 'fireball') && Math.random() < 0.6) this.burst(this.add, s.x / 16, -s.y / 16, 0.2, 1, { speed: 0.3, life: 0.3, size: 0.35, c: C(0xffa040), c2: C(0xff2000) });
      if (s.type === 'orb' || s.type === 'spell') if (Math.random() < 0.5) this.burst(this.add, s.x / 16, -s.y / 16, 0.2, 1, { speed: 0.3, life: 0.35, size: 0.3, c: s.type === 'orb' ? C(0xc080ff) : C(0x80ffe0) });
    }
    if (game.data.theme === 'lava' && Math.random() < 0.5) {
      const x = view.x0 / 16 + Math.random() * (view.x1 - view.x0) / 16;
      this.burst(this.add, x, -13, -1 + Math.random() * 3, 1, { speed: 0.4, up: 2 + Math.random() * 2, life: 2, size: 0.18, c: C(0xffa040), c2: C(0xff2000) });
    }
    if ((game.data.theme === 'cave' || game.data.theme === 'tower' || game.data.theme === 'castle') && Math.random() < 0.25) {
      const x = view.x0 / 16 + Math.random() * (view.x1 - view.x0) / 16;
      const y = -view.y0 / 16 - Math.random() * 14;
      this.norm.add({ x, y, z: -2 + Math.random() * 4, vx: (Math.random() - 0.5) * 0.2, vy: -0.1, vz: 0, life: 4, max: 4, s: 0.08, c: C(0xc0b0a0), a: 0.5 });
    }
  }
}
