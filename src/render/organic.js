// Escultura orgânica procedural (sem dependência de three.js — roda também em Web Worker).
// Os personagens são definidos como funções de distância (SDF): elipsoides, membros afunilados,
// caixas arredondadas e toros fundidos com "smooth union", com entalhes (primitivas negativas),
// cortes (bainhas rasgadas) e rugosidade por ruído. A superfície é extraída com surface nets,
// recebe pesos de pele por osso, cor por região, oclusão ambiente e sombreamento de cavidades,
// e pode ser simplificada (meshoptimizer) preservando a silhueta e as bordas de cor.

// ------------------------------------------------------------------ primitivas
function invRot(rot) {
  if (!rot) return null;
  const [ax, ay, az] = rot;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
  const m = [
    cy * cz, -cy * sz, sy,
    cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
    sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
  ];
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

// cone arredondado entre a e b com raios r1 e r2 (membros, dedos, chifres)
export function roundCone(a, b, r1, r2) {
  const [ax, ay, az] = a;
  const bax = b[0] - ax, bay = b[1] - ay, baz = b[2] - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const len = Math.sqrt(l2);
  if (len < 1e-6) return sphere(a, Math.max(r1, r2));
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const srr = Math.sign(rr) * rr * rr;
  return {
    cx: ax + bax / 2, cy: ay + bay / 2, cz: az + baz / 2, R: len / 2 + Math.max(r1, r2),
    f(x, y, z) {
      const pax = x - ax, pay = y - ay, paz = z - az;
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yy * yy * l2, z2 = zz * zz * l2;
      const k = srr * x2;
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
    },
  };
}

export function sphere(c, r) {
  const [cx, cy, cz] = c;
  return { cx, cy, cz, R: r, f: (x, y, z) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy) + (z - cz) * (z - cz)) - r };
}

export function ellipsoid(c, r, rot) {
  const [cx, cy, cz] = c, [rx, ry, rz] = r;
  const m = invRot(rot);
  const minR = Math.min(rx, ry, rz);
  const irx = 1 / rx, iry = 1 / ry, irz = 1 / rz;
  return {
    cx, cy, cz, R: Math.max(rx, ry, rz),
    f(x, y, z) {
      let px = x - cx, py = y - cy, pz = z - cz;
      if (m) { const qx = m[0] * px + m[1] * py + m[2] * pz, qy = m[3] * px + m[4] * py + m[5] * pz, qz = m[6] * px + m[7] * py + m[8] * pz; px = qx; py = qy; pz = qz; }
      const ax = px * irx, ay = py * iry, az = pz * irz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax * irx, by = ay * iry, bz = az * irz;
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      return k1 < 1e-9 ? -minR : (k0 * (k0 - 1)) / k1;
    },
  };
}

export function roundBox(c, half, round, rot) {
  const [cx, cy, cz] = c, [hx, hy, hz] = half;
  const m = invRot(rot);
  return {
    cx, cy, cz, R: Math.sqrt(hx * hx + hy * hy + hz * hz),
    f(x, y, z) {
      let px = x - cx, py = y - cy, pz = z - cz;
      if (m) { const qx = m[0] * px + m[1] * py + m[2] * pz, qy = m[3] * px + m[4] * py + m[5] * pz, qz = m[6] * px + m[7] * py + m[8] * pz; px = qx; py = qy; pz = qz; }
      const qx = Math.abs(px) - hx + round, qy = Math.abs(py) - hy + round, qz = Math.abs(pz) - hz + round;
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - round;
    },
  };
}

// anel no plano XZ local (rot para orientar)
export function torus(c, R, r, rot) {
  const [cx, cy, cz] = c;
  const m = invRot(rot);
  return {
    cx, cy, cz, R: R + r,
    f(x, y, z) {
      let px = x - cx, py = y - cy, pz = z - cz;
      if (m) { const qx = m[0] * px + m[1] * py + m[2] * pz, qy = m[3] * px + m[4] * py + m[5] * pz, qz = m[6] * px + m[7] * py + m[8] * pz; px = qx; py = qy; pz = qz; }
      const q = Math.sqrt(px * px + pz * pz) - R;
      return Math.sqrt(q * q + py * py) - r;
    },
  };
}

