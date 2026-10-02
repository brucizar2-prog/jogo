// Simulação de uma fase: câmera, entidades, spawns, colisões, chefes, tempo e fluxo de fim de fase.
import { SCREEN_W, SCREEN_H, EXTRA_LIFE_AT, SCORES } from '../core/const.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { PlayerShot, Item, overlap, POT_TABLE, randomTreasure } from './objects.js';
import { Zombie, Crow, Plant, Arremer, Knight, WoodyPig, Devil, BigMan, Bat, Tower, Skeleton, Magician, FireJet, Princess } from './enemies.js';
import { Unicorn, Dragon, Satan, Astaroth } from './bosses.js';
import { rnd, rint, rrange, chance, seed } from '../core/rng.js';
import { LEVELS } from '../levels/index.js';

class FxBus {
  constructor() { this.queue = []; }
  emit(type, x, y, opts = {}) { this.queue.push({ type, x, y, ...opts }); }
  drain() { const q = this.queue; this.queue = []; return q; }
}

export class Game {
  constructor(app, stage, opts = {}) {
    this.app = app;
    this.stage = stage;
    this.data = LEVELS[stage];
    this.session = app.session;
    this.fx = new FxBus();
    seed(0x9e3779b1 ^ (stage * 7919));
    this.level = new Level(this.data);
    this.fromCheckpoint = !!opts.fromCheckpoint;
    const cp = this.data.checkpoint;
    const st = this.fromCheckpoint && cp ? cp : this.data.start;
    this.player = new Player(this, st.x, st.y);
    this.player.weapon = this.session.weapon || 'lance';
    this.player.lives = this.session.lives;
    if (opts.locked) this.player.locked = true;
    this.enemies = []; this.shots = []; this.eshots = []; this.items = [];
    this.timers = [];
    this.frame = 0;
    this.time = (this.data.time || 180) * 60;
    this.checkpointReached = this.fromCheckpoint;
    this.bossTriggered = false; this.bossActive = false; this.bosses = [];
    this.keyDropped = false; this.keyTaken = false; this.clearT = 0;
    this.finished = null;        // 'clear' | 'dead' | 'timeup'
    this.tombHits = 0;
    this.magicianOut = false;
    this.shakeT = 0; this.shakeA = 0;
    this.potIdx = 0;
    this.spawnCounters = {};
    this.viewW = Math.max(SCREEN_W, opts.viewW || SCREEN_W);
    this.cutscene = !!opts.cutscene;
    this.placements = (this.data.entities || []).map((e, i) => ({ def: e, id: i, spawned: false, killed: false, inst: null }));
    this.spawners = (this.data.spawners || []).map((s) => ({ ...s, timer: rint(30, 90), count: 0 }));
    this.hidden = this.placements.filter((p) => p.def.t === 'hidden');
    // a câmera começa centrada no Arthur
    this.cam = { x: this.player.x, y: this.player.y - 60 };
    this.updateCamera(true);
    this.items.length = 0;
    if (!this.cutscene) this.spawnPlacements(true);
  }

  // ---------------------------------------------------------------- utilidades
  sfx(name, vol = 1) { this.app.audio && this.app.audio.sfx(name, vol); }
  later(frames, fn) { this.timers.push({ t: this.frame + frames, fn }); }
  shake(a) { this.shakeT = 16; this.shakeA = a; }
  addEnemyShot(s) { this.eshots.push(s); }
  addItem(i) { this.items.push(i); }
  countPlayerShots(type) { return this.shots.filter((s) => s.type === type && !s.remove).length; }
  spawnPlayerShot(type, x, y, dir) { this.shots.push(new PlayerShot(this, type, x, y, dir)); }

  addScore(n, x, y) {
    if (!n) return;
    const s = this.session;
    const before = s.score;
    s.score += n;
    if (s.score > s.top) s.top = s.score;
    if (x !== undefined) this.fx.emit('score', x, y, { value: n });
    while (s.extendIdx < EXTRA_LIFE_AT.length && before < EXTRA_LIFE_AT[s.extendIdx] && s.score >= EXTRA_LIFE_AT[s.extendIdx]) {
      s.extendIdx++; s.lives++; this.player.lives = s.lives; this.sfx('extend');
    }
  }

