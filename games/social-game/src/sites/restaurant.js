// 맛있는 고깃집: a hanok-style Korean BBQ restaurant for the company dinner (회식).
// Footprint 14 (X) x 12 (Z), entrance on +Z. Site contract: ../site.js. Kit: ./office.js.
import * as THREE from 'three';
import { mat, paint, textured, glow } from '../mat.js';
import { box, torus, lathe, plane, quad, prep, put, group, bake, extrude, aabb } from '../geom.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { PI, RB, CY, SP, V, D, cached, vcGloss, vcSoft, vcLeaf, Atlas, txt, rr, leafGeo, pottedPlant, shrub, waterBottle, blackPl, whitePl, tint } from './office.js';

const FY = 0.15; // floor top
const CEIL = 3.2; // interior ceiling
const TH = (24 * PI) / 180, TAN = Math.tan(TH);
const RIDGE_Z = -0.5, RIDGE_Y = 3.45 + 4.4 * TAN;
const roofY = (z) => RIDGE_Y - TAN * Math.abs(z - RIDGE_Z); // top surface of the roof tiles
// tables: [x, z]; index 1 is our table (회식)
const TABLES = [[-3.9, 2.1], [0.3, 2.1], [-3.9, -0.55], [0.3, -0.55]];
const OURS = 1;
const SEAT_R = 0.82;
const SEATS = [[0, SEAT_R, 0], [-SEAT_R, 0, -PI / 2], [0, -SEAT_R, PI], [SEAT_R, 0, PI / 2]]; // dx, dz, yaw (S, W, N, E)

/* ------------------------------------------------------------------ materials + atlases */
function restMats() {
  return cached('restMats', () => {
    return {
      timber: textured('wood', { color: 0x4f3221, seed: 21 }, 1.4, { normal: 0.5 }),
      tile: textured('shingles', { color: 0x3c4046, seed: 6 }, 1.1, { normal: 1.3 }),
      plaster: mat('plasterWarm'),
      ceil: mat('plaster'),
      oak: mat('oak'),
      floor: mat('darkFloor'),
      stone: mat('stone'),
      steel: mat('steel'),
      dsteel: mat('darkSteel'),
      glass: mat('glass'),
      hanji: (() => { const m = paint(0xf3e6cc, 0.9, 0, { emissive: 0xffc27a, emissiveIntensity: 0.7 }).clone(); m.name = 'hanjiGlow'; m.side = THREE.DoubleSide; return m; })(),
      ember: (() => { const m = glow(0xff6a12, 1.05); m.color.set(0x2a0a02); m.name = 'emberGlow'; return m; })(),
      fridgeGlow: (() => { const m = glow(0xf2f7ff, 1.4); m.name = 'fridgeGlow'; return m; })(),
    };
  });
}

function vText(c, s, x, y, px, color, step) {
  [...s].forEach((ch, i) => txt(c, ch, x, y + i * (step ?? px * 1.05), px, color, 'center'));
}
function grain(c, x, y, w, h, base, R) {
  c.fillStyle = base; c.fillRect(x, y, w, h);
  for (let i = 0; i < w / 3; i++) { c.fillStyle = `rgba(70,40,15,${0.05 + R() * 0.12})`; c.fillRect(x + R() * w, y, 1 + R() * 2, h); }
}
function pig(c, cx, cy, r) {
  c.fillStyle = '#f4a7b0'; c.beginPath(); c.arc(cx, cy, r, 0, PI * 2); c.fill();
  c.beginPath(); c.moveTo(cx - r * 0.85, cy - r * 0.5); c.lineTo(cx - r * 0.55, cy - r * 1.15); c.lineTo(cx - r * 0.25, cy - r * 0.8); c.fill();
  c.beginPath(); c.moveTo(cx + r * 0.85, cy - r * 0.5); c.lineTo(cx + r * 0.55, cy - r * 1.15); c.lineTo(cx + r * 0.25, cy - r * 0.8); c.fill();
  c.fillStyle = '#e57f8f'; c.beginPath(); c.ellipse(cx, cy + r * 0.25, r * 0.38, r * 0.27, 0, 0, PI * 2); c.fill();
  c.fillStyle = '#7a2d38'; c.beginPath(); c.arc(cx - r * 0.13, cy + r * 0.25, r * 0.07, 0, PI * 2); c.arc(cx + r * 0.13, cy + r * 0.25, r * 0.07, 0, PI * 2); c.fill();
  c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(cx - r * 0.35, cy - r * 0.18, r * 0.09, 0, PI * 2); c.arc(cx + r * 0.35, cy - r * 0.18, r * 0.09, 0, PI * 2); c.fill();
}
function meatPic(c, x, y, w, h, kind) {
  c.fillStyle = '#efe7da'; c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w * 0.46, h * 0.4, 0, 0, PI * 2); c.fill();
  if (kind === 0) for (let i = 0; i < 4; i++) { c.save(); c.translate(x + w * (0.3 + i * 0.13), y + h * 0.5); c.rotate(0.5); c.fillStyle = '#e88f8a'; c.fillRect(-w * 0.05, -h * 0.28, w * 0.1, h * 0.56); c.fillStyle = '#fbeee6'; c.fillRect(-w * 0.05, -h * 0.1, w * 0.1, h * 0.05); c.fillRect(-w * 0.05, h * 0.08, w * 0.1, h * 0.04); c.restore(); }
  else if (kind === 1) { c.fillStyle = '#8a4a26'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x + w * (0.35 + i * 0.15), y + h * 0.5, w * 0.1, h * 0.22, 0.4, 0, PI * 2); c.fill(); } c.fillStyle = '#e9d8b0'; c.fillRect(x + w * 0.3, y + h * 0.48, w * 0.4, 3); }
  else if (kind === 2) { c.fillStyle = '#5a3a28'; c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w * 0.3, h * 0.28, 0, 0, PI * 2); c.fill(); c.fillStyle = '#c8763a'; c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w * 0.25, h * 0.22, 0, 0, PI * 2); c.fill(); c.fillStyle = '#7fb24a'; c.fillRect(x + w * 0.42, y + h * 0.42, w * 0.05, h * 0.05); c.fillStyle = '#f0e2b0'; c.fillRect(x + w * 0.52, y + h * 0.5, w * 0.06, h * 0.06); }
  else { c.fillStyle = '#d8dde0'; c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w * 0.3, h * 0.28, 0, 0, PI * 2); c.fill(); c.strokeStyle = '#c9b48a'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + w / 2, y + h / 2, w * 0.05 + i * 3, 0, PI * 2); c.stroke(); } c.fillStyle = '#e04a3a'; c.fillRect(x + w * 0.48, y + h * 0.36, w * 0.08, h * 0.1); }
}

