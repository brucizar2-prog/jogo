// Geração das malhas de uma espécie (puro: usado pelo Web Worker e, como reserva, no main thread).
import { buildSpecies } from './organic.js';
import { SPECIES } from './species/index.js';
import { MeshoptSimplifier } from '../../vendor/meshopt/meshopt_simplifier.module.js';

let simplifier = null;
export const simplifierReady = (async () => {
  try { await MeshoptSimplifier.ready; simplifier = MeshoptSimplifier; } catch (e) { simplifier = null; }
})();

// quality: 1 = alta (desktop), 1.35 = baixa (celular)
export function buildMeshSync(key, quality = 1) {
  const t0 = Date.now();
  const spec = SPECIES[key]();
  const layers = buildSpecies(spec, { quality, simplifier, ratio: quality > 1 ? 0.3 : 0.42 });
  return {
    key,
    bones: spec.bones,
    rigid: spec.rigid || [],
    scale: spec.scale || 1,
    layers: layers.map((L, i) => ({ ...L, mat: spec.layers[i].mat })),
    ms: Date.now() - t0,
  };
}

export async function buildMesh(key, quality) {
  await simplifierReady;
  return buildMeshSync(key, quality);
}

export function transferables(r) {
  const t = [];
  for (const L of r.layers) t.push(L.positions.buffer, L.normals.buffer, L.indices.buffer, L.colors.buffer, L.skinIndex.buffer, L.skinWeight.buffer);
  return t;
}
