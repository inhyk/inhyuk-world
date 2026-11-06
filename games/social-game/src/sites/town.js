// Town storefronts that fill the streets: bakery, cafe, hospital, pharmacy, bookstore, toy shop.
// buildShop({kind}) → Site (see ../site.js), footprint 12 x 10, entrance faces +Z. The ground floor is a
// walk-in shop behind dressed shop windows and an automatic sliding door; its furniture is built lazily
// by site.extra.interior.build() (see buildInterior). Upper floors show lit rooms behind the glass.
import * as THREE from 'three';
import { mat, paint, textured } from '../mat.js';
import { box, cyl, quad, put, group, bake, torus, lathe, capsule } from '../geom.js';
import { FONT } from '../tex.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { bench } from '../props/street.js';
import { PI, RB, CY, SP, V, D, Atlas, txt, rr, pottedPlant, vcMat, vcGloss, vcSoft, cached, pendant, wallClock, staticDoor, officeChair, cafeChair, sofa, bookshelf, binders, mug, bottle, waterCooler } from './office.js';

const W = 11, F = 2.6, BZ = -4.7, G = 3.5, U = 3.0, CORE = 1.85;

const KINDS = {
  bakery: {
    floors: 2, wall: 'brick', ground: 'brick', trim: 0xf0e6d6, frame: 0x3b2f2a, door: 2.9, doorW: 1.2,
    awning: () => textured('stripes', { color: 0xb8432f, color2: 0xf3eadb, count: 4 }, 1.6, { normal: 0.5 }),
    name: '세온 베이커리', en: 'BAKERY', sub: '매일 아침 갓 구운 빵', bg: '#4a2f22', bg2: '#6a4430', fg: '#fff1d8', acc: '#f0b25a',
    wallC: '#f3e2c4', room: ['#f4e3c8', '#e9d7bd', '#f1dccb'], curtain: ['#c2563f', '#e8d2a6', '#7c9a6a'], bike: 0x6f9c8e, props: [['bench', -3.4], ['board', 1.3], ['bike', -1.0]],
  },
  cafe: {
    floors: 2, wall: 'plasterWarm', ground: 'walnut', trim: 0x2c3a33, frame: 0x24272a, door: -3.1, doorW: 1.2,
    awning: () => paint(0x2f5d4a, 0.85, 0, { sheen: 0.5 }),
    name: '카페 온', en: 'COFFEE', sub: '커피 · 디저트', bg: '#22332b', bg2: '#2f473b', fg: '#f5ecd9', acc: '#d9a464',
    wallC: '#e8dccb', room: ['#efe4d2', '#e4ecef', '#f3e6da'], curtain: ['#e9e2d2', '#9fb3a0', '#d7b58c'], bike: 0x2b2d31, props: [['bistro', 1.0], ['bistro', 3.6], ['board', -1.4]],
  },
  hospital: {
    floors: 3, wall: 'plaster', ground: 'plasterGray', trim: 0x5b7f9e, frame: 0xe9ecef, door: 0, doorW: 1.9,
    awning: null,
    name: '세온 병원', en: 'HOSPITAL', sub: '내과 · 소아청소년과', bg: '#ffffff', bg2: '#eef4fa', fg: '#1f5f9a', acc: '#e0383a',
    wallC: '#eef2f5', room: ['#e9f0f4', '#eef1ee', '#e7eef6'], curtain: ['#c9d8e6', '#dfe7ec', '#b9cfe0'], bike: 0x3d6fa8, props: [['bench', 3.4], ['bike', -3.5]],
  },
  pharmacy: {
    floors: 2, wall: 'sidingWhite', ground: 'plasterSage', trim: 0x2f8a5a, frame: 0x2a2d30, door: 3.2, doorW: 1.2,
    awning: () => paint(0x2f8a5a, 0.85, 0, { sheen: 0.5 }),
    name: '새봄 약국', en: 'PHARMACY', sub: '처방 조제 · 상담', bg: '#1f7a4d', bg2: '#2a9461', fg: '#ffffff', acc: '#d8f3c4',
    wallC: '#f2f5ef', room: ['#f1ece2', '#e6eef2', '#f4ead9'], curtain: ['#a9c79a', '#efe2c8', '#d98f6a'], bike: 0xd8584a, props: [['bike', -3.4], ['stand', 1.5]],
  },
  bookstore: {
    floors: 3, wall: 'brickDark', ground: 'walnut', trim: 0x1f2f4a, frame: 0x1c1f24, door: -2.6, doorW: 1.2,
    awning: () => textured('stripes', { color: 0x1f2f4a, color2: 0xece2cc, count: 4 }, 1.6, { normal: 0.5 }),
    name: '책방 한 페이지', en: 'BOOKS', sub: '새 책 · 헌 책 · 그림책', bg: '#1d2b45', bg2: '#2a3d60', fg: '#f3e3c3', acc: '#e6b85c',
    wallC: '#efe6d4', room: ['#efe1c9', '#e2e8e2', '#f2e8de'], curtain: ['#8c3b35', '#d8c79f', '#4e6a8a'], bike: 0xc9a33a, props: [['cart', 1.2], ['bench', 3.8], ['bike', -4.3]],
  },
  toy: {
    floors: 1, wall: 'plasterBlue', ground: 'plasterBlue', trim: 0xf2c14e, frame: 0xe0574a, door: 0, doorW: 1.3,
    awning: () => textured('stripes', { color: 0xf2c14e, color2: 0xe0574a, count: 5 }, 1.6, { normal: 0.5 }),
    name: '장난감 나라', en: 'TOYS', sub: '블록 · 인형 · 보드게임', bg: '#2f74c0', bg2: '#4a92dd', fg: '#ffffff', acc: '#ffd54d',
    wallC: '#fff3d6', room: ['#fff0d0'], curtain: ['#e0574a'], bike: 0xe0574a, props: [['bike', 3.4], ['balls', -2.2]],
  },
};
export const SHOP_KINDS = Object.keys(KINDS);

/* ------------------------------------------------------------------ canvas drawings */
function icon(c, kind, x, y, r, K) {
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'bakery') {
    c.fillStyle = K.acc; c.beginPath(); c.ellipse(x, y, r, r * 0.62, -0.2, 0, PI * 2); c.fill();
    c.strokeStyle = '#7a4a24'; c.lineWidth = r * 0.12;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * r * 0.45 - r * 0.15, y - r * 0.35); c.lineTo(x + i * r * 0.45 + r * 0.15, y + r * 0.3); c.stroke(); }
  } else if (kind === 'cafe') {
    c.fillStyle = K.fg; rr(c, x - r * 0.7, y - r * 0.35, r * 1.2, r * 0.95, r * 0.25, K.fg);
    c.strokeStyle = K.fg; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x + r * 0.55, y + 0.1 * r, r * 0.3, -PI / 2, PI / 2); c.stroke();
    c.strokeStyle = K.acc; c.lineWidth = r * 0.1;
    for (const dx of [-0.35, 0, 0.35]) { c.beginPath(); c.moveTo(x + dx * r - r * 0.1, y - r * 0.5); c.bezierCurveTo(x + dx * r + r * 0.15, y - r * 0.7, x + dx * r - r * 0.15, y - r * 0.85, x + dx * r + r * 0.05, y - r * 1.0); c.stroke(); }
  } else if (kind === 'hospital') {
    c.fillStyle = K.acc; c.fillRect(x - r * 0.3, y - r, r * 0.6, r * 2); c.fillRect(x - r, y - r * 0.3, r * 2, r * 0.6);
  } else if (kind === 'pharmacy') {
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, r, 0, PI * 2); c.fill();
    txt(c, '약', x, y + r * 0.05, r * 1.25, K.bg, 'center', 'middle');
  } else if (kind === 'bookstore') {
    c.fillStyle = K.fg;
    c.beginPath(); c.moveTo(x, y - r * 0.4); c.quadraticCurveTo(x - r * 0.5, y - r * 0.75, x - r, y - r * 0.5); c.lineTo(x - r, y + r * 0.6); c.quadraticCurveTo(x - r * 0.5, y + r * 0.35, x, y + r * 0.65); c.closePath(); c.fill();
    c.fillStyle = K.acc;
    c.beginPath(); c.moveTo(x, y - r * 0.4); c.quadraticCurveTo(x + r * 0.5, y - r * 0.75, x + r, y - r * 0.5); c.lineTo(x + r, y + r * 0.6); c.quadraticCurveTo(x + r * 0.5, y + r * 0.35, x, y + r * 0.65); c.closePath(); c.fill();
  } else {
    c.fillStyle = '#c88a4f';
    for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.62, y - r * 0.6, r * 0.34, 0, PI * 2); c.fill(); }
    c.beginPath(); c.arc(x, y, r * 0.8, 0, PI * 2); c.fill();
    c.fillStyle = '#f1d7b5'; c.beginPath(); c.ellipse(x, y + r * 0.25, r * 0.36, r * 0.27, 0, 0, PI * 2); c.fill();
    c.fillStyle = '#2b2018'; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.3, y - r * 0.12, r * 0.09, 0, PI * 2); c.fill(); }
    c.beginPath(); c.arc(x, y + r * 0.15, r * 0.1, 0, PI * 2); c.fill();
  }
  c.restore();
}

function shelfRows(c, w, h, R, kind, K) {
  const rows = 4, top = h * 0.12, rowH = (h * 0.8) / rows;
  for (let r = 0; r < rows; r++) {
    const y = top + (r + 1) * rowH;
    c.fillStyle = kind === 'hospital' ? '#cfd8df' : '#8a6444'; c.fillRect(w * 0.04, y - 6, w * 0.92, 7);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(w * 0.04, y + 1, w * 0.92, 5);
    let x = w * 0.06;
    while (x < w * 0.93) {
      if (kind === 'bookstore') {
        const bw = 6 + R() * 9, bh = rowH * (0.6 + R() * 0.3);
        c.fillStyle = ['#8c3b35', '#2f5d7c', '#d8b25a', '#3d6b4a', '#e9e1cf', '#5b3e6e', '#c76a3a', '#24364f'][(R() * 8) | 0];
        c.fillRect(x, y - 6 - bh, bw, bh); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + 1, y - 6 - bh * 0.8, bw - 2, 2);
        x += bw + 1;
      } else if (kind === 'pharmacy') {
        const bw = 12 + R() * 14, bh = rowH * (0.35 + R() * 0.35);
        c.fillStyle = ['#ffffff', '#e94e3c', '#3b8fd6', '#f3c14a', '#5fb36e', '#f7f2e8', '#9b6ad1'][(R() * 7) | 0];
        c.fillRect(x, y - 6 - bh, bw, bh); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x + bw - 2, y - 6 - bh, 2, bh);
        x += bw + 2;
      } else if (kind === 'toy') {
        const s = 14 + R() * 16;
        c.fillStyle = ['#e0574a', '#f2c14e', '#4a92dd', '#5fb36e', '#c88a4f', '#ff9ec4', '#9b6ad1'][(R() * 7) | 0];
        if (R() < 0.5) { c.beginPath(); c.arc(x + s / 2, y - 6 - s / 2, s / 2, 0, PI * 2); c.fill(); } else c.fillRect(x, y - 6 - s, s, s);
        x += s + 5;
      } else if (kind === 'hospital') {
        x = w; // clean shelves
      } else {
        const s = 16 + R() * 12;
        c.fillStyle = kind === 'cafe' ? ['#6b4a35', '#efe6d6', '#3a5a4a', '#c79a62'][(R() * 4) | 0] : ['#c98a4a', '#a8642d', '#e0b071', '#d79b5c'][(R() * 4) | 0];
        c.beginPath(); c.ellipse(x + s / 2, y - 6 - s * 0.32, s / 2, s * 0.32, 0, 0, PI * 2); c.fill();
        x += s + 4;
      }
    }
  }
}

function makeAtlas(kind, K) {
  const A = new Atlas(1024, 6);
  const R = rng(kind.length * 97 + 3);
  A.add('sign', 1000, 120, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, K.bg2); gr.addColorStop(1, K.bg);
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = K.fg; c.globalAlpha = 0.45; c.lineWidth = 3; c.strokeRect(9, 9, w - 18, h - 18); c.globalAlpha = 1;
    icon(c, kind, 92, h / 2, h * 0.3, K);
    txt(c, K.name, w * 0.47, h * 0.54, h * 0.56, K.fg, 'center', 'middle');
    txt(c, K.en, w - 44, h * 0.38, h * 0.2, K.acc, 'right', 'middle');
    txt(c, K.sub, w - 44, h * 0.68, h * 0.16, K.fg, 'right', 'middle');
  });
  A.add('blade', 120, 400, (c, w, h) => {
    c.fillStyle = K.bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = K.acc; c.lineWidth = 4; c.strokeRect(7, 7, w - 14, h - 14);
    icon(c, kind, w / 2, 62, 32, K);
    const chars = [...K.name.replace(/\s/g, '')].slice(0, 5);
    chars.forEach((ch, i) => txt(c, ch, w / 2, 130 + i * ((h - 150) / chars.length), 52, K.fg, 'center', 'top'));
  });
  for (let i = 0; i < 3; i++) {
    A.add('win' + i, 230, 170, (c, w, h) => {
      const col = K.room[i % K.room.length];
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.3, col); gr.addColorStop(1, '#a99a86');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const lamp = c.createRadialGradient(w * (0.3 + i * 0.2), h * 0.35, 4, w * (0.3 + i * 0.2), h * 0.35, w * 0.5);
      lamp.addColorStop(0, 'rgba(255,226,170,0.9)'); lamp.addColorStop(1, 'rgba(255,226,170,0)'); c.fillStyle = lamp; c.fillRect(0, 0, w, h);
      if (kind === 'hospital') {
        c.fillStyle = 'rgba(240,244,248,0.92)'; for (let y = 0; y < h * (0.45 + i * 0.1); y += 9) c.fillRect(0, y, w, 6);
        c.fillStyle = '#7fa7c7'; c.fillRect(w * 0.12, h * 0.75, w * 0.3, h * 0.25);
        return;
      }
      if (kind === 'toy') { c.fillStyle = '#5fb36e'; c.fillRect(0, h * 0.7, w, h * 0.3); }
      // picture frame, shelf, plant, curtains
      c.fillStyle = '#5a4636'; c.fillRect(w * 0.42, h * 0.22, w * 0.18, h * 0.2); c.fillStyle = ['#7fb0c9', '#e3b26a', '#94b67a'][i]; c.fillRect(w * 0.44, h * 0.24, w * 0.14, h * 0.16);
      c.fillStyle = '#7a5a40'; c.fillRect(w * 0.62, h * 0.58, w * 0.3, h * 0.42); c.fillStyle = '#e9dcc2'; c.fillRect(w * 0.64, h * 0.62, w * 0.12, h * 0.12);
      c.fillStyle = '#3f6b3a'; for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(w * 0.22 + Math.sin(k * 2.4) * 12, h * 0.55 - k * 6, 9, 5, k, 0, PI * 2); c.fill(); }
      c.fillStyle = '#b4623e'; c.fillRect(w * 0.17, h * 0.62, 22, 26);
      const cur = K.curtain[i % K.curtain.length];
      c.fillStyle = cur; c.fillRect(0, 0, w * 0.17, h); c.fillRect(w * 0.83, 0, w * 0.17, h);
      c.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 4; k++) { c.fillRect(k * w * 0.045, 0, 3, h); c.fillRect(w * 0.83 + k * w * 0.045, 0, 3, h); }
    });
  }
  A.add('poster', 150, 210, (c, w, h) => {
    c.fillStyle = '#fbf6ec'; c.fillRect(0, 0, w, h);
    c.fillStyle = K.bg; c.fillRect(0, 0, w, 54);
    const head = { bakery: '오늘의 빵', cafe: '시즌 라떼', hospital: '독감 예방접종', pharmacy: '건강 상담', bookstore: '이달의 책', toy: '새 장난감' }[kind];
    const line = { bakery: '소금빵 2,500원', cafe: '아메리카노 3,000원', hospital: '10월~12월', pharmacy: '친절한 약사', bookstore: '그림책 할인', toy: '블록 세트 입고' }[kind];
    txt(c, head, w / 2, 30, 22, K.fg, 'center', 'middle');
    icon(c, kind, w / 2, 110, 34, K);
    txt(c, line, w / 2, 178, 17, '#3a3330', 'center', 'middle');
  });
  A.add('menu', 150, 220, (c, w, h) => {
    c.fillStyle = '#26302b'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a07c55'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    txt(c, kind === 'bakery' ? '오늘의 빵' : '오늘의 메뉴', w / 2, 32, 21, '#f5ecd9', 'center', 'middle');
    const items = kind === 'bakery' ? ['소금빵', '크루아상', '단팥빵', '식빵'] : ['아메리카노', '카페라떼', '딸기라떼', '치즈케이크'];
    items.forEach((s, i) => { txt(c, s, 16, 66 + i * 34, 16, '#e9e2d2', 'left', 'middle'); c.fillStyle = '#d9a464'; c.beginPath(); c.arc(w - 22, 66 + i * 34, 4, 0, PI * 2); c.fill(); });
  });
  A.add('open', 120, 44, (c, w, h) => {
    rr(c, 2, 2, w - 4, h - 4, 10, '#2b2d31', K.acc, 3);
    txt(c, kind === 'hospital' ? '진료중' : '영업중', w / 2, h / 2 + 1, 24, '#ffe9a8', 'center', 'middle');
  });
  A.add('hours', 200, 60, (c, w, h) => {
    txt(c, K.en, w / 2, 18, 18, '#ffffff', 'center', 'middle');
    txt(c, kind === 'hospital' ? '평일 09:00 - 18:00' : '매일 09:00 - 21:00', w / 2, 44, 15, '#ffffff', 'center', 'middle');
  });
  A.build();
  return A;
}

/* ------------------------------------------------------------------ small helpers */
const _up = new THREE.Vector3(0, 1, 0);
function rod(p, a, b, r, hex, m = vcMat()) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const o = V(p, CY(r, r, d.length(), 8), hex, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, 0, 0, 0, m);
  o.quaternion.setFromUnitVectors(_up, d.normalize());
  return o;
}

function bike(p, x, z, ry, col, basket) {
  const g = group(p, x, 0, z, ry);
  for (const s of [-1, 1]) {
    V(g, torus(0.32, 0.024, 6, 28), 0x1d1e20, s * 0.52, 0.34, 0);
    V(g, torus(0.29, 0.01, 4, 28), 0xc9ced3, s * 0.52, 0.34, 0, 0, 0, 0, vcGloss());
    V(g, CY(0.025, 0.025, 0.07, 10), 0xb9bec4, s * 0.52, 0.34, 0, PI / 2);
    for (let k = 0; k < 6; k++) { const a = k * PI / 6; rod(g, [s * 0.52 - Math.cos(a) * 0.28, 0.34 - Math.sin(a) * 0.28, 0], [s * 0.52 + Math.cos(a) * 0.28, 0.34 + Math.sin(a) * 0.28, 0], 0.003, 0xd0d4d8); }
  }
  const P = { r: [-0.52, 0.34, 0], bb: [-0.05, 0.3, 0], s: [-0.17, 0.8, 0], h: [0.36, 0.84, 0], hl: [0.4, 0.68, 0], f: [0.52, 0.34, 0] };
  for (const [a, b, r] of [['r', 'bb', 0.016], ['r', 's', 0.013], ['bb', 's', 0.02], ['s', 'h', 0.02], ['bb', 'hl', 0.024], ['h', 'hl', 0.024], ['hl', 'f', 0.016]]) rod(g, P[a], P[b], r, col, vcGloss());
  rod(g, [-0.17, 0.8, 0], [-0.19, 0.9, 0], 0.012, 0x9aa0a6);
  V(g, RB(0.24, 0.05, 0.13, 0.02, 2), 0x2a2420, -0.2, 0.93, 0, 0, 0, 0, vcSoft());
  rod(g, [0.36, 0.84, 0], [0.33, 0.97, 0], 0.014, 0x9aa0a6);
  rod(g, [0.33, 0.97, -0.24], [0.33, 0.97, 0.24], 0.012, 0x9aa0a6, vcGloss());
  for (const s of [-1, 1]) V(g, CY(0.017, 0.017, 0.1, 8), 0x2a2420, 0.33, 0.97, s * 0.22, PI / 2);
  V(g, CY(0.08, 0.08, 0.02, 16), 0x3a3b3d, -0.05, 0.3, 0.03, PI / 2);
  rod(g, [-0.05, 0.3, -0.03], [-0.12, 0.02, -0.12], 0.008, 0x55585c);
  if (basket) {
    V(g, RB(0.32, 0.2, 0.3, 0.03, 2), 0xb08a5a, 0.62, 0.88, 0, 0, 0, 0, vcSoft());
    V(g, SP(0.07, 10, 7), 0xc98a4a, 0.6, 1.0, 0.05).scale.set(1.5, 0.8, 1);
  }
  rod(g, [-0.62, 0.62, 0], [-0.4, 0.62, 0], 0.01, 0x9aa0a6);
  V(g, RB(0.3, 0.02, 0.14, 0.006, 1), 0x2b2d31, -0.5, 0.63, 0);
  return g;
}

