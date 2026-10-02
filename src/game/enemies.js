// Inimigos comuns. Coordenadas: x = centro, y = pés. Velocidades em px/quadro (60 Hz).
// Os padrões seguem o comportamento documentado do arcade (ver README).
import { SCORES } from '../core/const.js';
import { moveBody } from './level.js';
import { EnemyShot } from './objects.js';
import { rnd, rint, rrange, chance } from '../core/rng.js';

export class Enemy {
  constructor(game, type, x, y, o = {}) {
    this.game = game; this.kind = 'enemy'; this.type = type;
    this.x = x; this.y = y; this.ox = x; this.oy = y;
    this.vx = 0; this.vy = 0;
    this.w = 14; this.h = 28;
    this.hp = 1; this.score = SCORES[type] || 100;
    this.t = 0; this.animT = 0; this.state = 'idle';
    this.facing = -1;
    this.remove = false; this.dead = false;
    this.flash = 0; this.alpha = 1;
    this.pot = o.pot || null;
    this.hittable = true; this.harmful = true;
    this.onGround = true; this.groundRef = null;
    this.boss = false;
    this.placement = o.placement || null;
    this.deathFx = 'poof';
  }
  get box() { return { x0: this.x - this.w / 2, y0: this.y - this.h, x1: this.x + this.w / 2, y1: this.y }; }
  get P() { return this.game.player; }
  dx() { return this.P.x - this.x; }
  dy() { return (this.P.y - 14) - (this.y - this.h / 2); }
  faceP() { this.facing = this.dx() < 0 ? -1 : 1; }
  setState(s) { this.state = s; this.t = 0; }
  center() { return { x: this.x, y: this.y - this.h / 2 }; }
  shoot(type, mul = 1, oy = null, ox = 0) {
    const c = this.center();
    const sy = oy === null ? c.y : this.y - oy;
    const P = this.P;
    this.game.addEnemyShot(EnemyShot.aimed(this.game, type, c.x + ox, sy, P.x, P.y - 14, mul));
  }
  pre() { this.t++; this.animT++; if (this.flash > 0) this.flash--; }
  update() { this.pre(); }
  offscreen(m = 48) {
    const v = this.game.view;
    return this.x < v.x0 - m || this.x > v.x1 + m || this.y < v.y0 - m - 40 || this.y > v.y1 + m + 40;
  }
  onHit(shot) {
    if (!this.hittable) return 'ignore';
    this.hp -= shot.dmg || 1;
    this.flash = 8;
    if (this.hp <= 0) { this.kill(shot); return 'kill'; }
    this.game.sfx('hit');
    return 'hit';
  }
  kill() {
    if (this.dead) return;
    this.dead = true; this.remove = true;
    const c = this.center();
    this.game.addScore(this.score, c.x, c.y - 8);
    this.game.fx.emit(this.deathFx, c.x, c.y, { type: this.type, size: Math.max(this.w, this.h) });
    this.game.sfx(this.score >= 1000 ? 'bigkill' : 'kill');
    if (this.pot) this.game.dropPot(c.x, c.y, this.pot);
    if (this.placement) this.placement.killed = true;
    this.onKilled && this.onKilled();
  }
}

// ---------------------------------------------------------------- ZUMBI
// Surge do chão perto do Arthur, anda reto na direção em que nasceu e afunda de novo.
export class Zombie extends Enemy {
  constructor(game, x, y, dir, pot) {
    super(game, 'zombie', x, y, { pot });
    this.w = 12; this.h = 28;
    this.facing = dir;
    this.state = 'rise';
    this.walkTime = rint(120, 480);
    this.harmful = false; this.hittable = false;
    this.speed = 0.55;
  }
  update() {
    this.pre();
    if (this.state === 'rise') {
      this.rise = Math.min(1, this.t / 48);
      this.hittable = this.t > 14;
      this.harmful = this.t > 24;
      if (this.t >= 48) { this.setState('walk'); this.harmful = this.hittable = true; }
    } else if (this.state === 'walk') {
      this.vx = this.facing * this.speed;
      const aheadX = this.x + this.facing * 8;
      const ground = this.game.level.groundUnder(aheadX - 1, aheadX + 1, this.y, { noPlatforms: true });
      const ev = moveBody(this, this.game.level, { ignoreRects: true });
      if (!ground || ev.wall || this.t > this.walkTime || this.game.level.hazardAt(aheadX, this.y + 4)) this.setState('sink');
    } else if (this.state === 'sink') {
      this.rise = 1 - Math.min(1, this.t / 40);
      this.harmful = this.t < 16; this.hittable = this.t < 24;
      if (this.t >= 40) this.remove = true;
    }
    if (this.offscreen(120)) this.remove = true;
  }
}

