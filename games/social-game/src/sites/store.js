// 세온마트: a 24-hour neighbourhood convenience store. Footprint 10 (X) x 8 (Z), entrance on +Z.
// Flat roof with parapet, glass storefront with an automatic sliding door, lit sign and striped
// awning, interior floor at y = 0.15, shelves stocked with labelled products from one canvas atlas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, paint, textured, glow } from '../mat.js';
import { rbox, cyl, sphere, torus, lathe, extrude, quad, prep, put, group, bake } from '../geom.js';
import { canvasTex, FONT } from '../tex.js';
import { rng } from '../noise.js';
import { makeSite, solid } from '../site.js';

const FL = 0.15; // interior floor top
const CL = 3.05; // ceiling
const XI = 4.65; // interior half width
const ZB = -3.75; // interior back face
const ZF = 2.06; // storefront glass plane
const TEAL = '#118a7b', TEAL_D = '#0b5f55', SUN = '#ff9a2e';

// ------------------------------------------------------------------ small helpers
function B(parent, m, x0, y0, z0, x1, y1, z1, cast = true) {
  const g = prep(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  const o = put(parent, g, m);
  o.castShadow = cast;
  return o;
}
function R(parent, m, x, y, z, w, h, d, r = 0.01, seg = 2, ry = 0) {
  return put(parent, rbox(w, h, d, r, seg), m, x, y, z, 0, ry, 0);
}
const _c = new THREE.Color();
function tint(geo, hex) {
  _c.set(hex);
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function toRect(geo, r) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
  return geo;
}
function solidUV(geo, r, fu = 0.5, fv = 0.5) {
  const uv = geo.attributes.uv ?? new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + fu * (r.u1 - r.u0), r.v0 + fv * (r.v1 - r.v0));
  geo.setAttribute('uv', uv);
  return geo;
}
const ni = (g) => (g.index ? g.toNonIndexed() : g);
function merge(list) {
  const gs = list.map((g) => {
    g = ni(g);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  return mergeGeometries(gs, false);
}
/** Atlas quad facing +Z, w x h, mapped to rect r. */
function aquad(w, h, r) { return toRect(quad(w, h), r); }

// ------------------------------------------------------------------ label atlas (one canvas)
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fill(ctx, w, h, c) { ctx.fillStyle = c; ctx.fillRect(-8, -8, w + 16, h + 16); }
function grad(ctx, w, h, a, b, horiz = false) {
  const g = horiz ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(-8, -8, w + 16, h + 16);
}
function txt(ctx, s, x, y, size, fillC, strokeC = null, lw = 0, maxW = 0, align = 'center') {
  let sz = size;
  ctx.font = `${sz}px ${FONT}`;
  if (maxW) while (ctx.measureText(s).width > maxW && sz > 6) { sz -= 1; ctx.font = `${sz}px ${FONT}`; }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (strokeC && lw) { ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = strokeC; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fillC; ctx.fillText(s, x, y);
}
function burst(ctx, cx, cy, r, color, n = 14) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, rr2 = i % 2 ? r * 0.8 : r;
    ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function ell(ctx, x, y, rx, ry, rot, c, stroke) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = c; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, rx * 0.12); ctx.stroke(); }
}
// art for snacks: draws a little heap of the product around (cx, cy) with size s
const ART = {
  chips(ctx, cx, cy, s, R, c = '#ffe08a', spot = '#c98a2a') {
    for (let i = 0; i < 9; i++) {
      const x = cx + (R() - 0.5) * s * 1.5, y = cy + (R() - 0.5) * s * 0.9;
      ell(ctx, x, y, s * 0.32, s * 0.22, R() * 3, c, 'rgba(120,70,20,0.45)');
      ell(ctx, x + s * 0.05, y - s * 0.03, s * 0.05, s * 0.03, 0, spot);
    }
  },
  balls(ctx, cx, cy, s, R, c = '#ffb52e') {
    for (let i = 0; i < 10; i++) {
      const x = cx + (R() - 0.5) * s * 1.4, y = cy + (R() - 0.5) * s * 0.9, r = s * (0.16 + R() * 0.06);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#fff3c0'); g.addColorStop(1, c);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
    }
  },
  rings(ctx, cx, cy, s, R, c = '#f2b14a') {
    ctx.lineWidth = s * 0.12;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.ellipse(cx + (R() - 0.5) * s * 1.3, cy + (R() - 0.5) * s * 0.8, s * 0.3, s * 0.22, R() * 3, 0, 7);
      ctx.strokeStyle = c; ctx.stroke();
    }
  },
  sticks(ctx, cx, cy, s, R, c = '#d9963a') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = cx + (R() - 0.5) * s * 1.4, y = cy + (R() - 0.5) * s * 0.8, a = R() * 3;
      ctx.lineWidth = s * 0.11; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * s * 0.4, y - Math.sin(a) * s * 0.4); ctx.lineTo(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4); ctx.stroke();
    }
  },
  shrimp(ctx, cx, cy, s, R) {
    for (let i = 0; i < 6; i++) {
      const x = cx + (R() - 0.5) * s * 1.3, y = cy + (R() - 0.5) * s * 0.8;
      ctx.lineCap = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#ff8a5c';
      ctx.beginPath(); ctx.arc(x, y, s * 0.22, 0.3 + R(), 3.6 + R()); ctx.stroke();
    }
  },
  triangles(ctx, cx, cy, s, R, c = '#ffd24a') {
    for (let i = 0; i < 8; i++) {
      const x = cx + (R() - 0.5) * s * 1.4, y = cy + (R() - 0.5) * s * 0.9, a = R() * 6;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) ctx.lineTo(x + Math.cos(a + k * 2.1) * s * 0.3, y + Math.sin(a + k * 2.1) * s * 0.3);
      ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = 'rgba(150,90,20,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    }
  },
  twists(ctx, cx, cy, s, R) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = cx + (R() - 0.5) * s * 1.3, y = cy + (R() - 0.5) * s * 0.8;
      ctx.lineWidth = s * 0.1; ctx.strokeStyle = '#b8742a';
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.1) ctx.lineTo(x - s * 0.35 + t * s * 0.7, y + Math.sin(t * 12) * s * 0.07);
      ctx.stroke();
    }
  },
  seaweed(ctx, cx, cy, s, R) {
    for (let i = 0; i < 7; i++) {
      ctx.save(); ctx.translate(cx + (R() - 0.5) * s * 1.3, cy + (R() - 0.5) * s * 0.8); ctx.rotate(R() * 2);
      ctx.fillStyle = '#163222'; ctx.fillRect(-s * 0.22, -s * 0.16, s * 0.44, s * 0.32);
      ctx.strokeStyle = '#3f7a4a'; ctx.lineWidth = 2; ctx.strokeRect(-s * 0.22, -s * 0.16, s * 0.44, s * 0.32);
      ctx.restore();
    }
  },
  popcorn(ctx, cx, cy, s, R) {
    for (let i = 0; i < 14; i++) {
      const x = cx + (R() - 0.5) * s * 1.4, y = cy + (R() - 0.5) * s * 0.9;
      for (let k = 0; k < 3; k++) ell(ctx, x + (R() - 0.5) * s * 0.15, y + (R() - 0.5) * s * 0.15, s * 0.11, s * 0.1, 0, k ? '#fff8e0' : '#f2d68a');
    }
  },
  bears(ctx, cx, cy, s, R) {
    const cs = ['#ff4d6d', '#ffd23f', '#3ec46d', '#ff8c2e', '#7b5cff'];
    for (let i = 0; i < 7; i++) {
      const x = cx + (R() - 0.5) * s * 1.4, y = cy + (R() - 0.5) * s * 0.8, c = cs[i % 5];
      ell(ctx, x, y + s * 0.08, s * 0.14, s * 0.17, 0, c); ell(ctx, x, y - s * 0.12, s * 0.1, s * 0.09, 0, c);
      ell(ctx, x - s * 0.08, y - s * 0.2, s * 0.04, s * 0.04, 0, c); ell(ctx, x + s * 0.08, y - s * 0.2, s * 0.04, s * 0.04, 0, c);
    }
  },
  bowl(ctx, cx, cy, s, R, soup = '#d8452b') {
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.62, s * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = soup; ctx.fill();
    ctx.strokeStyle = '#ffe6a0'; ctx.lineWidth = s * 0.05;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let t = 0; t <= 1; t += 0.1) ctx.lineTo(cx - s * 0.45 + t * s * 0.9, cy - s * 0.05 + i * s * 0.03 + Math.sin(t * 14 + i) * s * 0.03); ctx.stroke(); }
    ell(ctx, cx + s * 0.2, cy - s * 0.04, s * 0.13, s * 0.08, 0, '#fff'); ell(ctx, cx + s * 0.2, cy - s * 0.04, s * 0.06, s * 0.045, 0, '#ffbe1a');
    for (let i = 0; i < 6; i++) ell(ctx, cx - s * 0.3 + R() * s * 0.4, cy - s * 0.08 + R() * s * 0.1, s * 0.035, s * 0.025, 0, '#4caf50');
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.02, s * 0.66, s * 0.4, 0, 0, Math.PI); ctx.fillStyle = '#fafafa'; ctx.fill();
    ctx.strokeStyle = '#d33'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * 0.6, s * 0.2, 0, 0.3, Math.PI - 0.3); ctx.stroke();
  },
  fruit(ctx, cx, cy, s, R, c = '#ff8c1a', leaf = '#3c9a3c') {
    const g = ctx.createRadialGradient(cx - s * 0.15, cy - s * 0.15, s * 0.05, cx, cy, s * 0.45);
    g.addColorStop(0, '#ffffffaa'); g.addColorStop(0.25, c); g.addColorStop(1, c);
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, 7); ctx.fillStyle = g; ctx.fill();
    ell(ctx, cx + s * 0.18, cy - s * 0.42, s * 0.16, s * 0.07, -0.5, leaf);
  },
  drop(ctx, cx, cy, s, R, c = '#3aa0e8') {
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.5);
    ctx.bezierCurveTo(cx + s * 0.45, cy, cx + s * 0.35, cy + s * 0.45, cx, cy + s * 0.45);
    ctx.bezierCurveTo(cx - s * 0.35, cy + s * 0.45, cx - s * 0.45, cy, cx, cy - s * 0.5);
    ctx.fillStyle = c; ctx.fill();
    ell(ctx, cx - s * 0.12, cy + s * 0.05, s * 0.06, s * 0.12, 0.3, '#ffffffaa');
  },
  bubbles(ctx, cx, cy, s, R, c = '#ffffff') {
    for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(cx + (R() - 0.5) * s * 1.2, cy + (R() - 0.5) * s * 1.2, s * (0.04 + R() * 0.08), 0, 7); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); }
  },
  bolt(ctx, cx, cy, s, R, c = '#b6ff3a') {
    ctx.beginPath(); ctx.moveTo(cx + s * 0.1, cy - s * 0.5); ctx.lineTo(cx - s * 0.25, cy + s * 0.05); ctx.lineTo(cx, cy + s * 0.05);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.5); ctx.lineTo(cx + s * 0.25, cy - s * 0.08); ctx.lineTo(cx, cy - s * 0.08); ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
  },
  bean(ctx, cx, cy, s, R) {
    for (let i = 0; i < 8; i++) ell(ctx, cx + (R() - 0.5) * s, cy + (R() - 0.5) * s * 0.6, s * 0.14, s * 0.09, R() * 3, '#5a3320', '#2f1a10');
  },
  cookie(ctx, cx, cy, s, R, c = '#c98a46') {
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * s * 0.3, y = cy + (i % 2) * s * 0.12;
      ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = 'rgba(90,50,20,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      for (let k = 0; k < 5; k++) ell(ctx, x + (R() - 0.5) * s * 0.35, y + (R() - 0.5) * s * 0.35, s * 0.04, s * 0.04, 0, '#3a2112');
    }
  },
  rice(ctx, cx, cy, s, R) {
    ell(ctx, cx, cy, s * 0.5, s * 0.3, 0, '#fbfbf6'); for (let i = 0; i < 14; i++) ell(ctx, cx + (R() - 0.5) * s * 0.8, cy + (R() - 0.5) * s * 0.4, s * 0.04, s * 0.02, R() * 3, '#e8e6dc');
  },
};
// product name pools (original, generic)
const BAGS = [
  ['바삭감자', '#ffd23f', '#f39a1c', '#d8261c', 'chips', '오리지널'],
  ['매콤칩', '#e8382d', '#a51b1b', '#ffe14a', 'chips', '화끈한 맛'],
  ['새우랑', '#fff4ea', '#ffd9c2', '#1f5fbf', 'shrimp', '고소한 새우'],
  ['콘칩', '#2a64c0', '#173f86', '#ffd23f', 'triangles', '옥수수 듬뿍'],
  ['치즈볼', '#ff8d21', '#e5601a', '#ffffff', 'balls', '진한 치즈'],
  ['고구마스틱', '#7a3f99', '#4e2468', '#ffd23f', 'sticks', '달콤 바삭'],
  ['양파링', '#2f9a46', '#1d6a31', '#ffffff', 'rings', '링 모양'],
  ['꿀꽈배기', '#ffe066', '#f7b733', '#7a3b12', 'twists', '꿀맛'],
  ['초코볼', '#6a3d26', '#3e2214', '#ffd6a0', 'balls', '진한 초코'],
  ['김스낵', '#1f4a33', '#102a1c', '#e8f5c0', 'seaweed', '바삭 김'],
  ['버터팝콘', '#fff3d6', '#ffd98a', '#d8261c', 'popcorn', '버터 향'],
  ['젤리곰', '#ff6fa8', '#e64687', '#ffffff', 'bears', '말랑말랑'],
];
const CUPS = [
  ['얼큰라면', '#d8261c', '#a51410', '#ffffff', '#d8452b'],
  ['짜장컵', '#2b211c', '#141010', '#ffd23f', '#3a2414'],
  ['김치사발', '#ff6a1a', '#d8401a', '#ffffff', '#e0462a'],
  ['해물우동', '#1c63b8', '#0f3f80', '#ffffff', '#e9c27a'],
  ['치즈볶음면', '#ffcc1a', '#f29a12', '#c0301e', '#f0a020'],
  ['튀김우동', '#ffffff', '#f0e6d8', '#e0561a', '#e6b46a'],
  ['불닭볶음면', '#1a1a1a', '#000000', '#ff3b1f', '#c8261a'],
  ['미역국밥', '#2c8a4a', '#1b5f32', '#ffffff', '#6a5a2a'],
];
const DRINKS = [ // name, label bg, label accent, liquid, cap, art
  ['맑은샘', '#ffffff', '#1a78d8', 0xcfe7f6, 0x1a78d8, 'drop'],
  ['보리차', '#f2d58a', '#7a3d14', 0x9a5420, 0xffffff, 'bean'],
  ['녹차', '#e8f3d0', '#2f7d32', 0xa6c45a, 0x2f7d32, 'drop'],
  ['오렌지100', '#ff9d1f', '#ffffff', 0xff9a1a, 0xff7a00, 'fruit'],
  ['포도봉봉', '#6a2c8a', '#ffffff', 0x4e1f63, 0x6a2c8a, 'fruit'],
  ['사이다', '#2fa34a', '#ffffff', 0xd8f0d0, 0x1f8a3a, 'bubbles'],
  ['콜라', '#d8201c', '#ffffff', 0x3a1408, 0xd8201c, 'bubbles'],
  ['이온워터', '#1f6fd8', '#ffffff', 0xe2eef8, 0x1f6fd8, 'drop'],
  ['복숭아', '#ffb6a0', '#d8406a', 0xffc8ae, 0xff8aa0, 'fruit'],
  ['아침커피', '#3a2418', '#f2d6a8', 0x5a3a22, 0x3a2418, 'bean'],
];
const CANS = [
  ['레몬소다', '#ffe14a', '#1f8a3a', 'fruit', '#ffe14a'],
  ['콜라', '#d8201c', '#ffffff', 'bubbles', '#ffffff'],
  ['에너지', '#151515', '#b6ff3a', 'bolt', '#b6ff3a'],
  ['자몽에이드', '#ff6f7d', '#ffffff', 'fruit', '#ff3d5a'],
  ['캔커피', '#5a3a22', '#f2d6a8', 'bean', '#f2d6a8'],
  ['탄산수', '#cfe3ee', '#1a5aa8', 'bubbles', '#1a5aa8'],
  ['사과사이다', '#4fbf4a', '#ffffff', 'fruit', '#e8262a'],
  ['식혜', '#f6ead2', '#8a5a2a', 'rice', '#8a5a2a'],
];
const BOXES = [
  ['초코과자', '#c8201c', '#6a2a14', 'cookie', '#ffffff'],
  ['버터쿠키', '#1f5fbf', '#f2c46a', 'cookie', '#ffffff'],
  ['시리얼', '#ffcf1f', '#e86a1a', 'chips', '#1a3a8a'],
  ['웨하스', '#ff8db0', '#ffffff', 'sticks', '#c8205a'],
  ['크래커', '#ff8a1a', '#ffe0a0', 'cookie', '#ffffff'],
  ['초코바', '#4a2a18', '#d8a060', 'bean', '#ffd23f'],
  ['비타민', '#2f9a46', '#ffe14a', 'fruit', '#ffffff'],
  ['티슈', '#e8f2fb', '#5aa0d8', 'drop', '#1f5fbf'],
];
const ICE = [['딸기바', '#ff5a7a', '#ffffff'], ['메론바', '#8ed65a', '#1f6a2a'], ['초코콘', '#5a3220', '#ffd6a0'], ['팥빙수바', '#b04a4a', '#fff2d8'], ['소다바', '#4ab4f0', '#ffffff'], ['바닐라콘', '#fff2c8', '#c8301e']];
const KIMBAP = [['참치마요', '#1f5fbf'], ['불고기', '#c8301e'], ['전주비빔', '#e8a020'], ['김치볶음', '#d8401a']];
const LUNCH = [['제육 도시락', '#c8301e'], ['돈까스 도시락', '#e8a020'], ['불고기 도시락', '#6a3a1a']];
const MULTI = [['얼큰라면 5입', '#d8261c', '#a51410'], ['짜장라면 4입', '#2b211c', '#141010'], ['우동 4입', '#1c63b8', '#0f3f80'], ['볶음면 5입', '#ffcc1a', '#f29a12']];
const GUM = [['#2fa3e0', '민트껌'], ['#ff5a8a', '딸기껌'], ['#ffd23f', '레몬캔디'], ['#3ec46d', '청포도'], ['#8a5ad8', '블루베리'], ['#ff8c2e', '오렌지'], ['#e8e8e8', '목캔디'], ['#5a3a22', '커피캔디']];

