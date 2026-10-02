// Gerador pseudoaleatório determinístico (as placas da época usavam um LFSR simples).
let s = 0x2545f491;
export function seed(v) { s = (v >>> 0) || 1; }
export function rnd() {
  s ^= s << 13; s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5; s >>>= 0;
  return (s >>> 0) / 4294967296;
}
export const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
export const rrange = (a, b) => a + rnd() * (b - a);
export const chance = (p) => rnd() < p;
export const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