// ---------------------------------------------------------------- CORVO / CORVO VERMELHO
// Pousado numa lápide; grasna quando o Arthur chega perto e voa em linha ondulada até sair da tela.
export class Crow extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, o.red ? 'raven' : 'crow', x, y, o);
    this.w = 14; this.h = 12;
    this.state = 'perch';
    this.red = !!o.red;
  }
  update() {
    this.pre();
    const P = this.P;
    if (this.state === 'perch') {
      this.faceP();
      if (Math.abs(this.dx()) < (this.red ? 110 : 120) && Math.abs(P.y - this.y) < 96 && !P.dead) {
        this.setState('caw'); this.game.sfx('crow');
      }
    } else if (this.state === 'caw') {
      if (this.t >= 30) {
        this.setState('fly');
        this.faceP();
        this.baseY = this.y - 6;
        this.dir = this.facing;
      }
    } else if (this.state === 'fly') {
      const targetY = P.y - 16;
      this.baseY += Math.max(-0.6, Math.min(0.6, targetY - this.baseY));
      this.x += this.dir * (this.red ? 1.3 : 1.1);
      this.y = this.baseY + Math.sin(this.t * 0.16) * 7;
      this.facing = this.dir;
      if (this.offscreen(40)) this.remove = true;
    }
  }
}

// ---------------------------------------------------------------- PLANTA CARNÍVORA (Green Monster)
export class Plant extends Enemy {
  constructor(game, x, y, o) {
    super(game, 'plant', x, y, o);
    this.w = 14; this.h = 26;
    this.next = rint(60, 120);
    this.deathFx = 'burst';
  }
  update() {
    this.pre();
    this.faceP();
    this.mouth = Math.max(0, (this.mouth || 0) - 1);
    if (Math.abs(this.dx()) < 125 && Math.abs(this.dy()) < 120 && !this.P.dead) {
      if (--this.next <= 0) {
        this.shoot('eyeball', 1, 20, this.facing * 4);
        this.mouth = 16;
        this.next = rint(60, 120);
        this.game.sfx('spit');
      }
    }
  }
}

