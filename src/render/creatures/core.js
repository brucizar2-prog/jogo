// Núcleo dos personagens esculpidos: materiais, montagem das malhas geradas pelos workers
// (SkinnedMesh + esqueleto), peças rígidas (olhos, chifres, dentes, armas), asas membranosas
// e o "modelo preguiçoso" que aparece assim que a escultura fica pronta (sem travar o jogo).
import * as THREE from 'three';
import { Model, M, G } from '../base.js';
import { getSpeciesData, requestAll, isReady, QUALITY } from '../meshgen.js';

const LOW = QUALITY > 1;

// ------------------------------------------------------------------ materiais
// luz de recorte azulada nas bordas (fresnel), aplicada a todos os materiais dos personagens
export const RIM = { color: new THREE.Color(0x9fb2ff), strength: { value: 1 } };
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

const DEFS = {
  skin: { roughness: 0.52, sheen: 0.45, sheenRoughness: 0.45, sheenColor: 0xffc8a8, clearcoat: 0.08, clearcoatRoughness: 0.5 },
  flesh: { roughness: 0.48, sheen: 0.35, sheenRoughness: 0.5, sheenColor: 0xffa8a8, clearcoat: 0.18, clearcoatRoughness: 0.45 },
  metal: { roughness: 0.26, metalness: 0.72, clearcoat: 0.6, clearcoatRoughness: 0.18 },
  darkmetal: { roughness: 0.36, metalness: 0.7, clearcoat: 0.35 },
  gold: { roughness: 0.28, metalness: 0.9, clearcoat: 0.45 },
  cloth: { roughness: 0.86, sheen: 0.8, sheenRoughness: 0.6, sheenColor: 0xffffff },
  leather: { roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 },
  hair: { roughness: 0.66, sheen: 0.7, sheenRoughness: 0.35, sheenColor: 0xffd0a0 },
  bone: { roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 },
  horn: { roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 },
  claw: { roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 },
  scales: { roughness: 0.38, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.3 },
  wood: { roughness: 0.85 },
  stone: { roughness: 0.95 },
  feather: { roughness: 0.6, sheen: 0.9, sheenRoughness: 0.3, sheenColor: 0x8090ff },
  plant: { roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: 0xd0ff90 },
  ghost: { roughness: 0.5, sheen: 1, sheenColor: 0xc0b8ff, emissive: 0x1c1838, transparent: true, opacity: 0.9 },
  shadow: { roughness: 0.95 },
  membrane: { roughness: 0.62, sheen: 0.4, sheenColor: 0xffb0a0, side: THREE.DoubleSide },
  sclera: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 },
  wet: { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 },
};
// mapa de reflexos de estúdio (céu claro, chão escuro, duas "softboxes"): dá contraste ao metal
let STUDIO = null;
export function initCharacterEnv(renderer) {
  if (STUDIO) return STUDIO;
  const sc = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y;
      vec3 c = mix(vec3(0.05,0.045,0.05), vec3(0.42,0.44,0.5), smoothstep(-0.25, 0.35, h));
      c = mix(c, vec3(0.75,0.78,0.86), smoothstep(0.55, 0.95, h));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  sc.add(sky);
  const box = (w, h, x, y, z, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  box(5, 3, -5, 4, 6, 0xfff0e0);
  box(3, 5, 7, 1, -3, 0x9fb4ff);
  box(6, 1.2, 0, 2, -8, 0xffffff);
  const pm = new THREE.PMREMGenerator(renderer);
  STUDIO = pm.fromScene(sc, 0.02).texture;
  for (const m of MATS.values()) { m.envMap = STUDIO; m.needsUpdate = true; }
  return STUDIO;
}
const ENV_INT = { metal: 1.25, darkmetal: 1, gold: 1.2, horn: 0.6, claw: 0.6, scales: 0.6, sclera: 0.8, wet: 0.8 };

const MATS = new Map();
function makeMat(name, color, extra) {
  const d = { ...(DEFS[name] || DEFS.skin), ...(extra || {}) };
  const base = color === undefined ? { vertexColors: true, color: 0xffffff } : { color };
  const o = { ...base };
  for (const k in d) {
    if (d[k] === undefined) continue;
    o[k] = (k === 'sheenColor' || k === 'emissive') && typeof d[k] === 'number' ? new THREE.Color(d[k]) : d[k];
  }
  let m;
  if (LOW) {
    const keep = ['vertexColors', 'color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity', 'transparent', 'opacity', 'depthWrite', 'side'];
    const s = {}; for (const k of keep) if (o[k] !== undefined) s[k] = o[k];
    m = new THREE.MeshStandardMaterial(s);
  } else m = new THREE.MeshPhysicalMaterial(o);
  if (STUDIO) m.envMap = STUDIO;
  m.envMapIntensity = ENV_INT[name] ?? 0.45;
  if (!d.emissiveIntensity || d.emissiveIntensity < 1.5) addRim(m, name === 'metal' || name === 'gold' || name === 'darkmetal' ? 0.32 : name === 'ghost' ? 0.9 : 0.5);
  m.name = name;
  return m;
}
// material com cores por vértice (camadas esculpidas)
export function mat(name) {
  const k = 'v:' + name;
  if (!MATS.has(k)) MATS.set(k, makeMat(name));
  return MATS.get(k);
}
// material de cor única (peças rígidas)
export function rmat(name, color, extra) {
  const k = name + ':' + color + (extra ? JSON.stringify(extra) : '');
  if (!MATS.has(k)) MATS.set(k, makeMat(name, color, extra));
  return MATS.get(k);
}
export const glowMat = (color, ei = 2.6) => rmat('sclera', color, { emissive: color, emissiveIntensity: ei, clearcoat: 0 });

// ------------------------------------------------------------------ espécies (geometria compartilhada)
const BUILT = new Map();
export function getSpecies(key) {
  if (BUILT.has(key)) return BUILT.get(key);
  const d = getSpeciesData(key);
  const layers = d.layers.map((L) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(L.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(L.normals, 3));
    g.setAttribute('color', new THREE.BufferAttribute(L.colors, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(L.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(L.skinWeight, 4));
    g.setIndex(new THREE.BufferAttribute(L.indices, 1));
    g.computeBoundingSphere();
    return { name: L.name, geometry: g, material: mat(L.mat) };
  });
  const sp = { key, bones: d.bones, rigid: d.rigid || [], scale: d.scale || 1, layers, ms: d.ms };
  BUILT.set(key, sp);
  return sp;
}

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

// ------------------------------------------------------------------ geometrias das peças rígidas
// tubo afunilado ao longo de uma lista de pontos (chifres, garras, dedos de asa)
function taperTube(pts, radii, radial = 9, cap = true) {
  const n = pts.length;
  const pos = [], nor = [], idx = [];
  const P = pts.map((p) => new THREE.Vector3(...p));
  let T = P[1].clone().sub(P[0]).normalize();
  const N = Math.abs(T.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  N.sub(T.clone().multiplyScalar(T.dot(N))).normalize();
  const B = new THREE.Vector3(), dir = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    T = b.clone().sub(a).normalize();
    N.sub(T.clone().multiplyScalar(T.dot(N))).normalize();
    B.crossVectors(T, N);
    const seg = a.distanceTo(b) || 1;
    const slope = (radii[Math.max(0, i - 1)] - radii[Math.min(n - 1, i + 1)]) / seg;
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      dir.copy(N).multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang));
      pos.push(P[i].x + dir.x * radii[i], P[i].y + dir.y * radii[i], P[i].z + dir.z * radii[i]);
      nn.copy(dir).addScaledVector(T, slope).normalize();
      nor.push(nn.x, nn.y, nn.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (cap) {
    const tip = P[n - 1].clone().addScaledVector(T, radii[n - 1]);
    const ti = pos.length / 3;
    pos.push(tip.x, tip.y, tip.z); nor.push(T.x, T.y, T.z);
    const base = (n - 1) * (radial + 1);
    for (let j = 0; j < radial; j++) idx.push(base + j, ti, base + j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
// chifre: curva quadrática a partir de 'at' na direção 'dir', com desvio 'bend' na ponta
function hornGeo(p) {
  return G('horn' + JSON.stringify([p.at, p.dir, p.len, p.r, p.bend, p.tip]), () => {
    const d = new THREE.Vector3(...p.dir).normalize();
    const pts = [], radii = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      pts.push([p.at[0] + d.x * p.len * t + p.bend[0] * t * t, p.at[1] + d.y * p.len * t + p.bend[1] * t * t, p.at[2] + d.z * p.len * t + p.bend[2] * t * t]);
      radii.push(p.r * ((1 - t) + p.tip * t) * (1 - 0.15 * t * t));
    }
    return taperTube(pts, radii, 10);
  });
}
function mergeGeos(list) {
  const pos = [], nor = [], idx = [];
  for (const g of list) {
    const off = pos.length / 3;
    const gp = g.attributes.position.array, gn = g.attributes.normal.array;
    for (let i = 0; i < gp.length; i++) { pos.push(gp[i]); nor.push(gn[i]); }
    const gi = g.index ? g.index.array : [...Array(gp.length / 3).keys()];
    for (let i = 0; i < gi.length; i++) idx.push(gi[i] + off);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}
const hash1 = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// fileira de dentes ao longo de z, acompanhando o arco da boca
function teethGeo(p) {
  return G('teeth' + JSON.stringify(p), () => {
    const list = [];
    for (let i = 0; i < p.count; i++) {
      const u = p.count > 1 ? i / (p.count - 1) - 0.5 : 0;
      const len = p.len * (1 - p.jag * hash1(i + p.count * 3)) * (p.fang && (i === 0 || i === p.count - 1) ? 1.6 : 1);
      const c = new THREE.ConeGeometry(p.r * (0.85 + 0.3 * hash1(i * 7 + 1)), len, 7, 1);
      c.translate(0, -len / 2, 0);                       // base em y=0, ponta para baixo
      if (p.dir < 0) c.rotateX(Math.PI);                 // dentes de baixo apontam para cima
      c.rotateZ(p.tilt + (hash1(i * 3 + 2) - 0.5) * 0.25);
      c.rotateY(-u * p.wrap);
      c.translate(p.at[0] - p.curve * (2 * u) * (2 * u), p.at[1], p.at[2] + u * p.span);
      list.push(c);
    }
    return mergeGeos(list);
  });
}
// olho: esclera + íris + pupila + brilho (ou esfera luminosa)
function eyeGroup(p) {
  const g = new THREE.Group();
  const r = p.r;
  if (p.glow) {
    const m = new THREE.Mesh(G('eg' + r, () => new THREE.SphereGeometry(r, 14, 10)), glowMat(p.glow, p.ei ?? 2.4));
    g.add(m);
    if (p.pupil !== false) {
      const pu = new THREE.Mesh(G('egp' + r, () => { const s = new THREE.SphereGeometry(r * 1.01, 12, 6, 0, Math.PI * 2, 0, 0.42); s.rotateZ(-Math.PI / 2); return s; }), glowMat(p.core ?? 0xfff6c0, 3.2));
      g.add(pu);
    }
  } else {
    g.add(new THREE.Mesh(G('es' + r, () => new THREE.SphereGeometry(r, 18, 12)), rmat('sclera', p.sclera ?? 0xf2ece0)));
    const ir = new THREE.Mesh(G('ei' + r + (p.irisSize || 0.62), () => { const s = new THREE.SphereGeometry(r * 1.012, 18, 6, 0, Math.PI * 2, 0, p.irisSize || 0.62); s.rotateZ(-Math.PI / 2); return s; }),
      p.irisGlow ? glowMat(p.iris, p.irisGlow) : rmat('sclera', p.iris ?? 0x4a3018));
    g.add(ir);
    const pu = new THREE.Mesh(G('ep' + r + (p.pupilSize || 0.3), () => { const s = new THREE.SphereGeometry(r * 1.02, 14, 4, 0, Math.PI * 2, 0, p.pupilSize || 0.3); s.rotateZ(-Math.PI / 2); return s; }), rmat('sclera', 0x080606));
    g.add(pu);
    const hl = new THREE.Mesh(G('eh' + r, () => new THREE.SphereGeometry(r * 0.16, 8, 6)), glowMat(0xffffff, 1.4));
    hl.position.set(r * 0.86, r * 0.38, r * 0.22);
    g.add(hl);
  }
  if (p.look) { const d = new THREE.Vector3(...p.look).normalize(); g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d); }
  if (p.squash) g.scale.set(...p.squash);
  return g;
}
// objetos especiais (armas, escudos, acessórios) montados em coordenadas locais
function objMesh(p) {
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  const steel = rmat('metal', 0xd8dee8), dark = rmat('darkmetal', 0x4a4a52), gold = rmat('gold', 0xe0a83a), wood = rmat('wood', 0x6a4424), leather = rmat('leather', 0x5a3018);
  switch (p.kind) {
    case 'sword': {      // lâmina ao longo de +y, punho na origem
      add(G('sw-grip', () => new THREE.CylinderGeometry(0.022, 0.024, 0.16, 8)), leather, 0, 0, 0);
      add(G('sw-pom', () => new THREE.SphereGeometry(0.034, 10, 8)), gold, 0, -0.095, 0);
      add(G('sw-guard', () => new THREE.BoxGeometry(0.05, 0.035, 0.2)), gold, 0, 0.09, 0);
      add(G('sw-blade', () => {
        const s = new THREE.Shape(); s.moveTo(-0.032, 0); s.lineTo(-0.028, 0.5); s.lineTo(0, 0.6); s.lineTo(0.028, 0.5); s.lineTo(0.032, 0); s.closePath();
        const e = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
        e.translate(0, 0, -0.006); e.rotateY(Math.PI / 2); return e;
      }), steel, 0, 0.1, 0);
      break;
    }
    case 'shield': {     // escudo redondo voltado para +z
      const R = p.R || 0.3;
      add(G('sh-dish' + R, () => { const s = new THREE.SphereGeometry(R * 1.6, 28, 8, 0, Math.PI * 2, 0, 0.66); s.scale(1, 0.35, 1); s.translate(0, -R * 1.6 * 0.35 * Math.cos(0.66), 0); s.rotateX(Math.PI / 2); return s; }), rmat('wood', 0x7a5a3a, { side: THREE.DoubleSide }), 0, 0, 0);
      add(G('sh-rim' + R, () => new THREE.TorusGeometry(R * 1.6 * Math.sin(0.66), 0.025, 8, 32)), rmat('darkmetal', 0x8a8478), 0, 0, 0);
      add(G('sh-boss' + R, () => { const s = new THREE.SphereGeometry(R * 0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); s.rotateX(Math.PI / 2); return s; }), gold, 0, 0, R * 0.14);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = R * 1.6 * Math.sin(0.66) * 0.82; add(G('sh-stud', () => new THREE.SphereGeometry(0.018, 8, 6)), gold, Math.cos(a) * rr, Math.sin(a) * rr, 0.035); }
      break;
    }
    case 'scythe': {     // cabo ao longo de +y, lâmina no topo apontando para +x
      add(G('sc-shaft', () => { const c = new THREE.CylinderGeometry(0.026, 0.03, 1.9, 8); c.translate(0, 0.95, 0); return c; }), rmat('wood', 0x5a3c22), 0, 0, 0);
      add(G('sc-blade', () => {
        const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.42, 0.22, 0.78, -0.18); s.quadraticCurveTo(0.42, 0.06, 0, -0.1); s.closePath();
        const e = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 1 });
        e.translate(0, 0, -0.007); e.rotateY(Math.PI); return e;
      }), rmat('metal', 0xc8ccd4), 0.02, 1.86, 0);
      add(G('sc-cap', () => new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8)), dark, 0, 1.84, 0);
      break;
    }
    case 'flail': {      // cabo ao longo de -y a partir da mão; bola com cravos
      add(G('fl-handle', () => { const c = new THREE.CylinderGeometry(0.04, 0.04, 0.32, 8); c.translate(0, -0.08, 0); return c; }), wood, 0, 0, 0);
      const ball = new THREE.Group(); ball.position.set(0, -0.62, 0); g.add(ball); g.userData.ball = ball;
      const bm = new THREE.Mesh(G('fl-ball', () => new THREE.IcosahedronGeometry(0.17, 2)), dark); bm.castShadow = true; ball.add(bm);
      for (let i = 0; i < 14; i++) {
        const sp = new THREE.Mesh(G('fl-sp', () => new THREE.ConeGeometry(0.035, 0.12, 8)), steel);
        const d = new THREE.Vector3(Math.sin(i * 2.4) * Math.cos(i * 1.3), Math.cos(i * 2.4 + 0.3), Math.sin(i * 2.4) * Math.sin(i * 1.3)).normalize();
        sp.position.copy(d.clone().multiplyScalar(0.17)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); ball.add(sp);
      }
      for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(G('fl-link', () => new THREE.TorusGeometry(0.035, 0.012, 6, 10)), dark); l.position.set(0, -0.26 - i * 0.07, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); }
      break;
    }
    case 'lance': {      // lança de justa ao longo de +x
      add(G('ln-cone', () => { const c = new THREE.ConeGeometry(0.075, 1.4, 12); c.rotateZ(-Math.PI / 2); c.translate(0.7, 0, 0); return c; }), steel, 0, 0, 0);
      add(G('ln-vam', () => { const c = new THREE.ConeGeometry(0.14, 0.2, 14, 1, true); c.rotateZ(Math.PI / 2); return c; }), rmat('metal', 0xb0a0e0), 0.02, 0, 0);
      add(G('ln-grip', () => { const c = new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8); c.rotateZ(Math.PI / 2); c.translate(-0.2, 0, 0); return c; }), leather, 0, 0, 0);
      break;
    }
    case 'kshield': {    // escudo de cavaleiro (formato de gota) voltado para +z
      add(G('ks-body', () => {
        const s = new THREE.Shape(); s.moveTo(0, 0.3); s.quadraticCurveTo(0.24, 0.3, 0.24, 0.08); s.quadraticCurveTo(0.22, -0.2, 0, -0.38); s.quadraticCurveTo(-0.22, -0.2, -0.24, 0.08); s.quadraticCurveTo(-0.24, 0.3, 0, 0.3);
        const e = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2 });
        e.translate(0, 0, -0.015); return e;
      }), rmat('metal', 0xc8c4e8), 0, 0, 0);
      add(G('ks-emb', () => { const s = new THREE.Shape(); s.moveTo(0, 0.16); s.lineTo(0.1, -0.02); s.lineTo(0, -0.2); s.lineTo(-0.1, -0.02); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); }), rmat('cloth', 0xb02030), 0, 0, 0.03);
      break;
    }
    case 'onion': {      // lança de cebolinha do porco
      add(G('on-stalk', () => { const c = new THREE.CylinderGeometry(0.026, 0.03, 0.9, 8); c.rotateZ(Math.PI / 2); return c; }), rmat('plant', 0x5ac838), 0, 0, 0);
      const b = add(G('on-bulb', () => new THREE.SphereGeometry(0.09, 16, 12)), rmat('wet', 0xf2f0e2), -0.48, 0, 0); b.scale.set(1.25, 1, 1);
      break;
    }
    case 'pot': {
      add(G('pot-body', () => { const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.02 + Math.sin(t * Math.PI) * 0.2 + (t > 0.85 ? (t - 0.85) * 0.6 : 0), t * 0.42 - 0.2)); } return new THREE.LatheGeometry(pts, 20); }), rmat('stone', 0x9a6a34), 0, 0, 0);
      const rim = add(G('pot-rim', () => new THREE.TorusGeometry(0.11, 0.025, 8, 20)), gold, 0, 0.21, 0); rim.rotation.x = Math.PI / 2;
      break;
    }
    case 'orb': {
      add(G('orb' + (p.r || 0.1), () => new THREE.SphereGeometry(p.r || 0.1, 16, 12)), glowMat(p.col ?? 0x60ffe0, 3), 0, 0, 0);
      break;
    }
    default: break;
  }
  return g;
}

