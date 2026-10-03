// Escultura orgânica procedural: os personagens são definidos como funções de distância (SDF)
// — elipsoides, membros afunilados e caixas arredondadas fundidos com "smooth union" — e
// transformados numa malha lisa e contínua (surface nets). Cada vértice recebe pesos de pele
// para o esqueleto, cor pintada por região e oclusão ambiente, gerando um SkinnedMesh.

// ------------------------------------------------------------------ primitivas
function invRot(rot) {
  if (!rot) return null;
  const [ax, ay, az] = rot;
  // matriz de rotação Euler XYZ (R = Rx * Ry * Rz) e sua transposta (= inversa)
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
  return {
    cx, cy, cz, R: Math.max(rx, ry, rz),
    f(x, y, z) {
      let px = x - cx, py = y - cy, pz = z - cz;
      if (m) { const qx = m[0] * px + m[1] * py + m[2] * pz, qy = m[3] * px + m[4] * py + m[5] * pz, qz = m[6] * px + m[7] * py + m[8] * pz; px = qx; py = qy; pz = qz; }
      const k0 = Math.sqrt((px / rx) * (px / rx) + (py / ry) * (py / ry) + (pz / rz) * (pz / rz));
      const k1 = Math.sqrt((px / (rx * rx)) * (px / (rx * rx)) + (py / (ry * ry)) * (py / (ry * ry)) + (pz / (rz * rz)) * (pz / (rz * rz)));
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

// anel (bocas, cintos, aros)
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
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// SDF de uma camada: união suave das primitivas positivas, menos as negativas (entalhes)
export function layerSDF(prims) {
  const pos = prims.filter((p) => !p.neg), neg = prims.filter((p) => p.neg);
  return (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i];
      const lb = Math.sqrt((x - p.cx) * (x - p.cx) + (y - p.cy) * (y - p.cy) + (z - p.cz) * (z - p.cz)) - p.R;
      if (lb > d + p.k) continue;            // não pode afetar o resultado
      d = smin(d, p.f(x, y, z), p.k);
    }
    for (let i = 0; i < neg.length; i++) {
      const p = neg[i];
      const lb = Math.sqrt((x - p.cx) * (x - p.cx) + (y - p.cy) * (y - p.cy) + (z - p.cz) * (z - p.cz)) - p.R;
      if (lb > p.k + Math.abs(d)) continue;
      d = -smin(-d, p.f(x, y, z), p.k);
    }
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
  const vals = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  // passo grosso (4 células): longe da superfície só o sinal importa, então os pontos finos
  // herdam o valor da amostra grossa mais próxima (SDF ~ 1-Lipschitz)
  const S = 4, gx = Math.ceil(nx / S) + 1, gy = Math.ceil(ny / S) + 1, gz = Math.ceil(nz / S) + 1;
  const coarse = new Float32Array(gx * gy * gz);
  for (let k = 0; k < gz; k++) for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    coarse[i + gx * (j + gy * k)] = sdf(min[0] + i * S * cell, min[1] + j * S * cell, min[2] + k * S * cell);
  }
  const reach = S * cell * 1.8;
  for (let k = 0; k < nz; k++) {
    const z = min[2] + k * cell, kk = Math.round(k / S);
    for (let j = 0; j < ny; j++) {
      const y = min[1] + j * cell, jj = Math.round(j / S);
      for (let i = 0; i < nx; i++) {
        const c = coarse[Math.round(i / S) + gx * (jj + gy * kk)];
        vals[id(i, j, k)] = Math.abs(c) > reach ? c : sdf(min[0] + i * cell, y, z);
      }
    }
  }
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellV = new Int32Array(cx * cy * cz).fill(-1);
  const cid = (i, j, k) => i + cx * (j + cy * k);
  const P = [];
  const v8 = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const o = CORNERS[c];
      const v = vals[id(i + o[0], j + o[1], k + o[2])];
      v8[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = v8[a], vb = v8[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      const A = CORNERS[a], B = CORNERS[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t;
      n++;
    }
    cellV[cid(i, j, k)] = P.length / 3;
    P.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
  }
  // refina os vértices projetando-os na superfície pelo gradiente
  const nv = P.length / 3;
  const pos = new Float32Array(P);
  const nor = new Float32Array(nv * 3);
  const h = cell * 0.25;
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const ox = x, oy = y, oz = z;
    // um passo de Newton até a superfície; o mesmo gradiente serve de normal (suave)
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
  // faces: um quadrilátero para cada aresta da grade que cruza a superfície
  const I = [];
  const quad = (a, b, c, d, axis, outPositive) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // orienta pela normal esperada (para fora = sentido em que o valor cresce)
    const e1x = pos[b * 3] - pos[a * 3], e1y = pos[b * 3 + 1] - pos[a * 3 + 1], e1z = pos[b * 3 + 2] - pos[a * 3 + 2];
    const e2x = pos[c * 3] - pos[a * 3], e2y = pos[c * 3 + 1] - pos[a * 3 + 1], e2z = pos[c * 3 + 2] - pos[a * 3 + 2];
    const n = axis === 0 ? e1y * e2z - e1z * e2y : axis === 1 ? e1z * e2x - e1x * e2z : e1x * e2y - e1y * e2x;
    if ((n > 0) === outPositive) I.push(a, b, c, a, c, d);
    else I.push(a, c, b, a, d, c);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = vals[id(i, j, k)];
    const in0 = v0 < 0;
    if (i < cx && j > 0 && k > 0 && j < cy && k < cz) {
      const v1 = vals[id(i + 1, j, k)];
      if (in0 !== (v1 < 0)) quad(cellV[cid(i, j - 1, k - 1)], cellV[cid(i, j, k - 1)], cellV[cid(i, j, k)], cellV[cid(i, j - 1, k)], 0, in0);
    }
    if (j < cy && i > 0 && k > 0 && i < cx && k < cz) {
      const v1 = vals[id(i, j + 1, k)];
      if (in0 !== (v1 < 0)) quad(cellV[cid(i - 1, j, k - 1)], cellV[cid(i, j, k - 1)], cellV[cid(i, j, k)], cellV[cid(i - 1, j, k)], 1, in0);
    }
    if (k < cz && i > 0 && j > 0 && i < cx && j < cy) {
      const v1 = vals[id(i, j, k + 1)];
      if (in0 !== (v1 < 0)) quad(cellV[cid(i - 1, j - 1, k)], cellV[cid(i, j - 1, k)], cellV[cid(i, j, k)], cellV[cid(i - 1, j, k)], 2, in0);
    }
  }
  return { positions: pos, normals: nor, indices: new Uint32Array(I) };
}

// ------------------------------------------------------------------ espécie (malhas + pesos + cores)
// spec = { bones: [[nome, pai, x, y, z], ...], layers: [{ name, mat, cell, k, col, prims, pattern }] }
// prim = primitiva + { bone, k, col, neg }
export function buildSpecies(spec) {
  const layers = spec.layers;
  const sdfs = layers.map((l) => layerSDF(l.prims));
  const allPos = layers.flatMap((l) => l.prims.filter((p) => !p.neg));
  const unionAll = layerSDF(allPos.map((p) => ({ ...p, k: Math.min(p.k, 0.02) })));
  const boneIndex = new Map(spec.bones.map((b, i) => [b[0], i]));
  const out = [];
  layers.forEach((L, li) => {
    const sdf = sdfs[li];
    const cell = L.cell || spec.cell || 0.025;
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of L.prims) {
      if (p.neg) continue;
      mn[0] = Math.min(mn[0], p.cx - p.R); mn[1] = Math.min(mn[1], p.cy - p.R); mn[2] = Math.min(mn[2], p.cz - p.R);
      mx[0] = Math.max(mx[0], p.cx + p.R); mx[1] = Math.max(mx[1], p.cy + p.R); mx[2] = Math.max(mx[2], p.cz + p.R);
    }
    for (let a = 0; a < 3; a++) { mn[a] -= cell * 2 + 0.05; mx[a] += cell * 2 + 0.05; }
    const m = surfaceNets(sdf, mn, mx, cell);
    const nv = m.positions.length / 3;
    const skinI = new Uint16Array(nv * 4), skinW = new Float32Array(nv * 4), col = new Float32Array(nv * 3);
    const prims = L.prims.filter((p) => !p.neg);
    const dist = new Float32Array(prims.length);
    const tauW = L.blendW ?? 0.06, tauC = L.blendC ?? 0.03;
    const bw = new Float32Array(spec.bones.length);
    for (let v = 0; v < nv; v++) {
      const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
      let dmin = 1e9;
      for (let i = 0; i < prims.length; i++) { dist[i] = prims[i].f(x, y, z); if (dist[i] < dmin) dmin = dist[i]; }
      bw.fill(0);
      let cr = 0, cg = 0, cb = 0, cw = 0;
      for (let i = 0; i < prims.length; i++) {
        const dd = dist[i] - dmin;
        const w = Math.max(0, 1 - dd / tauW); if (w > 0) bw[boneIndex.get(prims[i].bone) ?? 0] += w * w;
        const wc = Math.max(0, 1 - dd / tauC);
        if (wc > 0) { const q = wc * wc * wc, c = prims[i].col; cr += c[0] * q; cg += c[1] * q; cb += c[2] * q; cw += q; }
      }
      // 4 ossos mais influentes
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
      // oclusão ambiente: o quanto o espaço à frente da superfície está livre
      const nx = m.normals[v * 3], ny = m.normals[v * 3 + 1], nz = m.normals[v * 3 + 2];
      const s1 = unionAll(x + nx * 0.035, y + ny * 0.035, z + nz * 0.035) / 0.035;
      const s2 = unionAll(x + nx * 0.1, y + ny * 0.1, z + nz * 0.1) / 0.1;
      const ao = Math.max(0.3, Math.min(1, 0.25 + 0.75 * (0.5 * Math.min(1, s1) + 0.5 * Math.min(1, s2))));
      col[v * 3] = r * ao; col[v * 3 + 1] = g * ao; col[v * 3 + 2] = b * ao;
    }
    out.push({ name: L.name, mat: L.mat, positions: m.positions, normals: m.normals, indices: m.indices, colors: col, skinIndex: skinI, skinWeight: skinW });
  });
  return out;
}
