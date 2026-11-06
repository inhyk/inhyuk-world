// Procedural PBR textures: colour (sRGB), normal and roughness maps made from code (texgen.js), once
// per name+params. The pixels are worked out by a few web workers (texworker.js) on other CPU cores,
// so loading the game does not wait for them one by one: tex() hands back the textures at once and
// fills them in when the worker is done (texReady() waits for all of them).
import * as THREE from 'three';
import { texPixels, GENERATORS } from './texgen.js';

const cache = new Map();
let maxAniso = 8;
export function setAnisotropy(n) { maxAniso = n; }

function finish(canvas, color, T = THREE.CanvasTexture) {
  const t = new T(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * A texture whose version follows its image: materials hold copies (clone()) with their own repeat,
 * and they all see the new pixels when the worker fills the shared canvas (source.needsUpdate).
 */
class GenTexture extends THREE.CanvasTexture {
  get version() { return (this._v ?? 0) + (this.source?.version ?? 0); }
  set version(v) { this._v = v - (this.source?.version ?? 0); }
}

// ---------------------------------------------------------------- workers
let pool = null, nextJob = 1, rr = 0;
const jobs = new Map(); // id → fill(data)
let idle = null, idleResolve = null;
function workers() {
  if (pool) return pool;
  pool = [];
  const n = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency ?? 4) - 2));
  try {
    if (typeof Worker === 'undefined') return pool;
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./texworker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => done(e.data.id, e.data);
      w.onerror = (e) => { e.preventDefault?.(); fail(w); };
      w.jobs = new Set();
      pool.push(w);
    }
  } catch (e) { console.warn('texture workers unavailable', e); pool = []; }
  return pool;
}
function done(id, data) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.delete(id);
  for (const w of pool ?? []) w.jobs.delete(id);
  job.fill(data);
  if (!jobs.size && idleResolve) { idleResolve(); idle = idleResolve = null; }
}
/** A worker broke (old browser, blocked script): make its textures here instead, and stop using it. */
function fail(w) {
  pool = pool.filter((x) => x !== w);
  try { w.terminate(); } catch { /* gone */ }
  for (const id of [...w.jobs]) { const j = jobs.get(id); if (j) done(id, texPixels(j.name, j.params)); }
}
/** Are some texture pixels still being made? */
export const texBusy = () => jobs.size > 0;
/** Resolves when every texture asked for so far has its pixels. */
export function texReady() {
  if (!jobs.size) return Promise.resolve();
  return (idle ??= new Promise((r) => { idleResolve = r; }));
}

function put(canvas, data, size) { canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0); }

/**
 * tex('planks', {color: 0xb98a5a}) → { map, normalMap, roughnessMap }, cached by name+params.
 * size defaults to 512. Generators: planks wood tiles marble carpet fabric stripes plaster concrete
 * asphalt pavers grass dirt sand brick siding shingles bark stone brushed leather smooth leaves water.
 */
export function tex(name, params = {}) {
  const key = name + JSON.stringify(params);
  if (cache.has(key)) return cache.get(key);
  if (!GENERATORS.includes(name)) throw new Error('unknown texture ' + name);
  const size = params.size ?? 512;
  const cv = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = size; return c; });
  const t = { map: finish(cv[0], true, GenTexture), normalMap: finish(cv[1], false, GenTexture), roughnessMap: finish(cv[2], false, GenTexture) };
  const fill = (d) => {
    put(cv[0], d.col, d.size); put(cv[1], d.nor, d.size); put(cv[2], d.rough, d.size);
    for (const x of Object.values(t)) x.needsUpdate = true;
  };
  const ws = workers();
  if (!ws.length) fill(texPixels(name, params));
  else {
    // until the pixels come: plain grey, flat normal (nothing is drawn with it during loading)
    const g = cv[0].getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
    const n = cv[1].getContext('2d'); n.fillStyle = '#8080ff'; n.fillRect(0, 0, size, size);
    const r = cv[2].getContext('2d'); r.fillStyle = '#999999'; r.fillRect(0, 0, size, size);
    const id = nextJob++;
    jobs.set(id, { fill, name, params });
    const w = ws[rr++ % ws.length];
    w.jobs.add(id);
    w.postMessage({ id, name, params });
  }
  cache.set(key, t);
  return t;
}

/** Text or drawing on a canvas, for signs, screens, posters. draw(ctx, w, h). */
export function canvasTex(w, h, draw, { color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = finish(c, color);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export const FONT = '"Jua", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