function buildRigid(p) {
  let o;
  if (p.t === 'eye') o = eyeGroup(p);
  else if (p.t === 'stud') { o = new THREE.Mesh(G('stud' + p.r, () => new THREE.SphereGeometry(p.r, 10, 8)), rmat(p.mat, p.col)); }
  else if (p.t === 'horn') { o = new THREE.Mesh(hornGeo(p), rmat(p.mat, p.col)); o.userData.modelSpace = true; }
  else if (p.t === 'teeth') { o = new THREE.Mesh(teethGeo(p), rmat('bone', p.col)); o.userData.modelSpace = true; }
  else if (p.t === 'obj') { o = objMesh(p); o.rotation.set(...p.rot); o.scale.setScalar(p.scale); }
  o.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return o;
}

// espécie sem esqueleto (malhas comuns + peças rígidas) — caveira, ossada, segmentos
export function staticSpecies(key) {
  const sp = getSpecies(key);
  const g = new THREE.Group();
  for (const L of sp.layers) { const m = new THREE.Mesh(L.geometry, L.material); m.castShadow = true; m.receiveShadow = true; m.name = L.name; g.add(m); }
  for (const p of sp.rigid) {
    const o = buildRigid(p);
    if (!o.userData.modelSpace) o.position.set(p.at[0], p.at[1], p.at[2]);
    g.add(o);
  }
  g.scale.setScalar(sp.scale);
  return g;
}

