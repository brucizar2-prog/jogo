// Personagens orgânicos: cada espécie é esculpida com SDFs (species/*.js) por Web Workers,
// vira SkinnedMesh com esqueleto e é animada por ossos (creatures/*.js).
import { LazyModel, getSpecies, RIM } from './creatures/core.js';
import { requestAll, allReady, progress } from './meshgen.js';
import { ArthurOrganic } from './creatures/arthur.js';
import { CREATURES as C1 } from './creatures/ground.js';
import { CREATURES as C2 } from './creatures/demons.js';
import { CREATURES as C3 } from './creatures/giants.js';
import { CREATURES as C4 } from './creatures/flyers.js';

// tipo de entidade -> { keys: espécies necessárias, make: () => modelo }
const MAKERS = { ...C1, ...C2, ...C3, ...C4 };

const ARTHUR_KEYS = ['arthur', 'frog', 'bones'];
export function createArthur() { return new LazyModel(ARTHUR_KEYS, () => new ArthurOrganic()); }
export function createCreature(type) {
  const m = MAKERS[type];
  return m ? new LazyModel(m.keys, m.make) : null;
}
export function hasCreature(type) { return !!MAKERS[type]; }
export const creatureTypes = () => Object.keys(MAKERS);
export const keysOf = (type) => (type === 'arthur' ? ARTHUR_KEYS : MAKERS[type] ? MAKERS[type].keys : []);

// Pré-carregamento: pede aos workers as espécies da fase (o Arthur primeiro).
let current = [...ARTHUR_KEYS];
export function prewarm(types) {
  const keys = [...ARTHUR_KEYS];
  for (const t of types) for (const k of keysOf(t)) if (!keys.includes(k)) keys.push(k);
  current = keys;
  requestAll(keys);
  return 0;
}
// todas as espécies (em segundo plano, depois das prioritárias)
export function prewarmAll(first = []) {
  const keys = [...ARTHUR_KEYS];
  for (const t of [...first, ...Object.keys(MAKERS)]) for (const k of keysOf(t)) if (!keys.includes(k)) keys.push(k);
  return requestAll(keys);
}
export const prewarmDone = () => allReady(current);
export const prewarmProgress = () => progress(current);
export function prewarmStep() { return 0; }

export { ArthurOrganic, getSpecies, RIM };
