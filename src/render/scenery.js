// Constrói o cenário 3D de uma fase a partir dos dados medidos do arcade.
// O plano de jogo fica em z=0; 1 unidade = 1 tile (16px); y do mundo = -y do arcade / 16.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeoBuilder, greedyRects, prng } from './geom.js';
import { tex } from './textures.js';

const X = (x) => x / 16;
const ni = (g) => (g.index ? g.toNonIndexed() : g);
const Y = (y) => -y / 16;

export const THEMES = {
  graveyard: { bg: 0x070a1c, fog: [0x10142c, 0.016], hemi: [0x6a78c0, 0x2a1a10, 0.75], moon: [0xc8d6ff, 2.2], moonDir: [-0.5, 0.9, 0.55], sky: ['#02040f', '#141433', '#3a2846'], outdoor: true, mist: true },
  town: { bg: 0x060918, fog: [0x0d1430, 0.013], hemi: [0x6a86c8, 0x201a18, 0.75], moon: [0xd0dcff, 2.2], moonDir: [0.4, 0.9, 0.5], sky: ['#02030c', '#0e1838', '#2a3a5c'], outdoor: true },
  cave: { bg: 0x060302, fog: [0x0a0604, 0.02], hemi: [0x907060, 0x100604, 0.7], moon: [0xffd0a0, 1.2], moonDir: [0.3, 0.7, 0.8], outdoor: false, dust: true },
  lava: { bg: 0x0c0302, fog: [0x1a0603, 0.012], hemi: [0xb06040, 0x300800, 0.7], moon: [0xffa060, 1.1], moonDir: [-0.2, 0.6, 0.8], outdoor: false, embers: true },
  tower: { bg: 0x08070a, fog: [0x0c0a10, 0.014], hemi: [0x9a90b0, 0x1a1010, 0.9], moon: [0xd8c8ff, 1.3], moonDir: [0.5, 0.8, 0.6], outdoor: false, dust: true },
  castle: { bg: 0x07070b, fog: [0x0b0b12, 0.014], hemi: [0x9ca0c0, 0x181420, 1.0], moon: [0xd0d8ff, 1.4], moonDir: [-0.4, 0.8, 0.6], outdoor: false, dust: true },
  throne: { bg: 0x0b0406, fog: [0x140608, 0.012], hemi: [0xa08090, 0x200808, 0.85], moon: [0xffd0c0, 1.5], moonDir: [0.2, 0.8, 0.7], outdoor: false },
};

// Luzes do cenário são "virtuais": o renderer escolhe a cada quadro as mais próximas da câmera
// e as atribui a um pool fixo de PointLights (número de luzes constante = shaders estáveis e leves).
let LIGHTS = [];
function vlight(x, y, z, color, intensity, dist, decay = 2) {
  const l = { x, y, z, color, intensity, base: intensity, dist, decay };
  LIGHTS.push(l);
  return l;
}

const matCache = new Map();
function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}
function stdTex(name, o = {}) {
  return mat('std:' + name + JSON.stringify(o), () => new THREE.MeshStandardMaterial({ map: tex(name), roughness: o.r ?? 0.92, metalness: o.m ?? 0, color: o.color ?? 0xffffff, vertexColors: false, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, flatShading: !!o.flat, side: o.side ?? THREE.FrontSide }));
}
function plain(color, o = {}) {
  return mat('plain:' + color + JSON.stringify(o), () => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.85, metalness: o.m ?? 0, flatShading: o.flat ?? true, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide }));
}

// -------------------------------------------------------------------------------- céu
function makeSky(theme) {
  const [top, mid, low] = theme.sky;
  const geo = new THREE.SphereGeometry(500, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { cTop: { value: new THREE.Color(top) }, cMid: { value: new THREE.Color(mid) }, cLow: { value: new THREE.Color(low) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `varying vec3 vP; uniform vec3 cTop,cMid,cLow;
      void main(){ float h = vP.y; vec3 c = h>0.08 ? mix(cMid,cTop,smoothstep(0.08,0.6,h)) : mix(cLow,cMid,smoothstep(-0.25,0.08,h));
      gl_FragColor = vec4(c,1.0); }`,
  });
  const sky = new THREE.Mesh(geo, m);
  sky.renderOrder = -10;
  const g = new THREE.Group();
  g.add(sky);
  // estrelas
  const rnd = prng(77);
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const th = rnd() * Math.PI * 2, ph = rnd() * 0.45 + 0.08;
    const r = 480;
    pts.push(Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(th) * Math.cos(ph) * r);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdde6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  g.add(stars);
  // lua
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('moonglow'), fog: false, depthWrite: false, transparent: true, color: 0xffffff }));
  moon.scale.set(150, 150, 1);
  moon.position.set(-150, 100, -380);
  g.add(moon);
  return g;
}

// -------------------------------------------------------------------------------- montanhas distantes (com o castelo no alto, como no fundo do arcade)
function mountains(group, x0, x1, rnd, opts = {}) {
  const base = opts.base ?? -20, zc = opts.z ?? -110;
  const m = mat('mount' + (opts.color ?? 0), () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog: false }));
  const geos = [];
  const colLow = new THREE.Color(0x141626), colHigh = new THREE.Color(opts.color ?? 0x6a6e8a);
  for (let x = x0; x < x1; x += 22 + rnd() * 30) {
    const h = 9 + rnd() * 14, r = 9 + rnd() * 9;
    const c = new THREE.ConeGeometry(r, h, 9, 5).toNonIndexed();
    const p = c.attributes.position;
    const cols = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = (y + h / 2) / h;
      if (k < 0.98) { const j = 1 + (Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 1.7 + x) * 0.18); p.setX(i, p.getX(i) * j); p.setZ(i, p.getZ(i) * j); }
      const cc = colLow.clone().lerp(colHigh, Math.pow(k, 1.6));
      cols.push(cc.r, cc.g, cc.b);
    }
    c.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const z = zc - rnd() * 30;
    c.translate(x, base + h / 2, z);
    geos.push(c);
    if (rnd() < 0.25) {
      // pequeno castelo no pico (aceno ao fundo do arcade)
      const k = new THREE.BoxGeometry(1.0, 1.8, 0.8).toNonIndexed(); k.translate(x, base + h + 0.4, z);
      const k2 = new THREE.ConeGeometry(0.6, 1.2, 4).toNonIndexed(); k2.translate(x, base + h + 1.9, z);
      for (const g of [k, k2]) { const n = g.attributes.position.count; g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0.25), 3)); geos.push(g); }
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), m);
  group.add(mesh);
}