// ---------------------------------------------------------------- RED ARREMER
// Medita sentado; acorda, levanta voo, paira, dá rasantes diagonais na posição em que o Arthur estava,
// pousa e corre atrás dele, esquiva-se dos tiros saltando e cospe bolas de fogo mirando no Arthur.
export class Arremer extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'arremer', x, y, o);
    this.w = 18; this.h = 26;
    this.hp = 3;
    this.state = o.air ? 'hoverwait' : 'perch';
    this.air = !!o.air;
    this.onGround = !o.air;
    this.fireT = rint(150, 240);
    this.deathFx = 'burst';
    this.wing = 0;
  }
  floorBelow() {
    const f = this.game.level.findFloor(this.x - 6, this.x + 6, this.y, this.y + 400, { noPlatforms: true });
    return f ? f.y : this.game.level.ph;
  }
  onHit(shot) {
    if (this.state === 'perch' || this.state === 'hoverwait') { this.wake(); }
    return super.onHit(shot);
  }
  wake() { this.setState('wake'); this.game.sfx('arremer'); }
  shotIncoming() {
    for (const s of this.game.shots) {
      if (s.burning) continue;
      const ddx = this.x - s.x;
      if (Math.sign(ddx) === Math.sign(s.vx) && Math.abs(ddx) < 70 && Math.abs((this.y - 13) - s.y) < 22) return true;
    }
    return false;
  }
  update() {
    this.pre();
    const P = this.P, lv = this.game.level;
    if (this.state !== 'swoop' && this.state !== 'strafe') this.faceP();
    // cuspe de fogo periódico enquanto ativo
    if (!['perch', 'wake', 'hoverwait'].includes(this.state) && !P.dead) {
      if (--this.fireT <= 0) {
        this.fireT = rint(150, 260);
        this.spitT = 14;
        this.shoot('fireball', 1, 18, this.facing * 6);
        this.game.sfx('fireball');
      }
    }
    if (this.spitT) this.spitT--;
    switch (this.state) {
      case 'perch':
        if (Math.abs(this.dx()) < 100 && Math.abs(P.y - this.y) < 64 && !P.dead) this.wake();
        break;
      case 'hoverwait':
        this.y = this.oy + Math.sin(this.animT * 0.08) * 3;
        if (Math.abs(this.dx()) < 110 && Math.abs(P.y - this.y) < 120 && !P.dead) this.wake();
        break;
      case 'wake':
        if (this.t > 22) { this.onGround = false; this.beginRise(); }
        break;
      case 'rise': {
        this.y -= 1.6;
        this.x += Math.sign(this.dx()) * 0.4;
        if (this.y <= this.hoverY) { this.y = this.hoverY; this.setState('hover'); this.hoverT = rint(24, 60); }
        break;
      }
      case 'hover':
        this.y = this.hoverY + Math.sin(this.t * 0.12) * 2;
        if (this.shotIncoming() && chance(0.08)) { this.hoverY = Math.max(this.game.view.y0 + 24, this.hoverY - 28); this.setState('rise'); break; }
        if (this.t > this.hoverT) {
          if (chance(0.6)) {
            this.target = { x: P.x, y: P.y - 12 };
            const dx = this.target.x - this.x, dy = this.target.y - (this.y - 13);
            const d = Math.hypot(dx, dy) || 1;
            this.vx = (dx / d) * 2.2; this.vy = (dy / d) * 2.2;
            this.facing = this.vx < 0 ? -1 : 1;
            this.setState('swoop');
          } else {
            this.dir = this.dx() < 0 ? -1 : 1;
            this.facing = this.dir;
            this.passX = P.x + this.dir * rint(36, 60);
            this.setState('strafe');
          }
        }
        break;
      case 'swoop': {
        this.x += this.vx; this.y += this.vy;
        const floor = this.floorBelow();
        if (this.y >= floor - 0.5 && this.vy > 0) {
          this.y = floor; this.onGround = true; this.vy = 0; this.setState('walk');
          this.walkDir = this.dx() < 0 ? -1 : 1; this.walkPast = rint(30, 50);
          break;
        }
        if (this.y - 13 >= this.target.y || this.t > 120) {
          // passou pelo alvo: segue reto um pouco e volta a subir
          this.vy = 0; this.beginRise(26);
        }
        break;
      }
      case 'strafe':
        this.x += this.dir * 2.0;
        if ((this.dir > 0 && this.x > this.passX) || (this.dir < 0 && this.x < this.passX) || this.t > 160) {
          this.setState(chance(0.5) ? 'hover' : 'hover'); this.hoverT = rint(10, 40);
        }
        break;
      case 'walk': {
        this.facing = this.walkDir;
        this.vx = this.walkDir * 1.5;
        const ev = moveBody(this, lv, { ignoreRects: true });
        if (!this.onGround) { this.beginRise(); break; }
        const passed = this.walkDir > 0 ? this.x > P.x + this.walkPast : this.x < P.x - this.walkPast;
        if (ev.wall || passed || this.t > 140) {
          if (chance(0.5)) this.beginRise(); else { this.walkDir = this.dx() < 0 ? -1 : 1; this.t = 0; }
        }
        if (this.shotIncoming()) this.beginRise(10);
        break;
      }
    }
    this.wing = (this.state === 'perch' || this.state === 'walk') ? 0 : 1;
    if (this.boss) return;
    if (this.offscreen(200)) this.remove = true;
  }
  beginRise(delayT = 0) {
    const P = this.P;
    this.onGround = false;
    const v = this.game.view;
    this.hoverY = Math.max(v.y0 + 28, Math.min(P.y - rint(56, 84), this.y - 10));
    this.setState('rise');
    this.t = -delayT;
  }
}