// ------------------------------------------------------------------ modelo
export class OrganicModel extends Model {
  constructor(key) {
    super();
    const sp = getSpecies(key);
    const inst = instantiate(sp);
    this.body = inst.group;
    this.body.scale.setScalar(sp.scale);
    this.inner.add(inst.group);
    this.B = inst.bones; this.rest = inst.rest; this.L = inst.meshes; this.skel = inst.skeleton;
    this.parts = {};
    this.layerParts = {};
    for (const p of sp.rigid) this.addRigid(p);
  }
  addRigid(p) {
    const o = buildRigid(p);
    if (o.userData.modelSpace) this.attachRigid(p.bone, o);
    else this.attach(p.bone, o, p.at[0], p.at[1], p.at[2]);
    if (p.name) this.parts[p.name] = o;
    if (p.layer) (this.layerParts[p.layer] ||= []).push(o);
    return o;
  }
  // mostra/esconde uma camada esculpida junto com as peças rígidas ligadas a ela
  showLayer(name, vis) {
    if (this.L[name]) this.L[name].visible = vis;
    for (const o of this.layerParts[name] || []) o.visible = vis;
  }
  resetPose() {
    for (const k in this.B) { const b = this.B[k]; b.rotation.set(0, 0, 0); b.position.copy(this.rest[k].pos); b.scale.set(1, 1, 1); }
  }
  // prende um objeto a um osso numa posição dada em coordenadas do modelo em repouso
  attach(bone, obj, x, y, z) {
    const w = this.rest[bone].world;
    obj.position.set(x - w.x, y - w.y, z - w.z);
    this.B[bone].add(obj);
    return obj;
  }
  // prende um objeto cuja geometria já está em coordenadas do modelo
  attachRigid(bone, obj) {
    const w = this.rest[bone].world;
    obj.position.set(obj.position.x - w.x, obj.position.y - w.y, obj.position.z - w.z);
    this.B[bone].add(obj);
    return obj;
  }
  rot(name, x = 0, y = 0, z = 0) { const b = this.B[name]; if (b) b.rotation.set(x, y, z); }
}

