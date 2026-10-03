// Galeria de modelos para conferência visual:
//   index.html?gallery=all | bosses | items | arthur | list&t=a,b
//   index.html?gallery=sheet&t=arthur,zombie   → folha de referência (FRENTE/ESQ./COSTAS/DIR.)
//   parâmetros: gap, h, st (estado), cam=x,y,z,tx,ty,tz, anim=1 (anima a folha)
import * as THREE from 'three';
import { createModel } from './models.js';
import { createArthur, keysOf } from './creatures.js';
import { requestAll } from './meshgen.js';

const qp = new URLSearchParams(location.search);

function makeEntity(t, which) {
  if (t.startsWith('arthur')) {
    const [kind, st] = t.split(':');
    const e = { state: st || 'stand', fixed: !!st, armor: kind === 'arthur', facing: 1, invuln: 0, throwT: 0, vy: st === 'jump' ? -1 : 0, animT: 0, dead: false, frogT: 0, weapon: 'lance', onGround: true };
    if (kind === 'arthur-frog') e.frog = true;
    return { e, m: createArthur() };
  }
  const e = { type: t, kind: which === 'items' ? 'item' : 'enemy', x: 0, y: 0, state: 'walk', t: 10, animT: 0, facing: 1, vx: 0.5, vy: 0, h: 60, w: 14, onGround: true, segs: [], rise: 1, wings: 1, faces: [{ oy: 12 }, { oy: 36 }], dir: 1 };
  if (t === 'dragon') e.segs = Array.from({ length: 11 }, (_, k) => ({ x: (k + 1) * 9, y: Math.sin(k) * 6, r: 7 - k * 0.12 }));
  if (t === 'tower') e.state = 'active';
  if (t === 'arremer') e.state = 'hover';
  if (['crow', 'raven', 'bat', 'pig', 'devil', 'lavadevil'].includes(t)) e.state = 'fly';
  if (t === 'satan') e.state = 'hover';
  if (t === 'magician') e.state = 'cast';
  const st = qp.get('st'); if (st) e.state = st;
  return { e, m: createModel(e) };
}

