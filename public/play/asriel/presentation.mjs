import * as P from './asriel-pixels.mjs';
export const TRACK_DURATION = 182;
export const RAINBOW = ['#ef4255', '#ef893b', '#efcd4e', '#49bd73', '#458eef', '#5752bc', '#ac5cda'];
export function backgroundColor(musicTime, reducedMotion = false) {
  if (musicTime < 10) return '#10101b';
  if (reducedMotion) return '#43335c';
  const position = (musicTime - 10) / 2;
  const index = Math.floor(position) % RAINBOW.length;
  const blend = position % 1;
  const first = RAINBOW[index], next = RAINBOW[(index + 1) % RAINBOW.length];
  const channels = [1, 3, 5].map(offset => Math.round(
    parseInt(first.slice(offset, offset + 2), 16) * (1 - blend) +
    parseInt(next.slice(offset, offset + 2), 16) * blend));
  return 'rgb(' + channels.join(',') + ')';
}

// 재질마다 명암을 입힌 움직이는 픽셀 스프라이트. 같은 시각의 프레임은 재사용한다.
const sprites = new Map();
function sprite(context, kind, time, options = {}) {
  const size = kind === 'god' ? P.GOD_SIZE : kind === 'final' ? P.FINAL_SIZE : kind === 'child' ? P.CHILD_SIZE : P.SKULL_SIZE;
  let entry = sprites.get(kind);
  if (!entry) {
    const canvas = context.canvas.ownerDocument.createElement('canvas'); canvas.width = size.w; canvas.height = size.h;
    entry = { canvas, ctx: canvas.getContext('2d'), raster: P.createRaster(size.w, size.h), frame: null };
    sprites.set(kind, entry);
  }
  const frame = Math.floor(time * 12), key = frame + ':' + JSON.stringify(options);
  if (entry.frame !== key) {
    P.clearRaster(entry.raster);
    const painter = kind === 'god' ? P.drawGod : kind === 'final' ? P.drawFinal : kind === 'child' ? P.drawChild : P.drawSkull;
    painter(entry.raster, time / 3, options);
    entry.ctx.putImageData(new ImageData(P.colorize(entry.raster, { t: frame / 12 }), size.w, size.h), 0, 0);
    entry.frame = key;
  }
  return entry.canvas;
}
export function drawAsriel(context, { finalForm = false, child = false, time = 0, transform = null } = {}) {
  const kind = child ? 'child' : finalForm ? 'final' : 'god';
  const image = sprite(context, kind, time, { blink: Math.floor(time * 12) % 73 < 2, tears: child, ...(finalForm ? { spread: transform === null ? 1 : Math.min(1, transform / 2) } : {}) });
  const scale = child ? 3 : 2;
  context.save(); context.imageSmoothingEnabled = false;
  context.shadowColor = finalForm ? '#bd83f2' : '#83dcff'; context.shadowBlur = child ? 0 : 18;
  context.drawImage(image, Math.round(400 - image.width * scale / 2), Math.round(38 + Math.sin(time * 1.8) * 3), image.width * scale, image.height * scale);
  context.restore();
}
export function drawHyperGoner(context, time, charge = 1) {
  const image = sprite(context, 'skull', time, { open: .5 + charge * .5 });
  context.save(); context.imageSmoothingEnabled = false; context.shadowColor = '#c8a7ff'; context.shadowBlur = 25;
  context.drawImage(image, 280, 150, 240, 192); context.restore();
}
export const SOUL_COLORS = ['#56e5f5', '#ffb84c', '#656cff', '#d575f6', '#6ce896', '#ffe278'];
export function drawSoul(context, x, y, color, scale = 2) {
  const rows = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'];
  context.fillStyle = color;
  rows.forEach((row, j) => [...row].forEach((v, i) => { if (v === '1') context.fillRect(Math.round(x + (i - 4) * scale), Math.round(y + (j - 3) * scale), scale, scale); }));
}
