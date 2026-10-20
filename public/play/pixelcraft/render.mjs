import { drawJumpSky } from './jump-world.mjs';
// 화면 그리기: 하늘 → 뒷벽 → 블록 → 생물 → 물 → 빛 → 금·선택 칸 → 조각
import { B, I, BLOCKS, ITEMS } from './data.mjs';
import { W, H, noise1 } from './core.mjs';
import { SKINS } from './adventure-world.mjs';
import { tex, darkTex, icons, crack, fluidFrames } from './textures.mjs';

const lightCanvas = document.createElement('canvas');
const lg = lightCanvas.getContext('2d');
let lightData = null;
const stars = Array.from({ length: 90 }, (_, k) => [((k * 7919) % 1000) / 1000, ((k * 104729) % 997) / 997 * 0.7, (k % 3) + 1]);

export function dayFactor(time) {
  // time 0 = 해 뜸, 0.5 = 해 짐. 낮에는 1, 밤에는 0.3
  const a = Math.sin(time * Math.PI * 2);
  return 0.3 + 0.7 * Math.max(0, Math.min(1, a * 3 + 0.45));
}
export function isNight(time) {
  return time > 0.54 && time < 0.97;
}
const mixHex = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

const mixC = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const css = (c) => `rgb(${c.map(Math.round).join(',')})`;
const hash = (k) => Math.abs(Math.sin(k * 12.9898 + 78.233) * 43758.5453) % 1;

function drawSky(g, G, cw, ch, view) {
  if (G.jump) return drawJumpSky(g, G, cw, ch);
  if (G.adventure?.dimension === 'end') {
    g.fillStyle = '#171528'; g.fillRect(0, 0, cw, ch);
    for (let k = 0; k < 90; k++) { g.fillStyle = k % 3 ? '#8a7eaa' : '#d0bdde'; g.globalAlpha = 0.25 + k % 3 * 0.2; g.fillRect(((k * 137.3 - G.cam.x * 2) % cw + cw) % cw, (k * 71.7) % ch, 2, 2); }
    g.globalAlpha = 1; return;
  }
  if (G.adventure?.dimension === 'nether') {
    const grad = g.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#1e1024'); grad.addColorStop(0.6, '#6b2d3a'); grad.addColorStop(1, '#c45d38');
    g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
    for (let k = 0; k < 55; k++) {
      g.fillStyle = k % 3 ? '#bd704c' : '#f0b970';
      const x = ((k * 137.3 - G.cam.x * 8 + G.clock * 7) % cw + cw) % cw;
      const y = ((k * 73.1 - G.clock * (5 + k % 4)) % ch + ch) % ch;
      g.globalAlpha = 0.2 + (k % 3) * 0.1; g.fillRect(x, y, 2 + k % 2, 2 + k % 2);
    }
    g.globalAlpha = 1; return;
  }
  const T = view.T;
  const n = (dayFactor(G.time) - 0.3) / 0.7;
  const dusk = Math.max(0, 1 - Math.abs(Math.sin(G.time * Math.PI * 2)) * 4);
  const top = mixC([10, 15, 38], [92, 156, 242], n);
  let bottom = mixC([28, 37, 80], [180, 216, 255], n);
  if (dusk > 0) bottom = mixC(bottom, [255, 150, 90], dusk * 0.75);
  const grad = g.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, css(top));
  grad.addColorStop(1, css(bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, cw, ch);
  if (n < 0.6) {
    g.fillStyle = `rgba(255,255,255,${(0.6 - n) * 1.4})`;
    for (const [px, py, sz] of stars) g.fillRect(Math.round(px * cw), Math.round(py * ch), sz, sz);
  }
  // 네모난 해와 달. 해는 왼쪽에서 떠서 오른쪽으로 진다
  const ang = G.time * Math.PI * 2;
  const R = Math.min(cw, ch) * 0.45;
  const horizon = ch * 0.62;
  const sz = Math.round(T * 1.6);
  const sunX = cw / 2 - Math.cos(ang) * R, sunY = horizon - Math.sin(ang) * R;
  g.fillStyle = 'rgba(255,240,150,0.25)';
  g.fillRect(sunX - sz, sunY - sz, sz * 2, sz * 2);
  g.fillStyle = '#fff6b0';
  g.fillRect(sunX - sz / 2, sunY - sz / 2, sz, sz);
  const moonX = cw / 2 + Math.cos(ang) * R, moonY = horizon + Math.sin(ang) * R;
  g.fillStyle = '#e8ecf4';
  g.fillRect(moonX - sz / 2.4, moonY - sz / 2.4, sz / 1.2, sz / 1.2);
  g.fillStyle = '#b8c0d0';
  g.fillRect(moonX - sz / 6, moonY - sz / 5, sz / 5, sz / 5);
  // 멀리 보이는 산 (천천히 따라 움직인다)
  g.fillStyle = css(mixC([20, 26, 51], [122, 160, 200], n));
  const step = Math.max(4, Math.round(T / 4));
  const base = ch / 2 + (50 - G.cam.y) * T * 0.4;
  for (let x = 0; x < cw + step; x += step) {
    const wx = view.left * 0.35 + x / T;
    const h = noise1(G.w.seed + 71, wx / 18) * 0.7 + noise1(G.w.seed + 73, wx / 6) * 0.25;
    g.fillRect(x, Math.round(base - h * T * 9), step, ch);
  }
  // 네모 구름
  g.fillStyle = `rgba(255,255,255,${0.3 + n * 0.55})`;
  const cloudX = view.left * 0.6 + G.clock * 0.25;
  const cloudY = ch / 2 + (14 - G.cam.y) * T * 0.7;
  const first = Math.floor(cloudX / 37) - 1;
  for (let k = first; k < first + Math.ceil(view.viewW / 37) + 3; k++) {
    const r = hash(k);
    if (r < 0.3) continue;
    const cx = (k * 37 + r * 12 - cloudX) * T;
    const cwid = (6 + r * 10) * T, chei = T * 1.2, cy = cloudY + r * T * 5;
    g.fillRect(Math.round(cx), Math.round(cy), Math.round(cwid), Math.round(chei));
    g.fillRect(Math.round(cx + T * 2), Math.round(cy - chei * 0.7), Math.round(cwid * 0.5), Math.round(chei));
  }
}

