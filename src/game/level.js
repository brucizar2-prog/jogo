import { TILE } from '../core/const.js';

export const T_EMPTY = 0, T_SOLID = 1, T_ONEWAY = 2;

// Plataforma móvel: percorre os pontos do caminho em velocidade constante (movimento linear como no arcade).
export class MovingPlatform {
  constructor(d) {
    this.kind = d.kind || 'stone';
    this.w = d.w; this.h = d.h || 8;
    this.path = d.path;
    this.speed = d.speed || 0.75;
    this.seg = 0;
    this.x = d.path[0][0]; this.y = d.path[0][1];
    this.dx = 0; this.dy = 0;
    // fase inicial: avança ao longo do caminho para dessincronizar plataformas vizinhas
    if (d.phase) {
      let total = 0;
      for (let i = 0; i < this.path.length; i++) {
        const a = this.path[i], b = this.path[(i + 1) % this.path.length];
        total += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      const steps = Math.floor((total * d.phase) / this.speed);
      for (let i = 0; i < steps; i++) this.update();
      this.dx = this.dy = 0;
    }
  }
  update() {
    const tgt = this.path[(this.seg + 1) % this.path.length];
    let ex = tgt[0] - this.x, ey = tgt[1] - this.y;
    const d = Math.hypot(ex, ey);
    const ox = this.x, oy = this.y;
    if (d <= this.speed) {
      this.x = tgt[0]; this.y = tgt[1];
      this.seg = (this.seg + 1) % this.path.length;
    } else {
      this.x += (ex / d) * this.speed; this.y += (ey / d) * this.speed;
    }
    this.dx = this.x - ox; this.dy = this.y - oy;
  }
  get top() { return this.y; }
}

export class Level {
  constructor(data) {
    this.data = data;
    this.w = data.w; this.h = data.h;
    this.pw = data.w * TILE; this.ph = data.h * TILE;
    this.tiles = new Uint8Array(this.w * this.h);
    data.rows.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const c = row[tx];
        this.tiles[ty * this.w + tx] = c === '#' ? T_SOLID : c === '=' ? T_ONEWAY : T_EMPTY;
      }
    });
    this.solids = (data.solids || []).map((s) => ({ ...s, alive: true, hits: 0 }));
    this.oneways = data.oneways || [];
    this.ladders = (data.ladders || []).map((l) => ({ ...l, cx: l.x + 8 }));
    this.hazards = data.hazards || [];
    this.platforms = (data.platforms || []).map((p) => new MovingPlatform(p));
  }

  tile(tx, ty) {
    if (tx < 0 || tx >= this.w) return T_SOLID;      // bordas laterais do mapa
    if (ty < 0 || ty >= this.h) return T_EMPTY;
    return this.tiles[ty * this.w + tx];
  }
  tileAt(x, y) { return this.tile(Math.floor(x / TILE), Math.floor(y / TILE)); }

  // retângulo [x0,x1) x [y0,y1) encosta em algo sólido? (tiles sólidos e lápides/rochas)
  rectSolid(x0, y0, x1, y1, ignoreRects = false) {
    const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor((x1 - 0.001) / TILE);
    const ty0 = Math.floor(y0 / TILE), ty1 = Math.floor((y1 - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++)
        if (this.tile(tx, ty) === T_SOLID) return true;
    if (!ignoreRects) {
      for (const s of this.solids) {
        if (!s.alive) continue;
        if (x1 > s.x && x0 < s.x + s.w && y1 > s.y && y0 < s.y + s.h) return s;
      }
    }
    return false;
  }

  pointSolid(x, y) { return this.rectSolid(x, y, x + 0.01, y + 0.01); }

  // procura uma superfície de apoio cruzada pelos pés entre yFrom e yTo (yTo > yFrom)
  // retorna { y, ref } ou null. ref = plataforma móvel quando aplicável.
  findFloor(x0, x1, yFrom, yTo, opts = {}) {
    let best = null, bestRef = null;
    const consider = (sy, ref) => {
      if (sy >= yFrom - 0.001 && sy <= yTo + 0.001 && (best === null || sy < best)) { best = sy; bestRef = ref; }
    };
    const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor((x1 - 0.001) / TILE);
    const tyA = Math.floor((yFrom - 0.001) / TILE) + 1, tyB = Math.floor(yTo / TILE);
    for (let ty = Math.max(0, tyA - 1); ty <= tyB; ty++) {
      const sy = ty * TILE;
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tile(tx, ty);
        if (t === T_EMPTY) continue;
        if (t === T_ONEWAY && opts.noOneway) continue;
        if (this.tile(tx, ty - 1) === T_SOLID && ty > 0) continue; // superfície coberta
        if (tx < 0 || tx >= this.w) continue;
        consider(sy, null);
        break;
      }
    }
    if (!opts.noOneway) {
      for (const o of this.oneways) if (x1 > o.x0 && x0 < o.x1) consider(o.y, null);
    }
    for (const s of this.solids) if (s.alive && x1 > s.x && x0 < s.x + s.w) consider(s.y, s);
    if (!opts.noPlatforms) {
      for (const p of this.platforms) {
        if (x1 > p.x && x0 < p.x + p.w) {
          // a plataforma já se moveu neste quadro: compensa o deslocamento vertical
          const sy = p.y;
          if (sy >= yFrom - 0.001 - Math.max(0, -p.dy) - 0.5 && sy <= yTo + 0.001 + Math.max(0, p.dy)) {
            if (best === null || sy < best) { best = sy; bestRef = p; }
          }
        }
      }
    }
    return best === null ? null : { y: best, ref: bestRef };
  }

  // existe chão logo abaixo dos pés?
  groundUnder(x0, x1, y, opts) { return this.findFloor(x0, x1, y - 0.5, y + 1, opts); }

  ladderAt(x, y, range = 7) {
    for (const l of this.ladders) {
      if (Math.abs(x - l.cx) <= range && y >= l.top - 1 && y <= l.bottom + 1) return l;
    }
    return null;
  }

  hazardAt(x, y) {
    for (const h of this.hazards) if (x >= h.x0 && x <= h.x1 && y > h.y + 2) return h;
    return null;
  }

  update() { for (const p of this.platforms) p.update(); }
}