  nextPot() {
    const tbl = POT_TABLE[this.stage] || POT_TABLE[1];
    let c = tbl[this.potIdx++ % tbl.length];
    // armadura só aparece quando o Arthur está sem ela; senão vira tesouro
    if (c === 'armor' && this.player.armor) c = randomTreasure();
    return c;
  }
  dropPot(x, y, contents) {
    this.items.push(new Item(this, 'pot', x, y, { fall: true, contents: contents === true ? this.nextPot() : contents, vy: -2 }));
  }

  // ---------------------------------------------------------------- câmera
  // A câmera lógica (256x224 como o arcade) segue o Arthur; a vista 3D pode ser mais larga.
  updateCamera(snap = false) {
    const P = this.player, lv = this.level;
    let tx = this.cam.x, ty = this.cam.y;
    if (!P.dead) {
      if (P.x > tx + 16) tx = P.x - 16;
      if (P.x < tx - 24) tx = P.x + 24;
      const yt = P.y - 56;
      if (yt < ty - 24) ty = yt + 24;
      if (yt > ty + 16) ty = yt - 16;
    }
    let minX = this.viewW / 2, maxX = lv.pw - this.viewW / 2;
    if (this.bossTriggered && this.data.boss && this.data.boss.arena) {
      const a = this.data.boss.arena;
      minX = Math.max(minX, a[0] + SCREEN_W / 2);
      if (a[1] - a[0] > SCREEN_W) maxX = Math.min(maxX, a[1] - SCREEN_W / 2);
      if (this.data.boss.arenaY) {
        const ay = this.data.boss.arenaY;
        ty = Math.min(ty, Math.max(ay[0] + SCREEN_H / 2 - 16, ty));
      }
    }
    if (maxX < minX) { minX = maxX = lv.pw / 2; }
    tx = Math.max(minX, Math.min(maxX, tx));
    const minY = SCREEN_H / 2 - 16, maxY = Math.max(minY, lv.ph - SCREEN_H / 2 + 8);
    if (this.data.camera && this.data.camera.lockY !== undefined) ty = this.data.camera.lockY;
    else ty = Math.max(minY, Math.min(maxY, ty));
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
    else {
      this.cam.x = tx;
      this.cam.y += (ty - this.cam.y) * 0.25;
    }
    // janela lógica (spawns/ativação) e janela visível (instanciação)
    this.screen = { x0: this.cam.x - SCREEN_W / 2, x1: this.cam.x + SCREEN_W / 2, y0: this.cam.y - SCREEN_H / 2, y1: this.cam.y + SCREEN_H / 2 };
    this.view = { x0: this.cam.x - this.viewW / 2, x1: this.cam.x + this.viewW / 2, y0: this.cam.y - SCREEN_H / 2, y1: this.cam.y + SCREEN_H / 2 };
  }

  // ---------------------------------------------------------------- entidades posicionadas no mapa
  spawnPlacements(initial = false) {
    const v = this.view;
    for (const p of this.placements) {
      if (p.spawned || p.killed) continue;
      const d = p.def;
      if (['hidden'].includes(d.t)) continue;
      const m = d.t === 'item' ? 64 : 40;
      const inX = d.x > v.x0 - m && d.x < v.x1 + m;
      const inY = d.y > v.y0 - 64 && d.y - 40 < v.y1 + 64;
      if (!inX || !inY) continue;
      const inst = this.createFromDef(d, p);
      p.spawned = true; p.inst = inst;
      if (!inst) continue;
      if (inst.kind === 'item') this.items.push(inst); else this.enemies.push(inst);
    }
  }

