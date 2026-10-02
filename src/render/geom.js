// Construtor de geometria mesclada com UVs em coordenadas de mundo (texturas contínuas entre blocos).
import * as THREE from 'three';

export class GeoBuilder {
  constructor() { this.groups = new Map(); }
  g(key) {
    let g = this.groups.get(key);
    if (!g) { g = { pos: [], nor: [], uv: [], col: [] }; this.groups.set(key, g); }
    return g;
  }
  // quad com 4 vértices (sentido anti-horário visto pela frente)
  quad(key, a, b, c, d, n, uvs, col) {
    const g = this.g(key);
    const vs = [a, b, c, a, c, d];
    const us = [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]];
    for (let i = 0; i < 6; i++) {
      g.pos.push(vs[i][0], vs[i][1], vs[i][2]);
      g.nor.push(n[0], n[1], n[2]);
      g.uv.push(us[i][0], us[i][1]);
      const cc = col || [1, 1, 1];
      g.col.push(cc[0], cc[1], cc[2]);
    }
  }
  // caixa alinhada; faces: {front, top, bottom, left, right, back} -> chave de material ou null
  box(x0, y0, z0, x1, y1, z1, faces, s = 0.25, col) {
    const f = faces;
    if (f.front) this.quad(f.front, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[x0 * s, y0 * s], [x1 * s, y0 * s], [x1 * s, y1 * s], [x0 * s, y1 * s]], col);
    if (f.back) this.quad(f.back, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[x1 * s, y0 * s], [x0 * s, y0 * s], [x0 * s, y1 * s], [x1 * s, y1 * s]], col);
    if (f.top) this.quad(f.top, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]], col);
    if (f.bottom) this.quad(f.bottom, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], col);
    if (f.left) this.quad(f.left, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[z0 * s, y0 * s], [z1 * s, y0 * s], [z1 * s, y1 * s], [z0 * s, y1 * s]], col);
    if (f.right) this.quad(f.right, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[z1 * s, y0 * s], [z0 * s, y0 * s], [z0 * s, y1 * s], [z1 * s, y1 * s]], col);
  }
  build(materials, opts = {}) {
    const group = new THREE.Group();
    for (const [key, g] of this.groups) {
      if (!g.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
      geo.computeBoundingSphere();
      const mat = materials[key] || materials.default;
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = opts.receiveShadow !== false;
      m.castShadow = !!opts.castShadow;
      m.name = key;
      group.add(m);
    }
    return group;
  }
}

// mescla retângulos de tiles iguais (horizontal e depois vertical)
export function greedyRects(w, h, pred) {
  const used = new Uint8Array(w * h);
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (used[y * w + x] || !pred(x, y)) continue;
      let x1 = x;
      while (x1 + 1 < w && !used[y * w + x1 + 1] && pred(x1 + 1, y)) x1++;
      let y1 = y;
      outer: while (y1 + 1 < h) {
        for (let k = x; k <= x1; k++) if (used[(y1 + 1) * w + k] || !pred(k, y1 + 1)) break outer;
        y1++;
      }
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) used[yy * w + xx] = 1;
      out.push({ x0: x, y0: y, x1: x1 + 1, y1: y1 + 1 });
    }
  }
  return out;
}

// gerador pseudoaleatório local para decoração (determinístico)
export function prng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