const HELD_LIGHT = { [B.TORCH]: 13, [B.JACK]: 14, [I.LAVA_BUCKET]: 12, [B.FURNACE_LIT]: 10 };
const PLANT_LIKE = new Set([B.TALL_GRASS, B.POPPY, B.DANDELION, B.SAPLING_OAK, B.SAPLING_BIRCH, B.SAPLING_SPRUCE, B.DEAD_BUSH]);

export function render(g, G, cw, ch, T) {
  const w = G.w;
  const viewW = cw / T, viewH = ch / T;
  const left = G.cam.x - viewW / 2, top = G.cam.y - viewH / 2;
  const view = { T, left, top, viewW, viewH };
  G.view = view;
  const sx = (x) => Math.round((x - left) * T);
  const sy = (y) => Math.round((y - top) * T);
  g.imageSmoothingEnabled = false;
  drawSky(g, G, cw, ch, view);

  const x0 = Math.max(0, Math.floor(left) - 1), x1 = Math.min(W - 1, Math.ceil(left + viewW) + 1);
  const y0 = Math.max(0, Math.floor(top) - 1), y1 = Math.min(H - 1, Math.ceil(top + viewH) + 1);
  const { tiles, bg, meta } = w;

  // 뒷벽과 블록
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const t = tiles[i];
      const d = BLOCKS[t];
      const px = sx(x), py = sy(y), pw = sx(x + 1) - px, ph = sy(y + 1) - py;
      if (!d.opaque && bg[i]) g.drawImage(darkTex[bg[i]], px, py, pw, ph);
      if (t === B.AIR || d.fluid) continue;
      if ((t === B.DOOR_B || t === B.DOOR_T) && meta[i] & 1) {
        // 열린 문은 경첩 쪽에 얇게
        const hinge = meta[i] & 2 ? pw - Math.round(pw * 0.2) : 0;
        g.drawImage(tex[t], 0, 0, 3, 16, px + hinge, py, Math.round(pw * 0.2), ph);
        continue;
      }
      if (PLANT_LIKE.has(t) || t === B.TORCH) {
        const sway = PLANT_LIKE.has(t) ? Math.round(Math.sin(G.clock * 1.6 + x * 0.7) * T * 0.04) : 0;
        g.drawImage(tex[t], px + sway, py, pw, ph);
        continue;
      }
      g.drawImage(tex[t], px, py, pw, ph);
    }
  }

  // 떨어지는 블록, 불붙은 TNT
  for (const f of G.falling) g.drawImage(tex[f.id], sx(f.x), sy(f.y), T, T);
  for (const t of G.tnts) {
    g.drawImage(tex[B.TNT], sx(t.x), sy(t.y), T, T);
    if (Math.floor(t.fuse * 6) % 2 === 0) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(sx(t.x), sy(t.y), T, T);
    }
  }
  // 떨어진 아이템
  for (const dr of G.drops) {
    const ic = icons[dr.id];
    if (!ic) continue;
    const bob = Math.sin(G.clock * 3 + dr.seed) * T * 0.06;
    const s = T * 0.5;
    g.drawImage(ic, Math.round(sx(dr.x + 0.175) - s * 0.25 + T * 0.09), Math.round(sy(dr.y) + T * 0.35 - s * 0.6 + bob), Math.round(s), Math.round(s));
  }
  G.drawAdventure?.(g, G, sx, sy, T);
  for (const v of G.adventure?.villagers ?? []) {
    if (Math.abs(v.x - G.cam.x) > view.viewW) continue;
    const u = placeSprite(g, { ...v, face: G.player.x > v.x ? 1 : -1 }, sx, sy, T, 1.8);
    humanoid(g, u, { skin: '#b88b67', shirt: ['#8b6647', '#55485a', '#4f7560'][v.shop], pants: '#413b37', hair: '#503b29', swing: 0, armAng: -0.6, pupil: '#305d41' });
    box(g, u, 2, -28, 4, 3, '#b88b67');
    g.restore();
    g.font = `${Math.max(10, T * 0.22)}px Galmuri11`; g.textAlign = 'center'; g.fillStyle = '#ffe6a6';
    g.fillText(['농부', '대장장이', '상인'][v.shop], sx(v.x + 0.3), sy(v.y - 0.25)); g.textAlign = 'start';
  }
  for (const m of G.mobs) drawMob(g, G, m, sx, sy, T);
  drawPlayer(g, G, sx, sy, T);
  if (G.adventure?.coop && G.companion && !G.companion.spectator) drawPlayer(g, { ...G, player: G.companion, dead: false }, sx, sy, T);
  for (const f of G.fireballs ?? []) {
    const x=sx(f.x),y=sy(f.y),r=T*(f.type==='ghast'?.28:.14);
    g.fillStyle='#f16e26';g.fillRect(x-r,y-r,r*2,r*2);g.fillStyle='#ffe894';g.fillRect(x-r*.5,y-r*.5,r,r);
    for(let k=1;k<5;k++){g.fillStyle=`rgba(255,135,36,${.55-k*.1})`;g.fillRect(x-f.vx*k*.015*T-r*.3,y-f.vy*k*.015*T-r*.3,r*.6,r*.6);}
  }
  for (const a of G.arrows) {
    const ang = Math.atan2(a.vy, a.vx);
    g.save();
    g.translate(sx(a.x), sy(a.y));
    g.rotate(ang);
    g.fillStyle = '#7a5530';
    g.fillRect(-T * 0.4, -T * 0.03, T * 0.6, Math.max(1, T * 0.06));
    g.fillStyle = '#d8d8d8';
    g.fillRect(T * 0.2, -T * 0.06, T * 0.12, T * 0.12);
    g.fillStyle = '#f2f2f2';
    g.fillRect(-T * 0.45, -T * 0.08, T * 0.12, T * 0.16);
    g.restore();
  }

  // 물과 용암
  const frame = Math.floor(G.clock * 3) % 4;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const t = tiles[i];
      if (t !== B.WATER && t !== B.LAVA) continue;
      const full = meta[i] === 8 || (y > 0 && tiles[i - W] === t);
      const h = full ? 1 : Math.max(0.15, meta[i] / 8);
      const px = sx(x), py = sy(y + (1 - h)), pw = sx(x + 1) - px, ph = sy(y + 1) - py;
      const surface = y > 0 && tiles[i - W] !== t;
      g.globalAlpha = t === B.WATER ? 0.72 : 1;
      g.drawImage(fluidFrames[t][(frame + x) % 4], 0, Math.round((1 - h) * 16), 16, Math.max(1, Math.round(h * 16)), px, py, pw, ph);
      if (surface) {
        g.fillStyle = t === B.WATER ? 'rgba(170,210,255,0.7)' : 'rgba(255,230,120,0.8)';
        g.fillRect(px, py, pw, Math.max(1, Math.round(T / 16)));
      }
      g.globalAlpha = 1;
    }
  }

  drawLight(g, G, x0, x1, y0, y1, sx, sy);

  // 캐는 중인 블록의 금, 고른 칸 테두리
  if (G.mining && G.mining.progress > 0) {
    const mx = G.mining.i % W, my = (G.mining.i - mx) / W;
    const stage = Math.min(9, Math.floor(G.mining.progress * 10));
    g.drawImage(crack[stage], sx(mx), sy(my), T, T);
  }
  if (G.target) {
    const { x, y, place } = G.target;
    g.strokeStyle = place ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.85)';
    g.lineWidth = Math.max(2, Math.round(T / 16));
    g.strokeRect(sx(x) + 1, sy(y) + 1, T - 2, T - 2);
    if (!place) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      g.strokeRect(sx(x) + 3, sy(y) + 3, T - 6, T - 6);
    }
  }
  for (const p of G.particles) {
    g.fillStyle = p.color;
    const s = Math.max(2, Math.round(p.size * T));
    g.globalAlpha = Math.min(1, p.life * 3);
    g.fillRect(sx(p.x) - s / 2, sy(p.y) - s / 2, s, s);
  }
  g.globalAlpha = 1;
  // 물속이면 푸르게, 다치면 빨갛게
  const p = G.player;
  const head = Math.floor(p.y + 0.3) * W + Math.floor(p.x + p.w / 2);
  if (tiles[head] === B.WATER) {
    g.fillStyle = 'rgba(30,70,180,0.25)';
    g.fillRect(0, 0, cw, ch);
  } else if (tiles[head] === B.LAVA) {
    g.fillStyle = 'rgba(255,90,0,0.45)';
    g.fillRect(0, 0, cw, ch);
  }
  if (p.hurtT > 0) {
    const grad = g.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(200,0,0,${p.hurtT * 0.8})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);
  }
}