// ---------------------------------------------------------------- CAVALEIRO VOADOR
// Atravessa a tela da direita para a esquerda em onda senoidal; o escudo bloqueia tiros que chegam pela frente.
export class Knight extends Enemy {
  constructor(game, x, baseY, phase, pot) {
    super(game, 'knight', x, baseY, { pot });
    this.w = 16; this.h = 26;
    this.baseY = baseY; this.phase = phase;
    this.amp = 64; this.period = 128;
    this.dir = -1; this.facing = -1;
    this.deathFx = 'burst';
    this.alpha = 0;
    this.place();
  }
  place() {
    const a = ((this.animT + this.phase) / this.period) * Math.PI * 2;
    this.y = this.baseY + Math.sin(a) * this.amp + this.h / 2;
    this.vyNow = Math.cos(a) * this.amp * (Math.PI * 2 / this.period);
  }
  update() {
    this.pre();
    this.alpha = Math.min(1, this.alpha + 0.08);
    this.x += this.dir * 1.0;
    this.place();
    this.angle = Math.atan2(this.vyNow, this.dir * 1.0);
    if (this.x < this.game.view.x0 - 60) this.remove = true;
  }
  onHit(shot) {
    // normal do escudo = direção do movimento
    const vx = this.dir * 1.0, vy = this.vyNow;
    const vl = Math.hypot(vx, vy) || 1;
    const sx = shot.vx || 0, sy = shot.vy || 0, sl = Math.hypot(sx, sy) || 1;
    const dot = (-(sx / sl)) * (vx / vl) + (-(sy / sl)) * (vy / vl);
    if (dot > 0.62) {
      this.game.fx.emit('clink', shot.x, shot.y);
      this.game.sfx('block');
      return 'block';
    }
    return super.onHit(shot);
  }
}

// ---------------------------------------------------------------- WOODY PIG (fantasma da floresta)
export class WoodyPig extends Enemy {
  constructor(game, x, y, dir) {
    super(game, 'pig', x, y);
    this.w = 18; this.h = 16;
    this.dir = dir; this.facing = dir;
    this.state = 'spawn'; this.hittable = false; this.harmful = false;
    this.alpha = 0;
    this.actT = rint(30, 90);
    this.deathFx = 'burst';
  }
  update() {
    this.pre();
    const P = this.P;
    switch (this.state) {
      case 'spawn':
        this.alpha = Math.min(1, this.t / 30);
        if (this.t >= 36) { this.setState('fly'); this.hittable = this.harmful = true; }
        break;
      case 'fly':
        this.x += this.dir * 1.25;
        this.facing = this.dir;
        if (--this.actT <= 0) {
          this.actT = rint(30, 90);
          if (chance(0.5)) {
            const down = chance(0.5);
            if (down) this.game.addEnemyShot(new EnemyShot(this.game, 'spearDown', this.x, this.y - 4, 0, 2.5));
            else this.game.addEnemyShot(new EnemyShot(this.game, 'spear', this.x + this.dir * 8, this.y - 8, this.dir * 2.0, 0));
            this.setState('shoot'); this.game.sfx('spear');
          } else { this.setState('wait'); this.waitT = rint(40, 90); }
        }
        // passou bem do Arthur: faz a curva (meia-volta em arco)
        if ((this.dir > 0 && this.x > P.x + 90) || (this.dir < 0 && this.x < P.x - 90)) {
          this.turnUp = chance(0.5);
          this.turnR = rrange(15, 25);
          this.turnC = { x0: this.x, y0: this.y };
          if (this.y - 2 * this.turnR < this.game.view.y0 + 16) this.turnUp = false;
          this.setState('turn');
        }
        break;
      case 'shoot': if (this.t > 18) this.setState('fly'); break;
      case 'wait':
        this.y += Math.sin(this.t * 0.2) * 0.3;
        if (this.t > this.waitT) this.setState('fly');
        break;
      case 'turn': {
        // semicírculo: sobe (ou desce) e volta na direção oposta
        const k = Math.min(1, this.t / 48);
        const phi = Math.PI * k, r = this.turnR;
        this.x = this.turnC.x0 + this.dir * r * Math.sin(phi);
        this.y = this.turnUp ? (this.turnC.y0 - r) + r * Math.cos(phi) : (this.turnC.y0 + r) - r * Math.cos(phi);
        if (k >= 1) { this.dir = -this.dir; this.facing = this.dir; this.setState('fly'); }
        break;
      }
    }
    if (this.offscreen(120)) this.remove = true;
  }
}