let ATLAS = null;
function buildAtlas() {
  if (ATLAS) return ATLAS;
  const W = 2048, H = 2048, PAD = 5;
  const jobs = [], rects = {};
  // rects are packed after all are declared (tallest first, shelf packing)
  const add = (name, w, h, draw) => { const r = { w, h, name }; rects[name] = r; jobs.push([r, draw]); };
  const pack = () => {
    // shelf packing, tallest first; later (shorter) rects may reuse the tail of any earlier shelf
    const order = [...jobs].sort((a, b) => b[0].h - a[0].h || b[0].w - a[0].w);
    const shelves = [];
    let top = 0;
    for (const [r] of order) {
      const need = r.w + PAD * 2;
      let sh = shelves.find((q) => q.h >= r.h + PAD * 2 && W - q.x >= need);
      if (!sh) {
        sh = { y: top, h: r.h + PAD * 2, x: 0 };
        top += sh.h;
        if (top > H) throw new Error('store atlas full at ' + r.name);
        shelves.push(sh);
      }
      r.x = sh.x + PAD; r.y = sh.y + PAD; sh.x += need;
      r.u0 = (r.x + 0.5) / W; r.u1 = (r.x + r.w - 0.5) / W; r.v1 = 1 - (r.y + 0.5) / H; r.v0 = 1 - (r.y + r.h - 0.5) / H;
    }
  };

  const R = rng(77);
  // --- snack bags 160x224
  BAGS.forEach(([name, a, b, tc, art, sub], i) => add('bag' + i, 160, 224, (ctx, w, h) => {
    grad(ctx, w, h, a, b);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-8, -8, w + 16, h * 0.075 + 8); ctx.fillRect(-8, h * 0.925, w + 16, h * 0.075 + 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h * 0.07); ctx.moveTo(x, h * 0.93); ctx.lineTo(x, h); ctx.stroke(); }
    burst(ctx, w / 2, h * 0.63, w * 0.42, 'rgba(255,255,255,0.28)', 16);
    ART[art](ctx, w / 2, h * 0.64, w * 0.36, R);
    rrect(ctx, w * 0.08, h * 0.13, w * 0.84, h * 0.27, 14); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
    txt(ctx, name, w / 2, h * 0.27, 46, tc, 'rgba(0,0,0,0.55)', 6, w * 0.84);
    txt(ctx, sub, w / 2, h * 0.86, 17, '#ffffff', 'rgba(0,0,0,0.5)', 4, w * 0.8);
    rrect(ctx, w * 0.68, h * 0.42, w * 0.26, h * 0.075, 8); ctx.fillStyle = '#ffffff'; ctx.fill();
    txt(ctx, (40 + i * 7) + 'g', w * 0.81, h * 0.458, 15, '#333');
  }));
  // --- ramen multipacks 300x190
  MULTI.forEach(([name, a, b], i) => add('multi' + i, 300, 190, (ctx, w, h) => {
    grad(ctx, w, h, a, b, true);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-8, -8, w + 16, h * 0.08 + 8); ctx.fillRect(-8, h * 0.92, w + 16, h * 0.08 + 8);
    ART.bowl(ctx, w * 0.7, h * 0.58, w * 0.3, R, CUPS[i].at ? '#d8452b' : ['#d8452b', '#3a2414', '#e9c27a', '#f0a020'][i]);
    txt(ctx, name.split(' ')[0], w * 0.3, h * 0.42, 50, '#ffffff', 'rgba(0,0,0,0.6)', 7, w * 0.5);
    rrect(ctx, w * 0.1, h * 0.62, w * 0.36, h * 0.2, 10); ctx.fillStyle = '#ffd23f'; ctx.fill();
    txt(ctx, name.split(' ')[1], w * 0.28, h * 0.72, 30, '#3a1a0a');
  }));
  // --- boxes 160x210
  BOXES.forEach(([name, a, b, art, tc], i) => add('box' + i, 160, 210, (ctx, w, h) => {
    fill(ctx, w, h, a);
    ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(0, h * 0.55); ctx.quadraticCurveTo(w * 0.5, h * 0.42, w, h * 0.58); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    ART[art](ctx, w / 2, h * 0.72, w * 0.34, R);
    txt(ctx, name, w / 2, h * 0.22, 40, tc, 'rgba(0,0,0,0.45)', 5, w * 0.86);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, h * 0.36, w, 3);
    txt(ctx, ['12개입', '오리지널', '1+1', '대용량'][i % 4], w / 2, h * 0.43, 16, tc);
  }));
  // --- cup noodle wraps 256x96 (design twice around)
  CUPS.forEach(([name, a, b, tc, soup], i) => add('cup' + i, 256, 96, (ctx, w, h) => {
    grad(ctx, w, h, a, b);
    for (let k = 0; k < 2; k++) {
      const ox = k * w / 2;
      ART.bowl(ctx, ox + w * 0.25, h * 0.66, w * 0.17, R, soup);
      txt(ctx, name, ox + w * 0.25, h * 0.27, 30, tc, 'rgba(0,0,0,0.5)', 5, w * 0.44);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(-8, h - 6, w + 16, 14); ctx.fillRect(-8, -8, w + 16, 12);
  }));
  // --- bottle labels 240x84 (twice around)
  DRINKS.forEach(([name, a, b, , , art], i) => add('drink' + i, 240, 84, (ctx, w, h) => {
    fill(ctx, w, h, a);
    for (let k = 0; k < 2; k++) {
      const ox = k * w / 2;
      ART[art](ctx, ox + w * 0.1, h * 0.52, h * 0.55, R, b === '#ffffff' ? '#ffffff' : b);
      txt(ctx, name, ox + w * 0.31, h * 0.45, 26, b, null, 0, w * 0.3);
      ctx.fillStyle = b; ctx.fillRect(ox + w * 0.2, h * 0.72, w * 0.22, 3);
      txt(ctx, '500ml', ox + w * 0.31, h * 0.84, 11, b);
    }
  }));
  // --- can wraps 200x112
  CANS.forEach(([name, a, b, art, c2], i) => add('can' + i, 200, 112, (ctx, w, h) => {
    grad(ctx, w, h, a, a === '#151515' ? '#2a2a2a' : b === '#ffffff' ? a : a);
    for (let k = 0; k < 2; k++) {
      const ox = k * w / 2;
      ctx.fillStyle = c2 + '55'; ctx.beginPath(); ctx.arc(ox + w * 0.25, h * 0.62, h * 0.32, 0, 7); ctx.fill();
      ART[art](ctx, ox + w * 0.25, h * 0.64, h * 0.5, R, c2);
      txt(ctx, name, ox + w * 0.25, h * 0.2, 22, b, 'rgba(0,0,0,0.35)', 3, w * 0.44);
    }
  }));
  // --- ice cream wrappers 200x76
  ICE.forEach(([name, a, b], i) => add('ice' + i, 200, 76, (ctx, w, h) => {
    grad(ctx, w, h, a, a, true);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-8, -8, 18, h + 16); ctx.fillRect(w - 10, -8, 18, h + 16);
    ell(ctx, w * 0.72, h * 0.5, w * 0.16, h * 0.3, 0, b + 'aa');
    txt(ctx, name, w * 0.4, h * 0.5, 30, b, 'rgba(0,0,0,0.4)', 4, w * 0.5);
  }));
  // --- kimbap triangle labels 160x140
  KIMBAP.forEach(([name, c], i) => add('kim' + i, 160, 140, (ctx, w, h) => {
    fill(ctx, w, h, '#f4f6f2');
    ctx.fillStyle = '#1d2a22'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * 0.5, h * 0.18); ctx.lineTo(w, h); ctx.fill();
    rrect(ctx, w * 0.12, h * 0.52, w * 0.76, h * 0.26, 8); ctx.fillStyle = c; ctx.fill();
    txt(ctx, name, w / 2, h * 0.65, 26, '#fff', null, 0, w * 0.7);
    txt(ctx, '삼각김밥', w / 2, h * 0.9, 14, '#e8f0e8');
  }));
  // --- lunch box tops 200x140
  LUNCH.forEach(([name, c], i) => add('lunch' + i, 200, 140, (ctx, w, h) => {
    fill(ctx, w, h, '#1b1b1d');
    rrect(ctx, 8, 8, w * 0.48, h - 16, 10); ctx.fillStyle = '#f8f7f0'; ctx.fill();
    rrect(ctx, w * 0.54, 8, w * 0.42, h * 0.45, 10); ctx.fillStyle = c; ctx.fill();
    rrect(ctx, w * 0.54, h * 0.52, w * 0.2, h * 0.4, 8); ctx.fillStyle = '#5aa04a'; ctx.fill();
    rrect(ctx, w * 0.76, h * 0.52, w * 0.2, h * 0.4, 8); ctx.fillStyle = '#e8c23a'; ctx.fill();
    rrect(ctx, w * 0.06, h * 0.68, w * 0.88, h * 0.24, 6); ctx.fillStyle = '#ffffffee'; ctx.fill();
    txt(ctx, name, w / 2, h * 0.8, 24, '#c8301e', null, 0, w * 0.84);
  }));
  // --- sandwich 140x120
  add('sand0', 140, 120, (ctx, w, h) => {
    fill(ctx, w, h, '#f6e7c4'); ctx.fillStyle = '#ffe9a8'; ctx.fillRect(0, h * 0.4, w, h * 0.16); ctx.fillStyle = '#7cc04a'; ctx.fillRect(0, h * 0.56, w, h * 0.06); ctx.fillStyle = '#ff9fa0'; ctx.fillRect(0, h * 0.62, w, h * 0.1);
    rrect(ctx, 10, 6, w - 20, h * 0.28, 6); ctx.fillStyle = '#1f5fbf'; ctx.fill(); txt(ctx, '햄치즈 샌드', w / 2, h * 0.2, 20, '#fff', null, 0, w - 26);
  });
  // --- gum / candy 96x64
  GUM.forEach(([c, name], i) => add('gum' + i, 96, 64, (ctx, w, h) => {
    grad(ctx, w, h, c, c);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-8, h * 0.62, w + 16, h * 0.12);
    txt(ctx, name, w / 2, h * 0.36, 22, i === 6 ? '#2a6a3a' : '#ffffff', 'rgba(0,0,0,0.35)', 3, w * 0.9);
  }));
  // --- shelf price strip 1024x30
  add('price', 1024, 30, (ctx, w, h) => {
    fill(ctx, w, h, '#f4f4f2');
    ctx.fillStyle = TEAL; ctx.fillRect(-8, -8, w + 16, 6 + 8);
    for (let x = 6, k = 0; x < w - 60; x += 78 + (k % 3) * 14, k++) {
      const promo = k % 5 === 2;
      ctx.fillStyle = promo ? '#ffd23f' : '#ffffff'; ctx.fillRect(x, 8, 64, h - 10);
      ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 1; ctx.strokeRect(x, 8, 64, h - 10);
      txt(ctx, promo ? '1+1' : (900 + ((k * 370) % 2400)).toLocaleString('ko-KR') + '원', x + 32, 19, promo ? 16 : 13, promo ? '#d8201c' : '#222');
    }
  });
  // --- plain colours
  add('white', 16, 16, (ctx, w, h) => fill(ctx, w, h, '#f6f6f4'));
  add('foil', 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.4, h * 0.4, 2, w / 2, h / 2, w * 0.6); g.addColorStop(0, '#f4f4f4'); g.addColorStop(1, '#b8bcc2');
    ctx.fillStyle = g; ctx.fillRect(-8, -8, w + 16, h + 16); ctx.fillStyle = '#d8261c'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.22, 0, 7); ctx.fill();
  });
  // --- posters 360x480
  const poster = (title, big, a, b, line) => (ctx, w, h) => {
    grad(ctx, w, h, a, b);
    burst(ctx, w / 2, h * 0.5, w * 0.42, '#ffffff33', 18);
    txt(ctx, title, w / 2, h * 0.14, 46, '#ffffff', 'rgba(0,0,0,0.35)', 6, w * 0.9);
    txt(ctx, big, w / 2, h * 0.5, 125, '#ffe14a', '#8a1a10', 14, w * 0.92);
    rrect(ctx, w * 0.1, h * 0.76, w * 0.8, h * 0.14, 20); ctx.fillStyle = '#ffffff'; ctx.fill();
    txt(ctx, line, w / 2, h * 0.83, 34, a, null, 0, w * 0.74);
    txt(ctx, '세온마트', w / 2, h * 0.95, 22, '#ffffffcc');
  };
  add('poster1', 300, 400, poster('이달의 행사', '1+1', '#e8322a', '#b5161c', '라면 · 음료'));
  add('poster2', 300, 400, poster('골라 담기', '2+1', '#1f6fd8', '#123f8a', '과자 전품목'));
  add('poster3', 300, 400, (ctx, w, h) => {
    grad(ctx, w, h, '#ffe8a3', '#ffc94a');
    txt(ctx, '신상 도시락', w / 2, h * 0.12, 48, '#7a2a10', null, 0, w * 0.9);
    rrect(ctx, w * 0.1, h * 0.22, w * 0.8, h * 0.46, 26); ctx.fillStyle = '#1b1b1d'; ctx.fill();
    ART.rice(ctx, w * 0.32, h * 0.45, w * 0.36, R);
    rrect(ctx, w * 0.52, h * 0.27, w * 0.32, h * 0.18, 14); ctx.fillStyle = '#c8301e'; ctx.fill();
    rrect(ctx, w * 0.52, h * 0.48, w * 0.15, h * 0.16, 12); ctx.fillStyle = '#5aa04a'; ctx.fill();
    rrect(ctx, w * 0.69, h * 0.48, w * 0.15, h * 0.16, 12); ctx.fillStyle = '#e8c23a'; ctx.fill();
    txt(ctx, '든든한 한 끼', w / 2, h * 0.77, 40, '#7a2a10');
    txt(ctx, '4,900원', w / 2, h * 0.89, 54, '#d8201c', '#fff', 8);
  });
  add('poster4', 300, 400, (ctx, w, h) => {
    fill(ctx, w, h, '#f4fbf9');
    ctx.fillStyle = TEAL; ctx.fillRect(-8, -8, w + 16, h * 0.24 + 8);
    txt(ctx, '택배 접수', w / 2, h * 0.12, 56, '#ffffff');
    ctx.fillStyle = '#c99a5a'; ctx.fillRect(w * 0.25, h * 0.32, w * 0.5, h * 0.3); ctx.fillStyle = '#a07a40'; ctx.fillRect(w * 0.25, h * 0.32, w * 0.5, h * 0.05);
    ctx.fillStyle = '#e8d2a8'; ctx.fillRect(w * 0.45, h * 0.32, w * 0.1, h * 0.3);
    txt(ctx, '보내고 받는 곳', w / 2, h * 0.72, 36, TEAL_D);
    txt(ctx, '24시간 언제나', w / 2, h * 0.84, 30, '#555');
  });
  // --- headers and signs
  const header = (s, a, b, fs = 54) => (ctx, w, h) => {
    grad(ctx, w, h, a, b);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-8, -8, w + 16, h * 0.42);
    txt(ctx, s, w / 2, h * 0.54, fs, '#ffffff', 'rgba(0,0,0,0.3)', 4, w * 0.9);
  };
  add('hdrDrinks', 1024, 96, (ctx, w, h) => {
    grad(ctx, w, h, '#1aa2d8', '#0c6fa8');
    for (let i = 0; i < 6; i++) ART.bubbles(ctx, 60 + i * 180, h * 0.5, 70, R, '#ffffff66');
    txt(ctx, '시원한 음료', w * 0.5, h * 0.54, 64, '#ffffff', 'rgba(0,0,0,0.3)', 5);
    txt(ctx, '❄', w * 0.27, h * 0.52, 50, '#e8f6ff'); txt(ctx, '❄', w * 0.73, h * 0.52, 50, '#e8f6ff');
  });
  add('hdrFresh', 640, 84, header('신선식품 · 도시락', '#2f9a46', '#1d6a31', 50));
  add('hdrIce', 420, 110, (ctx, w, h) => {
    grad(ctx, w, h, '#ff7aa8', '#e8467a');
    for (let i = 0; i < 3; i++) { ell(ctx, 40 + i * 170, h * 0.5, 22, 22, 0, ['#fff2c8', '#8ed65a', '#5a3220'][i]); }
    txt(ctx, '아이스크림', w / 2, h * 0.54, 56, '#ffffff', 'rgba(120,0,40,0.5)', 6, w * 0.7);
  });
  add('catSnack', 480, 110, header('과자 · 스낵', '#ff8d21', '#e5601a', 58));
  add('catRamen', 480, 110, header('라면 · 즉석식품', '#d8261c', '#a51410', 54));
  add('catLife', 480, 110, header('생활용품', '#5a6fd8', '#3a4aa8', 58));
  add('self', 600, 220, (ctx, w, h) => {
    grad(ctx, w, h, '#2a2f36', '#1a1d22');
    txt(ctx, '셀프 코너', w / 2, h * 0.2, 56, '#ffd23f');
    const items = [['전자레인지', '#ff8d21'], ['뜨거운 물', '#1aa2d8'], ['커피 1,500원', '#c98a46']];
    items.forEach(([s, c], i) => { rrect(ctx, 20 + i * 192, h * 0.42, 176, h * 0.44, 16); ctx.fillStyle = c; ctx.fill(); txt(ctx, s, 108 + i * 192, h * 0.64, 30, '#fff', null, 0, 160); });
  });
  add('mat', 400, 240, (ctx, w, h) => {
    fill(ctx, w, h, '#1d2a28');
    rrect(ctx, 14, 14, w - 28, h - 28, 20); ctx.strokeStyle = TEAL; ctx.lineWidth = 8; ctx.stroke();
    txt(ctx, '어서오세요', w / 2, h * 0.42, 66, '#e8f4f0');
    txt(ctx, '세온마트', w / 2, h * 0.72, 40, '#5fd0bd');
  });
  add('door', 320, 64, (ctx, w, h) => { fill(ctx, w, h, '#ffffff'); txt(ctx, '자동문', w / 2, h / 2, 40, TEAL_D); });
  add('band', 512, 24, (ctx, w, h) => { fill(ctx, w, h, TEAL); for (let x = 12; x < w; x += 24) { ctx.beginPath(); ctx.arc(x, h / 2, 6, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); } });
  add('aboard', 255, 340, (ctx, w, h) => {
    fill(ctx, w, h, '#26302c');
    ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.strokeRect(14, 14, w - 28, h - 28); ctx.setLineDash([]);
    txt(ctx, '오늘의 행사', w / 2, h * 0.13, 40, '#ffe14a');
    txt(ctx, '컵라면', w / 2, h * 0.3, 44, '#ffffff'); txt(ctx, '1+1', w / 2, h * 0.44, 70, '#ff7a5a');
    txt(ctx, '삼각김밥', w / 2, h * 0.62, 44, '#ffffff'); txt(ctx, '2+1', w / 2, h * 0.76, 70, '#7ad8ff');
    txt(ctx, '맛있게 드세요 ♥', w / 2, h * 0.9, 26, '#e8e2d0');
  });
  add('pos', 200, 150, (ctx, w, h) => {
    fill(ctx, w, h, '#0e2a3a'); ctx.fillStyle = TEAL; ctx.fillRect(0, 0, w, 22); txt(ctx, '세온마트 POS', w / 2, 11, 14, '#fff');
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ffffff22'; ctx.fillRect(10, 32 + i * 18, w * 0.55, 14); ctx.fillStyle = '#ffffffaa'; ctx.fillRect(14, 36 + i * 18, 40 + i * 9, 6); }
    for (let i = 0; i < 6; i++) { rrect(ctx, w * 0.65 + (i % 2) * 34, 32 + Math.floor(i / 2) * 30, 30, 26, 5); ctx.fillStyle = ['#ff8d21', '#2fa3e0', '#3ec46d'][i % 3]; ctx.fill(); }
    txt(ctx, '합계 4,500원', w * 0.3, h - 20, 18, '#ffe14a');
  });
  add('cust', 160, 80, (ctx, w, h) => { fill(ctx, w, h, '#0b1a22'); txt(ctx, '4,500원', w / 2, h * 0.42, 34, '#7af0c8'); txt(ctx, '감사합니다', w / 2, h * 0.8, 16, '#ffffffaa'); });
  add('card', 64, 48, (ctx, w, h) => { fill(ctx, w, h, '#0b1a22'); txt(ctx, '카드', w / 2, h * 0.5, 18, '#7af0c8'); });
  add('micro', 96, 40, (ctx, w, h) => { fill(ctx, w, h, '#06120c'); txt(ctx, '0:30', w * 0.5, h * 0.52, 26, '#4cff9a'); });
  add('binA', 160, 60, (ctx, w, h) => { fill(ctx, w, h, '#ffffff'); txt(ctx, '일반쓰레기', w / 2, h / 2, 26, '#333'); });
  add('binB', 160, 60, (ctx, w, h) => { fill(ctx, w, h, '#ffffff'); txt(ctx, '재활용', w / 2, h / 2, 28, '#1f8a3a'); });
  add('staff', 200, 70, (ctx, w, h) => { fill(ctx, w, h, '#f2f2f2'); txt(ctx, '직원 전용', w / 2, h / 2, 34, '#c8301e'); });
  add('mural', 640, 208, (ctx, w, h) => {
    grad(ctx, w, h, '#e9f6f2', '#cfeee6', true);
    ctx.fillStyle = '#ffd8a0'; ctx.beginPath(); ctx.arc(w * 0.16, h * 0.62, h * 0.42, Math.PI, 0); ctx.fill();
    ctx.fillStyle = SUN; ctx.beginPath(); ctx.arc(w * 0.16, h * 0.62, h * 0.28, Math.PI, 0); ctx.fill();
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) / 7 * Math.PI; ctx.save(); ctx.translate(w * 0.16 + Math.cos(a) * h * 0.36, h * 0.62 + Math.sin(a) * h * 0.36); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = SUN; ctx.fillRect(-4, -12, 8, 18); ctx.restore(); }
    ctx.fillStyle = TEAL; ctx.fillRect(-8, h * 0.62, w + 16, h * 0.06); ctx.fillStyle = '#7fd1c1'; ctx.fillRect(-8, h * 0.74, w + 16, h * 0.04);
    txt(ctx, '세온마트', w * 0.58, h * 0.34, 74, TEAL_D);
    txt(ctx, '늘 곁에, 스물네 시간', w * 0.58, h * 0.86, 34, '#3c6a62');
    for (const [x, c] of [[0.36, '#ff6f7d'], [0.42, '#ffd23f'], [0.48, '#7ad8ff']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w * x, h * 0.62 - 10, 9, 0, 7); ctx.fill(); }
  });
  add('bagsign', 160, 96, (ctx, w, h) => {
    fill(ctx, w, h, '#ffffff'); ctx.fillStyle = TEAL; ctx.fillRect(-8, -8, w + 16, 30);
    txt(ctx, '봉투 필요하세요?', w / 2, 11, 17, '#fff', null, 0, w - 12);
    txt(ctx, '20원', w / 2, h * 0.64, 40, '#d8201c');
  });
  add('clock', 128, 128, (ctx, w, h) => {
    fill(ctx, w, h, '#e8e8e6');
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.46, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = '#333'; ctx.fillRect(w / 2 + Math.sin(a) * w * 0.38 - 2, h / 2 - Math.cos(a) * h * 0.38 - 2, 4, 4); }
    ctx.strokeStyle = '#222'; ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + 18, h / 2 - 20); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 - 6, h / 2 + 38); ctx.stroke();
  });
  pack();
  const tex = canvasTex(W, H, (ctx) => {
    for (const [r, draw] of jobs) {
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x - PAD, r.y - PAD, r.w + PAD * 2, r.h + PAD * 2); ctx.clip();
      ctx.translate(r.x, r.y);
      draw(ctx, r.w, r.h);
      ctx.restore();
    }
  });
  ATLAS = { tex, rects };
  return ATLAS;
}