/* ------------------------------------------------------------------ window dressing per kind */
function dress(kind, g, x0, x1, R, K) {
  const y0 = 0.57, zb = 1.9, zf = 2.42, cx = (x0 + x1) / 2, bw = x1 - x0;
  const shelf = (y, d = 0.3, col = 0x9a7350) => { V(g, RB(bw - 0.2, 0.035, d, 0.01, 1), col, cx, y, zb + d / 2); for (const s of [-1, 1]) V(g, RB(0.03, 0.05, d * 0.8, 0.008, 1), 0x3a3b3d, cx + s * (bw / 2 - 0.4), y - 0.04, zb + d * 0.4); };
  if (kind === 'bakery') {
    for (const y of [1.15, 1.65]) {
      shelf(y);
      for (let x = x0 + 0.25; x < x1 - 0.25; x += 0.27) {
        const m = V(g, SP(0.1, 10, 7), [0xc98a4a, 0xa8642d, 0xe0b071, 0xb87a3e][(R() * 4) | 0], x, y + 0.06, zb + 0.15, 0, R() * PI, 0, vcGloss());
        m.scale.set(1.25, 0.62, 0.85);
      }
    }
    // cake stands and a baguette basket on the front podium
    for (const [dx, col] of [[-0.35, 0xf6d7de], [0.3, 0xf7efe2]]) {
      const x = cx + dx * bw * 0.5;
      V(g, lathe([[0, 0], [0.07, 0], [0.04, 0.02], [0.03, 0.2], [0.2, 0.22], [0.2, 0.24], [0, 0.24]], 20), 0xf4f3ef, x, y0, 2.2, 0, 0, 0, vcGloss());
      V(g, CY(0.15, 0.15, 0.13, 24), col, x, y0 + 0.31, 2.2, 0, 0, 0, vcGloss());
      V(g, CY(0.1, 0.1, 0.09, 20), 0xfff8f0, x, y0 + 0.42, 2.2, 0, 0, 0, vcGloss());
      for (let k = 0; k < 6; k++) V(g, SP(0.022, 8, 6), 0xd8323a, x + Math.cos(k) * 0.08, y0 + 0.475, 2.2 + Math.sin(k) * 0.08, 0, 0, 0, vcGloss());
    }
    V(g, CY(0.16, 0.12, 0.18, 16), 0xb08a5a, cx, y0 + 0.09, 2.15, 0, 0, 0, vcSoft());
    for (let k = 0; k < 5; k++) V(g, capsule(0.03, 0.5, 4, 8), 0xd39a55, cx - 0.06 + k * 0.03, y0 + 0.35, 2.15, 0.2 * (k - 2) * 0.3, 0, (k - 2) * 0.12, vcGloss());
  } else if (kind === 'cafe') {
    V(g, RB(bw - 0.1, 0.05, 0.36, 0.015, 2), 0x6b4529, cx, 1.05, 2.25);
    for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.75) {
      V(g, CY(0.17, 0.17, 0.04, 20), 0x2b2d31, x, 0.74, 2.0);
      V(g, CY(0.02, 0.02, 0.17, 8), 0x2b2d31, x, 0.65, 2.0);
      V(g, lathe([[0, 0], [0.035, 0], [0.04, 0.09], [0.036, 0.095], [0.034, 0.012], [0, 0.012]], 14), [0xf4f3ef, 0xe7b9a3, 0x9fb3a0][(R() * 3) | 0], x + 0.1, 1.075, 2.28, 0, 0, 0, vcGloss());
    }
    for (const y of [1.6, 2.0]) {
      shelf(y, 0.22, 0x6b4529);
      for (let x = x0 + 0.3; x < x1 - 0.3; x += 0.22) V(g, CY(0.05, 0.05, 0.16 + R() * 0.06, 12), [0x3a2a1e, 0xd9c6a2, 0x6f8a6a, 0xefe6d6][(R() * 4) | 0], x, y + 0.1, zb + 0.11, 0, 0, 0, vcGloss());
    }
    pottedPlant(g, x1 - 0.35, y0, 2.2, { kind: 'bush', h: 0.5, seed: 4, pot: 'terracotta', potR: 0.12, potH: 0.2 });
    for (let x = x0 + 0.7; x < x1 - 0.4; x += 1.4) {
      V(g, CY(0.004, 0.004, 0.35, 4), 0x222222, x, 2.45, 2.15);
      V(g, lathe([[0.01, 0.16], [0.13, 0.04], [0.14, 0], [0.12, 0.0], [0.01, 0.14]], 18), 0xd9a464, x, 2.12, 2.15, 0, 0, 0, vcGloss());
      D(g, CY(0.1, 0.1, 0.005, 16), mat('lampGlow'), x, 2.135, 2.15);
    }
  } else if (kind === 'hospital') {
    for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.55) {
      V(g, RB(0.46, 0.06, 0.42, 0.03, 2), 0x5a8fc0, x, 0.98, 2.1, 0, 0, 0, vcGloss());
      V(g, RB(0.46, 0.42, 0.06, 0.03, 2), 0x5a8fc0, x, 1.2, 1.92, 0, 0, 0, vcGloss());
      V(g, RB(0.04, 0.4, 0.04, 0.01, 1), 0x9aa0a6, x, 0.77, 2.1);
    }
    pottedPlant(g, x1 - 0.35, y0, 2.2, { kind: 'fig', h: 1.1, seed: 6, pot: 'white', potR: 0.16, potH: 0.3 });
    D(g, RB(bw * 0.9, 0.9, 0.01, 0.005, 1), paint(0xf4f7f9, 0.4, 0, {}), cx, 1.0, 2.5);
  } else if (kind === 'pharmacy') {
    for (const y of [1.0, 1.4, 1.8, 2.2]) {
      shelf(y, 0.26, 0xeeeeea);
      for (let x = x0 + 0.2; x < x1 - 0.2; x += 0.1 + R() * 0.05) {
        const h = 0.08 + R() * 0.14;
        V(g, box(0.07 + R() * 0.03, h, 0.08), [0xffffff, 0xe94e3c, 0x3b8fd6, 0xf3c14a, 0x5fb36e, 0xf7f2e8, 0x9b6ad1][(R() * 7) | 0], x, y + 0.02 + h / 2, zb + 0.12, 0, (R() - 0.5) * 0.2, 0);
      }
    }
    V(g, RB(bw * 0.5, 0.35, 0.3, 0.02, 2), 0xf4f3ef, cx, y0 + 0.175, 2.25);
    for (let k = 0; k < 8; k++) V(g, CY(0.035, 0.035, 0.13, 12), [0xffffff, 0xd8584a, 0x3b8fd6][k % 3], cx - 0.6 + k * 0.17, y0 + 0.415, 2.25, 0, 0, 0, vcGloss());
  } else if (kind === 'bookstore') {
    for (const y of [0.95, 1.4, 1.85, 2.3]) {
      shelf(y, 0.24, 0x5a3c26);
      for (let x = x0 + 0.15; x < x1 - 0.15;) {
        const t = 0.025 + R() * 0.035, h = 0.18 + R() * 0.12;
        V(g, box(t, h, 0.17), [0x8c3b35, 0x2f5d7c, 0xd8b25a, 0x3d6b4a, 0xe9e1cf, 0x5b3e6e, 0xc76a3a, 0x24364f][(R() * 8) | 0], x + t / 2, y + 0.02 + h / 2, zb + 0.11, 0, 0, R() < 0.08 ? 0.2 : 0);
        x += t + 0.004 + (R() < 0.05 ? 0.12 : 0);
      }
    }
    V(g, RB(bw * 0.6, 0.3, 0.32, 0.02, 2), 0x6b4529, cx, y0 + 0.15, 2.25);
    for (let k = 0; k < 4; k++) {
      const x = cx - bw * 0.22 + k * bw * 0.15;
      for (let j = 0; j < 3 + (k % 2); j++) V(g, RB(0.2, 0.03, 0.27, 0.006, 1), [0xe9e1cf, 0x8c3b35, 0x2f5d7c, 0xd8b25a][(j + k) % 4], x, y0 + 0.315 + j * 0.032, 2.25, 0, (R() - 0.5) * 0.3, 0);
    }
  } else {
    for (const y of [1.3, 1.95]) shelf(y, 0.28, 0xf4f3ef);
    const bear = (x, y, z, s, col) => {
      V(g, SP(0.12 * s, 12, 9), col, x, y + 0.11 * s, z, 0, 0, 0, vcSoft());
      V(g, SP(0.09 * s, 12, 9), col, x, y + 0.28 * s, z, 0, 0, 0, vcSoft());
      for (const e of [-1, 1]) { V(g, SP(0.035 * s, 8, 6), col, x + e * 0.065 * s, y + 0.36 * s, z, 0, 0, 0, vcSoft()); V(g, SP(0.04 * s, 8, 6), col, x + e * 0.11 * s, y + 0.12 * s, z + 0.06 * s, 0, 0, 0, vcSoft()); }
      V(g, SP(0.04 * s, 8, 6), 0xf1d7b5, x, y + 0.26 * s, z + 0.08 * s, 0, 0, 0, vcSoft());
      for (const e of [-1, 1]) V(g, SP(0.012 * s, 6, 4), 0x1b1512, x + e * 0.035 * s, y + 0.31 * s, z + 0.078 * s, 0, 0, 0, vcGloss());
    };
    for (let x = x0 + 0.35; x < x1 - 0.3; x += 0.45) {
      if (R() < 0.5) bear(x, 1.32, zb + 0.15, 0.9, [0xc88a4f, 0xf1e3cf, 0xe8a0b4][(R() * 3) | 0]);
      else V(g, SP(0.11, 14, 10), [0xe0574a, 0x4a92dd, 0xf2c14e, 0x5fb36e][(R() * 4) | 0], x, 1.43, zb + 0.15, 0, 0, 0, vcGloss());
      const h = 2 + ((R() * 3) | 0);
      for (let j = 0; j < h; j++) V(g, RB(0.12, 0.12, 0.12, 0.015, 1), [0xe0574a, 0x4a92dd, 0xf2c14e, 0x5fb36e][(j + (x * 7 | 0)) % 4], x + (j % 2) * 0.03, 1.97 + 0.06 + j * 0.12, zb + 0.15, 0, j * 0.3, 0, vcGloss());
    }
    bear(cx - bw * 0.2, y0, 2.2, 1.9, 0xc88a4f);
    // toy car and rocket
    const tc = group(g, cx + bw * 0.18, y0, 2.2, 0.4);
    V(tc, RB(0.4, 0.12, 0.2, 0.04, 2), 0xe0574a, 0, 0.1, 0, 0, 0, 0, vcGloss());
    V(tc, RB(0.22, 0.1, 0.18, 0.04, 2), 0xf4f3ef, -0.02, 0.2, 0, 0, 0, 0, vcGloss());
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) V(tc, CY(0.05, 0.05, 0.03, 14), 0x222222, sx * 0.13, 0.05, sz * 0.1, PI / 2);
    V(g, lathe([[0, 0], [0.07, 0.02], [0.08, 0.3], [0.05, 0.45], [0, 0.55]], 16), 0xf4f3ef, x1 - 0.3, y0, 2.15, 0, 0, 0, vcGloss());
    V(g, CY(0.03, 0.03, 0.02, 12), 0x4a92dd, x1 - 0.3, y0 + 0.3, 2.23, PI / 2);
  }
}

/* ------------------------------------------------------------------ interiors (built lazily) */
// Walk-in ground floor. Same local frame as the site: floor top FL, ceiling CL, inner wall faces at
// x = +-XI and z = ZI, the dressed shop windows from z = ZW to the glass. buildInterior() returns the
// extra.interior.build() payload {group, colliders, interactables, npcSpots, lamps, indoor}.
const FL = 0.15, CL = 3.2, XI = 5.3, ZI = -4.5, ZW = 1.84, DK = 0x2b2d31;
const TAGS = {
  bakery: ['오늘 구운 빵', '케이크', '계산하는 곳'],
  cafe: ['주문하는 곳', '받는 곳', '디저트'],
  hospital: ['접수 · 수납', '진료실', '대기실'],
  pharmacy: ['처방전 접수', '일반의약품', '복약 상담'],
  bookstore: ['그림책', '새로 나온 책', '계산대'],
  toy: ['블록 · 로봇', '인형 · 자동차', '계산대'],
};
const MENU = {
  bakery: ['빵 메뉴', [['소금빵', '2,500'], ['크루아상', '3,200'], ['단팥빵', '2,000'], ['우유식빵', '4,500'], ['딸기 케이크', '28,000'], ['초코 쿠키', '1,800']]],
  cafe: ['음료 메뉴', [['아메리카노', '3,000'], ['카페라떼', '3,800'], ['바닐라라떼', '4,300'], ['딸기라떼', '4,500'], ['레몬에이드', '4,000'], ['핫초코', '4,000']]],
  hospital: ['진료 시간', [['평일', '09-18시'], ['토요일', '09-13시'], ['점심', '13-14시'], ['일요일', '쉬어요'], ['예방접종', '접수'], ['소아과', '진료']]],
  pharmacy: ['건강 안내', [['감기약', '상담'], ['소화제', '상담'], ['비타민', '9,000'], ['밴드', '2,000'], ['파스', '3,000'], ['마스크', '1,000']]],
  bookstore: ['이달의 책', [['달님 안녕', '그림책'], ['숲속 친구', '동화'], ['우주 탐험', '과학'], ['요리왕', '만화'], ['공룡 백과', '도감'], ['바다 이야기', '그림책']]],
  toy: ['인기 장난감', [['블록 세트', '15,000'], ['로봇 친구', '12,000'], ['곰 인형', '9,000'], ['미니카', '6,000'], ['탱탱볼', '3,000'], ['기차 놀이', '20,000']]],
};
const COVER = {
  bakery: ['쿠키', '러스크', '딸기잼', '머랭', '마들렌', '스콘', '파이', '꿀'],
  cafe: ['원두', '드립백', '쿠키', '시럽', '말차', '홍차', '초코', '캐러멜'],
  hospital: ['건강', '접종', '비타민', '손씻기', '수면', '운동', '식사', '양치'],
  pharmacy: ['감기약', '소화제', '비타민', '밴드', '파스', '연고', '해열제', '영양제'],
  bookstore: ['곰돌이', '달님', '아기 별', '숲속', '바다', '토끼', '구름', '기차'],
  toy: ['로봇', '블록', '자동차', '공룡', '인형', '기차', '퍼즐', '비행기'],
};
const PAL = ['#e0574a', '#f2c14e', '#4a92dd', '#5fb36e', '#9b6ad1', '#ff9ec4', '#f08a3c', '#3fb5b0'];
const PALX = [0xe0574a, 0xf2c14e, 0x4a92dd, 0x5fb36e, 0x9b6ad1, 0xff9ec4, 0xf08a3c, 0x3fb5b0];
const CRUST = [0xc98a4a, 0xa8642d, 0xe0b071, 0xb87a3e, 0xd39a55, 0x8f5428];
const MEDC = [0xffffff, 0xe94e3c, 0x3b8fd6, 0xf3c14a, 0x5fb36e, 0xf7f2e8, 0x9b6ad1, 0xf08a3c];

/** Shared geometry cache for the interior props (bake clones it, tint copies it). */
const GCACHE = new Map();
function GC(key, make) { let g = GCACHE.get(key); if (!g) { g = make(); g.userData.shared = true; GCACHE.set(key, g); } return g; }
const q2 = (v) => Math.round(v * 100) / 100;
const BX = (w, h, d) => { w = q2(w); h = q2(h); d = q2(d); return GC(`bx${w},${h},${d}`, () => box(w, h, d)); };

function interiorAtlas(kind, K) {
  const A = new Atlas(1024, 6);
  const [title, rows] = MENU[kind];
  A.add('menuBig', 384, 192, (c, w, h) => {
    c.fillStyle = '#23302a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a07c55'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    txt(c, title, w / 2, 32, 26, '#f5ecd9', 'center', 'middle');
    c.fillStyle = 'rgba(245,236,217,0.35)'; c.fillRect(30, 54, w - 60, 2);
    rows.forEach(([n, p], i) => {
      const x = 24 + (i % 2) * (w / 2 - 8), y = 82 + ((i / 2) | 0) * 38;
      txt(c, n, x, y, 18, '#e9e2d2', 'left', 'middle');
      txt(c, p, x + w / 2 - 40, y, 15, '#e6b85c', 'right', 'middle');
    });
  });
  TAGS[kind].forEach((s, i) => A.add('tag' + i, 256, 64, (c, w, h) => {
    rr(c, 2, 2, w - 4, h - 4, 12, K.bg, K.acc, 3);
    txt(c, s, w / 2, h / 2 + 2, 30, K.fg, 'center', 'middle');
  }));
  A.add('price', 256, 16, (c, w, h) => {
    c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, w, h);
    for (let x = 8; x < w; x += 42) { c.fillStyle = kind === 'pharmacy' ? '#d8f3c4' : '#ffd54d'; c.fillRect(x, 2, 26, h - 4); c.fillStyle = '#3a3330'; c.fillRect(x + 4, 6, 16, 3); }
  });
  A.add('pos', 96, 64, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2d6fb3'); gr.addColorStop(1, '#1d4f86');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 3; i++) c.fillRect(6, 8 + i * 12, 50, 6);
    c.fillStyle = '#ffd54d'; c.fillRect(62, 8, 28, 30); c.fillStyle = '#ffffff'; c.fillRect(6, h - 16, w - 12, 10);
  });
  A.add('clock', 128, 128, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.fillStyle = '#fbfaf6'; c.beginPath(); c.arc(cx, cy, 62, 0, PI * 2); c.fill();
    c.strokeStyle = '#2b2d31'; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i * PI / 6; c.lineWidth = i % 3 ? 2 : 4; c.beginPath(); c.moveTo(cx + Math.sin(a) * 47, cy - Math.cos(a) * 47); c.lineTo(cx + Math.sin(a) * 57, cy - Math.cos(a) * 57); c.stroke(); }
    const hand = (a, l, lw, col) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l); c.stroke(); };
    hand(-PI / 3 + 0.1, 30, 5, '#2b2d31'); hand(PI / 3, 44, 3.5, '#2b2d31'); hand(2.3, 47, 1.5, '#d8323a');
    c.fillStyle = '#2b2d31'; c.beginPath(); c.arc(cx, cy, 4, 0, PI * 2); c.fill();
  });
  A.add('art0', 120, 160, (c, w, h) => {
    c.fillStyle = '#f6efe2'; c.fillRect(0, 0, w, h);
    c.fillStyle = K.bg; c.fillRect(10, 10, w - 20, h - 52);
    icon(c, kind, w / 2, 62, 30, K);
    txt(c, K.name, w / 2, h - 26, 14, '#3a3330', 'center', 'middle');
  });
  A.add('art1', 160, 120, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe0f2'); gr.addColorStop(0.6, '#f7e6c4'); gr.addColorStop(1, '#f2d6a8');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2b04a'; c.beginPath(); c.arc(w * 0.72, h * 0.32, 14, 0, PI * 2); c.fill();
    c.fillStyle = '#7fae6a'; c.beginPath(); c.moveTo(0, h * 0.75); c.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.72); c.quadraticCurveTo(w * 0.8, h * 0.6, w, h * 0.7); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = '#5a8f55'; c.beginPath(); c.moveTo(0, h * 0.9); c.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.92); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  });
  COVER[kind].forEach((s, i) => A.add('cover' + i, 64, 88, (c, w, h) => {
    if (kind === 'pharmacy' || kind === 'hospital') {
      c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h);
      c.fillStyle = PAL[i]; c.fillRect(0, 0, w, 18); c.fillRect(0, h - 10, w, 10);
      txt(c, s, w / 2, 46, 13, '#2b2d31', 'center', 'middle');
      c.fillStyle = PAL[(i + 3) % 8]; c.beginPath(); c.arc(w / 2, 68, 7, 0, PI * 2); c.fill();
      return;
    }
    if (kind === 'cafe' || kind === 'bakery') {
      c.fillStyle = kind === 'cafe' ? '#c9a77c' : PAL[i]; c.fillRect(0, 0, w, h);
      rr(c, 7, 26, w - 14, 38, 5, '#f6efe2'); txt(c, s, w / 2, 46, 12, '#3a2a1e', 'center', 'middle');
      return;
    }
    c.fillStyle = PAL[i]; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    const sh = i % 4;
    if (sh === 0) { c.beginPath(); c.arc(32, 36, 17, 0, PI * 2); c.fill(); for (const e of [-1, 1]) { c.beginPath(); c.arc(32 + e * 13, 22, 7, 0, PI * 2); c.fill(); } c.fillStyle = '#2b2d31'; for (const e of [-1, 1]) { c.beginPath(); c.arc(32 + e * 6, 34, 2.4, 0, PI * 2); c.fill(); } }
    else if (sh === 1) { c.beginPath(); c.arc(32, 36, 14, 0, PI * 2); c.fill(); for (let k = 0; k < 8; k++) { const a = k * PI / 4; c.fillRect(32 + Math.cos(a) * 19 - 2, 36 + Math.sin(a) * 19 - 2, 4, 4); } }
    else if (sh === 2) { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -PI / 2 + k * PI / 5, r = k % 2 ? 8 : 19; c.lineTo(32 + Math.cos(a) * r, 36 + Math.sin(a) * r); } c.fill(); }
    else { c.fillRect(16, 32, 32, 22); c.beginPath(); c.moveTo(12, 34); c.lineTo(32, 16); c.lineTo(52, 34); c.fill(); }
    rr(c, 4, h - 25, w - 8, 19, 4, '#ffffff'); txt(c, s, w / 2, h - 15, 12, '#2b2d31', 'center', 'middle');
  }));
  if (kind === 'hospital') {
    A.add('eye', 96, 150, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      ['3 8', '5 2 9', '6 4 1 7', '2 9 5 3 8', '7 1 6 4 2 9', '8 3 5 9 1 6 2'].forEach((s, i) => txt(c, s, w / 2, 18 + i * 21, 24 - i * 3.3, '#1b1b1b', 'center', 'middle'));
      c.fillStyle = '#d8323a'; c.fillRect(8, h - 10, w - 16, 2);
    });
    A.add('xray', 128, 96, (c, w, h) => {
      c.fillStyle = '#0e1418'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(205,222,230,0.75)'; c.lineWidth = 3;
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { c.beginPath(); c.ellipse(w / 2 + s * 4, 22 + i * 11, 34 - i, 10, 0, s < 0 ? PI * 0.5 : PI * 1.5, s < 0 ? PI * 1.5 : PI * 2.5); c.stroke(); }
      c.fillStyle = 'rgba(220,232,238,0.8)'; c.fillRect(w / 2 - 3, 8, 6, h - 14);
    });
    A.add('tv', 256, 144, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a7fc4'); gr.addColorStop(1, '#1b4f86');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      txt(c, '손을 깨끗이 씻어요', w / 2, 30, 22, '#ffffff', 'center', 'middle');
      for (let i = 0; i < 4; i++) { rr(c, 18 + i * 58, 56, 48, 48, 10, 'rgba(255,255,255,0.9)'); txt(c, String(i + 1), 42 + i * 58, 80, 24, '#1f5f9a', 'center', 'middle'); }
      txt(c, '30초 동안 비누로!', w / 2, 124, 16, '#d8f3ff', 'center', 'middle');
    });
    A.add('num', 160, 56, (c, w, h) => {
      c.fillStyle = '#111316'; c.fillRect(0, 0, w, h);
      txt(c, '대기', 34, h / 2 + 1, 20, '#9fd3ff', 'center', 'middle');
      txt(c, '017', 108, h / 2 + 2, 36, '#ff5a4a', 'center', 'middle');
    });
  }
  A.build();
  return A;
}