export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// ------------------------------------------------------------------ ruído de valor 3D
function hash3(i, j, k) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) & 0xffff) / 65535;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = hash3(xi, yi, zi), b = hash3(xi + 1, yi, zi), c = hash3(xi, yi + 1, zi), d = hash3(xi + 1, yi + 1, zi);
  const e = hash3(xi, yi, zi + 1), f = hash3(xi + 1, yi, zi + 1), g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
  const x1 = a + (b - a) * fx, x2 = c + (d - c) * fx, x3 = e + (f - e) * fx, x4 = g + (h - g) * fx;
  const y1 = x1 + (x2 - x1) * fy, y2 = x3 + (x4 - x3) * fy;
  return y1 + (y2 - y1) * fz;
}
export function fbm3(x, y, z, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.07; }
  return s / n;
}

// ------------------------------------------------------------------ grade de aceleração
// Para cada célula da grade guarda só as primitivas que podem influenciar pontos dentro dela.
function makeAccel(prims, margin) {
  if (!prims.length) return null;
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (const p of prims) {
    const r = p.R + (p.k || 0) + margin;
    x0 = Math.min(x0, p.cx - r); y0 = Math.min(y0, p.cy - r); z0 = Math.min(z0, p.cz - r);
    x1 = Math.max(x1, p.cx + r); y1 = Math.max(y1, p.cy + r); z1 = Math.max(z1, p.cz + r);
  }
  const span = Math.max(x1 - x0, y1 - y0, z1 - z0);
  const gs = Math.max(span / 28, 0.02);
  const nx = Math.ceil((x1 - x0) / gs) + 1, ny = Math.ceil((y1 - y0) / gs) + 1, nz = Math.ceil((z1 - z0) / gs) + 1;
  const lists = new Array(nx * ny * nz);
  for (let i = 0; i < lists.length; i++) lists[i] = null;
  prims.forEach((p) => {
    const r = p.R + (p.k || 0) + margin;
    const ia = Math.max(0, Math.floor((p.cx - r - x0) / gs)), ib = Math.min(nx - 1, Math.floor((p.cx + r - x0) / gs));
    const ja = Math.max(0, Math.floor((p.cy - r - y0) / gs)), jb = Math.min(ny - 1, Math.floor((p.cy + r - y0) / gs));
    const ka = Math.max(0, Math.floor((p.cz - r - z0) / gs)), kb = Math.min(nz - 1, Math.floor((p.cz + r - z0) / gs));
    for (let k = ka; k <= kb; k++) for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
      // distância do centro da primitiva à caixa da célula
      const bx0 = x0 + i * gs, by0 = y0 + j * gs, bz0 = z0 + k * gs;
      const dx = Math.max(bx0 - p.cx, 0, p.cx - (bx0 + gs)), dy = Math.max(by0 - p.cy, 0, p.cy - (by0 + gs)), dz = Math.max(bz0 - p.cz, 0, p.cz - (bz0 + gs));
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const id = i + nx * (j + ny * k);
      (lists[id] || (lists[id] = [])).push(p);
    }
  });
  return { x0, y0, z0, gs, nx, ny, nz, lists };
}
function cellList(A, x, y, z) {
  const i = Math.floor((x - A.x0) / A.gs), j = Math.floor((y - A.y0) / A.gs), k = Math.floor((z - A.z0) / A.gs);
  if (i < 0 || j < 0 || k < 0 || i >= A.nx || j >= A.ny || k >= A.nz) return null;
  return A.lists[i + A.nx * (j + A.ny * k)];
}