// ---------------------------------------------------------------- PETITE DEVIL
// Sai de uma janela (ou da lava), mergulha até o chão, persegue o Arthur aos saltos e depois voa em zigue-zague.
export class Devil extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, o.lava ? 'lavadevil' : 'devil', x, y, o);
    this.w = 14; this.h = 14;
    this.state = 'appear'; this.alpha = 0; this.hittable = false; this.harmful = false;
    this.lava = !!o.lava;
    this.onGround = false;
  }
  update() {
    this.pre();
    const P = this.P, lv = this.game.level;
    switch (this.state) {
      case 'appear':
        this.alpha = Math.min(1, this.t / 20);
        if (this.lava) this.y -= 1.2;
        if (this.t >= (this.lava ? 50 : 24)) {
          this.hittable = this.harmful = true;
          this.faceP();
          if (this.lava) { this.setState('fly'); this.flyDir = this.facing; }
          else { this.setState('dive'); this.vx = this.facing * 1.4; this.vy = 1.8; }
        }
        break;
      case 'dive': {
        this.x += this.vx; this.y += this.vy;
        const f = lv.findFloor(this.x - 5, this.x + 5, this.y - this.vy, this.y);
        if (f) { this.y = f.y; this.onGround = true; this.groundRef = f.ref; this.setState('hop'); }
        if (this.y > lv.ph + 20) this.remove = true;
        break;
      }
      case 'hop': {
        this.faceP();
        if (this.onGround) { this.vx = this.facing * 1.5; if (this.t % 18 === 0) { this.vy = -1.6; this.onGround = false; } }
        moveBody(this, lv, { ignoreRects: true, gravity: 0.18 });
        if (this.t > (this.hopLen || (this.hopLen = rint(110, 150)))) { this.setState('leap'); this.vy = -4; this.onGround = false; this.flyDir = this.facing; }
        break;
      }
      case 'leap':
        this.y += this.vy; this.vy += 0.12; this.x += this.flyDir * 1.2;
        if (this.vy >= 0) this.setState('fly');
        break;
      case 'fly': {
        // zigue-zague errático em direção ao Arthur
        if (this.t % 32 === 0) { this.flyDir = this.dx() < 0 ? -1 : 1; this.zig = rrange(-1.2, 1.2); }
        const ty = P.y - 20;
        this.x += (this.flyDir || 1) * 1.3;
        this.y += Math.max(-1, Math.min(1, (ty - this.y) * 0.03)) + (this.zig || 0) * Math.sin(this.t * 0.2);
        this.facing = this.flyDir || 1;
        if (this.t > 220) { this.setState('dive'); this.vx = this.facing * 1.4; this.vy = 1.8; }
        break;
      }
    }
    if (this.offscreen(100)) this.remove = true;
  }
}

