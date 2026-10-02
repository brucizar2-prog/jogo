// Verifica, com a física real do Arthur, se o fim de cada fase é alcançável a partir do início
// (andar, cair, pular para os lados/para cima, escadas e plataformas móveis amostradas).
// Uso: node tests/reachability.mjs [fase...]
import { LEVELS } from '../src/levels/index.js';
import { Level, moveBody } from '../src/game/level.js';
import { ARTHUR } from '../src/core/const.js';

function makeLevel(data) {
  const lv = new Level(data);
  // plataformas móveis: amostra posições ao longo do trajeto como plataformas paradas
  const snaps = [];
  for (const p of lv.platforms) {
    const path = p.path.concat([p.path[0]]);
    for (let i = 0; i < path.length - 1; i++) {
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        snaps.push({ x: path[i][0] + (path[i + 1][0] - path[i][0]) * t, y: path[i][1] + (path[i + 1][1] - path[i][1]) * t, w: p.w, dx: 0, dy: 0 });
      }
    }
  }
  lv.platforms = snaps;
  return lv;
}

function body(x, y) { return { x, y, w: ARTHUR.w, h: ARTHUR.h, vx: 0, vy: 0, onGround: true, groundRef: null }; }

function simulateAir(lv, b) {
  for (let i = 0; i < 600; i++) {
    const ev = moveBody(b, lv, { gravity: ARTHUR.gravity, maxFall: ARTHUR.maxFall });
    if (lv.hazardAt(b.x, b.y) || b.y > lv.ph + 40) return null;
    if (b.onGround && (ev.landed || i > 0)) return { x: b.x, y: b.y };
  }
  return null;
}

function jump(lv, x, y, dir) {
  const b = body(x, y);
  b.vy = ARTHUR.jumpVy; b.vx = dir * ARTHUR.jumpVx; b.onGround = false;
  return simulateAir(lv, b);
}

// anda até a borda/parede; devolve posições amostradas e, se cair, onde aterrissa
function walk(lv, x, y, dir) {
  const b = body(x, y);
  const pts = [];
  for (let i = 0; i < 4000; i++) {
    b.vx = dir * ARTHUR.walk;
    const wasG = b.onGround;
    const ev = moveBody(b, lv, { gravity: ARTHUR.gravity, maxFall: ARTHUR.maxFall });
    if (ev.wall && b.onGround) break;
    if (!b.onGround && wasG) {
      b.vy = 0; b.vx = dir * ARTHUR.fallDrift;
      const land = simulateAir(lv, b);
      return { pts, land };
    }
    if (lv.hazardAt(b.x, b.y)) break;
    if (i % 3 === 0) pts.push({ x: b.x, y: b.y });
  }
  return { pts, land: null };
}

export function analyze(stage, verbose = false) {
  const data = LEVELS[stage];
  const lv = makeLevel(data);
  const key = (p) => `${Math.round(p.x / 3)},${Math.round(p.y)}`;
  const seen = new Map();
  const queue = [];
  const push = (p) => { const k = key(p); if (!seen.has(k)) { seen.set(k, p); queue.push(p); } };
  push(data.start);
  let n = 0;
  while (queue.length && n < 60000) {
    n++;
    const p = queue.shift();
    for (const dir of [-1, 1]) {
      const w = walk(lv, p.x, p.y, dir);
      for (const q of w.pts) { const k = key(q); if (!seen.has(k)) { seen.set(k, q); queue.push(q); } }
      if (w.land) push(w.land);
    }
    for (const dir of [-1, 0, 1]) { const j = jump(lv, p.x, p.y, dir); if (j) push(j); }
    for (const l of lv.ladders) {
      if (Math.abs(p.x - l.cx) <= 6) {
        if (Math.abs(p.y - l.bottom) < 2) push({ x: l.cx, y: l.top });
        if (Math.abs(p.y - l.top) < 2) push({ x: l.cx, y: l.bottom });
      }
    }
  }
  // objetivo: porta (ou o ponto de disparo do chefe nas fases verticais)
  const b = data.boss;
  let goalOk = false, best = null;
  for (const p of seen.values()) {
    let ok;
    if (data.door) ok = Math.abs(p.x - (data.door.x + data.door.w / 2)) < 40 && Math.abs(p.y - data.door.y) < 20;
    else ok = Math.abs(p.x - b.x) < 120;
    if (typeof b.trigger === 'string') ok = ok || p.y < parseFloat(b.trigger.slice(2));
    if (ok) goalOk = true;
    if (!best || p.x > best.x) best = p;
  }
  const cp = data.checkpoint;
  let cpOk = !cp;
  if (cp) for (const p of seen.values()) if (Math.abs(p.x - cp.x) < 24 && Math.abs(p.y - cp.y) < 12) cpOk = true;
  return { stage, nodes: seen.size, goalReachable: goalOk, checkpointReachable: cpOk, farthest: best && { x: Math.round(best.x), y: Math.round(best.y) } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stages = process.argv.slice(2).map(Number);
  let ok = true;
  for (const s of stages.length ? stages : [1, 2, 3, 4, 5, 6, 7]) {
    const r = analyze(s);
    console.log(JSON.stringify(r));
    if (!r.goalReachable || !r.checkpointReachable) ok = false;
  }
  process.exit(ok ? 0 : 1);
}