// -------------------------------------------------------------------------------- árvores
function deadTree(rnd, scale = 1) {
  const geos = [];
  const branch = (x, y, z, ang, len, rad, depth) => {
    const c = new THREE.CylinderGeometry(rad * 0.62, rad, len, 5);
    c.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.5, 0, ang));
    c.applyQuaternion(q);
    c.translate(x, y, z);
    geos.push(c);
    const tip = new THREE.Vector3(0, len, 0).applyQuaternion(q).add(new THREE.Vector3(x, y, z));
    if (depth > 0) {
      const n = depth > 2 ? 2 : 2 + (rnd() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) branch(tip.x, tip.y, tip.z, ang + (rnd() - 0.5) * 1.6, len * (0.55 + rnd() * 0.2), rad * 0.6, depth - 1);
    }
  };
  branch(0, 0, 0, (rnd() - 0.5) * 0.3, 2.4 * scale, 0.28 * scale, 4);
  return mergeGeometries(geos.map(ni));
}

function bigTree(rnd, h) {
  const trunk = new THREE.CylinderGeometry(0.9, 1.5, h, 9, 4);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + Math.sin(y * 1.3 + i) * 0.06)); }
  trunk.translate(0, h / 2, 0);
  const canopy = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.IcosahedronGeometry(2.6 + rnd() * 1.8, 1);
    const q = s.attributes.position;
    for (let k = 0; k < q.count; k++) { const f = 0.85 + rnd() * 0.3; q.setXYZ(k, q.getX(k) * f, q.getY(k) * f * 0.8, q.getZ(k) * f); }
    s.translate((rnd() - 0.5) * 6, h - 0.5 + rnd() * 2.5, (rnd() - 0.5) * 3);
    canopy.push(s);
  }
  return { trunk, canopy: mergeGeometries(canopy.map(ni)) };
}

// -------------------------------------------------------------------------------- objetos
function tombGeo(w = 1, h = 1, kind = 0) {
  const geos = [];
  const body = new THREE.BoxGeometry(w * 0.86, h * 0.72, 0.5, 2, 2, 1);
  body.translate(0, h * 0.36, 0);
  geos.push(body);
  const top = new THREE.CylinderGeometry(w * 0.43, w * 0.43, 0.5, 12, 1, false, 0, Math.PI);
  top.rotateX(Math.PI / 2); top.rotateZ(Math.PI / 2);
  top.translate(0, h * 0.72, 0);
  geos.push(top);
  const base = new THREE.BoxGeometry(w, 0.14, 0.7);
  base.translate(0, 0.07, 0);
  geos.push(base);
  if (kind === 1) {
    const c1 = new THREE.BoxGeometry(0.1, 0.42, 0.06); c1.translate(0, h * 0.55, 0.27);
    const c2 = new THREE.BoxGeometry(0.3, 0.1, 0.06); c2.translate(0, h * 0.62, 0.27);
    geos.push(c1, c2);
  }
  return mergeGeometries(geos.map(ni));
}

function crossGeo(h = 1.4) {
  const a = new THREE.BoxGeometry(0.16, h, 0.16); a.translate(0, h / 2, 0);
  const b = new THREE.BoxGeometry(0.7, 0.16, 0.16); b.translate(0, h * 0.72, 0);
  return mergeGeometries([a, b].map(ni));
}

function fenceGeo(len) {
  const geos = [];
  for (let x = 0; x <= len; x += 0.3) {
    const p = new THREE.BoxGeometry(0.05, 0.75, 0.05); p.translate(x, 0.37, 0); geos.push(p);
    const t = new THREE.ConeGeometry(0.06, 0.16, 4); t.translate(x, 0.82, 0); geos.push(t);
  }
  const r1 = new THREE.BoxGeometry(len, 0.05, 0.05); r1.translate(len / 2, 0.6, 0); geos.push(r1);
  const r2 = new THREE.BoxGeometry(len, 0.05, 0.05); r2.translate(len / 2, 0.2, 0); geos.push(r2);
  return mergeGeometries(geos.map(ni));
}

function ladderGeo(height, style) {
  const geos = [];
  const railW = style === 'iron' ? 0.08 : 0.1;
  for (const sx of [-0.42, 0.42]) {
    const r = new THREE.BoxGeometry(railW, height, railW); r.translate(sx, height / 2, 0); geos.push(r);
  }
  for (let y = 0.2; y < height; y += 0.32) {
    const r = new THREE.BoxGeometry(0.84, 0.07, 0.08); r.translate(0, y, 0); geos.push(r);
  }
  return mergeGeometries(geos.map(ni));
}

// -------------------------------------------------------------------------------- fachadas (fase 2)
function building(group, o) {
  // o: x0,x1 (px), ground (px y), h (px), style, z, roof
  const w = X(o.x1) - X(o.x0), h = o.h / 16;
  const x = (X(o.x0) + X(o.x1)) / 2, yb = Y(o.ground);
  const d = o.depth ?? 3;
  const z = o.z ?? -2.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdTex(o.style || 'house'));
  body.material = stdTex(o.style || 'house');
  // repete a textura proporcional ao tamanho
  const uv = body.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * h / 4);
  body.position.set(x, yb + h / 2, z - d / 2);
  body.receiveShadow = true; body.castShadow = true;
  group.add(body);
  if (o.roof) {
    const rh = o.roofH ?? 2.2;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - 0.3, 0); shape.lineTo(w / 2 + 0.3, 0);
    if (o.roof === 'gable') shape.lineTo(0, rh); else { shape.lineTo(w / 2 - 0.6, rh); shape.lineTo(-w / 2 + 0.6, rh); }
    shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.4, bevelEnabled: false });
    const ruv = rg.attributes.uv; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) * 0.3, ruv.getY(i) * 0.3);
    const roof = new THREE.Mesh(rg, stdTex(o.roofTex || 'roof', { r: 0.7 }));
    roof.position.set(x, yb + h, z - d - 0.2);
    roof.castShadow = true;
    group.add(roof);
    if (o.dormers) for (let i = 0; i < o.dormers; i++) {
      const dx = X(o.x0) + (i + 0.5) * (w / o.dormers);
      const dm = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.1, 4), plain(0x6c6458));
      dm.position.set(dx, yb + h + rh * 0.45, z + 0.2); dm.rotation.y = Math.PI / 4;
      group.add(dm);
    }
  }
  // janelas
  if (o.windows) {
    const wm = new THREE.MeshStandardMaterial({ map: tex('window'), roughness: 0.4, emissive: 0x1d4a44, emissiveIntensity: 0.6 });
    const lm = new THREE.MeshStandardMaterial({ map: tex('litwindow'), roughness: 0.4, emissive: 0xffa040, emissiveMap: tex('litwindow'), emissiveIntensity: 1.6 });
    const { cols, rows, w: ww = 1.1, h: wh = 1.5, y0 = 1.2, gap } = o.windows;
    const rnd = prng(Math.floor(o.x0));
    const geoW = new THREE.PlaneGeometry(ww, wh);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wx = X(o.x0) + (c + 0.5) * (w / cols);
      const wy = yb + y0 + r * (gap ?? ((h - y0 - 0.8) / Math.max(1, rows - 1 || 1)));
      if (wy + wh / 2 > yb + h - 0.2) continue;
      const lit = rnd() < 0.18;
      const m = new THREE.Mesh(geoW, lit ? lm : wm);
      m.position.set(wx, wy, z + 0.02);
      group.add(m);
      if (lit && rnd() < 0.35) vlight(wx, wy, z + 1.2, 0xffa050, 6, 6);
    }
  }
}