/* interior kit: boxes, placement with colliders, counters, shelves, lights, signs */
function bx(p, m, x0, y0, z0, x1, y1, z1, cast = true) {
  const o = put(p, box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  o.castShadow = cast;
  return o;
}
/** Group standing on the floor at (x, z) turned ry, plus a w x d (local) x h collider. Front = local +Z. */
function placed(I, x, z, ry, w, d, h) {
  const g = group(I.group, x, FL, z, ry);
  const q = Math.abs(Math.sin(ry)) > 0.5, hx = (q ? d : w) / 2, hz = (q ? w : d) / 2;
  if (h > 0) I.colliders.push({ min: [x - hx, 0, z - hz], max: [x + hx, FL + h, z + hz] });
  return g;
}
/** World position and sitter yaw of local point (lx, lz) in a group at (x, z) turned ry (sitter faces local +Z). */
function seatOf(x, z, ry, lx, lz) {
  return { pos: [x + lx * Math.cos(ry) + lz * Math.sin(ry), FL, z - lx * Math.sin(ry) + lz * Math.cos(ry)], yaw: Math.atan2(-Math.sin(ry), -Math.cos(ry)) };
}
function shell(I, M) {
  const g = I.group;
  bx(g, M.floor, -XI, FL - 0.012, ZI, XI, FL, ZW + 0.02, false);
  bx(g, M.wall, -XI, FL, ZI, -XI + 0.02, CL, ZW);
  bx(g, M.wall, XI - 0.02, FL, ZI, XI, CL, ZW);
  bx(g, M.wall, -XI, FL, ZI, XI, CL, ZI + 0.02);
  bx(g, M.wall, -XI, 2.62, 1.76, XI, CL, 1.78);
  bx(g, M.ceil, -XI, CL - 0.02, ZI, XI, CL, 1.78, false);
  const wy = FL + 0.95;
  bx(g, M.wain, -XI + 0.02, FL, ZI + 0.02, -XI + 0.035, wy, ZW);
  bx(g, M.wain, XI - 0.035, FL, ZI + 0.02, XI - 0.02, wy, ZW);
  bx(g, M.wain, -XI + 0.02, FL, ZI + 0.02, XI - 0.02, wy, ZI + 0.035);
  // cap rail and skirting
  V(g, RB(0.035, 0.035, ZW - ZI, 0.008, 1), M.rail, -XI + 0.04, wy, (ZI + ZW) / 2);
  V(g, RB(0.035, 0.035, ZW - ZI, 0.008, 1), M.rail, XI - 0.04, wy, (ZI + ZW) / 2);
  V(g, RB(2 * XI - 0.1, 0.035, 0.035, 0.008, 1), M.rail, 0, wy, ZI + 0.04);
  V(g, BX(0.02, 0.09, ZW - ZI), M.skirt, -XI + 0.045, FL + 0.045, (ZI + ZW) / 2);
  V(g, BX(0.02, 0.09, ZW - ZI), M.skirt, XI - 0.045, FL + 0.045, (ZI + ZW) / 2);
  V(g, BX(2 * XI - 0.1, 0.09, 0.02), M.skirt, 0, FL + 0.045, ZI + 0.045);
  // cornice
  V(g, RB(2 * XI, 0.06, 0.05, 0.01, 1), 0xf4f1ea, 0, CL - 0.05, ZI + 0.045);
  for (const s of [-1, 1]) V(g, RB(0.05, 0.06, ZW - ZI, 0.01, 1), 0xf4f1ea, s * (XI - 0.045), CL - 0.05, (ZI + ZW) / 2);
}
function downlight(g, M, x, z, m = M.glow) {
  V(g, CY(0.1, 0.1, 0.02, 20), 0xf4f3ef, x, CL - 0.03, z, 0, 0, 0, vcGloss());
  D(g, CY(0.075, 0.075, 0.006, 20), m, x, CL - 0.043, z);
}
function panelLight(g, M, x, z, w = 1.2, d = 0.3, m = M.glow) {
  V(g, RB(w + 0.08, 0.03, d + 0.08, 0.01, 1), 0xeeeeea, x, CL - 0.03, z);
  D(g, BX(w, 0.006, d), m, x, CL - 0.047, z);
}
function hangSign(g, M, key, x, y, z, ry = 0, w = 0.9) {
  const h = w / 4, sg = group(g, x, y, z, ry);
  V(sg, RB(w + 0.05, h + 0.05, 0.03, 0.012, 2), DK, 0, 0, 0);
  D(sg, M.A.quad(key, w, h), M.P, 0, 0, 0.0165);
  D(sg, M.A.quad(key, w, h), M.P, 0, 0, -0.0165, 0, PI, 0);
  const L = CL - y - h / 2 - 0.025;
  for (const s of [-1, 1]) V(sg, CY(0.004, 0.004, L, 4), 0x6a6e73, s * w * 0.38, h / 2 + 0.025 + L / 2, 0);
  return sg;
}
function art(g, M, key, x, y, z, ry, w, h, frame = 0x3a2a1e, lit = false) {
  const ag = group(g, x, y, z, ry);
  V(ag, RB(w + 0.06, h + 0.06, 0.03, 0.008, 1), frame, 0, 0, 0.015);
  D(ag, M.A.quad(key, w, h), lit ? M.L : M.P, 0, 0, 0.031);
  return ag;
}
/** Shop counter, length along local X, customers on local +Z, top at h. */
function counterAt(I, M, x, z, ry, len, o = {}) {
  const { h = 1.0, d = 0.62, slat = M.slat } = o;
  const g = placed(I, x, z, ry, len + 0.06, d + 0.06, h);
  put(g, RB(len, h - 0.11, d - 0.04, 0.02, 2), M.counter, 0, 0.065 + (h - 0.11) / 2, 0);
  V(g, RB(len - 0.06, 0.08, d - 0.14, 0.01, 1), DK, 0, 0.04, -0.02);
  put(g, RB(len + 0.06, 0.045, d + 0.06, 0.012, 2), M.top, 0, h - 0.0225, 0.01);
  const n = Math.floor(len / 0.13);
  for (let i = 0; i < n; i++) V(g, RB(0.075, h - 0.26, 0.025, 0.01, 1), slat, -len / 2 + (i + 0.5) * len / n, 0.13 + (h - 0.26) / 2, d / 2 - 0.01);
  V(g, RB(len, 0.03, 0.03, 0.008, 1), DK, 0, h - 0.11, d / 2 - 0.005);
  return g;
}
/** Cash register on a counter: screen faces local -Z (staff), card reader towards the customer. */
function register(g, M, x, y, z) {
  const r = group(g, x, y, z, 0);
  V(r, RB(0.36, 0.09, 0.32, 0.015, 2), DK, 0, 0.045, 0);
  V(r, RB(0.05, 0.14, 0.05, 0.01, 1), 0x3a3b3d, 0, 0.16, -0.02);
  const s = group(r, 0, 0.28, -0.02, PI), t = group(s, 0, 0, 0, 0);
  t.rotation.x = -0.32;
  V(t, RB(0.3, 0.21, 0.03, 0.012, 1), DK, 0, 0, 0);
  D(t, M.A.quad('pos', 0.26, 0.17), M.L, 0, 0, 0.016);
  const cr = group(r, 0.27, 0, 0.1, -0.35);
  V(cr, RB(0.085, 0.04, 0.16, 0.012, 2), 0x3a3b3d, 0, 0.02, 0);
  V(cr, BX(0.06, 0.004, 0.04), 0x9fd3ff, 0, 0.041, -0.03, 0, 0, 0, vcGloss());
  V(r, RB(0.12, 0.1, 0.14, 0.015, 2), 0xe9e7e2, -0.27, 0.05, 0.02);
  V(r, BX(0.07, 0.002, 0.09), 0xfbfbf8, -0.27, 0.12, 0.09, -0.6, 0, 0);
  return r;
}
/** Open shelving unit w x h x d, front local +Z; fill(g, level, y, x0, x1, d, step) stocks each level. */
function shelfUnit(I, M, x, z, ry, w, h, d, levels, fill, o = {}) {
  const g = placed(I, x, z, ry, w, d, h);
  const body = o.body ?? M.wood;
  for (const s of [-1, 1]) put(g, RB(0.035, h, d, 0.006, 1), body, s * (w / 2 - 0.0175), h / 2, 0);
  put(g, RB(w, 0.035, d, 0.006, 1), body, 0, h - 0.0175, 0);
  put(g, RB(w - 0.07, 0.1, d - 0.02, 0.006, 1), body, 0, 0.05, 0);
  V(g, BX(w - 0.07, h - 0.1, 0.014), o.back ?? 0xf1ece2, 0, (h + 0.1) / 2, -d / 2 + 0.008);
  const step = (h - 0.18) / levels;
  for (let i = 0; i < levels; i++) {
    const y = 0.1 + i * step;
    if (i > 0) {
      put(g, RB(w - 0.07, 0.025, d - 0.03, 0.005, 1), body, 0, y, 0);
      if (o.price !== false) D(g, M.A.quad('price', w - 0.08, 0.03), M.P, 0, y, (d - 0.03) / 2 + 0.003);
    }
    fill(g, i, y + 0.0125, -w / 2 + 0.05, w / 2 - 0.05, d, step);
  }
  return g;
}

/* little goods */
function bun(g, x, y, z, s, c) { const o = V(g, SP(0.065 * s, 12, 8), c, x, y + 0.028 * s, z, 0, 0, 0, vcGloss()); o.scale.set(1.15, 0.62, 1); return o; }
function loaf(g, x, y, z, s, c, ry = 0) {
  const o = V(g, GC('loaf', () => capsule(0.055, 0.14, 4, 10)), c, x, y + 0.045 * s, z, 0, ry, PI / 2, vcGloss());
  o.scale.set(s, s, s * 0.82);
  return o;
}
function croissant(g, x, y, z, ry, c) { return V(g, GC('croi', () => torus(0.045, 0.022, 6, 12, PI * 1.25)), c, x, y + 0.02, z, -PI / 2, ry, 0, vcGloss()); }
function cake(g, x, y, z, r, c1, c2) {
  V(g, CY(r + 0.025, r + 0.025, 0.01, 22), 0xf4f3ef, x, y + 0.005, z, 0, 0, 0, vcGloss());
  V(g, CY(r, r, 0.1, 22), c1, x, y + 0.06, z, 0, 0, 0, vcGloss());
  V(g, CY(r * 0.97, r * 0.97, 0.02, 22), c2, x, y + 0.115, z, 0, 0, 0, vcGloss());
  for (let k = 0; k < 8; k++) V(g, SP(0.014, 8, 6), 0xd8323a, x + Math.cos(k * 0.785) * r * 0.75, y + 0.13, z + Math.sin(k * 0.785) * r * 0.75, 0, 0, 0, vcGloss());
}
function plush(g, x, y, z, s, col) {
  const n = s > 1.3 ? 14 : 10;
  V(g, SP(0.12 * s, n, n - 3), col, x, y + 0.11 * s, z, 0, 0, 0, vcSoft());
  V(g, SP(0.09 * s, n, n - 3), col, x, y + 0.28 * s, z, 0, 0, 0, vcSoft());
  for (const e of [-1, 1]) { V(g, SP(0.035 * s, 8, 6), col, x + e * 0.065 * s, y + 0.36 * s, z, 0, 0, 0, vcSoft()); V(g, SP(0.04 * s, 8, 6), col, x + e * 0.11 * s, y + 0.12 * s, z + 0.06 * s, 0, 0, 0, vcSoft()); }
  V(g, SP(0.04 * s, 8, 6), 0xf1d7b5, x, y + 0.26 * s, z + 0.08 * s, 0, 0, 0, vcSoft());
  for (const e of [-1, 1]) V(g, SP(0.012 * s, 6, 4), 0x1b1512, x + e * 0.035 * s, y + 0.31 * s, z + 0.078 * s, 0, 0, 0, vcGloss());
}
function robot(g, x, y, z, s, c) {
  V(g, RB(0.1 * s, 0.11 * s, 0.07 * s, 0.01, 1), c, x, y + 0.13 * s, z, 0, 0, 0, vcGloss());
  V(g, RB(0.085 * s, 0.07 * s, 0.07 * s, 0.012, 1), 0xc9ced3, x, y + 0.225 * s, z, 0, 0, 0, vcGloss());
  for (const e of [-1, 1]) {
    V(g, SP(0.012 * s, 8, 6), 0x2fd0ff, x + e * 0.02 * s, y + 0.23 * s, z + 0.036 * s, 0, 0, 0, vcGloss());
    V(g, RB(0.025 * s, 0.08 * s, 0.03 * s, 0.006, 1), c, x + e * 0.066 * s, y + 0.13 * s, z, 0, 0, e * 0.15);
    V(g, RB(0.035 * s, 0.075 * s, 0.045 * s, 0.006, 1), 0x55585c, x + e * 0.026 * s, y + 0.0375 * s, z);
  }
  V(g, CY(0.004 * s, 0.004 * s, 0.05 * s, 6), DK, x, y + 0.28 * s, z);
  V(g, SP(0.012 * s, 8, 6), 0xe0574a, x, y + 0.31 * s, z, 0, 0, 0, vcGloss());
}
function car(g, x, y, z, s, c, ry = 0) {
  const cg = group(g, x, y, z, ry);
  V(cg, RB(0.16 * s, 0.045 * s, 0.075 * s, 0.015, 1), c, 0, 0.04 * s, 0, 0, 0, 0, vcGloss());
  V(cg, RB(0.08 * s, 0.04 * s, 0.066 * s, 0.012, 1), 0xbfe3f0, -0.01 * s, 0.075 * s, 0, 0, 0, 0, vcGloss());
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) V(cg, CY(0.018 * s, 0.018 * s, 0.012 * s, 10), 0x1d1e20, sx * 0.05 * s, 0.018 * s, sz * 0.04 * s, PI / 2);
  return cg;
}
function artBox(g, M, x, y, z, w, h, dd, k, ry = 0) {
  const bg = group(g, x, y, z, ry);
  V(bg, RB(w, h, dd, 0.004, 1), PALX[k % 8], 0, h / 2, 0);
  D(bg, M.A.quad('cover' + (k % 8), w * 0.88, h * 0.88), M.P, 0, h / 2, dd / 2 + 0.002);
  return bg;
}