  createFromDef(d, p) {
    const o = { placement: p };
    switch (d.t) {
      case 'crow': return new Crow(this, d.x, d.y, o);
      case 'raven': return new Crow(this, d.x, d.y, { ...o, red: true });
      case 'plant': return new Plant(this, d.x, d.y, o);
      case 'arremer': return new Arremer(this, d.x, d.y, { ...o, air: d.air, pot: d.window ? null : (this.stage === 6 ? 'cross' : null) });
      case 'bigman': return new BigMan(this, d.x, d.y, { ...o, patrol: d.patrol, pot: true });
      case 'bat': return new Bat(this, d.x, d.y, o);
      case 'tower': return new Tower(this, d.x, d.y, o);
      case 'skull': return new Skeleton(this, d.x, d.y, { ...o, pot: chance(0.25) ? true : null });
      case 'firejet': { const e = new FireJet(this, d.x, d.y, { ...o, offset: (d.x * 7) % 200 }); return e; }
      case 'devilwin': return this.makeWindowDevil(d, p);
      case 'lavadevil': return this.makeLavaDevil(d, p);
      case 'unicorn': return new Unicorn(this, d.x, d.y, o);
      case 'dragonmid': return new Dragon(this, d.x, d.y, { ...o, hp: 6, area: { x0: 80, x1: 440, y0: 600, y1: 728 } });
      case 'princess': return new Princess(this, d.x, d.y);
      case 'item': return new Item(this, d.kind, d.x, d.y, { static: true });
    }
    return null;
  }

  // janelas e lava: o diabinho só surge quando o Arthur passa perto
  makeWindowDevil(d, p) {
    const trig = { kind: 'trigger', update: () => {}, remove: false, x: d.x, y: d.y, w: 0, h: 0, hittable: false, harmful: false, t: 0 };
    trig.update = () => {
      trig.t++;
      if (Math.abs(this.player.x - d.x) < 110 && !this.player.dead) {
        trig.remove = true;
        this.enemies.push(new Devil(this, d.x, d.y, { placement: p, pot: chance(0.3) ? true : null }));
      }
    };
    trig.box = { x0: 0, y0: 0, x1: 0, y1: 0 };
    return trig;
  }
  makeLavaDevil(d, p) {
    const trig = { kind: 'trigger', remove: false, x: d.x, y: d.y, hittable: false, harmful: false, box: { x0: 0, y0: 0, x1: 0, y1: 0 } };
    trig.update = () => {
      if (this.player.x > d.x - 120 && !this.player.dead) {
        trig.remove = true;
        this.enemies.push(new Devil(this, d.x, d.y + 10, { placement: p, lava: true }));
        this.sfx('lavaburst');
      }
    };
    return trig;
  }