// SDF de uma camada: união suave das positivas, menos as negativas, cortes e rugosidade
export const FAR = 0.13;
export function layerSDF(prims, opts = {}) {
  const pos = prims.filter((p) => !p.neg), neg = prims.filter((p) => p.neg);
  const margin = FAR + (opts.rough ? opts.rough.amp : 0);
  const AP = makeAccel(pos, margin), AN = makeAccel(neg, margin);
  const cuts = opts.cuts || [];
  const rough = opts.rough;
  return (x, y, z) => {
    const lp = AP && cellList(AP, x, y, z);
    if (!lp) return margin;
    let d = 1e9;
    for (let i = 0; i < lp.length; i++) {
      const p = lp[i];
      if (d < 1e8) {
        const dx = x - p.cx, dy = y - p.cy, dz = z - p.cz;
        const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.R;
        if (lb > d + p.k) continue;       // não pode alterar o resultado
      }
      d = smin(d, p.f(x, y, z), p.k);
    }
    if (d > margin) return margin;
    if (AN) {
      const ln = cellList(AN, x, y, z);
      if (ln) for (let i = 0; i < ln.length; i++) d = -smin(-d, ln[i].f(x, y, z), ln[i].k);
    }
    for (let i = 0; i < cuts.length; i++) { const c = cuts[i](x, y, z); if (c > d) d = c; }
    if (rough && d < rough.amp * 3) d += rough.amp * (noise3(x * rough.freq, y * rough.freq, z * rough.freq) - 0.5) * 2;
    return d;
  };
}

// ------------------------------------------------------------------ surface nets
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