function restAtlas() {
  return cached('restAtlas', () => {
    const A = new Atlas(2048), G = new Atlas(1536);
    /* -------- printed */
    const menu = [['삼겹살', '15,000'], ['목살', '16,000'], ['항정살', '18,000'], ['갈매기살', '17,000'], ['양념갈비', '18,000'], ['된장찌개', '7,000'], ['물냉면', '8,000'], ['공기밥', '1,000'], ['사이다', '2,000'], ['콜라', '2,000']];
    A.add('tags', 1120, 300, (c, w, h) => {
      const R = rng(3);
      c.clearRect(0, 0, w, h);
      menu.forEach(([n, p], i) => {
        const x = 6 + i * 111;
        grain(c, x, 4, 100, 290, ['#caa06a', '#c3965d', '#d2a970'][i % 3], R);
        c.strokeStyle = '#6b4626'; c.lineWidth = 3; c.strokeRect(x + 4, 8, 92, 282);
        c.fillStyle = '#3a2414'; c.beginPath(); c.arc(x + 50, 22, 6, 0, PI * 2); c.fill();
        vText(c, n, x + 50, 76, n.length > 3 ? 38 : 44, '#24160d', n.length > 3 ? 41 : 50);
        txt(c, p, x + 50, 276, 22, '#a3261c', 'center');
      });
    });
    A.add('menuBig', 1400, 330, (c, w, h) => {
      const R = rng(5);
      grain(c, 0, 0, w, h, '#3b2618', R);
      c.strokeStyle = '#c99a55'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
      txt(c, '차 림 표', 150, 190, 80, '#f4e2c0', 'center');
      txt(c, '숯불 직화', 150, 250, 34, '#d9a35a', 'center');
      const items = [['생 삼겹살', '15,000원', 0], ['양념 돼지갈비', '18,000원', 1], ['된장찌개', '7,000원', 2], ['시원한 물냉면', '8,000원', 3]];
      items.forEach(([n, p, k], i) => {
        const x = 300 + i * 272;
        rr(c, x, 34, 252, 262, 14, '#f4ead8');
        meatPic(c, x + 16, 46, 220, 150, k);
        txt(c, n, x + 126, 236, 34, '#2b1a10', 'center');
        txt(c, p, x + 126, 280, 32, '#b02a1e', 'center');
      });
    });
    A.add('posterPig', 360, 500, (c, w, h) => {
      c.fillStyle = '#f6ecd6'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#b3261e'; c.lineWidth = 10; c.strokeRect(10, 10, w - 20, h - 20);
      pig(c, w / 2, 190, 92);
      txt(c, '국내산 한돈', w / 2, 360, 50, '#b3261e', 'center');
      txt(c, '100%', w / 2, 430, 58, '#2b1a10', 'center');
    });
    A.add('posterFire', 360, 500, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a1a12'); g.addColorStop(1, '#4a2414');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) { c.fillStyle = ['#ff7a2a', '#ffb347', '#ffe08a'][i]; c.beginPath(); c.moveTo(w / 2, 70 + i * 40); c.bezierCurveTo(w / 2 + 120 - i * 30, 170 + i * 20, w / 2 + 70 - i * 20, 300, w / 2, 300); c.bezierCurveTo(w / 2 - 70 + i * 20, 300, w / 2 - 120 + i * 30, 170 + i * 20, w / 2, 70 + i * 40); c.fill(); }
      c.fillStyle = '#222'; for (let i = 0; i < 5; i++) c.fillRect(70 + i * 46, 310, 30, 18);
      txt(c, '참숯 직화구이', w / 2, 400, 46, '#ffd9a0', 'center');
      txt(c, '매일 아침 숯을 피워요', w / 2, 450, 24, '#e6b98a', 'center');
    });
    A.add('aframe', 420, 600, (c, w, h) => {
      c.fillStyle = '#2d3a30'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) { c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(Math.random() * w, Math.random() * h, 30, 2); }
      txt(c, '오늘의 추천', w / 2, 80, 52, '#ffe9a8', 'center');
      txt(c, '삼겹살 세트', w / 2, 180, 50, '#ffffff', 'center');
      txt(c, '2인 32,000원', w / 2, 240, 38, '#ffb8a0', 'center');
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(70, 275); c.lineTo(350, 275); c.stroke();
      txt(c, '된장찌개 + 냉면', w / 2, 340, 36, '#ffffff', 'center');
      txt(c, '서비스!', w / 2, 390, 40, '#a8f0c0', 'center');
      pig(c, 110, 500, 46);
      txt(c, '어서 오세요~', 270, 512, 30, '#ffe9a8', 'center');
    });
    A.add('outMenu', 400, 560, (c, w, h) => {
      c.fillStyle = '#f4ead8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#7a2a1e'; c.fillRect(0, 0, w, 92);
      txt(c, '메 뉴', w / 2, 66, 54, '#fff3dc', 'center');
      menu.slice(0, 8).forEach(([n, p], i) => {
        const y = 140 + i * 52;
        txt(c, n, 34, y, 34, '#2b1a10');
        c.fillStyle = '#c7b89c'; for (let k = 190; k < 260; k += 10) c.fillRect(k, y - 10, 5, 3);
        txt(c, p, w - 30, y, 30, '#a3261c', 'right');
      });
    });
    A.add('noren', 512, 300, (c, w, h) => {
      c.fillStyle = '#26324a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      c.fillStyle = '#f3ead8'; c.beginPath(); c.arc(w / 2, 140, 80, 0, PI * 2); c.fill();
      txt(c, '주방', w / 2, 168, 76, '#26324a', 'center');
      c.fillStyle = '#1a2335'; c.fillRect(w / 2 - 3, 40, 6, h);
    });
    A.add('license', 220, 160, (c, w, h) => { c.fillStyle = '#fbf6e8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b8964a'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12); txt(c, '영업 신고증', w / 2, 52, 26, '#3a2a1a', 'center'); for (let i = 0; i < 4; i++) { c.fillStyle = '#a9a090'; c.fillRect(30, 76 + i * 18, 160 - i * 20, 4); } c.fillStyle = '#c0392b'; c.beginPath(); c.arc(170, 126, 14, 0, PI * 2); c.fill(); });
    A.add('cardOk', 240, 90, (c, w, h) => { rr(c, 0, 0, w, h, 12, '#ffffff'); txt(c, '카드 결제 OK', w / 2, 58, 34, '#1d3557', 'center'); });
    A.add('tickets', 300, 90, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) { const x = 6 + i * 74; c.fillStyle = '#fffdf3'; c.fillRect(x, 4, 64, 82); c.fillStyle = '#555'; for (let k = 0; k < 5; k++) c.fillRect(x + 8, 16 + k * 13, 30 + ((i * 7 + k * 11) % 20), 3); txt(c, `${i + 3}번`, x + 32, 80, 14, '#b02a1e', 'center'); }
    });
    A.add('hours', 300, 160, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#3b2618'); txt(c, '영업 시간', w / 2, 52, 34, '#f4e2c0', 'center'); txt(c, '11:30 ~ 22:00', w / 2, 102, 34, '#ffffff', 'center'); txt(c, '매주 월요일 휴무', w / 2, 140, 22, '#d9a35a', 'center'); });
    A.add('apronPrint', 128, 128, (c, w, h) => { c.fillStyle = '#9b2a22'; c.fillRect(0, 0, w, h); c.fillStyle = '#f3e6cc'; c.beginPath(); c.arc(64, 60, 30, 0, PI * 2); c.fill(); txt(c, '맛', 64, 74, 36, '#9b2a22', 'center'); });
    A.build();
    A.mat = A.printed(0.7);

    /* -------- glow (signs, lanterns, screens) */
    G.add('sign', 1000, 200, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const flame = (cx, by, hh, ww, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(cx, by); c.bezierCurveTo(cx - ww, by - 4, cx - ww * 0.9, by - hh * 0.55, cx - ww * 0.15, by - hh); c.bezierCurveTo(cx - ww * 0.05, by - hh * 0.6, cx + ww * 0.35, by - hh * 0.75, cx + ww * 0.3, by - hh * 0.45); c.bezierCurveTo(cx + ww * 0.6, by - hh * 0.55, cx + ww, by - hh * 0.3, cx + ww * 0.8, by - 10); c.bezierCurveTo(cx + ww * 0.6, by, cx + ww * 0.3, by + 2, cx, by); c.fill(); };
      flame(84, 178, 160, 62, '#ff5a2a'); flame(86, 176, 112, 44, '#ff9a3a'); flame(88, 174, 64, 26, '#ffe08a');
      txt(c, '맛있는 고깃집', 560, 150, 138, '#fff4dc', 'center');
    });
    G.add('blade', 150, 440, (c, w, h) => {
      c.fillStyle = '#b3261e'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#ffd08a'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
      vText(c, '숯불구이', w / 2, 100, 78, '#fff6e6', 92);
    });
    G.add('open', 300, 110, (c, w, h) => {
      c.fillStyle = '#1b1416'; c.fillRect(0, 0, w, h);
      c.shadowColor = '#ff4d6d'; c.shadowBlur = 16;
      txt(c, '영업중', w / 2, 78, 64, '#ff8fa3', 'center');
      c.shadowBlur = 0;
    });
    G.add('pos', 160, 110, (c, w, h) => { c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, w, h); c.fillStyle = '#b3261e'; c.fillRect(0, 0, w, 20); for (let i = 0; i < 6; i++) rr(c, 8 + (i % 3) * 50, 28 + Math.floor(i / 3) * 40, 44, 34, 4, ['#f4a261', '#e9c46a', '#2a9d8f'][i % 3]); });
    G.add('tv', 384, 216, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a8a3a'); g.addColorStop(1, '#3f6e2a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c9925a'; c.beginPath(); c.moveTo(w / 2, 70); c.lineTo(w / 2 + 110, 150); c.lineTo(w / 2, 230); c.lineTo(w / 2 - 110, 150); c.fill();
      c.fillStyle = '#4f7f34'; c.beginPath(); c.moveTo(w / 2, 100); c.lineTo(w / 2 + 70, 150); c.lineTo(w / 2, 200); c.lineTo(w / 2 - 70, 150); c.fill();
      c.fillStyle = '#ffffff'; for (const [x, y] of [[w / 2, 104], [w / 2 + 104, 150], [w / 2 - 104, 150], [w / 2, 200]]) c.fillRect(x - 5, y - 5, 10, 10);
      rr(c, 10, 10, 190, 40, 6, 'rgba(10,20,40,0.85)'); txt(c, '서울 3 : 2 부산', 105, 39, 22, '#ffffff', 'center');
      txt(c, '9회말', w - 16, 36, 20, '#ffe08a', 'right');
    });
    G.add('self', 380, 100, (c, w, h) => { c.fillStyle = '#2b1d14'; c.fillRect(0, 0, w, h); txt(c, '셀프바', 120, 66, 52, '#ffd27a', 'center'); txt(c, '반찬 리필 무료', 290, 62, 26, '#f4e2c0', 'center'); });
    G.add('drink', 300, 70, (c, w, h) => { c.fillStyle = '#c62828'; c.fillRect(0, 0, w, h); txt(c, '시원한 음료', w / 2, 50, 38, '#ffffff', 'center'); });
    G.add('uv', 96, 96, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9a7bff'); g.addColorStop(1, '#4a2fb0'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const skin = (bg, ink, ch) => (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg[0]); g.addColorStop(0.5, bg[1]); g.addColorStop(1, bg[0]);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(80,40,20,0.35)'; c.lineWidth = 2;
      for (let i = 1; i < 9; i++) { c.beginPath(); c.moveTo(0, (i * h) / 9); c.lineTo(w, (i * h) / 9); c.stroke(); }
      for (const u of [0.25, 0.75]) txt(c, ch, u * w, h * 0.62, h * 0.36, ink, 'center');
    };
    G.add('lanternC', 256, 256, skin(['#f0d8a8', '#fff3d6'], '#b3261e', '고기'));
    G.add('lanternR', 256, 256, skin(['#b8231c', '#e8452f'], '#ffe6a0', '복'));
    G.build();
    G.mat = G.lit(1.0);
    G.signMat = G.lit(2.4, 0xffffff); G.signMat.name = 'restSignGlow';
    G.lanternMat = G.lit(1.9, 0xffffff); G.lanternMat.name = 'restLanternGlow';
    // lantern geometries (lathe UVs kept, mapped into the atlas)
    const prof = [[0.05, 0], [0.11, 0.04], [0.155, 0.11], [0.17, 0.19], [0.155, 0.27], [0.11, 0.34], [0.05, 0.38]].map(([r, y]) => new THREE.Vector2(r, y));
    G.lanternGeo = { C: G.mapUV(prep(new THREE.LatheGeometry(prof, 18), true), 'lanternC'), R: G.mapUV(prep(new THREE.LatheGeometry(prof, 18), true), 'lanternR') };
    return { A, G };
  });
}

/* ------------------------------------------------------------------ props */
/** Paper lantern hanging from y = top (cord from `hookY`), body 0.38 tall. */
function lantern(g, G, x, top, z, kind = 'C', hookY = top + 0.4) {
  const l = put(g, G.lanternGeo[kind], G.lanternMat, x, top - 0.4, z);
  l.castShadow = false;
  V(g, CY(0.055, 0.055, 0.035, 14), 0x3a2216, x, top - 0.005, z);
  V(g, CY(0.055, 0.055, 0.03, 14), 0x3a2216, x, top - 0.405, z);
  V(g, CY(0.004, 0.004, hookY - top, 5), 0x2a1a10, x, (hookY + top) / 2, z);
  V(g, CY(0.012, 0.03, 0.14, 8), kind === 'C' ? 0xb3261e : 0xffc14d, x, top - 0.49, z, 0, 0, 0, vcSoft());
}