// -------------------------------------------------------------------------------- água e lava
function waterMaterial(color = 0x0a2a6a) {
  return new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } }]),
    vertexShader: `varying vec3 vW; varying vec2 vUv;
#include <fog_pars_vertex>
uniform float uTime;
      void main(){ vUv=uv; vec3 p=position; vec4 w=modelMatrix*vec4(p,1.0);
        w.y += sin(w.x*1.7+uTime*2.0)*0.05+sin(w.z*2.3+uTime*1.3)*0.04; vW=w.xyz;
        vec4 mvPosition = viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `varying vec3 vW; varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
#include <fog_pars_fragment>
void main(){ float r = sin(vW.x*3.1+uTime*2.2+sin(vW.z*2.0+uTime))*0.5+0.5;
        float r2 = sin(vW.x*7.3-uTime*3.0+vW.z*4.0)*0.5+0.5;
        vec3 c = uColor*(0.65+0.5*r) + vec3(0.25,0.4,0.7)*pow(r2,8.0)*0.6;
        float spark = pow(max(0.0, sin(vW.x*11.0+uTime*4.0)*sin(vW.z*9.0-uTime*2.5)), 12.0);
        c += vec3(0.7,0.8,1.0)*spark*0.8;
        gl_FragColor=vec4(c,0.88);
#include <fog_fragment>
}`,
  });
}

function lavaMaterial() {
  const t = tex('lava');
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uMap: { value: t } }]),
    vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
uniform float uTime;
      void main(){ vec4 w=modelMatrix*vec4(position,1.0); w.y += sin(w.x*1.1+uTime*1.5)*0.08+sin(w.z*1.7-uTime)*0.06; vW=w.xyz;
        vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform sampler2D uMap;
#include <fog_pars_fragment>
void main(){ vec2 uv = vW.xz*0.12 + vec2(uTime*0.02, uTime*0.013);
        vec2 d = vec2(sin(vW.z*1.3+uTime)*0.03, cos(vW.x*1.1+uTime*0.7)*0.03);
        vec3 c = texture2D(uMap, uv+d).rgb; vec3 c2 = texture2D(uMap, uv*0.5-d+vec2(0.3,0.1)).rgb;
        vec3 col = (c*0.7+c2*0.5)*1.15; col += vec3(0.6,0.12,0.02)*0.25;
        gl_FragColor=vec4(col,1.0);
#include <fog_fragment>
}`,
  });
}