const SIGN_H = 512;
function signTexture() {
  return canvasTex(2048, SIGN_H, (ctx, w, hh) => {
    const h = 216;
    // side blade panel (square) at x 0..300, y 230..530 -> drawn below the main sign
    ctx.save(); ctx.translate(0, 236);
    { const s = 270;
      const g2 = ctx.createLinearGradient(0, 0, 0, s); g2.addColorStop(0, '#16a08f'); g2.addColorStop(1, '#0b6a5f');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4; ctx.strokeRect(8, 8, s - 16, s - 16);
      ctx.beginPath(); ctx.arc(s / 2, 82, 46, 0, 7); ctx.fillStyle = '#fff6e4'; ctx.fill();
      ctx.beginPath(); ctx.arc(s / 2, 90, 30, Math.PI, 0); ctx.fillStyle = SUN; ctx.fill();
      ctx.fillStyle = TEAL; ctx.fillRect(s / 2 - 34, 92, 68, 7); ctx.fillRect(s / 2 - 24, 104, 48, 6);
      txt(ctx, '세온마트', s / 2, 168, 56, '#ffffff', 'rgba(0,50,44,0.5)', 6);
      rrect(ctx, 50, 202, s - 100, 46, 23); ctx.fillStyle = '#ffd23f'; ctx.fill();
      txt(ctx, '24시', s / 2, 226, 34, '#0b5f55'); }
    ctx.restore();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#16a08f'); g.addColorStop(1, '#0b6a5f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, 0, w, h * 0.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 5; ctx.strokeRect(14, 14, w - 28, h - 28);
    // logo: a rising sun
    const lx = 520, ly = h * 0.5;
    ctx.beginPath(); ctx.arc(lx, ly, 70, 0, 7); ctx.fillStyle = '#fff6e4'; ctx.fill();
    ctx.beginPath(); ctx.arc(lx, ly + 10, 44, Math.PI, 0); ctx.fillStyle = SUN; ctx.fill();
    ctx.fillStyle = SUN;
    for (let i = 0; i < 5; i++) { const a = Math.PI + (i + 0.5) / 5 * Math.PI; ctx.save(); ctx.translate(lx + Math.cos(a) * 56, ly + 10 + Math.sin(a) * 56); ctx.rotate(a + Math.PI / 2); ctx.fillRect(-4, -9, 8, 14); ctx.restore(); }
    ctx.fillStyle = TEAL; ctx.fillRect(lx - 50, ly + 14, 100, 10); ctx.fillRect(lx - 36, ly + 30, 72, 8);
    ctx.font = `150px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,50,44,0.55)';
    ctx.strokeText('세온마트', 630, h * 0.55); ctx.fillStyle = '#ffffff'; ctx.fillText('세온마트', 630, h * 0.55);
    const tw = ctx.measureText('세온마트').width;
    const px = 630 + tw + 50;
    rrect(ctx, px, h * 0.27, 330, h * 0.48, 50); ctx.fillStyle = '#ffd23f'; ctx.fill();
    txt(ctx, '24시 편의점', px + 165, h * 0.52, 62, '#0b5f55', null, 0, 300);
  });
}

// ------------------------------------------------------------------ product templates
function bagGeo(w, h, d, r, back) {
  const g = new THREE.PlaneGeometry(w, h, 6, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = (2 * p.getX(i)) / w, ny = (2 * p.getY(i)) / h;
    const ex = Math.max(0, 1 - nx * nx);
    const t = Math.min(1, Math.max(0, (1 - Math.abs(ny)) / 0.16));
    p.setZ(i, d * 0.5 * Math.pow(ex, 0.45) * t * t * (3 - 2 * t));
  }
  g.computeVertexNormals();
  toRect(g, r);
  const b = solidUV(new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, 0, -0.002), back);
  const m = merge([g, b]).translate(0, h / 2, 0);
  return prep(m, true);
}
function cylLabel(rad, h, r, seg = 18) {
  const g = new THREE.CylinderGeometry(rad, rad, h, seg, 1, true).rotateY(-Math.PI / 2);
  return toRect(g, r);
}
function boxGeo(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4), u = uv.getX(i), v = uv.getY(i);
    let uu = u, vv = v;
    if (f === 0 || f === 1) { uu = 0.02 + u * 0.06; }
    else if (f === 2 || f === 3) { vv = 0.92 + v * 0.06; }
    uv.setXY(i, r.u0 + uu * (r.u1 - r.u0), r.v0 + vv * (r.v1 - r.v0));
  }
  return prep(g.translate(0, h / 2, 0), true);
}

function productKinds(A, M) {
  const r = A.rects;
  const K = { bags: [], cups: [], bowls: [], drinks: [], bigDrinks: [], cans: [], boxes: [], multi: [], ice: [], kimbap: [], lunch: [], sand: [], gum: [] };
  BAGS.forEach((_, i) => {
    const big = i % 3 === 0;
    const w = big ? 0.2 : 0.165, h = big ? 0.27 : 0.235;
    K.bags.push({ w: w + 0.012, d: 0.075, h, parts: [[bagGeo(w, h, 0.07, r['bag' + i], r['bag' + i]), M.label]] });
  });
  MULTI.forEach((_, i) => K.multi.push({ w: 0.33, d: 0.12, h: 0.2, parts: [[bagGeo(0.32, 0.2, 0.11, r['multi' + i], r['multi' + i]), M.label]] }));
  const lid = r.foil;
  CUPS.forEach((_, i) => {
    const side = toRect(new THREE.CylinderGeometry(0.048, 0.038, 0.105, 18, 1, true).rotateY(-Math.PI / 2).translate(0, 0.0525, 0), r['cup' + i]);
    const top = toRect(new THREE.CircleGeometry(0.05, 18).rotateX(-Math.PI / 2).translate(0, 0.106, 0), lid);
    K.cups.push({ w: 0.104, d: 0.104, h: 0.11, parts: [[prep(merge([side, top]), true), M.label]] });
    const bs = toRect(new THREE.CylinderGeometry(0.074, 0.058, 0.072, 20, 1, true).rotateY(-Math.PI / 2).translate(0, 0.036, 0), r['cup' + i]);
    const bt = toRect(new THREE.CircleGeometry(0.076, 20).rotateX(-Math.PI / 2).translate(0, 0.073, 0), lid);
    K.bowls.push({ w: 0.156, d: 0.156, h: 0.075, parts: [[prep(merge([bs, bt]), true), M.label]] });
  });
  const prof = [[0.001, 0], [0.028, 0.002], [0.032, 0.02], [0.032, 0.148], [0.024, 0.176], [0.0125, 0.198], [0.0125, 0.208]];
  const bodyBase = lathe(prof, 10);
  DRINKS.forEach(([, , , liquid, cap], i) => {
    const body = tint(bodyBase.clone(), liquid);
    const label = prep(cylLabel(0.0326, 0.072, r['drink' + i], 12).translate(0, 0.095, 0), true);
    const capG = tint(cyl(0.0138, 0.0138, 0.02, 8).translate(0, 0.217, 0), cap);
    K.drinks.push({ w: 0.072, d: 0.072, h: 0.227, parts: [[body, M.vcGloss], [label, M.label], [capG, M.vcMatte]] });
    const s = 1.42;
    const bb = tint(bodyBase.clone().scale(s, s, s), liquid);
    const bl = prep(cylLabel(0.0326 * s, 0.072 * s, r['drink' + i], 16).translate(0, 0.095 * s, 0), true);
    const bc = tint(cyl(0.0138 * s, 0.0138 * s, 0.02 * s, 10).translate(0, 0.217 * s, 0), cap);
    K.bigDrinks.push({ w: 0.1, d: 0.1, h: 0.32, parts: [[bb, M.vcGloss], [bl, M.label], [bc, M.vcMatte]] });
  });
  const canTop = merge([cyl(0.029, 0.033, 0.008, 12).translate(0, 0.122, 0), cyl(0.033, 0.029, 0.007, 12).translate(0, 0.0035, 0)]);
  const canTopP = prep(canTop);
  CANS.forEach((_, i) => {
    const side = prep(cylLabel(0.033, 0.111, r['can' + i], 14).translate(0, 0.0625, 0), true);
    K.cans.push({ w: 0.07, d: 0.07, h: 0.126, parts: [[side, M.label], [canTopP, M.steel]] });
  });
  BOXES.forEach((_, i) => {
    const tall = i % 2 === 0;
    const w = tall ? 0.16 : 0.2, h = tall ? 0.26 : 0.16, d = tall ? 0.06 : 0.08;
    K.boxes.push({ w: w + 0.008, d: d + 0.004, h, parts: [[boxGeo(w, h, d, r['box' + i]), M.label]] });
  });
  ICE.forEach((_, i) => {
    const g = bagGeo(0.16, 0.062, 0.03, r['ice' + i], r['ice' + i]);
    K.ice.push({ w: 0.07, d: 0.17, h: 0.03, parts: [[g, M.label]] });
  });
  // kimbap: rounded triangle prism
  const tri = new THREE.Shape();
  const tw = 0.105, th = 0.095, cr = 0.012;
  tri.moveTo(-tw / 2 + cr, 0); tri.lineTo(tw / 2 - cr, 0); tri.quadraticCurveTo(tw / 2, 0, tw / 2 - cr * 0.6, cr * 1.2);
  tri.lineTo(cr * 0.7, th - cr * 1.3); tri.quadraticCurveTo(0, th, -cr * 0.7, th - cr * 1.3); tri.lineTo(-tw / 2 + cr * 0.6, cr * 1.2); tri.quadraticCurveTo(-tw / 2, 0, -tw / 2 + cr, 0);
  KIMBAP.forEach((_, i) => {
    const g = new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.02);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, rc = r['kim' + i];
    for (let k = 0; k < p.count; k++) {
      if (Math.abs(n.getZ(k)) > 0.9) uv.setXY(k, rc.u0 + ((p.getX(k) + tw / 2) / tw) * (rc.u1 - rc.u0), rc.v0 + (p.getY(k) / th) * (rc.v1 - rc.v0));
      else uv.setXY(k, rc.u0 + 0.5 * (rc.u1 - rc.u0), rc.v0 + 0.1 * (rc.v1 - rc.v0));
    }
    K.kimbap.push({ w: 0.112, d: 0.045, h: th, parts: [[prep(g, true), M.label]] });
  });
  LUNCH.forEach((_, i) => {
    const base = tint(prep(new THREE.BoxGeometry(0.2, 0.05, 0.14).translate(0, 0.025, 0)), 0x1b1b1d);
    const top = prep(toRect(new THREE.PlaneGeometry(0.196, 0.136).rotateX(-Math.PI / 2).translate(0, 0.0505, 0), r['lunch' + i]), true);
    K.lunch.push({ w: 0.205, d: 0.145, h: 0.05, parts: [[base, M.vcGloss], [top, M.label]] });
  });
  {
    const s = new THREE.Shape(); s.moveTo(-0.06, 0); s.lineTo(0.06, 0); s.lineTo(0, 0.11); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.055, bevelEnabled: false }).translate(0, 0, -0.0275);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, rc = r.sand0;
    for (let k = 0; k < p.count; k++) {
      if (Math.abs(n.getZ(k)) > 0.9) uv.setXY(k, rc.u0 + ((p.getX(k) + 0.06) / 0.12) * (rc.u1 - rc.u0), rc.v0 + (p.getY(k) / 0.11) * (rc.v1 - rc.v0));
      else uv.setXY(k, rc.u0 + 0.5 * (rc.u1 - rc.u0), rc.v0 + 0.5 * (rc.v1 - rc.v0));
    }
    K.sand.push({ w: 0.125, d: 0.06, h: 0.11, parts: [[prep(g, true), M.label]] });
  }
  K.hang = BAGS.map((_, i) => ({ w: 0.13, d: 0.05, h: 0.18, parts: [[bagGeo(0.125, 0.18, 0.04, r['bag' + i], r['bag' + i]), M.label]] }));
  K.smallBoxes = BOXES.map((_, i) => ({ w: 0.11, d: 0.05, h: 0.15, parts: [[boxGeo(0.105, 0.15, 0.045, r['box' + i]), M.label]] }));
  GUM.forEach((_, i) => K.gum.push({ w: 0.075, d: 0.02, h: 0.05, parts: [[boxGeo(0.07, 0.048, 0.018, r['gum' + i]), M.label]] }));
  return K;
}

function placeKind(parent, k, x, y, z, ry = 0, rx = 0, rz = 0) {
  for (const [geo, m] of k.parts) put(parent, geo, m, x, y, z, rx, ry, rz);
}
/** Stock a straight shelf run from x0 to x1 (along X) with product blocks. dir +1 faces +Z. */
function stockRun(parent, list, x0, x1, y, zFront, dir, rows, R, { gap = 0.004, sold = 0.04, lean = 0 } = {}) {
  let x = x0 + 0.012;
  for (;;) {
    const k = list[Math.floor(R() * list.length)];
    const n = 2 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      if (x + k.w > x1 - 0.008) return;
      const skipFront = R() < sold;
      for (let row = 0; row < rows; row++) {
        if (row === 0 && skipFront) continue;
        const z = zFront - dir * (k.d / 2 + 0.012 + row * k.d * 1.04);
        const j = (R() - 0.5) * 0.06;
        placeKind(parent, k, x + k.w / 2 + (R() - 0.5) * 0.004, y, z, (dir > 0 ? 0 : Math.PI) + j, lean * dir);
      }
      x += k.w + gap;
    }
  }
}
/** Same along Z (for wall shelves on the X walls). dir +1 faces +X. */
function stockRunZ(parent, list, z0, z1, y, xFront, dir, rows, R, { gap = 0.004, sold = 0.04 } = {}) {
  let z = z0 + 0.012;
  for (;;) {
    const k = list[Math.floor(R() * list.length)];
    const n = 2 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      if (z + k.w > z1 - 0.008) return;
      const skipFront = R() < sold;
      for (let row = 0; row < rows; row++) {
        if (row === 0 && skipFront) continue;
        const x = xFront - dir * (k.d / 2 + 0.012 + row * k.d * 1.04);
        placeKind(parent, k, x, y, z + k.w / 2, dir * Math.PI / 2 + (R() - 0.5) * 0.06);
      }
      z += k.w + gap;
    }
  }
}

// ------------------------------------------------------------------ the store
export function buildStore(opts = {}) {
  const glowK = opts.glow ?? 1;
  const site = makeSite('store', 10, 8);
  const g = site.group;
  const A = buildAtlas();
  const rnd = rng(4242);

  const labelMat = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.36, metalness: 0 });
  labelMat.name = 'store-labels';
  const screenMat = new THREE.MeshStandardMaterial({ map: A.tex, emissiveMap: A.tex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.25 });
  screenMat.name = 'store-screens';
  const vcMatte = paint(0xffffff, 0.55).clone(); vcMatte.vertexColors = true; vcMatte.name = 'store-vc-matte';
  const vcGloss = paint(0xffffff, 0.16).clone(); vcGloss.vertexColors = true; vcGloss.name = 'store-vc-gloss';
  const signMat = glow(0xffffff, 1.25 * glowK, signTexture());
  signMat.name = 'store-sign'; signMat.userData.glowMax = 1.25;
  const M = {
    ext: mat('plasterGray'), int: mat('plaster'), floor: textured('tiles', { color: 0xe2e0da, grout: 0xaeaca6, count: 2, groutWidth: 0.008, rough: 0.22 }, 1.2, { normal: 0.35 }), concrete: mat('concrete'),
    brand: paint(0x13897a, 0.42), brandDark: paint(0x0d5f56, 0.5),
    frame: paint(0x2b3035, 0.36, 0.6), steel: mat('steel'), chrome: mat('chrome'), glass: mat('glass'),
    cool: mat('coolGlow'), white: mat('whitePlastic'), black: mat('blackPlastic'), rubber: mat('rubber'),
    shelf: paint(0xe6e8ea, 0.4, 0.25), kick: paint(0x50565e, 0.45, 0.3), oak: mat('oak'),
    ceiling: textured('tiles', { color: 0xf3f3f1, grout: 0xcfd2d4, count: 2, groutWidth: 0.012, rough: 0.7 }, 1.2, { normal: 0.25 }),
    awning: textured('stripes', { color: 0x15907f, color2: 0xf4efe4, count: 6, ratio: 0.5 }, 1.8, { normal: 0.5 }),
    label: labelMat, screen: screenMat, vcMatte, vcGloss, sign: signMat,
  };
  const K = productKinds(A, M);
  const r = A.rects;

  // ---------------------------------------------------------------- shell
  // slab + front step
  B(g, M.concrete, -4.85, 0, -3.95, 4.85, FL - 0.01, 2.25);
  B(g, M.floor, -XI, FL - 0.012, ZB, XI, FL, ZF);
  B(g, mat('stone'), -4.85, 0, 2.25, 4.85, 0.075, 2.62);
  B(g, mat('stone'), -4.85, 0.075, 2.12, 4.85, FL, 2.25);
  solid(site, 0, FL / 2, -0.85, 9.7, FL, 6.2);
  solid(site, 0, 0.0375, 2.435, 9.7, 0.075, 0.37);
  // exterior walls (outer core) + interior skin
  const WT = 4.15;
  B(g, M.ext, -4.85, 0.42, -3.95, -4.7, WT, 2.15); // left
  B(g, M.ext, 4.7, 0.42, -3.95, 4.85, WT, 2.15); // right
  B(g, M.ext, -4.7, 0.42, -3.95, 4.7, WT, -3.8); // back
  // dark plinth band all around
  B(g, M.kick, -4.87, 0, -3.97, -4.7, 0.42, 2.15);
  B(g, M.kick, 4.7, 0, -3.97, 4.87, 0.42, 2.15);
  B(g, M.kick, -4.7, 0, -3.97, 4.7, 0.42, -3.8);
  // brand band and coping
  B(g, M.brand, -4.88, 3.42, -3.98, -4.84, WT - 0.02, 2.18);
  B(g, M.brand, 4.84, 3.42, -3.98, 4.88, WT - 0.02, 2.18);
  B(g, M.brand, -4.84, 3.42, -3.98, 4.84, WT - 0.02, -3.94);
  R(g, M.frame, 0, WT + 0.02, -3.88, 9.86, 0.06, 0.24, 0.01, 1);
  R(g, M.frame, -4.78, WT + 0.02, -0.88, 0.24, 0.06, 6.1, 0.01, 1);
  R(g, M.frame, 4.78, WT + 0.02, -0.88, 0.24, 0.06, 6.1, 0.01, 1);
  // interior skins
  B(g, M.int, -4.7, FL, ZB - 0.05, -XI, CL, 1.98);
  B(g, M.int, XI, FL, ZB - 0.05, 4.7, CL, 1.98);
  B(g, M.int, -XI, FL, -3.8, XI, CL, ZB);
  solid(site, -4.75, 2, -0.9, 0.2, 4, 6.1);
  solid(site, 4.75, 2, -0.9, 0.2, 4, 6.1);
  solid(site, 0, 2, -3.85, 9.7, 4, 0.2);
  // roof slab, ceiling, parapet inner faces
  B(g, M.concrete, -4.7, 3.42, -3.8, 4.7, 3.62, 2.12);
  B(g, M.ext, -4.7, 3.62, -3.8, -4.6, WT, 2.0);
  B(g, M.ext, 4.6, 3.62, -3.8, 4.7, WT, 2.0);
  B(g, M.ext, -4.6, 3.62, -3.8, 4.6, WT, -3.7);
  B(g, M.ceiling, -XI, CL, ZB, XI, CL + 0.03, 1.98);
  // front corner piers and fascia
  B(g, M.ext, -4.85, 0.42, 1.95, -4.62, 3.05, 2.15);
  B(g, M.ext, 4.62, 0.42, 1.95, 4.85, 3.05, 2.15);
  B(g, M.kick, -4.87, 0, 1.95, -4.62, 0.42, 2.17);
  B(g, M.kick, 4.62, 0, 1.95, 4.87, 0.42, 2.17);
  B(g, M.brand, -4.88, 3.02, 1.95, 4.88, WT - 0.02, 2.18);
  R(g, M.frame, 0, WT + 0.02, 2.06, 9.86, 0.06, 0.26, 0.01, 1);
  B(g, M.int, -XI, 3.05, 1.92, XI, 3.42, 1.98);
  // rooftop: two condensing units and a hatch
  for (const [x, z] of [[-2.6, -2.2], [-1.2, -2.2]]) {
    R(g, M.white, x, 3.62 + 0.38, z, 1.0, 0.76, 0.42, 0.03, 2);
    const fan = put(g, cyl(0.26, 0.26, 0.02, 24), M.black, x - 0.12, 4.0, z + 0.22, Math.PI / 2, 0, 0);
    put(g, torus(0.27, 0.02, 6, 24), M.steel, x - 0.12, 4.0, z + 0.235);
    for (let k = -2; k <= 2; k++) put(g, cyl(0.006, 0.006, 0.52, 4), M.steel, x - 0.12 + k * 0.1, 4.0, z + 0.24, 0, 0, 0);
    R(g, M.kick, x, 3.64, z, 0.9, 0.04, 0.5, 0.01, 1);
    void fan;
  }
  R(g, M.steel, 2.6, 3.72, -2.4, 0.9, 0.2, 0.9, 0.03, 2);

  // ---------------------------------------------------------------- storefront
  const sf = group(g);
  // kick plates (storefront base)
  B(sf, M.frame, -4.62, FL, 2.0, -0.62, 0.42, 2.12);
  B(sf, M.frame, 0.62, FL, 2.0, 4.62, 0.42, 2.12);
  // mullions
  const mull = [-4.62, -3.1, -1.6, -0.66, 0.66, 1.85, 3.25, 4.62];
  for (const x of mull) R(sf, M.frame, x, (FL + 3.04) / 2, 2.06, 0.08, 3.04 - FL, 0.12, 0.01, 1);
  // head and transom
  R(sf, M.frame, 0, 3.0, 2.06, 9.3, 0.1, 0.13, 0.01, 1);
  R(sf, M.frame, -2.64, 2.45, 2.06, 3.95, 0.06, 0.1, 0.01, 1);
  R(sf, M.frame, 0, 2.47, 2.06, 1.4, 0.06, 0.12, 0.01, 1);
  R(sf, M.frame, 2.64, 2.45, 2.06, 3.95, 0.06, 0.1, 0.01, 1);
  // glass panes
  const glassPanes = [];
  const pane = (x0, x1, y0, y1, z = ZF) => {
    const o = B(sf, M.glass, x0, y0, z - 0.006, x1, y1, z + 0.006, false);
    glassPanes.push(o);
  };
  for (let i = 0; i < mull.length - 1; i++) {
    const x0 = mull[i] + 0.04, x1 = mull[i + 1] - 0.04;
    if (i === 3) { pane(x0, x1, 2.5, 2.95); continue; } // above the door
    pane(x0, x1, 0.42, 2.42); pane(x0, x1, 2.48, 2.95);
  }
  solid(site, -2.64, 1.6, 2.06, 3.96, 2.9, 0.16);
  solid(site, 2.64, 1.6, 2.06, 3.96, 2.9, 0.16);
  // night: the brightly lit shop seen through the glass (outward-facing additive panes, invisible by day)
  {
    const shine = canvasTex(64, 256, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#c8d4dc'); gr.addColorStop(1, '#8a969e');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    });
    const shineMat = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xe8f2ff, emissiveMap: shine, emissiveIntensity: 0.05 * glowK, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    shineMat.name = 'store-shopglow'; shineMat.userData.glowMax = 0.05;
    site.nightGlow.push(shineMat);
    for (let i = 0; i < mull.length - 1; i++) {
      if (i === 3) continue;
      const x0 = mull[i] + 0.04, x1 = mull[i + 1] - 0.04;
      const sh = put(sf, prep(new THREE.PlaneGeometry(x1 - x0, 2.5).translate((x0 + x1) / 2, 0.42 + 1.25, ZF + 0.012), true), shineMat);
      sh.castShadow = false; sh.receiveShadow = false;
    }
  }
  // door operator housing + sensor
  R(sf, M.frame, 0.6, 2.56, 2.2, 2.6, 0.18, 0.2, 0.02, 2);
  put(sf, sphere(0.03, 12, 8), M.black, -0.2, 2.46, 2.25);
  put(sf, sphere(0.008, 8, 6), glow(0xff3b30, 2), -0.2, 2.44, 2.275).castShadow = false;
  // threshold track
  R(sf, M.steel, 0.6, FL + 0.005, 2.18, 2.6, 0.012, 0.1, 0.004, 1);
  // window decals (outside face prints, inside face white)
  const decal = (rect, x, y, w, h) => {
    put(sf, aquad(w, h, rect), M.label, x, y, ZF + 0.008).castShadow = false;
    put(sf, toRect(quad(w, h), r.white), M.label, x, y, ZF - 0.008, 0, Math.PI, 0).castShadow = false;
  };
  decal(r.poster1, -3.85, 1.55, 0.6, 0.8);
  decal(r.poster2, 2.55, 1.55, 0.6, 0.8);
  decal(r.poster4, 4.0, 1.55, 0.48, 0.64);
  for (const [x0, x1] of [[-4.58, -3.14], [-3.06, -1.64], [-1.56, -0.7], [0.7, 1.81], [1.89, 3.21], [3.29, 4.58]]) {
    const w = x1 - x0;
    put(sf, toRect(quad(w, 0.05), r.band), M.label, (x0 + x1) / 2, 1.05, ZF + 0.008).castShadow = false;
  }

  // sliding door (dynamic)
  const pivot = new THREE.Group();
  pivot.position.set(0, FL, 2.17);
  pivot.userData.dynamic = true;
  g.add(pivot);
  {
    const dw = 1.26, dh = 2.3;
    R(pivot, M.frame, -dw / 2 + 0.03, dh / 2, 0, 0.06, dh, 0.05, 0.01, 1);
    R(pivot, M.frame, dw / 2 - 0.03, dh / 2, 0, 0.06, dh, 0.05, 0.01, 1);
    R(pivot, M.frame, 0, 0.05, 0, dw, 0.1, 0.05, 0.01, 1);
    R(pivot, M.frame, 0, dh - 0.03, 0, dw, 0.06, 0.05, 0.01, 1);
    const gl = put(pivot, prep(new THREE.BoxGeometry(dw - 0.12, dh - 0.16, 0.01).translate(0, 0.1 + (dh - 0.16) / 2, 0)), M.glass);
    gl.castShadow = false;
    const d1 = put(pivot, aquad(0.4, 0.08, r.door), M.label, 0, 1.25, 0.008); d1.castShadow = false;
    const d2 = put(pivot, aquad(0.4, 0.08, r.door), M.label, 0, 1.25, -0.008, 0, Math.PI, 0); d2.castShadow = false;
    put(pivot, toRect(quad(dw - 0.12, 0.05), r.band), M.label, 0, 0.95, 0.008).castShadow = false;
    put(pivot, toRect(quad(dw - 0.12, 0.05), r.band), M.label, 0, 0.95, -0.008, 0, Math.PI, 0).castShadow = false;
    bake(pivot);
  }
  site.doors.push({ pivot, openAngle: 0, slide: [1.2, 0, 0], auto: true, collider: { min: [-0.63, FL, 2.13], max: [0.63, FL + 2.3, 2.21] } });

  // ---------------------------------------------------------------- sign + awning
  R(g, M.brandDark, 0, 3.6, 2.27, 7.5, 0.84, 0.2, 0.03, 2);
  const sq = put(g, toRect(quad(7.36, 0.74), { u0: 0, u1: 1, v0: 1 - 216 / SIGN_H, v1: 1 }), M.sign, 0, 3.6, 2.373);
  // side signs on the brand band (both side walls)
  for (const sx of [-1, 1]) {
    const x = sx * 4.88;
    R(g, M.brandDark, x + sx * 0.03, 3.78, -0.9, 0.06, 0.5, 4.3, 0.02, 2);
    put(g, toRect(quad(4.16, 0.42), { u0: 0, u1: 1, v0: 1 - 216 / SIGN_H, v1: 1 }), M.sign, x + sx * 0.062, 3.78, -0.9, 0, sx * Math.PI / 2, 0).castShadow = false;
  }
  // sidewalk lightbox pylon at the right front corner (double sided)
  {
    const px = 4.5, pz = 3.55, ry = -0.35;
    const pg = group(g, px, 0, pz, ry);
    R(pg, M.frame, 0, 0.03, 0, 0.5, 0.06, 0.36, 0.015, 2);
    R(pg, M.frame, 0, 0.75, 0, 0.08, 1.4, 0.08, 0.01, 1);
    R(pg, M.brandDark, 0, 1.72, 0, 0.74, 0.74, 0.16, 0.03, 2);
    const fr = { u0: 0, u1: 270 / 2048, v0: 1 - (236 + 270) / SIGN_H, v1: 1 - 236 / SIGN_H };
    put(pg, toRect(quad(0.64, 0.64), fr), M.sign, 0, 1.72, 0.082).castShadow = false;
    put(pg, toRect(quad(0.64, 0.64), fr), M.sign, 0, 1.72, -0.082, 0, Math.PI, 0).castShadow = false;
    solid(site, px, 1.0, pz, 0.5, 2.0, 0.4);
  }
  sq.castShadow = false;
  site.nightGlow.push(M.sign);
  // awning (slope, valance, side wedges, arms)
  {
    const z0 = 2.18, z1 = 3.2, y0 = 3.0, y1 = 2.72;
    const L = Math.hypot(z1 - z0, y0 - y1), a = Math.atan2(y0 - y1, z1 - z0);
    put(g, rbox(9.3, 0.02, L, 0.008, 1), M.awning, 0, (y0 + y1) / 2, (z0 + z1) / 2, a, 0, 0);
    const vs = new THREE.Shape();
    const VW = 9.3, VH = 0.22, n = 31;
    vs.moveTo(-VW / 2, 0);
    for (let i = 0; i < n; i++) {
      const xa = -VW / 2 + (i / n) * VW, xb = -VW / 2 + ((i + 1) / n) * VW;
      vs.quadraticCurveTo((xa + xb) / 2, -0.09, xb, 0);
    }
    vs.lineTo(VW / 2, VH); vs.lineTo(-VW / 2, VH); vs.closePath();
    put(g, extrude(vs, 0.012), M.awning, 0, y1 - VH + 0.012, z1 - 0.004);
    for (const sx of [-1, 1]) {
      const ws = new THREE.Shape();
      ws.moveTo(0, 0); ws.lineTo(z1 - z0, 0); ws.lineTo(0, y0 - y1 + 0.0); ws.closePath();
      put(g, extrude(ws, 0.012), M.awning, sx * 4.65 - (sx > 0 ? 0.012 : 0), y1, z0, 0, -Math.PI / 2, 0);
      put(g, cyl(0.012, 0.012, 1.2, 8), M.frame, sx * 4.55, 2.5, 2.68, -1.0, 0, 0);
    }
    put(g, cyl(0.018, 0.018, 9.3, 10), M.frame, 0, y1 + 0.005, z1 - 0.02, 0, 0, Math.PI / 2);
    for (const x of [-2.4, 0, 2.4]) put(g, cyl(0.012, 0.012, 1.2, 8), M.frame, x, 2.5, 2.68, -1.0, 0, 0);
  }

  // ---------------------------------------------------------------- interior lighting (ceiling)
  const panels = [];
  for (const z of [-2.55, -0.85, 0.95]) {
    for (const x of [-3.0, 0.0, 3.0]) {
      R(g, M.white, x, CL - 0.012, z, 2.3, 0.03, 0.32, 0.01, 1);
      panels.push(B(g, M.cool, x - 1.1, CL - 0.032, z - 0.12, x + 1.1, CL - 0.02, z + 0.12, false));
    }
  }
  for (const [x, z] of [[-2.4, -1.7], [2.2, -1.7], [-2.4, 0.9], [2.2, 0.9]]) site.lamps.push({ pos: [x, 2.85, z], color: 0xeef4ff, intensity: 14, range: 7.5 });
  // security dome + clock
  put(g, sphere(0.07, 16, 8), M.black, 4.3, CL - 0.02, 1.6).scale.y = 0.6;
  R(g, M.white, 4.3, CL - 0.01, 1.6, 0.16, 0.02, 0.16, 0.01, 1);

  // ---------------------------------------------------------------- drink fridges along the back wall
  {
    const x0 = -XI, nd = 6, dw = 0.86, x1 = x0 + nd * dw, zf = -3.0, top = FL + 2.2;
    B(g, M.frame, x0, FL, ZB, x1, FL + 0.18, zf); // base
    B(g, M.frame, x0, top - 0.02, ZB, x1, top + 0.32, zf); // header box
    put(g, aquad(x1 - x0 - 0.2, 0.26, r.hdrDrinks), M.screen, (x0 + x1) / 2, top + 0.15, zf + 0.004).castShadow = false;
    B(g, M.white, x0, FL + 0.18, ZB, x1, top - 0.02, -3.42); // interior back
    B(g, M.white, x1 - 0.04, FL, ZB, x1, top + 0.3, zf); // end panel
    for (let i = 0; i < nd; i++) {
      const xa = x0 + i * dw, xc = xa + dw / 2;
      // shelves and stock
      for (let s = 0; s < 5; s++) {
        const y = FL + 0.2 + s * 0.38;
        R(g, M.steel, xc, y - 0.008, -3.22, dw - 0.06, 0.012, 0.42, 0.004, 1);
        const list = s === 0 ? K.bigDrinks : s % 2 ? K.drinks : [...K.cans, ...K.drinks];
        stockRun(g, list, xa + 0.04, xa + dw - 0.03, y, -3.05, 1, 2, rnd, { sold: 0.06 });
        put(g, toRect(quad(dw - 0.08, 0.025), r.price), M.label, xc, y - 0.015, -3.012).castShadow = false;
      }
      // LED strip behind each mullion
      panels.push(B(g, M.cool, xa + 0.005, FL + 0.25, -3.1, xa + 0.025, top - 0.08, -3.08, false));
      // door: frame, glass, handle
      R(g, M.frame, xa + 0.02, (FL + 0.18 + top) / 2, zf + 0.03, 0.04, top - FL - 0.18, 0.06, 0.01, 1);
      R(g, M.black, xc, FL + 0.2, zf + 0.03, dw - 0.04, 0.04, 0.05, 0.01, 1);
      R(g, M.black, xc, top - 0.04, zf + 0.03, dw - 0.04, 0.04, 0.05, 0.01, 1);
      glassPanes.push(B(g, M.glass, xa + 0.04, FL + 0.22, zf + 0.024, xa + dw - 0.02, top - 0.06, zf + 0.034, false));
      put(g, cyl(0.012, 0.012, 1.1, 10), M.chrome, xa + dw - 0.1, FL + 1.15, zf + 0.09);
      R(g, M.chrome, xa + dw - 0.1, FL + 0.6, zf + 0.065, 0.03, 0.03, 0.05, 0.008, 1);
      R(g, M.chrome, xa + dw - 0.1, FL + 1.7, zf + 0.065, 0.03, 0.03, 0.05, 0.008, 1);
    }
    R(g, M.frame, x1 - 0.02, (FL + top) / 2, zf + 0.03, 0.04, top - FL, 0.06, 0.01, 1);
    solid(site, (x0 + x1) / 2, FL + 1.25, (ZB + zf) / 2, x1 - x0, 2.5, zf - ZB);
  }

  // ---------------------------------------------------------------- ice-cream freezer
  {
    const x0 = 0.78, x1 = 2.28, z0 = -3.7, z1 = -2.98, h = FL + 0.84;
    R(g, M.white, (x0 + x1) / 2, (FL + h) / 2, (z0 + z1) / 2, x1 - x0, h - FL, z1 - z0, 0.04, 2);
    R(g, M.brand, (x0 + x1) / 2, FL + 0.32, z1 + 0.002, x1 - x0 - 0.06, 0.1, 0.01, 0.004, 1);
    R(g, M.kick, (x0 + x1) / 2, FL + 0.05, z1 - 0.02, x1 - x0 - 0.04, 0.1, 0.02, 0.005, 1);
    // inner well
    B(g, mat('whitePlastic'), x0 + 0.06, h - 0.32, z0 + 0.06, x1 - 0.06, h - 0.3, z1 - 0.06);
    // bins + ice creams
    const bins = [[0xff8db0, 0], [0x8ed65a, 1], [0x6ec8f5, 4], [0xfff0c8, 2]];
    bins.forEach(([c, ii], bi) => {
      const bx0 = x0 + 0.08 + bi * 0.335, bx1 = bx0 + 0.32;
      const bin = tint(prep(new THREE.BoxGeometry(0.32, 0.12, 0.54).translate((bx0 + bx1) / 2, h - 0.24, (z0 + z1) / 2)), c);
      put(g, bin, M.vcMatte);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
        const k = K.ice[(ii + (row + col) % 2 * 3) % K.ice.length];
        placeKind(g, k, bx0 + 0.05 + col * 0.075, h - 0.18 + row * 0.012 + (col % 2) * 0.006, (z0 + z1) / 2 - 0.16 + row * 0.16, 0.1 * (rnd() - 0.5), -Math.PI / 2, (rnd() - 0.5) * 0.3);
      }
    });
    // sliding glass lids on a chrome rim
    R(g, M.chrome, (x0 + x1) / 2, h + 0.01, z0 + 0.03, x1 - x0, 0.03, 0.04, 0.01, 1);
    R(g, M.chrome, (x0 + x1) / 2, h + 0.01, z1 - 0.03, x1 - x0, 0.03, 0.04, 0.01, 1);
    glassPanes.push(B(g, M.glass, x0 + 0.04, h + 0.0, z0 + 0.05, (x0 + x1) / 2 + 0.05, h + 0.01, z1 - 0.05, false));
    glassPanes.push(B(g, M.glass, (x0 + x1) / 2 - 0.05, h + 0.025, z0 + 0.05, x1 - 0.04, h + 0.035, z1 - 0.05, false));
    // topper sign
    put(g, cyl(0.01, 0.01, 0.3, 6), M.chrome, x0 + 0.3, h + 0.15, z0 + 0.04);
    put(g, cyl(0.01, 0.01, 0.3, 6), M.chrome, x1 - 0.3, h + 0.15, z0 + 0.04);
    R(g, M.white, (x0 + x1) / 2, h + 0.4, z0 + 0.04, 1.06, 0.28, 0.025, 0.01, 1);
    put(g, aquad(1.0, 0.24, r.hdrIce), M.screen, (x0 + x1) / 2, h + 0.4, z0 + 0.054).castShadow = false;
    solid(site, (x0 + x1) / 2, (FL + h) / 2, (z0 + z1) / 2, x1 - x0, h - FL, z1 - z0);
  }

  // ---------------------------------------------------------------- self corner (coffee, microwaves, hot water)
  {
    const x0 = 2.45, x1 = XI, z0 = ZB, z1 = -3.15, h = FL + 0.9;
    B(g, M.white, x0, FL + 0.08, z0, x1, h - 0.04, z1);
    B(g, M.kick, x0 + 0.03, FL, z0, x1, FL + 0.08, z1 - 0.04);
    R(g, M.oak, (x0 + x1) / 2, h - 0.02, (z0 + z1) / 2 + 0.01, x1 - x0, 0.04, z1 - z0 + 0.03, 0.01, 2);
    for (let i = 0; i < 3; i++) R(g, M.white, x0 + 0.37 + i * 0.73, FL + 0.5, z1 + 0.003, 0.7, 0.66, 0.01, 0.005, 1);
    for (let i = 0; i < 3; i++) R(g, M.chrome, x0 + 0.37 + i * 0.73, FL + 0.74, z1 + 0.02, 0.22, 0.02, 0.02, 0.006, 1);
    // microwaves
    for (const mx of [3.72, 4.27]) {
      R(g, M.steel, mx, h + 0.16, -3.47, 0.5, 0.3, 0.38, 0.02, 2);
      R(g, M.black, mx - 0.05, h + 0.16, -3.276, 0.36, 0.24, 0.01, 0.01, 1);
      put(g, aquad(0.07, 0.03, r.micro), M.screen, mx + 0.18, h + 0.24, -3.278).castShadow = false;
      for (let b = 0; b < 3; b++) R(g, M.white, mx + 0.18, h + 0.17 - b * 0.045, -3.278, 0.06, 0.025, 0.006, 0.004, 1);
    }
    // hot water dispenser
    R(g, M.white, 3.1, h + 0.28, -3.5, 0.32, 0.56, 0.36, 0.04, 2);
    R(g, M.black, 3.1, h + 0.3, -3.315, 0.2, 0.18, 0.02, 0.01, 1);
    put(g, cyl(0.012, 0.012, 0.08, 8), M.chrome, 3.1, h + 0.17, -3.3);
    R(g, M.steel, 3.1, h + 0.012, -3.35, 0.26, 0.02, 0.18, 0.005, 1);
    put(g, sphere(0.012, 8, 6), glow(0xff4030, 2.5), 3.18, h + 0.47, -3.316).castShadow = false;
    // coffee machine
    R(g, M.black, 2.7, h + 0.33, -3.48, 0.34, 0.66, 0.4, 0.04, 2);
    R(g, M.steel, 2.7, h + 0.18, -3.28, 0.2, 0.05, 0.06, 0.01, 1);
    put(g, aquad(0.16, 0.1, r.cust), M.screen, 2.7, h + 0.5, -3.276).castShadow = false;
    // cups, napkins, chopsticks
    for (let i = 0; i < 2; i++) put(g, tint(cyl(0.04, 0.032, 0.22, 14).translate(0, 0.11, 0), 0xf6f0e6), M.vcMatte, 2.48 + 0.0 + i * 0.09, h, -3.25 + 0.0);
    put(g, tint(cyl(0.035, 0.035, 0.12, 12).translate(0, 0.06, 0), 0x6a4a2a), M.vcMatte, 3.42, h, -3.3);
    for (let i = 0; i < 8; i++) put(g, tint(cyl(0.003, 0.003, 0.2, 4), 0xe8d8b0), M.vcMatte, 3.42 + (rnd() - 0.5) * 0.03, h + 0.15, -3.3 + (rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2);
    R(g, M.white, 3.42, h + 0.04, -3.5, 0.14, 0.08, 0.1, 0.01, 1);
    // menu sign on the wall
    R(g, M.black, 3.55, 2.25, ZB + 0.015, 1.6, 0.6, 0.03, 0.01, 1);
    put(g, aquad(1.54, 0.55, r.self), M.screen, 3.55, 2.25, ZB + 0.032).castShadow = false;
    solid(site, (x0 + x1) / 2, (FL + h) / 2, (z0 + z1) / 2, x1 - x0, h - FL, z1 - z0);
  }

  // ---------------------------------------------------------------- staff door on the right wall
  {
    R(g, M.frame, XI - 0.005, FL + 1.06, -2.45, 0.04, 2.12, 0.98, 0.01, 1);
    R(g, M.shelf, XI - 0.02, FL + 1.04, -2.45, 0.03, 2.04, 0.88, 0.01, 2);
    put(g, cyl(0.012, 0.012, 0.14, 8), M.chrome, XI - 0.07, FL + 1.0, -2.1, Math.PI / 2, 0, 0);
    put(g, aquad(0.4, 0.14, r.staff), M.label, XI - 0.038, FL + 1.55, -2.45, 0, -Math.PI / 2, 0).castShadow = false;
    // outside of the same door
    R(g, M.frame, 4.86, FL + 1.06, -2.45, 0.04, 2.12, 0.98, 0.01, 1);
    R(g, M.kick, 4.88, FL + 1.04, -2.45, 0.03, 2.04, 0.88, 0.01, 2);
    put(g, cyl(0.012, 0.012, 0.14, 8), M.chrome, 4.93, FL + 1.0, -2.1, Math.PI / 2, 0, 0);
    put(g, aquad(0.4, 0.14, r.staff), M.label, 4.897, FL + 1.55, -2.45, 0, Math.PI / 2, 0).castShadow = false;
    put(g, cyl(0.1, 0.12, 0.08, 16), M.frame, 4.95, 2.6, -2.45, 0, 0, Math.PI / 2);
    panels.push(put(g, sphere(0.06, 12, 8), M.cool, 4.98, 2.56, -2.45));
  }

  // ---------------------------------------------------------------- gondolas (double sided)
  const gondola = (x0, x1, zc, D, H, stockA, stockB) => {
    const half = D / 2;
    B(g, M.kick, x0 + 0.02, FL, zc - half + 0.03, x1 - 0.02, FL + 0.11, zc + half - 0.03);
    B(g, M.shelf, x0 + 0.03, FL + 0.11, zc - 0.025, x1 - 0.03, FL + H, zc + 0.025);
    // pegboard dots on both faces via tiny darker strips
    for (const sx of [x0, x1]) R(g, M.shelf, sx, FL + H / 2, zc, 0.04, H, D, 0.01, 1);
    R(g, M.shelf, (x0 + x1) / 2, FL + H + 0.015, zc, x1 - x0 + 0.02, 0.03, 0.14, 0.01, 1);
    const levels = [0.12, 0.45, 0.78, 1.11];
    for (const [side, list] of [[1, stockA], [-1, stockB]]) {
      const zFront = zc + side * half;
      levels.forEach((ly, li) => {
        const y = FL + ly;
        if (li > 0) R(g, M.shelf, (x0 + x1) / 2, y - 0.012, zc + side * (half / 2 + 0.01), x1 - x0 - 0.06, 0.024, half - 0.04, 0.006, 1);
        put(g, toRect(quad(x1 - x0 - 0.08, 0.035), r.price), M.label, (x0 + x1) / 2, y - 0.012, zFront + side * 0.002, 0, side > 0 ? 0 : Math.PI, 0).castShadow = false;
        const L = list[li];
        stockRun(g, L, x0 + 0.03, x1 - 0.03, y, zFront - side * 0.01, side, L === K.bags || L === K.multi ? 2 : 3, rnd);
      });
    }
    // -X end: a poster and a peg display of hanging snack packs
    const ex = x0 - 0.022;
    R(g, M.brand, ex, FL + H - 0.06, zc, 0.012, 0.1, D - 0.02, 0.004, 1);
    put(g, aquad(0.4, 0.53, endPosters[gondolaN % endPosters.length]), M.label, ex - 0.008, FL + 1.02, zc, 0, -Math.PI / 2, 0).castShadow = false;
    for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) {
      const z = zc - 0.21 + i * 0.21, yTop = FL + 0.7 - row * 0.3;
      put(g, cyl(0.004, 0.004, 0.12, 5), M.chrome, ex - 0.06, yTop, z, 0, 0, Math.PI / 2);
      const k = K.hang[(i + row * 3 + gondolaN * 2) % K.hang.length];
      placeKind(g, k, ex - 0.05, yTop - k.h + 0.01, z, -Math.PI / 2, 0, 0);
    }
    gondolaN++;
    solid(site, (x0 + x1) / 2, FL + H / 2, zc, x1 - x0, H, D);
  };
  let gondolaN = 0;
  const endPosters = [r.poster3, r.poster2];
  const bagsBoxes = [...K.bags, ...K.boxes];
  gondola(-3.2, 0.4, -1.7, 0.72, 1.42, [K.bowls, K.cups, K.cups, K.bowls], [K.boxes, K.bags, K.bags, bagsBoxes]);
  gondola(-3.2, 0.0, -0.05, 0.72, 1.42, [K.boxes, K.bags, K.bags, K.boxes], [K.multi, K.bags, bagsBoxes, K.bags]);
  // end caps (promo stacks) at the +X ends
  const endcap = (xc, zc, kinds, poster) => {
    B(g, M.brand, xc - 0.17, FL, zc - 0.33, xc + 0.17, FL + 0.32, zc + 0.33);
    for (let row = 0; row < 6; row++) for (let i = 0; i < 4; i++) {
      const k = kinds[(i + row) % kinds.length];
      if (FL + 0.32 + row * (k.h + 0.004) + k.h > FL + 1.25) continue;
      placeKind(g, k, xc + 0.02, FL + 0.32 + row * (k.h + 0.004), zc - 0.24 + i * 0.16, -Math.PI / 2 + (rnd() - 0.5) * 0.1);
    }
    R(g, M.white, xc, FL + 1.55, zc, 0.03, 0.5, 0.38, 0.01, 1);
    put(g, aquad(0.34, 0.45, poster), M.label, xc + 0.017, FL + 1.55, zc, 0, Math.PI / 2, 0).castShadow = false;
    put(g, aquad(0.34, 0.45, poster), M.label, xc - 0.017, FL + 1.55, zc, 0, -Math.PI / 2, 0).castShadow = false;
    put(g, cyl(0.008, 0.008, 0.3, 6), M.chrome, xc, FL + 1.15, zc);
    solid(site, xc, FL + 0.3, zc, 0.34, 0.6, 0.66);
  };
  endcap(0.6, -1.7, [K.cups[0], K.cups[6], K.cups[2]], r.poster1);
  endcap(0.2, -0.05, [K.boxes[0], K.boxes[2], K.boxes[4]], r.poster2);

  // ---------------------------------------------------------------- left wall: open chiller + wall shelf
  {
    // open multi-deck chiller (fresh food)
    const z0 = -2.95, z1 = -0.95, xb = -XI, xf = -3.98, top = FL + 2.0;
    B(g, M.frame, xb, FL, z0, xf, FL + 0.32, z1);
    B(g, M.white, xb, FL + 0.32, z0, xb + 0.12, top, z1);
    B(g, M.frame, xb, top, z0, xf + 0.06, top + 0.3, z1);
    put(g, aquad(1.9, 0.24, r.hdrFresh), M.screen, xf + 0.064, top + 0.15, (z0 + z1) / 2, 0, Math.PI / 2, 0).castShadow = false;
    for (const zz of [z0, z1]) R(g, M.frame, (xb + xf) / 2, (FL + top) / 2, zz + (zz === z0 ? 0.02 : -0.02), xf - xb, top - FL, 0.04, 0.01, 1);
    panels.push(B(g, M.cool, xf + 0.02, top - 0.03, z0 + 0.05, xf + 0.06, top - 0.01, z1 - 0.05, false));
    const tiers = [[FL + 0.32, K.lunch, 1], [FL + 0.72, K.kimbap, 2], [FL + 1.08, K.sand, 2], [FL + 1.42, K.drinks, 2]];
    tiers.forEach(([y, list, rows], ti) => {
      const depth = 0.6 - ti * 0.06;
      if (ti > 0) R(g, M.steel, xb + 0.12 + depth / 2, y - 0.01, (z0 + z1) / 2, depth, 0.02, z1 - z0 - 0.08, 0.005, 1);
      put(g, toRect(quad(z1 - z0 - 0.1, 0.03), r.price), M.label, xb + 0.12 + depth + 0.002, y - 0.012, (z0 + z1) / 2, 0, Math.PI / 2, 0).castShadow = false;
      stockRunZ(g, list, z0 + 0.05, z1 - 0.05, y, xb + 0.12 + depth - 0.005, 1, rows, rnd, { sold: 0.1 });
      panels.push(B(g, M.cool, xb + 0.12 + depth - 0.06, y + 0.25 + (ti === 3 ? 0.05 : 0), z0 + 0.06, xb + 0.12 + depth - 0.02, y + 0.262 + (ti === 3 ? 0.05 : 0), z1 - 0.06, false));
    });
    solid(site, (xb + xf) / 2, (FL + top) / 2, (z0 + z1) / 2, xf - xb, top - FL, z1 - z0);
    // tall wall shelf (ramen multipacks, household)
    const w0 = -0.8, w1 = 1.35, xs = -4.2, H = 1.95;
    B(g, M.shelf, xb, FL + 0.11, w0, xb + 0.03, FL + H, w1);
    B(g, M.kick, xb, FL, w0, xs - 0.02, FL + 0.11, w1);
    for (const zz of [w0, w1]) R(g, M.shelf, (xb + xs) / 2, FL + H / 2, zz, xs - xb, H, 0.03, 0.008, 1);
    const lv = [[0.12, K.multi, 2], [0.48, K.boxes, 3], [0.84, K.bags, 2], [1.2, K.multi, 2], [1.56, K.boxes, 3]];
    lv.forEach(([ly, list, rows], li) => {
      const y = FL + ly;
      if (li > 0) R(g, M.shelf, (xb + xs) / 2 + 0.015, y - 0.012, (w0 + w1) / 2, xs - xb - 0.03, 0.024, w1 - w0 - 0.04, 0.006, 1);
      put(g, toRect(quad(w1 - w0 - 0.06, 0.035), r.price), M.label, xs + 0.002, y - 0.012, (w0 + w1) / 2, 0, Math.PI / 2, 0).castShadow = false;
      stockRunZ(g, list, w0 + 0.02, w1 - 0.02, y, xs - 0.01, 1, rows, rnd);
    });
    R(g, M.shelf, (xb + xs) / 2, FL + H + 0.015, (w0 + w1) / 2, xs - xb + 0.02, 0.03, w1 - w0 + 0.02, 0.008, 1);
    solid(site, (xb + xs) / 2, FL + H / 2, (w0 + w1) / 2, xs - xb, H, w1 - w0);
    // poster above
    R(g, M.white, -XI + 0.012, 2.55, 0.25, 0.02, 0.72, 0.56, 0.008, 1);
    put(g, aquad(0.52, 0.68, r.poster3), M.label, -XI + 0.024, 2.55, 0.25, 0, Math.PI / 2, 0).castShadow = false;
  }

  // ---------------------------------------------------------------- window bar with stools
  {
    const x0 = -4.05, x1 = -1.25, zb = 1.95, zf = 1.55, y = FL + 1.0;
    R(g, M.oak, (x0 + x1) / 2, y, (zb + zf) / 2, x1 - x0, 0.045, zb - zf, 0.012, 2);
    for (const x of [x0 + 0.2, (x0 + x1) / 2, x1 - 0.2]) {
      R(g, M.frame, x, (FL + y) / 2, zb - 0.06, 0.05, y - FL, 0.05, 0.01, 1);
      R(g, M.frame, x, y - 0.06, (zb + zf) / 2, 0.04, 0.04, zb - zf - 0.04, 0.008, 1);
    }
    solid(site, (x0 + x1) / 2, (FL + y) / 2, (zb + zf) / 2, x1 - x0, y - FL + 0.03, zb - zf);
    const seat = new THREE.Color(0xd8463a);
    for (const sx of [-3.6, -2.65, -1.7]) {
      put(g, cyl(0.2, 0.22, 0.02, 24), M.chrome, sx, FL + 0.01, 1.2);
      put(g, cyl(0.022, 0.022, 0.72, 10), M.chrome, sx, FL + 0.38, 1.2);
      put(g, torus(0.16, 0.012, 6, 24), M.chrome, sx, FL + 0.32, 1.2, Math.PI / 2, 0, 0);
      put(g, tint(lathe([[0.001, 0], [0.17, 0], [0.185, 0.03], [0.18, 0.06], [0.001, 0.07]], 24), seat.getHex()), M.vcGloss, sx, FL + 0.73, 1.2);
    }
    // storytelling on the bar: an opened cup noodle with chopsticks, a kimbap, a drink, tissues
    const bx = -3.55, top = y + 0.0225;
    placeKind(g, K.cups[0], bx, top, 1.74, 0.3);
    put(g, prep(toRect(new THREE.CircleGeometry(0.05, 16), r.foil), true), M.label, bx - 0.02, top + 0.15, 1.8, -0.5, 0.2, 0);
    put(g, tint(cyl(0.045, 0.045, 0.004, 16), 0xd8452b), M.vcGloss, bx, top + 0.1, 1.74);
    for (const dz of [-0.012, 0.012]) put(g, tint(cyl(0.0035, 0.0025, 0.21, 5), 0xe8d0a0), M.vcMatte, bx + 0.05, top + 0.13, 1.72 + dz, 0.15, 0, -0.75);
    placeKind(g, K.kimbap[1], bx + 0.25, top, 1.72, -0.4);
    placeKind(g, K.drinks[8], bx + 0.42, top, 1.78, 0.2);
    placeKind(g, K.drinks[1], -1.95, top, 1.8, -0.3);
    placeKind(g, K.sand[0], -2.15, top, 1.74, 0.6);
    R(g, M.white, -2.65, top + 0.04, 1.86, 0.22, 0.08, 0.11, 0.015, 1);
    put(g, tint(sphere(0.03, 10, 8).scale(1, 0.7, 1), 0xffffff), M.vcMatte, -2.65, top + 0.09, 1.86);
  }

  // ---------------------------------------------------------------- cashier counter
  {
    const x0 = 2.35, x1 = 3.05, z0 = -1.1, z1 = 1.25, h = FL + 0.95;
    B(g, M.white, x0 + 0.03, FL + 0.08, z0, x1, h - 0.04, z1);
    B(g, M.kick, x0 + 0.06, FL, z0 + 0.03, x1, FL + 0.08, z1 - 0.03);
    // front panel (customer side, faces -X) in brand colour with a sun stripe
    R(g, M.brand, x0 + 0.02, FL + 0.5, (z0 + z1) / 2, 0.03, 0.72, z1 - z0 - 0.04, 0.01, 2);
    R(g, M.oak, x0 + 0.002, FL + 0.66, (z0 + z1) / 2, 0.012, 0.08, z1 - z0 - 0.04, 0.004, 1);
    R(g, M.oak, (x0 + x1) / 2 - 0.02, h - 0.02, (z0 + z1) / 2, x1 - x0 + 0.1, 0.04, z1 - z0 + 0.04, 0.012, 2);
    solid(site, (x0 + x1) / 2, (FL + h) / 2, (z0 + z1) / 2, x1 - x0, h - FL, z1 - z0);
    const top = h;
    // POS: base, monitor (faces the clerk, +X) and customer display (faces -X)
    R(g, M.black, 2.82, top + 0.05, 0.45, 0.3, 0.1, 0.36, 0.02, 2);
    put(g, cyl(0.02, 0.02, 0.2, 8), M.frame, 2.82, top + 0.2, 0.45);
    R(g, M.black, 2.84, top + 0.38, 0.45, 0.04, 0.26, 0.36, 0.015, 2);
    put(g, aquad(0.32, 0.22, r.pos), M.screen, 2.862, top + 0.38, 0.45, 0, Math.PI / 2, 0).castShadow = false;
    R(g, M.black, 2.6, top + 0.22, 0.45, 0.03, 0.12, 0.2, 0.01, 1);
    put(g, cyl(0.012, 0.012, 0.17, 6), M.frame, 2.62, top + 0.08, 0.45);
    put(g, aquad(0.17, 0.09, r.cust), M.screen, 2.584, top + 0.22, 0.45, 0, -Math.PI / 2, 0).castShadow = false;
    // receipt printer
    R(g, M.white, 2.84, top + 0.06, 0.82, 0.16, 0.12, 0.16, 0.03, 2);
    // card reader facing the customer
    R(g, M.black, 2.5, top + 0.035, 0.0, 0.11, 0.05, 0.18, 0.015, 2);
    R(g, M.black, 2.52, top + 0.07, 0.0, 0.08, 0.04, 0.12, 0.012, 1);
    put(g, aquad(0.05, 0.035, r.card), M.screen, 2.48, top + 0.085, 0.03, -Math.PI / 2 + 0.5, 0, 0).castShadow = false;
    for (let i = 0; i < 9; i++) R(g, M.grayKey ?? M.white, 2.47 + (i % 3) * 0.022, top + 0.062, -0.04 + Math.floor(i / 3) * 0.022, 0.016, 0.006, 0.016, 0.003, 1);
    // snack display (tiered rack) on the customer side
    const sx = 2.55;
    for (let t = 0; t < 3; t++) {
      R(g, M.chrome, sx - 0.02 + t * 0.07, top + 0.04 + t * 0.08, -0.65, 0.12, 0.012, 0.62, 0.004, 1);
      for (let i = 0; i < 8; i++) placeKind(g, K.gum[(i + t * 3) % K.gum.length], sx - 0.04 + t * 0.07, top + 0.046 + t * 0.08, -0.92 + i * 0.077, -Math.PI / 2, -0.25);
    }
    R(g, M.chrome, sx + 0.12, top + 0.12, -0.65, 0.012, 0.24, 0.62, 0.004, 1);
    // little things the clerk uses: coin tray, folded bags, a bag-price card
    R(g, M.black, 2.52, top + 0.008, 0.3, 0.16, 0.016, 0.12, 0.006, 1);
    for (let i = 0; i < 5; i++) put(g, tint(cyl(0.011, 0.011, 0.003, 10), i % 2 ? 0xc9a24a : 0xc0c4c8), M.vcGloss, 2.49 + (i % 3) * 0.03, top + 0.018, 0.27 + (i % 2) * 0.04);
    for (let i = 0; i < 4; i++) R(g, M.white, 2.86, top + 0.006 + i * 0.008, -0.2 + (rnd() - 0.5) * 0.01, 0.2, 0.007, 0.28, 0.003, 1);
    {
      const cg = group(g, 2.42, top, 0.62, -Math.PI / 2);
      R(cg, M.white, 0, 0.004, 0, 0.12, 0.008, 0.06, 0.003, 1);
      const card = put(cg, aquad(0.13, 0.078, r.bagsign), M.label, 0, 0.05, 0.0, -0.18, 0, 0); card.castShadow = false;
      put(cg, toRect(quad(0.13, 0.078), r.white), M.label, 0, 0.05, -0.004, -0.18, Math.PI, 0).castShadow = false;
    }
    // charity jar, hand sanitizer, bag roll
    put(g, cyl(0.05, 0.05, 0.14, 16), M.glass, 2.45, top + 0.07, 0.95).castShadow = false;
    put(g, tint(cyl(0.052, 0.052, 0.012, 16), 0xffd23f), M.vcMatte, 2.45, top + 0.146, 0.95);
    for (let i = 0; i < 6; i++) put(g, tint(cyl(0.012, 0.012, 0.003, 10), 0xc9a24a), M.vcGloss, 2.45 + (rnd() - 0.5) * 0.05, top + 0.004 + i * 0.004, 0.95 + (rnd() - 0.5) * 0.05);
    put(g, tint(lathe([[0.001, 0], [0.03, 0], [0.03, 0.12], [0.012, 0.14], [0.012, 0.17], [0.001, 0.17]], 14), 0x8fd0f0), M.vcGloss, 2.95, top, -0.95);
    put(g, tint(cyl(0.035, 0.035, 0.22, 14), 0xf4f4f0), M.vcMatte, 2.95, top + 0.05, 1.1, 0, 0, Math.PI / 2);
    // back shelf behind the clerk: small goods
    const bx0 = 4.25, bz0 = -0.9, bz1 = 1.7, H = 2.0;
    B(g, M.white, bx0 + 0.36, FL, bz0, XI, FL + H, bz1);
    B(g, M.kick, bx0, FL, bz0, bx0 + 0.36, FL + 0.6, bz1);
    R(g, M.oak, bx0 + 0.18, FL + 0.62, (bz0 + bz1) / 2, 0.42, 0.04, bz1 - bz0, 0.01, 1);
    for (const zz of [bz0, bz1]) R(g, M.white, bx0 + 0.2, FL + H / 2, zz, 0.4, H, 0.03, 0.008, 1);
    for (let s = 0; s < 4; s++) {
      const y = FL + 0.94 + s * 0.27;
      R(g, M.white, bx0 + 0.2, y - 0.01, (bz0 + bz1) / 2, 0.38, 0.02, bz1 - bz0, 0.005, 1);
      put(g, toRect(quad(bz1 - bz0 - 0.04, 0.03), r.price), M.label, bx0 + 0.008, y - 0.01, (bz0 + bz1) / 2, 0, -Math.PI / 2, 0).castShadow = false;
      stockRunZ(g, [K.smallBoxes, K.cans, K.smallBoxes, K.drinks][s], bz0 + 0.02, bz1 - 0.02, y, bx0 + 0.02, -1, 2, rnd, { gap: 0.004 });
    }
    // things on the back counter: a phone charger box, a clipboard, a clerk's tumbler
    put(g, tint(cyl(0.035, 0.03, 0.18, 14), 0x2a8a7a), M.vcGloss, bx0 + 0.15, FL + 0.64, 1.3);
    R(g, M.oak, bx0 + 0.18, FL + 0.65, 0.4, 0.24, 0.012, 0.32, 0.004, 1);
    put(g, toRect(quad(0.2, 0.28), r.white), M.label, bx0 + 0.18, FL + 0.657, 0.4, -Math.PI / 2, 0, 0).castShadow = false;
    solid(site, (bx0 + XI) / 2, FL + H / 2, (bz0 + bz1) / 2, XI - bx0, H, bz1 - bz0);
    // wall clock above
    put(g, cyl(0.16, 0.16, 0.04, 28), M.frame, XI - 0.02, 2.6, 0.4, 0, 0, Math.PI / 2);
    put(g, toRect(new THREE.CircleGeometry(0.145, 28), r.clock), M.label, XI - 0.042, 2.6, 0.4, 0, -Math.PI / 2, 0).castShadow = false;
    // clerk spot and the shop interaction
    site.npcSpots.push({ pos: [3.7, FL, 0.1], yaw: Math.PI / 2, pose: 'stand', role: 'clerk' });
    site.interactables.push({ id: 'shop', label: '간식 사기', pos: [2.15, 1.25, 0.1], radius: 1.4 });
  }

  // ---------------------------------------------------------------- entrance clutter: mat, baskets, umbrella stand
  {
    put(g, prep(toRect(new THREE.PlaneGeometry(1.4, 0.84).rotateX(-Math.PI / 2), r.mat), true), M.label, 0, FL + 0.0085, 1.42).castShadow = false;
    R(g, M.rubber, 0, FL + 0.003, 1.42, 1.44, 0.006, 0.88, 0.002, 1);
    // basket stack
    const red = 0xd8342a;
    const basket = (x, y, z, ry) => {
      const bg = group(g, x, y, z, ry);
      const W = 0.48, D = 0.33, Hh = 0.22;
      put(bg, tint(prep(new THREE.BoxGeometry(W - 0.04, 0.012, D - 0.04).translate(0, 0.006, 0)), red), M.vcMatte);
      for (const [px, pz, w, d] of [[0, D / 2, W, 0.012], [0, -D / 2, W, 0.012], [W / 2, 0, 0.012, D], [-W / 2, 0, 0.012, D]]) {
        for (let k = 0; k < 4; k++) put(bg, tint(prep(new THREE.BoxGeometry(w, 0.022, d)), red), M.vcMatte, px, 0.03 + k * 0.06, pz);
        for (let k = -2; k <= 2; k++) {
          const along = w > d ? [k * W / 5, 0] : [0, k * D / 5];
          put(bg, tint(prep(new THREE.BoxGeometry(0.012, Hh, 0.012)), red), M.vcMatte, px + along[0], Hh / 2, pz + along[1]);
        }
      }
      put(bg, tint(torus(0.13, 0.01, 6, 16, Math.PI), 0x1a1a1a), M.vcGloss, 0, Hh, -0.06, 0, 0, 0);
    };
    for (let i = 0; i < 4; i++) basket(1.15, FL + i * 0.045, 1.6, 0.03 * (i % 2));
    R(g, M.frame, 1.15, FL + 0.005, 1.6, 0.56, 0.01, 0.4, 0.004, 1);
    solid(site, 1.15, FL + 0.2, 1.6, 0.52, 0.4, 0.36);
    // umbrella stand with two umbrellas
    put(g, cyl(0.12, 0.11, 0.42, 20, true), M.steel, -0.95, FL + 0.21, 1.72);
    put(g, cyl(0.11, 0.11, 0.01, 20), M.steel, -0.95, FL + 0.005, 1.72);
    const umb = (x, z, c, tilt) => {
      put(g, tint(cyl(0.006, 0.006, 0.82, 6), 0x333333), M.vcGloss, x, FL + 0.45, z, tilt, 0, tilt * 0.6);
      put(g, tint(cyl(0.025, 0.045, 0.5, 8), c), M.vcMatte, x + tilt * 0.12, FL + 0.55, z + tilt * 0.2, tilt, 0, tilt * 0.6);
      put(g, tint(torus(0.04, 0.008, 6, 12, Math.PI), 0x3a2a1a), M.vcGloss, x + tilt * 0.36 - 0.04, FL + 0.88, z + tilt * 0.5, 0, 0, 0);
    };
    umb(-0.98, 1.7, 0x1f5fbf, 0.12);
    umb(-0.92, 1.75, 0xffd23f, -0.1);
  }

  // ---------------------------------------------------------------- hanging category signs
  for (const [x, z, rect] of [[-1.4, -0.88, r.catSnack], [-1.4, -2.55, r.catRamen], [-4.0, 0.3, r.catLife]]) {
    const ry = rect === r.catLife ? Math.PI / 2 : 0;
    const sg = group(g, x, 2.62, z, ry);
    R(sg, M.white, 0, 0, 0, 1.06, 0.26, 0.03, 0.01, 1);
    put(sg, aquad(1.0, 0.23, rect), M.label, 0, 0, 0.016).castShadow = false;
    put(sg, aquad(1.0, 0.23, rect), M.label, 0, 0, -0.016, 0, Math.PI, 0).castShadow = false;
    for (const dx of [-0.4, 0.4]) put(sg, cyl(0.003, 0.003, CL - 2.75, 4), M.steel, dx, (CL - 2.62) / 2 + 0.065, 0);
  }

  // ---------------------------------------------------------------- outside: table set, bins, A-board, light pool
  {
    // round plastic table and two chairs (left of the door, under the awning edge)
    const tx = -3.2, tz = 3.35, green = 0x2f8a5a;
    put(g, tint(cyl(0.38, 0.38, 0.03, 28), green), M.vcGloss, tx, 0.72, tz);
    put(g, tint(cyl(0.035, 0.035, 0.7, 10), 0xd8d8d4), M.vcMatte, tx, 0.36, tz);
    put(g, tint(cyl(0.22, 0.24, 0.03, 20), green), M.vcMatte, tx, 0.015, tz);
    solid(site, tx, 0.37, tz, 0.76, 0.74, 0.76);
    const chair = (x, z, ry) => {
      const cg = group(g, x, 0, z, ry);
      put(cg, tint(rbox(0.42, 0.04, 0.4, 0.02, 2), green), M.vcGloss, 0, 0.44, 0);
      put(cg, tint(rbox(0.42, 0.36, 0.035, 0.02, 2), green), M.vcGloss, 0, 0.66, -0.2, -0.12, 0, 0);
      for (const [lx, lz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) put(cg, tint(cyl(0.016, 0.02, 0.44, 8), green), M.vcGloss, lx, 0.22, lz);
    };
    chair(tx - 0.62, tz + 0.05, Math.PI / 2 + 0.2);
    chair(tx + 0.62, tz - 0.05, -Math.PI / 2 - 0.15);
    solid(site, tx - 0.62, 0.45, tz + 0.05, 0.42, 0.9, 0.42);
    solid(site, tx + 0.62, 0.45, tz - 0.05, 0.42, 0.9, 0.42);
    // a forgotten drink and a kimbap wrapper on the table
    placeKind(g, K.cans[0], tx + 0.12, 0.735, tz - 0.05, 0.4);
    placeKind(g, K.kimbap[0], tx - 0.15, 0.735, tz + 0.08, 0.7, 0, 0);
    // bins (general + recycling), right of the door
    const bin = (x, z, c, rect) => {
      put(g, tint(rbox(0.42, 0.78, 0.42, 0.05, 2), c), M.vcGloss, x, 0.39, z);
      put(g, tint(rbox(0.44, 0.06, 0.44, 0.03, 2), 0x2a2d31), M.vcGloss, x, 0.8, z);
      R(g, M.black, x, 0.7, z + 0.205, 0.26, 0.08, 0.02, 0.01, 1);
      put(g, aquad(0.3, 0.11, rect), M.label, x, 0.5, z + 0.212).castShadow = false;
    };
    bin(3.55, 3.05, 0x4a5058, r.binA);
    bin(4.05, 3.05, 0x2f8a46, r.binB);
    solid(site, 3.8, 0.42, 3.05, 0.96, 0.84, 0.46);
    // A-board
    {
      const ax = 1.65, az = 3.15;
      const ag = group(g, ax, 0, az, -0.25);
      for (const s of [-1, 1]) {
        const leaf = group(ag, 0, 0, s * 0.17, 0);
        leaf.rotation.x = -s * 0.175;
        R(leaf, M.oak, 0, 0.48, 0, 0.56, 0.96, 0.03, 0.01, 2);
        put(leaf, aquad(0.46, 0.62, r.aboard), M.label, 0, 0.52, s * 0.017, 0, s > 0 ? 0 : Math.PI, 0).castShadow = false;
      }
      solid(site, ax, 0.5, az, 0.6, 1.0, 0.4);
    }
    // warm-cool light pool on the pavement (night only)
    const pool = canvasTex(256, 128, (ctx, w, h) => {
      const gr = ctx.createRadialGradient(w / 2, 0, 4, w / 2, 0, w * 0.55);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#8a9aa0'); gr.addColorStop(1, '#000000');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    });
    const poolMat = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xdfeeff, emissiveMap: pool, emissiveIntensity: 0.55 * glowK, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    poolMat.name = 'store-lightpool'; poolMat.userData.glowMax = 0.55;
    const pm = put(g, prep(new THREE.PlaneGeometry(9.4, 1.9).rotateX(-Math.PI / 2), true), poolMat, 0, 0.004, 3.05);
    pm.castShadow = false; pm.receiveShadow = false;
    site.nightGlow.push(poolMat);
  }

  // exterior walls: composite panel joints, a mural, frosted high windows, meter box, pipes
  {
    const seam = paint(0xa7abb0, 0.6, 0.1);
    const frosted = paint(0xcfd9de, 0.18, 0.1);
    const yA = 0.42, yB = 3.42, ym = 1.95;
    // left wall (x = -4.85)
    for (const z of [-2.75, -1.55, -0.35, 0.85]) B(g, seam, -4.858, yA, z - 0.009, -4.85, yB, z + 0.009);
    B(g, seam, -4.858, ym - 0.009, -3.95, -4.85, ym + 0.009, 1.95);
    // right wall (x = 4.85), leave the staff door free
    for (const z of [-3.35, -1.4, -0.2, 1.0]) B(g, seam, 4.85, yA, z - 0.009, 4.858, yB, z + 0.009);
    B(g, seam, 4.85, ym - 0.009, -3.95, 4.858, ym + 0.009, -3.0);
    B(g, seam, 4.85, ym - 0.009, -1.9, 4.858, ym + 0.009, 1.95);
    // back wall (z = -3.95)
    for (const x of [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6]) B(g, seam, x - 0.009, yA, -3.958, x + 0.009, yB, -3.95);
    B(g, seam, -4.85, ym - 0.009, -3.958, 4.85, ym + 0.009, -3.95);
    // frosted high windows (storeroom) on the back and left walls
    const hiWin = (cx, cz, w, axis) => {
      const y0 = 2.35, y1 = 2.95, t = 0.035;
      if (axis === 'z') { // on the back wall, faces -Z
        R(g, M.frame, cx, (y0 + y1) / 2, cz - t / 2, w + 0.08, y1 - y0 + 0.08, t, 0.01, 1);
        B(g, frosted, cx - w / 2, y0, cz - t - 0.004, cx + w / 2, y1, cz - t + 0.002);
        R(g, M.frame, cx, (y0 + y1) / 2, cz - t - 0.01, 0.03, y1 - y0, 0.02, 0.005, 1);
        R(g, M.shelf, cx, y0 - 0.05, cz - 0.05, w + 0.12, 0.03, 0.06, 0.01, 1);
      } else { // on the left wall, faces -X
        R(g, M.frame, cx - t / 2, (y0 + y1) / 2, cz, t, y1 - y0 + 0.08, w + 0.08, 0.01, 1);
        B(g, frosted, cx - t - 0.004, y0, cz - w / 2, cx - t + 0.002, y1, cz + w / 2);
        R(g, M.frame, cx - t - 0.01, (y0 + y1) / 2, cz, 0.02, y1 - y0, 0.03, 0.005, 1);
        R(g, M.shelf, cx - 0.05, y0 - 0.05, cz, 0.06, 0.03, w + 0.12, 0.01, 1);
      }
    };
    hiWin(2.95, -3.95, 1.3, 'z');
    hiWin(-4.85, -2.15, 1.4, 'x');
    // painted mural on the back wall
    R(g, M.frame, -1.0, 1.95, -3.965, 4.06, 1.36, 0.02, 0.01, 1);
    put(g, aquad(4.0, 1.3, r.mural), M.label, -1.0, 1.95, -3.977, 0, Math.PI, 0).castShadow = false;
    // left wall: slim meter box, conduit to the roof units, downpipes at the back corners
    R(g, M.white, -4.9, 1.75, 0.3, 0.09, 0.5, 0.36, 0.015, 2);
    R(g, M.glass, -4.948, 1.85, 0.3, 0.006, 0.14, 0.2, 0.003, 1).castShadow = false;
    put(g, cyl(0.02, 0.02, 2.3, 8), M.white, -4.89, 2.95, 0.42);
    put(g, cyl(0.03, 0.03, 3.4, 10), M.white, -4.9, 2.3, -3.2);
    R(g, M.white, -4.9, 0.62, -3.2, 0.08, 0.16, 0.12, 0.02, 1);
    for (const [x, z] of [[-4.93, -3.6], [4.93, -3.6]]) put(g, cyl(0.045, 0.045, 3.95, 12), M.frame, x, 2.0, z);
    R(g, M.white, 4.91, 1.7, 0.5, 0.09, 0.42, 0.3, 0.015, 2);
  }

  // shadows off for glass and glow, then bake
  for (const o of glassPanes) o.castShadow = false;
  for (const o of panels) o.castShadow = false;
  sq.castShadow = false;
  bake(g);

  site.indoor.push({ min: [-XI, FL, ZB], max: [XI, CL, ZF] });
  site.extra.signMaterial = M.sign;
  return site;
}