function bowl(g, x, y, z, r, food, fill = 0.7, kind = null, R = Math.random) {
  put(g, lathe([[0, 0], [r * 0.6, 0], [r, r * 0.7], [r * 0.95, r * 0.72], [r * 0.55, r * 0.07], [0, r * 0.07]], 16), mat('ceramic'), x, y, z);
  if (food == null) return;
  const fy = y + r * 0.7 * fill, fr = r * (0.55 + fill * 0.38);
  V(g, CY(fr, fr, 0.004, 14), food, x, fy, z);
  const at = () => { const a = R() * PI * 2, d = Math.sqrt(R()) * fr * 0.7; return [x + Math.cos(a) * d, z + Math.sin(a) * d]; };
  if (kind === 'kimchi' || kind === 'spinach') {
    for (let i = 0; i < 6; i++) {
      const [px, pz] = at();
      const l = leafGeo(r * 0.85, r * 0.38, 0.15, 0.35, 3);
      l.rotateX(-0.25 - R() * 0.3); l.rotateY(R() * PI * 2); l.translate(px, fy + 0.002, pz);
      put(g, tint(l, kind === 'kimchi' ? (i % 3 ? 0xd8452a : 0xf0c890) : (i % 2 ? 0x3f6e2a : 0x557f33)), vcLeaf());
    }
  } else if (kind === 'sprouts') {
    for (let i = 0; i < 8; i++) { const [px, pz] = at(), ry = R() * PI; V(g, CY(0.0025, 0.0025, r * 0.9, 4), 0xf3ecc8, px, fy + 0.004, pz, 0, ry, PI / 2); V(g, SP(0.006, 6, 4), 0xe9cf5a, px + Math.cos(ry) * r * 0.45, fy + 0.005, pz - Math.sin(ry) * r * 0.45); }
  } else if (kind === 'cubes') {
    for (let i = 0; i < 6; i++) { const [px, pz] = at(); V(g, RB(0.017, 0.017, 0.017, 0.004, 1), 0xe0603a, px, fy + 0.008, pz, R(), R(), R()); }
  } else if (kind === 'paste') {
    V(g, CY(0.006, fr * 0.7, 0.016, 12), food, x, fy + 0.008, z);
    for (let i = 0; i < 4; i++) { const [px, pz] = at(); V(g, SP(0.004, 5, 4), i % 2 ? 0x6fae3c : 0xf3ead2, px, fy + 0.012, pz); }
  } else if (kind === 'strips') {
    for (let i = 0; i < 6; i++) { const [px, pz] = at(); V(g, RB(r * 0.8, 0.004, 0.012, 0.002, 1), i % 3 ? 0xd9a441 : 0xe8c06a, px, fy + 0.004 + i * 0.002, pz, 0, R() * PI, 0); }
  }
}
const BANCHAN = [[0xc8402a, 'kimchi'], [0xe9d88a, 'sprouts'], [0xd8583a, 'cubes'], [0x3f6e2a, 'spinach'], [0x8a5a2e, 'paste'], [0xc9a24a, 'strips']];

function lettuceBasket(g, x, y, z, R) {
  const b = group(g, x, y, z, R() * PI);
  V(b, lathe([[0, 0], [0.07, 0], [0.1, 0.055], [0.095, 0.06], [0.066, 0.008], [0, 0.008]], 18), 0xb58a52);
  for (let k = 0; k < 2; k++) V(b, torus(0.083 + k * 0.012, 0.004, 4, 24), 0x8f6a3a, 0, 0.018 + k * 0.026, 0, PI / 2, 0, 0);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, col = i % 3 === 0 ? 0x355f2a : i % 2 ? 0x8cc04b : 0x6fa83c;
    const l = leafGeo(0.11, 0.06, 0.5, 0.28);
    l.rotateX(-(0.7 + R() * 0.5)); l.rotateY(a); l.translate(Math.sin(a) * 0.02, 0.03, Math.cos(a) * 0.02);
    put(b, tint(l, col), vcLeaf());
  }
}
function tongsAndScissors(g, x, y, z, ry) {
  const t = group(g, x, y, z, ry);
  V(t, RB(0.27, 0.006, 0.075, 0.003, 1), 0x9ea2a7, 0, 0.003, 0, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) V(t, RB(0.23, 0.004, 0.011, 0.002, 1), 0xc4c7cb, -0.01, 0.011, -0.012 + s * 0.008, 0, s * 0.035, 0.03, vcGloss());
  V(t, RB(0.02, 0.006, 0.028, 0.003, 1), 0xc4c7cb, -0.115, 0.014, -0.012, 0, 0, 0, vcGloss());
  const sc = group(t, 0.03, 0.009, 0.022, 0.15);
  for (const s of [-1, 1]) {
    V(sc, RB(0.1, 0.003, 0.01, 0.002, 1), 0xd0d3d6, 0.045, s * 0.002, s * 0.004, 0, s * 0.1, 0, vcGloss());
    V(sc, torus(0.012, 0.0035, 4, 10), 0x26272b, -0.025, s * 0.002, s * 0.014, PI / 2, 0, 0);
  }
}
function sodaBottle(g, x, y, z, kind) {
  const b = group(g, x, y, z, 0);
  if (kind === 'cola') {
    V(b, lathe([[0, 0], [0.032, 0], [0.034, 0.01], [0.031, 0.06], [0.034, 0.11], [0.034, 0.15], [0.02, 0.2], [0.012, 0.22], [0, 0.22]], 16), 0x2a120d, 0, 0, 0, 0, 0, 0, vcGloss());
    V(b, CY(0.0352, 0.0352, 0.045, 16, true), 0xc8202a, 0, 0.125, 0);
    V(b, CY(0.013, 0.013, 0.018, 10), 0xc8202a, 0, 0.226, 0);
  } else {
    V(b, lathe([[0, 0], [0.04, 0], [0.042, 0.012], [0.042, 0.19], [0.03, 0.24], [0.014, 0.27], [0, 0.27]], 16), 0x7fc79a, 0, 0, 0, 0, 0, 0, vcGloss());
    V(b, CY(0.0432, 0.0432, 0.06, 16, true), 0x1e7a46, 0, 0.12, 0);
    V(b, CY(0.0434, 0.0434, 0.014, 16, true), 0xf5f5f0, 0, 0.12, 0);
    V(b, CY(0.015, 0.015, 0.02, 10), 0x1e7a46, 0, 0.278, 0);
  }
  return b;
}
function steelCup(g, x, y, z) {
  put(g, lathe([[0, 0], [0.03, 0], [0.036, 0.085], [0.033, 0.086], [0.028, 0.006], [0, 0.006]], 16), mat('steel'), x, y, z);
}
function meatStrips(g, x, y, z, ry, n, R, cooked = false) {
  for (let i = 0; i < n; i++) {
    const s = group(g, x + (i - (n - 1) / 2) * 0.045, y, z + (R() - 0.5) * 0.02, ry + (R() - 0.5) * 0.15);
    V(s, RB(0.035, 0.012, 0.16, 0.005, 1), cooked ? 0xb8794a : 0xe58f8a, 0, 0.006, 0);
    V(s, box(0.0355, 0.0125, 0.012), cooked ? 0xe2c08a : 0xfbefe6, 0, 0.006, -0.03);
    V(s, box(0.0355, 0.0125, 0.008), cooked ? 0xe2c08a : 0xfbefe6, 0, 0.006, 0.035);
  }
}
function meatPlate(g, x, y, z, ry, R) {
  const p = group(g, x, y, z, ry);
  V(p, RB(0.26, 0.02, 0.18, 0.008, 1), 0x6b4a2e);
  meatStrips(p, 0, 0.02, 0, PI / 2, 4, R);
  for (let i = 0; i < 4; i++) V(p, CY(0.012, 0.012, 0.006, 10), 0xf3ead2, -0.09 + i * 0.024, 0.024, 0.065);
  V(p, leafGeo(0.06, 0.02, 0.2, 0.3), 0x5f9a3a, 0.09, 0.023, 0.06, 0, 1.2, 0, vcLeaf());
}

/** Round BBQ table: drum base, oak top, charcoal grill, hood + duct, 4 stools, table clutter. Returns grate top y (world). */
function bbqTable(g, site, M, A, G, tx, tz, o) {
  const R = rng(o.seed * 17 + 3);
  const T = group(g, tx, FY, tz, 0);
  // base + top
  put(T, CY(0.33, 0.36, 0.68, 28), M.dsteel, 0, 0.34, 0);
  for (const y of [0.06, 0.62]) V(T, torus(0.348, 0.012, 6, 32), 0x1e1f22, 0, y, 0, PI / 2, 0, 0);
  put(T, lathe([[0.25, 0.685], [0.6, 0.685], [0.622, 0.7], [0.622, 0.725], [0.6, 0.74], [0.25, 0.74], [0.25, 0.685]], 40), M.oak);
  put(T, lathe([[0.245, 0.7], [0.275, 0.735], [0.29, 0.745], [0.255, 0.746], [0.245, 0.74]], 32), M.steel);
  // grill bowl, charcoal, embers, grate
  put(T, lathe([[0, 0.6], [0.2, 0.6], [0.24, 0.69], [0.252, 0.745], [0.236, 0.744], [0.225, 0.69], [0.19, 0.62], [0, 0.62]], 28), M.dsteel);
  for (let i = 0; i < 16; i++) { const a = i * 2.39996, d = Math.sqrt((i + 0.5) / 16) * 0.18; V(T, RB(0.06, 0.04, 0.05, 0.01, 1), R() < 0.5 ? 0x1b1918 : 0x2e2925, Math.cos(a) * d, 0.665 + R() * 0.02, Math.sin(a) * d, R() * 0.6, R() * 3, R() * 0.6); }
  for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, d = 0.03 + R() * 0.15; D(T, RB(0.045, 0.03, 0.04, 0.01, 1), M.ember, Math.cos(a) * d, 0.672 + R() * 0.01, Math.sin(a) * d, R() * 0.5, R() * 3, R() * 0.5); }
  V(T, torus(0.215, 0.008, 6, 36), 0x8d9095, 0, 0.775, 0, PI / 2, 0, 0, vcGloss());
  for (let i = -4; i <= 4; i++) { const zz = i * 0.045, len = 2 * Math.sqrt(0.215 * 0.215 - zz * zz); V(T, CY(0.0045, 0.0045, len, 6), 0x9ea1a6, 0, 0.775, zz, 0, 0, PI / 2, vcGloss()); }
  for (let i = 0; i < 3; i++) { const a = i * 2.094; V(T, box(0.03, 0.03, 0.012), 0x8d9095, Math.cos(a) * 0.235, 0.757, Math.sin(a) * 0.235, 0, -a, 0); }
  const grateTop = FY + 0.775 + 0.0085;
  // hood + duct
  const hb = 1.75, ct = CEIL - FY;
  put(T, lathe([[0.3, hb], [0.31, hb + 0.02], [0.13, hb + 0.27], [0.105, hb + 0.29], [0.1, hb + 0.27], [0.115, hb + 0.25], [0.29, hb + 0.02], [0.288, hb]], 32), M.steel);
  put(T, CY(0.1, 0.1, ct - hb - 0.27, 20, true), M.steel, 0, (ct + hb + 0.27) / 2, 0);
  put(T, CY(0.108, 0.108, 0.05, 20), M.steel, 0, hb + 0.6, 0);
  put(T, CY(0.16, 0.16, 0.025, 20), M.dsteel, 0, ct - 0.012, 0);
  V(T, torus(0.3, 0.008, 6, 32), 0x2a2b2e, 0, hb + 0.005, 0, PI / 2, 0, 0);
  solid(site, tx, 0.45, tz, 1.2, 0.9, 1.2);
  // stools
  SEATS.forEach(([dx, dz]) => {
    const s = group(T, dx + (R() - 0.5) * 0.06, 0, dz + (R() - 0.5) * 0.06, R() * PI);
    put(s, CY(0.165, 0.175, 0.4, 20), M.timber, 0, 0.2, 0);
    for (const y of [0.05, 0.36]) V(s, torus(0.172, 0.008, 5, 24), 0x2a1a10, 0, y, 0, PI / 2, 0, 0);
    V(s, CY(0.175, 0.175, 0.06, 20), o.seed % 2 ? 0x7b2c2a : 0x8a3a24, 0, 0.43, 0, 0, 0, 0, vcSoft());
  });
  // per seat: side plate, dipping dish, steel cup
  SEATS.forEach(([dx, dz, yaw], i) => {
    const a = Math.atan2(dz, dx), r = 0.46;
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    put(T, lathe([[0, 0], [0.06, 0], [0.075, 0.016], [0.071, 0.017], [0.055, 0.005], [0, 0.005]], 18), mat('ceramic'), px, 0.74, pz);
    const sa = a + 0.38, sx = Math.cos(sa) * 0.47, sz = Math.sin(sa) * 0.47;
    put(T, lathe([[0, 0], [0.032, 0], [0.04, 0.014], [0.037, 0.015], [0.028, 0.004], [0, 0.004]], 14), mat('ceramic'), sx, 0.74, sz);
    V(T, CY(0.026, 0.026, 0.003, 12), i % 2 ? 0x8a5a2e : 0xd9c27a, sx, 0.752, sz);
    const ca = a - 0.42;
    steelCup(T, Math.cos(ca) * 0.5, 0.74, Math.sin(ca) * 0.5);
    // chopsticks + spoon on a rest
    const cs = group(T, Math.cos(a - 0.2) * 0.4, 0.742, Math.sin(a - 0.2) * 0.4, -a + PI / 2);
    for (const off of [0, 0.012]) V(cs, box(0.005, 0.005, 0.2), 0xc9ccce, off - 0.05, 0.003, 0, 0, 0, 0, vcGloss());
    V(cs, box(0.02, 0.003, 0.16), 0xc9ccce, 0.03, 0.002, 0.01, 0, 0, 0, vcGloss());
    void yaw;
  });
  // clutter in the four free windows between the seats (angle a: 0 = +X, PI/2 = +Z)
  const ring = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const tang = (a) => -a - PI / 2;
  [[3.82, 0.42], [4.08, 0.42], [2.2, 0.53], [2.52, 0.53]].forEach(([a, r], i) => {
    const [col, kind] = BANCHAN[(i + o.seed) % BANCHAN.length];
    const [bx, bz] = ring(a, r);
    bowl(T, bx, 0.74, bz, 0.05, col, 0.75, kind, R);
  });
  { const [x, z] = ring(5.52, 0.39); lettuceBasket(T, x, 0.74, z, R); }
  { const [x, z] = ring(2.36, 0.37); tongsAndScissors(T, x, 0.742, z, tang(2.36)); }
  { const [x, z] = ring(3.86, 0.545); sodaBottle(T, x, 0.74, z, 'cola'); }
  { const [x, z] = ring(4.1, 0.54); sodaBottle(T, x, 0.74, z, 'cider'); }
  if (o.water) { const [x, z] = ring(5.3, 0.545); waterBottle(T, x, 0.74, z); }
  { const [x, z] = ring(5.8, 0.53); const tb = group(T, x, 0.74, z, tang(5.8)); V(tb, RB(0.2, 0.07, 0.11, 0.012, 1), 0xf3efe6); V(tb, box(0.07, 0.03, 0.035), 0xffffff, 0, 0.08, 0, 0, 0, 0.3, vcSoft()); }
  // food: our table waits with a raw plate, the others are already grilling
  { const [x, z] = ring(0.81, 0.45); meatPlate(T, x, 0.742, z, tang(0.81), R); }
  if (o.cooking) {
    meatStrips(T, 0.03, 0.784, -0.02, 0.2, 4, R, true);
    for (let i = 0; i < 4; i++) V(T, CY(0.018, 0.02, 0.012, 10), i % 2 ? 0xf3ead2 : 0x7a5a3a, -0.12 + i * 0.03, 0.79, 0.12);
  }
  if (o.apron) V(T, RB(0.3, 0.012, 0.22, 0.006, 1), 0x9b2a22, Math.cos(o.apron) * SEAT_R, 0.466, Math.sin(o.apron) * SEAT_R, 0, 0.4, 0, vcSoft());
  return grateTop;
}