/* shelf fillers (bound to the interior's rng R and materials M) */
function breadFill(M, R) {
  return (g, i, y, x0, x1, d, step) => {
    let k = i * 3;
    for (let x = x0 + 0.2; x < x1 - 0.17; x += 0.42, k++) {
      const t = k % 4;
      if (t === 0 || (t === 3 && step < 0.5)) {
        V(g, RB(0.38, 0.02, d - 0.12, 0.006, 1), 0x9a9ea3, x, y + 0.01, 0, 0, 0, 0, vcGloss());
        for (const a of [-0.11, 0, 0.11]) for (const b of [-0.08, 0.08]) bun(g, x + a, y + 0.02, b, 0.85, CRUST[(R() * 6) | 0]);
      } else if (t === 1) {
        V(g, RB(0.38, 0.08, d - 0.12, 0.025, 2), 0xb08a5a, x, y + 0.04, 0, 0, 0, 0, vcSoft());
        for (let j = 0; j < 2; j++) loaf(g, x - 0.08 + j * 0.16, y + 0.04, 0, 1, CRUST[(R() * 6) | 0], PI / 2);
      } else if (t === 2) {
        V(g, RB(0.38, 0.02, d - 0.12, 0.006, 1), 0x6b4529, x, y + 0.01, 0);
        for (const a of [-0.1, 0.1]) for (const b of [-0.07, 0.07]) croissant(g, x + a, y + 0.02, b, R() * PI, 0xd39a55);
      } else {
        V(g, CY(0.1, 0.08, 0.2, 14), 0xb08a5a, x, y + 0.1, 0, 0, 0, 0, vcSoft());
        for (let j = 0; j < 4; j++) V(g, GC('bag', () => capsule(0.026, 0.36, 4, 8)), 0xd39a55, x - 0.05 + j * 0.033, y + 0.25, (j % 2) * 0.03 - 0.015, 0.1 * (j % 2 ? 1 : -1), 0, (j - 1.5) * 0.12, vcGloss());
      }
      V(g, BX(0.07, 0.045, 0.004), 0xfaf8f2, x, y + 0.03, d / 2 - 0.03, -0.3, 0, 0);
    }
  };
}
function medFill(M, R) {
  return (g, i, y, x0, x1, d, step) => {
    const hMax = Math.min(step - 0.05, 0.24);
    for (let x = x0 + 0.01; x < x1 - 0.07;) {
      const w = q2(0.06 + R() * 0.07), h = q2(0.08 + R() * (hMax - 0.08)), dd = q2(Math.min(d - 0.1, 0.12 + R() * 0.1));
      const c = MEDC[(R() * MEDC.length) | 0], zc = d / 2 - dd / 2 - 0.035;
      if (R() < 0.14) {
        for (let j = 0; j < 2; j++) V(g, GC('pill', () => lathe([[0, 0], [0.03, 0], [0.032, 0.01], [0.032, 0.09], [0.022, 0.1], [0.022, 0.12], [0, 0.12]], 14)), [0xf4f3ef, 0x9a5a2a, 0xe0b071][(R() * 3) | 0], x + 0.035, y, zc - 0.05 + j * 0.08, 0, 0, 0, vcGloss());
        x += 0.08;
        continue;
      }
      if (R() < 0.25 && h > 0.11 && w > 0.08) artBox(g, M, x + w / 2, y, zc, w, h, dd, (R() * 8) | 0);
      else {
        V(g, BX(w, h, dd), c, x + w / 2, y + h / 2, zc);
        V(g, BX(w + 0.004, h * 0.22, dd + 0.004), c === 0xffffff ? MEDC[1 + ((R() * 7) | 0)] : 0xffffff, x + w / 2, y + h * 0.62, zc);
      }
      x += w + 0.008;
    }
  };
}
function toyFill(M, R) {
  return (g, i, y, x0, x1, d, step) => {
    const t = i % 5;
    if (t === 0) { for (let x = x0 + 0.02, k = 0; x < x1 - 0.26; k++) { const w = 0.24 + R() * 0.12, h = Math.min(step - 0.06, 0.22 + R() * 0.1); artBox(g, M, x + w / 2, y, 0, w, h, Math.min(d - 0.08, 0.28), (k + i) % 8); x += w + 0.02; } }
    else if (t === 1) { for (let x = x0 + 0.12; x < x1 - 0.1; x += 0.22) car(g, x, y, (R() - 0.5) * 0.12, 1.1, PALX[(R() * 8) | 0], (R() - 0.5) * 0.4); }
    else if (t === 2) { for (let x = x0 + 0.08; x < x1 - 0.12; x += 0.2) { const n = 2 + ((R() * 3) | 0); for (let j = 0; j < n; j++) V(g, RB(0.07, 0.07, 0.07, 0.008, 1), PALX[(((j + ((x * 9) | 0)) % 8) + 8) % 8], x + (j % 2) * 0.02, y + 0.035 + j * 0.07, (R() - 0.5) * 0.08, 0, j * 0.3, 0, vcGloss()); } }
    else if (t === 3) { for (let x = x0 + 0.13; x < x1 - 0.12; x += 0.27) plush(g, x, y, 0, 0.95, [0xc88a4f, 0xf1e3cf, 0xe8a0b4, 0x8a6a4c, 0xf2c14e][(R() * 5) | 0]); }
    else { for (let x = x0 + 0.1; x < x1 - 0.1; x += 0.2) { if (R() < 0.55) robot(g, x, y, 0, 1.2, PALX[(R() * 8) | 0]); else V(g, SP(0.075, 12, 8), PALX[(R() * 8) | 0], x, y + 0.075, 0, 0, 0, 0, vcGloss()); } }
  };
}
function boxFill(M, R) {
  return (g, i, y, x0, x1, d, step) => {
    for (let x = x0 + 0.02, k = i * 2; x < x1 - 0.2; k++) { const w = 0.18 + R() * 0.2, h = Math.min(step - 0.05, 0.18 + R() * 0.2); artBox(g, M, x + w / 2, y, 0, w, h, Math.min(d - 0.08, 0.2 + R() * 0.1), k); x += w + 0.015; }
  };
}

/* bigger pieces */
function cakeFridge(I, M, x, z, len) {
  const g = placed(I, x, z, 0, len, 0.72, 1.35);
  V(g, RB(len, 0.78, 0.66, 0.02, 2), 0xf1ece2, 0, 0.41, 0);
  put(g, RB(len - 0.04, 0.6, 0.02, 0.006, 1), M.wood, 0, 0.42, 0.335);
  V(g, RB(len, 0.05, 0.7, 0.01, 1), DK, 0, 0.825, 0);
  D(g, BX(len - 0.06, 0.5, 0.008), M.glass, 0, 1.08, 0.25, -0.22, 0, 0);
  D(g, BX(len - 0.06, 0.008, 0.48), M.glass, 0, 1.33, -0.05);
  for (const s of [-1, 1]) { D(g, BX(0.008, 0.48, 0.62), M.glass, s * (len / 2 - 0.02), 1.08, 0); V(g, RB(0.03, 0.52, 0.03, 0.006, 1), DK, s * (len / 2 - 0.02), 1.08, 0.28); }
  V(g, RB(len, 0.035, 0.05, 0.006, 1), DK, 0, 1.33, 0.2);
  V(g, RB(len, 0.5, 0.03, 0.006, 1), 0xd9d4ca, 0, 1.08, -0.33);
  D(g, BX(len - 0.1, 0.012, 0.4), M.glass, 0, 1.08, -0.06);
  D(g, BX(len - 0.1, 0.01, 0.03), M.glow, 0, 1.315, -0.15);
  const n = Math.floor(len / 0.42);
  const C = [[0xf6d7de, 0xfff8f0], [0x6b3f2a, 0x3b2416], [0xf7efe2, 0xf4d06f], [0xe8f0d0, 0xffffff]];
  for (let i = 0; i < n; i++) { const [a, b] = C[i % 4]; cake(g, -len / 2 + 0.25 + i * (len - 0.5) / Math.max(1, n - 1), 0.85, 0.02, 0.13, a, b); }
  for (let i = 0; i < n * 2; i++) {
    const sx = -len / 2 + 0.16 + i * (len - 0.32) / Math.max(1, n * 2 - 1), [a, b] = C[(i + 1) % 4];
    V(g, CY(0.06, 0.06, 0.008, 16), 0xf4f3ef, sx, 1.09, -0.06, 0, 0, 0, vcGloss());
    V(g, RB(0.07, 0.06, 0.09, 0.008, 1), a, sx, 1.125, -0.06, 0, 0.3, 0, vcGloss());
    V(g, RB(0.072, 0.012, 0.092, 0.004, 1), b, sx, 1.16, -0.06, 0, 0.3, 0, vcGloss());
  }
}
function island(I, M, x, z, R) {
  const g = placed(I, x, z, 0, 1.6, 0.9, 1.0);
  put(g, RB(1.6, 0.05, 0.9, 0.015, 2), M.wood, 0, 0.745, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, RB(0.06, 0.72, 0.06, 0.01, 1), M.wood, sx * 0.74, 0.36, sz * 0.39);
  put(g, RB(1.5, 0.03, 0.8, 0.01, 1), M.wood, 0, 0.2, 0);
  for (const bx0 of [-0.48, 0, 0.48]) {
    V(g, RB(0.42, 0.1, 0.62, 0.03, 2), 0xb08a5a, bx0, 0.265, 0, 0, 0, 0, vcSoft());
    for (let j = 0; j < 2; j++) loaf(g, bx0 - 0.09 + j * 0.18, 0.29, 0, 1.05, CRUST[(R() * 6) | 0], PI / 2);
  }
  put(g, RB(0.9, 0.16, 0.34, 0.01, 1), M.wood, 0, 0.85, -0.18);
  for (const s of [-1, 1]) {
    V(g, RB(0.62, 0.02, 0.36, 0.006, 1), 0x9a9ea3, s * 0.42, 0.78, 0.2, 0, 0, 0, vcGloss());
    for (const a of [-0.2, 0, 0.2]) for (const b of [-0.08, 0.08]) bun(g, s * 0.42 + a, 0.79, 0.2 + b, 1, CRUST[(R() * 6) | 0]);
    V(g, BX(0.08, 0.05, 0.004), 0xfaf8f2, s * 0.42, 0.82, 0.43, -0.3, 0, 0);
  }
  for (let k = 0; k < 5; k++) croissant(g, -0.36 + k * 0.18, 0.93, -0.18, R() * PI, 0xd39a55);
  const dome = GC('dome', () => lathe([[0, 0.32], [0.08, 0.31], [0.15, 0.25], [0.18, 0.12], [0.18, 0.0]], 24));
  put(g, dome, M.glass, 0.62, 0.77, -0.2).castShadow = false;
  V(g, CY(0.19, 0.19, 0.012, 24), 0x6b4529, 0.62, 0.776, -0.2);
  for (let k = 0; k < 7; k++) V(g, CY(0.035, 0.035, 0.012, 14), [0xb87a3e, 0x6b3f2a, 0xe0b071][k % 3], 0.62 + Math.cos(k) * 0.08, 0.79 + (k % 3) * 0.012, -0.2 + Math.sin(k) * 0.08, 0, 0, 0, vcGloss());
}
function beamSeats(I, M, x, z, ry, n, col = 0x5a8fc0) {
  const len = n * 0.56, g = placed(I, x, z, ry, len + 0.1, 0.62, 0.5);
  put(g, RB(len + 0.1, 0.06, 0.06, 0.01, 1), M.steel, 0, 0.36, -0.05);
  for (const s of [-1, 1]) { put(g, RB(0.05, 0.36, 0.05, 0.01, 1), M.steel, s * (len / 2 - 0.05), 0.18, -0.05); put(g, RB(0.07, 0.03, 0.52, 0.01, 1), M.steel, s * (len / 2 - 0.05), 0.015, -0.05); }
  const spots = [];
  for (let i = 0; i < n; i++) {
    const sx = -len / 2 + 0.28 + i * 0.56;
    V(g, RB(0.5, 0.06, 0.46, 0.03, 2), col, sx, 0.43, 0.02, 0, 0, 0, vcGloss());
    const b = group(g, sx, 0.72, -0.21, 0); b.rotation.x = -0.12;
    V(b, RB(0.5, 0.44, 0.05, 0.03, 2), col, 0, 0, 0, 0, 0, 0, vcGloss());
    put(g, RB(0.04, 0.3, 0.04, 0.01, 1), M.steel, sx, 0.55, -0.2);
    spots.push(seatOf(x, z, ry, sx, 0.05));
  }
  return spots;
}
function cafeTable(I, M, x, z, axis, R) {
  const g = group(I.group, x, FL, z, 0);
  put(g, CY(0.36, 0.36, 0.035, 28), M.top, 0, 0.74, 0);
  V(g, CY(0.03, 0.03, 0.7, 10), DK, 0, 0.37, 0, 0, 0, 0, vcGloss());
  V(g, CY(0.22, 0.24, 0.03, 20), DK, 0, 0.015, 0, 0, 0, 0, vcGloss());
  I.colliders.push({ min: [x - 0.36, 0, z - 0.36], max: [x + 0.36, FL + 0.76, z + 0.36] });
  mug(g, -0.12, 0.758, 0.06, [0xf4f3ef, 0xe7b9a3, 0x9fb3a0][(R() * 3) | 0], R() * PI);
  V(g, CY(0.09, 0.09, 0.01, 18), 0xf4f3ef, 0.12, 0.762, -0.06, 0, 0, 0, vcGloss());
  V(g, RB(0.07, 0.06, 0.09, 0.008, 1), [0xf6d7de, 0x6b3f2a, 0xf7efe2][(R() * 3) | 0], 0.12, 0.797, -0.06, 0, 0.5, 0, vcGloss());
  const spots = [];
  for (const s of [-1, 1]) {
    const cx = axis === 'x' ? x + s * 0.58 : x, cz = axis === 'z' ? z + s * 0.58 : z;
    const ry = Math.atan2(x - cx, z - cz);
    cafeChair(I.group, cx, FL, cz, ry, (R() * 9) | 0);
    spots.push({ pos: [cx, FL, cz], yaw: Math.atan2(-(x - cx), -(z - cz)) });
  }
  return spots;
}

/* ---------------------------------------------------------------- each shop */
function bakeryIn(I, M) {
  const g = I.group, R = M.R;
  const cg = counterAt(I, M, -2.6, -2.3, 0, 3.4);
  register(cg, M, 1.15, 1.0, 0.0);
  for (let k = 0; k < 6; k++) V(cg, BX(0.2, 0.004, 0.3), 0xd8c4a0, -1.35, 1.002 + k * 0.004, 0.0, 0, (R() - 0.5) * 0.2, 0);
  V(cg, RB(0.18, 0.26, 0.09, 0.006, 1), 0xd8c4a0, -1.05, 1.13, -0.12);
  const jar = GC('jar', () => lathe([[0, 0], [0.09, 0], [0.1, 0.02], [0.1, 0.2], [0.06, 0.24], [0.06, 0.27], [0, 0.27]], 20));
  for (let k = 0; k < 7; k++) V(cg, CY(0.05, 0.05, 0.012, 14), [0xb87a3e, 0x6b3f2a][k % 2], -0.45, 1.01 + k * 0.016, 0.05, 0, 0, 0, vcGloss());
  put(cg, jar, M.glass, -0.45, 1.0, 0.05).castShadow = false;
  V(cg, CY(0.065, 0.065, 0.03, 16), 0x6b4529, -0.45, 1.285, 0.05);
  V(cg, RB(0.5, 0.025, 0.3, 0.008, 1), 0x8a5a3a, 0.35, 1.012, 0.02);
  for (let j = 0; j < 2; j++) loaf(cg, 0.25 + j * 0.2, 1.025, 0.02, 1.2, CRUST[j + 1], PI / 2);
  cakeFridge(I, M, 0.0, -2.3, 1.7);
  shelfUnit(I, M, -2.7, ZI + 0.23, 0, 3.2, 2.0, 0.44, 4, breadFill(M, R));
  art(g, M, 'menuBig', -2.7, 2.64, ZI + 0.02, 0, 1.6, 0.8, 0x6b4529, true);
  const kd = staticDoor(g, 1.9, FL, ZI + 0.02, 0, { w: 0.9, h: 2.1, frame: M.wood });
  V(kd, GC('port', () => torus(0.14, 0.025, 8, 24)), 0xc9ced3, 0, 1.5, 0.045, 0, 0, 0, vcGloss());
  D(kd, CY(0.14, 0.14, 0.004, 20), M.glass, 0, 1.5, 0.04, PI / 2, 0, 0);
  shelfUnit(I, M, XI - 0.23, -2.4, -PI / 2, 3.2, 1.9, 0.44, 4, breadFill(M, R));
  island(I, M, 0.9, 0.0, R);
  island(I, M, -2.5, 0.3, R);
  const ts = placed(I, 4.6, 1.05, -PI / 2, 0.7, 0.5, 0.95);
  put(ts, RB(0.7, 0.85, 0.5, 0.02, 2), M.wood, 0, 0.425, 0);
  for (let k = 0; k < 8; k++) V(ts, CY(0.17, 0.16, 0.014, 24), 0xc9a77c, -0.1, 0.857 + k * 0.016, 0.0, 0, 0, 0, vcGloss());
  for (let k = 0; k < 4; k++) V(ts, RB(0.24, 0.012, 0.025, 0.004, 1), 0xc9ced3, 0.2, 0.86 + k * 0.014, -0.12 + k * 0.08, 0, 0.2, 0, vcGloss());
  wallClock(g, -1.2, 2.92, 1.76, PI, M.A, 0.16);
  art(g, M, 'art0', -XI + 0.02, 1.75, -0.7, PI / 2, 0.5, 0.66);
  art(g, M, 'art1', -XI + 0.02, 1.8, 0.75, PI / 2, 0.64, 0.48);
  pottedPlant(g, -4.85, FL, 1.35, { kind: 'fig', h: 1.5, seed: 11, pot: 'terracotta', potR: 0.22, potH: 0.4 });
  I.colliders.push({ min: [-5.1, 0, 1.1], max: [-4.6, FL + 1.6, 1.6] });
  hangSign(g, M, 'tag0', 4.3, 2.5, -2.4, PI / 2, 0.9);
  hangSign(g, M, 'tag1', 0.0, 2.58, -1.85, 0, 0.8);
  hangSign(g, M, 'tag2', -1.5, 2.58, -1.85, 0, 0.8);
  for (const x of [-4.0, -3.0]) pendant(g, x, 2.2, -2.3, CL, { r: 0.18, shade: 0x2c3a33 });
  for (const [x, z] of [[0.9, 0.0], [-2.5, 0.3]]) pendant(g, x, 2.25, z, CL, { r: 0.26, shade: 0xb8432f });
  for (const [x, z] of [[-4.0, -0.9], [-1.0, -1.0], [2.6, -1.0], [3.4, 0.9], [-1.0, 1.2], [4.0, -3.6], [2.0, -3.6], [-4.3, -3.7], [-1.4, -3.7]]) downlight(g, M, x, z);
  I.lamps.push({ pos: [-2.6, 2.6, -2.6], color: 0xffd9a8, intensity: 10, range: 7 }, { pos: [0.9, 2.6, -0.2], color: 0xffe2b8, intensity: 10, range: 7 }, { pos: [3.8, 2.7, -2.4], color: 0xffe2b8, intensity: 8, range: 6 }, { pos: [-2.5, 2.6, 1.0], color: 0xffe2b8, intensity: 7, range: 6 });
  I.npcSpots.push({ pos: [-2.2, FL, -3.15], yaw: PI, pose: 'stand', role: 'clerk' });
  I.npcSpots.push({ pos: [-3.3, FL, -1.35], yaw: 0, pose: 'stand', role: 'guest' }, { pos: [0.9, FL, 0.95], yaw: 0, pose: 'stand', role: 'guest' }, { pos: [4.25, FL, -2.0], yaw: -PI / 2, pose: 'stand', role: 'guest' });
  I.interactables.push({ id: 'bread', label: '빵 사 먹기 (3,000원)', pos: [-1.6, 1.25, -1.8], radius: 1.5 });
}