  // ---------------------------------------------------------------- geradores (zumbis, cavaleiros, porcos, morcegos)
  updateSpawners() {
    const P = this.player;
    if (P.dead || this.bossTriggered) return;
    for (const s of this.spawners) {
      const inside = P.x >= s.x0 && P.x <= s.x1 && (s.y0 === undefined || (P.y >= s.y0 && P.y <= s.y1));
      if (!inside) continue;
      const alive = this.enemies.filter((e) => e.type === s.t || (s.t === 'pig' && e.type === 'pig') || (s.t === 'bat' && e.type === 'bat' && e.spawned)).length;
      if (alive >= s.max) continue;
      if (--s.timer > 0) continue;
      s.count++;
      const pot = this.potFor(s.t, s.count);
      if (s.t === 'zombie') { this.spawnZombie(pot); s.timer = rint(0, 120); }
      else if (s.t === 'knight') { this.spawnKnight(s, pot); s.timer = rint(30, 120); }
      else if (s.t === 'pig') { this.spawnPig(); s.timer = rint(0, 120); }
      else if (s.t === 'bat') { this.spawnBat(); s.timer = rint(60, 150); }
    }
  }
  potFor(t, n) {
    if (t === 'zombie') return n % 4 === 2 ? true : null;
    if (t === 'knight') return n % 3 === 1 ? true : null;
    return null;
  }
  spawnZombie(pot) {
    const P = this.player, lv = this.level;
    for (let tries = 0; tries < 6; tries++) {
      const side = chance(0.5) ? -1 : 1;
      const x = P.x + side * rrange(66, 208);
      if (x < 16 || x > lv.pw - 16) continue;
      // nasce no mesmo nível em que o Arthur está (chão ou topo do morro)
      const f = lv.findFloor(x - 6, x + 6, P.y - 24, P.y + 120, { noPlatforms: true });
      if (!f || f.ref) continue;
      if (lv.hazardAt(x, f.y + 4)) continue;
      if (Math.abs(f.y - P.y) > 40 && P.onGround) continue;
      const z = new Zombie(this, x, f.y, x < P.x ? 1 : -1, pot);
      this.enemies.push(z);
      this.sfx('zombie');
      this.fx.emit('dirt', x, f.y);
      return;
    }
  }
  spawnKnight(s, pot) {
    const P = this.player;
    // entram pela borda direita da tela original (Arthur.x + 145) em alturas variadas
    if (!this.knightGroup || this.knightGroup.left <= 0) this.knightGroup = { base: 96 + rrange(-25, 25), left: 3 };
    this.knightGroup.left--;
    const base = Math.min(this.screen.y1 - 40, Math.max(this.screen.y0 + 40, this.knightGroup.base - (this.level.ph - 208)));
    const k = new Knight(this, P.x + 145, base, rrange(0, 128), pot);
    this.enemies.push(k);
    this.sfx('knight', 0.6);
  }
  spawnPig() {
    const P = this.player, lv = this.level;
    const side = chance(0.5) ? -1 : 1;
    const x = P.x + side * rrange(66, 208);
    const g = lv.findFloor(x - 4, x + 4, P.y - 30, P.y + 200, { noPlatforms: true });
    const groundY = g ? g.y : P.y;
    const y = groundY - rrange(30, 80);
    const e = new WoodyPig(this, x, Math.max(this.screen.y0 + 24, y), x < P.x ? 1 : -1);
    e.spawned = true;
    this.enemies.push(e);
    this.sfx('pig');
  }
  spawnBat() {
    const P = this.player;
    const dir = chance(0.6) ? -1 : 1;
    const x = dir < 0 ? this.screen.x1 + 10 : this.screen.x0 - 10;
    const b = new Bat(this, x, P.y - rrange(20, 60), { flying: true, dir });
    b.spawned = true;
    this.enemies.push(b);
  }

  // ---------------------------------------------------------------- chefes
  checkBoss() {
    const b = this.data.boss, P = this.player;
    if (!b || this.bossTriggered) return;
    let trig = false;
    if (typeof b.trigger === 'number') trig = P.x >= b.trigger;
    else if (typeof b.trigger === 'string' && b.trigger.startsWith('y<')) trig = P.y < parseFloat(b.trigger.slice(2));
    if (!trig) return;
    this.bossTriggered = true;
    this.app.music && this.app.music.play('boss');
    const o = { boss: true, arena: b.arena, arenaY: b.arenaY };
    if (b.t === 'unicorn') this.bosses = [new Unicorn(this, b.x, b.y, o)];
    else if (b.t === 'unicorn2') this.bosses = [new Unicorn(this, b.x, b.y, o), new Unicorn(this, b.x2, b.y, o)];
    else if (b.t === 'dragon') {
      const area = { x0: b.arena[0] + 8, x1: b.arena[1] - 8, y0: b.y - 72, y1: b.y + 34 };
      this.bosses = [new Dragon(this, b.x, b.y, { ...o, area, hp: 6 })];
    } else if (b.t === 'satan') this.bosses = [new Satan(this, b.x, b.y, { ...o, hp: 8 })];
    else if (b.t === 'satan2') this.bosses = [new Satan(this, b.x, b.y, { ...o, hp: 6, order: 0 }), new Satan(this, b.x2, b.y2, { ...o, hp: 6, order: 1 })];
    else if (b.t === 'astaroth') this.bosses = [new Astaroth(this, b.x, b.y, o)];
    for (const e of this.bosses) { e.boss = true; e.onKilled = () => this.onBossPartKilled(); this.enemies.push(e); }
    // os chefes despertam pouco depois de a arena travar
    this.later(b.t === 'astaroth' ? 90 : 30, () => { this.bossActive = true; });
  }
  onBossPartKilled() {
    if (this.bosses.every((b) => b.dead)) {
      this.shake(12);
      this.sfx('bossdie');
      this.app.music && this.app.music.stop();
      if (this.data.boss.t === 'astaroth') { this.later(90, () => { this.finished = 'ending'; }); return; }
      if (this.data.boss.t === 'satan2' && this.player.weapon !== 'cross') {
        // sem a cruz (escudo) o chefe final não pode ser enfrentado
        this.later(90, () => { this.finished = 'illusion'; });
        return;
      }
      this.later(70, () => this.dropKey());
    }
  }
  dropKey() {
    if (this.keyDropped) return;
    this.keyDropped = true;
    const b = this.data.boss;
    const x = Math.max(this.view.x0 + 40, Math.min(this.view.x1 - 40, this.player.x + (this.player.facing > 0 ? 40 : -40)));
    const k = new Item(this, 'key', x, this.screen.y0 + 8, { fall: true });
    this.items.push(k);
    this.sfx('keyfall');
  }
  onKey() {
    this.keyTaken = true;
    this.player.state = 'win'; this.player.stateT = 0; this.player.vx = 0;
    this.app.music && this.app.music.play('clear');
    this.clearT = 1;
  }