export async function startGallery(renderer, which = 'all') {
  const scene = renderer.scene;
  const sheet = which === 'sheet';
  scene.background = new THREE.Color(sheet ? 0x000000 : 0x141824);
  scene.fog = null;
  for (const l of renderer.pool) l.intensity = 0;
  renderer.heroLight.intensity = 0;
  const custom = which === 'list' || sheet ? (qp.get('t') || 'arthur').split(',') : null;
  const types = custom ? custom : which === 'bosses' ? ['unicorn', 'dragon', 'satan', 'astaroth', 'bigman', 'princess']
    : which === 'items' ? ['lance', 'dagger', 'torch', 'axe', 'cross', 'armor', 'coin', 'bag', 'necklace', 'doll', 'king', 'yashichi', 'key', 'pot']
    : which === 'arthur' ? ['arthur:walk', 'arthur:stand', 'arthur-naked:walk', 'arthur:crouch', 'arthur:jump', 'arthur-naked:stand']
    : ['arthur', 'arthur-naked', 'zombie', 'crow', 'raven', 'plant', 'arremer', 'knight', 'pig', 'devil', 'bat', 'skeleton', 'magician', 'tower', 'firejet'];
  // espera as esculturas (workers) antes de montar a cena
  const t0 = performance.now();
  const keys = [...new Set(types.flatMap((t) => keysOf(t.startsWith('arthur') ? 'arthur' : t)))];
  await requestAll(keys);
  window.__galleryBuildMs = performance.now() - t0;
  const list = [];
  const cam = renderer.camera;
  if (sheet) {
    // folha: uma linha por personagem, quatro vistas, fundo preto e luz de estúdio
    renderer.retro.enabled = false;
    cam.fov = +qp.get('fov') || 12; cam.updateProjectionMatrix();
    if (qp.get('noshadow')) renderer.sun.castShadow = false;
    renderer.hemi.intensity = 0.55; renderer.hemi.color.setHex(0xb0b8d0); renderer.hemi.groundColor.setHex(0x302020);
    renderer.sun.intensity = 3.0; renderer.sun.color.setHex(0xfff4e8);
    renderer.rim.intensity = 1.6; renderer.rim.color.setHex(0x9fb0ff);
    renderer.scene.environmentIntensity = 0.45;
    const views = [['FRENTE', -Math.PI / 2], ['ESQUERDA', Math.PI], ['COSTAS', Math.PI / 2], ['DIREITA', 0]];
    const gap = +qp.get('gap') || 1.9, rowH = +qp.get('h') || 2.6;
    const labels = document.createElement('div');
    labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:12px Georgia,serif;color:#ddd;letter-spacing:1px';
    document.body.appendChild(labels);
    types.forEach((t, row) => {
      views.forEach(([name, ang], col) => {
        const { e, m } = makeEntity(t, which);
        if (!m) return;
        const x = (col - 1.5) * gap, y = -row * rowH;
        m.obj.position.set(x, y, 0);
        m.obj.userData.ang = ang;
        scene.add(m.obj);
        list.push({ m, e, t, ang, x, y, name, row });
      });
    });
    const rows = types.length;
    const top = rowH * 0.82, bottom = -(rows - 1) * rowH - 0.45;
    const W = gap * 4, H = top - bottom;
    const fov = cam.fov * Math.PI / 180;
    const dist = Math.max((H / 2) / Math.tan(fov / 2), (W / 2) / Math.tan(fov / 2) / cam.aspect) * 1.04;
    const cy = (top + bottom) / 2;
    cam.position.set(0, cy, dist); cam.lookAt(0, cy, 0);
    renderer.bloom.strength = 0.25;
    renderer.sun.position.set(-4, cy + 8, 12); renderer.sun.target.position.set(0, cy, 0);
    renderer.rim.position.set(5, cy + 4, -10); renderer.rim.target.position.set(0, cy, 0);
    const sc = renderer.sun.shadow.camera; sc.left = -W; sc.right = W; sc.top = H; sc.bottom = -H; sc.updateProjectionMatrix();
    // rótulos projetados
    const place = () => {
      labels.innerHTML = '';
      const v = new THREE.Vector3();
      for (const it of list) {
        v.set(it.x, it.y - 0.1, 0).project(cam);
        const d = document.createElement('div');
        d.textContent = it.name;
        d.style.cssText = `position:absolute;left:${(v.x * 0.5 + 0.5) * innerWidth}px;top:${(-v.y * 0.5 + 0.5) * innerHeight}px;transform:translate(-50%,0)`;
        labels.appendChild(d);
        if (it.name === 'COSTAS') {
          const n = document.createElement('div');
          n.textContent = it.t.toUpperCase().replace(/[:-]/g, ' ');
          n.style.cssText = `position:absolute;left:${(v.x * 0.5 + 0.5) * innerWidth - innerWidth * 0.1}px;top:${(-v.y * 0.5 + 0.5) * innerHeight + 15}px;transform:translate(-50%,0);font-size:18px;color:#fff`;
          labels.appendChild(n);
        }
      }
    };
    place();
    addEventListener('resize', place);
  } else {
    scene.background = new THREE.Color(0x141824);
    renderer.hemi.intensity = 0.7; renderer.sun.intensity = 2.4;
    renderer.sun.position.set(-6, 12, 14); renderer.sun.target.position.set(0, 0, 0);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x2a2e3a, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    types.forEach((t, i) => {
      const cols = custom ? custom.length : which === 'bosses' || which === 'arthur' ? 3 : 5;
      const sx = custom ? (+qp.get('gap') || 2.4) : which === 'bosses' ? 6 : which === 'arthur' ? 2.2 : 3.2;
      const x = (i % cols - (cols - 1) / 2) * sx, z = -Math.floor(i / cols) * (which === 'arthur' ? 3 : 4);
      const { e, m } = makeEntity(t, which);
      if (!m) return;
      m.obj.position.set(x, 0, z);
      scene.add(m.obj);
      list.push({ m, e, t });
    });
    if (custom) { const w = custom.length * (+qp.get('gap') || 2.4); const h = +qp.get('h') || 2; cam.position.set(0, h * 0.75, Math.max(w * 0.95, h * 2.6) + 1); cam.lookAt(0, h * 0.5, 0); }
    else if (which === 'arthur') { cam.position.set(0, 2.2, 6.8); cam.lookAt(0, 1.0, -1.2); }
    else { cam.position.set(0, which === 'bosses' ? 6 : 4, which === 'bosses' ? 22 : 15); cam.lookAt(0, which === 'bosses' ? 2.5 : 1.2, -2); }
  }
  const cp = qp.get('cam');
  if (cp) { const v = cp.split(',').map(Number); cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); }
  const animate = !sheet || qp.get('anim') === '1';
  const start = performance.now();
  let frames = 0;
  const loop = () => {
    requestAnimationFrame(loop);
    const time = animate ? (performance.now() - start) / 1000 : 0;
    for (const { m, e, ang } of list) {
      if (animate) { e.animT++; e.t++; }
      if (e.armor !== undefined && !e.fixed && !sheet) e.state = Math.floor(time / 2) % 3 === 0 ? 'walk' : Math.floor(time / 2) % 3 === 1 ? 'stand' : 'crouch';
      m.update(e, 1 / 60, time);
      if (ang !== undefined) {
        const real = m.real || m;
        if (real.inner) { real.inner.rotation.y = 0; real.yaw = 0; }
        m.obj.rotation.y = ang;
      }
    }
    renderer.render(time);
    if (++frames === 3) window.__galleryReady = true;
  };
  loop();
}