function cafeIn(I, M) {
  const g = I.group, R = M.R;
  const cg = counterAt(I, M, 2.3, -2.4, 0, 4.2);
  register(cg, M, -1.55, 1.0, 0.04);
  // pastry case
  V(cg, RB(0.7, 0.04, 0.42, 0.01, 1), 0x6b4529, -0.75, 1.02, 0.04);
  D(cg, BX(0.68, 0.32, 0.4), M.glass, -0.75, 1.2, 0.04);
  V(cg, RB(0.7, 0.025, 0.42, 0.006, 1), DK, -0.75, 1.37, 0.04);
  for (let k = 0; k < 3; k++) { V(cg, CY(0.07, 0.07, 0.008, 16), 0xf4f3ef, -0.97 + k * 0.22, 1.045, 0.04, 0, 0, 0, vcGloss()); V(cg, RB(0.08, 0.07, 0.1, 0.008, 1), [0xf6d7de, 0x6b3f2a, 0xf7efe2][k], -0.97 + k * 0.22, 1.085, 0.04, 0, 0.4, 0, vcGloss()); }
  // espresso machine faces the barista
  const em = group(cg, 0.55, 1.0, -0.06, PI);
  put(em, RB(0.74, 0.42, 0.48, 0.03, 2), M.steel, 0, 0.23, 0);
  V(em, RB(0.76, 0.06, 0.5, 0.02, 2), 0xb8432f, 0, 0.47, 0, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) {
    V(em, CY(0.045, 0.05, 0.06, 16), 0xc9ced3, s * 0.18, 0.2, 0.26, 0, 0, 0, vcGloss());
    V(em, CY(0.042, 0.042, 0.04, 14), DK, s * 0.18, 0.15, 0.27, 0, 0, 0, vcGloss());
    V(em, RB(0.03, 0.03, 0.16, 0.01, 1), DK, s * 0.18, 0.15, 0.38, 0, 0, 0, vcGloss());
    V(em, CY(0.03, 0.03, 0.012, 16), 0xf4f3ef, s * 0.1, 0.36, 0.245, PI / 2, 0, 0);
    mug(em, s * 0.18, 0.02, 0.27, 0xf4f3ef, 0, false);
  }
  put(em, RB(0.62, 0.03, 0.16, 0.006, 1), M.steel, 0, 0.015, 0.3);
  V(em, CY(0.008, 0.008, 0.24, 8), 0xc9ced3, 0.33, 0.22, 0.27, 0.25, 0, 0, vcGloss());
  for (let k = 0; k < 5; k++) mug(em, -0.28 + k * 0.14, 0.5, -0.05, [0xf4f3ef, 0xe7b9a3, 0x9fb3a0, 0x2b2d31][k % 4], 0, false);
  // grinder, cups, tip jar
  V(cg, RB(0.2, 0.3, 0.24, 0.02, 2), DK, 1.45, 1.15, -0.1, 0, 0, 0, vcGloss());
  put(cg, GC('hop', () => lathe([[0, 0], [0.04, 0], [0.11, 0.2], [0.11, 0.22], [0, 0.22]], 18)), M.glass, 1.45, 1.3, -0.1).castShadow = false;
  V(cg, GC('beans', () => lathe([[0, 0], [0.035, 0], [0.09, 0.14], [0, 0.14]], 14)), 0x3b2416, 1.45, 1.305, -0.1);
  for (let k = 0; k < 6; k++) V(cg, CY(0.042, 0.032, 0.11, 14), 0xf4f3ef, 1.85, 1.055 + k * 0.025, -0.15, 0, 0, 0, vcGloss());
  put(cg, GC('jar', () => lathe([[0, 0], [0.09, 0], [0.1, 0.02], [0.1, 0.2], [0.06, 0.24], [0.06, 0.27], [0, 0.27]], 20)), M.glass, -1.15, 1.0, 0.15).castShadow = false;
  // back bar
  const bb = placed(I, 2.5, ZI + 0.32, 0, 4.4, 0.6, 0.95);
  put(bb, RB(4.4, 0.88, 0.58, 0.02, 2), M.counter, 0, 0.44, 0);
  put(bb, RB(4.46, 0.04, 0.62, 0.01, 1), M.top, 0, 0.9, 0);
  for (let k = 0; k < 6; k++) { V(bb, BX(0.006, 0.7, 0.006), 0x1d3a2e, -2.2 + (k + 0.5) * 0.733, 0.46, 0.292); V(bb, RB(0.12, 0.02, 0.03, 0.006, 1), 0xc9ced3, -2.2 + (k + 0.5) * 0.733, 0.78, 0.3, 0, 0, 0, vcGloss()); }
  for (let k = 0; k < 6; k++) bottle(bb, -1.9 + k * 0.1, 0.92, -0.1, [0xb8432f, 0xd9a464, 0x6b3f2a, 0x5fb36e, 0xf2c14e, 0x9b6ad1][k]);
  V(bb, CY(0.08, 0.07, 0.12, 16), DK, 0.9, 0.98, -0.05);
  put(bb, GC('blend', () => lathe([[0, 0], [0.06, 0], [0.09, 0.26], [0, 0.26]], 16)), M.glass, 0.9, 1.04, -0.05).castShadow = false;
  put(bb, RB(0.5, 0.012, 0.36, 0.006, 1), M.steel, 1.6, 0.925, 0);
  V(bb, CY(0.012, 0.012, 0.3, 8), 0xc9ced3, 1.6, 1.07, -0.2, 0, 0, 0, vcGloss());
  for (const y of [1.55, 1.95]) {
    put(g, RB(4.0, 0.04, 0.26, 0.008, 1), M.wood, 2.5, y, ZI + 0.15);
    for (let x = 0.7; x < 4.4; x += 0.27) {
      const t = ((x * 7) | 0) % 3;
      if (t === 0) mug(g, x, y + 0.02, ZI + 0.15, [0xf4f3ef, 0xe7b9a3, 0x9fb3a0, 0x2b2d31][((x * 3) | 0) % 4], R() * PI, false);
      else if (t === 1) artBox(g, M, x, y + 0.02, ZI + 0.15, 0.13, 0.19, 0.08, (x * 5) | 0);
      else { put(g, GC('cjar', () => lathe([[0, 0], [0.05, 0], [0.05, 0.16], [0, 0.16]], 14)), M.glass, x, y + 0.02, ZI + 0.15).castShadow = false; V(g, CY(0.045, 0.045, 0.1, 12), 0x3b2416, x, y + 0.07, ZI + 0.15); V(g, CY(0.053, 0.053, 0.02, 14), 0x6b4529, x, y + 0.19, ZI + 0.15); }
    }
  }
  art(g, M, 'menuBig', 2.5, 2.66, ZI + 0.02, 0, 1.8, 0.9, 0x6b4529, true);
  // seating
  const guests = [];
  guests.push(cafeTable(I, M, -4.55, -3.3, 'x', R)[0]);
  guests.push(cafeTable(I, M, -4.55, -1.4, 'x', R)[0]);
  cafeTable(I, M, -1.5, 0.8, 'z', R);
  guests.push(cafeTable(I, M, 0.9, 0.8, 'z', R)[1]);
  sofa(g, 4.85, FL, 0.2, -PI / 2, { w: 2.4, fabric: mat('fabricGreen'), pillows: [0xe0b25a, 0xf1ece4, 0xb8432f] });
  I.colliders.push({ min: [4.4, 0, -1.0], max: [XI, FL + 0.9, 1.4] });
  for (const tz of [-0.4, 0.8]) {
    put(g, RB(0.62, 0.035, 0.62, 0.01, 1), M.top, 3.95, FL + 0.72, tz);
    V(g, CY(0.025, 0.025, 0.7, 8), DK, 3.95, FL + 0.36, tz, 0, 0, 0, vcGloss());
    V(g, RB(0.4, 0.02, 0.4, 0.008, 1), DK, 3.95, FL + 0.01, tz);
    I.colliders.push({ min: [3.64, 0, tz - 0.31], max: [4.26, FL + 0.74, tz + 0.31] });
    cafeChair(g, 3.32, FL, tz, PI / 2, tz > 0 ? 1 : 2);
    mug(g, 3.9, FL + 0.738, tz + 0.1, 0xf4f3ef, 0.4);
  }
  pottedPlant(g, -4.95, FL, 1.45, { kind: 'fig', h: 1.6, seed: 21, pot: 'charcoal', potR: 0.22, potH: 0.42 });
  pottedPlant(g, 4.95, FL, -1.6, { kind: 'snake', h: 0.9, seed: 22, pot: 'terracotta', potR: 0.18, potH: 0.36 });
  I.colliders.push({ min: [-5.2, 0, 1.2], max: [-4.7, FL + 1.6, 1.7] }, { min: [4.75, 0, -1.8], max: [5.15, FL + 1.0, -1.4] });
  // beams, lights, art, signs
  for (const z of [-3.0, -0.6, 1.4]) V(g, RB(2 * XI, 0.16, 0.14, 0.01, 1), 0x4a2f1e, 0, CL - 0.1, z);
  for (const x of [0.9, 2.3, 3.7]) pendant(g, x, 2.25, -2.4, CL, { r: 0.15, shade: 0x2f5d4a });
  for (const [x, z] of [[-4.55, -3.3], [-4.55, -1.4], [-1.5, 0.8], [0.9, 0.8], [3.95, -0.4], [3.95, 0.8]]) pendant(g, x, 2.05, z, CL, { r: 0.2, shade: 0xd9a464 });
  for (const [x, z] of [[-2.6, -2.2], [-2.6, 0.2], [-0.3, -1.2], [2.0, -1.2]]) downlight(g, M, x, z);
  art(g, M, 'art1', -XI + 0.02, 1.75, -2.35, PI / 2, 0.8, 0.6);
  art(g, M, 'art0', -XI + 0.02, 1.75, -0.5, PI / 2, 0.45, 0.6);
  art(g, M, 'art0', XI - 0.02, 1.75, 0.2, -PI / 2, 0.45, 0.6, 0xd9a464);
  wallClock(g, -0.6, 2.92, 1.76, PI, M.A, 0.16);
  hangSign(g, M, 'tag0', 0.9, 2.62, -1.95, 0, 0.8);
  hangSign(g, M, 'tag1', 3.9, 2.62, -1.95, 0, 0.8);
  I.lamps.push({ pos: [2.3, 2.5, -2.6], color: 0xffd2a0, intensity: 10, range: 7 }, { pos: [-3.6, 2.4, -2.2], color: 0xffd2a0, intensity: 9, range: 7 }, { pos: [0.0, 2.4, 0.6], color: 0xffd2a0, intensity: 9, range: 7 }, { pos: [3.9, 2.4, 0.2], color: 0xffd2a0, intensity: 7, range: 6 });
  I.npcSpots.push({ pos: [2.0, FL, -3.25], yaw: PI, pose: 'stand', role: 'clerk' });
  for (const s of guests) I.npcSpots.push({ ...s, pose: 'sit', role: 'guest' });
  I.npcSpots.push({ pos: [4.75, FL, -0.4], yaw: PI / 2, pose: 'sit', role: 'guest' });
  I.interactables.push({ id: 'cafe', label: '음료 마시기 (4,000원)', pos: [0.75, 1.25, -1.85], radius: 1.5 });
}

function hospitalIn(I, M) {
  const g = I.group, R = M.R;
  const PZ = -1.6, PX = -0.6, DX0 = -2.1, DX1 = -0.9;
  // consulting room partitions (back left), doorway DX0..DX1
  for (const [x0, x1] of [[-XI, DX0], [DX1, PX + 0.05]]) { bx(g, M.wall, x0, FL, PZ - 0.05, x1, CL, PZ + 0.05); I.colliders.push({ min: [x0, 0, PZ - 0.05], max: [x1, CL, PZ + 0.05] }); }
  bx(g, M.wall, DX0, 2.3, PZ - 0.05, DX1, CL, PZ + 0.05);
  bx(g, M.wall, PX - 0.05, FL, ZI, PX + 0.05, CL, PZ - 0.05);
  I.colliders.push({ min: [PX - 0.05, 0, ZI], max: [PX + 0.05, CL, PZ] });
  for (const s of [-1, 1]) {
    for (const [x0, x1] of [[-XI + 0.02, DX0], [DX1, PX + (s > 0 ? 0.05 : -0.05)]]) bx(g, M.wain, x0, FL, PZ + s * 0.05, x1, FL + 0.95, PZ + s * 0.065);
    bx(g, M.wain, PX + s * 0.05, FL, ZI + 0.02, PX + s * 0.065, FL + 0.95, PZ + s * 0.05);
  }
  for (const s of [-1, 1]) V(g, RB(0.07, 2.18, 0.14, 0.01, 1), 0xeceae5, (s < 0 ? DX0 : DX1) - s * 0.035, FL + 1.09, PZ);
  V(g, RB(DX1 - DX0 + 0.14, 0.07, 0.14, 0.01, 1), 0xeceae5, (DX0 + DX1) / 2, FL + 2.18, PZ);
  // door swung open into the room, resting against the partition
  put(g, RB(1.0, 2.08, 0.04, 0.006, 1), mat('whiteWood'), DX0 - 0.52, FL + 1.05, PZ - 0.09);
  put(g, RB(0.14, 0.02, 0.06, 0.006, 1), M.steel, DX0 - 0.9, FL + 1.0, PZ - 0.14);
  I.colliders.push({ min: [DX0 - 1.04, 0, PZ - 0.12], max: [DX0, FL + 2.1, PZ - 0.05] });
  const ds = group(g, (DX0 + DX1) / 2, FL + 2.48, PZ + 0.055);
  V(ds, RB(0.86, 0.24, 0.02, 0.008, 1), 0x1f5f9a, 0, 0, 0);
  D(ds, M.A.quad('tag1', 0.8, 0.2), M.P, 0, 0, 0.011);
  // consulting room: desk, doctor chair, patient stool, exam bed, sink, eye chart, x-ray box
  const dk = placed(I, -3.5, ZI + 0.37, 0, 1.6, 0.7, 0.77);
  put(dk, RB(1.6, 0.04, 0.7, 0.01, 1), M.wood, 0, 0.75, 0);
  V(dk, RB(0.44, 0.72, 0.64, 0.01, 1), 0xeceae5, -0.56, 0.36, 0);
  for (let k = 0; k < 3; k++) { V(dk, BX(0.4, 0.004, 0.2), 0xd0d3d6, -0.56, 0.15 + k * 0.23, 0.322); V(dk, RB(0.12, 0.015, 0.02, 0.005, 1), 0xc9ced3, -0.56, 0.24 + k * 0.23, 0.33, 0, 0, 0, vcGloss()); }
  for (const s of [-1, 1]) V(dk, RB(0.04, 0.73, 0.6, 0.01, 1), 0xd0d3d6, 0.76 * (s > 0 ? 1 : 0) + (s < 0 ? -0.32 : 0), 0.365, 0);
  V(dk, RB(0.56, 0.34, 0.025, 0.008, 1), DK, 0.15, 1.13, -0.1);
  D(dk, M.A.quad('pos', 0.52, 0.3), M.L, 0.15, 1.13, -0.086);
  V(dk, RB(0.05, 0.2, 0.03, 0.008, 1), DK, 0.15, 0.87, -0.13);
  V(dk, RB(0.24, 0.012, 0.16, 0.005, 1), DK, 0.15, 0.776, -0.13);
  V(dk, RB(0.42, 0.018, 0.14, 0.005, 1), DK, 0.15, 0.78, 0.13);
  V(dk, BX(0.21, 0.01, 0.3), 0xfbfbf8, -0.45, 0.775, 0.1, 0, 0.2, 0);
  V(dk, GC('steth', () => torus(0.09, 0.008, 6, 24)), DK, 0.6, 0.778, 0.12, -PI / 2, 0, 0);
  V(dk, CY(0.02, 0.02, 0.012, 14), 0xc9ced3, 0.68, 0.778, 0.06, 0, 0, 0, vcGloss());
  officeChair(g, -3.05, FL, -3.3, PI / 2);
  const st = group(g, -2.05, FL, -3.3);
  V(st, CY(0.2, 0.2, 0.07, 24), 0x3f8f9a, 0, 0.5, 0, 0, 0, 0, vcSoft());
  V(st, CY(0.025, 0.025, 0.42, 10), 0xc9ced3, 0, 0.25, 0, 0, 0, 0, vcGloss());
  for (let k = 0; k < 5; k++) { const a = k * 1.2566; V(st, RB(0.24, 0.025, 0.04, 0.008, 1), DK, Math.sin(a) * 0.12, 0.04, Math.cos(a) * 0.12, 0, a + PI / 2, 0); V(st, SP(0.022, 8, 6), DK, Math.sin(a) * 0.23, 0.022, Math.cos(a) * 0.23); }
  I.colliders.push({ min: [-2.25, 0, -3.5], max: [-1.85, FL + 0.55, -3.1] });
  const bd = placed(I, -4.25, -1.97, 0, 1.9, 0.62, 0.7);
  put(bd, RB(1.86, 0.06, 0.58, 0.01, 1), M.steel, 0, 0.47, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(bd, RB(0.04, 0.47, 0.04, 0.01, 1), M.steel, sx * 0.88, 0.235, sz * 0.25);
  V(bd, RB(1.9, 0.12, 0.62, 0.04, 2), 0x4f9aa6, 0, 0.56, 0, 0, 0, 0, vcSoft());
  V(bd, RB(0.5, 0.12, 0.6, 0.04, 2), 0x4f9aa6, -0.68, 0.65, 0, 0, 0, 0.22, vcSoft());
  V(bd, BX(1.3, 0.005, 0.5), 0xf7f6f1, 0.25, 0.623, 0);
  V(bd, CY(0.06, 0.06, 0.55, 14), 0xf7f6f1, 0.96, 0.58, 0, PI / 2, 0, 0);
  V(g, RB(0.45, 0.2, 0.3, 0.02, 2), 0x8a9096, -4.3, FL + 0.1, -2.5);
  V(g, BX(2.2, 0.02, 0.03), 0xc9ced3, -4.2, CL - 0.03, -2.6);
  for (let k = 0; k < 7; k++) V(g, RB(0.09, 2.15, 0.04, 0.02, 2), 0xa9c9de, -5.22 + k * 0.075, CL - 0.06 - 1.075, -2.6 + (k % 2) * 0.03, 0, 0, 0, vcSoft());
  const sk = placed(I, -1.15, ZI + 0.27, 0, 0.9, 0.5, 0.9);
  V(sk, RB(0.9, 0.86, 0.5, 0.015, 2), 0xeceae5, 0, 0.43, 0);
  put(sk, RB(0.92, 0.03, 0.52, 0.008, 1), M.top, 0, 0.875, 0);
  put(sk, GC('basin', () => lathe([[0, 0], [0.15, 0], [0.2, 0.1], [0.21, 0.12], [0, 0.12]], 24)), mat('ceramic'), 0, 0.8, 0.02);
  V(sk, CY(0.015, 0.015, 0.2, 10), 0xc9ced3, 0, 0.98, -0.18, 0, 0, 0, vcGloss());
  V(sk, CY(0.012, 0.012, 0.12, 10), 0xc9ced3, 0, 1.07, -0.13, PI / 2, 0, 0, vcGloss());
  bottle(sk, 0.32, 0.89, -0.1, 0x5fb36e);
  V(g, RB(0.3, 0.38, 0.12, 0.02, 2), 0xf4f3ef, -1.15, 1.75, ZI + 0.08);
  put(g, RB(0.8, 0.03, 0.22, 0.008, 1), M.wood, -1.15, 2.15, ZI + 0.12);
  for (let k = 0; k < 3; k++) artBox(g, M, -1.4 + k * 0.25, 2.165, ZI + 0.12, 0.2, 0.12, 0.12, k + 2);
  art(g, M, 'eye', -XI + 0.02, 1.75, -3.0, PI / 2, 0.42, 0.66, 0xf4f4f1);
  art(g, M, 'xray', -3.5, 1.85, ZI + 0.02, 0, 0.64, 0.48, 0xeceae5, true);
  art(g, M, 'art1', PX - 0.05, 1.8, -3.2, -PI / 2, 0.64, 0.48);
  // reception
  const rc = counterAt(I, M, 3.0, -2.0, 0, 3.2, { h: 1.05 });
  for (const lx of [-0.6, 0.7]) {
    const mg = group(rc, lx, 1.05, -0.12, PI);
    V(mg, RB(0.52, 0.32, 0.025, 0.008, 1), DK, 0, 0.3, 0);
    D(mg, M.A.quad('pos', 0.48, 0.28), M.L, 0, 0.3, 0.014);
    V(mg, RB(0.05, 0.18, 0.03, 0.008, 1), DK, 0, 0.12, -0.03);
    V(mg, RB(0.22, 0.012, 0.15, 0.005, 1), DK, 0, 0.006, -0.03);
  }
  register(rc, M, 1.3, 1.05, 0.05);
  bottle(rc, -1.3, 1.05, 0.15, 0x9fd3ff);
  V(rc, RB(0.2, 0.26, 0.18, 0.02, 2), 0xf4f3ef, -1.0, 1.18, 0.12);
  V(rc, BX(0.06, 0.004, 0.08), 0xfbfbf8, -1.0, 1.2, 0.215, -0.5, 0, 0);
  pottedPlant(rc, 0.1, 1.05, 0.12, { kind: 'herb', h: 0.3, potR: 0.06, potH: 0.12, pot: 'white', seed: 31 });
  shelfUnit(I, M, 3.0, ZI + 0.2, 0, 3.0, 1.9, 0.36, 4, (sg, i, y, x0, x1) => { for (let x = x0 + 0.05; x < x1 - 0.5; x += 0.55) binders(sg, x, y, -0.02, 0, 8, R); }, { price: false });
  hangSign(g, M, 'tag0', 3.0, 2.6, -2.0, 0, 1.0);
  // waiting area
  const tv = group(g, -3.5, 2.05, PZ + 0.05);
  V(tv, RB(1.32, 0.76, 0.05, 0.01, 1), DK, 0, 0, 0.025);
  D(tv, M.A.quad('tv', 1.24, 0.7), M.L, 0, 0, 0.051);
  const nb = group(g, -4.85, 2.05, PZ + 0.05);
  V(nb, RB(0.62, 0.24, 0.05, 0.01, 1), DK, 0, 0, 0.025);
  D(nb, M.A.quad('num', 0.58, 0.2), M.L, 0, 0, 0.051);
  const rowA = beamSeats(I, M, -3.55, -0.5, PI, 4);
  beamSeats(I, M, -3.55, 0.95, PI, 4, 0x6aa7c9);
  const rowC = beamSeats(I, M, XI - 0.33, 0.55, -PI / 2, 3);
  waterCooler(g, 0.35, FL, -3.95);
  I.colliders.push({ min: [0.15, 0, -4.15], max: [0.55, FL + 1.5, -3.75] });
  pottedPlant(g, -0.25, FL, -1.25, { kind: 'fig', h: 1.4, seed: 32, pot: 'white', potR: 0.2, potH: 0.38 });
  pottedPlant(g, 1.2, FL, 1.4, { kind: 'palm', h: 1.1, seed: 33, pot: 'white', potR: 0.2, potH: 0.38 });
  I.colliders.push({ min: [-0.45, 0, -1.45], max: [-0.05, FL + 1.4, -1.05] }, { min: [1.0, 0, 1.2], max: [1.4, FL + 1.2, 1.6] });
  const mr = placed(I, 1.25, -0.3, -PI / 2, 0.6, 0.3, 1.0);
  V(mr, RB(0.6, 1.0, 0.3, 0.015, 2), 0xd8cfc0, 0, 0.5, 0);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) artBox(mr, M, -0.14 + j * 0.28, 0.12 + k * 0.3, 0.12, 0.22, 0.26, 0.02, k * 2 + j);
  wallClock(g, 3.0, 2.92, 1.76, PI, M.A, 0.16);
  art(g, M, 'art0', XI - 0.02, 1.75, -0.95, -PI / 2, 0.45, 0.6, 0xf4f4f1);
  art(g, M, 'menuBig', -XI + 0.02, 1.85, -0.25, PI / 2, 1.2, 0.6, 0xeceae5);
  for (const [x, z] of [[-3.5, 0.25], [-1.2, 0.25], [1.6, -0.6], [3.6, -0.6], [3.6, 1.0], [-3.3, -3.0], [-1.6, -3.4], [2.6, -3.6]]) panelLight(g, M, x, z, 1.1, 0.3, M.cool);
  I.lamps.push({ pos: [-3.0, 2.8, 0.2], color: 0xf1f5ff, intensity: 10, range: 7 }, { pos: [3.0, 2.8, -1.2], color: 0xf1f5ff, intensity: 10, range: 7 }, { pos: [-3.2, 2.8, -3.0], color: 0xf4f6ff, intensity: 9, range: 6 }, { pos: [1.5, 2.8, 0.8], color: 0xf1f5ff, intensity: 7, range: 6 });
  I.npcSpots.push({ pos: [3.0, FL, -2.75], yaw: PI, pose: 'stand', role: 'staff' });
  I.npcSpots.push({ pos: [-3.05, FL, -3.3], yaw: -PI / 2, pose: 'sit', role: 'staff' });
  I.npcSpots.push({ ...rowA[0], pose: 'sit', role: 'guest' }, { ...rowA[2], pose: 'sit', role: 'guest' }, { ...rowC[1], pose: 'sit', role: 'guest' });
  I.interactables.push({ id: 'doctor', label: '진료 받기', pos: [-2.35, 1.2, -2.95], radius: 1.4, seat: { pos: [-2.05, FL + 1.12, -3.3], yaw: PI / 2, pitch: -0.08 } });
}