  // ---------------------------------------------------------------- tiros em lápides → mago
  onSolidShot(solid) {
    if (solid.t !== 'tomb' && solid.t !== 'rock') return;
    this.tombHits++;
    if (this.tombHits >= 15 && !this.magicianOut) {
      this.tombHits = 0;
      this.magicianOut = true;
      const m = new Magician(this, solid.x + solid.w / 2, solid.y);
      m.onKilled = () => { this.magicianOut = false; };
      const orig = m.update.bind(m);
      m.update = () => { orig(); if (m.remove) this.magicianOut = false; };
      this.enemies.push(m);
      this.fx.emit('magic', m.x, m.y - 16);
      this.sfx('magician');
    }
  }

  onPlayerDeath(kind) {
    this.app.music && this.app.music.stop();
    this.sfx(kind === 'water' ? 'splash' : kind === 'lava' ? 'burn' : 'death');
    this.fx.emit(kind === 'water' ? 'splash' : kind === 'lava' ? 'fire' : 'deathpuff', this.player.x, this.player.y);
    this.later(kind === 'touch' || kind === 'spell' || kind === 'timeup' ? 150 : 100, () => { this.finished = 'dead'; });
  }

  // ---------------------------------------------------------------- quadro de lógica
  update(input) {
    this.frame++;
    const P = this.player, lv = this.level;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].t <= this.frame) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    }
    if (this.shakeT > 0) this.shakeT--;
    lv.update();
    P.update(input);

    // checkpoint (meio da fase)
    const cp = this.data.checkpoint;
    if (cp && !this.checkpointReached && !P.dead) {
      if ((cp.atY !== undefined && P.y < cp.atY) || (cp.atY === undefined && P.x >= cp.at)) this.checkpointReached = true;
    }
    // bônus escondidos
    for (const h of this.hidden) {
      if (h.killed) continue;
      const d = h.def, b = P.box;
      if (b.x1 > d.x && b.x0 < d.x + d.w && b.y1 > d.y && b.y0 < d.y + d.h) {
        h.killed = true;
        let kind = d.kind;
        if (kind === 'armor' && P.armor) kind = 'bag';
        this.items.push(new Item(this, kind, d.x + d.w / 2, d.y + d.h, { fall: true }));
        this.fx.emit('sparkle', d.x + d.w / 2, d.y + d.h / 2);
        this.sfx('secret');
      }
    }

    this.checkBoss();
    this.updateSpawners();
    this.spawnPlacements();

    for (const e of this.enemies) e.update();
    for (const s of this.shots) s.update();
    for (const s of this.eshots) s.update();
    for (const it of this.items) it.update();

    this.collide();

    this.enemies = this.enemies.filter((e) => !e.remove);
    this.shots = this.shots.filter((s) => !s.remove);
    this.eshots = this.eshots.filter((s) => !s.remove);
    this.items = this.items.filter((i) => !i.remove);
    // remove itens que ficaram muito para trás
    for (const it of this.items) if (!it.static && it.type !== 'key' && (it.x < this.view.x0 - 300 || it.x > this.view.x1 + 300)) it.remove = true;

    this.updateCamera();

    // tempo
    if (!P.dead && !this.keyTaken && this.finished === null) {
      if (this.time > 0) this.time--;
      if (this.time === 30 * 60) this.sfx('hurry');
      if (this.time === 0) { P.die('timeup'); }
    }
    // fim de fase: depois de pegar a chave o Arthur caminha até o portão
    if (this.clearT > 0) {
      this.clearT++;
      if (this.clearT === 90) this.fx.emit('dooropen', 0, 0);
      if (this.clearT === 90) this.sfx('door');
      if (this.clearT > 100 && this.clearT < 400 && this.data.door) {
        const dx = this.data.door.x + this.data.door.w / 2;
        P.state = Math.abs(P.x - dx) > 2 ? 'walk' : 'win';
        P.facing = Math.sign(dx - P.x) || 1;
        if (Math.abs(P.x - dx) > 2) P.x += Math.sign(dx - P.x);
      }
      if (this.clearT === 200 && this.time > 0) this.addScore(Math.floor(this.time / 60) * 10, P.x, P.y - 40);
      if (this.clearT > 330) this.finished = 'clear';
    }
  }

  collide() {
    const P = this.player;
    const pb = P.box;
    // tiros do jogador x inimigos
    for (const s of this.shots) {
      if (s.remove) continue;
      const sb = s.box;
      for (const e of this.enemies) {
        if (e.remove || e.kind !== 'enemy') continue;
        const parts = e.parts ? e.parts() : [{ box: e.box, hittable: e.hittable, part: null }];
        let done = false;
        for (const pt of parts) {
          if (!pt.hittable || !e.hittable && !e.parts) continue;
          if (!overlap(sb, pt.box)) continue;
          if (s.pierce && s.hitSet.has(e)) continue;
          const r = e.onHit(s, pt.part);
          if (r === 'ignore') continue;
          this.fx.emit(r === 'block' ? 'clink' : 'hit', s.x, s.y, { boss: e.boss });
          if (r === 'hit' && e.boss) this.sfx('bosshit');
          if (s.pierce) s.hitSet.add(e);
          else if (!s.burning) s.remove = true;
          done = true;
          break;
        }
        if (done && !s.pierce && !s.burning) break;
      }
      // a cruz destrói projéteis inimigos
      if (s.type === 'cross' && !s.remove) {
        for (const es of this.eshots) {
          if (!es.remove && es.blockable && overlap(sb, es.box)) { es.remove = true; this.fx.emit('clink', es.x, es.y); this.sfx('block'); }
        }
      }
    }
    if (P.dead || P.state === 'win') return;
    // inimigos x Arthur
    for (const e of this.enemies) {
      if (e.remove || e.kind !== 'enemy' || !e.harmful) continue;
      const parts = e.parts ? e.parts() : [{ box: e.box, harmful: true }];
      for (const pt of parts) {
        if (pt.harmful && overlap(pb, shrink(pt.box, 2))) { P.hurt(e.x < P.x ? 1 : -1); break; }
      }
    }
    // projéteis x Arthur
    for (const s of this.eshots) {
      if (s.remove) continue;
      if (overlap(pb, s.box)) {
        if (s.type === 'spell') { s.remove = true; P.becomeFrog(); continue; }
        if (P.hurt(s.vx < 0 ? -1 : 1, 'shot')) s.remove = true;
      }
    }
    // itens
    for (const it of this.items) {
      if (it.remove || it.type === 'pot') continue;
      if (overlap(pb, it.box) && !P.frog) it.collect(P);
    }
  }
}

function shrink(b, m) { return { x0: b.x0 + m, y0: b.y0 + m, x1: b.x1 - m, y1: b.y1 - m }; }