// 빛: 칸마다 밝기를 작은 캔버스에 적고, 부드럽게 늘려 덮는다
function drawLight(g, G, x0, x1, y0, y1, sx, sy) {
  const w = G.w;
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  if (lightCanvas.width !== cols || lightCanvas.height !== rows) {
    lightCanvas.width = cols;
    lightCanvas.height = rows;
    lightData = lg.createImageData(cols, rows);
  }
  const day = dayFactor(G.time);
  const L = new Float32Array(cols * rows);
  const opaque = new Uint8Array(cols * rows);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x, k = (y - y0) * cols + (x - x0);
      const d = BLOCKS[w.tiles[i]];
      if (d.opaque) {
        opaque[k] = 1;
        continue;
      }
      let v = Math.max(w.sky[i] * day, w.blk[i], G.adventure?.dimension === 'nether' ? 8 : G.adventure?.dimension === 'end' ? 7 : 0);
      if (w.sky[i] === 15 && !w.bg[i]) v = Math.max(v, 15 * (0.62 + 0.38 * day));
      L[k] = v;
    }
  }
  for (const portal of G.adventure?.portals ?? []) {
    if (Math.abs(portal.x - G.cam.x) > G.view.viewW) continue;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      if (!opaque[k]) L[k] = Math.max(L[k], 13 - Math.hypot(x0 + c - portal.x - 0.5, y0 + r - portal.y - 2) * 1.3);
    }
  }
  // 횃불·잭오랜턴·용암 양동이를 손에 들면 둘레가 밝아진다
  const glow = HELD_LIGHT[G.heldId] ?? 0;
  if (glow && !G.dead) {
    const p = G.player;
    const cx = p.x + p.w / 2, cy = p.y + 0.6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        if (opaque[k]) continue;
        const v = glow - Math.hypot(x0 + c + 0.5 - cx, y0 + r + 0.5 - cy);
        if (v > L[k]) L[k] = v;
      }
    }
  }
  // 벽 블록: 옆 빈칸 빛을 받아 겉은 밝고 안쪽으로 갈수록 어두워진다
  const Dv = new Float32Array(L);
  for (let pass = 0; pass < 4; pass++) {
    const drop = pass === 0 ? 1 : 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        if (!opaque[k]) continue;
        let best = Dv[k];
        const consider = (kk) => {
          if (pass === 0 ? opaque[kk] : !opaque[kk]) return;
          if (Dv[kk] - drop > best) best = Dv[kk] - drop;
        };
        if (c > 0) consider(k - 1);
        if (c < cols - 1) consider(k + 1);
        if (r > 0) consider(k - cols);
        if (r < rows - 1) consider(k + cols);
        Dv[k] = best;
      }
    }
  }
  const data = lightData.data;
  for (let k = 0; k < cols * rows; k++) {
    const v = Math.max(0, Math.min(15, Dv[k])) / 15;
    const bright = 0.07 + 0.93 * Math.pow(v, 1.3);
    data[k * 4] = 4;
    data[k * 4 + 1] = 4;
    data[k * 4 + 2] = 14;
    data[k * 4 + 3] = Math.round((1 - bright) * 255);
  }
  lg.putImageData(lightData, 0, 0);
  g.imageSmoothingEnabled = true;
  const T = G.view.T;
  g.drawImage(lightCanvas, sx(x0), sy(y0), cols * T, rows * T);
  g.imageSmoothingEnabled = false;
}

