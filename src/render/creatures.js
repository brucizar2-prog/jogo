// Personagens orgânicos: cada espécie é esculpida com SDFs (organic.js) em camadas
// (pele, armadura, roupa, cabelo...), vira SkinnedMesh com esqueleto e é animada por ossos.
import * as THREE from 'three';
import { roundCone, sphere, ellipsoid, roundBox, torus, buildSpecies } from './organic.js';
import { Model, M, G, weaponMesh } from './base.js';

// ------------------------------------------------------------------ materiais
const LOW = (() => {
  try {
    const q = new URLSearchParams(location.search).get('q');
    return q === 'low' || (q !== 'high' && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4));
  } catch (e) { return false; }
})();

const MATS = {};
// luz de recorte azulada nas bordas (fresnel), aplicada a todos os materiais dos personagens
export const RIM = { color: new THREE.Color(0x8fa6ff), strength: { value: 1 } };
function addRim(material, amount) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: RIM.color };
    shader.uniforms.rimStrength = RIM.strength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;')
      .replace('#include <opaque_fragment>', `{
        float rim = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += rimColor * pow(rim, 2.6) * ${amount.toFixed(2)} * rimStrength;
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'rim' + amount;
}
function mat(name) {
  if (MATS[name]) return MATS[name];
  const base = { vertexColors: true, color: 0xffffff };
  const P = (o) => (LOW ? new THREE.MeshStandardMaterial({ ...base, roughness: o.roughness ?? 0.6, metalness: o.metalness ?? 0 }) : new THREE.MeshPhysicalMaterial({ ...base, ...o }));
  const defs = {
    skin: { roughness: 0.55, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffc8a8) },
    flesh: { roughness: 0.5, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffa0a0), clearcoat: 0.15 },
    metal: { roughness: 0.28, metalness: 0.92, clearcoat: 0.5, clearcoatRoughness: 0.25 },
    darkmetal: { roughness: 0.4, metalness: 0.85, clearcoat: 0.3 },
    gold: { roughness: 0.3, metalness: 1.0, clearcoat: 0.4 },
    cloth: { roughness: 0.85, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) },
    hair: { roughness: 0.7, sheen: 0.7, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffd0a0) },
    bone: { roughness: 0.55, clearcoat: 0.2 },
    horn: { roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 },
    scales: { roughness: 0.38, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.3 },
    wood: { roughness: 0.9 },
    stone: { roughness: 0.95 },
    feather: { roughness: 0.6, sheen: 0.9, sheenRoughness: 0.3, sheenColor: new THREE.Color(0x8090ff) },
    plant: { roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color(0xd0ff90) },
    ghost: { roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false, emissive: new THREE.Color(0x2a1a60), sheen: 1, sheenColor: new THREE.Color(0x9080ff) },
    shadow: { roughness: 0.9 },
  };
  MATS[name] = P(defs[name] || defs.skin);
  addRim(MATS[name], name === 'metal' || name === 'gold' ? 0.35 : 0.55);
  if (name === 'ghost' && LOW) { MATS[name].transparent = true; MATS[name].opacity = 0.55; MATS[name].depthWrite = false; }
  MATS[name].name = name;
  return MATS[name];
}

// ------------------------------------------------------------------ DSL das primitivas
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map((v) => Math.pow(v, 2.2));
const wrap = (p, bone, o = {}) => Object.assign(p, { bone, k: o.k ?? undefined, col: o.col !== undefined ? (Array.isArray(o.col) ? o.col : hex(o.col)) : undefined, neg: !!o.neg });
const C = (bone, a, b, r1, r2, o) => wrap(roundCone(a, b, r1, r2), bone, o);
const E = (bone, c, r, o = {}) => wrap(ellipsoid(c, r, o.rot), bone, o);
const S = (bone, c, r, o) => wrap(sphere(c, r), bone, o);
const Bx = (bone, c, half, round, o = {}) => wrap(roundBox(c, half, round, o.rot), bone, o);
const T = (bone, c, R, r, o = {}) => wrap(torus(c, R, r, o.rot), bone, o);
// espelha uma lista de primitivas/ossos para os lados esquerdo (+z) e direito (-z)
const LR = (fn) => [...fn(1, 'L'), ...fn(-1, 'R')];
const layer = (name, matName, col, k, prims, extra = {}) => {
  const c = hex(col);
  for (const p of prims) { if (p.k === undefined) p.k = k; if (p.col === undefined) p.col = c; }
  return { name, mat: matName, prims, ...extra };
};
const bonesLR = (list) => list.flatMap((b) => (b[0].includes('$') ? [1, -1].map((s) => [b[0].replace('$', s > 0 ? 'L' : 'R'), b[1].replace('$', s > 0 ? 'L' : 'R'), b[2], b[3], b[4] * s]) : [b]));

// ------------------------------------------------------------------ esqueleto humanoide comum
// p: proporções { hip, spine, chest, neck, head, thighZ, knee, ankle, shoulder, elbow, wrist } (x,y[,z])
function humanoidBones(p) {
  return bonesLR([
    ['root', '', 0, 0, 0],
    ['hips', 'root', 0, p.hip, 0],
    ['spine', 'hips', p.spine[0], p.spine[1], 0],
    ['chest', 'spine', p.chest[0], p.chest[1], 0],
    ['neck', 'chest', p.neck[0], p.neck[1], 0],
    ['head', 'neck', p.head[0], p.head[1], 0],
    ['thigh.$', 'hips', 0, p.hip - 0.02, p.thighZ],
    ['shin.$', 'thigh.$', p.knee[0], p.knee[1], p.thighZ + (p.kneeZ || 0)],
    ['foot.$', 'shin.$', p.ankle[0], p.ankle[1], p.thighZ + (p.kneeZ || 0)],
    ['upperarm.$', 'chest', p.shoulder[0], p.shoulder[1], p.shoulder[2]],
    ['forearm.$', 'upperarm.$', p.elbow[0], p.elbow[1], p.elbow[2]],
    ['hand.$', 'forearm.$', p.wrist[0], p.wrist[1], p.wrist[2]],
    ...(p.extra || []),
  ]);
}

// ------------------------------------------------------------------ registro de espécies
const SPECIES = {};
const BUILT = new Map();

export function getSpecies(key) {
  if (BUILT.has(key)) return BUILT.get(key);
  const spec = SPECIES[key]();
  const t0 = performance.now();
  const layers = buildSpecies(spec).map((L, i) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(L.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(L.normals, 3));
    g.setAttribute('color', new THREE.BufferAttribute(L.colors, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(L.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(L.skinWeight, 4));
    g.setIndex(new THREE.BufferAttribute(L.indices, 1));
    g.computeBoundingSphere();
    return { name: L.name, geometry: g, material: mat(spec.layers[i].mat) };
  });
  const sp = { key, bones: spec.bones, layers, ms: performance.now() - t0 };
  BUILT.set(key, sp);
  return sp;
}

// cria uma instância: ossos próprios + SkinnedMesh por camada (geometria compartilhada)
function instantiate(sp) {
  const group = new THREE.Group();
  const bones = {}, rest = {}, list = [];
  for (const [name, parent, x, y, z] of sp.bones) {
    const b = new THREE.Bone();
    b.name = name;
    const p = parent ? sp.bones.find((q) => q[0] === parent) : null;
    b.position.set(x - (p ? p[2] : 0), y - (p ? p[3] : 0), z - (p ? p[4] : 0));
    (p ? bones[parent] : group).add(b);
    bones[name] = b; rest[name] = { pos: b.position.clone(), world: new THREE.Vector3(x, y, z) };
    list.push(b);
  }
  const meshes = {};
  for (const L of sp.layers) {
    const m = new THREE.SkinnedMesh(L.geometry, L.material);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.name = L.name;
    group.add(m);
    meshes[L.name] = m;
  }
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  for (const k in meshes) meshes[k].bind(skeleton);
  return { group, bones, rest, meshes, skeleton };
}

export class OrganicModel extends Model {
  constructor(key) {
    super();
    const inst = instantiate(getSpecies(key));
    this.inner.add(inst.group);
    this.B = inst.bones; this.rest = inst.rest; this.L = inst.meshes; this.skel = inst.skeleton;
  }
  // volta todos os ossos à pose de repouso
  resetPose() {
    for (const k in this.B) { const b = this.B[k]; b.rotation.set(0, 0, 0); b.position.copy(this.rest[k].pos); b.scale.set(1, 1, 1); }
  }
  // prende um objeto rígido a um osso, dado em coordenadas do modelo em repouso
  attach(bone, obj, x, y, z) {
    const w = this.rest[bone].world;
    obj.position.set(x - w.x, y - w.y, z - w.z);
    this.B[bone].add(obj);
    return obj;
  }
  // prende um objeto já posicionado em coordenadas do modelo (mantém posição/rotação)
  attachRigid(bone, obj) {
    const w = this.rest[bone].world;
    obj.position.x -= w.x; obj.position.y -= w.y; obj.position.z -= w.z;
    this.B[bone].add(obj);
    return obj;
  }
  rot(name, x = 0, y = 0, z = 0) { const b = this.B[name]; if (b) b.rotation.set(x, y, z); }
  // olhos simples (esclera + pupila) ou brilhantes
  eyes(bone, x, y, z, r, o = {}) {
    for (const s of [1, -1]) {
      const g = new THREE.Group();
      if (o.glow) {
        g.add(new THREE.Mesh(G('ge' + r, () => new THREE.SphereGeometry(r, 12, 8)), M(o.glow, { e: o.glow, ei: 2.6, flat: false })));
      } else {
        g.add(new THREE.Mesh(G('ew' + r, () => new THREE.SphereGeometry(r, 14, 10)), M(0xf4f0e8, { r: 0.25, flat: false })));
        const pu = new THREE.Mesh(G('ep' + r, () => new THREE.SphereGeometry(r * 0.55, 12, 8)), M(o.iris || 0x1a1410, { r: 0.2, flat: false }));
        pu.position.x = r * 0.62; g.add(pu);
      }
      this.attach(bone, g, x, y, z * s);
    }
  }
}

// membrana de asa orgânica: contorno com bordas recortadas entre os "dedos", levemente côncava
export function membraneGeo(root, tips, opts = {}) {
  const key = 'mem' + JSON.stringify([root, tips, opts]);
  return G(key, () => {
    const s = new THREE.Shape();
    s.moveTo(root[0], root[1]);
    s.lineTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < tips.length; i++) {
      const a = tips[i - 1], b = tips[i];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const cx = mx + (root[0] - mx) * (opts.scallop ?? 0.35), cy = my + (root[1] - my) * (opts.scallop ?? 0.35);
      s.quadraticCurveTo(cx, cy, b[0], b[1]);
    }
    const end = opts.end || [root[0] - 0.05, root[1] - 0.15];
    s.quadraticCurveTo((tips[tips.length - 1][0] + end[0]) / 2 + 0.05, (tips[tips.length - 1][1] + end[1]) / 2 - 0.05, end[0], end[1]);
    s.closePath();
    const g = new THREE.ShapeGeometry(s, 10);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - root[0], dy = p.getY(i) - root[1];
      p.setZ(i, (opts.cup ?? 0.12) * (dx * dx + dy * dy));
    }
    g.computeVertexNormals();
    return g;
  });
}

// ================================================================== ARTHUR
const ARTHUR_P = {
  hip: 0.93, spine: [0, 1.08], chest: [0.01, 1.28], neck: [0.03, 1.5], head: [0.05, 1.6],
  thighZ: 0.115, knee: [0.02, 0.5], ankle: [0, 0.09], kneeZ: 0.005,
  shoulder: [0, 1.44, 0.25], elbow: [0.02, 1.17, 0.33], wrist: [0.04, 0.94, 0.37],
};
SPECIES.arthur = () => {
  const skin = 0xe2a078, dark = 0x7a828f;
  return {
    cell: 0.023,
    bones: humanoidBones(ARTHUR_P),
    layers: [
      layer('skin', 'skin', skin, 0.06, [
        E('hips', [0, 0.97, 0], [0.155, 0.13, 0.185]),
        E('spine', [0.03, 1.1, 0], [0.15, 0.16, 0.175]),
        E('chest', [0.02, 1.32, 0], [0.16, 0.185, 0.215]),
        ...LR((s) => [E('chest', [0.1, 1.36, 0.08 * s], [0.07, 0.07, 0.085], { k: 0.04 })]),
        C('neck', [0.03, 1.42, 0], [0.05, 1.62, 0], 0.075, 0.066),
        E('head', [0.06, 1.76, 0], [0.165, 0.185, 0.155]),
        E('head', [0.12, 1.67, 0], [0.11, 0.08, 0.11]),
        E('head', [0.215, 1.745, 0], [0.042, 0.038, 0.03], { k: 0.025 }),
        E('head', [0.19, 1.8, 0], [0.04, 0.025, 0.11], { k: 0.04 }),
        ...LR((s) => [S('head', [0.205, 1.775, 0.062 * s], 0.03, { neg: true, k: 0.02 })]),
        ...LR((s) => [
          E('head', [0.045, 1.755, 0.155 * s], [0.035, 0.05, 0.022], { k: 0.02 }),
          E('upperarm.' + (s > 0 ? 'L' : 'R'), [0, 1.42, 0.25 * s], [0.085, 0.09, 0.085]),
          C('upperarm.' + (s > 0 ? 'L' : 'R'), [0, 1.42, 0.25 * s], [0.02, 1.17, 0.33 * s], 0.075, 0.058),
          C('forearm.' + (s > 0 ? 'L' : 'R'), [0.02, 1.17, 0.33 * s], [0.04, 0.95, 0.37 * s], 0.062, 0.046),
          E('hand.' + (s > 0 ? 'L' : 'R'), [0.05, 0.885, 0.38 * s], [0.052, 0.072, 0.034], { k: 0.03 }),
          C('hand.' + (s > 0 ? 'L' : 'R'), [0.075, 0.92, 0.36 * s], [0.1, 0.87, 0.36 * s], 0.021, 0.017, { k: 0.02 }),
          C('thigh.' + (s > 0 ? 'L' : 'R'), [0, 0.92, 0.115 * s], [0.02, 0.52, 0.12 * s], 0.106, 0.074),
          S('shin.' + (s > 0 ? 'L' : 'R'), [0.04, 0.5, 0.12 * s], 0.066, { k: 0.04 }),
          E('shin.' + (s > 0 ? 'L' : 'R'), [-0.015, 0.36, 0.12 * s], [0.058, 0.11, 0.056]),
          C('shin.' + (s > 0 ? 'L' : 'R'), [0.02, 0.5, 0.12 * s], [0, 0.1, 0.12 * s], 0.063, 0.044),
          E('foot.' + (s > 0 ? 'L' : 'R'), [0.06, 0.045, 0.12 * s], [0.12, 0.048, 0.058]),
          S('foot.' + (s > 0 ? 'L' : 'R'), [-0.03, 0.06, 0.12 * s], 0.05, { k: 0.04 }),
        ]),
      ]),
      layer('hair', 'hair', 0x5a2e16, 0.05, [
        E('head', [0.02, 1.815, 0], [0.17, 0.15, 0.163]),
        E('head', [-0.07, 1.72, 0], [0.12, 0.14, 0.15]),
        E('head', [0.155, 1.625, 0], [0.075, 0.068, 0.095]),
        ...LR((s) => [C('head', [0.04, 1.71, 0.135 * s], [0.15, 1.625, 0.065 * s], 0.035, 0.04, { k: 0.04 })]),
        E('head', [0.205, 1.69, 0], [0.034, 0.02, 0.07], { k: 0.02 }),
        ...LR((s) => [C('head', [0.205, 1.815, 0.03 * s], [0.2, 1.81, 0.1 * s], 0.014, 0.01, { k: 0.01 })]),
      ]),
      layer('boxers', 'cloth', 0xf4f0e6, 0.05, [
        E('hips', [0, 0.935, 0], [0.18, 0.15, 0.21]),
        ...LR((s) => [C('thigh.' + (s > 0 ? 'L' : 'R'), [0, 0.92, 0.115 * s], [0.015, 0.74, 0.12 * s], 0.115, 0.105)]),
      ], {
        // bolinhas vermelhas (o famoso calção de coraçõezinhos)
        pattern: (x, y, z, c) => {
          const q = 0.1, ox = Math.round(x / q) * q, oy = Math.round((y - (Math.round(x / q) % 2) * q / 2) / q) * q + (Math.round(x / q) % 2) * q / 2, oz = Math.round(z / q) * q;
          const d = Math.sqrt((x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2);
          const t = Math.max(0, Math.min(1, (0.036 - d) / 0.012));
          const red = hex(0xd0182a);
          return [c[0] + (red[0] - c[0]) * t, c[1] + (red[1] - c[1]) * t, c[2] + (red[2] - c[2]) * t];
        },
      }),
      layer('armor', 'metal', 0xc4ccdc, 0.05, [
        E('hips', [0, 0.95, 0], [0.198, 0.13, 0.228]),
        E('spine', [0.035, 1.1, 0], [0.178, 0.15, 0.208]),
        E('chest', [0.035, 1.32, 0], [0.19, 0.21, 0.248]),
        C('chest', [0.215, 1.2, 0], [0.205, 1.43, 0], 0.024, 0.024, { k: 0.05 }),
        E('neck', [0.02, 1.5, 0], [0.12, 0.07, 0.13], { col: dark }),
        ...LR((s) => {
          const sd = s > 0 ? 'L' : 'R';
          return [
            E('upperarm.' + sd, [-0.01, 1.475, 0.26 * s], [0.13, 0.075, 0.12], { k: 0.02, rot: [-0.35 * s, 0, 0] }),
            E('upperarm.' + sd, [0, 1.41, 0.29 * s], [0.115, 0.05, 0.105], { k: 0.012, rot: [-0.45 * s, 0, 0] }),
            E('upperarm.' + sd, [0.005, 1.355, 0.305 * s], [0.095, 0.04, 0.09], { k: 0.01, rot: [-0.5 * s, 0, 0], col: dark }),
            C('upperarm.' + sd, [0, 1.42, 0.25 * s], [0.02, 1.19, 0.33 * s], 0.079, 0.067),
            S('forearm.' + sd, [0.02, 1.17, 0.33 * s], 0.074, { col: dark, k: 0.02 }),
            C('forearm.' + sd, [0.02, 1.15, 0.335 * s], [0.04, 0.97, 0.37 * s], 0.067, 0.058),
            E('hand.' + sd, [0.05, 0.895, 0.38 * s], [0.064, 0.08, 0.045], { col: dark, k: 0.02 }),
            C('thigh.' + sd, [0, 0.9, 0.115 * s], [0.02, 0.56, 0.12 * s], 0.113, 0.088),
            S('shin.' + sd, [0.05, 0.5, 0.12 * s], 0.078, { col: dark, k: 0.02 }),
            C('shin.' + sd, [0.02, 0.48, 0.12 * s], [0, 0.12, 0.12 * s], 0.076, 0.06),
            E('shin.' + sd, [-0.012, 0.35, 0.12 * s], [0.07, 0.12, 0.068]),
            E('foot.' + sd, [0.06, 0.05, 0.12 * s], [0.13, 0.058, 0.068], { col: dark }),
            S('foot.' + sd, [-0.03, 0.062, 0.12 * s], 0.062, { col: dark, k: 0.03 }),
          ];
        }),
      ]),
      layer('gold', 'gold', 0xe0a83a, 0.02, [
        E('spine', [0.03, 1.01, 0], [0.205, 0.03, 0.235]),
        Bx('spine', [0.232, 1.01, 0], [0.018, 0.034, 0.042], 0.012),
        C('head', [-0.15, 1.97, 0], [0.16, 1.99, 0], 0.028, 0.026, { k: 0.02 }),
      ]),
      layer('helmet', 'metal', 0xc4ccdc, 0.035, [
        E('head', [0.035, 1.8, 0], [0.198, 0.19, 0.19]),
        ...LR((s) => [E('head', [0.11, 1.67, 0.118 * s], [0.088, 0.085, 0.034], { rot: [0, 0.35 * s, 0] })]),
        E('head', [-0.085, 1.68, 0], [0.118, 0.115, 0.168]),
        Bx('head', [0.21, 1.825, 0], [0.032, 0.016, 0.15], 0.014, { k: 0.02, rot: [0, 0, -0.25] }),
        E('head', [0.235, 1.705, 0], [0.11, 0.1, 0.112], { neg: true, k: 0.025 }),
      ]),
      layer('plume', 'cloth', 0xd0202a, 0.05, [
        C('head', [-0.04, 2.0, 0], [-0.28, 1.96, 0], 0.06, 0.035),
        C('head', [-0.28, 1.96, 0], [-0.42, 1.82, 0], 0.035, 0.012),
      ]),
    ],
  };
};

SPECIES.frog = () => ({
  cell: 0.02,
  bones: [['root', '', 0, 0, 0]],
  layers: [layer('body', 'flesh', 0x3aa83a, 0.07, [
    E('root', [0, 0.3, 0], [0.36, 0.23, 0.29]),
    E('root', [0.24, 0.42, 0], [0.2, 0.15, 0.22]),
    E('root', [0.12, 0.22, 0], [0.26, 0.12, 0.22], { col: 0xe4e08a, k: 0.04 }),
    ...LR((s) => [
      S('root', [0.3, 0.57, 0.12 * s], 0.085, { k: 0.04 }),
      E('root', [-0.18, 0.2, 0.28 * s], [0.2, 0.12, 0.1], { rot: [0, 0, -0.4] }),
      E('root', [0.02, 0.035, 0.32 * s], [0.15, 0.03, 0.08], { col: 0x2e8a2e }),
      C('root', [0.24, 0.24, 0.15 * s], [0.32, 0.04, 0.2 * s], 0.05, 0.04),
      E('root', [0.36, 0.03, 0.2 * s], [0.07, 0.025, 0.06], { col: 0x2e8a2e }),
    ]),
  ], { pattern: (x, y, z, c) => (Math.sin(x * 23) * Math.sin(z * 19) * Math.sin(y * 17) > 0.55 && y > 0.3 ? c.map((v) => v * 0.55) : c) })],
});

SPECIES.bones = () => ({
  cell: 0.016,
  bones: [['root', '', 0, 0, 0]],
  layers: [layer('bones', 'bone', 0xece6d6, 0.03, [
    E('root', [0.08, 0.16, 0], [0.16, 0.14, 0.135]),
    E('root', [0.17, 0.08, 0], [0.09, 0.05, 0.09]),
    ...LR((s) => [S('root', [0.17, 0.17, 0.055 * s], 0.042, { neg: true, k: 0.015 })]),
    C('root', [-0.55, 0.04, 0.12], [-0.12, 0.05, 0.2], 0.022, 0.022), S('root', [-0.55, 0.04, 0.12], 0.035), S('root', [-0.12, 0.05, 0.2], 0.035),
    C('root', [-0.4, 0.04, -0.2], [0.0, 0.03, -0.12], 0.022, 0.022), S('root', [-0.4, 0.04, -0.2], 0.035), S('root', [0, 0.03, -0.12], 0.035),
    C('root', [0.25, 0.03, 0.18], [0.55, 0.035, 0.05], 0.02, 0.02), S('root', [0.55, 0.035, 0.05], 0.032),
    E('root', [-0.25, 0.06, 0], [0.12, 0.05, 0.14]),
    ...[0, 1, 2].map((i) => T('root', [-0.1 + i * 0.07, 0.07, 0], 0.11, 0.016, { rot: [0, 0, Math.PI / 2] })),
  ])],
});

export class ArthurOrganic extends OrganicModel {
  constructor() {
    super('arthur');
    this.eyes('head', 0.192, 1.775, 0.062, 0.026);
    this.frogM = new FrogPart();
    this.obj.add(this.frogM.obj);
    const bonesSp = getSpecies('bones');
    this.bonesM = new THREE.Mesh(bonesSp.layers[0].geometry, bonesSp.layers[0].material);
    this.bonesM.castShadow = true;
    this.obj.add(this.bonesM);
    this.handWeapon = new THREE.Group();
    this.attach('hand.R', this.handWeapon, 0.07, 0.88, -0.38);
    this.heldType = null;
    this.phase = 0;
  }
  update(p, dt, time) {
    const st = p.state;
    const armored = p.armor && !p.dead;
    const frog = p.frog && !p.dead;
    this.inner.visible = !frog && !(p.dead && p.deathT > 50);
    this.frogM.obj.visible = frog;
    this.bonesM.visible = p.dead && p.deathT > 40 && ['touch', 'shot', 'timeup', 'spell'].includes(p.deathKind);
    const showArmor = armored || (p.dead && p.deathT < 40 && p.armorAtDeath);
    for (const k of ['armor', 'gold', 'helmet', 'plume']) this.L[k].visible = showArmor;
    this.L.boxers.visible = !showArmor;
    this.resetPose();
    const B = this.B;
    let hipsY = 0, lean = 0;
    // braços levemente junto ao corpo (o modelo é esculpido em pose "A")
    const tuck = (side, a) => { B['upperarm.' + side].rotation.x = (side === 'L' ? 1 : -1) * a; };
    tuck('L', 0.22); tuck('R', 0.22);
    let climbing = false;
    if (p.dead) {
      const k = Math.min(1, p.deathT / 30);
      this.inner.rotation.z = -k * 1.3 * (p.facing || 1);
      hipsY = -k * 0.55;
      this.bonesM.rotation.y = this.yaw;
    } else {
      this.inner.rotation.z = 0;
      const legs = (lz, rz, lk, rk) => { B['thigh.L'].rotation.z = lz; B['thigh.R'].rotation.z = rz; B['shin.L'].rotation.z = lk; B['shin.R'].rotation.z = rk; };
      const arms = (lz, rz, le, re) => { B['upperarm.L'].rotation.z = lz; B['upperarm.R'].rotation.z = rz; B['forearm.L'].rotation.z = le; B['forearm.R'].rotation.z = re; };
      if (st === 'walk') {
        this.phase += 0.16;
        const s = Math.sin(this.phase), c = Math.cos(this.phase);
        legs(s * 0.6, -s * 0.6, -Math.max(0, -s) * 1.0 - 0.08, -Math.max(0, s) * 1.0 - 0.08);
        B['foot.L'].rotation.z = Math.max(0, -s) * 0.4; B['foot.R'].rotation.z = Math.max(0, s) * 0.4;
        arms(-s * 0.5, s * 0.5, 0.45 + Math.max(0, -s) * 0.3, 0.45 + Math.max(0, s) * 0.3);
        hipsY = Math.abs(c) * 0.045 - 0.02;
        B.hips.rotation.y = s * 0.12; B.chest.rotation.y = -s * 0.18;
        lean = -0.07;
      } else if (st === 'jump' || st === 'fall' || st === 'hit') {
        const up = p.vy < 0;
        legs(up ? 0.95 : 0.4, up ? 0.15 : -0.25, up ? -1.55 : -0.6, up ? -0.85 : -0.35);
        arms(up ? 1.5 : 0.8, up ? -0.5 : 0.5, 0.6, 0.6);
        if (st === 'hit') { lean = 0.5; arms(2.4, 2.2, 0.3, 0.3); }
      } else if (st === 'crouch' || st === 'crouchthrow') {
        hipsY = -0.4;
        legs(1.5, 0.25, -2.45, -1.75);
        B['foot.L'].rotation.z = 0.9; B['foot.R'].rotation.z = 1.4;
        lean = -0.28;
        arms(0.6, 0.4, 0.8, 0.6);
      } else if (st === 'climb') {
        climbing = true;
        const c = Math.sin((p.climbAnim || 0) * 0.14);
        tuck('L', -0.1); tuck('R', -0.1);
        arms(2.6 + c * 0.4, 2.6 - c * 0.4, 0.6, 0.6);
        legs(0.45 + c * 0.45, 0.45 - c * 0.45, -0.9 - c * 0.3, -0.9 + c * 0.3);
      } else if (st === 'win') {
        arms(0.3, 2.8, 0.3, 0.2);
      } else {
        const b = Math.sin(time * 2.4);
        hipsY = b * 0.008;
        arms(0.1, -0.06, 0.25, 0.25);
        B.chest.rotation.z = b * 0.015;
        B.head.rotation.z = Math.sin(time * 0.7) * 0.04;
      }
      if (st === 'throw' || st === 'crouchthrow' || p.airThrowT > 0) {
        const k = st === 'throw' || st === 'crouchthrow' ? 1 - p.throwT / 8 : 1 - p.airThrowT / 10;
        B['upperarm.R'].rotation.z = -2.2 + k * 3.6;
        B['forearm.R'].rotation.z = 0.3;
        B.chest.rotation.y = 0.25 - k * 0.4;
        if (p.airThrowT > 0) p.airThrowT--;
        if (this.heldType !== p.weapon) {
          this.handWeapon.clear();
          const w = weaponMesh(p.weapon); w.scale.setScalar(0.7); w.rotation.z = -Math.PI / 2;
          this.handWeapon.add(w); this.heldType = p.weapon;
        }
        this.handWeapon.visible = k < 0.55;
      } else this.handWeapon.visible = false;
    }
    B.hips.position.y += hipsY;
    B.spine.rotation.z += lean * 0.5; B.chest.rotation.z += lean * 0.5;
    if (climbing) {
      this.yaw += (Math.PI / 2 - this.yaw) * 0.4;
      this.inner.rotation.y = this.yaw;
    } else if (!p.dead) this.face(p.facing);
    if (frog) {
      this.frogM.obj.rotation.y = p.facing > 0 ? -0.4 : Math.PI + 0.4;
      this.frogM.obj.scale.set(1, p.onGround ? 1 : 1.2, 1);
    }
    this.obj.visible = !(p.invuln > 1 && !p.dead && Math.floor(p.invuln / 3) % 2 === 0);
  }
}

class FrogPart extends OrganicModel {
  constructor() {
    super('frog');
    for (const s of [1, -1]) {
      const pu = new THREE.Mesh(G('frogpupil', () => new THREE.SphereGeometry(0.045, 10, 8)), M(0x101010, { r: 0.2, flat: false }));
      pu.position.set(0.37, 0.58, 0.12 * s); this.inner.add(pu);
    }
    this.obj.visible = false;
  }
}

// ================================================================== utilitários de membros rígidos
// osso fino entre dois pontos (dedos das asas, cabos)
function rod(a, b, r1, r2, material) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const g = G(`rod${r1},${r2},${len.toFixed(3)}`, () => { const c = new THREE.CylinderGeometry(r2, r1, len, 8, 1); c.translate(0, len / 2, 0); return c; });
  const m = new THREE.Mesh(g, material);
  m.position.set(a[0], a[1], a[2]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  m.castShadow = true;
  return m;
}
const membraneMat = (color, o = {}) => M(color, { r: o.r ?? 0.65, side: THREE.DoubleSide, flat: false, e: o.e ?? 0x000000, ei: o.ei ?? 1, t: o.t, op: o.op });

// asa: membrana + "dedos", presa a um osso; coordenadas no plano x-y do modelo, z = lado
function addWingTo(model, bone, side, root, tips, o = {}) {
  const w = model.rest[bone].world;
  const z = (o.z ?? w.z);
  const grp = new THREE.Group();
  grp.position.set(-w.x, -w.y, z - w.z);
  const mem = new THREE.Mesh(membraneGeo(root, tips, { scallop: o.scallop ?? 0.32, cup: (o.cup ?? 0.1) * side, end: o.end }), membraneMat(o.color ?? 0x6a5a80, { e: o.e, t: o.t, op: o.op }));
  mem.castShadow = true;
  grp.add(mem);
  if (o.fingers !== false) {
    const fm = M(o.boneColor ?? 0x3a2a40, { r: 0.45, flat: false });
    for (const t of tips) grp.add(rod([root[0], root[1], 0.01 * side], [t[0], t[1], 0.01 * side], o.fr ?? 0.03, 0.006, fm));
  }
  model.B[bone].add(grp);
  return grp;
}
function wingPose(model, angle, sweep = 0) {
  for (const [n, s] of [['wing.L', 1], ['wing.R', -1]]) { const b = model.B[n]; if (b) { b.rotation.x = s * angle; b.rotation.z = sweep; } }
}

function potMeshOrganic() {
  const g = new THREE.Group();
  const m = M(0x9a6a34, { r: 0.45, flat: false });
  const b = new THREE.Mesh(G('pot2', () => { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.02 + Math.sin(t * Math.PI) * 0.2 + (t > 0.85 ? (t - 0.85) * 0.6 : 0), t * 0.42 - 0.2)); } return new THREE.LatheGeometry(pts, 20); }), m);
  b.castShadow = true; g.add(b);
  const rim = new THREE.Mesh(G('potrim', () => new THREE.TorusGeometry(0.11, 0.025, 8, 20)), M(0xd0a040, { m: 0.7, r: 0.3, flat: false }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.21; g.add(rim);
  return g;
}

// ================================================================== ZUMBI
const ZOMBIE_P = { hip: 0.86, spine: [0.02, 1.0], chest: [0.06, 1.2], neck: [0.12, 1.42], head: [0.16, 1.5], thighZ: 0.1, knee: [0.03, 0.46], ankle: [0, 0.08], shoulder: [0.08, 1.36, 0.21], elbow: [0.12, 1.1, 0.28], wrist: [0.16, 0.87, 0.31] };
SPECIES.zombie = () => {
  const dk = 0x46608a;
  return {
    cell: 0.023,
    bones: humanoidBones(ZOMBIE_P),
    layers: [
      layer('skin', 'flesh', 0x7896bc, 0.05, [
        E('hips', [0, 0.9, 0], [0.12, 0.1, 0.15]),
        E('spine', [0.03, 1.03, 0], [0.11, 0.12, 0.13]),
        E('chest', [0.07, 1.24, 0], [0.12, 0.15, 0.17]),
        ...LR((s) => [E('chest', [0.07, 1.36, 0.13 * s], [0.07, 0.05, 0.09])]),
        C('neck', [0.1, 1.36, 0], [0.16, 1.52, 0], 0.052, 0.046),
        E('head', [0.2, 1.6, 0], [0.13, 0.15, 0.12]),
        E('head', [0.27, 1.5, 0], [0.08, 0.06, 0.08], { col: 0x5a7298 }),
        E('head', [0.29, 1.645, 0], [0.03, 0.026, 0.09], { k: 0.03 }),
        E('head', [0.33, 1.595, 0], [0.026, 0.032, 0.02], { k: 0.02 }),
        ...LR((s) => [S('head', [0.28, 1.56, 0.075 * s], 0.03, { neg: true, k: 0.02 }), S('head', [0.31, 1.61, 0.045 * s], 0.026, { neg: true, k: 0.015 })]),
        ...LR((s, sd) => [
          C('upperarm.' + sd, [0.08, 1.36, 0.21 * s], [0.12, 1.1, 0.28 * s], 0.05, 0.04),
          C('forearm.' + sd, [0.12, 1.1, 0.28 * s], [0.16, 0.87, 0.31 * s], 0.041, 0.033),
          E('hand.' + sd, [0.17, 0.83, 0.32 * s], [0.038, 0.048, 0.024], { col: dk }),
          ...[-1, 0, 1].map((f) => C('hand.' + sd, [0.17, 0.8, (0.32 + f * 0.016) * s], [0.18 + f * 0.01, 0.71, (0.32 + f * 0.024) * s], 0.012, 0.008, { col: dk, k: 0.015 })),
          C('thigh.' + sd, [0, 0.84, 0.1 * s], [0.03, 0.46, 0.1 * s], 0.07, 0.05),
          C('shin.' + sd, [0.03, 0.46, 0.1 * s], [0, 0.08, 0.1 * s], 0.05, 0.034),
          E('foot.' + sd, [0.05, 0.04, 0.1 * s], [0.1, 0.038, 0.048], { col: dk }),
        ]),
      ], { pattern: (x, y, z, c) => { const n = Math.sin(x * 31 + y * 17) * Math.sin(z * 23 - y * 11); return c.map((v) => v * (0.88 + n * 0.12)); } }),
      layer('rags', 'cloth', 0x5e4a36, 0.04, [
        E('hips', [0, 0.88, 0], [0.135, 0.11, 0.165]),
        ...LR((s, sd) => [
          C('thigh.' + sd, [0, 0.84, 0.1 * s], [0.03, 0.5, 0.1 * s], 0.08, 0.064),
          C('shin.' + sd, [0.03, 0.5, 0.1 * s], [0.012, 0.3, 0.1 * s], 0.061, 0.068),
          S('shin.' + sd, [0.08, 0.36, 0.13 * s], 0.032, { neg: true, k: 0.01 }),
          C('upperarm.' + sd, [0.08, 1.36, 0.21 * s], [0.1, 1.2, 0.25 * s], 0.06, 0.057),
        ]),
        E('chest', [0.07, 1.22, 0], [0.135, 0.15, 0.18]),
        E('spine', [0.035, 1.04, 0], [0.125, 0.12, 0.145]),
        S('spine', [0.16, 1.0, 0.05], 0.04, { neg: true, k: 0.01 }),
        S('chest', [0.19, 1.2, -0.08], 0.035, { neg: true, k: 0.01 }),
        S('chest', [0.08, 1.08, 0.16], 0.04, { neg: true, k: 0.01 }),
      ], { pattern: (x, y, z, c) => { const n = Math.sin(x * 41) * Math.sin(y * 37) * Math.sin(z * 29); return c.map((v) => v * (0.8 + n * 0.25)); } }),
      layer('hair', 'hair', 0xc8501c, 0.04, [
        E('head', [0.17, 1.69, 0], [0.13, 0.08, 0.13]),
        C('head', [0.15, 1.7, 0.06], [0.04, 1.79, 0.13], 0.045, 0.012),
        C('head', [0.15, 1.7, -0.06], [0.03, 1.8, -0.12], 0.045, 0.012),
        C('head', [0.12, 1.66, 0], [-0.03, 1.6, 0], 0.06, 0.015),
        C('head', [0.2, 1.72, 0], [0.24, 1.83, -0.03], 0.04, 0.01),
        C('head', [0.1, 1.68, 0.09], [0.05, 1.56, 0.15], 0.035, 0.01),
        C('head', [0.1, 1.68, -0.09], [0.05, 1.55, -0.15], 0.035, 0.01),
      ]),
    ],
  };
};

class ZombieO extends OrganicModel {
  constructor() {
    super('zombie');
    this.eyes('head', 0.305, 1.61, 0.045, 0.02, { glow: 0xffe060 });
    this.pot = this.attach('hand.L', potMeshOrganic(), 0.25, 0.86, 0.3);
    this.pot.visible = false;
  }
  update(e) {
    this.face(e.facing);
    this.resetPose();
    const B = this.B;
    const rise = e.state === 'walk' ? 1 : (e.rise ?? 0);
    B.root.position.y = -1.9 * (1 - rise);
    B.root.rotation.z = (1 - rise) * 0.4;
    const s = Math.sin(e.animT * 0.14);
    if (e.state === 'walk') {
      B['thigh.L'].rotation.z = s * 0.4; B['thigh.R'].rotation.z = -s * 0.4;
      B['shin.L'].rotation.z = -Math.max(0, -s) * 0.6; B['shin.R'].rotation.z = -Math.max(0, s) * 0.6;
      B.hips.position.y += Math.abs(Math.cos(e.animT * 0.14)) * 0.03;
    }
    B.spine.rotation.z = -0.15; B.chest.rotation.z = -0.12 + Math.sin(e.animT * 0.07) * 0.05;
    B.head.rotation.z = 0.25; B.head.rotation.x = Math.sin(e.animT * 0.05) * 0.2;
    for (const [sd, k] of [['L', 1], ['R', -1]]) {
      B['upperarm.' + sd].rotation.z = 1.25 + s * 0.15 * k;
      B['upperarm.' + sd].rotation.x = 0.15 * k;
      B['forearm.' + sd].rotation.z = 0.15;
      B['hand.' + sd].rotation.z = -0.3;
    }
    this.pot.visible = !!e.pot && rise > 0.6;
  }
}

// ================================================================== CORVO
const birdSpec = (body, beak) => () => ({
  cell: 0.014,
  bones: [['root', '', 0, 0, 0], ['body', 'root', 0, 0.3, 0], ['head', 'body', 0.26, 0.42, 0], ['tail', 'body', -0.2, 0.32, 0], ['wing.L', 'body', 0.04, 0.4, 0.1], ['wing.R', 'body', 0.04, 0.4, -0.1]],
  layers: [
    layer('body', 'feather', body, 0.05, [
      E('body', [0, 0.3, 0], [0.24, 0.13, 0.12], { rot: [0, 0, 0.18] }),
      E('body', [0.13, 0.33, 0], [0.12, 0.115, 0.115]),
      E('head', [0.3, 0.45, 0], [0.1, 0.092, 0.088]),
      E('tail', [-0.33, 0.34, 0], [0.18, 0.022, 0.075], { rot: [0, 0, 0.22] }),
      ...LR((s) => [E('tail', [-0.31, 0.335, 0.05 * s], [0.16, 0.02, 0.05], { rot: [0.25 * s, 0.25 * s, 0.22] })]),
      ...LR((s) => [E('wing.' + (s > 0 ? 'L' : 'R'), [-0.02, 0.36, 0.11 * s], [0.16, 0.09, 0.035], { rot: [0, 0, 0.3] })]),
    ]),
    layer('beak', 'horn', beak, 0.02, [
      C('head', [0.36, 0.45, 0], [0.52, 0.42, 0], 0.038, 0.006),
      ...LR((s) => [C('body', [0.05, 0.2, 0.05 * s], [0.05, 0.04, 0.05 * s], 0.016, 0.013), C('body', [0.05, 0.04, 0.05 * s], [0.13, 0.03, 0.06 * s], 0.012, 0.006)]),
    ]),
  ],
});
SPECIES.crow = birdSpec(0x24306a, 0xe0b030);
SPECIES.raven = birdSpec(0xb01c1c, 0xe8c040);

class CrowO extends OrganicModel {
  constructor(red) {
    super(red ? 'raven' : 'crow');
    this.eyes('head', 0.37, 0.48, 0.055, 0.022, { glow: red ? 0xffee60 : 0xff3030 });
    const wc = red ? 0x8a1010 : 0x1c2858;
    const tips = [[-0.12, 0.78], [-0.34, 0.74], [-0.52, 0.6], [-0.6, 0.42], [-0.55, 0.26]];
    this.wl = addWingTo(this, 'wing.L', 1, [0.06, 0.42], tips, { color: wc, fingers: false, scallop: 0.18, z: 0.11, end: [-0.05, 0.3] });
    this.wr = addWingTo(this, 'wing.R', -1, [0.06, 0.42], tips, { color: wc, fingers: false, scallop: 0.18, z: -0.11, end: [-0.05, 0.3] });
  }
  update(e) {
    this.face(e.facing, 0.3);
    this.resetPose();
    const flying = e.state === 'fly';
    const a = flying ? 0.75 + Math.sin(e.animT * 0.5) * 0.75 : (e.state === 'caw' ? 0.45 + Math.sin(e.animT * 0.8) * 0.35 : 1.45);
    const sweep = flying || e.state === 'caw' ? 0 : -0.9;
    wingPose(this, a, sweep);
    this.B.head.rotation.z = e.state === 'caw' ? 0.25 + Math.sin(e.animT * 0.6) * 0.15 : e.state === 'perch' ? Math.sin(e.animT * 0.04) * 0.08 : 0;
    this.B.tail.rotation.z = Math.sin(e.animT * 0.1) * 0.08;
    this.inner.rotation.z = flying ? -0.12 : 0;
  }
}

// ================================================================== PLANTA CARNÍVORA
SPECIES.plant = () => ({
  cell: 0.021,
  bones: [['root', '', 0, 0, 0], ['stem1', 'root', 0, 0.05, 0], ['stem2', 'stem1', 0.02, 0.45, 0], ['head', 'stem2', 0.06, 0.85, 0], ['jaw', 'head', -0.02, 1.0, 0]],
  layers: [
    layer('leaves', 'plant', 0x2a7a2a, 0.03, [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      return E('root', [Math.cos(a) * 0.17, 0.07, Math.sin(a) * 0.17], [0.24, 0.035, 0.085], { rot: [0, -a, 0.18] });
    })),
    layer('stem', 'plant', 0x3aa040, 0.05, [
      C('stem1', [0, 0.05, 0], [0.02, 0.45, 0], 0.085, 0.06),
      C('stem2', [0.02, 0.45, 0], [0.06, 0.88, 0], 0.06, 0.055),
    ]),
    layer('head', 'plant', 0x3cb048, 0.06, [
      E('head', [0.1, 1.08, 0], [0.3, 0.2, 0.28]),
      E('head', [0.0, 1.17, 0], [0.22, 0.13, 0.22]),
      E('jaw', [0.16, 0.95, 0], [0.26, 0.09, 0.24], { col: 0x2e9a3a }),
      E('head', [0.33, 1.0, 0], [0.2, 0.045, 0.22], { neg: true, k: 0.02 }),
    ], { pattern: (x, y, z, c) => { const d = Math.sin(x * 26) * Math.sin(z * 26 + 1) * Math.sin(y * 20); return d > 0.6 && y > 1.03 ? hex(0xe8e070) : c; } }),
  ],
});

class PlantO extends OrganicModel {
  constructor() {
    super('plant');
    const red = new THREE.Mesh(G('pmouth', () => new THREE.SphereGeometry(0.19, 16, 10)), M(0x6a0612, { r: 0.4, flat: false }));
    red.scale.set(1, 0.35, 1.1);
    this.attach('head', red, 0.2, 1.0, 0);
    const tooth = M(0xf4f0e0, { r: 0.3, flat: false });
    for (let i = 0; i < 5; i++) {
      const t = new THREE.Mesh(G('ptooth', () => new THREE.ConeGeometry(0.022, 0.07, 8)), tooth);
      t.rotation.z = Math.PI;
      this.attach('head', t, 0.36 - Math.abs(i - 2) * 0.03, 1.0, (i - 2) * 0.07);
      const b = new THREE.Mesh(t.geometry, tooth);
      this.attach('jaw', b, 0.34 - Math.abs(i - 2) * 0.03, 0.99, (i - 2) * 0.07 + 0.035);
    }
    const eye = new THREE.Group();
    eye.add(new THREE.Mesh(G('peye', () => new THREE.SphereGeometry(0.075, 16, 12)), M(0xfaf6ee, { r: 0.2, flat: false })));
    const pu = new THREE.Mesh(G('ppu', () => new THREE.SphereGeometry(0.04, 12, 8)), M(0x101010, { flat: false }));
    pu.position.x = 0.05; eye.add(pu);
    this.attach('head', eye, 0.16, 1.24, 0);
  }
  update(e) {
    this.face(e.facing, 0.25);
    this.resetPose();
    const open = e.mouth ? Math.sin((e.mouth / 16) * Math.PI) * 0.6 : 0.05 + Math.sin(e.animT * 0.1) * 0.04;
    this.B.jaw.rotation.z = -open * 0.9;
    this.B.head.rotation.z = open * 0.3 + Math.sin(e.animT * 0.04) * 0.08;
    this.B.stem2.rotation.z = Math.sin(e.animT * 0.05) * 0.08;
    this.B.stem1.rotation.z = Math.sin(e.animT * 0.05 + 1) * 0.04;
  }
}

// ================================================================== DEMÔNIOS ALADOS (Red Arremer e Satã)
function demonSpec(sc, o) {
  const P = (v) => v.map((x) => x * sc);
  const H = (x, y, z) => [x * sc, y * sc, z * sc];
  const bones = humanoidBones({
    hip: 0.9 * sc, spine: P([0.04, 1.1]), chest: P([0.1, 1.4]), neck: P([0.2, 1.8]), head: P([0.24, 1.9]),
    thighZ: 0.18 * sc, knee: P([0.1, 0.5]), ankle: P([0, 0.08]),
    shoulder: P([0.08, 1.7, 0.42]), elbow: P([0.14, 1.33, 0.54]), wrist: P([0.2, 0.98, 0.58]),
    extra: [['wing.$', 'chest', -0.14 * sc, 1.62 * sc, 0.2 * sc], ['tail', 'hips', -0.15 * sc, 0.95 * sc, 0], ['tail2', 'tail', -0.5 * sc, 0.62 * sc, 0], ['jaw', 'head', 0.3 * sc, 1.92 * sc, 0]],
  });
  const lt = o.light;
  return {
    cell: o.cell,
    bones,
    layers: [
      layer('skin', 'flesh', o.color, 0.07 * sc, [
        E('hips', H(0.02, 0.92, 0), P([0.2, 0.17, 0.25])),
        E('spine', H(0.12, 1.1, 0), P([0.2, 0.24, 0.26]), { col: lt }),
        E('chest', H(0.1, 1.45, 0), P([0.27, 0.27, 0.38])),
        ...LR((s) => [E('chest', H(0.28, 1.5, 0.14 * s), P([0.11, 0.1, 0.14]), { col: lt, k: 0.04 * sc })]),
        ...LR((s) => [E('chest', H(0.02, 1.7, 0.2 * s), P([0.12, 0.09, 0.15]))]),
        C('neck', H(0.14, 1.66, 0), H(0.24, 1.92, 0), 0.11 * sc, 0.1 * sc),
        E('head', H(0.3, 2.0, 0), P([0.19, 0.2, 0.18])),
        E('jaw', H(0.42, 1.88, 0), P([0.13, 0.08, 0.14])),
        E('head', H(0.44, 2.06, 0), P([0.06, 0.04, 0.15]), { k: 0.04 * sc }),
        E('head', H(0.48, 1.97, 0), P([0.06, 0.05, 0.08]), { k: 0.04 * sc }),
        ...LR((s) => [C('head', H(0.2, 2.03, 0.16 * s), H(0.1, 2.14, 0.29 * s), 0.05 * sc, 0.008 * sc, { k: 0.03 * sc }), S('head', H(0.44, 2.03, 0.07 * s), 0.04 * sc, { neg: true, k: 0.02 * sc })]),
        ...LR((s, sd) => [
          E('upperarm.' + sd, H(0.08, 1.68, 0.42 * s), P([0.13, 0.14, 0.13])),
          C('upperarm.' + sd, H(0.08, 1.68, 0.42 * s), H(0.14, 1.33, 0.54 * s), 0.11 * sc, 0.085 * sc),
          E('upperarm.' + sd, H(0.15, 1.5, 0.47 * s), P([0.08, 0.12, 0.08]), { k: 0.04 * sc }),
          C('forearm.' + sd, H(0.14, 1.33, 0.54 * s), H(0.2, 0.98, 0.58 * s), 0.085 * sc, 0.065 * sc),
          E('hand.' + sd, H(0.22, 0.92, 0.59 * s), P([0.08, 0.08, 0.06])),
          C('thigh.' + sd, H(0, 0.9, 0.18 * s), H(0.1, 0.5, 0.18 * s), 0.15 * sc, 0.1 * sc),
          C('shin.' + sd, H(0.1, 0.5, 0.18 * s), H(0, 0.1, 0.18 * s), 0.1 * sc, 0.065 * sc),
          E('foot.' + sd, H(0.08, 0.05, 0.18 * s), P([0.15, 0.05, 0.08]), { col: o.dark }),
          C('wing.' + sd, H(-0.14, 1.62, 0.2 * s), H(-0.45, 2.2, 0.24 * s), 0.07 * sc, 0.045 * sc, { k: 0.06 * sc }),
        ]),
        C('tail', H(-0.15, 0.95, 0), H(-0.5, 0.62, 0), 0.06 * sc, 0.035 * sc),
        C('tail2', H(-0.5, 0.62, 0), H(-0.72, 0.76, 0), 0.035 * sc, 0.016 * sc),
        E('tail2', H(-0.77, 0.81, 0), P([0.07, 0.09, 0.018]), { rot: [0, 0, -0.6] }),
      ]),
      layer('horn', 'horn', o.horn, 0.03 * sc, [
        ...LR((s, sd) => [
          C('head', H(0.26, 2.14, 0.11 * s), H(0.14, 2.38, 0.2 * s), 0.06 * sc, 0.035 * sc),
          C('head', H(0.14, 2.38, 0.2 * s), H(0.0, 2.5, 0.16 * s), 0.035 * sc, 0.006 * sc),
          ...[-1, 0, 1].map((f) => C('hand.' + sd, H(0.27, 0.92, (0.59 + f * 0.035) * s), H(0.34, 0.82, (0.6 + f * 0.05) * s), 0.022 * sc, 0.004 * sc)),
          ...[-1, 1].map((f) => C('foot.' + sd, H(0.2, 0.04, (0.18 + f * 0.04) * s), H(0.28, 0.02, (0.18 + f * 0.05) * s), 0.02 * sc, 0.004 * sc)),
        ]),
        ...[0, 1, 2].map((i) => C('spine', H(-0.12 + i * 0.0, 1.05 + i * 0.18, 0), H(-0.24, 1.12 + i * 0.18, 0), 0.03 * sc, 0.004 * sc)),
      ]),
    ],
  };
}
SPECIES.arremer = () => demonSpec(0.66, { cell: 0.019, color: 0xc4261c, light: 0xe0583a, dark: 0x6a1010, horn: 0xeee2c4 });
SPECIES.satan = () => demonSpec(1.05, { cell: 0.03, color: 0xb81e16, light: 0xd84a30, dark: 0x5a0c0c, horn: 0xf0e0b0 });

class DemonO extends OrganicModel {
  constructor(key, sc, wingColor, boneColor) {
    super(key);
    this.sc = sc;
    this.eyes('head', 0.43 * sc, 2.035 * sc, 0.07 * sc, 0.032 * sc, { glow: 0xffd020 });
    const H = (x, y) => [x * sc, y * sc];
    const tips = [H(-1.15, 2.65), H(-1.45, 2.05), H(-1.35, 1.45), H(-0.95, 1.05)];
    const o = { color: wingColor, boneColor, scallop: 0.3, cup: 0.08 / sc, end: H(-0.25, 1.5), fr: 0.032 * sc };
    this.wl = addWingTo(this, 'wing.L', 1, H(-0.45, 2.2), tips, { ...o, z: 0.25 * sc });
    this.wr = addWingTo(this, 'wing.R', -1, H(-0.45, 2.2), tips, { ...o, z: -0.25 * sc });
    const t = new THREE.Mesh(G('dteeth' + sc, () => new THREE.BoxGeometry(0.05 * sc, 0.03 * sc, 0.22 * sc)), M(0xffffff, { r: 0.3, flat: false }));
    this.attach('head', t, 0.5 * sc, 1.93 * sc, 0);
  }
  pose(e, ground, crouch) {
    const B = this.B, sc = this.sc;
    this.resetPose();
    for (const [sd, k] of [['L', 1], ['R', -1]]) { B['upperarm.' + sd].rotation.x = 0.15 * k; }
    if (crouch) {
      B.hips.position.y -= 0.3 * sc;
      B['thigh.L'].rotation.z = 1.4; B['thigh.R'].rotation.z = 1.3;
      B['shin.L'].rotation.z = -2.3; B['shin.R'].rotation.z = -2.2;
      B['foot.L'].rotation.z = 0.9; B['foot.R'].rotation.z = 0.9;
      B.spine.rotation.z = -0.3; B.chest.rotation.z = -0.2;
      B.head.rotation.z = 0.3;
      B['upperarm.L'].rotation.z = 0.5; B['upperarm.R'].rotation.z = 0.4;
      B['forearm.L'].rotation.z = 0.8; B['forearm.R'].rotation.z = 0.8;
    }
    B.tail.rotation.z = Math.sin(e.animT * 0.12) * 0.25 + (ground ? -0.2 : 0.3);
    B.tail2.rotation.z = Math.sin(e.animT * 0.12 + 1) * 0.35;
  }
}

class ArremerO extends DemonO {
  constructor() { super('arremer', 0.66, 0x7a6a94, 0x3a2a48); }
  update(e) {
    this.face(e.facing);
    const st = e.state;
    const ground = st === 'perch' || st === 'walk' || st === 'wake';
    this.pose(e, ground, st === 'perch');
    const B = this.B;
    const fl = st === 'perch' ? 0.1 : ground ? 0.35 + Math.sin(e.animT * 0.2) * 0.1 : 0.6 + Math.sin(e.animT * 0.45) * 0.55;
    wingPose(this, fl, st === 'perch' ? -0.9 : 0);
    if (st === 'walk') {
      const s = Math.sin(e.animT * 0.4);
      B['thigh.L'].rotation.z = 0.3 + s * 0.7; B['thigh.R'].rotation.z = 0.3 - s * 0.7;
      B['shin.L'].rotation.z = -0.7; B['shin.R'].rotation.z = -0.7;
      B.spine.rotation.z = -0.35; B.chest.rotation.z = -0.25; B.head.rotation.z = 0.4;
    } else if (!ground) {
      B['thigh.L'].rotation.z = 0.8; B['thigh.R'].rotation.z = 0.5;
      B['shin.L'].rotation.z = -1.4; B['shin.R'].rotation.z = -1.2;
      B.spine.rotation.z = st === 'swoop' ? -0.6 : -0.1;
      B.head.rotation.z = st === 'swoop' ? 0.5 : 0;
      B['upperarm.L'].rotation.z = st === 'swoop' ? 1.6 : 0.5 + Math.sin(e.animT * 0.2) * 0.2;
      B['upperarm.R'].rotation.z = st === 'swoop' ? 1.4 : 0.5 - Math.sin(e.animT * 0.2) * 0.2;
      B['forearm.L'].rotation.z = 0.6; B['forearm.R'].rotation.z = 0.6;
    }
    B.jaw.rotation.z = e.spitT ? -0.6 : -0.05;
  }
}

class SatanO extends DemonO {
  constructor() {
    super('satan', 1.05, 0x5a2290, 0x2a1040);
    const cloakMat = membraneMat(0x5a2290, { r: 0.55 });
    this.cloak = new THREE.Mesh(G('cloak2', () => {
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.48 + Math.sin(t * Math.PI) * 0.12 + (1 - t) * 0.25, t * 2.0)); }
      return new THREE.LatheGeometry(pts, 24, -Math.PI * 0.85, Math.PI * 1.7);
    }), cloakMat);
    this.cloak.position.set(-0.08, 0.1, 0); this.cloak.castShadow = true;
    this.inner.add(this.cloak);
  }
  update(e) {
    this.face(e.facing, 0.35);
    const w = e.wings ?? 1;
    const st = e.state;
    this.pose(e, st === 'guard' || st === 'land', false);
    const B = this.B;
    const closed = w < 0.5;
    this.cloak.visible = closed;
    this.wl.visible = this.wr.visible = !closed;
    const fa = st === 'hover' || st === 'takeoff' ? 0.5 + Math.sin(e.animT * 0.25) * 0.45 : st === 'swoop' ? 0.9 : 0.25;
    wingPose(this, fa);
    B.jaw.rotation.z = st === 'hover' && e.t % 34 > 14 && e.t % 34 < 26 ? -0.55 : -0.05;
    const s = Math.sin(e.animT * 0.1);
    B['upperarm.L'].rotation.z = st === 'swoop' ? 1.8 : 0.35 + s * 0.1;
    B['upperarm.R'].rotation.z = st === 'swoop' ? 1.6 : 0.35 - s * 0.1;
    B['forearm.L'].rotation.z = 0.5; B['forearm.R'].rotation.z = 0.5;
    B.spine.rotation.z = st === 'swoop' ? -0.6 : 0;
    if (st !== 'guard') { B['thigh.L'].rotation.z = 0.5; B['thigh.R'].rotation.z = 0.2; B['shin.L'].rotation.z = -0.8; B['shin.R'].rotation.z = -0.5; }
  }
}

// ================================================================== CAVALEIRO VOADOR
SPECIES.knight = () => ({
  cell: 0.022,
  bones: [['root', '', 0, 0, 0], ['body', 'root', 0, 0.9, 0], ['head', 'body', 0.04, 1.25, 0]],
  layers: [
    layer('armor', 'metal', 0x5a4ab0, 0.05, [
      E('body', [0, 0.95, 0], [0.22, 0.27, 0.27]),
      E('body', [0.08, 0.98, 0], [0.16, 0.2, 0.2], { col: 0x7a6ad0 }),
      ...LR((s) => [E('body', [-0.01, 1.13, 0.24 * s], [0.13, 0.08, 0.12], { rot: [-0.4 * s, 0, 0] })]),
      E('head', [0.05, 1.42, 0], [0.17, 0.19, 0.16]),
      Bx('head', [0.2, 1.43, 0], [0.04, 0.02, 0.13], 0.015, { neg: true, k: 0.01 }),
      E('body', [0.02, 0.7, 0], [0.2, 0.08, 0.24], { col: 0xc0c4d4 }),
    ]),
    layer('ghost', 'ghost', 0x6a60c0, 0.08, [
      C('body', [0, 0.68, 0], [-0.12, 0.25, 0], 0.22, 0.12),
      C('body', [-0.12, 0.25, 0], [-0.32, -0.02, 0], 0.12, 0.03),
    ]),
    layer('plume', 'cloth', 0xd02a2a, 0.04, [C('head', [0, 1.6, 0], [-0.25, 1.68, 0], 0.05, 0.03), C('head', [-0.25, 1.68, 0], [-0.4, 1.55, 0], 0.03, 0.01)]),
  ],
});

class KnightO extends OrganicModel {
  constructor() {
    super('knight');
    const trim = M(0xc0c4d4, { m: 0.9, r: 0.25, flat: false });
    this.shield = new THREE.Group();
    const sh = new THREE.Mesh(G('kshield', () => { const g = new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, 0.6); g.rotateZ(-Math.PI / 2); return g; }), trim);
    sh.castShadow = true; this.shield.add(sh);
    const em = new THREE.Mesh(G('kemb', () => { const g = new THREE.CircleGeometry(0.14, 3); g.rotateY(Math.PI / 2); return g; }), M(0xb02020, { r: 0.4, flat: false }));
    em.position.x = 0.035; this.shield.add(em);
    this.attach('body', this.shield, 0.08, 0.95, 0.16);
    const visor = new THREE.Mesh(G('kvis', () => new THREE.BoxGeometry(0.04, 0.03, 0.22)), M(0xff4020, { e: 0xff2000, ei: 2, flat: false }));
    this.attach('head', visor, 0.17, 1.43, 0);
    this.attachRigid('body', rod([0.05, 0.8, -0.3], [0.9, 0.95, -0.32], 0.04, 0.012, trim));
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    this.B.body.rotation.z = Math.atan2(-(e.vyNow || 0), 1.0) * 0.8;
    this.B.head.rotation.z = Math.sin(e.animT * 0.05) * 0.06;
  }
}

// ================================================================== WOODY PIG
SPECIES.pig = () => ({
  cell: 0.019,
  bones: [['root', '', 0, 0, 0], ['body', 'root', 0, 0.22, 0], ['wing.L', 'body', -0.08, 0.36, 0.2], ['wing.R', 'body', -0.08, 0.36, -0.2]],
  layers: [
    layer('skin', 'flesh', 0xc88468, 0.05, [
      E('body', [0, 0.22, 0], [0.3, 0.24, 0.25]),
      C('body', [0.26, 0.23, 0], [0.38, 0.23, 0], 0.11, 0.095, { col: 0xe0a088 }),
      ...LR((s) => [
        S('body', [0.47, 0.24, 0.035 * s], 0.022, { neg: true, k: 0.01 }),
        E('body', [0.17, 0.42, 0.13 * s], [0.07, 0.1, 0.03], { rot: [0.5 * s, 0, -0.3], k: 0.02 }),
        C('body', [0.15, 0.06, 0.12 * s], [0.17, -0.06, 0.12 * s], 0.05, 0.04),
        C('body', [-0.15, 0.06, 0.12 * s], [-0.17, -0.06, 0.12 * s], 0.05, 0.04),
      ]),
      T('body', [-0.3, 0.26, 0], 0.04, 0.012, { rot: [Math.PI / 2, 0, 0], k: 0.02 }),
    ]),
    layer('stump', 'wood', 0x6a4426, 0.03, [
      C('body', [-0.03, 0.4, 0], [-0.03, 0.62, 0], 0.19, 0.18),
      E('body', [-0.03, 0.42, 0], [0.23, 0.06, 0.23]),
    ], {
      pattern: (x, y, z, c) => {
        if (y > 0.69) { const r = Math.sqrt((x + 0.03) ** 2 + z * z); return (Math.sin(r * 90) > 0.3 ? hex(0xc89a5a) : hex(0xa8783e)); }
        const a = Math.atan2(z, x + 0.03);
        return Math.sin(a * 14 + y * 9) > 0.55 ? c.map((v) => v * 0.55) : c;
      },
    }),
  ],
});

class PigO extends OrganicModel {
  constructor() {
    super('pig');
    this.eyes('body', 0.24, 0.33, 0.1, 0.025);
    const tips = [[-0.2, 0.68], [-0.38, 0.6], [-0.45, 0.45]];
    this.wl = addWingTo(this, 'wing.L', 1, [-0.06, 0.38], tips, { color: 0xe8dcc0, fingers: false, scallop: 0.2, z: 0.21, end: [-0.15, 0.32] });
    this.wr = addWingTo(this, 'wing.R', -1, [-0.06, 0.38], tips, { color: 0xe8dcc0, fingers: false, scallop: 0.2, z: -0.21, end: [-0.15, 0.32] });
    this.spear = new THREE.Group();
    this.spear.add(rod([-0.45, 0, 0], [0.45, 0, 0], 0.03, 0.03, M(0x6ad040, { r: 0.5, flat: false })));
    const bulb = new THREE.Mesh(G('onion', () => new THREE.SphereGeometry(0.09, 14, 10)), M(0xf4f4e8, { r: 0.4, flat: false }));
    bulb.position.x = -0.47; bulb.scale.set(1, 1.2, 1); this.spear.add(bulb);
    this.attach('body', this.spear, 0.1, 0.0, 0.3);
  }
  update(e) {
    this.face(e.facing, 0.3);
    this.resetPose();
    wingPose(this, 0.6 + Math.sin(e.animT * 0.6) * 0.6);
    this.B.body.position.y += Math.sin(e.animT * 0.15) * 0.05;
    this.spear.rotation.z = e.state === 'shoot' ? -0.6 : 0;
    this.inner.rotation.z = e.state === 'turn' ? Math.sin(e.t / 48 * Math.PI) * 0.8 : 0;
  }
}

// ================================================================== PETITE DEVIL
const impSpec = (body, belly) => () => ({
  cell: 0.014,
  bones: [['root', '', 0, 0, 0], ['body', 'root', 0, 0.3, 0], ['head', 'body', 0.06, 0.5, 0], ['tail', 'body', -0.12, 0.22, 0], ['wing.L', 'body', -0.06, 0.42, 0.1], ['wing.R', 'body', -0.06, 0.42, -0.1]],
  layers: [
    layer('skin', 'flesh', body, 0.05, [
      E('body', [0, 0.3, 0], [0.16, 0.19, 0.15]),
      E('body', [0.07, 0.28, 0], [0.1, 0.13, 0.1], { col: belly }),
      E('head', [0.07, 0.6, 0], [0.15, 0.14, 0.14]),
      E('head', [0.2, 0.56, 0], [0.06, 0.05, 0.07]),
      ...LR((s) => [
        C('head', [0.0, 0.64, 0.11 * s], [-0.07, 0.77, 0.2 * s], 0.04, 0.006, { k: 0.02 }),
        C('body', [0.05, 0.42, 0.13 * s], [0.15, 0.26, 0.19 * s], 0.04, 0.025),
        C('body', [0, 0.14, 0.08 * s], [0.05, 0.0, 0.1 * s], 0.05, 0.03),
        S('head', [0.19, 0.62, 0.05 * s], 0.022, { neg: true, k: 0.01 }),
      ]),
      C('tail', [-0.12, 0.22, 0], [-0.36, 0.12, 0], 0.025, 0.01),
      E('tail', [-0.38, 0.12, 0], [0.035, 0.045, 0.012], { rot: [0, 0, 0.6] }),
    ]),
    layer('horn', 'horn', 0xf0e8d0, 0.02, LR((s) => [C('head', [0.06, 0.71, 0.07 * s], [0.02, 0.85, 0.1 * s], 0.03, 0.005)])),
  ],
});
SPECIES.devil = impSpec(0x3456cc, 0x6a8aea);
SPECIES.lavadevil = impSpec(0xd04a12, 0xf0902a);

class DevilO extends OrganicModel {
  constructor(lava) {
    super(lava ? 'lavadevil' : 'devil');
    this.eyes('head', 0.19, 0.62, 0.05, 0.02, { glow: 0xffee40 });
    const wc = lava ? 0xa03010 : 0x4a60d0;
    const tips = [[-0.3, 0.8], [-0.48, 0.58], [-0.4, 0.36]];
    this.wl = addWingTo(this, 'wing.L', 1, [-0.06, 0.45], tips, { color: wc, boneColor: lava ? 0x601000 : 0x1a2a70, z: 0.11, fr: 0.016, end: [-0.12, 0.3] });
    this.wr = addWingTo(this, 'wing.R', -1, [-0.06, 0.45], tips, { color: wc, boneColor: lava ? 0x601000 : 0x1a2a70, z: -0.11, fr: 0.016, end: [-0.12, 0.3] });
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const fl = e.state === 'hop' ? 0.25 : 1;
    wingPose(this, 0.55 + Math.sin(e.animT * 0.55) * 0.55 * fl);
    this.B.tail.rotation.z = Math.sin(e.animT * 0.2) * 0.4;
    this.B.head.rotation.z = Math.sin(e.animT * 0.1) * 0.1;
  }
}

// ================================================================== BIG MAN (ogro)
const BIG_P = { hip: 1.05, spine: [0.02, 1.3], chest: [0.06, 1.65], neck: [0.16, 2.12], head: [0.2, 2.22], thighZ: 0.22, knee: [0.05, 0.55], ankle: [0, 0.1], shoulder: [0.04, 1.98, 0.48], elbow: [0.1, 1.55, 0.62], wrist: [0.16, 1.12, 0.66] };
SPECIES.bigman = () => ({
  cell: 0.034,
  bones: humanoidBones(BIG_P),
  layers: [
    layer('skin', 'skin', 0xcf9a66, 0.08, [
      E('spine', [0.12, 1.36, 0], [0.42, 0.4, 0.45]),
      E('chest', [0.08, 1.76, 0], [0.37, 0.32, 0.48]),
      ...LR((s) => [E('chest', [0.3, 1.82, 0.18 * s], [0.14, 0.12, 0.17], { k: 0.05 }), E('chest', [0.0, 2.02, 0.22 * s], [0.15, 0.1, 0.18])]),
      C('neck', [0.12, 1.98, 0], [0.2, 2.18, 0], 0.14, 0.12),
      E('head', [0.25, 2.3, 0], [0.18, 0.17, 0.16]),
      E('head', [0.33, 2.19, 0], [0.12, 0.08, 0.13], { col: 0xb07a4a }),
      E('head', [0.38, 2.35, 0], [0.05, 0.04, 0.13], { k: 0.04 }),
      E('head', [0.42, 2.29, 0], [0.045, 0.05, 0.04], { k: 0.03 }),
      ...LR((s) => [S('head', [0.39, 2.31, 0.065 * s], 0.035, { neg: true, k: 0.02 })]),
      ...LR((s, sd) => [
        E('upperarm.' + sd, [0.04, 1.98, 0.5 * s], [0.18, 0.17, 0.17]),
        C('upperarm.' + sd, [0.04, 1.95, 0.5 * s], [0.1, 1.55, 0.62 * s], 0.15, 0.12),
        C('forearm.' + sd, [0.1, 1.55, 0.62 * s], [0.16, 1.12, 0.66 * s], 0.13, 0.1),
        E('hand.' + sd, [0.18, 1.0, 0.67 * s], [0.14, 0.13, 0.11], { col: 0xb07a4a }),
        C('thigh.' + sd, [0, 1.0, 0.22 * s], [0.05, 0.55, 0.22 * s], 0.19, 0.14),
        C('shin.' + sd, [0.05, 0.55, 0.22 * s], [0, 0.12, 0.22 * s], 0.13, 0.1),
        E('foot.' + sd, [0.1, 0.06, 0.22 * s], [0.2, 0.07, 0.11], { col: 0x8a5a34 }),
      ]),
    ]),
    layer('cloth', 'cloth', 0xa82020, 0.05, [
      E('hips', [0.02, 1.0, 0], [0.36, 0.18, 0.42]),
      Bx('hips', [0.3, 0.83, 0], [0.04, 0.17, 0.17], 0.04),
      Bx('hips', [-0.28, 0.85, 0], [0.04, 0.15, 0.2], 0.04),
    ]),
    layer('metal', 'darkmetal', 0x707078, 0.03, [
      E('spine', [0.1, 1.11, 0], [0.45, 0.055, 0.47]),
      ...LR((s, sd) => [C('forearm.' + sd, [0.12, 1.32, 0.64 * s], [0.15, 1.15, 0.66 * s], 0.125, 0.12)]),
    ]),
    layer('horn', 'horn', 0xeee6d0, 0.03, [C('head', [0.2, 2.42, 0], [0.16, 2.7, 0], 0.055, 0.01)]),
  ],
});

class BigManO extends OrganicModel {
  constructor() {
    super('bigman');
    this.eyes('head', 0.41, 2.31, 0.065, 0.028, { glow: 0xff3010 });
    const metal = M(0x5a5a64, { m: 0.85, r: 0.35, flat: false });
    this.flail = new THREE.Group();
    const ball = new THREE.Mesh(G('flb', () => new THREE.IcosahedronGeometry(0.16, 2)), metal);
    ball.castShadow = true; this.flail.add(ball);
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Mesh(G('flsp', () => new THREE.ConeGeometry(0.035, 0.12, 8)), metal);
      const d = new THREE.Vector3(Math.sin(i * 2.4) * Math.cos(i * 1.3), Math.cos(i * 2.4), Math.sin(i * 2.4) * Math.sin(i * 1.3)).normalize();
      sp.position.copy(d.clone().multiplyScalar(0.16)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); this.flail.add(sp);
    }
    this.attach('hand.R', this.flail, 0.2, 0.75, -0.68);
    this.attachRigid('hand.R', rod([0.18, 0.95, -0.67], [0.2, 0.82, -0.68], 0.02, 0.02, metal));
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B;
    const s = Math.sin(e.animT * (e.state === 'charge' ? 0.22 : 0.12));
    const moving = Math.abs(e.vx) > 0;
    B['thigh.L'].rotation.z = moving ? s * 0.45 : 0; B['thigh.R'].rotation.z = moving ? -s * 0.45 : 0;
    B['shin.L'].rotation.z = moving ? -Math.max(0, -s) * 0.5 : 0; B['shin.R'].rotation.z = moving ? -Math.max(0, s) * 0.5 : 0;
    B.hips.position.y += moving ? Math.abs(Math.cos(e.animT * 0.12)) * 0.05 : 0;
    B.spine.rotation.z = -0.1; B.chest.rotation.z = -0.08 + (moving ? Math.abs(s) * 0.04 : 0);
    for (const [sd, k] of [['L', 1], ['R', -1]]) B['upperarm.' + sd].rotation.x = 0.2 * k;
    if (e.state === 'throw') {
      const k = Math.min(1, e.t / 14);
      B['upperarm.R'].rotation.z = -2.4 + k * 4; B['forearm.R'].rotation.z = 0.4;
      this.flail.visible = e.t < 14;
    } else {
      B['upperarm.R'].rotation.z = -s * 0.4; B['forearm.R'].rotation.z = 0.3;
      this.flail.visible = true;
    }
    B['upperarm.L'].rotation.z = s * 0.4; B['forearm.L'].rotation.z = 0.3;
  }
}

// ================================================================== MORCEGO
SPECIES.bat = () => ({
  cell: 0.012,
  bones: [['root', '', 0, 0, 0], ['body', 'root', 0, 0.22, 0], ['wing.L', 'body', 0, 0.27, 0.07], ['wing.R', 'body', 0, 0.27, -0.07]],
  layers: [layer('fur', 'hair', 0x2e3c9c, 0.04, [
    E('body', [0, 0.22, 0], [0.1, 0.12, 0.09]),
    E('body', [0.1, 0.3, 0], [0.075, 0.07, 0.07]),
    E('body', [0.17, 0.28, 0], [0.035, 0.03, 0.035]),
    ...LR((s) => [C('body', [0.08, 0.35, 0.045 * s], [0.05, 0.47, 0.07 * s], 0.032, 0.004, { k: 0.02 }), C('body', [-0.02, 0.12, 0.04 * s], [-0.04, 0.04, 0.05 * s], 0.018, 0.01)]),
  ])],
});
class BatO extends OrganicModel {
  constructor() {
    super('bat');
    this.eyes('body', 0.16, 0.32, 0.035, 0.016, { glow: 0xff3030 });
    const tips = [[-0.08, 0.68], [-0.3, 0.62], [-0.5, 0.4], [-0.38, 0.18]];
    this.wl = addWingTo(this, 'wing.L', 1, [0, 0.28], tips, { color: 0x3a48b8, boneColor: 0x1a2268, z: 0.07, fr: 0.014, end: [-0.05, 0.14] });
    this.wr = addWingTo(this, 'wing.R', -1, [0, 0.28], tips, { color: 0x3a48b8, boneColor: 0x1a2268, z: -0.07, fr: 0.014, end: [-0.05, 0.14] });
  }
  update(e) {
    this.face(e.facing, 0.2);
    this.resetPose();
    if (e.state === 'hang') { this.inner.rotation.z = Math.PI; wingPose(this, 0.05, -0.2); this.inner.position.y = 0.45; return; }
    this.inner.rotation.z = 0; this.inner.position.y = 0;
    wingPose(this, 0.75 + Math.sin(e.animT * 0.7) * 0.75);
  }
}

// ================================================================== ESQUELETO
const SKEL_P = { hip: 0.78, spine: [0, 0.92], chest: [0.02, 1.12], neck: [0.04, 1.32], head: [0.06, 1.4], thighZ: 0.09, knee: [0.03, 0.42], ankle: [0, 0.06], shoulder: [0.02, 1.27, 0.17], elbow: [0.05, 1.02, 0.22], wrist: [0.08, 0.8, 0.25] };
const skullPrims = (b, y) => [
  E(b, [0.1, y + 0.12, 0], [0.14, 0.13, 0.12]),
  E(b, [0.18, y + 0.04, 0], [0.075, 0.045, 0.08]),
  ...LR((s) => [S(b, [0.215, y + 0.13, 0.05 * s], 0.04, { neg: true, k: 0.02 })]),
  S(b, [0.245, y + 0.075, 0], 0.02, { neg: true, k: 0.01 }),
];
SPECIES.skeleton = () => ({
  cell: 0.014,
  bones: humanoidBones(SKEL_P),
  layers: [layer('bone', 'bone', 0xece4d0, 0.02, [
    ...skullPrims('head', 1.4),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => S(i < 3 ? 'spine' : 'chest', [-0.01 + i * 0.004, 0.84 + i * 0.065, 0], 0.03)),
    ...[0, 1, 2, 3].map((i) => T('chest', [0.04, 1.24 - i * 0.065, 0], 0.115 - i * 0.008, 0.014)),
    Bx('chest', [0.17, 1.15, 0], [0.04, 0.16, 0.05], 0.01, { neg: true, k: 0.01 }),
    E('hips', [0, 0.8, 0], [0.07, 0.06, 0.13]),
    ...LR((s, sd) => [
      C('upperarm.' + sd, [0.02, 1.27, 0.17 * s], [0.05, 1.02, 0.22 * s], 0.02, 0.018), S('forearm.' + sd, [0.05, 1.02, 0.22 * s], 0.028),
      C('forearm.' + sd, [0.05, 1.02, 0.22 * s], [0.08, 0.8, 0.25 * s], 0.018, 0.015), E('hand.' + sd, [0.09, 0.76, 0.25 * s], [0.03, 0.045, 0.018]),
      C('thigh.' + sd, [0, 0.76, 0.09 * s], [0.03, 0.42, 0.09 * s], 0.024, 0.02), S('shin.' + sd, [0.03, 0.42, 0.09 * s], 0.033),
      C('shin.' + sd, [0.03, 0.42, 0.09 * s], [0, 0.06, 0.09 * s], 0.02, 0.017), E('foot.' + sd, [0.05, 0.03, 0.09 * s], [0.07, 0.025, 0.035]),
      S('chest', [0.02, 1.27, 0.15 * s], 0.032),
    ]),
  ])],
});
SPECIES.skull = () => ({ cell: 0.012, bones: [['root', '', 0, 0, 0]], layers: [layer('bone', 'bone', 0xece4d0, 0.02, skullPrims('root', -0.02))] });

class SkeletonO extends OrganicModel {
  constructor() {
    super('skeleton');
    this.eyes('head', 0.2, 1.53, 0.05, 0.018, { glow: 0xff2a10 });
    const sk = getSpecies('skull');
    this.skull = new THREE.Mesh(sk.layers[0].geometry, sk.layers[0].material);
    this.skull.castShadow = true;
    this.inner.add(this.skull);
    for (const s of [1, -1]) {
      const g = new THREE.Mesh(G('skg', () => new THREE.SphereGeometry(0.018, 10, 8)), M(0xff2a10, { e: 0xff2000, ei: 2.6, flat: false }));
      g.position.set(0.2, 0.11, 0.05 * s); this.skull.add(g);
    }
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B;
    const skullOnly = e.state === 'skull';
    this.skull.visible = skullOnly;
    for (const k in this.L) this.L[k].visible = !skullOnly;
    for (const c of this.B.head.children) if (!c.isBone) c.visible = !skullOnly;
    if (skullOnly) return;
    const k = e.state === 'rise' ? Math.min(1, e.t / 30) : 1;
    B.root.scale.set(1, Math.max(0.05, k), 1);
    const s = Math.sin(e.animT * 0.25);
    B['thigh.L'].rotation.z = s * 0.5; B['thigh.R'].rotation.z = -s * 0.5;
    B['shin.L'].rotation.z = -Math.max(0, -s) * 0.6; B['shin.R'].rotation.z = -Math.max(0, s) * 0.6;
    B['upperarm.L'].rotation.z = 1.1 + s * 0.3; B['upperarm.R'].rotation.z = 1.1 - s * 0.3;
    B['upperarm.L'].rotation.x = 0.15; B['upperarm.R'].rotation.x = -0.15;
    B.head.rotation.z = e.state === 'jump' ? 0.4 : Math.sin(e.animT * 0.3) * 0.15;
    B.spine.rotation.z = -0.12;
  }
}

// ================================================================== MAGO
SPECIES.magician = () => ({
  cell: 0.025,
  bones: [['root', '', 0, 0, 0], ['body', 'root', 0, 0.8, 0], ['head', 'body', 0.04, 1.4, 0], ['arm.L', 'body', 0.04, 1.25, 0.22], ['arm.R', 'body', 0.04, 1.25, -0.22], ['wing.L', 'body', -0.15, 1.22, 0.16], ['wing.R', 'body', -0.15, 1.22, -0.16]],
  layers: [
    layer('robe', 'cloth', 0x5c6488, 0.06, [
      C('body', [0, 0.06, 0], [0, 1.2, 0], 0.4, 0.17),
      E('body', [0, 0.08, 0], [0.42, 0.07, 0.42]),
      E('body', [0, 1.25, 0], [0.18, 0.13, 0.27]),
      E('head', [0.0, 1.55, 0], [0.2, 0.22, 0.2]),
      C('head', [-0.06, 1.7, 0], [-0.24, 1.86, 0], 0.08, 0.01),
      E('head', [0.19, 1.52, 0], [0.1, 0.13, 0.13], { neg: true, k: 0.03 }),
      ...LR((s, sd) => [C('arm.' + sd, [0.04, 1.25, 0.22 * s], [0.26, 0.95, 0.26 * s], 0.075, 0.11)]),
    ], { pattern: (x, y, z, c) => (Math.abs(y - 0.18) < 0.04 || Math.abs(y - 0.3) < 0.015 ? hex(0xc8a040) : c) }),
    layer('face', 'shadow', 0x0c0a14, 0.03, [E('head', [0.06, 1.52, 0], [0.13, 0.15, 0.13])]),
    layer('hands', 'skin', 0x9aa0b8, 0.03, LR((s, sd) => [E('arm.' + sd, [0.3, 0.9, 0.26 * s], [0.05, 0.06, 0.04])])),
  ],
});
class MagicianO extends OrganicModel {
  constructor() {
    super('magician');
    this.eyes('head', 0.17, 1.54, 0.045, 0.022, { glow: 0x40ffb0 });
    const tips = [[-0.55, 1.95], [-0.95, 1.7], [-1.05, 1.25], [-0.75, 0.85]];
    this.wl = addWingTo(this, 'wing.L', 1, [-0.15, 1.3], tips, { color: 0x9aa0b0, boneColor: 0x5a6070, z: 0.17, fr: 0.024, end: [-0.2, 0.9] });
    this.wr = addWingTo(this, 'wing.R', -1, [-0.15, 1.3], tips, { color: 0x9aa0b0, boneColor: 0x5a6070, z: -0.17, fr: 0.024, end: [-0.2, 0.9] });
    this.attachRigid('arm.R', rod([0.32, 0.1, -0.27], [0.36, 1.7, -0.28], 0.025, 0.02, M(0x5a3a1a, { r: 0.7, flat: false })));
    this.orb = new THREE.Mesh(G('morb', () => new THREE.SphereGeometry(0.1, 16, 12)), M(0x60ffe0, { e: 0x30ffd0, ei: 3, flat: false }));
    this.attach('arm.R', this.orb, 0.36, 1.78, -0.28);
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const open = e.state === 'appear' ? Math.min(1, e.t / 50) : 1;
    wingPose(this, 0.2 + Math.sin(e.animT * 0.2) * 0.1, -(1 - open) * 1.4);
    this.B['arm.L'].rotation.z = e.state === 'cast' ? 1.2 : 0.2;
    this.orb.scale.setScalar(1 + Math.sin(e.animT * 0.4) * 0.3);
  }
}

// ================================================================== PRINCESA
SPECIES.princess = () => ({
  cell: 0.021,
  bones: [['root', '', 0, 0, 0], ['hips', 'root', 0, 0.9, 0], ['chest', 'hips', 0.01, 1.15, 0], ['head', 'chest', 0.03, 1.45, 0], ['upperarm.L', 'chest', 0.01, 1.3, 0.15], ['upperarm.R', 'chest', 0.01, 1.3, -0.15]],
  layers: [
    layer('dress', 'cloth', 0xf2eef8, 0.06, [
      C('hips', [0, 0.12, 0], [0, 0.95, 0], 0.44, 0.13),
      E('hips', [0, 0.1, 0], [0.46, 0.09, 0.46]),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i / 8 * Math.PI * 2; return C('hips', [Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3], [Math.cos(a) * 0.46, 0.08, Math.sin(a) * 0.46], 0.04, 0.07, { k: 0.08 }); }),
      E('chest', [0.02, 1.16, 0], [0.12, 0.17, 0.14], { col: 0xc0204a }),
    ]),
    layer('skin', 'skin', 0xf2c4a4, 0.05, [
      C('chest', [0.02, 1.3, 0], [0.03, 1.47, 0], 0.045, 0.042),
      E('head', [0.04, 1.56, 0], [0.12, 0.14, 0.12]),
      E('head', [0.1, 1.5, 0], [0.07, 0.06, 0.08]),
      ...LR((s, sd) => [C('upperarm.' + sd, [0.01, 1.3, 0.15 * s], [0.1, 1.05, 0.2 * s], 0.038, 0.03), E('upperarm.' + sd, [0.12, 1.0, 0.2 * s], [0.035, 0.045, 0.025])]),
    ]),
    layer('hair', 'hair', 0x9a4ad0, 0.05, [
      E('head', [0.01, 1.62, 0], [0.14, 0.12, 0.135]),
      C('head', [-0.07, 1.58, 0], [-0.13, 1.12, 0], 0.13, 0.08),
      ...LR((s) => [C('head', [0.05, 1.6, 0.11 * s], [0.04, 1.32, 0.14 * s], 0.05, 0.035)]),
      E('head', [0.12, 1.64, 0], [0.04, 0.03, 0.1], { k: 0.03 }),
    ]),
    layer('crown', 'gold', 0xf0c040, 0.02, [
      T('head', [0.02, 1.73, 0], 0.085, 0.018),
      ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return C('head', [0.02 + Math.cos(a) * 0.085, 1.74, Math.sin(a) * 0.085], [0.02 + Math.cos(a) * 0.08, 1.81, Math.sin(a) * 0.08], 0.018, 0.005); }),
    ]),
  ],
});
class PrincessO extends OrganicModel {
  constructor() { super('princess'); this.eyes('head', 0.14, 1.575, 0.045, 0.02, { iris: 0x4a2a8a }); }
  update(e) {
    this.face(-1, 0.4);
    this.resetPose();
    this.B.chest.rotation.z = Math.sin(e.animT * 0.04) * 0.02;
    this.B['upperarm.L'].rotation.z = 0.5; this.B['upperarm.R'].rotation.z = 0.5;
    this.B['upperarm.L'].rotation.x = 0.2; this.B['upperarm.R'].rotation.x = -0.2;
  }
}

// ================================================================== UNICÓRNIO (ciclope)
const UNI_P = { hip: 1.15, spine: [0.04, 1.42], chest: [0.1, 1.75], neck: [0.2, 2.18], head: [0.26, 2.28], thighZ: 0.24, knee: [0.1, 0.62], ankle: [0, 0.1], shoulder: [0.08, 2.06, 0.5], elbow: [0.14, 1.6, 0.64], wrist: [0.2, 1.15, 0.68], extra: [['jaw', 'head', 0.36, 2.26, 0]] };
SPECIES.unicorn = () => ({
  cell: 0.034,
  bones: humanoidBones(UNI_P),
  layers: [
    layer('skin', 'skin', 0xd8d8e2, 0.08, [
      E('hips', [0.02, 1.15, 0], [0.3, 0.22, 0.36]),
      E('spine', [0.06, 1.42, 0], [0.3, 0.3, 0.38]),
      E('chest', [0.12, 1.82, 0], [0.34, 0.32, 0.48]),
      ...LR((s) => [E('chest', [0.02, 2.08, 0.24 * s], [0.16, 0.1, 0.2])]),
      C('neck', [0.16, 2.05, 0], [0.26, 2.3, 0], 0.15, 0.13),
      E('head', [0.3, 2.4, 0], [0.24, 0.24, 0.22]),
      E('jaw', [0.4, 2.22, 0], [0.18, 0.1, 0.2], { col: 0xa8a8b6 }),
      E('head', [0.47, 2.48, 0], [0.07, 0.05, 0.17], { k: 0.04 }),
      S('head', [0.5, 2.39, 0], 0.11, { neg: true, k: 0.03 }),
      ...LR((s, sd) => [
        E('upperarm.' + sd, [0.08, 2.06, 0.5 * s], [0.17, 0.17, 0.16]),
        C('upperarm.' + sd, [0.08, 2.04, 0.5 * s], [0.14, 1.6, 0.64 * s], 0.15, 0.125),
        C('forearm.' + sd, [0.14, 1.6, 0.64 * s], [0.2, 1.15, 0.68 * s], 0.135, 0.115),
        E('hand.' + sd, [0.22, 1.02, 0.69 * s], [0.15, 0.15, 0.12]),
        C('thigh.' + sd, [0, 1.13, 0.24 * s], [0.1, 0.62, 0.24 * s], 0.19, 0.14),
        C('shin.' + sd, [0.1, 0.62, 0.24 * s], [0, 0.12, 0.24 * s], 0.14, 0.11),
        E('foot.' + sd, [0.1, 0.07, 0.24 * s], [0.2, 0.075, 0.13], { col: 0x8a8a98 }),
      ]),
    ]),
    layer('vest', 'cloth', 0xc0201c, 0.05, [
      E('chest', [0.1, 1.76, 0], [0.37, 0.3, 0.51]),
      E('spine', [0.06, 1.48, 0], [0.32, 0.18, 0.4]),
      E('chest', [0.46, 1.7, 0], [0.13, 0.42, 0.16], { neg: true, k: 0.03 }),
    ]),
    layer('pants', 'cloth', 0x3a7a3a, 0.05, [
      E('hips', [0.02, 1.12, 0], [0.32, 0.22, 0.38]),
      ...LR((s, sd) => [C('thigh.' + sd, [0, 1.1, 0.24 * s], [0.08, 0.7, 0.24 * s], 0.205, 0.16)]),
    ]),
    layer('horn', 'horn', 0xfff2d0, 0.03, [C('head', [0.3, 2.58, 0], [0.34, 2.95, 0], 0.075, 0.012)]),
  ],
});
class UnicornO extends OrganicModel {
  constructor() {
    super('unicorn');
    const eye = new THREE.Group();
    eye.add(new THREE.Mesh(G('ueye', () => new THREE.SphereGeometry(0.1, 20, 14)), M(0xfaf6ee, { r: 0.2, flat: false })));
    const iris = new THREE.Mesh(G('uiris', () => new THREE.SphereGeometry(0.055, 16, 12)), M(0xc01818, { r: 0.2, flat: false, e: 0x400000 }));
    iris.position.x = 0.06; eye.add(iris);
    const pu = new THREE.Mesh(G('upu', () => new THREE.SphereGeometry(0.03, 12, 8)), M(0x0a0a0a, { flat: false }));
    pu.position.x = 0.09; eye.add(pu);
    this.attach('head', eye, 0.49, 2.39, 0);
    const gold = M(0xe0b040, { m: 0.9, r: 0.3, flat: false });
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(G('ubtn', () => new THREE.SphereGeometry(0.035, 10, 8)), gold); this.attach('chest', b, 0.4, 1.55 + i * 0.13, 0.16); }
    const tooth = new THREE.Mesh(G('utooth', () => new THREE.BoxGeometry(0.05, 0.04, 0.3)), M(0xffffff, { r: 0.3, flat: false }));
    this.attach('jaw', tooth, 0.55, 2.27, 0);
  }
  update(e) {
    this.face(e.facing, 0.35);
    this.resetPose();
    const B = this.B, st = e.state;
    const s = Math.sin(e.animT * 0.18);
    for (const [sd, k] of [['L', 1], ['R', -1]]) B['upperarm.' + sd].rotation.x = 0.18 * k;
    B.spine.rotation.z = -0.12; B.chest.rotation.z = -0.1;
    if (st === 'walk') {
      B['thigh.L'].rotation.z = s * 0.5; B['thigh.R'].rotation.z = -s * 0.5;
      B['shin.L'].rotation.z = -Math.max(0, -s) * 0.7; B['shin.R'].rotation.z = -Math.max(0, s) * 0.7;
      B['upperarm.L'].rotation.z = -s * 0.4; B['upperarm.R'].rotation.z = s * 0.4;
      B.hips.position.y += Math.abs(Math.cos(e.animT * 0.18)) * 0.06;
    } else if (st === 'jump') {
      const k = e.t / (e.jumpDur || 40);
      B['thigh.L'].rotation.z = 0.9; B['thigh.R'].rotation.z = 0.5; B['shin.L'].rotation.z = -1.4; B['shin.R'].rotation.z = -1.1;
      B['upperarm.L'].rotation.z = 2.4 - k; B['upperarm.R'].rotation.z = 2.2 - k;
    } else if (st === 'angry') {
      B['upperarm.L'].rotation.z = 2.6 + Math.sin(e.animT * 0.8) * 0.2; B['upperarm.R'].rotation.z = 2.6 - Math.sin(e.animT * 0.8) * 0.2;
      B['forearm.L'].rotation.z = 0.5; B['forearm.R'].rotation.z = 0.5;
      B.chest.rotation.z = 0.15;
    } else if (st === 'shoot') {
      B.chest.rotation.z = e.t < 10 ? 0.2 : -0.3;
      B['upperarm.L'].rotation.z = 0.4; B['upperarm.R'].rotation.z = 0.4;
    } else {
      B['upperarm.L'].rotation.z = 0.15 + s * 0.05; B['upperarm.R'].rotation.z = 0.15 - s * 0.05;
      B.hips.position.y += Math.sin(e.animT * 0.06) * 0.02;
    }
    B.jaw.rotation.z = st === 'shoot' && e.t > 6 && e.t < 20 ? -0.6 : st === 'angry' ? -0.4 : -0.05;
  }
}

// ================================================================== DRAGÃO
SPECIES.dragonhead = () => ({
  cell: 0.022,
  bones: [['root', '', 0, 0, 0], ['jaw', 'root', 0.1, 0.48, 0]],
  layers: [
    layer('scales', 'scales', 0x6e3cb8, 0.07, [
      E('root', [0, 0.6, 0], [0.36, 0.25, 0.26]),
      E('root', [0.44, 0.56, 0], [0.32, 0.14, 0.18]),
      ...LR((s) => [E('root', [0.25, 0.77, 0.12 * s], [0.16, 0.05, 0.07], { k: 0.05 }), S('root', [0.7, 0.62, 0.06 * s], 0.025, { neg: true, k: 0.01 })]),
      E('jaw', [0.36, 0.4, 0], [0.38, 0.08, 0.17], { col: 0x9a70d8 }),
      E('root', [0.5, 0.48, 0], [0.4, 0.04, 0.16], { neg: true, k: 0.02 }),
    ], { pattern: (x, y, z, c) => { const n = Math.sin(x * 40 + Math.sin(y * 30) * 2) * Math.sin(z * 40); return c.map((v) => v * (0.85 + 0.2 * (n > 0.4 ? 1 : 0))); } }),
    layer('horn', 'horn', 0xf0d070, 0.04, [
      ...LR((s) => [C('root', [0.05, 0.8, 0.12 * s], [-0.35, 1.12, 0.17 * s], 0.07, 0.012), C('root', [-0.2, 0.68, 0.18 * s], [-0.58, 0.86, 0.26 * s], 0.06, 0.01)]),
      C('root', [-0.25, 0.6, 0], [-0.5, 0.45, 0], 0.1, 0.03, { col: 0xd02020 }),
    ]),
  ],
});
SPECIES.dragonseg = () => ({
  cell: 0.03,
  bones: [['root', '', 0, 0, 0]],
  layers: [
    layer('scales', 'scales', 0x8a5ad0, 0.06, [
      E('root', [0, 0, 0], [0.5, 0.48, 0.46]),
      E('root', [0, -0.18, 0], [0.4, 0.32, 0.38], { col: 0xd8c8f0 }),
    ], { pattern: (x, y, z, c) => { const n = Math.sin(x * 22 + y * 8) * Math.sin(z * 22 - y * 6); return c.map((v) => v * (n > 0.3 ? 0.78 : 1)); } }),
    layer('spikes', 'horn', 0xb090f0, 0.03, [
      C('root', [0.1, 0.38, 0], [-0.12, 0.78, 0], 0.11, 0.01),
      ...LR((s) => [C('root', [0, 0.25, 0.3 * s], [-0.1, 0.5, 0.48 * s], 0.06, 0.008)]),
    ]),
  ],
});
class DragonO extends OrganicModel {
  constructor() {
    super('dragonhead');
    this.eyes('root', 0.3, 0.7, 0.14, 0.05, { glow: 0xff2020 });
    const tooth = M(0xffffff, { r: 0.3, flat: false });
    for (let i = 0; i < 5; i++) {
      const t = new THREE.Mesh(G('dtooth', () => new THREE.ConeGeometry(0.03, 0.1, 8)), tooth);
      t.rotation.z = Math.PI; this.attach('root', t, 0.35 + i * 0.09, 0.48, 0.12);
      const b = new THREE.Mesh(t.geometry, tooth); this.attach('jaw', b, 0.3 + i * 0.09, 0.48, -0.12);
    }
    this.headPivot = new THREE.Group();
    this.obj.add(this.headPivot);
    this.headPivot.add(this.inner);
    this.inner.position.y = -0.6;
    this.headPivot.position.y = 0.6;
    const seg = getSpecies('dragonseg');
    this.segGeo = seg.layers;
    this.segs = [];
  }
  ensureSegs(n) {
    while (this.segs.length < n) {
      const g = new THREE.Group();
      for (const L of this.segGeo) { const m = new THREE.Mesh(L.geometry, L.material); m.castShadow = true; g.add(m); }
      this.obj.add(g);
      this.segs.push(g);
    }
  }
  update(e) {
    const n = e.segs.length;
    this.ensureSegs(n);
    this.resetPose();
    this.inner.rotation.y = e.facing > 0 ? -0.3 : Math.PI + 0.3;
    this.headPivot.rotation.z = Math.atan2(-(e.vy || 0), Math.abs(e.vx || 1)) * 0.6;
    this.B.jaw.rotation.z = e.burst ? -0.5 : -0.06 + Math.sin(e.animT * 0.1) * 0.05;
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
  }
}

// ================================================================== ASTAROTH
const AST_P = { hip: 1.45, spine: [0.04, 1.85], chest: [0.08, 2.3], neck: [0.14, 2.92], head: [0.16, 3.05], thighZ: 0.42, knee: [0.06, 0.75], ankle: [0, 0.12], shoulder: [0.06, 2.75, 0.92], elbow: [0.12, 2.12, 1.08], wrist: [0.18, 1.55, 1.12], extra: [['jaw', 'head', 0.3, 3.0, 0]] };
SPECIES.astaroth = () => ({
  cell: 0.05,
  bones: humanoidBones(AST_P),
  layers: [
    layer('body', 'skin', 0xe6d6b8, 0.12, [
      E('hips', [0.04, 1.5, 0], [0.55, 0.38, 0.7]),
      E('spine', [0.15, 1.85, 0], [0.68, 0.62, 0.82]),
      E('chest', [0.12, 2.45, 0], [0.58, 0.5, 0.88]),
      E('spine', [0.82, 1.76, 0], [0.12, 0.07, 0.38], { neg: true, k: 0.05 }),
      ...LR((s) => [S('spine', [0.76, 2.02, 0.22 * s], 0.08, { neg: true, k: 0.03 })]),
      ...LR((s, sd) => [
        E('upperarm.' + sd, [0.06, 2.72, 0.92 * s], [0.3, 0.3, 0.3]),
        C('upperarm.' + sd, [0.06, 2.7, 0.92 * s], [0.12, 2.12, 1.08 * s], 0.25, 0.21),
        C('forearm.' + sd, [0.12, 2.12, 1.08 * s], [0.18, 1.55, 1.12 * s], 0.22, 0.18),
        E('hand.' + sd, [0.2, 1.42, 1.13 * s], [0.24, 0.24, 0.2], { col: 0xb8a888 }),
        C('thigh.' + sd, [0, 1.42, 0.42 * s], [0.06, 0.75, 0.42 * s], 0.32, 0.24),
        C('shin.' + sd, [0.06, 0.75, 0.42 * s], [0, 0.15, 0.42 * s], 0.24, 0.2),
        E('foot.' + sd, [0.12, 0.1, 0.42 * s], [0.32, 0.11, 0.22], { col: 0xb8b8c8 }),
      ]),
    ]),
    layer('face', 'flesh', 0x8a58b8, 0.08, [
      C('neck', [0.12, 2.75, 0], [0.16, 3.05, 0], 0.26, 0.24),
      E('head', [0.3, 3.2, 0], [0.47, 0.46, 0.44]),
      E('jaw', [0.42, 2.96, 0], [0.3, 0.16, 0.34]),
      E('head', [0.6, 3.34, 0], [0.12, 0.08, 0.36], { k: 0.06 }),
      E('head', [0.68, 3.2, 0], [0.1, 0.12, 0.09], { k: 0.05 }),
      ...LR((s) => [S('head', [0.62, 3.26, 0.17 * s], 0.08, { neg: true, k: 0.03 })]),
    ]),
    layer('hair', 'hair', 0xb080e0, 0.1, [
      E('head', [-0.12, 3.45, 0], [0.4, 0.33, 0.52]),
      E('head', [-0.32, 3.12, 0], [0.28, 0.42, 0.48]),
      E('jaw', [0.52, 2.8, 0], [0.24, 0.3, 0.3]),
    ]),
    layer('horn', 'horn', 0xf4ecd0, 0.05, LR((s) => [C('head', [0.15, 3.55, 0.3 * s], [-0.05, 4.05, 0.52 * s], 0.13, 0.05), C('head', [-0.05, 4.05, 0.52 * s], [0.15, 4.35, 0.58 * s], 0.05, 0.01)])),
    layer('armor', 'gold', 0xd8a838, 0.05, [
      E('spine', [0.12, 1.26, 0], [0.62, 0.08, 0.76]),
      ...LR((s, sd) => [C('forearm.' + sd, [0.15, 1.85, 1.1 * s], [0.18, 1.62, 1.12 * s], 0.21, 0.2)]),
    ]),
  ],
});
class AstarothO extends OrganicModel {
  constructor() {
    super('astaroth');
    this.eyes('head', 0.62, 3.26, 0.17, 0.07, { glow: 0xfff060 });
    for (const s of [1, -1]) {
      const g = new THREE.Mesh(G('abe', () => new THREE.SphereGeometry(0.07, 12, 10)), M(0xff3010, { e: 0xff2000, ei: 2.6, flat: false }));
      this.attach('spine', g, 0.8, 2.02, 0.22 * s);
    }
    const tooth = M(0xffffff, { r: 0.3, flat: false });
    for (let i = 0; i < 7; i++) {
      const t = new THREE.Mesh(G('atooth', () => new THREE.ConeGeometry(0.04, 0.13, 8)), tooth);
      t.rotation.z = Math.PI; this.attach('spine', t, 0.84, 1.8, -0.3 + i * 0.1);
      const b = new THREE.Mesh(t.geometry, tooth); this.attach('spine', b, 0.84, 1.72, -0.25 + i * 0.1);
    }
    const capeMat = membraneMat(0xc8281c, { r: 0.6 });
    this.cape = new THREE.Mesh(G('acape', () => {
      const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(0.95 + (1 - t) * 0.55 + Math.sin(t * 9) * 0.03, t * 3.1)); }
      return new THREE.LatheGeometry(pts, 28, Math.PI * 1.05, Math.PI * 0.9);
    }), capeMat);
    this.cape.castShadow = true;
    this.attach('chest', this.cape, -0.15, 0.1, 0);
  }
  update(e) {
    this.face(e.facing, 0.3);
    this.resetPose();
    const B = this.B;
    const s = Math.sin(e.animT * 0.05);
    B['upperarm.L'].rotation.z = 0.45 + s * 0.15; B['upperarm.R'].rotation.z = 0.45 - s * 0.15;
    B['upperarm.L'].rotation.x = 0.1; B['upperarm.R'].rotation.x = -0.1;
    B['forearm.L'].rotation.z = 0.4; B['forearm.R'].rotation.z = 0.4;
    B.jaw.rotation.z = e.mouthT ? -0.45 : -0.04;
    B['thigh.L'].rotation.z = s * 0.15; B['thigh.R'].rotation.z = -s * 0.15;
    B.chest.rotation.z = s * 0.03;
  }
}

// ================================================================== fábrica / pré-carregamento
const MAKERS = {
  zombie: () => new ZombieO(), crow: () => new CrowO(false), raven: () => new CrowO(true), plant: () => new PlantO(),
  arremer: () => new ArremerO(), knight: () => new KnightO(), pig: () => new PigO(), devil: () => new DevilO(false),
  lavadevil: () => new DevilO(true), bigman: () => new BigManO(), bat: () => new BatO(), skeleton: () => new SkeletonO(),
  magician: () => new MagicianO(), princess: () => new PrincessO(), unicorn: () => new UnicornO(), dragon: () => new DragonO(),
  satan: () => new SatanO(), astaroth: () => new AstarothO(),
};
const SPECIES_OF = { dragon: ['dragonhead', 'dragonseg'], skeleton: ['skeleton', 'skull'], satan: ['satan'], arremer: ['arremer'], crow: ['crow'], raven: ['raven'], lavadevil: ['lavadevil'] };

export function createCreature(type) { const f = MAKERS[type]; return f ? f() : null; }
export function hasCreature(type) { return !!MAKERS[type]; }
// Pré-carregamento: o Arthur é gerado na hora; as demais espécies da fase entram numa fila
// processada uma por quadro (durante a faixa "FASE X"), sem travar a entrada na fase.
const QUEUE = [];
export function prewarm(types) {
  const t0 = performance.now();
  for (const t of ['arthur', 'frog', 'bones']) getSpecies(t);
  for (const t of types) for (const k of SPECIES_OF[t] || [t]) if (SPECIES[k] && !BUILT.has(k) && !QUEUE.includes(k)) QUEUE.push(k);
  return performance.now() - t0;
}
export function prewarmStep() {
  const k = QUEUE.shift();
  if (k) getSpecies(k);
  return QUEUE.length;
}