// -------------------------------------------------------------------------------- construção principal
export function buildScenery(level, data, renderer) {
  LIGHTS = [];
  const theme = THEMES[data.theme] || THEMES.graveyard;
  const root = new THREE.Group();
  const anim = [];          // funções update(t, camX, camY)
  const rnd = prng(data.id * 1013 + 7);
  const W = level.w, H = level.h;
  const PAD = 12;
  const T = (tx, ty) => level.tile(Math.max(0, Math.min(W - 1, tx)), ty);
  const solidAt = (tx, ty) => (tx >= -PAD && tx < W + PAD && ty >= 0 && ty < H) && T(tx, ty) === 1;

  // ------------------------------------------- materiais por tema/zona
  const zoneOf = (tx, ty) => {
    if (data.id === 3) return tx < 64 ? 'brown' : 'teal';
    if (data.id === 4) return tx < 8 && ty > 9 ? 'teal' : 'brown';
    if (data.id === 6) return ty >= 51 ? 'tan' : 'castle';
    return 'main';
  };
  const terrainMats = {
    1: { main: { top: 'grass', front: 'dirt', side: 'dirt' } },
    2: { main: { top: 'street', front: 'street', side: 'street' } },
    3: { brown: { top: 'brownrock', front: 'brownrock', side: 'brownrock' }, teal: { top: 'tealrock', front: 'tealrock', side: 'tealrock' } },
    4: { brown: { top: 'brownrock', front: 'brownrock', side: 'brownrock' }, teal: { top: 'tealrock', front: 'tealrock', side: 'tealrock' } },
    5: { main: { top: 'tanrock', front: 'tanrock', side: 'tanrock' } },
    6: { castle: { top: 'castle', front: 'castle', side: 'castle' }, tan: { top: 'tanrock', front: 'tanrock', side: 'tanrock' } },
    7: { main: { top: 'castle', front: 'castle', side: 'castle' } },
  }[data.id];
  const materials = { default: stdTex('stone') };
  for (const z in terrainMats) for (const f in terrainMats[z]) {
    const name = terrainMats[z][f];
    materials[name] = stdTex(name, { r: name === 'grass' ? 1 : 0.9 });
  }

  // ------------------------------------------- terreno sólido
  const gb = new GeoBuilder();
  const zFront = data.id === 1 || data.id === 2 ? 2.2 : 1.25;
  const zBack = -5;
  for (const zone of Object.keys(terrainMats)) {
    const ms = terrainMats[zone];
    const rects = greedyRects(W + PAD * 2, H, (x, y) => T(x - PAD, y) === 1 && zoneOf(Math.max(0, Math.min(W - 1, x - PAD)), y) === zone);
    for (const rr of rects) {
      const r = { x0: rr.x0 - PAD, x1: rr.x1 - PAD, y0: rr.y0, y1: rr.y1 };
      const x0 = r.x0, x1 = r.x1, yTop = -r.y0, yBot = -r.y1;
      gb.box(x0, yBot, zBack, x1, yTop, zFront, { front: ms.front }, 0.25);
      // topo exposto
      let s = null;
      for (let x = x0; x <= x1; x++) {
        const exposed = x < x1 && !solidAt(x, r.y0 - 1);
        if (exposed && s === null) s = x;
        if ((!exposed || x === x1) && s !== null) {
          const e = exposed && x === x1 ? x1 : x;
          gb.box(s, yTop, zBack, e, yTop, zFront, { top: ms.top }, 0.25);
          s = null;
        }
      }
      // base exposta (tetos)
      s = null;
      for (let x = x0; x <= x1; x++) {
        const exposed = x < x1 && r.y1 < H && !solidAt(x, r.y1);
        if (exposed && s === null) s = x;
        if ((!exposed || x === x1) && s !== null) {
          const e = exposed && x === x1 ? x1 : x;
          gb.box(s, yBot, zBack, e, yBot, zFront, { bottom: ms.side }, 0.25);
          s = null;
        }
      }
      // laterais expostas
      for (const side of ['left', 'right']) {
        const nx = side === 'left' ? x0 - 1 : x1;
        let sy = null;
        for (let y = r.y0; y <= r.y1; y++) {
          const exposed = y < r.y1 && nx >= -PAD && nx < W + PAD && !solidAt(nx, y);
          if (exposed && sy === null) sy = y;
          if ((!exposed || y === r.y1) && sy !== null) {
            const ey = exposed && y === r.y1 ? r.y1 : y;
            const xx = side === 'left' ? x0 : x1;
            gb.box(xx, -ey, zBack, xx, -sy, zFront, { [side]: ms.side }, 0.25);
            sy = null;
          }
        }
      }
    }
  }
  const terrain = gb.build(materials, { castShadow: false });
  terrain.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(terrain);

  // ------------------------------------------- plataformas de mão única
  const owStyle = { 1: 'hill', 2: 'ice', 3: 'ledge', 4: 'ledge', 5: 'purple', 6: 'castlefloor', 7: 'castlefloor' }[data.id];
  const runs = [];
  for (let y = 0; y < H; y++) {
    let s = null;
    for (let x = 0; x <= W; x++) {
      const on = x < W && T(x, y) === 2;
      if (on && s === null) s = x;
      if (!on && s !== null) { runs.push({ x0: s * 16, x1: x * 16, y: y * 16, tile: true, zone: zoneOf(s, y) }); s = null; }
    }
  }
  for (const o of level.oneways) runs.push({ x0: o.x0, x1: o.x1, y: o.y, kind: o.kind });
  const owb = new GeoBuilder();
  const owMats = {
    grass: stdTex('grass'), roots: stdTex('roots'), icetop: stdTex('icetop', { r: 0.3 }), ice: stdTex('ice', { r: 0.4, emissive: 0x0a2a44, ei: 0.4 }),
    purple: stdTex('purplebrick'), castle: stdTex('castle'), wood: stdTex('wood'), brownrock: stdTex('brownrock'), bridge: stdTex('bridge'),
    floor: stdTex('greenbuilding'), street: stdTex('street'), tealrock: stdTex('tealrock'),
  };
  for (const r of runs) {
    const x0 = X(r.x0), x1 = X(r.x1), yt = Y(r.y);
    const kind = r.kind || (data.id === 6 && r.zone === 'tan' ? 'purple' : owStyle);
    if (kind === 'hill') {
      owb.box(x0, yt - 0.3, -2.5, x1, yt, 0.75, { top: 'grass', front: 'roots', left: 'roots', right: 'roots' }, 0.25);
    } else if (kind === 'ice') {
      owb.box(x0 - 0.1, yt - 0.42, -1.6, x1 + 0.1, yt, 0.75, { top: 'icetop', front: 'ice', left: 'ice', right: 'ice', bottom: 'ice' }, 0.25);
      // pingentes de gelo
      for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.35 + rnd() * 0.3) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.07 + rnd() * 0.05, 0.25 + rnd() * 0.45, 4), plain(0xcfe8ff, { r: 0.2, emissive: 0x20406a, ei: 0.5 }));
        c.rotation.x = Math.PI; c.position.set(x, yt - 0.5 - c.geometry.parameters.height / 2 + 0.1, 0.4 - rnd() * 1.5);
        root.add(c);
      }
    } else if (kind === 'floor') {
      owb.box(x0, yt - 0.55, -2.6, x1, yt, 0.7, { top: 'street', front: 'floor', bottom: 'floor', left: 'floor', right: 'floor' }, 0.25);
    } else if (kind === 'bridge') {
      owb.box(x0, yt - 0.35, -1.4, x1, yt, 1.0, { top: 'bridge', front: 'wood', bottom: 'wood' }, 0.5);
    } else if (kind === 'purple') {
      owb.box(x0, yt - 1, -3.2, x1, yt, 0.9, { top: 'purple', front: 'purple', bottom: 'purple', left: 'purple', right: 'purple' }, 0.5);
    } else if (kind === 'castlefloor') {
      owb.box(x0, yt - 1, -3.2, x1, yt, 0.9, { top: 'castle', front: 'castle', bottom: 'castle', left: 'castle', right: 'castle' }, 0.5);
    } else {
      const rt = r.zone === 'teal' ? 'tealrock' : 'brownrock';
      owb.box(x0, yt - 0.5, -2.2, x1, yt, 0.9, { top: rt, front: rt, left: rt, right: rt, bottom: rt }, 0.25);
    }
  }
  const owGroup = owb.build(owMats);
  owGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(owGroup);

  // ------------------------------------------- escadas
  const ladderMat = data.id === 6 ? plain(0x2a2c34, { r: 0.5, m: 0.6 }) : data.id === 2 ? plain(0x4a4640, { r: 0.8 }) : plain(0x6a4424, { r: 0.9 });
  for (const l of level.ladders) {
    const h = (l.bottom - l.top) / 16 + 0.3;
    const style = data.id === 6 && l.top < 816 ? 'iron' : 'wood';
    const m = new THREE.Mesh(ladderGeo(h, style), ladderMat);
    m.position.set(X(l.x + 8), Y(l.bottom), -0.42);
    m.castShadow = true;
    root.add(m);
  }

  // ------------------------------------------- lápides e rochas sólidas
  for (const s of level.solids) {
    if (s.t === 'tomb') {
      const m = new THREE.Mesh(tombGeo(1.05, 1.05, 1), stdTex('tomb', { r: 0.95 }));
      m.position.set(X(s.x + s.w / 2), Y(s.y + s.h), 0);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
    } else {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + rnd() * 0.18, 0), plain(0x8a8a90, { r: 0.95 }));
        r.position.set((i - 1.5) * 0.3, 0.3 + (i % 2) * 0.22, (rnd() - 0.5) * 0.4);
        r.rotation.set(rnd() * 3, rnd() * 3, 0);
        r.castShadow = true;
        g.add(r);
      }
      g.position.set(X(s.x + s.w / 2), Y(s.y + s.h), 0);
      root.add(g);
    }
  }

  // ------------------------------------------- água / lava
  for (const hz of level.hazards) {
    const w = X(hz.x1) - X(hz.x0);
    if (hz.t === 'water') {
      const m = waterMaterial(data.id === 2 ? 0x0a2f7a : 0x0b2766);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, 12, Math.ceil(w * 2), 12), m);
      pl.rotation.x = -Math.PI / 2;
      pl.position.set((X(hz.x0) + X(hz.x1)) / 2, Y(hz.y) - 0.15, -2);
      root.add(pl);
      anim.push((t) => { m.uniforms.uTime.value = t; });
      // paredes laterais da vala
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), plain(0x02050f));
      back.position.set(pl.position.x, Y(hz.y) - 1.5, -6);
      root.add(back);
    } else {
      const m = lavaMaterial();
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w + 2, 9, Math.ceil(w), 9), m);
      pl.rotation.x = -Math.PI / 2;
      pl.position.set((X(hz.x0) + X(hz.x1)) / 2, Y(hz.y) + 0.1, -2.5);
      root.add(pl);
      anim.push((t) => { m.uniforms.uTime.value = t; });
      for (let x = hz.x0 + 96; x < hz.x1; x += 256) {
        const l = vlight(X(x), Y(hz.y) + 1.2, 1.5, 0xff5a10, 30, 16, 1.6);
        anim.push((t) => { l.intensity = 26 + Math.sin(t * 3 + x) * 6; });
      }
    }
  }

  // ------------------------------------------- portão final
  let door = null;
  if (data.door) {
    const d = data.door;
    door = new THREE.Group();
    const leafGeo = new THREE.BoxGeometry(X(d.w) / 2, d.h / 16, 0.25);
    const leafMat = mat('doorleaf', () => new THREE.MeshStandardMaterial({ map: tex('wood'), color: 0xa07850, roughness: 0.7, metalness: 0.1 }));
    const bandMat = plain(0x3a3a40, { m: 0.8, r: 0.4 });
    const studs = plain(0x1c1c1c, { m: 0.8, r: 0.4 });
    const leaves = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * X(d.w) / 2, 0, 0);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(-side * X(d.w) / 4, d.h / 32, 0);
      leaf.castShadow = true;
      pivot.add(leaf);
      for (const by of [0.15, 0.5, 0.85]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(X(d.w) / 2, 0.12, 0.3), bandMat);
        band.position.set(-side * X(d.w) / 4, (d.h / 16) * by, 0.02);
        pivot.add(band);
      }
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), studs);
        s.position.set(-side * X(d.w) / 4 + ((i % 2) - 0.5) * 0.7, 0.6 + Math.floor(i / 2) * 1.2, 0.14);
        pivot.add(s);
      }
      door.add(pivot); leaves.push(pivot);
    }
    door.position.set(X(d.x + d.w / 2), Y(d.y), -0.8);
    door.userData.leaves = leaves;
    root.add(door);
    // moldura de pedra
    const frame = new THREE.Mesh(new THREE.BoxGeometry(X(d.w) + 1.2, d.h / 16 + 0.8, 1.2), stdTex('stone'));
    frame.position.set(X(d.x + d.w / 2), Y(d.y) + d.h / 32 + 0.2, -1.5);
    root.add(frame);
  }

  // ------------------------------------------- chão até o horizonte (fases ao ar livre)
  if (theme.outdoor) {
    const gy = data.id === 1 ? Y(176) : Y(432);
    const t2 = tex(data.id === 1 ? 'grass' : 'street').clone();
    t2.needsUpdate = true; t2.repeat.set(80, 40);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(level.w + 400, 220), new THREE.MeshStandardMaterial({ map: t2, color: data.id === 1 ? 0x5a6a50 : 0x5a5a66, roughness: 1 }));
    far.rotation.x = -Math.PI / 2;
    far.position.set(level.w / 2, gy - 0.02, zBack - 110);
    far.receiveShadow = true;
    root.add(far);
  }

  // ------------------------------------------- decoração temática
  const decor = DECOR[data.id];
  if (decor) decor({ root, anim, rnd, level, data, materials, renderer });

  // ------------------------------------------- céu e luzes
  const env = new THREE.Group();
  root.add(env);
  let sky = null;
  if (theme.outdoor) { sky = makeSky(theme); env.add(sky); }
  return {
    root, theme, door, sky, lights: LIGHTS,
    update(t, cx, cy) {
      for (const f of anim) f(t, cx, cy);
      if (sky) sky.position.set(cx, cy, 0);
    },
    openDoor(k) {
      if (!door) return;
      const [l, r] = door.userData.leaves;
      l.rotation.y = -k * 1.4; r.rotation.y = k * 1.4;
    },
  };
}