// ---- 생물 그림 (1 칸 = 16 단위) ----
const tintCache = new Map();
function tinted(color, mode) {
  if (!mode) return color;
  const key = color + mode;
  let v = tintCache.get(key);
  if (!v) {
    const hex = color.startsWith('#') && color.length === 7 ? color : '#888888';
    v = mixHex(hex, mode === 'red' ? '#ff2020' : '#ffffff', 0.55);
    tintCache.set(key, v);
  }
  return v;
}
function limb(g, ux, x, y, w, h, angle, color, tint) {
  g.save();
  g.translate(x * ux, y * ux);
  g.rotate(angle);
  g.fillStyle = tinted(color, tint);
  g.fillRect(-w / 2 * ux, 0, w * ux, h * ux);
  g.restore();
}
function box(g, ux, x, y, w, h, color, tint) {
  g.fillStyle = tinted(color, tint);
  g.fillRect(x * ux, y * ux, w * ux, h * ux);
}

function humanoid(g, ux, o) {
  // 발 위치(0,0) 기준으로 위로 그린다. 오른쪽을 본다
  const { skin, shirt, pants, hair, swing, armAng, tint, thin, eye = '#ffffff', pupil = '#4a2a8a' } = o;
  const lw = thin ? 2 : 4;
  limb(g, ux, 0, -12, lw, 12, -swing, shade(pants, -25), tint);
  limb(g, ux, 0, -24, lw, 12, (armAng ?? swing) * 0.9 + (o.reach ? -1.4 : 0), shade(o.arm ?? shirt, -25), tint);
  box(g, ux, -2, -24, 4, 12, shirt, tint);
  limb(g, ux, 0, -12, lw, 12, swing, pants, tint);
  // 머리
  box(g, ux, -4, -32, 8, 8, skin, tint);
  if (hair) {
    box(g, ux, -4, -32, 8, 2, hair, tint);
    box(g, ux, -4, -30, 3, 3, hair, tint);
  }
  box(g, ux, 1, -28, 2, 1, eye, tint);
  box(g, ux, 2, -28, 1, 1, pupil, tint);
  if (o.mouth) box(g, ux, 1, -26, 3, 1, o.mouth, tint);
  // 앞팔
  g.save();
  g.translate(0, -24 * ux);
  g.rotate((armAng ?? -swing) + (o.reach ? -1.4 : 0));
  g.fillStyle = tinted(o.arm ?? skin, tint);
  g.fillRect(-lw / 2 * ux, 0, lw * ux, 12 * ux);
  g.fillStyle = tinted(shirt, tint);
  if (!thin) g.fillRect(-lw / 2 * ux, 0, lw * ux, 4 * ux);
  if (o.held) {
    const s = 10 * ux;
    g.translate(0, 11 * ux);
    g.rotate(-0.8);
    g.drawImage(o.held, -2 * ux, -s + 2 * ux, s, s);
  }
  g.restore();
}
function shade(hex, amt) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

