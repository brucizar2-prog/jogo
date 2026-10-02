// Teste de fumaça da lógica (sem gráficos): roda cada fase com um "bot" simples
// e verifica que nada quebra. Uso: node tests/simulate.mjs
import { Game } from '../src/game/game.js';

function fakeInput() {
  const b = ['left', 'right', 'up', 'down', 'jump', 'fire', 'start', 'pause'];
  const inp = { held: {}, pressed: {} };
  for (const k of b) { inp.held[k] = false; inp.pressed[k] = false; }
  return inp;
}

function run(stage, frames = 3600, invincible = true) {
  const app = { session: { score: 0, top: 0, lives: 3, weapon: 'lance', extendIdx: 0 } };
  const g = new Game(app, stage, { viewW: 400 });
  const inp = fakeInput();
  let deaths = 0, maxX = 0, minY = 1e9, kills = 0;
  const startEnemies = new Set();
  for (let f = 0; f < frames; f++) {
    // bot: anda para a direita, pula de vez em quando, atira sempre
    inp.held.right = true;
    inp.pressed.jump = f % 50 === 0;
    inp.held.jump = inp.pressed.jump;
    inp.pressed.fire = f % 12 === 0;
    inp.held.up = f % 200 < 100;
    if (invincible) g.player.invuln = 10;
    g.update(inp);
    for (const e of g.enemies) startEnemies.add(e.type);
    if (g.player.dead && g.finished) {
      deaths++;
      // reinicia como o jogo faria
      const pos = g.player.x;
      g.player.reset(pos, g.player.y);
      const st = g.data.checkpoint && g.checkpointReached ? g.data.checkpoint : g.data.start;
      g.player.x = st.x; g.player.y = st.y; g.finished = null;
    }
    maxX = Math.max(maxX, g.player.x); minY = Math.min(minY, g.player.y);
  }
  return { stage, deaths, maxX: Math.round(maxX), minY: Math.round(minY), enemiesSeen: [...startEnemies].join(','), score: app.session.score };
}

let ok = true;
for (const s of [1, 2, 3, 4, 5, 6, 7]) {
  try {
    const r = run(s);
    console.log(JSON.stringify(r));
  } catch (e) {
    ok = false;
    console.error('stage', s, 'FAILED:', e.stack);
  }
}
process.exit(ok ? 0 : 1);