function pharmacyIn(I, M) {
  const g = I.group, R = M.R;
  const cg = counterAt(I, M, 0.5, -2.2, 0, 4.0);
  register(cg, M, 1.3, 1.0, 0.03);
  V(cg, RB(0.3, 0.02, 0.2, 0.006, 1), 0x3b8fd6, 0.25, 1.01, 0.08, 0, 0.2, 0, vcGloss());
  for (let k = 0; k < 9; k++) V(cg, SP(0.009, 6, 4), 0xf7f6f1, 0.2 + (k % 3) * 0.04, 1.025, 0.04 + ((k / 3) | 0) * 0.04, 0, 0, 0, vcGloss());
  for (let k = 0; k < 5; k++) V(cg, BX(0.18, 0.004, 0.28), 0xf7f6f1, -0.4, 1.002 + k * 0.004, 0.0, 0, (R() - 0.5) * 0.2, 0);
  V(cg, RB(0.16, 0.24, 0.08, 0.006, 1), 0xf7f6f1, -0.75, 1.12, -0.12);
  put(cg, RB(0.6, 0.06, 0.3, 0.008, 1), M.wood, -1.45, 1.03, 0.05);
  put(cg, RB(0.6, 0.06, 0.15, 0.008, 1), M.wood, -1.45, 1.09, -0.03);
  for (let k = 0; k < 6; k++) { V(cg, BX(0.07, 0.11, 0.05), MEDC[(k + 1) % 8], -1.68 + k * 0.09, 1.115, 0.13); V(cg, BX(0.07, 0.11, 0.05), MEDC[(k + 4) % 8], -1.68 + k * 0.09, 1.175, -0.03); }
  V(cg, GC('bell', () => lathe([[0, 0], [0.045, 0], [0.04, 0.02], [0.02, 0.05], [0.006, 0.06], [0, 0.06]], 16)), 0xd8b25a, 0.85, 1.0, 0.18, 0, 0, 0, vcGloss());
  shelfUnit(I, M, -0.75, ZI + 0.21, 0, 2.3, 2.4, 0.4, 6, medFill(M, R), { back: 0xf4f3ef });
  shelfUnit(I, M, 1.55, ZI + 0.21, 0, 2.3, 2.4, 0.4, 6, medFill(M, R), { back: 0xf4f3ef });
  const dr = placed(I, 3.4, ZI + 0.24, 0, 1.2, 0.46, 1.1);
  V(dr, RB(1.2, 1.1, 0.46, 0.01, 1), 0xf1efe9, 0, 0.55, 0);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { V(dr, RB(0.18, 0.16, 0.012, 0.004, 1), 0xfafaf7, -0.5 + c * 0.2, 0.12 + r * 0.175, 0.235); V(dr, BX(0.06, 0.012, 0.012), 0x9a9ea3, -0.5 + c * 0.2, 0.17 + r * 0.175, 0.245); }
  put(dr, RB(1.24, 0.03, 0.5, 0.008, 1), M.top, 0, 1.115, 0);
  art(g, M, 'menuBig', 3.4, 2.05, ZI + 0.02, 0, 1.1, 0.55, 0xeceae5);
  shelfUnit(I, M, -3.2, -0.1, -PI / 2, 2.4, 1.45, 0.38, 4, medFill(M, R), { back: 0xf4f3ef });
  shelfUnit(I, M, -2.8, -0.1, PI / 2, 2.4, 1.45, 0.38, 4, medFill(M, R), { back: 0xf4f3ef });
  shelfUnit(I, M, -XI + 0.2, -2.9, PI / 2, 2.6, 2.0, 0.4, 5, medFill(M, R), { back: 0xf4f3ef });
  shelfUnit(I, M, -XI + 0.2, -0.2, PI / 2, 2.6, 2.0, 0.4, 5, medFill(M, R), { back: 0xf4f3ef });
  // drinks fridge
  const fr = placed(I, XI - 0.36, -3.4, -PI / 2, 0.8, 0.7, 2.0);
  V(fr, RB(0.8, 2.0, 0.7, 0.02, 2), 0xeeeeea, 0, 1.0, 0);
  V(fr, RB(0.7, 1.6, 0.02, 0.006, 1), 0xf7f6f1, 0, 1.0, -0.28);
  for (let s = 0; s < 5; s++) { put(fr, RB(0.68, 0.012, 0.56, 0.004, 1), M.steel, 0, 0.3 + s * 0.32, 0); for (let k = 0; k < 6; k++) V(fr, GC('vit', () => lathe([[0, 0], [0.025, 0], [0.026, 0.09], [0.015, 0.12], [0.015, 0.14], [0, 0.14]], 12)), s % 2 ? 0x8a4a1a : 0xf2c14e, -0.28 + k * 0.11, 0.31 + s * 0.32, 0.12, 0, 0, 0, vcGloss()); }
  D(fr, BX(0.66, 1.6, 0.01), M.glass, 0, 1.0, 0.352);
  V(fr, RB(0.8, 0.22, 0.03, 0.01, 1), 0x2f8a5a, 0, 1.9, 0.355);
  D(fr, BX(0.6, 0.008, 0.02), M.cool, 0, 1.78, 0.3);
  // blood pressure machine and bench
  const bp = placed(I, XI - 0.3, -1.65, -PI / 2, 0.55, 0.5, 1.15);
  V(bp, RB(0.55, 1.15, 0.5, 0.03, 2), 0xf1efe9, 0, 0.575, 0);
  V(bp, GC('cuff', () => torus(0.12, 0.04, 10, 24)), 0x3b8fd6, 0, 0.85, 0.26, 0, 0, 0, vcGloss());
  V(bp, RB(0.3, 0.2, 0.02, 0.01, 1), DK, 0, 0.5, 0.26);
  D(bp, M.A.quad('pos', 0.26, 0.16), M.L, 0, 0.5, 0.272);
  V(g, CY(0.2, 0.2, 0.06, 20), 0x2f8a5a, 4.45, FL + 0.46, -1.65, 0, 0, 0, vcSoft());
  V(g, CY(0.025, 0.025, 0.44, 10), 0xc9ced3, 4.45, FL + 0.22, -1.65, 0, 0, 0, vcGloss());
  V(g, CY(0.2, 0.22, 0.02, 20), DK, 4.45, FL + 0.01, -1.65);
  const bn = placed(I, XI - 0.26, 0.45, -PI / 2, 1.3, 0.45, 0.46);
  for (let k = 0; k < 4; k++) put(bn, RB(1.3, 0.03, 0.1, 0.01, 1), M.wood, 0, 0.44, -0.16 + k * 0.105);
  for (const s of [-1, 1]) V(bn, RB(0.05, 0.43, 0.38, 0.01, 1), DK, s * 0.58, 0.215, 0);
  // signs, posters, lights
  hangSign(g, M, 'tag0', -0.6, 2.62, -2.2, 0, 0.9);
  hangSign(g, M, 'tag2', 1.6, 2.62, -2.2, 0, 0.9);
  hangSign(g, M, 'tag1', -3.0, 2.55, -0.1, PI / 2, 0.9);
  art(g, M, 'art0', XI - 0.02, 1.75, 0.45, -PI / 2, 0.45, 0.6, 0xf4f4f1);
  art(g, M, 'art1', XI - 0.02, 1.75, -0.8, -PI / 2, 0.5, 0.38, 0xf4f4f1);
  wallClock(g, 0.3, 2.92, 1.76, PI, M.A, 0.16);
  pottedPlant(g, 2.35, FL, 1.4, { kind: 'snake', h: 0.9, seed: 41, pot: 'white', potR: 0.18, potH: 0.34 });
  I.colliders.push({ min: [2.15, 0, 1.2], max: [2.55, FL + 1.0, 1.6] });
  for (const [x, z] of [[-3.6, -2.6], [-3.6, 0.6], [-1.0, -0.6], [1.4, -0.6], [3.6, -0.6], [0.5, -3.4], [3.6, 1.0], [1.0, 1.0]]) panelLight(g, M, x, z, 1.1, 0.3, M.cool);
  I.lamps.push({ pos: [0.5, 2.8, -2.6], color: 0xf1f5ff, intensity: 10, range: 7 }, { pos: [-3.0, 2.8, -0.4], color: 0xf1f5ff, intensity: 10, range: 7 }, { pos: [3.5, 2.8, -0.6], color: 0xf1f5ff, intensity: 8, range: 6 });
  I.npcSpots.push({ pos: [0.5, FL, -3.0], yaw: PI, pose: 'stand', role: 'staff' });
  I.npcSpots.push({ pos: [0.9, FL, -1.3], yaw: 0, pose: 'stand', role: 'guest' }, { pos: [-2.2, FL, 0.3], yaw: PI / 2, pose: 'stand', role: 'guest' }, { pos: [4.85, FL, 0.45], yaw: PI / 2, pose: 'sit', role: 'guest' });
  I.interactables.push({ id: 'medicine', label: '약 사기 (2,000원)', pos: [0.9, 1.2, -1.75], radius: 1.5 });
}

function bookstoreIn(I, M) {
  const g = I.group, R = M.R;
  const shelf = (x, z, ry, seed, w = 1.9) => { bookshelf(g, x, FL, z, ry, { w, h: 2.4, d: 0.38, seed, wood: M.wood, shelves: 6 }); const q = Math.abs(Math.sin(ry)) > 0.5; I.colliders.push({ min: [x - (q ? 0.19 : w / 2), 0, z - (q ? w / 2 : 0.19)], max: [x + (q ? 0.19 : w / 2), FL + 2.4, z + (q ? w / 2 : 0.19)] }); };
  shelf(-1.3, ZI + 0.2, 0, 1); shelf(0.65, ZI + 0.2, 0, 2); shelf(2.6, ZI + 0.2, 0, 3);
  shelf(XI - 0.2, -3.4, -PI / 2, 4); shelf(XI - 0.2, -1.45, -PI / 2, 5);
  shelf(-XI + 0.2, 0.0, PI / 2, 6);
  // rolling ladder on the back shelves
  const ld = group(g, 1.7, FL, ZI + 0.62);
  for (const s of [-1, 1]) V(ld, RB(0.04, 2.5, 0.05, 0.01, 1), 0x4a2f1e, s * 0.22, 1.2, 0, -0.17, 0, 0);
  for (let k = 0; k < 7; k++) { const y = 0.25 + k * 0.32; V(ld, RB(0.44, 0.03, 0.06, 0.008, 1), 0x6b4529, 0, y, -(y - 1.2) * 0.172); }
  V(ld, BX(0.6, 0.02, 0.02), 0xc9a33a, 0, 2.36, -0.22);
  // display tables with new books
  for (const [tx, tz] of [[0.0, -1.6], [0.0, 0.25]]) {
    const t = placed(I, tx, tz, 0, 1.4, 0.9, 0.8);
    put(t, RB(1.4, 0.05, 0.9, 0.015, 2), M.wood, 0, 0.74, 0);
    put(t, RB(1.3, 0.62, 0.8, 0.01, 1), M.wood, 0, 0.405, 0);
    let k = (tz > 0 ? 4 : 0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++, k++) {
      const bx0 = -0.45 + i * 0.45, bz = -0.2 + j * 0.4, n = 2 + ((R() * 4) | 0);
      for (let h = 0; h < n; h++) V(t, RB(0.22, 0.03, 0.3, 0.004, 1), PALX[(k + h) % 8], bx0, 0.78 + h * 0.031, bz, 0, (R() - 0.5) * 0.15, 0);
      D(t, M.A.quad('cover' + (k % 8), 0.2, 0.27).rotateX(-PI / 2), M.P, bx0, 0.765 + n * 0.031 + 0.001, bz);
    }
    const st = group(t, 0.55, 0.765, 0.25, 0); st.rotation.x = -0.25;
    V(st, RB(0.24, 0.32, 0.02, 0.005, 1), DK, 0, 0.16, 0);
  }
  hangSign(g, M, 'tag1', 0.0, 2.55, -1.6, 0, 0.9);
  // counter by the window (customers on -Z)
  const cg = counterAt(I, M, 3.1, 0.25, PI, 2.0);
  register(cg, M, 0.45, 1.0, 0.0);
  for (let k = 0; k < 4; k++) V(cg, RB(0.2, 0.03, 0.28, 0.004, 1), PALX[(k * 3) % 8], -0.35, 1.015 + k * 0.03, 0.0, 0, k * 0.1, 0);
  V(cg, RB(0.16, 0.12, 0.08, 0.008, 1), 0x6b4529, -0.75, 1.06, 0.15);
  for (let k = 0; k < 6; k++) V(cg, BX(0.025, 0.14, 0.004), PALX[k], -0.81 + k * 0.025, 1.14, 0.15, 0, 0, (k - 2.5) * 0.06);
  pottedPlant(cg, 0.85, 1.0, 0.1, { kind: 'bush', h: 0.3, potR: 0.07, potH: 0.12, pot: 'terracotta', seed: 51 });
  hangSign(g, M, 'tag2', 3.1, 2.6, 0.25, 0, 0.8);
  // picture-book corner: rug, low face-out shelves, a little bench, cushions, bunting
  V(g, CY(1.25, 1.25, 0.012, 48), 0xe8c66a, -3.85, FL + 0.006, -3.0, 0, 0, 0, vcSoft());
  V(g, CY(0.95, 0.95, 0.014, 48), 0xf3e2b0, -3.85, FL + 0.007, -3.0, 0, 0, 0, vcSoft());
  V(g, CY(0.55, 0.55, 0.016, 40), 0x9fc6a0, -3.85, FL + 0.008, -3.0, 0, 0, 0, vcSoft());
  shelfUnit(I, M, -XI + 0.18, -2.9, PI / 2, 2.2, 1.15, 0.32, 3, (sg, i, y, x0, x1, d) => {
    for (let x = x0 + 0.14, k = i * 3; x < x1 - 0.12; x += 0.27, k++) {
      const bg = group(sg, x, y, d / 2 - 0.1, 0); bg.rotation.x = -0.2;
      V(bg, RB(0.22, 0.28, 0.012, 0.004, 1), PALX[k % 8], 0, 0.14, 0);
      D(bg, M.A.quad('cover' + (k % 8), 0.21, 0.27), M.P, 0, 0.14, 0.0065);
    }
    V(sg, RB(x1 - x0, 0.05, 0.012, 0.004, 1), 0xf2c14e, (x0 + x1) / 2, y + 0.03, d / 2 - 0.01);
  }, { body: mat('birch'), back: 0xfff3d6, price: false });
  const bn = placed(I, -3.85, ZI + 0.25, 0, 1.4, 0.4, 0.42);
  V(bn, RB(1.4, 0.06, 0.4, 0.02, 2), 0xf2c14e, 0, 0.33, 0, 0, 0, 0, vcGloss());
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) V(bn, RB(0.06, 0.31, 0.06, 0.01, 1), 0xe0574a, sx * 0.62, 0.155, sz * 0.14, 0, 0, 0, vcGloss());
  V(bn, RB(1.3, 0.05, 0.36, 0.02, 2), 0x4a92dd, 0, 0.385, 0, 0, 0, 0, vcSoft());
  plush(bn, 0.48, 0.41, 0.0, 1.5, 0xc88a4f);
  for (let k = 0; k < 2; k++) V(bn, RB(0.2, 0.025, 0.27, 0.004, 1), PALX[k + 3], 0.15 + k * 0.03, 0.42 + k * 0.026, -0.02, 0, 0.3 * k, 0);
  V(g, RB(0.5, 0.12, 0.5, 0.06, 3), 0x4a92dd, -3.0, FL + 0.06, -2.4, 0, 0.4, 0, vcSoft());
  V(g, RB(0.5, 0.12, 0.5, 0.06, 3), 0xff9ec4, -3.6, FL + 0.06, -2.05, 0, -0.3, 0, vcSoft());
  for (let k = 0; k < 4; k++) {
    const bk = group(g, -4.3 + k * 0.42, FL + 0.016, -2.8 + (k % 2) * 0.35, R() * PI);
    V(bk, RB(0.2, 0.02, 0.27, 0.004, 1), PALX[(k + 5) % 8], 0, 0.01, 0);
    D(bk, M.A.quad('cover' + ((k + 2) % 8), 0.19, 0.26).rotateX(-PI / 2), M.P, 0, 0.0205, 0);
  }
  V(g, BX(2.7, 0.006, 0.006), 0x8a7a6a, -3.95, 2.35, ZI + 0.05);
  const flag = GC('flag', () => cyl(0.085, 0.085, 0.004, 3));
  for (let k = 0; k < 14; k++) V(g, flag, PALX[k % 8], -5.2 + k * 0.19, 2.29, ZI + 0.05, PI / 2, 0, 0, vcSoft());
  hangSign(g, M, 'tag0', -3.85, 2.55, -2.5, 0, 0.9);
  art(g, M, 'art0', -XI + 0.02, 1.8, -3.5, PI / 2, 0.42, 0.56, 0xf2c14e);
  art(g, M, 'art1', -XI + 0.02, 1.8, -2.3, PI / 2, 0.56, 0.42, 0x4a92dd);
  art(g, M, 'menuBig', -1.0, 2.75, 1.75, PI, 1.2, 0.6, 0x4a2f1e);
  wallClock(g, 1.6, 2.92, 1.76, PI, M.A, 0.16);
  pottedPlant(g, -4.95, FL, 1.45, { kind: 'palm', h: 1.3, seed: 52, pot: 'stone', potR: 0.2, potH: 0.4 });
  I.colliders.push({ min: [-5.15, 0, 1.25], max: [-4.75, FL + 1.3, 1.65] });
  // lights
  for (const [x, z] of [[0, -1.6], [0, 0.25]]) pendant(g, x, 2.25, z, CL, { r: 0.22, shade: 0x2f5d4a });
  pendant(g, -3.85, 2.3, -3.0, CL, { r: 0.28, shade: 0xf2c14e });
  for (const [x, z] of [[-1.3, -3.6], [0.65, -3.6], [2.6, -3.6], [4.3, -3.4], [4.3, -1.45], [-4.3, 0.0], [-2.4, -0.8], [2.0, -1.3], [3.1, 1.0], [-2.4, 1.0]]) downlight(g, M, x, z);
  I.lamps.push({ pos: [0.6, 2.6, -2.6], color: 0xffdcae, intensity: 10, range: 7 }, { pos: [-3.85, 2.4, -3.0], color: 0xffd9a0, intensity: 9, range: 6 }, { pos: [3.4, 2.6, -1.0], color: 0xffdcae, intensity: 9, range: 7 }, { pos: [-2.0, 2.6, 0.6], color: 0xffdcae, intensity: 7, range: 6 });
  I.npcSpots.push({ pos: [3.1, FL, 1.05], yaw: 0, pose: 'stand', role: 'clerk' });
  I.npcSpots.push({ pos: [0.65, FL, -3.35], yaw: 0, pose: 'stand', role: 'guest' }, { pos: [4.3, FL, -2.4], yaw: -PI / 2, pose: 'stand', role: 'guest' }, { pos: [-0.3, FL, -0.65], yaw: 0, pose: 'stand', role: 'guest' });
  I.interactables.push({ id: 'book', label: '책 읽기', pos: [-4.1, 0.9, -3.7], radius: 1.4, seat: { pos: [-4.1, FL + 1.08, -4.08], yaw: PI, pitch: -0.5 } });
}

