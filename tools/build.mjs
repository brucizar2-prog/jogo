// Gera jogar.html: o jogo inteiro (three.js + código + CSS) num único arquivo HTML,
// que abre com dois cliques, sem servidor e sem internet.  Uso: npm run build
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// resolve os mesmos caminhos do importmap do index.html
const importMap = {
  name: 'importmap',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(root, 'vendor/three/three.module.min.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(root, 'vendor/three/addons', a.path.slice('three/addons/'.length)) }));
  },
};

const res = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: ['es2020'],
  legalComments: 'none',
  plugins: [importMap],
});
// "</script" dentro do JS fecharia a tag antes da hora
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile(join(root, 'css/style.css'), 'utf8');
let html = await readFile(join(root, 'index.html'), 'utf8');

html = html
  .replace(/<script>if \(location\.protocol[^<]*<\/script>\s*/, '')
  .replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script>\n${js}</script>`);
html = html.replace('<head>', '<head>\n  <!-- Arquivo gerado por "npm run build" a partir de index.html + src/. Edite os fontes, não este arquivo. -->');

await writeFile(join(root, 'jogar.html'), html);
console.log(`jogar.html gerado (${(html.length / 1024).toFixed(0)} KB)`);
