// Town storefronts that fill the streets: bakery, cafe, hospital, pharmacy, bookstore, toy shop.
// buildShop({kind}) → Site (see ../site.js), footprint 12 x 10, entrance faces +Z. Not walkable inside:
// the ground floor has a shallow (0.6 m) dressed shop window behind glass, upper floors show lit rooms.
import * as THREE from 'three';
import { mat, paint, textured } from '../mat.js';
import { box, quad, put, group, bake, torus, lathe, capsule } from '../geom.js';
import { FONT } from '../tex.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { bench } from '../props/street.js';
import { PI, RB, CY, SP, V, D, Atlas, txt, rr, pottedPlant, vcMat, vcGloss, vcSoft, cached } from './office.js';

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
  A.add('back', 520, 270, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff8ea'); gr.addColorStop(0.35, K.wallC); gr.addColorStop(1, '#b9a68c');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    if (kind === 'toy') { ['#e0574a', '#f2c14e', '#5fb36e', '#4a92dd', '#9b6ad1'].forEach((col, i) => { c.fillStyle = col; c.globalAlpha = 0.35; c.fillRect(0, 18 + i * 8, w, 8); }); c.globalAlpha = 1; }
    if (kind === 'cafe') { rr(c, w * 0.62, 20, w * 0.32, 90, 6, '#26302b', '#8a6a48', 5); txt(c, 'MENU', w * 0.78, 42, 20, '#f5ecd9', 'center', 'middle'); for (let i = 0; i < 4; i++) { c.fillStyle = '#d8d2c4'; c.fillRect(w * 0.66, 58 + i * 12, w * 0.16, 3); c.fillRect(w * 0.86, 58 + i * 12, w * 0.05, 3); } }
    if (kind === 'hospital') {
      rr(c, w * 0.08, 30, w * 0.36, 70, 6, '#2c3640'); c.fillStyle = '#5aa3d8'; c.fillRect(w * 0.1, 36, w * 0.32, 58); txt(c, '진료 안내', w * 0.26, 66, 18, '#ffffff', 'center', 'middle');
      rr(c, w * 0.55, 34, w * 0.36, 34, 5, '#1f5f9a'); txt(c, '접수 · 수납', w * 0.73, 52, 18, '#ffffff', 'center', 'middle');
      c.fillStyle = '#d9e3ea'; c.fillRect(0, h * 0.55, w, h * 0.45); c.fillStyle = '#9fb4c4'; c.fillRect(0, h * 0.55, w, 4);
      for (let i = 0; i < 6; i++) rr(c, 30 + i * 80, h * 0.62, 56, 40, 8, '#5a8fc0');
    } else shelfRows(c, w, h, R, kind, K);
    const lg = c.createRadialGradient(w / 2, 0, 10, w / 2, 0, w * 0.6); lg.addColorStop(0, 'rgba(255,240,210,0.45)'); lg.addColorStop(1, 'rgba(255,240,210,0)');
    c.fillStyle = lg; c.fillRect(0, 0, w, h);
  });
  A.add('door', 160, 300, (c, w, h) => {
    c.fillStyle = K.wallC; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c9b79c'; c.beginPath(); c.moveTo(0, h); c.lineTo(w, h); c.lineTo(w * 0.72, h * 0.66); c.lineTo(w * 0.28, h * 0.66); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(w * 0.28, h * 0.2, w * 0.44, h * 0.46);
    c.fillStyle = '#fff6e0'; c.fillRect(w * 0.3, h * 0.04, w * 0.4, 6);
    if (kind !== 'hospital') { c.fillStyle = '#8a6444'; c.fillRect(0, h * 0.35, w * 0.22, 4); c.fillRect(w * 0.78, h * 0.35, w * 0.22, 4); }
    else { rr(c, w * 0.32, h * 0.3, w * 0.36, 20, 4, '#1f5f9a'); }
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
  put(g, box(W, G, CORE - BZ), gwall, 0, G / 2, (CORE + BZ) / 2);
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
    D(g, A.quad('back', bw, 2.1), winLit, cx, 1.6, CORE + 0.01);
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
  const leaves = dW > 1.5 ? [[-dW / 4, dW / 2], [dW / 4, dW / 2]] : [[0, dW]];
  for (const [lx, lw] of leaves) {
    for (const s of [-1, 1]) V(dg, RB(0.06, 2.35, 0.05, 0.01, 1), fr, lx + s * (lw / 2 - 0.03), 1.25, 0.01);
    V(dg, RB(lw, 0.06, 0.05, 0.01, 1), fr, lx, 2.4, 0.01);
    V(dg, RB(lw, 0.16, 0.05, 0.01, 1), fr, lx, 0.16, 0.01);
    D(dg, quad(lw - 0.1, 2.15), glass, lx, 1.315, 0.01);
    rod(dg, [lx + (dW > 1.5 ? -Math.sign(lx) * (lw / 2 - 0.12) : lw / 2 - 0.12), 0.85, 0.08], [lx + (dW > 1.5 ? -Math.sign(lx) * (lw / 2 - 0.12) : lw / 2 - 0.12), 1.35, 0.08], 0.014, 0xc9ced3, mat('steel'));
  }
  D(dg, A.quad('open', 0.36, 0.13), signLit, dW > 1.5 ? 0 : -0.15, 1.75, 0.04);
  D(g, A.quad('door', dW, 2.4), winLit, dX, 1.2, CORE + 0.01);
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

  solid(site, 0, (H + pH) / 2, zc, W, H + pH, depth);
  for (const s of [-1, 1]) solid(site, dX + s * (dW / 2 + 0.55), 0.3, F + 0.4, 0.5, 0.6, 0.5);
  bake(g);
  site.extra.kind = kind;
  site.extra.height = H + pH;
  return site;
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