function toyIn(I, M) {
  const g = I.group, R = M.R;
  V(g, RB(3.6, 0.012, 2.6, 0.005, 1), 0x7fbf6a, -0.9, FL + 0.006, -0.9, 0, 0, 0, vcSoft());
  for (const [w, d, x, z] of [[2.8, 0.18, -0.9, -2.0], [2.8, 0.18, -0.9, 0.2], [0.18, 2.2, -2.2, -0.9], [0.18, 2.2, 0.4, -0.9]]) V(g, BX(w, 0.004, d), 0x55585c, x, FL + 0.014, z);
  const tf = toyFill(M, R);
  shelfUnit(I, M, -XI + 0.23, -3.3, PI / 2, 2.1, 2.0, 0.45, 5, tf, { back: 0xfff3d6 });
  shelfUnit(I, M, -XI + 0.23, -1.1, PI / 2, 2.1, 2.0, 0.45, 5, tf, { back: 0xfff3d6 });
  shelfUnit(I, M, -3.45, ZI + 0.23, 0, 2.0, 2.0, 0.45, 5, tf, { back: 0xfff3d6 });
  shelfUnit(I, M, -1.35, ZI + 0.23, 0, 2.0, 2.0, 0.45, 5, tf, { back: 0xfff3d6 });
  shelfUnit(I, M, 3.1, ZI + 0.23, 0, 2.6, 2.0, 0.45, 4, boxFill(M, R), { back: 0xfff3d6 });
  shelfUnit(I, M, XI - 0.23, -0.2, -PI / 2, 2.4, 1.8, 0.45, 4, (sg, i, y, x0, x1, d, step) => tf(sg, [1, 3, 3, 4][i], y, x0, x1, d, step), { back: 0xfff3d6 });
  // counter, clerk side towards the back wall
  const cg = counterAt(I, M, 3.0, -2.5, 0, 2.4);
  register(cg, M, 0.6, 1.0, 0.02);
  V(cg, CY(0.08, 0.08, 0.6, 16), 0xe0574a, -0.6, 1.08, -0.1, 0, 0, PI / 2, vcSoft());
  V(cg, CY(0.08, 0.08, 0.6, 16), 0x4a92dd, -0.6, 1.08, 0.08, 0, 0, PI / 2, vcSoft());
  artBox(cg, M, -0.1, 1.0, 0.05, 0.3, 0.2, 0.2, 5, 0.2);
  for (let k = 0; k < 4; k++) {
    const bxp = -1.1 + (k % 2) * 0.12, bzp = (k < 2 ? -0.05 : 0.08), by = 1.85 + k * 0.14;
    V(cg, SP(0.13, 16, 12), PALX[k * 2], bxp + (k - 1.5) * 0.1, by, bzp, 0, 0, 0, vcGloss()).scale.set(1, 1.18, 1);
    V(cg, CY(0.002, 0.002, by - 1.13, 4), 0xe9e7e2, bxp + (k - 1.5) * 0.05, (by + 0.87) / 2, bzp, 0, 0, (k - 1.5) * 0.06);
  }
  plush(g, 4.4, FL, -1.75, 2.8, 0xc88a4f);
  I.colliders.push({ min: [4.0, 0, -2.1], max: [4.8, FL + 1.1, -1.4] });
  // display table with a train loop, block castle and robots
  const dt = placed(I, -0.9, -0.9, 0, 2.2, 1.2, 0.8);
  put(dt, RB(2.2, 0.06, 1.2, 0.02, 2), M.wood, 0, 0.72, 0);
  V(dt, RB(2.1, 0.6, 1.1, 0.02, 2), 0x4a92dd, 0, 0.39, 0);
  V(dt, RB(2.14, 0.07, 1.14, 0.02, 2), 0xf2c14e, 0, 0.655, 0, 0, 0, 0, vcGloss());
  V(dt, RB(2.14, 0.06, 1.14, 0.02, 2), 0xe0574a, 0, 0.12, 0, 0, 0, 0, vcGloss());
  const T = GC('rail', () => torus(0.3, 0.012, 4, 24, PI));
  for (const s of [-1, 1]) {
    V(group(dt, s * 0.35, 0.765, 0, s > 0 ? -PI / 2 : PI / 2), T, 0x8a9096, 0, 0, 0, -PI / 2, 0, 0, vcGloss());
    V(dt, BX(0.7, 0.024, 0.024), 0x8a9096, 0, 0.765, s * 0.3, 0, 0, 0, vcGloss());
  }
  const tr = group(dt, -0.1, 0.78, 0.3, 0);
  V(tr, RB(0.18, 0.08, 0.09, 0.015, 2), 0xe0574a, 0.12, 0.04, 0, 0, 0, 0, vcGloss());
  V(tr, CY(0.035, 0.035, 0.12, 14), DK, 0.16, 0.08, 0, 0, 0, PI / 2, vcGloss());
  V(tr, CY(0.015, 0.02, 0.06, 10), DK, 0.2, 0.14, 0, 0, 0, 0, vcGloss());
  V(tr, RB(0.08, 0.09, 0.09, 0.012, 2), 0xf2c14e, 0.05, 0.1, 0, 0, 0, 0, vcGloss());
  for (const [cx, c] of [[-0.12, 0x4a92dd], [-0.32, 0x5fb36e]]) V(tr, RB(0.17, 0.08, 0.09, 0.015, 2), c, cx, 0.04, 0, 0, 0, 0, vcGloss());
  for (const cx of [0.17, 0.07, -0.08, -0.16, -0.28, -0.36]) for (const sz of [-1, 1]) V(tr, CY(0.02, 0.02, 0.01, 12), DK, cx, 0.012, sz * 0.05, PI / 2);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) V(dt, RB(0.08, 0.08, 0.08, 0.008, 1), PALX[(i + j) % 8], 0.55 + j * 0.085 + i * 0.04, 0.79 + i * 0.08, -0.25, 0, 0, 0, vcGloss());
  V(dt, GC('roof', () => cyl(0, 0.06, 0.1, 4)), 0xe0574a, 0.68, 1.15, -0.25, 0, PI / 4, 0, vcGloss());
  robot(dt, -0.75, 0.75, -0.35, 1.6, 0x4a92dd); robot(dt, -0.5, 0.75, -0.4, 1.3, 0xe0574a);
  car(dt, 0.35, 0.75, 0.42, 1.5, 0xf2c14e, 0.4);
  artBox(dt, M, 0.85, 0.75, 0.35, 0.3, 0.22, 0.06, 6, -0.3);
  // ball bin by the window
  const bb = placed(I, -3.4, 0.95, 0, 1.0, 1.0, 0.6);
  for (const y of [0.05, 0.3, 0.55]) V(bb, GC('ring', () => torus(0.48, 0.012, 6, 32)), 0xc9ced3, 0, y, 0, PI / 2, 0, 0, vcGloss());
  for (let k = 0; k < 16; k++) { const a = k * PI / 8; V(bb, CY(0.008, 0.008, 0.52, 4), 0xc9ced3, Math.cos(a) * 0.48, 0.3, Math.sin(a) * 0.48, 0, 0, 0, vcGloss()); }
  for (let k = 0; k < 32; k++) { const a = R() * PI * 2, r = Math.sqrt(R()) * 0.36; V(bb, SP(0.09, 10, 7), PALX[k % 8], Math.cos(a) * r, 0.1 + (k / 32) * 0.4 + R() * 0.05, Math.sin(a) * r, 0, 0, 0, vcGloss()); }
  // rocking horse
  const rh = placed(I, 2.3, 0.7, 0, 1.0, 0.45, 0.95);
  for (const s of [-1, 1]) V(rh, GC('rock', () => torus(0.9, 0.025, 6, 24, 1.2)), 0x8a5a3a, 0, 0.92, s * 0.16, 0, 0, -PI / 2 - 0.6);
  V(rh, capsule(0.14, 0.4, 4, 12), 0xf4f3ef, 0, 0.55, 0, 0, 0, PI / 2, vcGloss());
  V(rh, RB(0.14, 0.32, 0.14, 0.05, 2), 0xf4f3ef, 0.3, 0.72, 0, 0, 0, -0.4, vcGloss());
  V(rh, RB(0.26, 0.14, 0.13, 0.05, 2), 0xf4f3ef, 0.42, 0.88, 0, 0, 0, 0.1, vcGloss());
  V(rh, RB(0.2, 0.06, 0.06, 0.02, 1), 0xe0574a, 0.22, 0.86, 0, 0, 0, -0.5, vcSoft());
  V(rh, RB(0.3, 0.04, 0.3, 0.02, 2), 0xe0574a, -0.04, 0.7, 0, 0, 0, 0, vcGloss());
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) V(rh, CY(0.025, 0.025, 0.46, 8), 0xf4f3ef, sx * 0.2, 0.28, sz * 0.12, -sz * 0.12, 0, 0, vcGloss());
  // hanging plane and balloons, bunting
  const pl = group(g, 0.6, 2.55, 0.5, 0.5);
  V(pl, capsule(0.08, 0.5, 4, 12), 0xf2c14e, 0, 0, 0, 0, 0, PI / 2, vcGloss());
  V(pl, RB(0.22, 0.02, 1.0, 0.01, 1), 0xe0574a, 0.05, 0.0, 0, 0, 0, 0, vcGloss());
  V(pl, RB(0.12, 0.16, 0.02, 0.01, 1), 0xe0574a, -0.3, 0.1, 0, 0, 0, 0, vcGloss());
  V(pl, RB(0.02, 0.24, 0.04, 0.01, 1), DK, 0.35, 0, 0);
  V(pl, CY(0.003, 0.003, CL - 2.6, 4), 0xe9e7e2, 0, (CL - 2.55) / 2, 0);
  V(g, BX(2 * XI - 0.4, 0.006, 0.006), 0x8a7a6a, 0, 2.6, ZI + 0.05);
  const flag = GC('flag', () => cyl(0.085, 0.085, 0.004, 3));
  for (let k = 0; k < 26; k++) V(g, flag, PALX[k % 8], -XI + 0.4 + k * 0.4, 2.54, ZI + 0.05, PI / 2, 0, 0, vcSoft());
  hangSign(g, M, 'tag0', -2.4, 2.55, -3.7, 0, 0.9);
  hangSign(g, M, 'tag1', -4.3, 2.55, -2.2, PI / 2, 0.9);
  hangSign(g, M, 'tag2', 3.0, 2.62, -2.5, 0, 0.8);
  art(g, M, 'menuBig', 1.6, 2.72, 1.75, PI, 1.3, 0.65, 0xe0574a);
  art(g, M, 'art0', XI - 0.02, 1.95, -3.0, -PI / 2, 0.45, 0.6, 0xf2c14e);
  wallClock(g, -1.6, 2.92, 1.76, PI, M.A, 0.16);
  for (const [x, z] of [[-3.6, -2.4], [-1.4, -2.4], [-3.6, 0.2], [-0.9, -0.9], [1.0, -0.6], [3.0, -1.5], [3.4, 0.6], [1.2, 1.0], [3.0, -3.6]]) downlight(g, M, x, z);
  I.lamps.push({ pos: [-2.4, 2.7, -2.4], color: 0xfff0d8, intensity: 10, range: 7 }, { pos: [-0.9, 2.7, -0.5], color: 0xfff0d8, intensity: 10, range: 7 }, { pos: [3.0, 2.7, -2.2], color: 0xfff0d8, intensity: 9, range: 7 }, { pos: [3.0, 2.7, 0.8], color: 0xfff0d8, intensity: 7, range: 6 });
  I.npcSpots.push({ pos: [3.0, FL, -3.3], yaw: PI, pose: 'stand', role: 'clerk' });
  I.npcSpots.push({ pos: [-0.9, FL, 0.25], yaw: 0, pose: 'stand', role: 'guest' }, { pos: [-4.25, FL, -2.2], yaw: PI / 2, pose: 'stand', role: 'guest' });
  I.interactables.push({ id: 'toy', label: '장난감 사기 (6,000원)', pos: [3.0, 1.2, -1.9], radius: 1.5 });
}

const CEIL_TILES = () => textured('tiles', { color: 0xf3f3f1, grout: 0xcfd2d4, count: 2, groutWidth: 0.012, rough: 0.7 }, 1.2, { normal: 0.25 });
const SPEC = {
  bakery: () => ({ floor: textured('tiles', { color: 0xd8c2a2, grout: 0xa58d70, count: 4, groutWidth: 0.02, rough: 0.35, seed: 7 }, 1.2, { normal: 0.5 }), wall: mat('plasterWarm'), wain: mat('oak'), ceil: mat('plaster'), wood: mat('oak'), top: mat('marble'), counter: mat('walnut'), slat: 0x8a5a3a, rail: 0x6b4529, skirt: 0x4a2f1e, build: bakeryIn }),
  cafe: () => ({ floor: mat('oakFloor'), wall: mat('plasterWarm'), wain: mat('walnut'), ceil: mat('plaster'), wood: mat('walnut'), top: mat('marble'), counter: paint(0x2f5d4a, 0.55), slat: 0x24473a, rail: 0x3b2416, skirt: 0x3b2416, build: cafeIn }),
  hospital: () => ({ floor: textured('tiles', { color: 0xe4e9eb, grout: 0xc8cfd3, count: 2, groutWidth: 0.006, rough: 0.3 }, 1.2, { normal: 0.3 }), wall: mat('plaster'), wain: paint(0xc6dbe9, 0.5), ceil: CEIL_TILES(), wood: mat('birch'), top: paint(0xf4f4f1, 0.3), counter: paint(0xf4f4f1, 0.45), slat: 0x5b7f9e, rail: 0x9fb4c4, skirt: 0x5b7f9e, build: hospitalIn }),
  pharmacy: () => ({ floor: mat('floorTile'), wall: mat('plaster'), wain: paint(0xd7e8d6, 0.5), ceil: CEIL_TILES(), wood: mat('birch'), top: paint(0xf4f4f1, 0.3), counter: paint(0xf4f4f1, 0.45), slat: 0x2f8a5a, rail: 0x2f8a5a, skirt: 0x2f8a5a, build: pharmacyIn }),
  bookstore: () => ({ floor: mat('oakFloor'), wall: mat('plaster'), wain: mat('walnut'), ceil: mat('plaster'), wood: mat('walnut'), top: mat('oak'), counter: mat('walnut'), slat: 0x4a2f1e, rail: 0x3b2416, skirt: 0x3b2416, build: bookstoreIn }),
  toy: () => ({ floor: mat('oakFloor'), wall: paint(0xfff0cf, 0.85), wain: paint(0x8cc4e8, 0.6), ceil: mat('plaster'), wood: mat('birch'), top: paint(0xf4f3ef, 0.35), counter: paint(0xe0574a, 0.5), slat: 0xf2c14e, rail: 0xf2c14e, skirt: 0x2f74c0, build: toyIn }),
};

/** Build the walk-in ground floor of one shop (called lazily by the game, once). */
function buildInterior(kind, K) {
  const I = { group: new THREE.Group(), colliders: [], interactables: [], npcSpots: [], lamps: [], indoor: [] };
  I.group.name = 'interior-' + kind;
  const A = interiorAtlas(kind, K);
  const P = A.printed(0.55), L = A.lit(1.1, 0x202020);
  A.mat = P;
  const S = SPEC[kind]();
  const M = { ...S, A, P, L, R: rng(kind.length * 977 + 5), steel: mat('steel'), glass: mat('glass'), glow: mat('lampGlow'), cool: mat('coolGlow') };
  shell(I, M);
  S.build(I, M);
  I.indoor.push({ min: [-XI, 0, ZI], max: [XI, CL, F - 0.05] });
  bake(I.group);
  return I;
}

