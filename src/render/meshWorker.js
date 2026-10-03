// Web Worker: esculpe as espécies fora do thread principal (o jogo não trava ao carregar).
import { buildMesh, transferables } from './meshbuild.js';

self.onmessage = async (e) => {
  const { id, key, quality } = e.data;
  try {
    const r = await buildMesh(key, quality);
    self.postMessage({ id, ok: true, r }, transferables(r));
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.stack || err) });
  }
};
