// Projéteis do jogador, projéteis inimigos, itens e potes.
import { WEAPONS, SCORES } from '../core/const.js';
import { moveBody } from './level.js';
import { rnd } from '../core/rng.js';

export function overlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// ------------------------------------------------------------------ armas do Arthur
export class PlayerShot {
  constructor(game, type, x, y, dir) {
    this.game = game; this.kind = 'shot'; this.type = type;
    const s = WEAPONS[type];
    this.x = x; this.y = y; this.dir = dir; this.facing = dir;
    this.w = s.w; this.h = s.h; this.dmg = s.dmg;
    this.t = 0; this.remove = false;
    this.pierce = type === 'axe';
    this.burning = false;
    this.hitSet = new Set();
    if (type === 'lance' || type === 'dagger') { this.vx = dir * s.speed; this.vy = 0; }
    else if (type === 'torch') { this.vx = dir * s.speed; this.vy = -2.2; }
    else if (type === 'axe') { this.vx = dir * s.speed; this.vy = -3.4; }
    else if (type === 'cross') { this.vx = dir * s.speed; this.vy = 0; this.startX = x; }
  }
  get box() {
    const hw = this.w / 2, hh = this.h / 2;
    if (this.burning) return { x0: this.x - 12, y0: this.y - 18, x1: this.x + 12, y1: this.y };
    return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh };
  }
  update() {
    const g = this.game, lv = g.level;
    this.t++;
    if (this.burning) {
      if (this.t > 46) this.remove = true;
      return;
    }
    if (this.type === 'torch' || this.type === 'axe') {
      this.vy += this.type === 'torch' ? 0.2 : 0.14;
    }
    const ox = this.x, oy = this.y;
    this.x += this.vx; this.y += this.vy;
    if (this.type === 'torch' && this.vy > 0) {
      const f = lv.findFloor(this.x - 3, this.x + 3, oy, this.y);
      if (f) {
        this.y = f.y; this.burning = true; this.t = 0; this.vx = this.vy = 0;
        g.sfx('torch'); g.fx.emit('fire', this.x, this.y);
        return;
      }
    }
    if (this.type === 'cross' && Math.abs(this.x - this.startX) > WEAPONS.cross.range) {
      this.remove = true; g.fx.emit('vanish', this.x, this.y); return;
    }
    // colisão com cenário (lápides, rochas e paredes param as armas)
    const b = this.box;
    const hit = lv.rectSolid(b.x0, b.y0, b.x1, b.y1);
    if (hit) {
      if (typeof hit === 'object' && hit.t) g.onSolidShot(hit, this);
      g.fx.emit('spark', this.x + this.dir * 4, this.y);
      if (this.type === 'torch') { this.burning = true; this.t = 0; this.vx = this.vy = 0; this.y = Math.min(this.y, (typeof hit === 'object' ? hit.y : this.y)); g.fx.emit('fire', this.x, this.y); }
      else this.remove = true;
      return;
    }
    const c = g.view;
    if (this.x < c.x0 - 24 || this.x > c.x1 + 24 || this.y > c.y1 + 32 || this.y < c.y0 - 48) this.remove = true;
    if (this.y > lv.ph + 16) this.remove = true;
  }
}

// ------------------------------------------------------------------ projéteis inimigos
const EPROJ = {
  eyeball: { w: 8, h: 8, speed: 1.5 },
  fireball: { w: 8, h: 8, speed: 2.0 },
  ufire: { w: 10, h: 10, speed: 2.2 },
  spear: { w: 14, h: 4, speed: 2.0 },
  spearDown: { w: 4, h: 14, speed: 2.5 },
  orb: { w: 10, h: 10, speed: 1.4 },
  flail: { w: 12, h: 12, speed: 2.0 },
  spell: { w: 20, h: 20, speed: 1.4 },
  dfire: { w: 12, h: 12, speed: 2.0 },
  star: { w: 10, h: 10, speed: 2.4 },
  afire: { w: 14, h: 14, speed: 2.0 },
};