export function surfaceNets(sdf, min, max, cell) {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const vals = new Float32Array(nx * ny * nz).fill(NaN);
  const id = (i, j, k) => i + nx * (j + ny * k);
  // passo grosso (blocos de S células): blocos inteiramente longe da superfície são pulados
  const S = 4, gx = Math.ceil((nx - 1) / S) + 1, gy = Math.ceil((ny - 1) / S) + 1, gz = Math.ceil((nz - 1) / S) + 1;
  const coarse = new Float32Array(gx * gy * gz);
  for (let k = 0; k < gz; k++) for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    coarse[i + gx * (j + gy * k)] = sdf(min[0] + i * S * cell, min[1] + j * S * cell, min[2] + k * S * cell);
  }
  const reach = Math.min(S * cell * 1.5, FAR * 0.9);
  const val = (i, j, k) => {
    const n = id(i, j, k);
    let v = vals[n];
    if (v !== v) {
      const c = coarse[Math.round(i / S) + gx * (Math.round(j / S) + gy * Math.round(k / S))];
      v = Math.abs(c) > reach ? c : sdf(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);
      vals[n] = v;
    }
    return v;
  };
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  // blocos ativos
  const blocks = [];
  for (let bk = 0; bk < gz - 1; bk++) for (let bj = 0; bj < gy - 1; bj++) for (let bi = 0; bi < gx - 1; bi++) {
    let neg = 0, near = false;
    for (let c = 0; c < 8; c++) {
      const v = coarse[(bi + (c & 1)) + gx * ((bj + ((c >> 1) & 1)) + gy * (bk + ((c >> 2) & 1)))];
      if (v < 0) neg++;
      if (Math.abs(v) <= reach) near = true;
    }
    if (near || (neg > 0 && neg < 8)) blocks.push(bi, bj, bk);
  }
  const cellV = new Int32Array(cx * cy * cz).fill(-1);
  const cid = (i, j, k) => i + cx * (j + cy * k);
  const P = [];
  const v8 = new Float32Array(8);
  for (let b = 0; b < blocks.length; b += 3) {
    const i0 = blocks[b] * S, j0 = blocks[b + 1] * S, k0 = blocks[b + 2] * S;
    for (let k = k0; k < Math.min(k0 + S, cz); k++) for (let j = j0; j < Math.min(j0 + S, cy); j++) for (let i = i0; i < Math.min(i0 + S, cx); i++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) {
        const o = CORNERS[c];
        const v = val(i + o[0], j + o[1], k + o[2]);
        v8[c] = v;
        if (v < 0) mask |= 1 << c;
      }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, bb] of EDGES) {
        const va = v8[a], vb = v8[bb];
        if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        const A = CORNERS[a], B = CORNERS[bb];
        sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t;
        n++;
      }
      cellV[cid(i, j, k)] = P.length / 3;
      P.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
    }
  }
  const cv = (i, j, k) => cellV[cid(i, j, k)];
  // refina os vértices projetando-os na superfície; o gradiente serve de normal suave
  const nv = P.length / 3;
  const pos = new Float32Array(P);
  const nor = new Float32Array(nv * 3);
  const h = cell * 0.25;
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const ox = x, oy = y, oz = z;
    const d = sdf(x, y, z);
    let gx = sdf(x + h, y, z) - sdf(x - h, y, z);
    let gy = sdf(x, y + h, z) - sdf(x, y - h, z);
    let gz = sdf(x, y, z + h) - sdf(x, y, z - h);
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (gl > 1e-9) {
      gx /= gl; gy /= gl; gz /= gl;
      x = Math.max(ox - cell, Math.min(ox + cell, x - d * gx));
      y = Math.max(oy - cell, Math.min(oy + cell, y - d * gy));
      z = Math.max(oz - cell, Math.min(oz + cell, z - d * gz));
    } else { gx = 0; gy = 1; gz = 0; }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
  }
  const I = [];
  // concordância entre a normal geométrica de um triângulo e as normais (gradiente) dos vértices
  const agree = (a, b, c) => {
    const e1x = pos[b * 3] - pos[a * 3], e1y = pos[b * 3 + 1] - pos[a * 3 + 1], e1z = pos[b * 3 + 2] - pos[a * 3 + 2];
    const e2x = pos[c * 3] - pos[a * 3], e2y = pos[c * 3 + 1] - pos[a * 3 + 1], e2z = pos[c * 3 + 2] - pos[a * 3 + 2];
    const qx = e1y * e2z - e1z * e2y, qy = e1z * e2x - e1x * e2z, qz = e1x * e2y - e1y * e2x;
    const l = Math.sqrt(qx * qx + qy * qy + qz * qz);
    if (l < 1e-14) return 0;
    const mx = nor[a * 3] + nor[b * 3] + nor[c * 3], my = nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1], mz = nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2];
    return (qx * mx + qy * my + qz * mz) / l;
  };
  // orientação pela topologia (lado de dentro/fora ao longo do eixo); diagonal que não dobra
  const quad = (a, b, c, d, axis, outPositive) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    let B = b, D = d;
    if ((axis !== 1) !== outPositive) { B = d; D = b; }
    const s1 = Math.min(agree(a, B, c), agree(a, c, D)), s2 = Math.min(agree(a, B, D), agree(B, c, D));
    if (s1 >= s2) I.push(a, B, c, a, c, D);
    else I.push(a, B, D, B, c, D);
  };
  for (let b = 0; b < blocks.length; b += 3) {
    const i0 = blocks[b] * S, j0 = blocks[b + 1] * S, k0 = blocks[b + 2] * S;
    for (let k = k0; k < Math.min(k0 + S, nz); k++) for (let j = j0; j < Math.min(j0 + S, ny); j++) for (let i = i0; i < Math.min(i0 + S, nx); i++) {
      const in0 = val(i, j, k) < 0;
      if (i < cx && j > 0 && k > 0 && j < cy && k < cz && in0 !== (val(i + 1, j, k) < 0)) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), 0, in0);
      if (j < cy && i > 0 && k > 0 && i < cx && k < cz && in0 !== (val(i, j + 1, k) < 0)) quad(cv(i - 1, j, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i - 1, j, k), 1, in0);
      if (k < cz && i > 0 && j > 0 && i < cx && j < cy && in0 !== (val(i, j, k + 1) < 0)) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), 2, in0);
    }
  }
  return { positions: pos, normals: nor, indices: new Uint32Array(I) };
}

