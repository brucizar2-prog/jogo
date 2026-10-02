# Ghosts'n Goblins 3D: remake de fã

Recriação do arcade **Ghosts'n Goblins** (Capcom, 1985) com **cenário em 3D** e **personagens 2.5D**:
modelos 3D articulados presos ao plano de jogo, como num jogo de plataforma clássico.
O visual é moderno (iluminação dinâmica, sombras, bloom, neblina, partículas), mas a paleta, as
silhuetas e o ritmo seguem o arcade. Há também um **modo CRT** opcional (tecla `C`) para quem quer a
sensação do fliperama.

## Como jogar

1. Baixe o ZIP **desta branch**:
   <https://github.com/brucizar2-prog/jogo/archive/refs/heads/claude/epic-mayer-91hm4l.zip>.
   Por enquanto a branch `main` só tem o README, então o botão "Download ZIP" da página inicial do
   repositório baixa uma pasta vazia.
2. Extraia o ZIP. No Windows, use "Extrair tudo": abrir o arquivo de dentro do ZIP não funciona.
3. Dê **dois cliques em `jogar.html`**. Abre em qualquer navegador moderno (Chrome, Edge, Firefox,
   Safari), sem instalar nada e sem internet.

O `jogar.html` é o jogo inteiro num arquivo só. O `index.html` aberto com dois cliques redireciona
para ele.

Para desenvolver, sirva a pasta por HTTP e use o `index.html`, que carrega os módulos de `src/`:

```bash
npm start            # usa tools/serve.mjs (Node 18+), abre em http://localhost:8080
npm run build        # regenera jogar.html depois de editar src/ ou css/ (requer npm install)
```

| Ação | Teclado | Controle |
|---|---|---|
| Andar | ← → (ou A D) | analógico / direcional |
| Agachar | ↓ | ↓ |
| Subir/descer escada | ↑ ↓ | ↑ ↓ |
| Pular | Z, K ou Espaço | A |
| Atacar | X, J ou Ctrl | X / B / Y |
| Start / pausa | Enter / P ou Esc | Start / Select |
| Modo CRT, som, tela cheia | C, M, F | |

Em celular e tablet aparecem botões de toque na tela.

## Fidelidade ao arcade (premissas do projeto)

**Fases idênticas.** As seis fases e a sala do trono de Astaroth foram medidas **tile a tile** (16 px)
a partir dos mapas completos do arcade. Ficam em `src/levels/stage*.js`, como grades ASCII
(`#` sólido, `=` plataforma, `.` vazio) mais listas de objetos em pixels do arcade:

- **Fase 1, Cemitério e Floresta:** morro com 3 escadas (x = 720, 912, 1072), as 12 lápides sólidas,
  a jangada sobre o lago e as quatro valas de água da floresta.
- **Fase 2, Palácio de Gelo e Cidade Fantasma:** 16 saliências de gelo, plataforma flutuante, rua com
  pontes, o prédio de 5 andares com 10 escadas e as duas valas d'água.
- **Fase 3, Cavernas:** trecho marrom com plataforma elevada e 3 escadas, depois o labirinto azul com
  degraus de 32 px e 3 escadas.
- **Fase 4, Ponte de Fogo:** 16 pedras flutuantes, quatro ilhas de rocha, a ponte sobre a lava e 15
  jatos de fogo.
- **Fase 5, Torre:** 14 andares, 22 escadas e as 3 plataformas que cruzam o vão central.
- **Fase 6, Castelo:** masmorra, salas com escadas, salão do dragão e salão dos dois Satãs.

**Spawns no lugar e do jeito do original.**

- **Já posicionados no mapa:** corvos sobre as mesmas lápides, plantas carnívoras, Red Arremers
  (inclusive os que pairam nas cavernas), torres-monstro, caveiras que viram esqueletos, ogros, os
  dois ciclopes na entrada do castelo, morcegos no teto, janelas de onde saem diabinhos, itens e
  tesouros. Todos estão nas coordenadas do mapa original.
- **Gerados em volta do Arthur, como no arcade:**
  - zumbis brotam do chão a 66–208 px do Arthur, no mesmo nível em que ele está, no máximo 3 por vez;
  - cavaleiros voadores entram pela borda direita da tela original (Arthur + 145 px);
  - Woody Pigs surgem do nada nas zonas da floresta, cavernas, torre e castelo;
  - diabinhos sobem da lava na ponte.

**Movimentos.** A lógica roda a **60 quadros por segundo em pixels do arcade**.