function placeSprite(g, e, sx, sy, T, h) {
  const cx = sx(e.x + e.w / 2), feet = sy(e.y + e.h + (e.stepLift ?? 0));
  g.save();
  g.translate(cx, feet);
  if (e.face < 0) g.scale(-1, 1);
  const ux = (T * h) / 32;
  return ux;
}

function drawPlayer(g, G, sx, sy, T) {
  const p = G.player;
  if (G.dead) return;
  const ux = placeSprite(g, p, sx, sy, T, p.h);
  const walk = Math.abs(p.vx) > 0.3 ? Math.sin(p.walkT * 9) * 0.6 : 0;
  const swingArm = p.swing > 0 ? -1.6 + Math.sin(p.swing * Math.PI) * -0.9 : null;
  const held = G.heldId ? icons[G.heldId] : null;
  const armor = (p.armor ?? []).map(s => s && ITEMS[s.id]?.armor?.color);
  humanoid(g, ux, {
    ...(SKINS[p.skin ?? 0] ?? SKINS[0]), swing: walk, armAng: swingArm ?? (held ? -0.5 + walk * -0.3 : null),
    ...(armor[1] ? { shirt: armor[1], arm: armor[1] } : {}), ...(armor[2] ? { pants: armor[2] } : {}),
    tint: p.hurtT > 0.15 ? 'red' : null, held, pupil: '#3a5aa8',
  });
  if (armor[0]) { box(g, ux, -5, -33, 10, 3, armor[0]); box(g, ux, -5, -30, 2, 5, armor[0]); box(g, ux, 4, -30, 1, 3, armor[0]); box(g, ux, -3, -33, 6, 1, '#f2fff4'); }
  if (armor[1]) { box(g, ux, -3, -24, 6, 3, armor[1]); box(g, ux, -2, -22, 1, 7, '#f2fff4'); }
  if (armor[3]) { box(g, ux, -3, -4, 7, 4, armor[3]); box(g, ux, -3, -4, 6, 1, '#f2fff4'); }
  if (p.fire > 0) flames(g, ux, G.clock);
  g.restore();
  if (G.adventure?.coop) {
    g.save(); g.font = `${Math.max(10, T * 0.23)}px Galmuri11`; g.textAlign = 'center';
    const label = p === G.companion ? '2P · 동료' : `1P · ${G.adventure.name}`;
    const x = sx(p.x + p.w / 2), y = sy(p.y - 0.3);
    g.fillStyle = '#17232bcc'; g.fillRect(x - g.measureText(label).width / 2 - 5, y - T * 0.25, g.measureText(label).width + 10, T * 0.34);
    g.fillStyle = p === G.companion ? '#ffd99c' : '#d7c2ff'; g.fillText(label, x, y); g.restore();
  }
}
function flames(g, ux, clock) {
  for (let k = 0; k < 6; k++) {
    const fx = Math.sin(clock * 9 + k * 2.1) * 4, fy = -((clock * 30 + k * 6) % 30);
    g.fillStyle = k % 2 ? 'rgba(255,200,40,0.85)' : 'rgba(255,100,10,0.85)';
    g.fillRect((fx - 1.5) * ux, fy * ux, 3 * ux, 3 * ux);
  }
}