// ------------------------------------------------------------------ asas membranosas
// contorno com bordas recortadas entre os "dedos", levemente côncavo; plano x-y do modelo
export function membraneGeo(root, tips, opts = {}) {
  return G('mem' + JSON.stringify([root, tips, opts]), () => {
    const s = new THREE.Shape();
    s.moveTo(root[0], root[1]);
    s.lineTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < tips.length; i++) {
      const a = tips[i - 1], b = tips[i];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const sc = opts.scallop ?? 0.32;
      s.quadraticCurveTo(mx + (root[0] - mx) * sc, my + (root[1] - my) * sc, b[0], b[1]);
    }
    const end = opts.end || [root[0] - 0.05, root[1] - 0.15];
    const last = tips[tips.length - 1];
    s.quadraticCurveTo((last[0] + end[0]) / 2 + 0.05, (last[1] + end[1]) / 2 - 0.05, end[0], end[1]);
    s.closePath();
    const g = new THREE.ShapeGeometry(s, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - root[0], dy = p.getY(i) - root[1];
      p.setZ(i, (opts.cup ?? 0.1) * (dx * dx + dy * dy));
    }
    g.computeVertexNormals();
    return g;
  });
}
export function rod(a, b, r1, r2, material, seg = 8) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const g = G(`rod${r1},${r2},${len.toFixed(3)},${seg}`, () => { const c = new THREE.CylinderGeometry(r2, r1, len, seg, 1); c.translate(0, len / 2, 0); return c; });
  const m = new THREE.Mesh(g, material);
  m.position.set(a[0], a[1], a[2]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  m.castShadow = true;
  return m;
}
// asa presa a um osso: membrana + "dedos" afunilados com nós; side: +1 (+z, 'R') / -1 (-z, 'L')
export function addWing(model, bone, side, root, tips, o = {}) {
  const w = model.rest[bone].world;
  const z = o.z ?? w.z;
  const grp = new THREE.Group();
  grp.position.set(-w.x, -w.y, z - w.z);
  const mm = rmat('membrane', o.color ?? 0x2a3a6a, o.e ? { emissive: o.e } : undefined);
  const mem = new THREE.Mesh(membraneGeo(root, tips, { scallop: o.scallop ?? 0.32, cup: (o.cup ?? 0.1) * side, end: o.end }), mm);
  mem.castShadow = true;
  grp.add(mem);
  if (o.fingers !== false) {
    const fm = rmat(o.boneMat || 'flesh', o.boneColor ?? 0x3a2a40);
    const fr = o.fr ?? 0.03;
    for (const t of tips) {
      const pts = [], radii = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        pts.push([root[0] + (t[0] - root[0]) * k, root[1] + (t[1] - root[1]) * k + Math.sin(k * Math.PI) * 0.04 * (o.arch ?? 1), 0.012 * side]);
        radii.push(fr * (1 - k * 0.75));
      }
      const f = new THREE.Mesh(G('wf' + JSON.stringify([root, t, fr, side, o.arch]), () => taperTube(pts, radii, 7)), fm);
      f.castShadow = true;
      grp.add(f);
    }
    if (o.claw !== false) {
      const top = tips[0];
      const c = new THREE.Mesh(hornGeo({ at: [top[0], top[1], 0.012 * side], dir: [top[0] - root[0], top[1] - root[1], 0], len: fr * 3.5, r: fr * 0.9, bend: [0, -fr * 1.5, 0], tip: 0.06 }), rmat('claw', o.clawColor ?? 0xf0e6cc));
      grp.add(c);
    }
  }
  model.B[bone].add(grp);
  return grp;
}
// angle: 0 = asa erguida no plano do corpo; positivo = dobrada em direção à câmera
export function wingPose(model, angle, sweep = 0) {
  for (const [n, s] of [['wing.R', 1], ['wing.L', -1]]) { const b = model.B[n]; if (b) { b.rotation.x = s * angle; b.rotation.z = sweep; } }
}

// ------------------------------------------------------------------ modelo "preguiçoso"
// Mostra o personagem assim que todas as suas espécies estiverem esculpidas (pelos workers);
// até lá é um grupo vazio que recebe posição/atualizações normalmente.
export class LazyModel {
  constructor(keys, make) {
    this.obj = new THREE.Group();
    this.real = null;
    this._facing = undefined;
    const done = () => {
      this.real = make();
      this.obj.add(this.real.obj);
      if (this._facing !== undefined) this.real.face(this._facing, undefined, true);
    };
    if (keys.every(isReady)) done();
    else requestAll(keys).then(done);
  }
  update(...a) { if (this.real) this.real.update(...a); }
  face(f, bias, instant) { this._facing = f; if (this.real) this.real.face(f, bias, instant); }
  setFlash(on) { if (this.real) this.real.setFlash(on); }
  setOpacity(a) { if (this.real) this.real.setOpacity(a); }
  get lightReq() { return this.real ? this.real.lightReq : undefined; }
}

export { M, G };