// ---------------------------------------------------------------- BIG MAN (ogro)
export class BigMan extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'bigman', x, y, o);
    this.w = 26; this.h = 44;
    this.hp = 10;
    this.patrol = o.patrol || [x - 80, x + 80];
    this.facing = -1;
    this.state = 'patrol';
    this.throwT = rint(90, 150);
    this.deathFx = 'bigburst';
  }
  update() {
    this.pre();
    const P = this.P, lv = this.game.level;
    const sameFloor = Math.abs(P.y - this.y) < 30;
    const near = Math.abs(this.dx()) < 130 && sameFloor && !P.dead;
    if (this.state === 'throw') {
      this.vx = 0;
      if (this.t === 14) {
        const dir = this.facing;
        const dist = Math.max(30, Math.min(120, Math.abs(this.dx())));
        const vx = dir * (dist / 40);
        this.game.addEnemyShot(new EnemyShot(this.game, 'flail', this.x + dir * 12, this.y - 36, vx, -3.2, { gravity: 0.16 }));
        this.game.sfx('flail');
      }
      if (this.t > 30) this.setState(near ? 'charge' : 'patrol');
    } else if (near) {
      if (this.state !== 'charge') this.setState('charge');
      this.faceP();
      this.vx = this.facing * 1.1;
      if (--this.throwT <= 0) { this.throwT = rint(100, 170); this.setState('throw'); }
    } else {
      if (this.state !== 'patrol') this.setState('patrol');
      this.vx = this.facing * 0.5;
      if (this.x < this.patrol[0]) this.facing = 1;
      if (this.x > this.patrol[1]) this.facing = -1;
    }
    const ahead = this.x + this.facing * 14;
    if (this.vx && !lv.groundUnder(ahead - 1, ahead + 1, this.y, { noPlatforms: true })) { this.vx = 0; if (this.state === 'patrol') this.facing = -this.facing; }
    const ev = moveBody(this, lv, { ignoreRects: true });
    if (ev.wall && this.state === 'patrol') this.facing = -this.facing;
    if (this.t % 24 === 0 && this.vx) this.game.sfx('stomp', 0.4);
  }
}

// ---------------------------------------------------------------- MORCEGO
export class Bat extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'bat', x, y, o);
    this.w = 14; this.h = 10;
    this.state = o.flying ? 'fly' : 'hang';
    this.dir = o.dir || -1;
    if (o.flying) { this.baseY = y; this.alpha = 0; }
  }
  update() {
    this.pre();
    const P = this.P;
    if (this.state === 'hang') {
      if (Math.abs(this.dx()) < 96 && !P.dead) { this.setState('drop'); this.dir = this.dx() < 0 ? -1 : 1; this.game.sfx('bat'); }
    } else if (this.state === 'drop') {
      // mergulha mirando a altura atual do Arthur (pular faz o morcego subir junto)
      const ty = P.y - 16;
      this.x += this.dir * 1.2;
      this.y += Math.max(-1.5, Math.min(2.2, (ty - this.y) * 0.08));
      this.facing = this.dir;
      if (Math.abs(this.y - ty) < 4 || this.t > 70) { this.baseY = this.y; this.setState('fly'); }
    } else {
      this.alpha = Math.min(1, this.alpha + 0.1);
      this.x += this.dir * 1.4;
      this.y = this.baseY + Math.sin(this.t * 0.18) * 8;
      this.facing = this.dir;
      if (this.offscreen(40)) this.remove = true;
    }
  }
}

// ---------------------------------------------------------------- TORRE MONSTRO (pilar com rostos)
export class Tower extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'tower', x, y, o);
    this.w = 16; this.h = 48;
    this.hp = 8;
    this.state = 'dormant';
    this.hittable = true; this.harmful = false;
    this.faces = [];
    this.deathFx = 'bigburst';
  }
  onHit(shot) {
    if (this.state === 'dormant') { this.game.fx.emit('spark', shot.x, shot.y); this.game.sfx('block'); return 'block'; }
    return super.onHit(shot);
  }
  update() {
    this.pre();
    if (this.state === 'dormant') {
      if (Math.abs(this.dx()) < 140 && Math.abs(this.P.y - this.y) < 80) { this.setState('wake'); this.game.sfx('tower'); }
    } else if (this.state === 'wake') {
      if (this.t > 40) {
        this.setState('active');
        const two = chance(0.5);
        this.faces = two ? [{ oy: 12, t: rint(20, 60) }, { oy: 36, t: rint(60, 110) }] : [{ oy: chance(0.5) ? 14 : 34, t: rint(20, 60) }];
      }
    } else {
      this.faceP();
      for (const f of this.faces) {
        if (--f.t <= 0) {
          f.t = rint(90, 130); f.open = 12;
          this.game.addEnemyShot(new EnemyShot(this.game, 'orb', this.x + this.facing * 8, this.y - f.oy, this.facing * 1.4, 0));
          this.game.sfx('orb');
        }
        if (f.open) f.open--;
      }
    }
  }
}

