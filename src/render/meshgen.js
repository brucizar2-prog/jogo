// Gerenciador das malhas esculpidas: distribui o trabalho entre Web Workers, guarda o resultado
// em memória e no IndexedDB (a segunda vez que o jogo abre, carrega na hora) e oferece uma
// geração síncrona de reserva caso os workers não estejam disponíveis.
import { buildMeshSync, simplifierReady } from './meshbuild.js';
import { SPECIES } from './species/index.js';

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const LOW = (() => {
  const q = params.get('q');
  try { return q === 'low' || (q !== 'high' && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 2)); } catch (e) { return false; }
})();
export const QUALITY = LOW ? 1.35 : 1;
// o Arthur (um só na tela, sempre em destaque) é esculpido sempre na qualidade máxima
const HERO = new Set(['arthur']);
const qualityFor = (key) => (HERO.has(key) ? 1 : QUALITY);
const ENGINE_VERSION = 'v2.5';

const READY = new Map();      // key -> resultado
const PENDING = new Map();    // key -> Promise
let workers = null;
let rr = 0, nextId = 1;
const jobs = new Map();       // id -> { resolve, reject, key }

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const cacheKey = (key) => `${ENGINE_VERSION}:${key}:${qualityFor(key)}:${hashStr(SPECIES[key].toString())}`;

// ------------------------------------------------------------------ IndexedDB
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      if (params.get('nocache') === '1' || typeof indexedDB === 'undefined') { res(null); return; }
      const r = indexedDB.open('gng3d-meshes', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('m');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
async function cacheGet(k) {
  const d = await db();
  if (!d) return null;
  return new Promise((res) => {
    try { const g = d.transaction('m').objectStore('m').get(k); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); } catch (e) { res(null); }
  });
}
async function cachePut(k, v) {
  const d = await db();
  if (!d) return;
  try { d.transaction('m', 'readwrite').objectStore('m').put(v, k); } catch (e) { /* cache é opcional */ }
}

// ------------------------------------------------------------------ workers
function createWorker() {
  try {
    if (typeof window !== 'undefined' && window.__MESH_WORKER_SRC) {
      const url = URL.createObjectURL(new Blob([window.__MESH_WORKER_SRC], { type: 'text/javascript' }));
      return new Worker(url);
    }
    return new Worker(new URL('./meshWorker.js', import.meta.url), { type: 'module' });
  } catch (e) {
    return null;
  }
}
function initWorkers() {
  if (workers) return workers;
  workers = [];
  if (params.get('noworker') === '1') return workers;
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  for (let i = 0; i < n; i++) {
    const w = createWorker();
    if (!w) break;
    w.onmessage = (e) => {
      const j = jobs.get(e.data.id);
      if (!j) return;
      jobs.delete(e.data.id);
      if (e.data.ok) j.resolve(e.data.r); else j.reject(new Error(e.data.error));
    };
    w.onerror = (ev) => {
      ev.preventDefault && ev.preventDefault();
      // worker inutilizável: refaz os trabalhos dele no thread principal
      workers = workers.filter((x) => x !== w);
      for (const [id, j] of jobs) if (j.w === w) { jobs.delete(id); try { j.resolve(buildMeshSync(j.key, qualityFor(j.key))); } catch (err) { j.reject(err); } }
    };
    workers.push(w);
  }
  return workers;
}

function runJob(key) {
  const ws = initWorkers();
  if (!ws.length) return simplifierReady.then(() => buildMeshSync(key, qualityFor(key)));
  return new Promise((resolve, reject) => {
    const w = ws[rr++ % ws.length];
    const id = nextId++;
    jobs.set(id, { resolve, reject, key, w });
    w.postMessage({ id, key, quality: qualityFor(key) });
  });
}

// pede a geração (assíncrona) de uma espécie
export function requestSpecies(key) {
  if (READY.has(key)) return Promise.resolve(READY.get(key));
  if (PENDING.has(key)) return PENDING.get(key);
  const ck = cacheKey(key);
  const p = (async () => {
    let r = await cacheGet(ck);
    if (!r) {
      r = await runJob(key);
      cachePut(ck, r);
    }
    READY.set(key, r);
    PENDING.delete(key);
    return r;
  })().catch((err) => {
    console.warn('falha ao esculpir', key, err);
    PENDING.delete(key);
    const r = buildMeshSync(key, qualityFor(key));
    READY.set(key, r);
    return r;
  });
  PENDING.set(key, p);
  return p;
}
export function requestAll(keys) { return Promise.all(keys.map(requestSpecies)); }
export const isReady = (key) => READY.has(key);
export const allReady = (keys) => keys.every((k) => READY.has(k));
export const progress = (keys) => (keys.length ? keys.filter((k) => READY.has(k)).length / keys.length : 1);

// acesso síncrono (gera no thread principal se ainda não estiver pronto)
export function getSpeciesData(key) {
  if (!READY.has(key)) READY.set(key, buildMeshSync(key, qualityFor(key)));
  return READY.get(key);
}
export const hasSpecies = (key) => !!SPECIES[key];
