// 샌즈와 블래스터 픽셀 그림을 한 장의 PNG로 뽑아 눈으로 확인한다.
// 실행: node games/sans/art-preview.mjs <out.png> [배율=5]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { drawSans, drawBlaster, toRGBA, SANS } from '../../public/play/sans/art.mjs';

const [outPath, scaleArg] = process.argv.slice(2);
if (!outPath) { console.error('사용법: node games/sans/art-preview.mjs <out.png> [배율]'); process.exit(1); }
const S = Number(scaleArg) || 5, GAP = 6;
const faces = ['idle', 'look', 'closed', 'wink', 'dark', 'glow', 'tired', 'sleep', 'hurt'];
const cells = [
  ...faces.map(face => ({ label: face, R: drawSans({ face, sweat: face === 'tired' ? 3 : 0, gash: face === 'hurt', flicker: 0 }) })),
  ...['left', 'right', 'up', 'down'].map(arm => ({ label: 'arm ' + arm, R: drawSans({ face: 'glow', arm, flicker: 1, sweat: 1 }) })),
  ...[0, .5, 1].map((open, i) => ({ label: 'blaster ' + open, R: drawBlaster(open, i / 2) })),
];
const perRow = 7, cellW = SANS.w + GAP, cellH = SANS.h + GAP, rows = Math.ceil(cells.length / perRow);
const W = (perRow * cellW + GAP) * S, H = (rows * cellH + GAP) * S, image = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) image.set([10, 9, 16, 255], i * 4);
cells.forEach((cell, index) => {
  const rgba = toRGBA(cell.R), ox = (GAP + (index % perRow) * cellW + Math.floor((SANS.w - cell.R.w) / 2)) * S, oy = (GAP + Math.floor(index / perRow) * cellH + (SANS.h - cell.R.h)) * S;
  for (let y = 0; y < cell.R.h; y++) for (let x = 0; x < cell.R.w; x++) {
    const i = (y * cell.R.w + x) * 4; if (!rgba[i + 3]) continue;
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) image.set([rgba[i], rgba[i + 1], rgba[i + 2], 255], ((oy + y * S + yy) * W + ox + x * S + xx) * 4);
  }
});

// PNG 인코딩 (필터 0, RGBA)
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = buffer => { let c = -1; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) image.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const header = Buffer.alloc(13); header.writeUInt32BE(W, 0); header.writeUInt32BE(H, 4); header[8] = 8; header[9] = 6;
fs.writeFileSync(outPath, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`저장: ${outPath} (${W}x${H}) · ${cells.map(cell => cell.label).join(', ')}`);
