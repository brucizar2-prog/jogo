// Ponto de entrada: laço principal (lógica fixa a 60 Hz) e máquina de estados do jogo.
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { DT } from './core/const.js';
import { Game } from './game/game.js';
import { Renderer } from './render/renderer.js';
import { Hud, drawMap, STAGE_NAMES } from './ui/hud.js';
import { Enemy } from './game/enemies.js';
import { Princess } from './game/enemies.js';

const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { const v = localStorage.getItem('gng3d.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('gng3d.' + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
};

class App {
  constructor() {
    this.canvas = document.getElementById('view');
    this.input = new Input();
    this.audio = new Audio();
    this.music = this.audio.music;
    this.hud = new Hud();
    try {
      this.renderer = new Renderer(this.canvas);
    } catch (e) {
      this.hud.setScreen('<div class="story">Não foi possível iniciar o WebGL neste navegador.<br><br>' + e.message + '</div>');
      throw e;
    }
    this.settings = { loops: store.get('loops', 2), crt: store.get('crt', false) || params.get('crt') === '1' };
    this.renderer.setCRT(this.settings.crt);
    this.session = this.newSession();
    this.state = 'boot';
    this.t = 0; this.stateT = 0;
    this.acc = 0; this.last = performance.now();
    this.god = params.get('god') === '1';
    this.menuSel = 0;
    window.__app = this;   // útil para depuração e testes automatizados
    const st = parseInt(params.get('stage') || '0', 10);
    if (st >= 1 && st <= 7) { this.session.stage = st; this.startStage(false); }
    else this.toTitle();
    requestAnimationFrame((t) => this.loop(t));
    // pausa automática quando a janela perde o foco
    const autoPause = () => { if (this.state === 'play') { this.setState('pause'); this.hud.setBanner('<span class="big">PAUSA</span>'); this.music.stop(); } };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  }

  newSession() {
    return { score: 0, top: store.get('top', 10000), lives: 3, weapon: 'lance', stage: 1, extendIdx: 0, loop: 1, checkpoint: false };
  }

  setState(s) { this.state = s; this.stateT = 0; }

  // ------------------------------------------------------------------ telas
  toTitle() {
    this.setState('title');
    this.hud.show(false);
    this.hud.setBanner(null);
    this.loadBackdrop(1);
    this.renderTitle();
    this.music.play('title');
  }
  renderTitle() {
    const opts = ['INICIAR JOGO', `VOLTAS: ${this.settings.loops === 2 ? '2 (ARCADE)' : '1'}`, `MODO CRT: ${this.settings.crt ? 'LIGADO' : 'DESLIGADO'}`];
    this.hud.setScreen(`
      <div class="title-logo">Ghosts'n<br>Goblins<small>— remake 3D —</small></div>
      <div class="title-menu">${opts.map((o, i) => `<div class="opt ${i === this.menuSel ? 'sel' : ''}">${o}</div>`).join('')}</div>
      <div class="title-sub">PRESSIONE ENTER</div>
      <div class="controls">
        <b>← →</b> andar &nbsp; <b>↓</b> agachar &nbsp; <b>↑ ↓</b> escadas &nbsp; <b>Z</b> pular &nbsp; <b>X</b> atacar<br>
        <b>Enter</b> start &nbsp; <b>P</b> pausa &nbsp; <b>C</b> CRT &nbsp; <b>M</b> som &nbsp; <b>F</b> tela cheia
      </div>
      <div class="title-note">Remake de fã, sem fins comerciais. Ghosts'n Goblins é marca da Capcom. Gráficos, modelos e músicas deste projeto são originais.</div>`);
  }

  // cenário de fundo para título/história (fase sem simulação)
  loadBackdrop(stage) {
    this.game = new Game(this, stage, { viewW: this.renderer.viewWidthPx, cutscene: true, locked: true });
    this.renderer.loadStage(this.game);
  }

  startStage(fromCheckpoint) {
    const s = this.session;
    this.game = new Game(this, s.stage, { fromCheckpoint, viewW: this.renderer.viewWidthPx });
    // depuração: ?stage=1&x=1700&y=176 começa numa posição específica
    if (params.has('x') && !this._usedPos) {
      this._usedPos = true;
      const P = this.game.player;
      P.x = +params.get('x'); if (params.has('y')) P.y = +params.get('y');
      this.game.cam.x = P.x; this.game.cam.y = P.y - 60;
      this.game.updateCamera(true);
      this.game.spawnPlacements();
    }
    this.renderer.loadStage(this.game);
    this.hud.show(true);
    this.hud.setScreen('');
    this.hud.setBanner(`<span class="big">FASE ${Math.min(s.stage, 6)}${s.stage === 7 ? ' — FINAL' : ''}</span><span class="blink">JOGADOR 1 PRONTO</span>`);
    this.music.stop();
    this.setState('ready');
  }

  toMap() {
    this.setState('map');
    this.hud.show(false);
    this.hud.setBanner(null);
    const s = this.session.stage;
    this.hud.setScreen(`<div class="mapwrap"><h2>${s === 7 ? 'O Trono de Astaroth' : 'Fase ' + s + ' — ' + STAGE_NAMES[s]}</h2><canvas id="mapc" width="960" height="420"></canvas>
      <p>${s === 1 && this.session.loop === 2 ? 'SEGUNDA VOLTA — A VERDADEIRA BATALHA' : 'A princesa espera por você...'}</p></div>`);
    this.music.play('start');
  }

  intro() {
    this.setState('intro');
    this.hud.show(false);
    this.hud.setScreen('');
    this.loadBackdrop(1);
    const g = this.game;
    const P = g.player;
    P.armor = false; P.facing = 1; P.locked = true;
    this.princess = new Princess(g, P.x + 34, P.y);
    g.enemies.push(this.princess);
    this.kidnapper = null;
    this.music.stop();
  }

  updateIntro() {
    const g = this.game, P = g.player, t = this.stateT;
    const say = (txt) => this.hud.setBanner(`<div class="story">${txt}</div>`);
    if (t === 1) say('Numa noite enluarada, o cavaleiro <span class="gold">Arthur</span> descansava ao lado da <span class="gold">Princesa Prin Prin</span>...');
    if (t === 150) {
      say('...quando um demônio surgiu dos céus!');
      const k = new Enemy(g, P.x + 260, P.y - 150, {});
      k.type = 'satan'; k.w = 30; k.h = 40; k.harmful = false; k.hittable = false; k.wings = 1; k.state = 'hover'; k.facing = -1;
      k.update = () => { k.pre(); };
      g.enemies.push(k);
      this.kidnapper = k;
      this.audio.sfx('satan');
    }
    const k = this.kidnapper, pr = this.princess;
    if (k) {
      if (t > 150 && t < 240) { k.x += ((pr.x + 4) - k.x) * 0.045; k.y += ((pr.y - 6) - k.y) * 0.045; k.facing = -1; }
      if (t === 240) { this.audio.sfx('spell'); g.fx.emit('magic', pr.x, pr.y - 16); }
      if (t > 240) {
        k.state = 'swoop'; k.facing = 1;
        k.x += 1.7; k.y -= 1.1;
        pr.x = k.x - 2; pr.y = k.y + 20;
        P.facing = 1;
      }
      if (t === 250) say('A princesa foi levada para o castelo de <span class="gold">Astaroth</span>!');
    }
    if (t === 420) { say('Arthur veste sua armadura e parte para o resgate!'); P.armor = true; g.fx.emit('armorup', P.x, P.y - 16); this.audio.sfx('armorup'); }
    if (t > 470 && t < 560) { P.state = 'walk'; P.x += 1; P.facing = 1; }
    if (t === 560) { P.state = 'stand'; }
    if (t >= 600 || (t > 30 && (this.input.pressed.start || this.input.pressed.fire || this.input.pressed.jump))) {
      this.hud.setBanner(null);
      this.toMap();
    }
    g.updateCamera();
    for (const e of g.enemies) e.animT++;
    P.animT++;
  }

  // ------------------------------------------------------------------ laço
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 5) {
      this.acc -= DT; steps++;
      this.input.update();
      this.tick();
    }
    this.t += dt;
    this.draw(dt);
  }

  globalKeys() {
    const p = this.input.pressed;
    if (p.mute) { const m = this.audio.toggleMute(); this.flashMsg(m ? 'SOM DESLIGADO' : 'SOM LIGADO'); }
    if (p.crt) { this.settings.crt = !this.settings.crt; this.renderer.setCRT(this.settings.crt); store.set('crt', this.settings.crt); this.flashMsg(this.settings.crt ? 'MODO CRT' : 'MODO MODERNO'); if (this.state === 'title') this.renderTitle(); }
    if (p.fullscreen) {
      const el = document.documentElement;
      if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen().catch(() => {});
      else document.exitFullscreen && document.exitFullscreen();
    }
  }
  flashMsg(m) {
    if (this.state === 'play' || this.state === 'pause') return;
    this._msgT = 90; this._msg = m;
  }

  tick() {
    this.stateT++;
    const inp = this.input, s = this.session;
    if (inp.anyKey) { this.audio.ensure(); }
    this.globalKeys();
    switch (this.state) {
      case 'title': {
        // câmera passeando pelo cemitério
        const g = this.game;
        g.cam.x = 200 + (Math.sin(this.stateT * 0.002) * 0.5 + 0.5) * 900;
        g.updateCamera(true);
        g.cam.x = 200 + (Math.sin(this.stateT * 0.002) * 0.5 + 0.5) * 900;
        g.screen = g.view = { x0: g.cam.x - 200, x1: g.cam.x + 200, y0: 0, y1: 224 };
        if (inp.pressed.up || inp.pressed.down) { this.menuSel = (this.menuSel + (inp.pressed.down ? 1 : 2)) % 3; this.audio.sfx('select'); this.renderTitle(); }
        if (inp.pressed.left || inp.pressed.right) {
          if (this.menuSel === 1) { this.settings.loops = this.settings.loops === 2 ? 1 : 2; store.set('loops', this.settings.loops); this.audio.sfx('select'); this.renderTitle(); }
          if (this.menuSel === 2) { this.settings.crt = !this.settings.crt; this.renderer.setCRT(this.settings.crt); store.set('crt', this.settings.crt); this.audio.sfx('select'); this.renderTitle(); }
        }
        if (inp.pressed.start || inp.pressed.fire || inp.pressed.jump) {
          this.audio.ensure();
          if (this.menuSel === 1) { this.settings.loops = this.settings.loops === 2 ? 1 : 2; store.set('loops', this.settings.loops); this.renderTitle(); break; }
          if (this.menuSel === 2) { this.settings.crt = !this.settings.crt; this.renderer.setCRT(this.settings.crt); store.set('crt', this.settings.crt); this.renderTitle(); break; }
          this.audio.sfx('coin');
          this.session = this.newSession();
          this.intro();
        }
        break;
      }
      case 'intro': this.updateIntro(); break;
      case 'map':
        if (this.stateT > 200 || (this.stateT > 30 && (inp.pressed.start || inp.pressed.fire || inp.pressed.jump))) this.startStage(s.checkpoint);
        break;
      case 'ready':
        if (this.stateT === 1) this.renderer.setFade(0);
        if (this.stateT > 110) {
          this.hud.setBanner(null);
          this.setState('play');
          this.music.play(this.game.stage >= 4 ? 'castle' : 'stage');
          if (this.game.bossTriggered) this.music.play('boss');
        }
        break;
      case 'play': {
        if (inp.pressed.pause || inp.pressed.start) { this.setState('pause'); this.hud.setBanner('<span class="big">PAUSA</span>'); this.music.stop(); break; }
        const g = this.game;
        g.viewW = this.renderer.viewWidthPx;
        if (this.god && g.player.invuln < 1) g.player.invuln = 1;
        g.update(inp);
        s.weapon = g.player.weapon;
        if (g.checkpointReached) s.checkpoint = true;
        if (g.finished) this.onFinished(g.finished);
        break;
      }
      case 'pause':
        if (inp.pressed.pause || inp.pressed.start) {
          this.hud.setBanner(null); this.setState('play');
          this.music.play(this.game.bossTriggered ? 'boss' : this.game.stage >= 4 ? 'castle' : 'stage');
        }
        break;
      case 'dead':
        if (this.stateT === 1) this.music.play('death');
        if (this.stateT > 90) {
          s.lives--;
          if (s.lives <= 0) { this.gameOver(); break; }
          s.weapon = this.game.player.weapon;
          this.startStage(s.checkpoint);
        }
        break;
      case 'clear':
        if (this.stateT > 30) {
          s.stage++;
          s.checkpoint = false;
          this.toMap();
        }
        break;
      case 'message':
        if (this.stateT > 60 && (inp.pressed.start || inp.pressed.fire || inp.pressed.jump) || this.stateT > 600) {
          this.hud.setScreen(''); this.hud.setBanner(null);
          this.afterMessage();
        }
        break;
      case 'gameover':
        if (this.stateT % 60 === 0 && this.continueT > 0) { this.continueT--; this.renderGameOver(); }
        if (inp.pressed.start && this.stateT > 60 && this.continueT > 0) {
          // continue: mantém a fase e zera a pontuação, como no arcade
          s.lives = 3; s.score = 0; s.extendIdx = 0; s.weapon = 'lance';
          this.hud.setScreen('');
          this.startStage(s.checkpoint);
        } else if (this.continueT <= 0 && this.stateT > 120) {
          this.toTitle();
        }
        break;
      case 'ending':
        if (this.stateT > 240 && (inp.pressed.start || inp.pressed.fire)) this.toTitle();
        break;
    }
    if (this._msgT) this._msgT--;
  }

  onFinished(kind) {
    const s = this.session;
    if (s.score > s.top) { s.top = s.score; store.set('top', s.top); }
    if (kind === 'dead') { this.setState('dead'); return; }
    if (kind === 'clear') { this.music.stop(); this.setState('clear'); return; }
    if (kind === 'illusion') {
      this.showMessage('<span class="gold">Sem a arma sagrada (a cruz)</span> é impossível enfrentar o senhor dos demônios.<br><br>Volte e encontre-a!', () => { s.stage = 5; s.checkpoint = false; this.toMap(); });
      return;
    }
    if (kind === 'ending') {
      if (this.settings.loops === 2 && s.loop === 1) {
        this.showMessage('Esta sala é uma ilusão,<br>uma armadilha preparada por Satã!<br><br><span class="gold">Siga em frente sem medo.</span><br>Avance rapidamente!', () => { s.loop = 2; s.stage = 1; s.checkpoint = false; this.toMap(); });
      } else this.ending();
    }
  }

  showMessage(html, then) {
    this.setState('message');
    this.music.play('gameover');
    this.hud.setBanner(null);
    this.hud.setScreen(`<div class="story">${html}<br><br><span class="title-sub" style="font-size:.8em">PRESSIONE ENTER</span></div>`);
    this.afterMessage = then;
  }

  gameOver() {
    this.setState('gameover');
    this.continueT = 9;
    this.music.play('gameover');
    this.hud.setBanner(null);
    this.renderGameOver();
  }
  renderGameOver() {
    this.hud.setScreen(`<div class="title-logo" style="font-size:clamp(28px,7vw,90px)">Game Over</div>
      <div class="title-sub" style="margin-top:2em">CONTINUAR? ${this.continueT}<br><br>PRESSIONE ENTER</div>`);
  }

  ending() {
    this.setState('ending');
    this.music.play('ending');
    this.hud.show(false);
    const s = this.session;
    if (s.score > s.top) { s.top = s.score; store.set('top', s.top); }
    this.hud.setScreen(`<div class="story">
      <div class="title-logo" style="font-size:clamp(26px,6vw,72px)">Parabéns!</div><br>
      Astaroth foi derrotado e a paz voltou ao reino.<br>
      <span class="gold">Arthur</span> e a <span class="gold">Princesa Prin Prin</span> finalmente se reencontram.<br><br>
      PONTUAÇÃO FINAL: <span class="gold">${s.score}</span><br><br>
      <span style="opacity:.7;font-size:.8em">Fim — obrigado por jogar este remake de fã.</span></div>`);
  }

  // ------------------------------------------------------------------ desenho
  draw(dt) {
    const g = this.game;
    if (!g) return;
    if (this.state === 'map') {
      const c = document.getElementById('mapc');
      if (c) drawMap(c, this.session.stage, this.t);
    }
    if (this.state !== 'pause') this.renderer.frame(g, this.state === 'pause' ? 0 : dt, this.t);
    this.renderer.setFade(this.state === 'map' || this.state === 'gameover' || this.state === 'ending' || this.state === 'message' ? 0.75 : this.state === 'dead' ? Math.min(0.85, Math.max(0, (this.stateT - 40) / 50)) : this.state === 'clear' ? Math.min(1, this.stateT / 30) : 0);
    this.renderer.render(this.t);
    if (this.state === 'play' || this.state === 'ready' || this.state === 'pause' || this.state === 'dead' || this.state === 'clear') this.hud.update(g, this.session);
    if (this._msgT && this.state !== 'play') this.hud.setBanner(this._msg);
    else if (this._msg && !this._msgT) { this._msg = null; if (this.state === 'title' || this.state === 'map') this.hud.setBanner(null); }
  }
}

if (params.get('gallery')) {
  import('./render/gallery.js').then(({ startGallery }) => {
    const r = new Renderer(document.getElementById('view'));
    startGallery(r, params.get('gallery'));
  });
} else new App();
