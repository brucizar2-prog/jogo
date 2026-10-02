// Chefes: Unicórnio (ciclope), Dragão, Satã e Astaroth.
import { Enemy } from './enemies.js';
import { EnemyShot } from './objects.js';
import { moveBody } from './level.js';
import { rnd, rint, rrange, chance } from '../core/rng.js';

// ---------------------------------------------------------------- UNICÓRNIO
// Anda em direção ao Arthur cuspindo fogo, salta em arco até onde ele estava (às vezes por cima dele)
// e faz o chão tremer ao aterrissar. 10 acertos.
export class Unicorn extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'unicorn', x, y, o);
    this.w = 28; this.h = 46;
    this.hp = 10;
    this.boss = !!o.boss;
    this.arena = o.arena || null;
    this.state = 'wait';
    this.facing = -1;
    this.deathFx = 'bossburst';
    this.awake = false;
  }
  clampArena() {
    if (!this.arena) return;
    this.x = Math.max(this.arena[0] + 16, Math.min(this.arena[1] - 16, this.x));
  }
  update() {
    this.pre();
    const P = this.P, lv = this.game.level;
    if (this.state !== 'jump') this.faceP();
    switch (this.state) {
      case 'wait':
        if (!this.awake) {
          if ((this.boss && this.game.bossActive) || (!this.boss && Math.abs(this.dx()) < 150 && Math.abs(P.y - this.y) < 40)) {
            this.awake = true; this.setState('angry'); this.game.sfx('roar');
          }
        } else if (this.t > (this.waitT || 30)) this.setState('angry');
        break;
      case 'angry':
        if (this.t > 30) this.choose();
        break;
      case 'walk':
        this.vx = this.walkDir * 1.25;
        this.facing = this.walkDir;
        moveBody(this, lv, { ignoreRects: true });
        this.clampArena();
        if (--this.shootT <= 0) { this.setState('shoot'); break; }
        if ((this.walkDir > 0 && this.x > this.walkTo) || (this.walkDir < 0 && this.x < this.walkTo) || this.t > 200) this.afterAction();
        if (this.t % 20 === 0) this.game.sfx('stomp', 0.5);
        break;
      case 'shoot':
        if (this.t === 10) { this.shoot('ufire', 1, 34, this.facing * 14); this.game.sfx('fireball'); }
        if (this.t > 26) this.afterAction();
        break;
      case 'jump': {
        const k = Math.min(1, this.t / this.jumpDur);
        this.x = this.jx0 + (this.jx1 - this.jx0) * k;
        this.y = this.jy0 - Math.sin(Math.PI * k) * this.jumpH;
        if (k >= 1) {
          this.y = this.jy0;
          const g = lv.groundUnder(this.x - 8, this.x + 8, this.y, { noPlatforms: true });
          if (!g) { this.onGround = false; this.vy = 0; moveBody(this, lv); }
          this.game.shake(8); this.game.sfx('land_big');
          this.game.fx.emit('dust', this.x - 10, this.y); this.game.fx.emit('dust', this.x + 10, this.y);
          this.afterAction();
        }
        break;
      }
      case 'fall':
        moveBody(this, lv, { ignoreRects: true });
        if (this.onGround) this.afterAction();
        break;
    }
    if (!this.onGround && this.state !== 'jump' && this.state !== 'fall') { this.setState('fall'); }
  }
  choose() {
    if (chance(0.5)) this.startJump(); else this.startWalk();
  }
  afterAction() {
    const r = rnd();
    if (r < 0.3) { this.setState('wait'); this.waitT = rint(16, 40); }
    else if (r < 0.65) this.startJump();
    else this.startWalk();
  }
  startWalk() {
    const P = this.P;
    this.walkDir = P.x < this.x ? -1 : 1;
    this.walkTo = P.x + this.walkDir * 37;
    this.shootT = rint(30, 90);
    this.setState('walk');
  }
  startJump() {
    const P = this.P;
    this.jx0 = this.x; this.jy0 = this.y;
    let tx = P.x + (chance(0.4) ? Math.sign(P.x - this.x) * rint(20, 50) : 0);
    if (this.arena) tx = Math.max(this.arena[0] + 16, Math.min(this.arena[1] - 16, tx));
    this.jx1 = tx;
    this.jumpH = rint(56, 80);
    this.jumpDur = Math.max(40, Math.abs(tx - this.x) / 1.6);
    this.facing = tx < this.x ? -1 : 1;
    this.setState('jump');
    this.game.sfx('roar', 0.5);
  }
}

