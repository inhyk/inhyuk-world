// Room relays at most 16KB per message. Compress a snapshot, then send bounded ASCII chunks.
export const CHUNK_SIZE = 12000;
export const MAX_CHUNKS = 512;
export const MAX_DECODED = 16 * 1024 * 1024;
export async function encodePackets(value, id) {
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > MAX_DECODED) throw Error('세계가 너무 커서 온라인으로 보내지 못했어.');
  const compressed = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let i = 0; i < compressed.length; i += 8192) binary += String.fromCharCode(...compressed.subarray(i, i + 8192));
  const data = btoa(binary), total = Math.ceil(data.length / CHUNK_SIZE);
  if (!total || total > MAX_CHUNKS) throw Error('온라인 세계 전송 크기를 넘었어.');
  return Array.from({ length: total }, (_, index) => ({ t: 'pc-snapshot', v: 1, id, index, total, data: data.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE) }));
}
export class SnapshotReader {
  reset() { this.id = -1; this.total = 0; this.parts = []; }
  constructor() { this.reset(); }
  async push(m) {
    if (m?.t !== 'pc-snapshot' || m.v !== 1 || !Number.isSafeInteger(m.id) || m.id < 0 || !Number.isInteger(m.total) || m.total < 1 || m.total > MAX_CHUNKS || !Number.isInteger(m.index) || m.index < 0 || m.index >= m.total || typeof m.data !== 'string' || m.data.length > CHUNK_SIZE || !/^[A-Za-z0-9+/=]+$/.test(m.data)) throw Error('세계 전송 형식이 맞지 않아. 다시 들어와 줘.');
    if (m.index === 0) { if (m.id <= this.id) return null; this.id = m.id; this.total = m.total; this.parts = []; }
    if (m.id !== this.id || m.total !== this.total || m.index !== this.parts.length) throw Error('세계 전송이 끊겼어. 다시 들어와 줘.');
    this.parts.push(m.data);
    if (this.parts.length !== this.total) return null;
    const bytes = Uint8Array.from(atob(this.parts.join('')), c => c.charCodeAt(0));
    this.parts = [];
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = []; let length = 0;
    try {
      while (true) {
        const r = await reader.read(); if (r.done) break;
        length += r.value.length;
        if (length > MAX_DECODED) { await reader.cancel(); throw Error('세계 전송 크기를 넘었어.'); }
        chunks.push(r.value);
      }
    } finally { reader.releaseLock(); }
    return JSON.parse(await new Blob(chunks).text());
  }
}
export const INPUT_KEYS = ['KeyA','KeyD','KeyW','KeyS','Space','ShiftLeft','ShiftRight'];
export function cleanInput(m) {
  if (!m || !Array.isArray(m.keys) || !m.keys.every(k => INPUT_KEYS.includes(k)) || m.keys.length > INPUT_KEYS.length || !Number.isInteger(m.sel) || m.sel < 0 || m.sel > 8) return null;
  const target = m.target;
  if (target !== null && (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || target.x < 0 || target.x >= 1280 || target.y < -16 || target.y >= 160)) return null;
  return { keys: [...new Set(m.keys)], sel: m.sel, target, left: m.left === true, right: m.right === true };
}