// ================================================================================ DECORAÇÃO POR FASE
function mistLayer(root, anim, x0, x1, y, z, opacity = 0.35) {
  const t = tex('mist').clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const w = x1 - x0;
  t.repeat.set(w / 14, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity, color: 0xb8c4ff, fog: true }));
  m.position.set((x0 + x1) / 2, y, z);
  m.renderOrder = 5;
  root.add(m);
  anim.push((time) => { t.offset.x = time * 0.012 * (z > 0 ? 1.3 : 0.7); });
}

const DECOR = {
  // ---------------------------------------------------------------- 1: cemitério e floresta
  1({ root, anim, rnd, level }) {
    mountains(root, -60, 300, rnd, { base: Y(176) - 1, z: -120, color: 0x6a6e8a });
    const groundY = Y(176);
    // nuvens lentas
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('cloud'), transparent: true, depthWrite: false, opacity: 0.8, fog: false }));
      c.scale.set(40 + rnd() * 30, 14 + rnd() * 8, 1);
      const x0 = rnd() * 240;
      c.position.set(x0, 18 + rnd() * 14, -120 - rnd() * 40);
      root.add(c);
      anim.push((t) => { c.position.x = ((x0 + t * 0.6) % 260) - 10; });
    }
    // lápides, cruzes, cercas e árvores mortas ao fundo (cemitério: x < 1640)
    const tombM = stdTex('tomb', { r: 0.95 });
    const tombs = [], crosses = [], fences = [];
    for (let x = 4; x < 102; x += 1.2 + rnd() * 2.2) {
      const onHill = x > 37.5 && x < 69.5;
      const z = onHill ? -1.2 - rnd() * 1.1 : -1 - rnd() * 4;
      const y = onHill && rnd() < 0.6 ? Y(96) : groundY;
      const zz = y === groundY && onHill ? -6 - rnd() * 3 : z;
      const r = rnd();
      if (r < 0.45) tombs.push([x, y, zz, 0.6 + rnd() * 0.5, rnd()]);
      else if (r < 0.7) crosses.push([x, y, zz, 0.9 + rnd() * 0.6]);
      else if (r < 0.85) fences.push([x, y, zz, 1.5 + rnd() * 2.5]);
    }
    const tg = [], cg = [], fg = [];
    for (const [x, y, z, s, k] of tombs) { const g = tombGeo(s, s * (0.9 + k * 0.5), k < 0.4 ? 1 : 0); g.rotateY((rnd() - 0.5) * 0.4); g.rotateZ((rnd() - 0.5) * 0.15); g.translate(x, y, z); tg.push(g); }
    for (const [x, y, z, s] of crosses) { const g = crossGeo(s); g.rotateZ((rnd() - 0.5) * 0.3); g.translate(x, y, z); cg.push(g); }
    for (const [x, y, z, l] of fences) { const g = fenceGeo(l); g.translate(x, y, z); fg.push(g); }
    if (tg.length) { const m = new THREE.Mesh(mergeGeometries(tg.map(ni)), tombM); m.castShadow = m.receiveShadow = true; root.add(m); }
    if (cg.length) { const m = new THREE.Mesh(mergeGeometries(cg.map(ni)), plain(0x777780, { r: 0.9 })); m.castShadow = true; root.add(m); }
    if (fg.length) { const m = new THREE.Mesh(mergeGeometries(fg.map(ni)), plain(0x2a2a32, { r: 0.5, m: 0.6 })); m.castShadow = true; root.add(m); }
    // árvores mortas
    const treeM = stdTex('bark');
    const dtg = [];
    for (let x = 6; x < 110; x += 5 + rnd() * 9) {
      const onHill = x > 38 && x < 69;
      const g = deadTree(rnd, 0.8 + rnd() * 0.6);
      g.translate(x, onHill ? Y(96) : groundY, onHill ? -1.9 - rnd() * 0.5 : -2.5 - rnd() * 5);
      dtg.push(g);
    }
    { const m = new THREE.Mesh(mergeGeometries(dtg.map(ni)), treeM); m.castShadow = true; root.add(m); }
    // corpo do morro (atrás do caminho de baixo)
    {
      const shape = new THREE.Shape();
      shape.moveTo(X(544), groundY); shape.lineTo(X(600), Y(96) - 0.3); shape.lineTo(X(1120), Y(96) - 0.3);
      shape.lineTo(X(1136), Y(112)); shape.lineTo(X(1152), Y(128)); shape.lineTo(X(1168), Y(144)); shape.lineTo(X(1184), Y(160)); shape.lineTo(X(1190), groundY);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 2 });
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
      const hill = new THREE.Mesh(geo, stdTex('roots'));
      hill.position.z = -8.9;
      hill.receiveShadow = true;
      root.add(hill);
      const top = new THREE.Mesh(new THREE.BoxGeometry(X(1120) - X(600), 0.2, 6.5), stdTex('grass'));
      top.position.set((X(600) + X(1120)) / 2, Y(96) - 0.15, -5.7);
      top.receiveShadow = true;
      root.add(top);
    }
    // floresta: árvores grandes com copa
    const trunkG = [], canG = [];
    for (let x = 114; x < 216; x += 6 + rnd() * 6) {
      const h = 9 + rnd() * 4;
      const { trunk, canopy } = bigTree(rnd, h);
      const z = -3.5 - rnd() * 4;
      trunk.translate(x, groundY, z); canopy.translate(x, groundY, z);
      trunkG.push(trunk); canG.push(canopy);
    }
    for (let x = 112; x < 216; x += 2 + rnd() * 3) {
      const g = deadTree(rnd, 1.4 + rnd() * 0.6);
      g.translate(x, groundY, -9 - rnd() * 6);
      trunkG.push(g);
    }
    { const m = new THREE.Mesh(mergeGeometries(trunkG.map(ni)), stdTex('bark')); m.castShadow = true; m.receiveShadow = true; root.add(m); }
    { const m = new THREE.Mesh(mergeGeometries(canG.map(ni)), stdTex('leaves', { flat: true })); m.castShadow = true; root.add(m); }
    // muralha do castelo no fim da fase
    {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(X(3584) - X(3424) + 24, 14, 4), stdTex('stone'));
      const uv = wall.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 4);
      wall.position.set((X(3424) + X(3584)) / 2 + 12, groundY + 7, -3.2);
      wall.receiveShadow = true; wall.castShadow = true;
      root.add(wall);
      for (let x = X(3424); x < X(3584) + 24; x += 1.5) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 4), stdTex('stone'));
        m.position.set(x + 0.45, groundY + 14.5, -3.2);
        root.add(m);
      }
    }
    // névoa rasteira
    mistLayer(root, anim, -10, 230, groundY + 0.7, 1.4, 0.32);
    mistLayer(root, anim, -10, 230, groundY + 1.0, -3, 0.28);
    // capim no primeiro plano
    grassTufts(root, level, rnd, 1, 2.1);
    // vaga-lumes / fogos-fátuos
    wisps(root, anim, rnd, 0, 110, groundY + 1, groundY + 6);
  },

  // ---------------------------------------------------------------- 2: palácio de gelo e cidade
  2({ root, anim, rnd, data }) {
    // canais sob as pontes da cidade
    for (const [a, b] of (data.decor && data.decor.bridges) || []) {
      const w = X(b) - X(a);
      const m = waterMaterial(0x0a2f7a);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, 9, Math.ceil(w * 2), 9), m);
      pl.rotation.x = -Math.PI / 2;
      pl.position.set((X(a) + X(b)) / 2, Y(460), -2);
      root.add(pl);
      anim.push((t) => { m.uniforms.uTime.value = t; });
      // parapeito de blocos de pedra
      for (let x = X(a) + 0.5; x < X(b); x += 1) {
        const blk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.5), stdTex('stone'));
        blk.position.set(x, Y(432) + 0.17, 1.6); blk.castShadow = true; root.add(blk);
      }
    }
    mountains(root, -20, 300, rnd, { base: Y(432) - 1, z: -125, color: 0x5a6084 });
    // torres de gelo
    const towers = [[52, 92], [116, 156], [228, 268], [308, 348], [352, 400], [452, 494], [514, 556], [580, 620], [708, 750]];
    const iceM = stdTex('ice', { r: 0.35, emissive: 0x062440, ei: 0.5 });
    for (const [a, b] of towers) {
      const w = X(b) - X(a);
      const geo = new THREE.CylinderGeometry(w / 2, w / 2, 30, 10, 1, false);
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 8);
      const m = new THREE.Mesh(geo, iceM);
      m.position.set((X(a) + X(b)) / 2, Y(448) + 15, -2.2);
      m.receiveShadow = true;
      root.add(m);
      // janelas escuras
      for (let y = 40; y < 440; y += 96 + rnd() * 40) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), plain(0x020610));
        win.position.set((X(a) + X(b)) / 2, Y(y), -2.2 + w / 2 + 0.02);
        root.add(win);
      }
    }
    // cidade
    const g = Y(432);
    building(root, { x0: 1060, x1: 1250, ground: 432, h: 190, style: 'house', roof: 'flat', roofTex: 'roof', dormers: 2, windows: { cols: 3, rows: 3, y0: 2, gap: 3 } });
    building(root, { x0: 1296, x1: 1560, ground: 432, h: 168, style: 'redbrick', roof: 'flat', roofTex: 'roof', roofH: 1.2, windows: { cols: 8, rows: 4, y0: 1.6, gap: 2, w: 0.9, h: 1.1 } });
    building(root, { x0: 1600, x1: 2176, ground: 432, h: 400, style: 'greenbuilding', roof: 'flat', roofH: 2.6, dormers: 6, depth: 3.2, z: -2.7, windows: { cols: 12, rows: 5, y0: 2.4, gap: 5, w: 1.0, h: 1.6 } });
    building(root, { x0: 2200, x1: 2350, ground: 432, h: 330, style: 'house', roof: 'gable', roofH: 3, windows: { cols: 2, rows: 4, y0: 3, gap: 3.5 } });
    building(root, { x0: 2345, x1: 2560, ground: 432, h: 300, style: 'house', roof: 'flat', windows: { cols: 3, rows: 5, y0: 2, gap: 3.2 } });
    building(root, { x0: 2585, x1: 2780, ground: 432, h: 350, style: 'redbrick', roof: 'gable', roofH: 3.5, windows: { cols: 3, rows: 6, y0: 2, gap: 3 } });
    building(root, { x0: 2800, x1: 2930, ground: 432, h: 320, style: 'house', roof: 'gable', roofH: 3.4, windows: { cols: 1, rows: 4, y0: 3, gap: 3.6 } });
    building(root, { x0: 2925, x1: 3080, ground: 432, h: 290, style: 'greenbuilding', roof: 'flat', windows: { cols: 3, rows: 4, y0: 4, gap: 3.4 } });
    // muretas de grama (fundo)
    for (const [a, b] of [[816, 1100], [3110, 3330]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(X(b) - X(a), 3.6, 2.5), stdTex('stone'));
      m.position.set((X(a) + X(b)) / 2, g + 1.8, -3.5);
      root.add(m);
      const top = new THREE.Mesh(new THREE.BoxGeometry(X(b) - X(a) + 0.3, 0.4, 2.8), stdTex('grass'));
      top.position.set((X(a) + X(b)) / 2, g + 3.7, -3.5);
      root.add(top);
    }
    // morro rochoso com o portão
    {
      const geo = new THREE.DodecahedronGeometry(9, 1);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + rnd() * 0.2), p.getY(i) * (0.7 + rnd() * 0.1), p.getZ(i) * 0.5);
      const m = new THREE.Mesh(geo, stdTex('brownrock', { flat: true }));
      m.position.set(X(3500), g + 2.5, -6.5);
      root.add(m);
    }
    // postes de luz na rua
    for (let x = 800; x < 3300; x += 320) lamp(root, anim, X(x), g, -1.3);
    grassTufts(root, null, rnd, 0, 0);
  },

  // ---------------------------------------------------------------- 3: cavernas
  3({ root, anim, rnd, level }) {
    caveBackdrop(root, level, 'cavewall', 'tealdark');
    // massa de rocha atrás da plataforma elevada (o caminho de baixo passa na frente)
    {
      const shape = new THREE.Shape();
      shape.moveTo(X(240), Y(896)); shape.lineTo(X(258), Y(816) - 0.3); shape.lineTo(X(800), Y(816) - 0.3); shape.lineTo(X(820), Y(896)); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 1 });
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
      const m = new THREE.Mesh(geo, stdTex('brownrock'));
      m.position.z = -4.9; m.receiveShadow = true;
      root.add(m);
    }
    stalactites(root, level, rnd, (tx) => tx < 64 ? 0x8a6038 : 0x0f7a68);
    crystals(root, anim, level, rnd, 64);
  },
  // ---------------------------------------------------------------- 4: ponte de fogo
  4({ root, anim, rnd, level }) {
    caveBackdrop(root, level, 'cavewall', 'cavewall');
    // teto rochoso irregular (como no mapa)
    const ceil = [];
    for (let x = 1270; x < 2830; x += 18 + rnd() * 18) {
      const g = new THREE.DodecahedronGeometry(1.4 + rnd() * 1.6, 0);
      g.translate(X(x), Y(10 + rnd() * 40), -1.5 - rnd() * 2);
      ceil.push(g);
      const s = new THREE.ConeGeometry(0.25 + rnd() * 0.3, 1 + rnd() * 2.2, 5); s.rotateX(Math.PI); s.translate(X(x) + (rnd() - 0.5) * 2, Y(40 + rnd() * 30), -0.8 - rnd() * 2);
      ceil.push(s);
    }
    const m = new THREE.Mesh(mergeGeometries(ceil.map(ni)), stdTex('brownrock', { flat: true }));
    root.add(m);
    // cordas e postes da ponte
    const postM = plain(0x4a2e18, { r: 0.9 });
    for (let x = 1280; x <= 2816; x += 32) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), postM);
      p.position.set(X(x), Y(178) + 0.5, 0.9); root.add(p);
      const p2 = p.clone(); p2.position.z = -1.3; root.add(p2);
    }
    for (const z of [0.9, -1.3]) {
      const rope = new THREE.Mesh(new THREE.BoxGeometry(X(2816) - X(1280), 0.05, 0.05), plain(0x8a6a40));
      rope.position.set((X(1280) + X(2816)) / 2, Y(178) + 0.95, z); root.add(rope);
    }
    // ruína com o portão no fim
    const hut = new THREE.Mesh(new THREE.BoxGeometry(X(3069) - X(2899), 7, 4), stdTex('stone'));
    hut.position.set((X(2899) + X(3069)) / 2, Y(176) + 3.5, -3);
    root.add(hut);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(X(3069) - X(2899) + 1, 1.2, 4.6), stdTex('stone'));
    lintel.position.set((X(2899) + X(3069)) / 2, Y(176) + 7.4, -3);
    root.add(lintel);
  },
  // ---------------------------------------------------------------- 5: torre
  5({ root, anim, rnd, level }) {
    caveBackdrop(root, level, 'castledark', 'castledark', 0x9a90a8);
    supportPillars(root, [[18, 22, 17, 21], [16, 20, 62, 66]]);
    torches(root, anim, level, rnd, 11);
  },
  // ---------------------------------------------------------------- 6: castelo
  6({ root, anim, rnd, level }) {
    caveBackdrop(root, level, 'castle', 'castle', 0x8a90a8);
    // janelas gradeadas do salão de Satã
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4), new THREE.MeshStandardMaterial({ map: tex('bars'), emissive: 0x223355, emissiveIntensity: 0.6 }));
      w.position.set(10.6 + i * 2, Y(80), -4.9);
      root.add(w);
    }
    // pilares do porão
    for (const x of [7.5, 23.5]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 5, 10), plain(0x8a7a6a, { r: 0.8 }));
      c.position.set(x, Y(896) + 2.5, -1.8); root.add(c);
    }
    // estandartes
    for (const [x, y] of [[7, 210], [25, 210], [7, 450], [25, 450]]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.6), stdTex('drape', { side: THREE.DoubleSide }));
      b.position.set(x, Y(y), -4.8); root.add(b);
    }
    torches(root, anim, level, rnd, 9);
  },
  // ---------------------------------------------------------------- 7: sala do trono
  7({ root, anim, rnd }) {
    const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), stdTex('castle'));
    const uv = back.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 6);
    back.position.set(8, -6, -6); root.add(back);
    for (const x of [5.5, 10.5]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 9, 12), plain(0x3a3a50, { r: 0.4, m: 0.3 }));
      c.position.set(x, Y(176) + 4.5, -2.5); c.castShadow = true; root.add(c);
    }
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(26, 4), stdTex('drape', { side: THREE.DoubleSide }));
    drape.position.set(8, -2.5, -4.5); root.add(drape);
    // trono e degraus
    const throne = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.4), plain(0x55304a, { r: 0.5 }));
    seat.position.y = 1.6; throne.add(seat);
    const backr = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.6, 0.4), plain(0x4a2a3a, { r: 0.5 }));
    backr.position.set(0, 3.2, -0.6); throne.add(backr);
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(4.6 - i * 0.8, 0.35, 2.4 - i * 0.3), stdTex('drape'));
      st.position.set(0, 0.17 + i * 0.35, 0); throne.add(st);
    }
    throne.position.set(7.4, Y(176), -3); root.add(throne);
    for (const x of [3, 13]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.4), new THREE.MeshStandardMaterial({ map: tex('bars'), emissive: 0x332233, emissiveIntensity: 0.5 }));
      w.position.set(x, Y(80), -5.9); root.add(w);
    }
    torches(root, anim, { w: 16, h: 14, tile: () => 0, data: { id: 7 } }, rnd, 0, [[2, 110], [14, 110]]);
  },
};