- **Arthur:** anda 1 px por quadro e cai de bordas com deriva de 0,5 px por quadro. O pulo tem arco
  fixo, sem controle no ar, com cerca de 51 px de altura e 46 px de alcance. Joga até 2 lanças por
  vez, sobe escadas, agacha e perde a armadura antes de morrer. Também pode virar sapo pelo feitiço
  do Mago, que aparece depois de 15 tiros em lápides ou rochas.
- **Inimigos:**
  - Zumbi: nasce, anda reto e afunda de volta.
  - Corvo: grasna e voa em onda.
  - Red Arremer: medita, levanta voo, paira, dá rasantes diagonais, corre no chão, desvia saltando
    dos tiros e cospe fogo mirando no Arthur.
  - Cavaleiro voador: anda em onda senoidal, com escudo frontal.
  - Woody Pig: faz curvas em semicírculo e solta lanças de cebola.
  - Diabinho: mergulha, persegue aos saltos e depois voa em zigue-zague.
  - Ogro: patrulha, investe e arremessa o mangual.
  - Torre-monstro: acorda e cospe orbes.
- **Chefes:**
  - Unicórnio: anda, salta por cima do Arthur e cospe fogo. São 10 acertos.
  - Dragão: corpo segmentado; só a cabeça é vulnerável, com 6 acertos.
  - Satã: bloqueia com as asas fechadas e dá rasantes em "V".
  - Astaroth, o chefe final.
- **Regras do arcade:**
  - tempo de 3:00 por fase e checkpoint no meio da fase;
  - potes com armas e tesouros;
  - vida extra aos 20 mil e aos 70 mil pontos;
  - a **cruz** é obrigatória para enfrentar Astaroth; sem ela, o jogo volta para a fase 5;
  - são **2 voltas** para o final verdadeiro. Dá para desligar no menu.

**Limitações honestas.** O arcade não tem documentação pública do código, então as velocidades
exatas dos inimigos, os temporizadores e a trajetória das pedras flutuantes da fase 4 foram
reconstruídos a partir de vídeos, guias e de um remake de referência pixel a pixel da fase 1. São
fiéis no comportamento, mas não são uma desmontagem da ROM. Todos os números ficam centralizados e
podem ser ajustados:

- física do Arthur e das armas: `src/core/const.js`;
- inimigos: `src/game/enemies.js`;
- chefes: `src/game/bosses.js`.

## Estrutura

```
index.html, css/          interface, HUD e controles de toque
src/main.js               laço principal (lógica fixa a 60 Hz) e telas: título, intro, mapa, game over, final
src/core/                 constantes, entrada (teclado/gamepad/toque), áudio sintetizado, RNG
src/game/                 fase (colisão), Arthur, armas, itens, inimigos, chefes, diretor da fase
src/levels/               dados das fases medidos do arcade
src/render/               three.js: cenário 3D por tema, modelos 2.5D, efeitos, pós-processamento
vendor/three/             three.js r169 (MIT), embutido para funcionar offline
tests/                    testes headless (Node)
tools/serve.mjs           servidor estático sem dependências
tools/build.mjs           gera jogar.html (jogo inteiro num único arquivo)
jogar.html                versão de arquivo único, abre com dois cliques
```

## Testes

```bash
npm test
```

- `tests/mechanics.mjs`: física do Arthur (pulo, caminhada, escadas, lápides, limite de lanças,
  armadura, água, jangada, zumbis, tempo, potes).
- `tests/enemies.mjs`: comportamento de cada inimigo, e confirma que cada chefe morre com o número de
  acertos certo e libera a chave.
- `tests/flow.mjs`: vidas, checkpoint, game over, chave, a cruz obrigatória contra Astaroth e as 2 voltas.
- `tests/reachability.mjs`: com a física real, verifica que o fim de **cada fase** e o checkpoint são
  alcançáveis a partir do início.
- `tests/simulate.mjs`: roda todas as fases com um "bot" para garantir que nada quebra.

Parâmetros de depuração na URL:

- `?stage=3` começa direto na fase 3;
- `&x=2000&y=432` começa nessa posição;
- `&god=1` deixa o Arthur invencível;
- `&q=low` força a qualidade baixa;
- `?gallery=all` mostra a galeria de modelos (também `gallery=bosses` e `gallery=items`).

## Créditos e aviso legal

Projeto de fã, sem fins comerciais. *Ghosts'n Goblins*, Arthur e os demais personagens são marcas e
propriedade da **Capcom**. Este repositório **não contém nenhum asset do jogo original**:

- todos os modelos 3D e texturas são gerados proceduralmente em código;
- a trilha sonora é original e os efeitos são sintetizados em tempo real;
- os mapas do arcade serviram apenas como referência de medida e não fazem parte do repositório.

three.js é distribuído sob a licença MIT (`vendor/three/LICENSE`).