// ------------------------------------------------------------------ espécie (malhas + pesos + cores)
// spec = { bones: [[nome, pai, x, y, z], ...], cell, layers: [{ name, mat, cell, prims, pattern, cuts, rough, cavity }] }
// prim = primitiva + { bone, k, col: [r,g,b] linear, neg }
// opts = { quality: 1 (alta) .. 2 (baixa), simplifier: MeshoptSimplifier pronto, ratio }
export function buildSpecies(spec, opts = {}) {
  const q = opts.quality || 1;
  const layers = spec.layers;
  const sdfs = layers.map((l) => layerSDF(l.prims, l));
  // SDF da cena para a oclusão ambiente: camadas com 'set' (ex.: 'armored'/'naked') só sombreiam
  // as do mesmo conjunto; camadas sem 'set' estão sempre presentes
  const sceneFor = (L) => {
    const list = sdfs.filter((_, i) => !layers[i].set || layers[i].set === L.set);
    return (x, y, z) => { let d = 1e9; for (let i = 0; i < list.length; i++) { const v = list[i](x, y, z); if (v < d) d = v; } return d; };
  };
  const boneIndex = new Map(spec.bones.map((b, i) => [b[0], i]));
  const out = [];
  layers.forEach((L, li) => {
    const sdf = sdfs[li];
    const scene = sceneFor(L);
    const cell = (L.cell || spec.cell || 0.025) * q;
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of L.prims) {
      if (p.neg) continue;
      mn[0] = Math.min(mn[0], p.cx - p.R); mn[1] = Math.min(mn[1], p.cy - p.R); mn[2] = Math.min(mn[2], p.cz - p.R);
      mx[0] = Math.max(mx[0], p.cx + p.R); mx[1] = Math.max(mx[1], p.cy + p.R); mx[2] = Math.max(mx[2], p.cz + p.R);
    }
    const pad = cell * 2 + 0.05 + (L.rough ? L.rough.amp : 0);
    for (let a = 0; a < 3; a++) { mn[a] -= pad; mx[a] += pad; }
    let m = surfaceNets(sdf, mn, mx, cell);
    if (opts.simplifier && m.indices.length > 600) m = simplifyMesh(m, opts.simplifier, L.keep ?? opts.ratio ?? 0.4, cell);
    const nv = m.positions.length / 3;
    const skinI = new Uint8Array(nv * 4), skinW = new Float32Array(nv * 4), col = new Float32Array(nv * 3);
    const prims = L.prims.filter((p) => !p.neg);
    const dist = new Float32Array(prims.length);
    const tauW = L.blendW ?? 0.06, tauC = L.blendC ?? 0.025;
    const bw = new Float32Array(spec.bones.length);
    const cavAmt = L.cavity ?? 1;
    const hc = Math.max(0.012, cell * 0.9);
    for (let v = 0; v < nv; v++) {
      const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
      let dmin = 1e9;
      for (let i = 0; i < prims.length; i++) {
        const p = prims[i];
        const lb = Math.sqrt((x - p.cx) ** 2 + (y - p.cy) ** 2 + (z - p.cz) ** 2) - p.R;
        dist[i] = lb > 0.5 ? lb : p.f(x, y, z);
        if (dist[i] < dmin) dmin = dist[i];
      }
      bw.fill(0);
      let cr = 0, cg = 0, cb = 0, cw = 0;
      for (let i = 0; i < prims.length; i++) {
        const dd = dist[i] - dmin;
        const w = Math.max(0, 1 - dd / tauW); if (w > 0) bw[boneIndex.get(prims[i].bone) ?? 0] += w * w;
        const wc = Math.max(0, 1 - dd / tauC);
        if (wc > 0) { const qq = wc * wc * wc, c = prims[i].col; cr += c[0] * qq; cg += c[1] * qq; cb += c[2] * qq; cw += qq; }
      }
      const top = [];
      for (let b = 0; b < bw.length; b++) if (bw[b] > 0) top.push(b);
      top.sort((a, b) => bw[b] - bw[a]);
      let sum = 0;
      for (let t = 0; t < Math.min(4, top.length); t++) sum += bw[top[t]];
      for (let t = 0; t < 4; t++) {
        const b = top[t];
        skinI[v * 4 + t] = b === undefined ? 0 : b;
        skinW[v * 4 + t] = b === undefined || sum === 0 ? 0 : bw[b] / sum;
      }
      if (sum === 0) skinW[v * 4] = 1;
      let r = cr / cw, g = cg / cw, b = cb / cw;
      if (L.pattern) [r, g, b] = L.pattern(x, y, z, [r, g, b]);
      // oclusão ambiente (o quanto o espaço à frente da superfície está livre)
      const nx = m.normals[v * 3], ny = m.normals[v * 3 + 1], nz = m.normals[v * 3 + 2];
      const open = (d, v) => (v >= FAR - 1e-6 ? 1 : v / d);
      const s1 = open(0.03, scene(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03));
      const s2 = open(0.08, scene(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08));
      const s3 = open(0.12, scene(x + nx * 0.12, y + ny * 0.12, z + nz * 0.12));
      const ao = Math.max(0.22, Math.min(1, 0.15 + 0.85 * (0.4 * Math.min(1, s1) + 0.35 * Math.min(1, s2) + 0.25 * Math.min(1, s3))));
      // cavidades (laplaciano negativo = vinco) escurecem; quinas convexas clareiam levemente
      let cav = 1;
      if (cavAmt > 0) {
        const f0 = sdf(x, y, z);
        const lap = (sdf(x + hc, y, z) + sdf(x - hc, y, z) + sdf(x, y + hc, z) + sdf(x, y - hc, z) + sdf(x, y, z + hc) + sdf(x, y, z - hc) - 6 * f0) / (hc * hc);
        cav = lap < 0 ? 1 - Math.min(0.55, -lap * 0.0045 * cavAmt) : 1 + Math.min(0.12, lap * 0.0012 * cavAmt);
      }
      const k = ao * cav;
      col[v * 3] = r * k; col[v * 3 + 1] = g * k; col[v * 3 + 2] = b * k;
    }
    out.push({ name: L.name, mat: L.mat, positions: m.positions, normals: m.normals, indices: m.indices, colors: col, skinIndex: skinI, skinWeight: skinW });
  });
  return out;
}

// simplificação preservando silhueta (erro pequeno) — mantém os vértices originais (posições e
// normais exatas da SDF), só remove os redundantes
function simplifyMesh(m, S, ratio, cell) {
  const target = Math.max(300, Math.floor((m.indices.length * ratio) / 3) * 3);
  const [idx] = S.simplify(m.indices, m.positions, 3, target, 0.0012, []);
  if (idx.length < 300 || idx.length >= m.indices.length) return m;
  const [remap, unique] = S.compactMesh(idx);
  const nv = m.positions.length / 3;
  const pos = new Float32Array(unique * 3), nor = new Float32Array(unique * 3);
  for (let v = 0; v < nv; v++) {
    const t = remap[v];
    if (t === 0xffffffff || t >= unique) continue;
    pos[t * 3] = m.positions[v * 3]; pos[t * 3 + 1] = m.positions[v * 3 + 1]; pos[t * 3 + 2] = m.positions[v * 3 + 2];
    nor[t * 3] = m.normals[v * 3]; nor[t * 3 + 1] = m.normals[v * 3 + 1]; nor[t * 3 + 2] = m.normals[v * 3 + 2];
  }
  return { positions: pos, normals: nor, indices: idx };
}
