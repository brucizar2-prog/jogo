// Testes das mecânicas do Arthur com entradas simuladas quadro a quadro.
import { Game } from '../src/game/game.js';

const mk = (stage, opts = {}) => new Game({ session: { score: 0, top: 0, lives: 3, weapon: 'lance', extendIdx: 0 } }, stage, { viewW: 400, ...opts });
const blank = () => ({ held: { left: false, right: false, up: false, down: false, jump: false, fire: false }, pressed: {} });
let fails = 0;
const ok = (c, msg, extra = '') => { if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', msg, extra); };
function clear(g) { g.enemies = []; g.spawners = []; g.placements.forEach((p) => { p.spawned = true; }); }
function step(g, inp, n = 1) { for (let i = 0; i < n; i++) { g.update(inp); inp.pressed = {}; } }

// 1) pulo parado: arco fixo, altura ~53px, volta ao mesmo x
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 300; P.y = 176;
  const inp = blank(); inp.pressed.jump = true; inp.held.jump = true;
  let minY = P.y, frames = 0; const x0 = P.x;
  step(g, inp);
  inp.held.jump = false;
  while (!P.onGround && frames < 200) { step(g, inp); minY = Math.min(minY, P.y); frames++; }
  ok(Math.abs((176 - minY) - 53) < 3, 'altura do pulo ≈ 53px', `(${(176 - minY).toFixed(1)}px, ${frames + 1} quadros)`);
  ok(P.x === x0, 'pulo vertical não desloca');
}
// 2) pulo para a direita: alcance ~46px, sem controle no ar
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 300; P.y = 176;
  const inp = blank(); inp.held.right = true; inp.pressed.jump = true;
  step(g, inp);
  inp.held.right = false; inp.held.left = true;   // tenta mudar de direção no ar
  let f = 0; while (!P.onGround && f < 200) { step(g, inp); f++; }
  ok(Math.abs(P.x - 300 - 46) < 3, 'alcance do pulo ≈ 46px e direção travada no ar', `(${(P.x - 300).toFixed(1)}px)`);
}
// 3) velocidade de caminhada = 1px/quadro
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 300; P.y = 176;
  const inp = blank(); inp.held.right = true;
  step(g, inp, 60);
  ok(Math.abs(P.x - 360) < 0.01, 'caminhada 60px em 60 quadros', `(${P.x - 300})`);
}
// 4) escada do morro (fase 1)
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 726; P.y = 176;
  const inp = blank(); inp.held.up = true;
  step(g, inp, 100);
  ok(P.y === 96 && P.onGround, 'sobe a escada até o topo do morro', `(y=${P.y}, estado=${P.state})`);
  inp.held.up = false; inp.held.down = true;
  step(g, inp, 100);
  ok(P.y === 176, 'desce a escada', `(y=${P.y})`);
}
// 5) lápide bloqueia o caminho e dá para subir nela
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 230; P.y = 176;
  const inp = blank(); inp.held.right = true;
  step(g, inp, 40);
  ok(P.x < 250 - 5, 'lápide bloqueia', `(x=${P.x})`);
  inp.pressed.jump = true; step(g, inp, 30);
  ok(P.y === 160 || P.x > 260, 'pula por cima/sobre a lápide', `(x=${P.x.toFixed(1)}, y=${P.y})`);
}
// 6) limite de lanças na tela (2)
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 300; P.y = 176;
  const inp = blank();
  for (let i = 0; i < 40; i++) { inp.pressed.fire = i % 4 === 0; step(g, inp); }
  ok(g.shots.length <= 2, 'no máximo 2 lanças simultâneas', `(${g.shots.length})`);
}
// 7) armadura -> cueca -> morte
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 300; P.y = 176;
  P.hurt(1);
  ok(!P.armor && P.state === 'hit' && !P.dead, 'primeiro golpe tira a armadura');
  step(g, blank(), 130);
  P.hurt(1);
  ok(P.dead, 'segundo golpe mata');
  step(g, blank(), 200);
  ok(g.finished === 'dead', 'fim de vida sinalizado');
}
// 8) cair na água mata
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 1640; P.y = 176; g.level.platforms = [];
  const inp = blank(); inp.held.right = true;
  step(g, inp, 120);
  ok(P.dead && P.deathKind === 'water', 'água mata', `(${P.deathKind})`);
}
// 9) jangada transporta o Arthur
{
  const g = mk(1); clear(g);
  const P = g.player; const raft = g.level.platforms[0];
  P.x = raft.x + 16; P.y = raft.y; P.onGround = true; P.groundRef = raft;
  const x0 = P.x;
  step(g, blank(), 60);
  ok(Math.abs(P.x - x0) > 20 && !P.dead && P.groundRef === raft, 'jangada carrega o Arthur', `(dx=${(P.x - x0).toFixed(1)})`);
}
// 10) zumbis surgem perto do Arthur no cemitério
{
  const g = mk(1);
  const P = g.player; P.x = 400; P.y = 176;
  let seen = 0;
  for (let i = 0; i < 600; i++) { P.invuln = 5; g.update(blank()); seen = Math.max(seen, g.enemies.filter((e) => e.type === 'zombie').length); }
  ok(seen >= 1 && seen <= 3, 'zumbis surgem (máx. 3)', `(pico ${seen})`);
}
// 11) tempo esgotado mata
{
  const g = mk(1); clear(g);
  g.time = 2;
  step(g, blank(), 5);
  ok(g.player.dead && g.player.deathKind === 'timeup', 'tempo esgotado');
}
// 12) arma coletada troca a arma
{
  const g = mk(1); clear(g);
  const P = g.player; P.x = 300; P.y = 176;
  g.dropPot(320, 150, 'dagger');
  const inp = blank();
  step(g, inp, 60);
  inp.held.right = true; step(g, inp, 40);
  ok(P.weapon === 'dagger', 'pega a adaga do pote', `(${P.weapon})`);
}
process.exit(fails ? 1 : 0);
