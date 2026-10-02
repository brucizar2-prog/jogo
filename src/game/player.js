import { ARTHUR, WEAPONS } from '../core/const.js';
import { moveBody } from './level.js';

// Arthur. Coordenadas: x = centro, y = pés.
export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.reset(x, y);
    this.weapon = 'lance';
    this.lives = 3;
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.w = ARTHUR.w; this.h = ARTHUR.h;
    this.facing = 1;
    this.onGround = true; this.groundRef = null;
    this.state = 'stand';      // stand walk crouch jump fall climb throw hit dead frog win
    this.stateT = 0;
    this.armor = true;
    this.invuln = 0;
    this.throwT = 0;
    this.cooldown = 0;
    this.crouch = false;
    this.ladder = null;
    this.climbTop = false;
    this.frogT = 0;
    this.dead = false;
    this.deathT = 0;
    this.animT = 0;
    this.jumpDir = 0;
    this.hitDir = 0;
    this.fallDriftTick = 0;
    this.drownT = 0;
    this.locked = false;       // trava de controle (cutscenes, porta)
  }

  get frog() { return this.frogT > 0; }
  get box() {
    const h = this.crouch ? ARTHUR.hCrouch : (this.frog ? 14 : this.h);
    return { x0: this.x - this.w / 2 + 1, y0: this.y - h, x1: this.x + this.w / 2 - 1, y1: this.y };
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }

  update(input) {
    const g = this.game, lv = g.level;
    this.animT++;
    this.stateT++;
    if (this.invuln > 0) this.invuln--;
    if (this.cooldown > 0) this.cooldown--;

    if (this.dead) { this.updateDead(); return; }
    if (this.state === 'hit') { this.updateHit(); return; }
    if (this.state === 'win') { this.vx = 0; moveBody(this, lv); return; }

    if (this.frogT > 0) {
      this.frogT--;
      if (this.frogT === 0) { g.fx.emit('transform', this.x, this.y - 12); g.sfx('transform'); }
    }

    const L = input.held.left && !this.locked, R = input.held.right && !this.locked;
    const U = input.held.up && !this.locked, D = input.held.down && !this.locked;
    const jumpP = input.pressed.jump && !this.locked, fireP = input.pressed.fire && !this.locked;

    // ------------- escada
    if (this.state === 'climb') { this.updateClimb(U, D, L, R, jumpP); return; }

    if (this.onGround) {
      // terminou um pulo
      if (this.state === 'jump' || this.state === 'fall') this.setState('stand');
      this.crouch = false;

      // agarra a escada
      if ((U || D) && !this.frog) {
        const l = lv.ladderAt(this.x, this.y, 6);
        if (l && ((U && this.y > l.top + 1) || (D && Math.abs(this.y - l.top) < 2))) {
          this.ladder = l; this.x = l.cx; this.setState('climb');
          this.onGround = false; this.groundRef = null; this.vx = 0; this.vy = 0;
          if (D) this.y = l.top + 2;
          return;
        }
      }

      if (this.throwT > 0) {
        this.throwT--; this.vx = 0;
        this.crouch = this.state === 'crouchthrow';
        if (this.throwT === 0) this.setState(this.crouch ? 'crouch' : 'stand');
      } else if (jumpP) {
        this.jumpDir = L ? -1 : R ? 1 : 0;
        if (this.jumpDir) this.facing = this.jumpDir;
        const sp = this.frog ? 0.6 : ARTHUR.jumpVx;
        this.vx = this.jumpDir * sp;
        this.vy = this.frog ? -3.0 : ARTHUR.jumpVy;
        this.onGround = false; this.groundRef = null;
        this.setState('jump');
        g.sfx(this.frog ? 'frogjump' : 'jump');
      } else if (D && !this.frog) {
        this.crouch = true; this.vx = 0;
        if (L) this.facing = -1; else if (R) this.facing = 1;
        this.setState('crouch');
      } else if (L || R) {
        this.facing = L ? -1 : 1;
        this.vx = this.facing * (this.frog ? 0.5 : ARTHUR.walk);
        this.setState('walk');
      } else {
        this.vx = 0;
        this.setState('stand');
      }
      if (fireP && this.throwT === 0 && !this.frog) this.tryThrow();
    } else {
      // no ar: arco fixo, mas pode atacar
      this.crouch = false;
      if (fireP && !this.frog) this.tryThrow();
      if (this.throwT > 0) this.throwT--;
    }

    const wasGround = this.onGround;
    const ev = moveBody(this, lv, { gravity: ARTHUR.gravity, maxFall: ARTHUR.maxFall });
    if (ev.fell && wasGround) {
      // saiu de uma borda andando: cai com deriva lenta
      this.vy = 0;
      this.vx = this.vx ? Math.sign(this.vx) * ARTHUR.fallDrift : 0;
      this.setState('fall');
    }
    if (ev.landed) {
      this.vx = 0;
      g.sfx('land');
      g.fx.emit('dust', this.x, this.y);
      if (this.state === 'jump' || this.state === 'fall') this.setState('stand');
    }
    if (!this.onGround && this.state !== 'jump' && this.state !== 'fall') this.setState('fall');

    // perigos: água, lava, queda no abismo
    if (lv.hazardAt(this.x, this.y) || this.y > lv.ph + 40) {
      const hz = lv.hazardAt(this.x, this.y);
      this.die(hz ? hz.t : 'pit');
    }
  }

  updateClimb(U, D, L, R) {
    const l = this.ladder;
    this.vx = 0;
    this.x = l.cx;
    if (U) {
      this.y -= ARTHUR.climb;
      if (this.y <= l.top) {
        this.y = l.top; this.onGround = true; this.ladder = null; this.setState('stand');
        return;
      }
    } else if (D) {
      this.y += ARTHUR.climb;
      if (this.y >= l.bottom) {
        this.y = l.bottom; this.onGround = true; this.ladder = null; this.setState('stand');
        return;
      }
    }
    this.climbTop = this.y - l.top < 14;
    if (U || D) this.climbAnim = (this.climbAnim || 0) + 1;
  }

  tryThrow() {
    const g = this.game;
    if (this.cooldown > 0) return;
    const spec = WEAPONS[this.weapon];
    if (g.countPlayerShots(this.weapon) >= spec.max) return;
    const crouching = this.onGround && this.crouch;
    const hy = crouching ? this.y - 9 : this.y - 19;
    g.spawnPlayerShot(this.weapon, this.x + this.facing * 6, hy, this.facing);
    this.cooldown = spec.cooldown;
    this.throwT = 8;
    if (this.onGround) this.setState(crouching ? 'crouchthrow' : 'throw');
    else this.airThrowT = 10;
    g.sfx('throw');
  }

  // dano recebido; dir = de onde veio (-1 esquerda, 1 direita)
  hurt(dir = 0, kind = 'touch') {
    if (this.dead || this.invuln > 0 || this.state === 'hit' || this.state === 'win') return false;
    const g = this.game;
    if (this.frog) { this.frogT = 0; }
    if (this.armor) {
      this.armor = false;
      g.fx.emit('armorbreak', this.x, this.y - 16, { dir });
      g.sfx('armor');
      this.hitDir = dir || -this.facing;
      this.ladder = null;
      this.setState('hit');
      this.vx = this.hitDir * 1.0;
      this.vy = -3.2;
      this.onGround = false; this.groundRef = null;
      this.invuln = ARTHUR.invuln;
      return true;
    }
    this.die(kind);
    return true;
  }

  updateHit() {
    const lv = this.game.level;
    const ev = moveBody(this, lv, { gravity: 0.2, maxFall: ARTHUR.maxFall });
    if (ev.wall) this.vx = 0;
    if (this.onGround && this.stateT > 4) { this.vx = 0; this.setState('stand'); }
    if (lv.hazardAt(this.x, this.y) || this.y > lv.ph + 40) this.die('pit');
  }

  die(kind = 'touch') {
    if (this.dead) return;
    this.dead = true;
    this.armorAtDeath = this.armor;
    this.deathKind = kind;
    this.deathT = 0;
    this.vx = 0; this.vy = 0;
    this.armor = false; this.frogT = 0;
    this.setState('dead');
    this.game.onPlayerDeath(kind);
  }

  updateDead() {
    this.deathT++;
    if (this.deathKind === 'touch' || this.deathKind === 'spell') {
      // cai e desmonta em ossos
      if (!this.onGround) moveBody(this, this.game.level, { gravity: 0.2 });
    }
  }

  becomeFrog() {
    if (this.dead || this.frog) return;
    this.frogT = 300;
    this.crouch = false;
    if (this.state === 'climb') { this.ladder = null; this.onGround = false; this.setState('fall'); }
    this.game.fx.emit('transform', this.x, this.y - 12);
    this.game.sfx('transform');
  }
}