/* ------------------------------------------------------------------ the shop */
export function buildShop({ kind = 'bakery' } = {}) {
  const K = KINDS[kind] ?? KINDS.bakery;
  const site = makeSite('shop-' + kind, 12, 10);
  const g = site.group;
  const R = rng(kind.length * 131 + 7);
  const A = makeAtlas(kind, K);
  const signLit = A.lit(1.5, 0xffffff); signLit.name = 'shopSign-' + kind;
  const winLit = A.lit(0.8, 0xffffff); winLit.name = 'shopWin-' + kind;
  const printed = A.printed(0.6);
  const wall = mat(K.wall), gwall = mat(K.ground);
  const trim = paint(K.trim, 0.5, 0.1);
  const glass = mat('glass');
  const lampM = mat('lampGlow');
  const H = G + (K.floors - 1) * U;
  const depth = F - BZ, zc = (F + BZ) / 2;
  site.nightGlow.push(signLit, winLit, lampM);

  // ground apron and plinth
  put(g, RB(12, 0.05, 10 - depth + 0.2, 0.02, 1), mat('pavers2'), 0, 0.025, (F - 0.1 + 5) / 2);
  // core masses
  // hollow ground floor: side and back walls, floor slab (top FL) and ceiling slab (CL..G)
  for (const s of [-1, 1]) put(g, box(0.2, G, CORE - BZ), gwall, s * (W / 2 - 0.1), G / 2, (CORE + BZ) / 2);
  put(g, box(W - 0.4, G, 0.2), gwall, 0, G / 2, BZ + 0.1);
  put(g, box(W - 0.4, G - CL, CORE - BZ - 0.2), mat('concrete'), 0, (G + CL) / 2, (CORE + BZ + 0.2) / 2);
  put(g, box(W - 0.4, FL - 0.01, F - 0.2 - BZ - 0.2), mat('concrete'), 0, (FL - 0.01) / 2, (F + BZ) / 2);
  if (K.floors > 1) put(g, RB(W, H - G, depth, 0.03, 1), wall, 0, G + (H - G) / 2, zc);
  put(g, RB(W + 0.04, 0.85, 0.82, 0.03, 2), trim, 0, G - 0.425, F - 0.41);
  for (const s of [-1, 1]) put(g, RB(0.55, G - 0.85, 0.76, 0.02, 2), gwall, s * (W / 2 - 0.275), (G - 0.85) / 2, F - 0.38);
  put(g, RB(W + 0.06, 0.14, 0.86, 0.02, 1), mat('concrete'), 0, 0.07, F - 0.42);

  // storefront
  const dX = K.door, dW = K.doorW, fr = K.frame;
  const bays = [[-4.95, dX - dW / 2 - 0.12], [dX + dW / 2 + 0.12, 4.95]].filter(([a, b]) => b - a > 0.8);
  for (const [x0, x1] of bays) {
    const bw = x1 - x0, cx = (x0 + x1) / 2;
    put(g, RB(bw, 0.45, 0.16, 0.015, 1), gwall, cx, 0.36, F - 0.09);
    V(g, RB(bw, 0.05, 0.18, 0.01, 1), fr, cx, 0.6, F - 0.08);
    V(g, RB(bw, 0.07, 0.14, 0.01, 1), fr, cx, 2.62, F - 0.08);
    V(g, RB(bw, 0.045, 0.1, 0.01, 1), fr, cx, 2.2, F - 0.08);
    const n = Math.max(1, Math.ceil(bw / 2.1));
    for (let i = 0; i <= n; i++) V(g, RB(0.06, 2.05, 0.12, 0.01, 1), fr, x0 + 0.03 + (bw - 0.06) * i / n, 1.6, F - 0.08);
    D(g, quad(bw, 2.05), glass, cx, 1.6, F - 0.08);
    // interior box: floor podium, back wall picture, ceiling light strip
    V(g, RB(bw - 0.04, 0.04, 0.66, 0.01, 1), 0xb48a5e, cx, 0.55, 2.19);
    V(g, RB(bw - 0.04, 0.39, 0.58, 0.01, 1), 0x7a5a40, cx, 0.335, 2.145);
    if (kind !== 'hospital') for (const s of [-1, 1]) V(g, RB(0.03, 2.05, 0.03, 0.008, 1), 0x3a3b3d, cx + s * (bw / 2 - 0.4), 1.6, 1.9);
    D(g, RB(bw - 0.4, 0.025, 0.05, 0.01, 1), lampM, cx, 2.6, 2.3);
    for (const x of [x0, x1]) if (Math.abs(Math.abs(x) - 4.95) > 0.01) V(g, RB(0.06, 2.1, 0.66, 0.01, 1), 0xefe9df, x, 1.6, 2.19);
    dress(kind, g, x0, x1, R, K);
    // glass lettering
    D(g, A.quad('hours', 0.8, 0.24), printed, x0 + 0.62 + (x0 < dX ? 0 : bw - 1.24), 1.05, F - 0.07);
    site.lamps.push({ pos: [cx, 2.3, F + 0.6], color: 0xffd9a8, intensity: 1.2, range: 7 });
    // awning
    if (K.awning) {
      const am = K.awning(), L = 1.2, drop = 0.45, a = Math.atan2(drop, L), len = Math.hypot(L, drop);
      put(g, RB(bw + 0.1, 0.03, len, 0.01, 1), am, cx, 2.8 - drop / 2, F + L / 2, a);
      put(g, RB(bw + 0.1, 0.24, 0.03, 0.01, 1), am, cx, 2.8 - drop - 0.11, F + L);
      V(g, RB(bw + 0.14, 0.06, 0.08, 0.02, 1), fr, cx, 2.82, F + 0.03);
      for (const s of [-1, 1]) rod(g, [cx + s * (bw / 2 - 0.1), 2.3, F], [cx + s * (bw / 2 - 0.1), 2.8 - drop - 0.02, F + L - 0.05], 0.012, 0x3a3b3d);
    }
  }
  // door
  const dg = group(g, dX, 0, F - 0.1);
  V(dg, RB(dW + 0.16, 0.08, 0.14, 0.01, 1), fr, 0, 2.47, 0);
  V(dg, RB(dW + 0.16, 0.06, 0.14, 0.01, 1), fr, 0, 2.62, 0);
  for (const s of [-1, 1]) V(dg, RB(0.08, 2.62, 0.14, 0.01, 1), fr, s * (dW / 2 + 0.04), 1.31, 0);
  D(dg, quad(dW, 0.12), glass, 0, 2.56, 0);
  // automatic sliding glass door on a surface track just outside the frame (towards the shop's middle)
  const sd = dX > 0 ? -1 : 1, dbl = dW > 1.5;
  const leaves = dbl ? [[-dW / 4, dW / 2, -1], [dW / 4, dW / 2, 1]] : [[0, dW, sd]];
  V(g, RB(2 * dW + 0.2, 0.17, 0.13, 0.02, 2), fr, dX + (dbl ? 0 : sd * dW / 2), 2.53, F + 0.075);
  leaves.forEach(([lx, lw, s], li) => {
    const piv = group(g, dX + lx, 0, F + 0.04);
    piv.userData.dynamic = true;
    for (const e of [-1, 1]) V(piv, RB(0.06, 2.35, 0.05, 0.01, 1), fr, e * (lw / 2 - 0.03), 1.255, 0);
    V(piv, RB(lw, 0.06, 0.05, 0.01, 1), fr, 0, 2.4, 0);
    V(piv, RB(lw, 0.16, 0.05, 0.01, 1), fr, 0, 0.16, 0);
    D(piv, quad(lw - 0.1, 2.15), glass, 0, 1.315, 0);
    const hx = -s * (lw / 2 - 0.12);
    for (const e of [-1, 1]) rod(piv, [hx, 0.85, e * 0.04], [hx, 1.35, e * 0.04], 0.014, 0xc9ced3, mat('steel'));
    if (li === 0) D(piv, A.quad('open', 0.36, 0.13), signLit, dbl ? 0 : -s * 0.15, 1.75, 0.03);
    bake(piv);
    site.doors.push({ pivot: piv, openAngle: 0, slide: [s * lw, 0, 0], auto: true, collider: { min: [dX + lx - lw / 2, 0, F + 0.01], max: [dX + lx + lw / 2, 2.45, F + 0.07] } });
  });
  V(g, RB(dW + 0.2, 0.04, 0.7, 0.01, 1), 0x8f8c86, dX, 0.16, F - 0.4);
  for (const s of [-1, 1]) V(g, RB(0.05, 2.5, 0.64, 0.01, 1), 0xefe9df, dX + s * (dW / 2 + 0.09), 1.3, 2.2);
  // door canopy for shops without awnings over the door
  if (!K.awning || kind === 'hospital') {
    put(g, RB(dW + 1.6, 0.14, 1.5, 0.03, 2), paint(0xf2f3f4, 0.4, 0.2), dX, 2.78, F + 0.75);
    D(g, RB(dW + 1.0, 0.02, 0.9, 0.01, 1), lampM, dX, 2.7, F + 0.75);
    site.lamps.push({ pos: [dX, 2.5, F + 0.9], color: 0xf4f6ff, intensity: 1.3, range: 7 });
  }

  // main sign: light box on the fascia
  const sw = Math.min(7.6, W - 1.4);
  put(g, RB(sw + 0.14, 0.72, 0.14, 0.03, 2), paint(0x2b2d31, 0.4, 0.4), 0, G - 0.4, F + 0.06);
  D(g, A.quad('sign', sw, sw * 0.12), signLit, 0, G - 0.4, F + 0.135);
  site.lamps.push({ pos: [0, G - 0.4, F + 0.8], color: 0xfff1d6, intensity: 1.0, range: 6 });

  // pier sconces
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.275);
    V(g, RB(0.14, 0.24, 0.04, 0.01, 1), 0x2b2d31, x, 2.15, F + 0.02);
    V(g, CY(0.07, 0.05, 0.16, 16), 0x2b2d31, x, 2.15, F + 0.14, 0, 0, 0, vcGloss());
    D(g, CY(0.045, 0.045, 0.01, 14), lampM, x, 2.06, F + 0.14);
  }

  // upper floors
  const winCount = 3, wxa = kind === 'hospital' ? -4.4 : -W / 2;
  for (let f = 1; f < K.floors; f++) {
    const fy = G + (f - 1) * U;
    put(g, RB(W + 0.08, 0.14, 0.1, 0.02, 1), trim, 0, fy + 0.07, F + 0.02);
    const ww = kind === 'hospital' ? 2.4 : 2.2, wh = 1.6, y = fy + 0.9;
    for (let i = 0; i < winCount; i++) {
      const x = wxa + ((W / 2 - wxa) / winCount) * (i + 0.5);
      D(g, A.quad('win' + ((i + f) % 3), ww, wh), winLit, x, y + wh / 2, F + 0.012);
      D(g, quad(ww, wh), glass, x, y + wh / 2, F + 0.07);
      V(g, RB(ww + 0.16, 0.08, 0.16, 0.015, 1), fr, x, y + wh + 0.04, F + 0.07);
      V(g, RB(ww + 0.16, 0.08, 0.16, 0.015, 1), fr, x, y - 0.04, F + 0.07);
      for (const s of [-1, 1]) V(g, RB(0.08, wh, 0.16, 0.015, 1), fr, x + s * (ww / 2 + 0.04), y + wh / 2, F + 0.07);
      V(g, RB(0.05, wh, 0.07, 0.01, 1), fr, x, y + wh / 2, F + 0.08);
      put(g, RB(ww + 0.34, 0.07, 0.26, 0.02, 1), trim, x, y - 0.115, F + 0.12);
      if (kind === 'bakery' || kind === 'cafe' || kind === 'bookstore') {
        // flower box
        V(g, RB(ww - 0.2, 0.2, 0.22, 0.03, 2), kind === 'cafe' ? 0x2c3a33 : 0x7a4a2e, x, y - 0.02, F + 0.25);
        for (let k = 0; k < 9; k++) {
          const fx = x - ww / 2 + 0.2 + k * (ww - 0.4) / 8;
          V(g, SP(0.075, 8, 6), [0x4a7a33, 0x5a8a3a, 0x3c6a2e][k % 3], fx, y + 0.1, F + 0.25 + (k % 2) * 0.04, 0, 0, 0, vcMat());
          V(g, SP(0.035, 6, 5), [0xe0574a, 0xf2a7c0, 0xfff3f0, 0xf2c14e][(k + i) % 4], fx + 0.03, y + 0.17, F + 0.3, 0, 0, 0, vcGloss());
        }
      }
      if (kind === 'pharmacy' && i === 1) {
        // AC unit under the window
        V(g, RB(0.8, 0.55, 0.32, 0.02, 2), 0xe6e8e9, x + 0.5, fy + 0.35, F + 0.2, 0, 0, 0, vcGloss());
        V(g, CY(0.2, 0.2, 0.02, 20), 0x6a6e73, x + 0.42, fy + 0.35, F + 0.37, PI / 2);
      }
    }
  }
  // blade sign (projecting) or hospital cross
  if (K.floors > 1) {
    const bx = W / 2 - 0.35, by = G + 1.45;
    if (kind === 'hospital') {
      const cy = H + 0.55 + 0.95, cx = W / 2 - 1.3, cz = F - 0.45;
      put(g, RB(1.5, 1.5, 0.3, 0.06, 2), paint(0xffffff, 0.35, 0.1), cx, cy, cz);
      for (const s of [-1, 1]) V(g, RB(0.1, 0.3, 0.1, 0.02, 1), 0x8a9096, cx + s * 0.5, cy - 0.85, cz);
      const red = paint(0xe0383a, 0.4, 0, { emissive: 0xff2a2a, emissiveIntensity: 1.2 });
      site.nightGlow.push(red);
      put(g, RB(1.1, 0.36, 0.06, 0.02, 2), red, cx, cy, cz + 0.17);
      put(g, RB(0.36, 1.1, 0.06, 0.02, 2), red, cx, cy, cz + 0.17);
      site.lamps.push({ pos: [cx, cy, cz + 0.8], color: 0xff5050, intensity: 0.8, range: 5 });
      // vertical name board on the left
      put(g, RB(0.7, 3.4, 0.16, 0.04, 2), paint(0x1f5f9a, 0.4, 0.2), -W / 2 + 0.6, G + 1.85, F + 0.12);
      D(g, A.quad('blade', 0.6, 2.0), signLit, -W / 2 + 0.6, G + 1.85, F + 0.205);
    } else {
      put(g, RB(0.1, 1.9, 0.08, 0.02, 1), paint(0x2b2d31, 0.4, 0.5), bx, by, F + 0.06);
      for (const y of [by + 0.75, by - 0.75]) rod(g, [bx, y, F + 0.06], [bx, y, F + 0.25], 0.02, 0x2b2d31);
      put(g, RB(0.12, 1.75, 0.6, 0.03, 2), paint(0x2b2d31, 0.4, 0.4), bx, by, F + 0.55);
      D(g, A.quad('blade', 0.52, 1.6), signLit, bx + 0.065, by, F + 0.55, 0, PI / 2, 0);
      D(g, A.quad('blade', 0.52, 1.6), signLit, bx - 0.065, by, F + 0.55, 0, -PI / 2, 0);
    }
  }

  // roof: cornice, parapet, coping, deck and rooftop units
  const pH = kind === 'toy' ? 0.9 : 0.55;
  put(g, RB(W + 0.16, 0.2, 0.16, 0.03, 2), trim, 0, H - 0.1, F + 0.03);
  put(g, RB(W, pH, 0.3, 0.02, 1), K.floors > 1 ? wall : gwall, 0, H + pH / 2, F - 0.15);
  put(g, RB(W, pH, 0.25, 0.02, 1), K.floors > 1 ? wall : gwall, 0, H + pH / 2, BZ + 0.125);
  for (const s of [-1, 1]) put(g, RB(0.25, pH, depth - 0.5, 0.02, 1), K.floors > 1 ? wall : gwall, s * (W / 2 - 0.125), H + pH / 2, zc);
  put(g, RB(W + 0.12, 0.07, 0.4, 0.02, 1), trim, 0, H + pH + 0.035, F - 0.13);
  put(g, RB(W + 0.12, 0.07, 0.32, 0.02, 1), trim, 0, H + pH + 0.035, BZ + 0.13);
  for (const s of [-1, 1]) put(g, RB(0.34, 0.07, depth, 0.02, 1), trim, s * (W / 2 - 0.12), H + pH + 0.035, zc);
  put(g, RB(W - 0.4, 0.06, depth - 0.5, 0.02, 1), mat('concrete'), 0, H + 0.03, zc);
  V(g, RB(1.0, 0.7, 0.6, 0.04, 2), 0xd9dcdd, -2.5, H + 0.41, -2.4, 0, 0, 0, vcGloss());
  V(g, CY(0.22, 0.22, 0.02, 20), 0x55595e, -2.5, H + 0.43, -2.09, PI / 2);
  if (kind === 'hospital') {
    V(g, CY(0.7, 0.7, 1.4, 24), 0x9fb7c9, 2.6, H + 0.76, -2.2, 0, 0, 0, vcGloss());
    V(g, CY(0.72, 0.72, 0.06, 24), 0x7f97a9, 2.6, H + 1.49, -2.2);
  }
  if (kind === 'toy') {
    const cols = [0xe0574a, 0xf2c14e, 0x5fb36e, 0x4a92dd, 0x9b6ad1];
    for (let i = 0; i < 11; i++) V(g, SP(0.16, 14, 10), cols[i % 5], -W / 2 + 0.5 + i * (W - 1) / 10, H + pH + 0.2, F - 0.13, 0, 0, 0, vcGloss());
  }

  // sidewalk life: plants by the door, bench, bike, A-board, bistro table, book cart
  for (const s of [-1, 1]) pottedPlant(g, dX + s * (dW / 2 + 0.55), 0.05, F + 0.4, { kind: s < 0 ? 'snake' : 'bush', h: 0.9, seed: 3 + s + kind.length, pot: 'charcoal', potR: 0.22, potH: 0.5 });
  for (const [p, px] of K.props) {
    if (p === 'bench') {
      const x = px, b = bench({ length: 1.6 });
      b.position.set(x, 0.05, F + 1.1); g.add(b);
      solid(site, x, 0.25, F + 1.1, 1.6, 0.5, 0.6);
    } else if (p === 'bike') {
      const x = px;
      bike(g, x, F + 1.7, 0.08, K.bike, kind === 'bakery');
    } else if (p === 'board') {
      const x = px;
      const bg = group(g, x, 0.05, F + 1.3, (dX > 0 ? 0.3 : -0.3));
      const fb = group(bg, 0, 0.42, 0.07); fb.rotation.x = -0.17;
      V(fb, RB(0.56, 0.84, 0.03, 0.01, 1), 0x7a5a40); D(fb, A.quad('menu', 0.46, 0.68), printed, 0, 0, 0.017);
      const bb = group(bg, 0, 0.42, -0.07); bb.rotation.x = 0.17;
      V(bb, RB(0.56, 0.84, 0.03, 0.01, 1), 0x7a5a40);
    } else if (p === 'bistro') {
      for (const x of [px]) {
        V(g, CY(0.32, 0.32, 0.03, 24), 0xf1ece4, x, 0.78, F + 1.2, 0, 0, 0, vcGloss());
        V(g, CY(0.025, 0.025, 0.72, 8), 0x2b2d31, x, 0.42, F + 1.2);
        V(g, CY(0.2, 0.22, 0.03, 16), 0x2b2d31, x, 0.07, F + 1.2);
        V(g, lathe([[0, 0], [0.035, 0], [0.04, 0.09], [0.036, 0.095], [0.034, 0.012], [0, 0.012]], 14), 0xf4f3ef, x + 0.1, 0.795, F + 1.15, 0, 0, 0, vcGloss());
        for (const s of [-1, 1]) {
          const cg = group(g, x + s * 0.55, 0.05, F + 1.2, s * PI / 2);
          V(cg, CY(0.19, 0.19, 0.04, 18), 0x2f5d4a, 0, 0.44, 0, 0, 0, 0, vcGloss());
          for (const [lx, lz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) V(cg, CY(0.012, 0.012, 0.44, 6), 0x2b2d31, lx, 0.22, lz);
          V(cg, RB(0.36, 0.3, 0.03, 0.01, 1), 0x2f5d4a, 0, 0.66, 0.17, 0.12, 0, 0, vcGloss());
        }
        solid(site, x, 0.4, F + 1.2, 1.5, 0.8, 0.7);
      }
    } else if (p === 'stand') {
      const x = px;
      V(g, RB(0.7, 0.9, 0.4, 0.03, 2), 0xf4f3ef, x, 0.5, F + 0.6, 0, 0, 0, vcGloss());
      for (let k = 0; k < 10; k++) V(g, box(0.1, 0.14, 0.08), [0xe94e3c, 0x3b8fd6, 0xf3c14a, 0x5fb36e, 0xffffff][k % 5], x - 0.25 + (k % 5) * 0.12, 0.6 + Math.floor(k / 5) * 0.2, F + 0.82);
      D(g, A.quad('poster', 0.3, 0.42), printed, x, 1.2, F + 0.81);
    } else if (p === 'cart') {
      const x = px;
      V(g, RB(1.4, 0.06, 0.6, 0.02, 1), 0x6b4529, x, 0.82, F + 0.9);
      V(g, RB(1.4, 0.4, 0.06, 0.02, 1), 0x6b4529, x, 1.0, F + 0.62);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) V(g, CY(0.02, 0.02, 0.78, 8), 0x2b2d31, x + sx * 0.64, 0.43, F + 0.9 + sz * 0.25);
      for (let k = 0; k < 12; k++) V(g, box(0.035, 0.24, 0.17), [0x8c3b35, 0x2f5d7c, 0xd8b25a, 0x3d6b4a, 0xe9e1cf][k % 5], x - 0.6 + k * 0.1, 0.97, F + 0.85, 0.25, 0, 0);
      D(g, A.quad('poster', 0.26, 0.36), printed, x + 0.35, 1.08, F + 0.66);
      solid(site, x, 0.6, F + 0.9, 1.4, 1.2, 0.6);
    } else if (p === 'balls') {
      for (let k = 0; k < 5; k++) V(g, SP(0.12 + k * 0.01, 14, 10), [0xe0574a, 0xf2c14e, 0x5fb36e, 0x4a92dd, 0x9b6ad1][k], px + (k % 3) * 0.3, 0.17 + k * 0.01, F + 0.5 + Math.floor(k / 3) * 0.3, 0, 0, 0, vcGloss());
      V(g, RB(0.9, 0.5, 0.5, 0.05, 2), 0xf2c14e, px + 0.2, 0.3, F + 0.45, 0, 0, 0, vcGloss());
    }
  }
  // posters in the window by the door
  D(g, A.quad('poster', 0.42, 0.59), printed, dX + (dX > 0 ? -dW / 2 - 0.5 : dW / 2 + 0.5), 1.75, F - 0.07);

  // colliders: solid upper floors; ground floor walls, shop windows and the door opening; floor slab
  solid(site, 0, (CL + H + pH) / 2, zc, W, H + pH - CL, depth);
  for (const s of [-1, 1]) solid(site, s * (W / 2 - 0.1), CL / 2, zc, 0.2, CL, depth);
  solid(site, 0, CL / 2, BZ + 0.1, W, CL, 0.2);
  const dl = dX - dW / 2, dr = dX + dW / 2;
  solid(site, (dl - W / 2) / 2, CL / 2, (ZW + F) / 2, dl + W / 2, CL, F - ZW);
  solid(site, (dr + W / 2) / 2, CL / 2, (ZW + F) / 2, W / 2 - dr, CL, F - ZW);
  solid(site, dX, (2.45 + CL) / 2, (ZW + F) / 2, dW, CL - 2.45, F - ZW);
  solid(site, 0, FL / 2, (BZ + 0.2 + ZW) / 2, W - 0.4, FL, ZW - BZ - 0.2);
  solid(site, dX, 0.09, (ZW + F) / 2, dW, 0.18, F - ZW);
  for (const s of [-1, 1]) solid(site, dX + s * (dW / 2 + 0.55), 0.3, F + 0.4, 0.5, 0.6, 0.5);
  bake(g);
  site.extra.kind = kind;
  site.extra.height = H + pH;
  site.extra.interior = { build: () => buildInterior(kind, K) };
  return site;
}

/** Viewer helper: one shop with its interior already built and added (stats logged as a warning). */
export function withInterior({ kind = 'bakery' } = {}) {
  const s = buildShop({ kind });
  const t0 = performance.now();
  s.extra.interior.build();
  const t1 = performance.now();
  const it = s.extra.interior.build();
  const t2 = performance.now();
  s.group.add(it.group);
  s.colliders.push(...it.colliders);
  s.interactables.push(...it.interactables);
  let meshes = 0, tris = 0;
  it.group.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  const stats = { kind, coldMs: Math.round(t1 - t0), warmMs: Math.round(t2 - t1), meshes, tris: Math.round(tris), colliders: it.colliders.length, npc: it.npcSpots.length };
  console.warn('interior ' + JSON.stringify(stats));
  return s;
}

/** Viewer helper: all six shops side by side along X (spacing 13). */
export function shopRow() {
  const group0 = new THREE.Group();
  const colliders = [];
  SHOP_KINDS.forEach((k, i) => {
    const s = buildShop({ kind: k });
    s.group.position.x = (i - (SHOP_KINDS.length - 1) / 2) * 13;
    group0.add(s.group);
  });
  return { group: group0, colliders };
}