// ---------------------------------------------------------------- ESQUELETO (sai de uma caveira)
export class Skeleton extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'skeleton', x, y, o);
    this.w = 12; this.h = 10;
    this.state = 'skull';
    this.harmful = false;
  }
  update() {
    this.pre();
    const P = this.P, lv = this.game.level;
    if (this.state === 'skull') {
      if (Math.abs(this.dx()) < 72 && Math.abs(P.y - this.y) < 24 && !P.dead) { this.setState('rise'); this.game.sfx('bones'); }
    } else if (this.state === 'rise') {
      this.h = 10 + Math.min(1, this.t / 30) * 18;
      this.harmful = this.t > 12;
      if (this.t >= 30) { this.setState('walk'); this.h = 28; this.harmful = true; }
    } else if (this.state === 'walk') {
      this.faceP();
      this.vx = this.facing * 0.75;
      const ahead = this.x + this.facing * 8;
      if (!lv.groundUnder(ahead - 1, ahead + 1, this.y, { noPlatforms: true })) this.vx = 0;
      moveBody(this, lv, { ignoreRects: true });
      if (Math.abs(this.dx()) < 48 && this.t > 30 && this.onGround && Math.abs(P.y - this.y) < 30) {
        this.setState('jump'); this.vy = -3.4; this.vx = this.facing * 1.3; this.onGround = false;
      }
    } else if (this.state === 'jump') {
      const ev = moveBody(this, lv, { ignoreRects: true, gravity: 0.18 });
      if (ev.landed || this.onGround) this.setState('walk');
      if (this.y > lv.ph + 20) this.remove = true;
    }
  }
}

// ---------------------------------------------------------------- MAGO
// Aparece quando o Arthur acerta 15 tiros em lápides/rochas e lança um feitiço que o transforma em sapo.
export class Magician extends Enemy {
  constructor(game, x, y) {
    super(game, 'magician', x, y);
    this.w = 16; this.h = 28;
    this.state = 'appear'; this.alpha = 0; this.hittable = false; this.harmful = false;
    this.casts = 0;
  }
  update() {
    this.pre();
    this.faceP();
    if (this.state === 'appear') {
      this.alpha = Math.min(1, this.t / 40);
      if (this.t >= 60) { this.setState('cast'); this.hittable = true; this.harmful = true; }
    } else if (this.state === 'cast') {
      if (this.t === 24) {
        this.game.addEnemyShot(EnemyShot.aimed(this.game, 'spell', this.x + this.facing * 8, this.y - 16, this.P.x, this.P.y - 12));
        this.game.sfx('spell');
        this.casts++;
      }
      if (this.t > 70) this.setState('vanish');
    } else if (this.state === 'vanish') {
      this.alpha = 1 - this.t / 40;
      this.hittable = this.t < 20;
      if (this.t >= 40) this.remove = true;
    }
  }
}

// ---------------------------------------------------------------- JATO DE FOGO (fase 4)
export class FireJet extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'firejet', x, y, o);
    this.w = 14; this.h = 0;
    this.hittable = false;
    this.cycle = 200;
    this.offset = o.offset ?? Math.floor(rnd() * 200);
    this.maxH = 84;
  }
  update() {
    this.pre();
    const k = (this.animT + this.offset) % this.cycle;
    let f = 0;
    if (k < 24) f = k / 24; else if (k < 64) f = 1; else if (k < 88) f = 1 - (k - 64) / 24;
    this.h = f * this.maxH;
    this.harmful = this.h > 30;
    this.level = f;
    if (k === 0 && Math.abs(this.dx()) < 200) this.game.sfx('jet', 0.5);
  }
}

// ---------------------------------------------------------------- PRINCESA (cena final)
export class Princess extends Enemy {
  constructor(game, x, y) { super(game, 'princess', x, y); this.harmful = false; this.hittable = false; this.facing = -1; }
  update() { this.pre(); }
}
