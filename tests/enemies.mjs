// Teste de comportamento: cria cada inimigo/chefe perto do Arthur, roda alguns segundos
// e confere que posições permanecem válidas e que os chefes podem ser derrotados.
import { Game } from '../src/game/game.js';
import { Zombie, Crow, Plant, Arremer, Knight, WoodyPig, Devil, BigMan, Bat, Tower, Skeleton, Magician, FireJet } from '../src/game/enemies.js';
import { Unicorn, Dragon, Satan, Astaroth } from '../src/game/bosses.js';
import { PlayerShot } from '../src/game/objects.js';

const input = { held: {}, pressed: {} };
function mk(stage) { return new Game({ session: { score: 0, top: 0, lives: 3, weapon: 'lance', extendIdx: 0 } }, stage, { viewW: 400 }); }
let fails = 0;
function check(name, fn) {
  try { const r = fn(); console.log('ok  ', name, r || ''); } catch (e) { fails++; console.log('FAIL', name, e.stack.split('\n').slice(0, 3).join(' | ')); }
}
function run(g, frames, inv = true) {
  for (let i = 0; i < frames; i++) {
    if (inv) g.player.invuln = 5;
    g.update(input);
    for (const e of [...g.enemies, ...g.eshots]) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) throw new Error(`${e.type} posição inválida`);
  }
}
const P = (g) => g.player;
const cases = [
  [1, (g) => new Zombie(g, P(g).x + 80, 176, -1, true)],
  [1, (g) => new Crow(g, P(g).x + 90, 160)],
  [2, (g) => new Crow(g, P(g).x + 90, 380, { red: true })],
  [1, (g) => new Plant(g, P(g).x + 100, 176)],
  [1, (g) => new Arremer(g, P(g).x + 90, 176)],
  [3, (g) => new Arremer(g, P(g).x + 90, 800, { air: true })],
  [1, (g) => new Knight(g, P(g).x + 145, 96, 30, true)],
  [1, (g) => new WoodyPig(g, P(g).x + 100, 120, -1)],
  [2, (g) => new Devil(g, P(g).x + 100, 340)],
  [4, (g) => new Devil(g, P(g).x + 60, 218, { lava: true })],
  [2, (g) => new BigMan(g, P(g).x + 120, 400, { patrol: [0, 600] })],
  [3, (g) => new Bat(g, P(g).x + 80, 770)],
  [3, (g) => new Tower(g, P(g).x + 100, 896)],
  [5, (g) => new Skeleton(g, P(g).x + 60, 1136)],
  [1, (g) => new Magician(g, P(g).x + 60, 176)],
  [4, (g) => new FireJet(g, P(g).x + 40, 208)],
];
for (const [st, make] of cases) {
  const g = mk(st);
  const e = make(g);
  check(`${e.type} (fase ${st})`, () => { g.enemies.push(e); run(g, 900); return `estado final=${e.state} tiros=${g.eshots.length}`; });
}
// chefes: devem morrer com acertos suficientes e liberar a chave
for (const [st, t] of [[1, 'unicorn'], [2, 'unicorn2'], [3, 'dragon'], [4, 'dragon'], [5, 'satan'], [6, 'satan2'], [7, 'astaroth']]) {
  check(`chefe ${t} (fase ${st})`, () => {
    const g = mk(st);
    const b = g.data.boss;
    // teleporta o Arthur até o gatilho
    if (typeof b.trigger === 'number') { P(g).x = Math.max(b.trigger + 4, b.arena[0] + 40); P(g).y = st === 3 ? 880 : st === 2 ? 432 : 176; }
    else { P(g).x = st === 5 ? 300 : 240; P(g).y = st === 5 ? 96 : 112; }
    P(g).onGround = false;
    run(g, 120);
    if (!g.bosses.length) throw new Error('chefe não apareceu');
    let hits = 0;
    for (let f = 0; f < 6000 && g.bosses.some((x) => !x.dead); f++) {
      P(g).invuln = 5;
      if (f % 10 === 0) {
        for (const bo of g.bosses) {
          if (bo.dead) continue;
          const c = bo.parts ? bo.parts()[0].box : bo.box;
          const s = new PlayerShot(g, 'lance', (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, 1);
          const r = bo.onHit(s, bo.parts ? 'head' : null);
          if (r === 'hit' || r === 'kill') hits++;
        }
      }
      g.update(input);
    }
    if (g.bosses.some((x) => !x.dead)) throw new Error('chefe não morreu');
    run(g, 400);
    const key = g.items.find((i) => i.type === 'key');
    const fin = g.finished;
    return `acertos=${hits} chave=${!!key} fim=${fin}`;
  });
}
process.exit(fails ? 1 : 0);