// ---------------------------------------------------------------- DRAGÃO
// Corpo segmentado que segue a cabeça; flutua devagar, muda de direção bruscamente e mergulha.
// Só a cabeça é vulnerável (6 acertos). Cospe fogo mirando no Arthur.
export class Dragon extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'dragon', x, y, o);
    this.w = 24; this.h = 20;
    this.hp = o.hp || 6;
    this.boss = !!o.boss;
    this.box2 = o.area;        // {x0,x1,y0,y1} área onde voa
    this.nseg = 11; this.spacing = 7;
    this.hist = [];
    for (let i = 0; i < this.nseg * this.spacing + 2; i++) this.hist.push({ x: x + i * 1.2, y: y });
    this.segs = [];
    this.vx = -1; this.vy = 0;
    this.speed = 1.0;
    this.state = this.boss ? 'sleep' : 'fly';
    this.fireT = rint(90, 150);
    this.pickWaypoint();
    this.deathFx = 'bossburst';
    this.dying = 0;
    this.updateSegs();
  }
  pickWaypoint(dive = false) {
    const a = this.box2, P = this.P;
    if (dive) this.wp = { x: P.x, y: Math.min(a.y1, P.y - 8) };
    else this.wp = { x: rrange(a.x0 + 20, a.x1 - 20), y: rrange(a.y0 + 16, a.y1 - 24) };
    this.speed = dive ? 2.0 : rrange(0.8, 1.4);
    this.wpT = 0;
  }
  updateSegs() {
    this.segs.length = 0;
    for (let i = 1; i <= this.nseg; i++) {
      const h = this.hist[Math.min(this.hist.length - 1, i * this.spacing)];
      this.segs.push({ x: h.x, y: h.y, r: i === this.nseg ? 5 : 7 - i * 0.12 });
    }
  }
  parts() {
    const out = [{ box: { x0: this.x - 12, y0: this.y - 20, x1: this.x + 12, y1: this.y }, hittable: true, harmful: true, part: 'head' }];
    for (const s of this.segs) out.push({ box: { x0: s.x - s.r, y0: s.y - 10 - s.r, x1: s.x + s.r, y1: s.y - 10 + s.r }, hittable: true, harmful: true, part: 'body' });
    return out;
  }
  onHit(shot, part) {
    if (this.state === 'sleep') { this.state = 'fly'; this.game.bossActive = true; }
    if (part === 'body') { this.game.fx.emit('clink', shot.x, shot.y); this.game.sfx('block'); return 'block'; }
    return super.onHit(shot);
  }
  update() {
    this.pre();
    const P = this.P;
    if (this.state === 'sleep') {
      this.y = this.oy + Math.sin(this.animT * 0.05) * 2;
      if (this.game.bossActive) this.state = 'fly';
    } else {
      this.wpT++;
      const dx = this.wp.x - this.x, dy = (this.wp.y) - this.y;
      const d = Math.hypot(dx, dy);
      // virada suave em direção ao ponto alvo (curva característica do corpo)
      const tvx = (dx / (d || 1)) * this.speed, tvy = (dy / (d || 1)) * this.speed;
      this.vx += (tvx - this.vx) * 0.06; this.vy += (tvy - this.vy) * 0.06;
      this.x += this.vx; this.y += this.vy;
      if (d < 8 || this.wpT > 240) this.pickWaypoint(chance(0.22));
      if (this.vx !== 0) this.facing = this.vx < 0 ? -1 : 1;
      if (--this.fireT <= 0 && !P.dead) {
        this.fireT = rint(100, 170);
        this.burst = 3;
      }
      if (this.burst && this.animT % 8 === 0) {
        this.burst--;
        this.shoot('dfire', 1, 12, this.facing * 12);
        this.game.sfx('dragonfire');
      }
    }
    this.hist.unshift({ x: this.x, y: this.y });
    this.hist.length = this.nseg * this.spacing + 2;
    this.updateSegs();
  }
  kill() {
    super.kill();
    // explosões em cadeia do rabo até a cabeça
    this.segs.slice().reverse().forEach((s, i) => this.game.later(i * 5, () => this.game.fx.emit('burst', s.x, s.y - 10, { size: 16 })));
  }
}