/* ------------------------------------------------------------------ building */
function shell(site, g, M, A, G) {
  const { timber, plaster, stone } = M;
  const wall = (x0, x1, y0, y1, z0, z1, m = plaster, col = true) => {
    put(g, RB(x1 - x0, y1 - y0, z1 - z0, 0.01, 1), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (col) solid(site, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  };
  const post = (x, z, y1 = 3.35) => put(g, RB(0.24, y1 - FY, 0.24, 0.02, 1), timber, x, (FY + y1) / 2, z);
  // ground: pavers over the footprint, stone plinth + porch
  put(g, box(14, 0.03, 12), mat('pavers2'), 0, 0.015, 0);
  put(g, RB(12.7, 0.15, 9.9, 0.03, 2), stone, 0, 0.075, -0.05);
  solid(site, 0, 0.075, -0.05, 12.7, 0.15, 9.9);
  put(g, RB(2.2, 0.08, 0.45, 0.02, 1), stone, 3.8, 0.04, 5.12);
  // floors + ceiling
  put(g, plane(12.0, 6.4), M.floor, 0, FY + 0.001, 0.5);
  put(g, plane(3.6, 2.0), M.floor, 4.2, FY + 0.001, -3.7);
  put(g, plane(8.4, 1.8), mat('floorTile'), -1.8, FY + 0.001, -3.8);
  put(g, plane(12.0, 8.4).rotateX(PI), M.ceil, 0, CEIL, -0.5);
  for (const bx of [-4.5, -1.5, 1.5, 4.5]) put(g, RB(0.18, 0.24, 8.4, 0.02, 1), timber, bx, CEIL - 0.12, -0.5);
  for (const bz of [1.0, -1.6]) put(g, RB(12.0, 0.2, 0.16, 0.02, 1), timber, 0, CEIL - 0.1, bz);
  site.indoor.push(aabb(-6.0, 0, -4.7, 6.0, CEIL, 3.7));

  /* ---- front facade (z 3.7..3.9) */
  const posts = [-6.08, -3.0, 0.1, 2.8, 4.8, 6.08];
  for (const px of posts) post(px, 3.8);
  put(g, RB(12.64, 0.24, 0.3, 0.02, 1), timber, 0, 3.23, 3.8);
  const bays = [[-5.96, -3.12], [-2.88, -0.02], [0.22, 2.68]];
  for (const [a, b] of bays) {
    const w = b - a, cx = (a + b) / 2;
    wall(a, b, FY, 0.93, 3.7, 3.9, plaster, false);
    put(g, RB(w + 0.02, 0.08, 0.32, 0.01, 1), timber, cx, 0.97, 3.8);
    D(g, quad(w, 1.0), M.glass, cx, 1.51, 3.8);
    put(g, RB(w, 0.06, 0.12, 0.01, 1), timber, cx, 2.04, 3.8);
    for (const f of [1 / 3, 2 / 3]) put(g, RB(0.05, 1.04, 0.1, 0.01, 1), timber, a + w * f, 1.52, 3.8);
    // lattice transom with glowing paper
    put(g, plane(w, 0.46).rotateX(PI / 2), M.hanji, cx, 2.3, 3.76).castShadow = false;
    const n = Math.round(w / 0.12);
    for (let i = 1; i < n; i++) put(g, box(0.022, 0.46, 0.04), timber, a + (i * w) / n, 2.3, 3.82);
    for (const y of [2.18, 2.42]) put(g, box(w, 0.022, 0.04), timber, cx, y, 3.82);
    put(g, RB(w + 0.02, 0.12, 0.32, 0.01, 1), timber, cx, 2.59, 3.8);
    wall(a, b, 2.65, 3.11, 3.7, 3.9, plaster, false);
    put(g, box(w, 0.8, 0.02), M.oak, cx, 0.55, 3.69);
    solid(site, cx, 1.7, 3.8, w + 0.24, 3.1, 0.2);
  }
  // door bay: transom + door leaves (sliding, auto)
  {
    const a = 2.92, b = 4.68, w = b - a, cx = (a + b) / 2;
    put(g, RB(w + 0.02, 0.12, 0.32, 0.01, 1), timber, cx, 2.59, 3.8);
    put(g, plane(w, 0.42).rotateX(PI / 2), M.hanji, cx, 2.88, 3.76).castShadow = false;
    const n = 12;
    for (let i = 1; i < n; i++) put(g, box(0.022, 0.42, 0.04), timber, a + (i * w) / n, 2.88, 3.82);
    put(g, box(w, 0.022, 0.04), timber, cx, 2.88, 3.82);
    put(g, RB(w, 0.1, 0.3, 0.01, 1), timber, cx, 3.13, 3.8);
    put(g, RB(w, 0.02, 0.2, 0.005, 1), M.dsteel, cx, FY + 0.01, 3.8);
    for (const s of [-1, 1]) {
      const piv = group(g, cx + s * 0.44, FY, 3.6, 0);
      piv.userData.dynamic = true;
      const lw = 0.88, lh = 2.36;
      for (const e of [-1, 1]) put(piv, RB(0.07, lh, 0.05, 0.01, 1), timber, e * (lw / 2 - 0.035), lh / 2, 0);
      for (const y of [0.04, 0.88, 1.6, lh - 0.04]) put(piv, RB(lw, 0.07, 0.05, 0.01, 1), timber, 0, y, 0);
      put(piv, RB(lw - 0.1, 0.8, 0.03, 0.005, 1), M.oak, 0, 0.46, 0);
      D(piv, quad(lw - 0.1, 0.68), M.glass, 0, 1.24, 0);
      put(piv, plane(lw - 0.1, 0.68).rotateX(PI / 2), M.hanji, 0, 1.97, -0.01).castShadow = false;
      for (let i = 1; i < 6; i++) put(piv, box(0.018, 0.68, 0.035), timber, -lw / 2 + 0.05 + (i * (lw - 0.1)) / 6, 1.97, 0.0);
      for (const y of [1.86, 2.08]) put(piv, box(lw - 0.1, 0.018, 0.035), timber, 0, y, 0);
      put(piv, RB(0.04, 0.5, 0.04, 0.012, 1), M.dsteel, -s * (lw / 2 - 0.1), 1.1, 0.045);
      put(piv, RB(0.04, 0.5, 0.04, 0.012, 1), M.dsteel, -s * (lw / 2 - 0.1), 1.1, -0.045);
      if (s < 0) { const og = group(piv, 0, 1.45, 0.06, 0); V(og, CY(0.003, 0.003, 0.2, 4), 0x2a1a10, -0.1, 0.12, 0, 0, 0, 0.6); V(og, CY(0.003, 0.003, 0.2, 4), 0x2a1a10, 0.1, 0.12, 0, 0, 0, -0.6); put(og, RB(0.34, 0.13, 0.02, 0.008, 1), blackPl(), 0, 0, 0); D(og, G.quad('open', 0.32, 0.117), G.signMat, 0, 0, 0.011); }
      bake(piv);
      site.doors.push({ pivot: piv, openAngle: 0, slide: [s * 0.86, 0, 0], auto: true, collider: aabb(s < 0 ? a : cx, FY, 3.55, s < 0 ? cx : b, FY + lh, 3.65) });
    }
  }
  for (const px of [-6.08, -3.0, 0.1, 2.8, 4.8, 6.08]) {
    const sc = group(g, px, 1.95, 3.98, 0);
    put(sc, RB(0.05, 0.12, 0.1, 0.01, 1), timber, 0, 0.12, -0.03);
    put(sc, RB(0.17, 0.03, 0.17, 0.008, 1), timber, 0, 0.13, 0.05);
    put(sc, RB(0.15, 0.025, 0.15, 0.008, 1), timber, 0, -0.1, 0.05);
    put(sc, RB(0.13, 0.2, 0.13, 0.01, 1), M.hanji, 0, 0.015, 0.05).castShadow = false;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(sc, box(0.014, 0.2, 0.014), timber, sx * 0.065, 0.015, 0.05 + sz * 0.065);
  }
  // narrow bay right of the door, with the outdoor menu
  wall(4.92, 5.96, FY, 3.11, 3.7, 3.9);
  const om = group(g, 5.44, 1.45, 3.9, 0);
  put(om, RB(0.5, 0.68, 0.03, 0.008, 1), timber, 0, 0, 0.015);
  D(om, A.quad('outMenu', 0.44, 0.616), A.mat, 0, 0, 0.0305);
  D(g, A.quad('hours', 0.36, 0.192), A.mat, 5.44, 0.82, 3.902);
  solid(site, -1.6, 1.7, 3.8, 9.2, 3.1, 0.2);

  /* ---- side walls (x = +-6.0..6.2) with one window each */
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -6.2 : 6.0, x1 = sx < 0 ? -6.0 : 6.2, xc = sx * 6.1;
    for (const pz of [-4.78, -0.5]) post(sx * 6.08, pz);
    put(g, RB(0.3, 0.24, 8.84, 0.02, 1), timber, xc, 3.23, -0.5);
    wall(x0, x1, FY, 3.11, -4.9, 0.8);
    wall(x0, x1, FY, 0.93, 0.8, 2.6);
    wall(x0, x1, 2.35, 3.11, 0.8, 2.6);
    wall(x0, x1, FY, 3.11, 2.6, 3.9);
    solid(site, xc, 1.6, 1.7, 0.2, 2.0, 1.8);
    D(g, quad(1.8, 1.4), M.glass, xc, 1.64, 1.7, 0, PI / 2, 0);
    put(g, RB(0.32, 0.08, 1.84, 0.01, 1), timber, xc, 0.97, 1.7);
    put(g, RB(0.32, 0.1, 1.84, 0.01, 1), timber, xc, 2.32, 1.7);
    for (const f of [0.6, 1.2]) put(g, RB(0.1, 1.36, 0.05, 0.01, 1), timber, xc, 1.64, 0.8 + f * 1.0);
    for (const pz of [0.8, 2.6]) put(g, RB(0.3, 2.3, 0.1, 0.01, 1), timber, xc, 1.25, pz);
    // horizontal timber band at sill height on the plaster (half-timber look)
    put(g, box(0.02, 0.1, 5.6), timber, sx * 6.21, 0.97, -2.1);
    put(g, box(0.02, 0.1, 5.6), timber, sx * 6.21, 2.32, -2.1);
  }
  /* ---- back wall + gables */
  wall(-6.2, 6.2, FY, 3.11, -4.9, -4.7);
  put(g, RB(12.64, 0.24, 0.3, 0.02, 1), timber, 0, 3.23, -4.8);
  for (const px of [-3.0, 2.5]) post(px, -4.8);
  put(g, box(12.0, 0.1, 0.02), timber, 0, 0.97, -4.915);
  put(g, box(12.0, 0.1, 0.02), timber, 0, 2.32, -4.915);
  // back door (static) + kitchen window
  const bd = group(g, -4.3, FY, -4.9, PI);
  put(bd, RB(1.0, 2.2, 0.06, 0.01, 1), M.oak, 0, 1.1, 0.02);
  put(bd, RB(1.16, 0.08, 0.1, 0.01, 1), timber, 0, 2.24, 0.02);
  put(bd, RB(0.03, 0.12, 0.04, 0.01, 1), M.dsteel, 0.38, 1.0, 0.07);
  D(g, quad(1.2, 0.6), M.glass, -1.2, 2.0, -4.92, 0, PI, 0);
  put(g, RB(1.3, 0.08, 0.12, 0.01, 1), timber, -1.2, 1.68, -4.93);
  const shape = new THREE.Shape();
  shape.moveTo(-4.9, 3.3); shape.lineTo(3.9, 3.3); shape.lineTo(RIDGE_Z, RIDGE_Y - 0.2); shape.closePath();
  for (const sx of [-1, 1]) {
    put(g, extrude(shape, 0.2), plaster, sx > 0 ? 6.2 : -6.0, 0, 0, 0, -PI / 2, 0);
    put(g, RB(0.24, RIDGE_Y - 0.3 - 3.35, 0.22, 0.02, 1), timber, sx * 6.1, (RIDGE_Y - 0.3 + 3.35) / 2, RIDGE_Z);
    for (const s of [1, -1]) {
      const zE = s > 0 ? 3.9 : -4.9, L = Math.abs(zE - RIDGE_Z) / Math.cos(TH);
      put(g, RB(0.24, 0.16, L, 0.02, 1), timber, sx * 6.1, (roofY(zE) + RIDGE_Y) / 2 - 0.36, (zE + RIDGE_Z) / 2, s * TH, 0, 0);
    }
    // round vent in the gable
    V(g, torus(0.2, 0.03, 6, 20), 0x3a2416, sx * 6.22, 4.55, RIDGE_Z, 0, PI / 2, 0);
    V(g, CY(0.19, 0.19, 0.02, 20), 0x2b2320, sx * 6.205, 4.55, RIDGE_Z, 0, 0, PI / 2);
    for (let i = -2; i <= 2; i++) V(g, box(0.02, 0.36, 0.025), 0x3a2416, sx * 6.225, 4.55, RIDGE_Z + i * 0.07);
  }

  /* ---- roof */
  const t = 0.16;
  for (const s of [1, -1]) {
    const zE = s > 0 ? 4.9 : -5.9, run = Math.abs(zE - RIDGE_Z), L = run / Math.cos(TH);
    const mz = (zE + RIDGE_Z) / 2, my = (roofY(zE) + RIDGE_Y) / 2, nY = Math.cos(TH), nZ = s * Math.sin(TH);
    put(g, RB(13.5, t, L + 0.04, 0.03, 1), M.tile, 0, my - nY * t / 2, mz - nZ * t / 2, s * TH, 0, 0);
    put(g, RB(13.5, 0.03, L, 0.005, 1), M.oak, 0, my - nY * (t + 0.015), mz - nZ * (t + 0.015), s * TH, 0, 0);
    // tile ridges running down the slope
    for (let x = -6.6; x <= 6.61; x += 0.33) V(g, CY(0.035, 0.035, L, 6), 0x2f3237, x, my + nY * 0.01, mz + nZ * 0.01, s > 0 ? PI / 2 + TH : -(PI / 2 + TH), 0, 0, vcGloss());
    // eave fascia + gutter line of round end tiles
    const ey = roofY(zE), ez = zE;
    put(g, RB(13.52, 0.2, 0.06, 0.01, 1), M.timber, 0, ey - 0.17, ez + s * 0.01, s * TH, 0, 0);
    for (let x = -6.6; x <= 6.61; x += 0.33) V(g, CY(0.05, 0.05, 0.03, 12), 0x2b2e33, x, ey - 0.03, ez + s * 0.03, PI / 2, 0, 0, vcGloss());
    // painted rafter tails under the eave
    const zw = s > 0 ? 3.9 : -4.9, zt = s > 0 ? 4.92 : -5.92;
    const rl = Math.abs(zt - zw) / Math.cos(TH), rz = (zw + zt) / 2, ryy = (roofY(zw) + roofY(zt)) / 2 - (t + 0.03) / nY - 0.06;
    const rot = s > 0 ? PI / 2 + TH : -(PI / 2 + TH);
    for (let x = -6.45; x <= 6.46; x += 0.43) {
      put(g, CY(0.055, 0.055, rl, 10), M.timber, x, ryy, rz, rot, 0, 0);
      const ty = roofY(zt) - (t + 0.03) / nY - 0.06;
      V(g, CY(0.057, 0.057, 0.012, 12), 0x2f7f74, x, ty - 0.003, zt + s * 0.002, rot, 0, 0);
      V(g, CY(0.025, 0.025, 0.014, 10), 0xd9482f, x, ty - 0.003, zt + s * 0.003, rot, 0, 0);
    }
    // ridge
  }
  put(g, RB(13.7, 0.26, 0.44, 0.08, 2), M.tile, 0, RIDGE_Y + 0.05, RIDGE_Z);
  put(g, RB(13.72, 0.06, 0.3, 0.02, 1), whitePl(), 0, RIDGE_Y - 0.06, RIDGE_Z);
  for (const sx of [-1, 1]) put(g, RB(0.34, 0.46, 0.5, 0.08, 2), M.tile, sx * 6.78, RIDGE_Y + 0.14, RIDGE_Z, 0, 0, sx * 0.25);
  // bargeboards on the gable edges
  for (const sx of [-1, 1]) for (const s of [1, -1]) {
    const zE = s > 0 ? 4.9 : -5.9, L = Math.abs(zE - RIDGE_Z) / Math.cos(TH);
    put(g, RB(0.07, 0.28, L, 0.01, 1), M.timber, sx * 6.77, (roofY(zE) + RIDGE_Y) / 2 - 0.12, (zE + RIDGE_Z) / 2, s * TH, 0, 0);
  }
  // vent pipes on the back slope (grill exhaust)
  for (const vx of [-3.9, 0.3]) {
    const vz = -2.6, vy = roofY(vz);
    put(g, CY(0.13, 0.13, 0.9, 16), M.steel, vx, vy + 0.4, vz);
    put(g, CY(0.24, 0.2, 0.12, 16), M.steel, vx, vy + 0.92, vz);
    put(g, CY(0.05, 0.05, 0.1, 10), M.steel, vx, vy + 1.02, vz);
  }
}

function interior(site, g, M, A, G) {
  const { timber, plaster, oak } = M;
  const F = FY;
  const wall = (x0, x1, y0, y1, z0, z1, m = plaster) => {
    put(g, RB(x1 - x0, y1 - y0, z1 - z0, 0.01, 1), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    solid(site, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  };
  // interior posts at the side walls and wainscot all round
  for (const pz of [-2.7]) for (const sx of [-1, 1]) put(g, RB(0.2, CEIL - F, 0.2, 0.02, 1), timber, sx * 5.92, (F + CEIL) / 2, pz);
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [[-2.7, 0.8], [2.6, 3.7]]) put(g, box(0.02, 0.85, z1 - z0), oak, sx * 5.99, F + 0.425, (z0 + z1) / 2);
    put(g, box(0.02, 0.8, 1.8), oak, sx * 5.99, F + 0.4, 1.7);
    put(g, RB(0.04, 0.04, 6.4, 0.01, 1), timber, sx * 5.98, F + 0.87, 0.5);
  }
  put(g, box(3.4, 0.85, 0.02), oak, 4.3, F + 0.425, -4.69);

  /* ---- kitchen partition (z -2.9..-2.7) with the pass window and the kitchen door */
  const z0 = -2.9, z1 = -2.7;
  wall(-6.0, -4.6, F, CEIL, z0, z1);
  wall(-4.6, -1.2, F, 1.15, z0, z1);
  wall(-4.6, -1.2, 2.2, CEIL, z0, z1);
  wall(-1.2, 0.4, F, CEIL, z0, z1);
  wall(0.4, 1.4, 2.3, CEIL, z0, z1);
  wall(1.4, 2.6, F, CEIL, z0, z1);
  wall(2.4, 2.6, F, CEIL, -4.7, z0);
  solid(site, 0.9, 1.2, -2.8, 1.0, 2.2, 0.2); // staff only
  for (const [a, b] of [[-6.0, -4.6], [-1.2, 0.4], [1.4, 2.6]]) put(g, box(b - a, 0.85, 0.02), oak, (a + b) / 2, F + 0.425, z1 + 0.01);
  for (const px of [-4.66, -1.14, 0.34, 1.46]) put(g, RB(0.14, CEIL - F, 0.26, 0.02, 1), timber, px, (F + CEIL) / 2, -2.8);
  put(g, RB(3.6, 0.14, 0.28, 0.02, 1), timber, -2.9, 2.27, -2.8);
  // noren curtain in the kitchen door
  for (const s of [-1, 1]) D(g, A.mapSub(quad(0.48, 0.75), 'noren', s < 0 ? 0 : 0.5, s < 0 ? 0.5 : 1), A.mat, 0.9 + s * 0.245, 1.9, -2.69, 0.04, 0, -s * 0.02);
  put(g, CY(0.015, 0.015, 1.1, 8), timber, 0.9, 2.28, -2.69, 0, 0, PI / 2);
  // pass counter + plates waiting
  const pc = group(g, -2.9, F, -2.45, 0);
  put(pc, RB(3.6, 0.98, 0.44, 0.015, 2), oak, 0, 0.49, 0);
  for (let i = 0; i < 9; i++) put(pc, box(0.02, 0.9, 0.01), timber, -1.6 + i * 0.4, 0.47, 0.222);
  put(pc, RB(3.8, 0.06, 0.62, 0.015, 2), timber, 0, 1.0, -0.06);
  const R = rng(91);
  meatPlate(pc, -1.2, 1.03, -0.1, 0.2, R);
  meatPlate(pc, -0.75, 1.03, -0.15, -0.1, R);
  for (let i = 0; i < 5; i++) { const [col, kind] = BANCHAN[i]; bowl(pc, -0.1 + i * 0.16, 1.03, -0.12 + (i % 2) * 0.12, 0.05, col, 0.75, kind, R); }
  put(pc, lathe([[0, 0], [0.11, 0], [0.12, 0.05], [0.115, 0.06], [0.09, 0.012], [0, 0.012]], 20), mat('ceramic'), 0.9, 1.03, -0.12);
  V(pc, CY(0.1, 0.1, 0.01, 18), 0xc7883e, 0.9, 1.075, -0.12);
  const bell = group(pc, 1.45, 1.03, 0.1, 0);
  put(bell, CY(0.045, 0.05, 0.015, 14), M.dsteel, 0, 0.008, 0);
  put(bell, lathe([[0, 0.045], [0.02, 0.043], [0.04, 0.025], [0.045, 0.0], [0, 0]], 16), M.steel, 0, 0.015, 0);
  put(g, CY(0.006, 0.006, 3.3, 6), M.steel, -2.9, 2.12, -2.66, 0, 0, PI / 2);
  D(g, A.quad('tickets', 0.6, 0.18), A.mat, -3.6, 2.02, -2.655);
  D(g, A.quad('tickets', 0.45, 0.135), A.mat, -2.0, 2.04, -2.655, 0, 0, 0.03);
  solid(site, -2.9, 0.55, -2.45, 3.8, 1.1, 0.62);
  // big menu board above the pass
  const mb = group(g, -2.9, 2.72, -2.69, 0);
  put(mb, RB(3.5, 0.86, 0.05, 0.01, 1), timber, 0, 0, 0.025);
  D(mb, A.quad('menuBig', 3.4, 0.8), A.mat, 0, 0, 0.051);
  // kitchen backdrop (seen through the pass and the door)
  put(g, box(8.4, 2.0, 0.02), mat('wallTile'), -1.8, F + 1.0, -4.69);
  const kc = group(g, -1.8, F, -4.35, 0);
  put(kc, RB(8.2, 0.9, 0.62, 0.01, 1), M.steel, 0, 0.45, 0);
  put(kc, RB(2.4, 0.5, 0.7, 0.02, 1), M.steel, -1.6, 2.35, 0.05);
  for (const [px, r, h] of [[-2.4, 0.22, 0.45], [-1.5, 0.18, 0.3], [-0.9, 0.2, 0.2], [0.6, 0.17, 0.32], [2.3, 0.2, 0.4]]) {
    put(kc, lathe([[0, 0], [r, 0], [r, h], [r * 0.95, h], [r * 0.95, 0.01], [0, 0.01]], 20), M.steel, px, 0.9, 0);
    put(kc, CY(r * 1.02, r * 1.02, 0.02, 20), M.dsteel, px, 0.9 + h + 0.01, 0);
  }
  put(kc, RB(8.0, 0.03, 0.3, 0.01, 1), M.steel, 0, 1.65, -0.15);
  for (let i = 0; i < 22; i++) put(kc, CY(0.08, 0.06, 0.05, 14), mat('ceramic'), -3.8 + i * 0.36, 1.69 + (i % 3) * 0.05, -0.15);
  for (let i = 0; i < 8; i++) V(kc, RB(0.32, 0.26, 0.26, 0.02, 1), [0xd9532f, 0xf3efe4, 0x6b8f3a, 0xe8d18a][i % 4], 1.6 + (i % 4) * 0.36, 2.0 + Math.floor(i / 4) * 0.3, -0.12, 0, 0, 0, vcGloss());
  D(g, box(3.0, 0.02, 0.15), mat('lampGlow'), -2.6, CEIL - 0.02, -3.8);

  /* ---- self bar + soda fridge + cup sterilizer (back right) */
  const sb = group(g, 3.85, F, -4.35, 0);
  put(sb, RB(2.0, 0.88, 0.62, 0.015, 2), oak, 0, 0.44, 0);
  put(sb, RB(2.1, 0.05, 0.68, 0.012, 1), M.steel, 0, 0.9, 0.0);
  const Rs = rng(31);
  for (let i = 0; i < 6; i++) {
    const cx = -0.78 + (i % 3) * 0.38, cz = i < 3 ? -0.1 : 0.14;
    put(sb, RB(0.36, 0.08, 0.2, 0.01, 1), M.steel, cx, 0.93, cz);
    const [col, kind] = BANCHAN[i];
    V(sb, RB(0.32, 0.02, 0.17, 0.008, 1), col, cx, 0.965, cz);
    for (let k = 0; k < 9; k++) {
      const px = cx + (Rs() - 0.5) * 0.26, pz = cz + (Rs() - 0.5) * 0.12;
      if (kind === 'cubes') V(sb, RB(0.018, 0.018, 0.018, 0.004, 1), 0xe0603a, px, 0.983, pz, Rs(), Rs(), 0);
      else if (kind === 'paste') { if (k < 2) V(sb, CY(0.01, 0.06, 0.02, 12), col, cx + (k - 0.5) * 0.12, 0.985, cz); }
      else V(sb, RB(0.05, 0.008, 0.016, 0.004, 1), kind === 'kimchi' ? (k % 3 ? 0xd8452a : 0xf0c890) : kind === 'sprouts' ? 0xf3ecc8 : col, px, 0.98, pz, 0, Rs() * 3, 0.15);
    }
  }
  lettuceBasket(sb, 0.33, 0.925, 0.13, Rs);
  D(sb, quad(1.25, 0.3), M.glass, -0.4, 1.25, 0.3, -0.4, 0, 0);
  for (const sx of [-1.0, 0.2]) put(sb, CY(0.008, 0.008, 0.36, 6), M.steel, sx, 1.1, 0.22);
  for (let i = 0; i < 7; i++) put(sb, CY(0.08, 0.06, 0.016, 16), mat('ceramic'), 0.33, 0.93 + i * 0.017, -0.13);
  const sign = group(g, 3.85, 2.25, -4.69, 0);
  put(sign, RB(1.4, 0.4, 0.04, 0.01, 1), timber, 0, 0, 0.02);
  D(sign, G.quad('self', 1.33, 0.35), G.mat, 0, 0, 0.041);
  solid(site, 3.85, 0.5, -4.35, 2.1, 1.0, 0.7);
  const fr = group(g, 5.45, F, -4.32, 0);
  for (const sx of [-1, 1]) put(fr, RB(0.06, 1.95, 0.7, 0.015, 1), whitePl(), sx * 0.42, 0.975, 0);
  put(fr, RB(0.9, 0.24, 0.7, 0.015, 1), whitePl(), 0, 1.83, 0);
  put(fr, RB(0.9, 0.22, 0.7, 0.015, 1), whitePl(), 0, 0.11, 0);
  put(fr, box(0.8, 1.75, 0.03), whitePl(), 0, 0.975, -0.335);
  D(fr, box(0.76, 1.48, 0.02), M.fridgeGlow, 0, 0.98, -0.31);
  for (let s = 0; s < 4; s++) {
    put(fr, box(0.76, 0.015, 0.55), M.steel, 0, 0.32 + s * 0.38, 0.0);
    for (let i = 0; i < 6; i++) sodaBottle(fr, -0.3 + i * 0.12, 0.33 + s * 0.38, -0.05 + (i % 2) * 0.12, (s + i) % 3 === 0 ? 'cola' : 'cider');
  }
  D(fr, quad(0.8, 1.5), M.glass, 0, 0.97, 0.33);
  for (const sx of [-1, 1]) put(fr, RB(0.04, 1.5, 0.04, 0.01, 1), M.dsteel, sx * 0.39, 0.97, 0.34);
  D(fr, G.quad('drink', 0.8, 0.187), G.mat, 0, 1.84, 0.352);
  put(fr, RB(0.03, 0.5, 0.04, 0.01, 1), M.steel, -0.36, 1.0, 0.39);
  solid(site, 5.45, 1.0, -4.32, 0.9, 2.0, 0.7);
  const uv = group(g, 4.57, F + 0.925, -4.45, 0);
  put(uv, RB(0.42, 0.04, 0.36, 0.01, 1), whitePl(), 0, 0.02, 0);
  put(uv, RB(0.42, 0.04, 0.36, 0.01, 1), whitePl(), 0, 0.5, 0);
  for (const sx of [-1, 1]) put(uv, RB(0.03, 0.5, 0.36, 0.01, 1), whitePl(), sx * 0.195, 0.26, 0);
  put(uv, box(0.38, 0.46, 0.02), whitePl(), 0, 0.26, -0.17);
  D(uv, G.quad('uv', 0.36, 0.44), G.mat, 0, 0.26, -0.158);
  put(uv, box(0.36, 0.01, 0.3), M.steel, 0, 0.26, 0);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) steelCup(uv, -0.12 + i * 0.08, 0.04 + k * 0.225, 0.03);
  D(uv, quad(0.36, 0.44), M.glass, 0, 0.26, 0.182);

  /* ---- cashier counter near the door (right wall) */
  const cc = group(g, 5.3, F, 1.7, -PI / 2);
  put(cc, RB(1.6, 1.0, 0.55, 0.015, 2), timber, 0, 0.5, 0);
  for (let i = 0; i < 7; i++) put(cc, box(0.02, 0.86, 0.01), oak, -0.72 + i * 0.24, 0.5, 0.276);
  put(cc, RB(1.7, 0.05, 0.65, 0.012, 1), oak, 0, 1.02, -0.03);
  const pos = group(cc, -0.3, 1.045, -0.05, PI);
  put(pos, RB(0.14, 0.03, 0.12, 0.008, 1), blackPl(), 0, 0.015, 0);
  put(pos, RB(0.05, 0.16, 0.03, 0.008, 1), blackPl(), 0, 0.1, -0.02);
  const scr = group(pos, 0, 0.22, 0.0, 0); scr.rotation.x = -0.2;
  put(scr, RB(0.34, 0.24, 0.025, 0.01, 1), blackPl(), 0, 0, 0);
  D(scr, G.quad('pos', 0.31, 0.213), G.mat, 0, 0, 0.0135);
  put(cc, RB(0.09, 0.03, 0.17, 0.01, 1), blackPl(), 0.15, 1.06, 0.12);
  V(cc, lathe([[0, 0], [0.07, 0], [0.11, 0.06], [0.105, 0.065], [0.065, 0.01], [0, 0.01]], 18), 0xb58a52, 0.45, 1.045, 0.1);
  for (let i = 0; i < 8; i++) V(cc, SP(0.014, 8, 6), [0xffffff, 0x9fe0c0, 0xffd1dc][i % 3], 0.45 + Math.cos(i * 2.3) * 0.04, 1.075 + (i % 2) * 0.012, 0.1 + Math.sin(i * 2.3) * 0.04);
  pottedPlant(cc, 0.68, 1.045, -0.1, { kind: 'herb', h: 0.2, potR: 0.05, potH: 0.09, pot: 0x3a3b3d, seed: 7 });
  V(cc, RB(0.3, 0.02, 0.22, 0.006, 1), 0x9b2a22, -0.65, 1.055, -0.05, 0, 0.1, 0, vcSoft());
  V(cc, RB(0.29, 0.02, 0.21, 0.006, 1), 0x9b2a22, -0.66, 1.075, -0.06, 0, -0.05, 0, vcSoft());
  solid(site, 5.3, 0.55, 1.7, 0.65, 1.1, 1.7);
  D(g, A.quad('license', 0.33, 0.24), A.mat, 5.985, 1.75, 1.4, 0, -PI / 2, 0);
  D(g, A.quad('cardOk', 0.3, 0.112), A.mat, 5.985, 1.45, 2.0, 0, -PI / 2, 0);

  /* ---- TV, coat rack, display shelf, plants, charcoal bucket */
  const tv = group(g, 5.97, 2.3, -1.3, -PI / 2);
  put(tv, RB(1.12, 0.66, 0.05, 0.01, 1), blackPl(), 0, 0, 0.025);
  D(tv, G.quad('tv', 1.06, 0.6), G.mat, 0, 0, 0.051);
  put(g, RB(0.08, 0.3, 0.08, 0.01, 1), blackPl(), 5.95, 2.6, -1.3);
  const cr = group(g, 5.5, F, 3.25, 0);
  put(cr, CY(0.2, 0.22, 0.03, 18), timber, 0, 0.015, 0);
  put(cr, CY(0.025, 0.025, 1.75, 10), timber, 0, 0.9, 0);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4; put(cr, CY(0.01, 0.01, 0.2, 6), M.dsteel, Math.cos(a) * 0.08, 1.68, Math.sin(a) * 0.08, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
  V(cr, RB(0.42, 0.85, 0.14, 0.06, 2), 0x2b3a55, 0.0, 1.2, 0.13, 0.08, 0, 0, vcSoft());
  V(cr, RB(0.3, 0.12, 0.16, 0.05, 2), 0x2b3a55, 0.0, 1.62, 0.12, 0, 0, 0, vcSoft());
  V(cr, RB(0.36, 0.7, 0.03, 0.01, 1), 0x9b2a22, -0.13, 1.28, -0.1, -0.05, 0, 0.12, vcSoft());
  V(cr, RB(0.36, 0.7, 0.03, 0.01, 1), 0x9b2a22, 0.12, 1.26, -0.12, -0.05, 0, -0.1, vcSoft());
  solid(site, 5.5, 0.9, 3.25, 0.45, 1.8, 0.45);
  // low display shelf dividing the entry from the dining room
  const ds = group(g, 2.0, F, -0.9, PI / 2);
  put(ds, RB(2.6, 0.06, 0.4, 0.015, 1), timber, 0, 0.9, 0);
  put(ds, RB(2.6, 0.06, 0.4, 0.015, 1), timber, 0, 0.45, 0);
  put(ds, RB(2.6, 0.06, 0.4, 0.015, 1), timber, 0, 0.04, 0);
  for (const sx of [-1.27, 0, 1.27]) put(ds, RB(0.06, 0.93, 0.4, 0.015, 1), timber, sx, 0.47, 0);
  for (let i = 0; i < 22; i++) put(ds, box(0.02, 0.5, 0.02), timber, -1.27 + (i + 1) * (2.54 / 23), 1.18, 0);
  put(ds, RB(2.6, 0.04, 0.06, 0.01, 1), timber, 0, 1.44, 0);
  const onggi = (p, x, y, z, s) => {
    V(p, lathe([[0, 0], [0.09 * s, 0], [0.16 * s, 0.1 * s], [0.18 * s, 0.2 * s], [0.14 * s, 0.32 * s], [0.1 * s, 0.35 * s], [0.1 * s, 0.37 * s], [0, 0.37 * s]], 20), 0x5a3220, x, y, z, 0, 0, 0, vcGloss());
    V(p, lathe([[0, 0.05 * s], [0.12 * s, 0.0], [0.13 * s, 0.015 * s], [0.03 * s, 0.07 * s], [0, 0.075 * s]], 18), 0x4a281a, x, y + 0.36 * s, z, 0, 0, 0, vcGloss());
  };
  onggi(ds, -0.85, 0.93, 0, 0.9); onggi(ds, -0.45, 0.93, 0.02, 0.7); onggi(ds, 0.7, 0.48, 0, 0.75);
  pottedPlant(ds, 0.6, 0.93, 0, { kind: 'snake', h: 0.45, potR: 0.08, potH: 0.12, pot: 0x5a3220, seed: 12 });
  for (let i = 0; i < 4; i++) V(ds, RB(0.28, 0.035, 0.22, 0.008, 1), 0x9b2a22, -0.75, 0.49 + i * 0.037, 0.0, 0, i * 0.06, 0, vcSoft());
  for (let i = 0; i < 6; i++) V(ds, lathe([[0, 0], [0.04, 0], [0.042, 0.12], [0.025, 0.15], [0.02, 0.17], [0, 0.17]], 12), [0x8a3a1a, 0x3b2a1a, 0xd9a441][i % 3], 0.1 + i * 0.09, 0.48, -0.05, 0, 0, 0, vcGloss());
  solid(site, 2.0, 0.75, -0.9, 0.4, 1.5, 2.6);
  pottedPlant(g, 5.55, F, -2.3, { kind: 'palm', h: 1.3, potR: 0.2, potH: 0.38, pot: 0x5a3220, seed: 23 });
  solid(site, 5.55, 0.5, -2.3, 0.4, 1.0, 0.4);
  pottedPlant(g, -5.5, F, -2.25, { kind: 'fig', h: 1.4, potR: 0.2, potH: 0.38, pot: 0x5a3220, seed: 24 });
  solid(site, -5.5, 0.5, -2.25, 0.4, 1.0, 0.4);
  const bucket = group(g, -0.25, F, -2.35, 0);
  put(bucket, lathe([[0, 0], [0.15, 0], [0.18, 0.28], [0.17, 0.29], [0.14, 0.02], [0, 0.02]], 18), M.dsteel);
  for (let i = 0; i < 11; i++) V(bucket, RB(0.07, 0.045, 0.06, 0.01, 1), i % 2 ? 0x1e1c1b : 0x2e2925, Math.cos(i * 2.4) * (0.03 + (i % 3) * 0.04), 0.25 + (i % 3) * 0.015, Math.sin(i * 2.4) * (0.03 + (i % 3) * 0.04), i * 0.3, i, 0.2);
  for (let i = 0; i < 4; i++) D(bucket, RB(0.045, 0.03, 0.04, 0.01, 1), M.ember, Math.cos(i * 1.7) * 0.06, 0.27, Math.sin(i * 1.7) * 0.06, 0.3, i, 0.2);
  put(bucket, torus(0.17, 0.008, 5, 16, PI), M.steel, 0, 0.29, 0, 0, 0, 0);
  solid(site, -0.25, 0.2, -2.35, 0.36, 0.4, 0.36);
  for (let i = 0; i < 3; i++) put(g, torus(0.21, 0.008, 6, 28), M.steel, -0.72, F + 0.01 + i * 0.016, -2.4, PI / 2, 0, 0);

  /* ---- walls: menu tags (left), posters */
  const tg = group(g, -5.985, 2.47, -0.95, PI / 2);
  put(tg, RB(3.3, 0.05, 0.05, 0.01, 1), timber, 0, 0.47, 0.025);
  D(tg, A.quad('tags', 3.2, 0.857), A.mat, 0, 0, 0.012);
  for (const [k, z, y] of [['posterPig', 3.15, 1.65], ['posterFire', -1.75, 1.45]]) {
    const pg = group(g, -5.985, y, z, PI / 2);
    put(pg, RB(0.62, 0.84, 0.03, 0.008, 1), timber, 0, 0, 0.015);
    D(pg, A.quad(k, 0.56, 0.778), A.mat, 0, 0, 0.031);
  }
  // aprons on wall hooks (left wall)
  for (let i = 0; i < 3; i++) {
    const hz = -0.25 + i * 0.36;
    put(g, CY(0.01, 0.01, 0.08, 6), M.dsteel, 5.95, 1.95, hz, 0, 0, PI / 2);
    D(g, A.quad('apronPrint', 0.2, 0.2), A.mat, 5.962, 1.62, hz, 0, -PI / 2, 0);
    V(g, RB(0.32, 0.6, 0.02, 0.01, 1), 0x9b2a22, 5.975, 1.64, hz, 0, PI / 2, 0, vcSoft());
  }
}

/* ------------------------------------------------------------------ exterior extras */
function frontage(site, g, M, A, G) {
  const { timber } = M;
  // main hanging sign (from the eave on chains)
  const sg = group(g, -1.45, 2.6, 4.42, 0);
  put(sg, RB(4.1, 0.74, 0.09, 0.02, 2), timber, 0, 0, 0);
  put(sg, RB(4.2, 0.06, 0.11, 0.02, 1), M.dsteel, 0, 0.39, 0);
  put(sg, RB(4.2, 0.06, 0.11, 0.02, 1), M.dsteel, 0, -0.39, 0);
  D(sg, G.quad('sign', 3.4, 0.68), G.signMat, 0.05, -0.01, 0.047);
  for (const cx of [-1.8, 1.8]) for (let i = 0; i < 4; i++) V(sg, torus(0.022, 0.005, 4, 10), 0x2a2b2e, cx, 0.45 + i * 0.035, 0, 0, i % 2 ? PI / 2 : 0, 0);
  // blade lightbox at the right corner
  const bl = group(g, 6.45, 2.25, 4.15, PI / 2);
  put(bl, RB(0.42, 1.24, 0.14, 0.02, 1), M.dsteel, 0, 0, 0);
  D(bl, G.quad('blade', 0.36, 1.06), G.signMat, 0, 0, 0.0705);
  D(bl, G.quad('blade', 0.36, 1.06), G.signMat, 0, 0, -0.0705, 0, PI, 0);
  put(g, RB(0.5, 0.05, 0.05, 0.01, 1), M.dsteel, 6.32, 2.9, 4.15);
  // porch lanterns under the eave
  for (const [lx, k] of [[-5.6, 'R'], [-4.75, 'C'], [1.45, 'C'], [2.6, 'R'], [5.0, 'R']]) lantern(g, G, lx, 2.5, 4.62, k, roofY(4.62) - 0.3);
  // A-frame board, bench, onggi jars, planters
  const af = group(g, 1.6, 0.03, 5.45, -0.25);
  for (const s of [1, -1]) {
    const leaf = group(af, 0, 0, s * 0.16, 0); leaf.rotation.x = s * 0.18;
    put(leaf, RB(0.56, 0.86, 0.04, 0.012, 1), timber, 0, 0.5, 0);
    D(leaf, A.quad('aframe', 0.46, 0.657), A.mat, 0, 0.52, s * 0.0205, 0, s > 0 ? 0 : PI, 0);
  }
  solid(site, 1.6, 0.45, 5.45, 0.6, 0.9, 0.5);
  const bn = group(g, -4.5, FY, 4.35, 0);
  for (let i = 0; i < 4; i++) put(bn, RB(1.6, 0.04, 0.09, 0.012, 1), M.oak, 0, 0.44, -0.15 + i * 0.1);
  for (const s of [-0.65, 0.65]) for (const t of [-0.14, 0.14]) put(bn, RB(0.07, 0.42, 0.07, 0.01, 1), timber, s, 0.21, t);
  solid(site, -4.5, 0.4, 4.35, 1.6, 0.6, 0.4);
  const jars = (x, z, s, ry) => {
    const j = group(g, x, 0.03, z, ry);
    V(j, lathe([[0, 0], [0.16 * s, 0], [0.28 * s, 0.18 * s], [0.3 * s, 0.34 * s], [0.24 * s, 0.52 * s], [0.17 * s, 0.57 * s], [0.17 * s, 0.6 * s], [0, 0.6 * s]], 24), 0x5a3220, 0, 0, 0, 0, 0, 0, vcGloss());
    V(j, lathe([[0, 0.08 * s], [0.2 * s, 0.0], [0.21 * s, 0.02 * s], [0.05 * s, 0.11 * s], [0, 0.12 * s]], 20), 0x4a281a, 0, 0.59 * s, 0, 0, 0, 0, vcGloss());
  };
  jars(-6.0, 5.4, 1.15, 0); jars(-5.35, 5.6, 0.85, 1); jars(-6.25, 4.85, 0.7, 2);
  solid(site, -5.8, 0.35, 5.3, 1.1, 0.7, 1.0);
  for (const px of [2.42, 5.18]) {
    put(g, RB(0.5, 0.42, 0.5, 0.03, 2), timber, px, FY + 0.21, 4.55);
    V(g, box(0.42, 0.02, 0.42), 0x3a2a1e, px, FY + 0.41, 4.55);
    shrub(g, px, FY + 0.38, 4.55, 0.27, px * 10 | 0, 6);
    solid(site, px, 0.4, 4.55, 0.5, 0.8, 0.5);
  }
  // charcoal sacks + AC unit at the right side, gas meter box
  const sk = group(g, 6.55, 0.03, -1.6, 0);
  for (let i = 0; i < 3; i++) V(sk, RB(0.36, 0.22, 0.55, 0.08, 2), i === 1 ? 0x8a6a45 : 0x7a5c3c, 0, 0.11 + i * 0.2, 0, 0, i * 0.2, 0, vcSoft());
  solid(site, 6.55, 0.35, -1.6, 0.5, 0.7, 0.6);
  const ac = group(g, 6.58, 0.03, -3.6, 0);
  put(ac, RB(0.36, 0.62, 0.8, 0.02, 2), whitePl(), 0, 0.31 + 0.05, 0);
  V(ac, CY(0.22, 0.22, 0.02, 24), 0x3a3d42, 0.18, 0.38, 0.05, 0, 0, PI / 2);
  for (let i = 0; i < 6; i++) V(ac, box(0.01, 0.4, 0.012), 0x9aa0a6, 0.19, 0.38, -0.12 + i * 0.07);
  solid(site, 6.58, 0.35, -3.6, 0.4, 0.7, 0.8);
  // back: shrubs in a strip
  for (let i = 0; i < 7; i++) shrub(g, -5.6 + i * 1.7, 0.03, -5.55, 0.3, 40 + i, i % 2 ? 4 : 0);
}

/* ------------------------------------------------------------------ entry point */
export function buildRestaurant() {
  const site = makeSite('restaurant', 14, 12);
  const g = site.group;
  const M = restMats();
  const { A, G } = restAtlas();
  shell(site, g, M, A, G);
  interior(site, g, M, A, G);
  frontage(site, g, M, A, G);
  // tables
  let grill = null;
  TABLES.forEach(([tx, tz], i) => {
    const top = bbqTable(g, site, M, A, G, tx, tz, { seed: i + 1, cooking: i !== OURS, raw: i === OURS, full: i === OURS, water: i % 2 === 0 || i === OURS, apron: i === 2 ? 1.2 : null });
    if (i === OURS) grill = { center: [tx, top, tz], radius: 0.2 };
    site.lamps.push({ pos: [tx, 2.65, tz + 0.5], color: 0xffc98a, intensity: 7, range: 6 });
  });
  // round paper ceiling lamps (flush), they keep the room glowing through the windows at night
  for (const [lx, lz] of [[-5.0, 3.0], [-2.6, 3.0], [0.9, 3.0], [3.0, 3.0], [5.0, 0.0], [-5.1, -1.1], [-2.6, -1.1], [0.95, -1.1], [3.6, -3.6]]) {
    put(g, CY(0.26, 0.26, 0.012, 24), M.timber, lx, CEIL - 0.006, lz);
    put(g, CY(0.22, 0.24, 0.08, 24), M.hanji, lx, CEIL - 0.05, lz).castShadow = false;
    D(g, CY(0.2, 0.2, 0.006, 24), mat('lampGlow'), lx, CEIL - 0.092, lz);
    V(g, torus(0.235, 0.006, 4, 24), 0x3a2216, lx, CEIL - 0.07, lz, PI / 2, 0, 0);
  }
  // lanterns over the aisles inside
  for (const [lx, lz, k] of [[-1.8, 2.1, 'C'], [-1.8, -0.55, 'C'], [-5.2, 0.8, 'R'], [3.6, 1.6, 'C'], [3.6, -2.0, 'R']]) lantern(g, G, lx, 2.55, lz, k, CEIL);
  // our table: player on the south (+Z) stool looking down at the grill
  const [ox, oz] = TABLES[OURS];
  const eye = [ox, FY + 0.46 + 0.78, oz + 0.66];
  const dy = eye[1] - grill.center[1], dz = eye[2] - oz;
  site.interactables.push({
    id: 'grill', label: '회식하기', pos: [ox, 1.25, oz + 0.75], radius: 1.4,
    seat: { pos: eye, yaw: 0, pitch: -Math.atan2(dy, dz) },
  });
  site.extra.grillTop = grill;
  site.extra.ourTable = { center: [ox, FY + 0.74, oz], seats: SEATS.map(([dx, dz2, yaw]) => ({ pos: [ox + dx, FY, oz + dz2], yaw })) };
  // colleagues at our table (W, N, E) + other customers
  for (const k of [1, 2, 3]) { const [dx, dz2, yaw] = SEATS[k]; site.npcSpots.push({ pos: [ox + dx, FY, oz + dz2], yaw, pose: 'sit', role: 'coworker' }); }
  for (const [ti, seats] of [[0, [0, 2]], [2, [1, 2, 3]], [3, [0, 3]]]) {
    const [tx, tz] = TABLES[ti];
    for (const k of seats) { const [dx, dz2, yaw] = SEATS[k]; site.npcSpots.push({ pos: [tx + dx, FY, tz + dz2], yaw, pose: 'sit', role: 'customer' }); }
  }
  site.lamps.push({ pos: [3.6, 2.6, 0.0], color: 0xffd9a8, intensity: 6, range: 6 });
  site.lamps.push({ pos: [-1.45, 2.3, 4.9], color: 0xffc98a, intensity: 6, range: 7 });
  site.lamps.push({ pos: [3.8, 2.4, 4.9], color: 0xffc98a, intensity: 5, range: 6 });
  site.nightGlow.push(G.signMat, G.lanternMat, M.hanji);
  site.spawn = { pos: [3.8, 0.03, 5.6], yaw: 0 };
  bake(g);
  return site;
}