function drawMob(g, G, m, sx, sy, T) {
  const { view } = G;
  if (m.x + m.w < view.left - 1 || m.x > view.left + view.viewW + 1) return;
  const ux = placeSprite(g, m, sx, sy, T, m.type === 'spider' || m.type === 'pig' || m.type === 'sheep' || m.type === 'cow' || m.type === 'chicken' ? 1 : m.h);
  const tint = m.hurtT > 0 ? 'red' : m.fuse > 0 && Math.floor(m.fuse * 8) % 2 === 0 ? 'white' : null;
  const walk = Math.abs(m.vx) > 0.2 ? Math.sin(m.walkT * 8) * 0.55 : 0;
  if (m.dead) g.rotate(Math.min(1.5, m.deadT * 4));
  const u = ux;
  switch (m.type) {
    case 'summoner': {
      const phase = m.phase ?? 1;
      humanoid(g, u, { skin: '#5d975c', shirt: phase === 3 ? '#5c305d' : '#343452', pants: '#242338', hair: '#222637', swing: walk, armAng: -1.3, tint, eye: '#ecdfaf', pupil: '#f0bd59' });
      box(g, u, -5, -34, 10, 3, '#d7ab52', tint);
      for (let k = 0; k < 3; k++) box(g, u, -4 + k * 3, -37, 2, 4, '#f0ce73', tint);
      box(g, u, 5, -25, 2, 24, '#6b4e3b', tint); box(g, u, 3, -29, 6, 6, '#b585ef', tint);
      g.fillStyle = '#dec0ff'; g.globalAlpha = 0.55;
      for (let k = 0; k < phase + 2; k++) {
        const a = G.clock * 1.7 + k * Math.PI * 2 / (phase + 2);
        g.fillRect(Math.cos(a) * 12 * u, (-20 + Math.sin(a) * 8) * u, 2 * u, 2 * u);
      }
      g.globalAlpha = 1;
      break;
    }
    case 'piglin':
      humanoid(g,u,{skin:'#cd9287',shirt:'#6b4939',pants:'#46352d',swing:walk,armAng:-.6,tint,eye:'#fff1d2',pupil:'#402e2a'});
      box(g,u,-6,-29,3,5,'#e9b29c',tint); box(g,u,4,-29,3,5,'#e9b29c',tint);
      box(g,u,-3,-25,7,4,'#e5ac96',tint);box(g,u,-2,-23,1,1,'#73463e',tint);box(g,u,2,-23,1,1,'#73463e',tint);
      box(g,u,5,-18,2,12,'#e7bd4d',tint);box(g,u,3,-10,6,2,'#fff0a1',tint);break;
    case 'ghast':
      for(let k=0;k<7;k++){
        const x=-13+k*4, y=-6+Math.sin(G.clock*2+k)*2;
        box(g,u,x,y,2,9+(k%3)*2,'#c7bec2',tint);box(g,u,x,y,1,9,'#f1e8e6',tint);
      }
      box(g,u,-15,-34,30,27,'#e4dcda',tint);box(g,u,-15,-34,30,3,'#fff5eb',tint);box(g,u,10,-31,5,24,'#bab3b9',tint);
      for(let k=0;k<9;k++)box(g,u,-12+(k%3)*8,-29+Math.floor(k/3)*7,3,2,'#d4c9ca',tint);
      box(g,u,-9,-23,5,3,'#5b3b44',tint);box(g,u,4,-23,5,3,'#5b3b44',tint);
      box(g,u,-3,-17,6,6,m.attackT<.7?'#f67439':'#6f4d57',tint);break;
    case 'blaze':
      for(let k=0;k<9;k++){
        const a=G.clock*2+k*2.1, x=Math.cos(a)*(7+k%3),y=-5-Math.floor(k/3)*9+Math.sin(a)*2;
        box(g,u,x,y,2,7,'#c17b21',tint);box(g,u,x,y,1,5,'#ffdf65',tint);
      }
      box(g,u,-5,-32,10,9,'#e9b445',tint);box(g,u,-5,-32,10,2,'#ffe796',tint);
      box(g,u,-3,-28,2,2,'#422d23',tint);box(g,u,2,-28,2,2,'#422d23',tint);box(g,u,-2,-24,4,1,'#7f3e1f',tint);
      flames(g,u,G.clock);break;
    case 'zombie':
      humanoid(g, u, { skin: '#4f8a3a', shirt: '#2a9aa8', pants: '#4a3a9a', swing: walk, armAng: -1.5, arm: '#4f8a3a', tint, eye: '#1a2a12', pupil: '#000000', mouth: '#2a3a1a' });
      break;
    case 'skeleton':
      humanoid(g, u, { skin: '#d8d8d8', shirt: '#bdbdbd', pants: '#a8a8a8', arm: '#c8c8c8', swing: walk, armAng: -1.4, tint, thin: true, eye: '#222222', pupil: '#000000', held: icons[134], mouth: '#555555' });
      break;
    case 'creeper': {
      const legs = walk * 0.7;
      for (const [lx, a] of [[-2, legs], [2, -legs]]) limb(g, u, lx, -6, 4, 6, a, '#3f9a3a', tint);
      box(g, u, -2, -18, 4, 12, '#4fb04a', tint);
      for (let k = 0; k < 6; k++) box(g, u, -2 + (k % 2) * 2, -18 + k * 2, 2, 2, k % 3 ? '#3a8a34' : '#6ac864', tint);
      box(g, u, -4, -26, 8, 8, '#5abf52', tint);
      box(g, u, -3, -25, 2, 2, '#4fb04a', tint);
      box(g, u, 1, -24, 2, 2, '#111111', tint);
      box(g, u, 0, -22, 2, 3, '#111111', tint);
      box(g, u, 2, -21, 1, 2, '#111111', tint);
      break;
    }
    case 'spider': {
      for (let k = 0; k < 4; k++) {
        const a = 0.7 + k * 0.25 + Math.sin(m.walkT * 12 + k) * (walk ? 0.3 : 0);
        limb(g, u, -2 + k * 2, -8, 2, 10, a, '#2a2420', tint);
        limb(g, u, -2 + k * 2, -8, 2, 10, -a, '#1e1a16', tint);
      }
      box(g, u, -10, -12, 11, 9, '#2e2722', tint);
      box(g, u, -9, -11, 4, 3, '#3e352e', tint);
      box(g, u, 1, -11, 8, 8, '#3a302a', tint);
      box(g, u, 6, -9, 2, 1, '#ff2020', tint);
      box(g, u, 3, -9, 2, 1, '#ff2020', tint);
      box(g, u, 5, -7, 1, 1, '#ff2020', tint);
      break;
    }
    case 'pig':
      quadruped(g, u, walk, tint, { body: '#f0a0a0', dark: '#d88888', bw: 14, bh: 8, lh: 5, head: '#f4a8a8', hw: 7, hh: 7 });
      box(g, u, 9, -9, 2, 3, '#e07878', tint);
      box(g, u, 7, -11, 1, 1, '#222222', tint);
      break;
    case 'cow':
      quadruped(g, u, walk, tint, { body: '#3a2a20', dark: '#2a1e16', bw: 16, bh: 10, lh: 8, head: '#3a2a20', hw: 7, hh: 8 });
      box(g, u, -6, -16, 5, 4, '#f0f0f0', tint);
      box(g, u, 0, -13, 4, 3, '#f0f0f0', tint);
      box(g, u, 8, -16, 3, 3, '#e8d0c0', tint);
      box(g, u, 5, -21, 1, 2, '#d8d0b8', tint);
      box(g, u, 8, -18, 1, 1, '#111111', tint);
      break;
    case 'sheep':
      quadruped(g, u, walk, tint, { body: m.sheared ? '#e0d0c0' : '#f2f2f2', dark: '#c8b8a8', bw: 14, bh: 9, lh: 6, head: '#d8c8b8', hw: 6, hh: 6, legC: '#d8c8b8' });
      box(g, u, 8, -14, 1, 1, '#111111', tint);
      break;
    case 'chicken': {
      limb(g, u, 0, -3, 1, 3, walk, '#e8b020', tint);
      limb(g, u, 1, -3, 1, 3, -walk, '#e8b020', tint);
      box(g, u, -4, -8, 7, 5, '#f4f4f4', tint);
      box(g, u, -4, -7, 3, 3, '#dcdcdc', tint);
      box(g, u, 1, -12, 4, 5, '#f8f8f8', tint);
      box(g, u, 5, -11, 2, 1, '#f0a020', tint);
      box(g, u, 4, -9, 1, 2, '#e02020', tint);
      box(g, u, 3, -11, 1, 1, '#111111', tint);
      break;
    }
    default:
      break;
  }
  if (m.fire > 0) flames(g, ux, G.clock + m.x);
  g.restore();
}
function quadruped(g, u, walk, tint, o) {
  const legC = o.legC ?? o.dark;
  const bx = -o.bw / 2;
  for (const [lx, a] of [[bx + 1.5, walk], [bx + o.bw - 2.5, -walk]]) limb(g, u, lx, -o.lh, 3, o.lh, a, shade(legC, -20), tint);
  for (const [lx, a] of [[bx + 3, -walk], [bx + o.bw - 1, walk]]) limb(g, u, lx, -o.lh, 3, o.lh, a, legC, tint);
  box(g, u, bx, -o.lh - o.bh, o.bw, o.bh, o.body, tint);
  box(g, u, bx, -o.lh - 2, o.bw, 2, o.dark, tint);
  box(g, u, o.bw / 2 - 2, -o.lh - o.bh - o.hh + 4, o.hw, o.hh, o.head, tint);
}

// 미니맵에 쓸 블록 색 (가방 화면이 아닌 곳에서도 쓴다)
export function itemName(id) {
  return ITEMS[id]?.name ?? '';
}
