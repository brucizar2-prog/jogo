// Todas as unidades de jogo são pixels do arcade original (tela 256x224, tiles de 16px)
// e a lógica roda a 60 quadros por segundo, como a placa original.
export const FPS = 60;
export const DT = 1 / FPS;
export const TILE = 16;
export const SCREEN_W = 256;   // largura lógica da tela original (usada para spawns/ativação)
export const SCREEN_H = 224;
export const UNIT = 1 / 16;    // 1 tile = 1 unidade no mundo 3D

// Física do Arthur (px/quadro)
export const ARTHUR = {
  walk: 1.0,            // 3 px a cada 3 quadros
  jumpVy: -4.6,         // pulo de arco fixo
  jumpVx: 1.0,
  gravity: 0.2,
  maxFall: 5.0,
  fallDrift: 0.5,       // ao cair de uma borda: 1 e 2 px alternados a cada 3 quadros
  climb: 1.0,
  w: 12, h: 30, hCrouch: 18,
  invuln: 120,          // quadros piscando após perder a armadura
};

export const WEAPONS = {
  lance:  { max: 2, speed: 5.0, w: 24, h: 6, dmg: 1, cooldown: 10 },
  dagger: { max: 3, speed: 7.0, w: 16, h: 6, dmg: 1, cooldown: 7 },
  torch:  { max: 2, speed: 2.6, w: 12, h: 12, dmg: 1, cooldown: 14 },
  axe:    { max: 2, speed: 2.4, w: 16, h: 16, dmg: 2, cooldown: 14 },
  cross:  { max: 2, speed: 4.0, w: 14, h: 14, dmg: 1, cooldown: 12, range: 72 },
};

export const SCORES = {
  zombie: 100, crow: 100, raven: 100, plant: 100, knight: 100, pig: 200, devil: 200, bat: 100,
  skeleton: 200, tower: 400, arremer: 1000, bigman: 2000, magician: 2000, lavadevil: 200,
  unicorn: 2000, dragon: 3000, satan: 5000, astaroth: 10000,
  coin: 200, bag: 500, necklace: 1000, doll: 2000, king: 5000, yashichi: 5000, key: 1000,
};

export const EXTRA_LIFE_AT = [20000, 70000, 140000, 210000];
