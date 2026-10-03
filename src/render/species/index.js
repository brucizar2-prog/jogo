// Registro das espécies esculpidas (puro — importado pelo worker e pelo main thread).
import { arthur, frog, bonepile } from './arthur.js';
import { SPECIES as GROUND } from './ground.js';
import { SPECIES as DEMONS } from './demons.js';
import { SPECIES as GIANTS } from './giants.js';
import { SPECIES as FLYERS } from './flyers.js';

export const SPECIES = {
  arthur, frog, bones: bonepile,
  ...GROUND, ...DEMONS, ...GIANTS, ...FLYERS,
};