function caveBackdrop(root, level, texA, texB, color = 0xffffff) {
  // parede do fundo por toda a fase, dando profundidade aos túneis
  const w = level.w, h = level.h;
  const geo = new THREE.PlaneGeometry(w + 40, h + 20);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w + 40) / 6, uv.getY(i) * (h + 20) / 6);
  const m = new THREE.Mesh(geo, stdTex(texA, { color }));
  m.position.set(w / 2, -h / 2, -5.01);
  m.receiveShadow = true;
  root.add(m);
  if (texB !== texA) {
    // segunda zona (fase 3: parte azul)
    const geo2 = new THREE.PlaneGeometry(w - 64 + 20, h + 20);
    const uv2 = geo2.attributes.uv; for (let i = 0; i < uv2.count; i++) uv2.setXY(i, uv2.getX(i) * (w - 44) / 6, uv2.getY(i) * (h + 20) / 6);
    const m2 = new THREE.Mesh(geo2, stdTex(texB));
    m2.position.set(64 + (w - 64 + 20) / 2, -h / 2, -5.0);
    m2.receiveShadow = true;
    root.add(m2);
  }
}

function stalactites(root, level, rnd, colorFor) {
  const groups = new Map();
  for (let ty = 1; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) {
    if (level.tile(tx, ty - 1) === 1 && level.tile(tx, ty) === 0 && rnd() < 0.55) {
      const col = colorFor(tx);
      if (!groups.has(col)) groups.set(col, []);
      const h = 0.4 + rnd() * 1.3;
      const c = new THREE.ConeGeometry(0.12 + rnd() * 0.2, h, 5);
      c.rotateX(Math.PI);
      c.translate(tx + rnd(), -ty - h / 2 + 0.05, 0.6 - rnd() * 5);
      groups.get(col).push(c);
    }
  }
  for (const [col, geos] of groups) {
    const m = new THREE.Mesh(mergeGeometries(geos.map(ni)), plain(col, { r: 0.9 }));
    m.castShadow = true;
    root.add(m);
  }
}