// ---------------------------------------------------------------- SATÃ
// Fica de asas fechadas (bloqueia tudo), abre as asas, paira de um lado, atira estrelas
// e dá rasantes em "V" até o outro lado da arena.
export class Satan extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'satan', x, y, o);
    this.w = 30; this.h = 40;
    this.hp = o.hp || 8;
    this.boss = true;
    this.arena = o.arena; this.arenaY = o.arenaY;
    this.state = 'guard';
    this.wings = 0;   // 0 fechadas, 1 abertas
    this.order = o.order || 0;
    this.deathFx = 'bossburst';
    this.onGround = true;
  }
  floorY() {
    const f = this.game.level.findFloor(this.x - 8, this.x + 8, this.y - 4, this.y + 300, { noPlatforms: true });
    return f ? f.y : this.y;
  }
  onHit(shot) {
    if (this.wings < 0.5) { this.game.fx.emit('clink', shot.x, shot.y); this.game.sfx('block'); return 'block'; }
    return super.onHit(shot);
  }
  update() {
    this.pre();
    const P = this.P;
    const ax0 = this.arena[0] + 24, ax1 = this.arena[1] - 24;
    switch (this.state) {
      case 'guard':
        this.wings = Math.max(0, this.wings - 0.1);
        this.faceP();
        if (this.game.bossActive && this.t > (this.order ? 120 + this.order * 90 : 40) + (this.guardT || 0)) { this.setState('open'); this.game.sfx('satan'); }
        break;
      case 'open':
        this.wings = Math.min(1, this.wings + 0.06);
        if (this.t > 24) { this.setState('takeoff'); this.side = P.x < (ax0 + ax1) / 2 ? 1 : -1; }
        break;
      case 'takeoff': {
        const hx = this.side > 0 ? ax1 - 10 : ax0 + 10;
        const hy = this.arenaY[0] + 40;
        this.x += Math.sign(hx - this.x) * Math.min(1.6, Math.abs(hx - this.x));
        this.y += Math.sign(hy - this.y) * Math.min(1.8, Math.abs(hy - this.y));
        this.faceP();
        if (Math.abs(hx - this.x) < 2 && Math.abs(hy - this.y) < 2) { this.setState('hover'); this.stars = rint(2, 3); }
        break;
      }
      case 'hover':
        this.y += Math.sin(this.t * 0.1) * 0.5;
        this.faceP();
        if (this.t % 34 === 20 && this.stars > 0) { this.stars--; this.shoot('star', 1, 26, this.facing * 10); this.game.sfx('star'); }
        if (this.t > 120) {
          // rasante: desce até a altura do Arthur e sobe do outro lado
          this.sx0 = this.x; this.sy0 = this.y;
          this.sx1 = this.side > 0 ? ax0 + 10 : ax1 - 10;
          this.sMid = { x: P.x, y: Math.min(this.floorY() - 4, P.y + 6) };
          this.setState('swoop');
        }
        break;
      case 'swoop': {
        const dur = 110;
        const k = Math.min(1, this.t / dur);
        // curva de Bézier quadrática passando perto do Arthur
        const cx = 2 * this.sMid.x - (this.sx0 + this.sx1) / 2, cy = 2 * this.sMid.y - this.sy0 / 2 - this.sy0 / 2;
        const u = 1 - k;
        this.x = u * u * this.sx0 + 2 * u * k * cx + k * k * this.sx1;
        this.y = u * u * this.sy0 + 2 * u * k * cy + k * k * this.sy0;
        this.facing = this.sx1 > this.sx0 ? 1 : -1;
        if (k >= 1) {
          this.side = -this.side;
          if (chance(0.45)) { this.setState('land'); } else { this.setState('hover'); this.stars = rint(1, 3); }
        }
        break;
      }
      case 'land': {
        const fy = this.floorY();
        this.y = Math.min(fy, this.y + 1.8);
        this.faceP();
        if (this.y >= fy) { this.y = fy; this.setState('guard'); this.guardT = rint(20, 70) - 40; this.wings = 1; this.game.shake(4); }
        break;
      }
    }
    this.x = Math.max(this.arena[0] + 12, Math.min(this.arena[1] - 12, this.x));
  }
}

// ---------------------------------------------------------------- ASTAROTH (chefe final)
export class Astaroth extends Enemy {
  constructor(game, x, y, o = {}) {
    super(game, 'astaroth', x, y, o);
    this.w = 44; this.h = 70;
    this.hp = o.hp || 12;
    this.boss = true;
    this.state = 'idle';
    this.fireT = 60;
    this.deathFx = 'bossburst';
    this.home = x;
  }
  parts() {
    return [
      { box: { x0: this.x - 16, y0: this.y - 70, x1: this.x + 16, y1: this.y - 44 }, hittable: true, harmful: true, part: 'head' },
      { box: { x0: this.x - 22, y0: this.y - 44, x1: this.x + 22, y1: this.y }, hittable: true, harmful: true, part: 'body' },
    ];
  }
  onHit(shot, part) {
    if (part === 'body') { this.game.fx.emit('clink', shot.x, shot.y); this.game.sfx('block'); return 'block'; }
    return super.onHit(shot);
  }
  update() {
    this.pre();
    this.faceP();
    if (!this.game.bossActive) return;
    this.walkT = (this.walkT || 0) + 1;
    this.x = this.home + Math.sin(this.walkT * 0.012) * 26;
    if (--this.fireT <= 0) {
      this.fireT = rint(60, 110);
      this.mouthT = 16;
      if (chance(0.5)) { this.shoot('afire', 1, 58, this.facing * 12); }
      else {
        // boca da barriga: fogo baixo em linha reta
        this.game.addEnemyShot(new EnemyShot(this.game, 'afire', this.x + this.facing * 16, this.y - 22, this.facing * 2.0, 0));
      }
      this.game.sfx('fireball');
    }
    if (this.mouthT) this.mouthT--;
  }
}
