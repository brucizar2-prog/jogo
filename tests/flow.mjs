// Teste do fluxo de jogo (vidas, checkpoint, game over, continue, fim de fase, cruz obrigatória)
// usando a máquina de estados real de main.js com renderer/áudio/DOM simulados.
import { Game } from '../src/game/game.js';

let fails = 0;
const ok = (c, msg, extra = '') => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', msg, extra); };

// versão mínima do App só com a lógica de transição (espelha src/main.js)
class FlowApp {
  constructor() {
    this.session = { score: 0, top: 0, lives: 3, weapon: 'lance', stage: 1, extendIdx: 0, loop: 1, checkpoint: false };
    this.settings = { loops: 2 };
    this.log = [];
  }
  start(fromCheckpoint) { this.game = new Game(this, this.session.stage, { fromCheckpoint, viewW: 400 }); this.state = 'play'; }
  run(frames, inp = { held: {}, pressed: {} }) {
    const n0 = this.log.length;
    for (let i = 0; i < frames && this.state === 'play'; i++) {
      if (this.log.length > n0) break;   // para logo após uma transição (vida perdida, fase concluída...)
      this.game.update(inp);
      this.session.weapon = this.game.player.weapon;
      if (this.game.checkpointReached) this.session.checkpoint = true;
      if (this.game.finished) this.onFinished(this.game.finished);
    }
  }
  onFinished(kind) {
    const s = this.session;
    this.log.push(kind);
    if (kind === 'dead') {
      s.lives--;
      if (s.lives <= 0) { this.state = 'gameover'; return; }
      this.start(s.checkpoint);
    } else if (kind === 'clear') { s.stage++; s.checkpoint = false; this.start(false); }
    else if (kind === 'illusion') { s.stage = 5; s.checkpoint = false; this.start(false); }
    else if (kind === 'ending') {
      if (this.settings.loops === 2 && s.loop === 1) { s.loop = 2; s.stage = 1; s.checkpoint = false; this.start(false); }
      else this.state = 'ending';
    }
  }
}

// 1) morre antes do checkpoint -> volta ao início; depois do checkpoint -> volta ao checkpoint
{
  const a = new FlowApp(); a.start(false);
  a.game.enemies = []; a.game.spawners = [];
  a.game.player.die('touch'); a.run(400);
  ok(a.session.lives === 2 && a.game.player.x === a.game.data.start.x, 'morte antes do checkpoint volta ao início', `(vidas=${a.session.lives}, x=${a.game.player.x})`);
  a.game.player.x = 1820; a.run(2);
  ok(a.session.checkpoint, 'checkpoint registrado ao passar do meio da fase');
  a.game.player.die('touch'); a.run(400);
  ok(a.session.lives === 1 && a.game.player.x === a.game.data.checkpoint.x, 'morte após checkpoint volta ao checkpoint', `(x=${a.game.player.x})`);
  ok(a.game.player.armor, 'volta com armadura');
  a.game.player.die('touch'); a.run(400);
  ok(a.state === 'gameover', 'sem vidas = game over');
}
// 2) arma é mantida ao morrer (como no arcade)
{
  const a = new FlowApp(); a.start(false);
  a.game.player.weapon = 'torch'; a.run(1);
  a.game.player.die('touch'); a.run(400);
  ok(a.game.player.weapon === 'torch', 'mantém a arma após morrer', `(${a.game.player.weapon})`);
}
// 3) fim de fase: pegar a chave -> próxima fase
{
  const a = new FlowApp(); a.start(false);
  a.game.onKey(); a.run(500);
  ok(a.session.stage === 2 && a.log.includes('clear'), 'pegar a chave conclui a fase', `(fase=${a.session.stage})`);
}
// 4) Satãs sem a cruz -> volta para a fase 5; com a cruz -> sala de Astaroth; Astaroth -> 2ª volta
{
  const a = new FlowApp(); a.session.stage = 6; a.start(false);
  const g = a.game; g.player.x = 240; g.player.y = 112; g.player.weapon = 'lance'; a.run(60);
  for (const b of g.bosses) b.kill(); a.run(400);
  ok(a.session.stage === 5, 'sem a cruz volta para a fase 5', `(fase=${a.session.stage})`);
  const b2 = new FlowApp(); b2.session.stage = 6; b2.start(false);
  const g2 = b2.game; g2.player.x = 240; g2.player.y = 112; g2.player.weapon = 'cross'; b2.run(60);
  for (const b of g2.bosses) b.kill(); b2.run(200);
  const key = g2.items.find((i) => i.type === 'key');
  ok(!!key, 'com a cruz os Satãs liberam a chave');
  g2.onKey(); b2.run(500);
  ok(b2.session.stage === 7, 'segue para a sala do trono', `(fase=${b2.session.stage})`);
  b2.run(120);
  for (const b of b2.game.bosses) b.kill(); b2.run(300); b2.run(1);
  ok(b2.session.loop === 2 && b2.session.stage === 1, 'Astaroth derrotado na 1ª volta: começa a 2ª volta');
  b2.session.stage = 7; b2.start(false); b2.run(120);
  for (const b of b2.game.bosses) b.kill(); b2.run(300);
  ok(b2.state === 'ending', 'Astaroth na 2ª volta: final verdadeiro');
}
// 5) vida extra aos 20.000 pontos
{
  const a = new FlowApp(); a.start(false);
  a.game.addScore(19990); a.game.addScore(20);
  ok(a.session.lives === 4, 'vida extra aos 20 mil', `(vidas=${a.session.lives})`);
}
process.exit(fails ? 1 : 0);