function crystals(root, anim, level, rnd, fromX) {
  const geos = [];
  const lights = [];
  for (let tx = fromX; tx < level.w; tx++) for (let ty = 1; ty < level.h; ty++) {
    if (level.tile(tx, ty) === 1 && level.tile(tx, ty - 1) === 0 && rnd() < 0.05) {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.OctahedronGeometry(0.18 + rnd() * 0.18, 0);
        c.scale(0.6, 2, 0.6);
        c.rotateZ((rnd() - 0.5) * 0.8);
        c.translate(tx + rnd(), -ty + 0.2, -2.8 - rnd() * 1.8);
        geos.push(c);
      }
      if (rnd() < 0.25) lights.push([tx + 0.5, -ty + 0.8]);
    }
  }
  if (geos.length) {
    const m = new THREE.Mesh(mergeGeometries(geos.map(ni)), plain(0x5af0ff, { r: 0.2, emissive: 0x18c8e0, ei: 1.4 }));
    root.add(m);
  }
  for (const [x, y] of lights) vlight(x, y, -1.5, 0x40e0ff, 6, 7);
}

function supportPillars(root, list) {
  for (const [a, b, ty0, ty1] of list) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, ty1 - ty0, 1.6), stdTex('purplebrick'));
    m.position.set((a + b) / 2, -(ty0 + ty1) / 2, -3.6);
    root.add(m);
  }
}

