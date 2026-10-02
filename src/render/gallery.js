// Galeria de modelos para conferência visual: abra index.html?gallery=1
import * as THREE from 'three';
import { createModel, ArthurModel } from './models.js';

export function startGallery(renderer, which = 'all') {
  const scene = renderer.scene;
  scene.background = new THREE.Color(0x101420);
  scene.fog = null;
  renderer.hemi.intensity = 0.8; renderer.sun.intensity = 2.0;
  renderer.sun.position.set(-6, 12, 14); renderer.sun.target.position.set(0, 0, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x2a2e3a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const types = which === 'bosses' ? ['unicorn', 'dragon', 'satan', 'astaroth', 'bigman', 'princess']
    : which === 'items' ? ['lance', 'dagger', 'torch', 'axe', 'cross', 'armor', 'coin', 'bag', 'necklace', 'doll', 'king', 'yashichi', 'key', 'pot']
    : ['arthur', 'arthur-naked', 'zombie', 'crow', 'raven', 'plant', 'arremer', 'knight', 'pig', 'devil', 'bat', 'skeleton', 'magician', 'tower', 'firejet'];
  const list = [];
  types.forEach((t, i) => {
    const cols = which === 'bosses' ? 3 : 5;
    const sx = which === 'bosses' ? 6 : 3.2;
    const x = (i % cols - (cols - 1) / 2) * sx, z = -Math.floor(i / cols) * 4;
    let e = { type: t, kind: which === 'items' ? 'item' : 'enemy', x: 0, y: 0, state: 'walk', t: 10, animT: 0, facing: 1, vx: 0.5, vy: 0, h: 60, w: 14, onGround: true, segs: [], rise: 1, wings: 1, faces: [{ oy: 12 }, { oy: 36 }], dir: 1 };
    let m;
    if (t.startsWith('arthur')) {
      m = new ArthurModel();
      e = { state: 'stand', armor: t === 'arthur', facing: 1, invuln: 0, throwT: 0, vy: 0, animT: 0, dead: false, frogT: 0 };
      Object.defineProperty(e, 'frog', { get: () => false });
    } else {
      if (t === 'dragon') { e.segs = Array.from({ length: 11 }, (_, k) => ({ x: (k + 1) * 9, y: Math.sin(k) * 6, r: 7 - k * 0.12 })); }
      if (t === 'tower') e.state = 'active';
      if (t === 'arremer') e.state = 'hover';
      if (t === 'crow' || t === 'raven' || t === 'bat' || t === 'pig' || t === 'devil') e.state = 'fly';
      m = createModel(e);
    }
    if (!m) return;
    m.obj.position.set(x, 0, z);
    m.obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(m.obj);
    list.push({ m, e, t });
  });
  const cam = renderer.camera;
  cam.position.set(0, which === 'bosses' ? 6 : 4, which === 'bosses' ? 22 : 15);
  cam.lookAt(0, which === 'bosses' ? 2.5 : 1.2, -2);
  let t0 = performance.now();
  const loop = () => {
    requestAnimationFrame(loop);
    const time = (performance.now() - t0) / 1000;
    for (const { m, e } of list) {
      e.animT++; e.t++;
      if (e.state === 'walk' && e.armor === undefined) e.state = 'walk';
      if (e.armor !== undefined) { e.state = Math.floor(time / 2) % 3 === 0 ? 'walk' : Math.floor(time / 2) % 3 === 1 ? 'stand' : 'crouch'; }
      m.update(e, 1 / 60, time);
    }
    renderer.render(time);
  };
  loop();
}