// Movimento de corpo genérico (pés em y). Retorna eventos de colisão.
export function moveBody(b, level, opts = {}) {
  const hw = b.w / 2;
  const ev = { wall: false, landed: false, bonk: false, fell: false };
  // carrega o corpo junto com a plataforma em que está apoiado
  if (b.onGround && b.groundRef && b.groundRef.dx !== undefined) {
    const p = b.groundRef;
    if (p.dx && !level.rectSolid(b.x - hw + p.dx, b.y - b.h, b.x + hw + p.dx, b.y - 1, opts.ignoreRects)) b.x += p.dx;
    b.y = p.y;
  }
  // horizontal
  if (b.vx) {
    const nx = b.x + b.vx;
    const hit = level.rectSolid(nx - hw, b.y - b.h, nx + hw, b.y - 1, opts.ignoreRects);
    if (!hit) b.x = nx;
    else {
      ev.wall = true;
      // encosta na parede pixel a pixel
      const step = Math.sign(b.vx);
      for (let i = 0; i < Math.ceil(Math.abs(b.vx)); i++) {
        const tx = b.x + step;
        if (level.rectSolid(tx - hw, b.y - b.h, tx + hw, b.y - 1, opts.ignoreRects)) break;
        b.x = tx;
      }
    }
  }
  // vertical
  if (b.onGround) {
    const g = level.groundUnder(b.x - hw, b.x + hw, b.y, opts);
    if (!g) { b.onGround = false; b.groundRef = null; ev.fell = true; }
    else { b.y = g.y; b.groundRef = g.ref; }
  } else {
    b.vy = Math.min(b.vy + (opts.gravity ?? 0.2), opts.maxFall ?? 5);
    const ny = b.y + b.vy;
    if (b.vy >= 0) {
      const f = level.findFloor(b.x - hw, b.x + hw, b.y, ny, opts);
      if (f) { b.y = f.y; b.vy = 0; b.onGround = true; b.groundRef = f.ref; ev.landed = true; }
      else b.y = ny;
    } else {
      if (level.rectSolid(b.x - hw, ny - b.h, b.x + hw, ny - b.h + 2, true)) { b.vy = 0; ev.bonk = true; }
      else b.y = ny;
    }
  }
  if (b.x < hw) { b.x = hw; ev.wall = true; }
  if (b.x > level.pw - hw) { b.x = level.pw - hw; ev.wall = true; }
  return ev;
}