export class EnemyShot {
  constructor(game, type, x, y, vx, vy, opts = {}) {
    this.game = game; this.kind = 'eshot'; this.type = type;
    const s = EPROJ[type];
    this.w = s.w; this.h = s.h;
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.gravity = opts.gravity || 0;
    this.t = 0; this.remove = false;
    this.life = opts.life || 600;
    this.blockable = type !== 'spell';
    this.facing = vx < 0 ? -1 : 1;
  }
  static aimed(game, type, x, y, tx, ty, speedMul = 1) {
    const s = EPROJ[type].speed * speedMul;
    const dx = tx - x, dy = ty - y; const d = Math.hypot(dx, dy) || 1;
    return new EnemyShot(game, type, x, y, (dx / d) * s, (dy / d) * s);
  }
  get box() { return { x0: this.x - this.w / 2, y0: this.y - this.h / 2, x1: this.x + this.w / 2, y1: this.y + this.h / 2 }; }
  update() {
    this.t++;
    this.vy += this.gravity;
    this.x += this.vx; this.y += this.vy;
    const c = this.game.view;
    if (this.t > this.life || this.x < c.x0 - 40 || this.x > c.x1 + 40 || this.y > c.y1 + 40 || this.y < c.y0 - 80) this.remove = true;
    if (this.type === 'flail' && this.vy > 0) {
      const f = this.game.level.findFloor(this.x - 4, this.x + 4, this.y - this.vy, this.y);
      if (f) { this.remove = true; this.game.fx.emit('dust', this.x, f.y); }
    }
  }
}

// ------------------------------------------------------------------ itens
// kind: lance dagger torch axe cross armor coin bag necklace doll king yashichi key pot
export const WEAPON_ITEMS = ['lance', 'dagger', 'torch', 'axe', 'cross'];

export class Item {
  constructor(game, kind, x, y, opts = {}) {
    this.game = game; this.kind = 'item'; this.type = kind;
    this.x = x; this.y = y; this.w = 14; this.h = 14;
    this.vx = 0; this.vy = opts.vy ?? 0;
    this.onGround = !opts.fall; this.groundRef = null;
    this.t = 0; this.remove = false;
    this.contents = opts.contents;   // para potes
    this.static = !!opts.static;
    this.facing = 1;
  }
  get box() { return { x0: this.x - 8, y0: this.y - 14, x1: this.x + 8, y1: this.y }; }
  update() {
    const g = this.game;
    this.t++;
    if (!this.onGround) {
      const ev = moveBody(this, g.level, { gravity: this.type === 'key' ? 0.08 : 0.2, maxFall: this.type === 'key' ? 1.2 : 4, ignoreRects: false });
      if (ev.landed && this.type === 'pot') {
        // o pote se quebra e revela o conteúdo
        this.remove = true;
        g.fx.emit('potbreak', this.x, this.y);
        g.sfx('pot');
        g.addItem(new Item(g, this.contents, this.x, this.y));
      }
      if (this.y > g.level.ph + 32) this.remove = true;
    } else if (this.groundRef && this.groundRef.dx !== undefined) {
      moveBody(this, g.level);
    }
  }
  collect(player) {
    const g = this.game;
    if (this.type === 'pot') return false;
    this.remove = true;
    if (WEAPON_ITEMS.includes(this.type)) {
      player.weapon = this.type;
      g.sfx('weapon');
      g.fx.emit('pickup', this.x, this.y - 8);
      g.addScore(200, this.x, this.y - 16);
    } else if (this.type === 'armor') {
      if (!player.armor) { player.armor = true; g.fx.emit('armorup', player.x, player.y - 16); }
      g.sfx('armorup');
      g.addScore(200, this.x, this.y - 16);
    } else if (this.type === 'key') {
      g.sfx('key');
      g.onKey();
      g.addScore(SCORES.key, this.x, this.y - 16);
    } else {
      g.sfx('treasure');
      g.fx.emit('pickup', this.x, this.y - 8);
      g.addScore(SCORES[this.type] || 200, this.x, this.y - 16);
    }
    return true;
  }
}

// tabela de conteúdo dos potes por fase (ordem fixa, como uma sequência de arcade)
export const POT_TABLE = {
  1: ['dagger', 'bag', 'torch', 'armor', 'lance', 'necklace', 'axe', 'coin', 'dagger', 'doll'],
  2: ['torch', 'armor', 'dagger', 'bag', 'axe', 'lance', 'necklace', 'king'],
  3: ['dagger', 'armor', 'axe', 'bag', 'torch', 'cross', 'lance', 'doll'],
  4: ['armor', 'dagger', 'cross', 'bag', 'lance', 'axe'],
  5: ['cross', 'armor', 'dagger', 'cross', 'bag', 'lance', 'king'],
  6: ['cross', 'armor', 'bag', 'cross', 'dagger', 'king'],
  7: ['cross'],
};

export function randomTreasure() {
  const r = rnd();
  return r < 0.5 ? 'coin' : r < 0.8 ? 'bag' : r < 0.95 ? 'necklace' : 'doll';
}
