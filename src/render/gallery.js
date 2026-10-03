// Galeria de modelos para conferência visual: index.html?gallery=all | bosses | items | arthur
import * as THREE from 'three';
import { createModel } from './models.js';
import { ArthurOrganic, getSpecies } from './creatures.js';

export function startGallery(renderer, which = 'all') {
  const scene = renderer.scene;
  scene.background = new THREE.Color(0x141824);
  scene.fog = null;
  renderer.hemi.intensity = 0.7; renderer.sun.intensity = 2.4;
  renderer.sun.position.set(-6, 12, 14); renderer.sun.target.position.set(0, 0, 0);
  for (const l of renderer.pool) l.intensity = 0;
  renderer.heroLight.intensity = 0;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x2a2e3a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const qp = new URLSearchParams(location.search);
  const custom = which === 'list' ? (qp.get('t') || 'zombie').split(',') : null;
  const types = custom ? custom : which === 'bosses' ? ['unicorn', 'dragon', 'satan', 'astaroth', 'bigman', 'princess']
    : which === 'items' ? ['lance', 'dagger', 'torch', 'axe', 'cross', 'armor', 'coin', 'bag', 'necklace', 'doll', 'king', 'yashichi', 'key', 'pot']
    : which === 'arthur' ? ['arthur:walk', 'arthur:stand', 'arthur-naked:walk', 'arthur:crouch', 'arthur:jump', 'arthur-naked:stand']
    : ['arthur', 'arthur-naked', 'zombie', 'crow', 'raven', 'plant', 'arremer', 'knight', 'pig', 'devil', 'bat', 'skeleton', 'magician', 'tower', 'firejet'];
  const list = [];
  const t0 = performance.now();
  types.forEach((t, i) => {
    const cols = custom ? custom.length : which === 'bosses' || which === 'arthur' ? 3 : 5;
    const sx = custom ? (+qp.get('gap') || 2.4) : which === 'bosses' ? 6 : which === 'arthur' ? 2.2 : 3.2;
    const x = (i % cols - (cols - 1) / 2) * sx, z = -Math.floor(i / cols) * (which === 'arthur' ? 3 : 4);
    let e = { type: t, kind: which === 'items' ? 'item' : 'enemy', x: 0, y: 0, state: 'walk', t: 10, animT: 0, facing: 1, vx: 0.5, vy: 0, h: 60, w: 14, onGround: true, segs: [], rise: 1, wings: 1, faces: [{ oy: 12 }, { oy: 36 }], dir: 1 };
    let m;
    if (t.startsWith('arthur')) {
      m = new ArthurOrganic();
      const [kind, st] = t.split(':');
      e = { state: st || 'stand', fixed: !!st, armor: kind === 'arthur', facing: 1, invuln: 0, throwT: 0, vy: st === 'jump' ? -1 : 0, animT: 0, dead: false, frogT: 0, weapon: 'lance' };
      Object.defineProperty(e, 'frog', { get: () => false });
    } else {
      if (t === 'dragon') { e.segs = Array.from({ length: 11 }, (_, k) => ({ x: (k + 1) * 9, y: Math.sin(k) * 6, r: 7 - k * 0.12 })); }
      if (t === 'tower') e.state = 'active';
      if (t === 'arremer') e.state = 'hover';
      if (t === 'crow' || t === 'raven' || t === 'bat' || t === 'pig' || t === 'devil' || t === 'lavadevil') e.state = 'fly';
      const st = qp.get('st'); if (st) e.state = st;
      m = createModel(e);
    }
    if (!m) return;
    m.obj.position.set(x, 0, z);
    scene.add(m.obj);
    list.push({ m, e, t });
  });
  window.__galleryBuildMs = performance.now() - t0;
  const cam = renderer.camera;
  if (custom) { const w = custom.length * (+qp.get('gap') || 2.4); const h = +qp.get('h') || 2; cam.position.set(0, h * 0.75, Math.max(w * 0.95, h * 2.6) + 1); cam.lookAt(0, h * 0.5, 0); }
  else if (which === 'arthur') { cam.position.set(0, 2.2, 6.8); cam.lookAt(0, 1.0, -1.2); }
  else { cam.position.set(0, which === 'bosses' ? 6 : 4, which === 'bosses' ? 22 : 15); cam.lookAt(0, which === 'bosses' ? 2.5 : 1.2, -2); }
  const cp = new URLSearchParams(location.search).get('cam');
  if (cp) { const v = cp.split(',').map(Number); cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); }
  const start = performance.now();
  const loop = () => {
    requestAnimationFrame(loop);
    const time = (performance.now() - start) / 1000;
    for (const { m, e } of list) {
      e.animT++; e.t++;
      if (e.armor !== undefined && !e.fixed) e.state = Math.floor(time / 2) % 3 === 0 ? 'walk' : Math.floor(time / 2) % 3 === 1 ? 'stand' : 'crouch';
      m.update(e, 1 / 60, time);
    }
    renderer.render(time);
  };
  loop();
}

export { getSpecies };