function torches(root, anim, level, rnd, every, fixed) {
  const pts = fixed ? fixed.map(([x, y]) => [x, Y(y)]) : [];
  if (!fixed) {
    // uma tocha na parede do fundo a cada ~`every` tiles, 2 tiles acima de cada piso
    for (let ty = 2; ty < level.h - 1; ty++) {
      let last = -99;
      for (let tx = 1; tx < level.w - 1; tx++) {
        const floor = level.tile(tx, ty) === 0 && level.tile(tx, ty + 1) !== 0 && level.tile(tx, ty - 1) === 0 && level.tile(tx, ty - 2) === 0;
        if (floor && tx - last >= every) { pts.push([tx + 0.5, -(ty + 1) + 2.3]); last = tx; }
      }
    }
  }
  const holder = plain(0x2a2420, { m: 0.6, r: 0.5 });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95 });
  for (const [x, y] of pts) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.6, 6), holder);
    h.position.set(x, y, -4.7); root.add(h);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), flameM);
    f.position.set(x, y + 0.5, -4.6); root.add(f);
    const l = vlight(x, y + 0.6, -3.5, 0xff8a30, 10, 9, 1.8);
    const ph = rnd() * 10;
    anim.push((t) => { const k = 1 + Math.sin(t * 9 + ph) * 0.12 + Math.sin(t * 23 + ph) * 0.06; l.intensity = 10 * k; f.scale.set(1, k, 1); });
  }
}

function lamp(root, anim, x, y, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6), plain(0x1a1c22, { m: 0.7, r: 0.4 }));
  pole.position.set(x, y + 2.1, z); root.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.45), new THREE.MeshStandardMaterial({ color: 0xffd080, emissive: 0xffb050, emissiveIntensity: 2.2 }));
  head.position.set(x, y + 4.4, z); root.add(head);
  vlight(x, y + 4.2, z + 0.6, 0xffb060, 14, 10, 1.8);
}

function grassTufts(root, level, rnd, stage) {
  if (!level || stage !== 1) return;
  const geos = [];
  for (let tx = 0; tx < level.w; tx++) {
    if (level.tile(tx, 11) !== 1 || level.tile(tx, 10) === 1) continue;
    for (let i = 0; i < 4; i++) {
      const h = 0.15 + rnd() * 0.35;
      const g = new THREE.ConeGeometry(0.05, h, 3);
      g.translate(tx + rnd(), -11 + h / 2, 0.9 + rnd() * 1.25);
      geos.push(g);
    }
  }
  if (geos.length) root.add(new THREE.Mesh(mergeGeometries(geos.map(ni)), plain(0x3f7a24, { r: 1 })));
}

function wisps(root, anim, rnd, x0, x1, y0, y1) {
  const n = 40;
  const pos = new Float32Array(n * 3);
  const seeds = [];
  for (let i = 0; i < n; i++) {
    seeds.push([x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), -4 + rnd() * 5, rnd() * 10]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0x9fffd0, size: 0.22, map: tex('soft'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  root.add(p);
  anim.push((t) => {
    for (let i = 0; i < n; i++) {
      const s = seeds[i];
      pos[i * 3] = s[0] + Math.sin(t * 0.3 + s[3]) * 1.5;
      pos[i * 3 + 1] = s[1] + Math.sin(t * 0.7 + s[3] * 2) * 0.6;
      pos[i * 3 + 2] = s[2] + Math.cos(t * 0.4 + s[3]) * 0.8;
    }
    g.attributes.position.needsUpdate = true;
    m.opacity = 0.6 + Math.sin(t * 2) * 0.2;
  });
}
