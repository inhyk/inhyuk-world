// 공항 터미널 (세온 국제공항 at home, 사쿠라 공항 in Japan): a glass hall under a big swooping roof with
// an oak-slat ceiling, check-in island, departures board, café corner and a gate looking out at the apron.
// Site contract: see ../site.js. Footprint 40 x 26, entrance faces +Z, the apron is behind (-Z).
import * as THREE from 'three';
import { mat, paint, textured } from '../mat.js';
import { box, quad, plane, prep, extrude, put, group, bake, aabb } from '../geom.js';
import { makeSite, solid } from '../site.js';
import { rng } from '../noise.js';
import { PI, RB, CY, SP, V, D, cached, vcGloss, vcSoft, Atlas, txt, rr, drawMark, drawScreen, pottedPlant, shrub, cafeChair, mug, staticDoor, pendant, blackPl, frameWhite } from './office.js';

const F = 0.15;
const X0 = -18, X1 = 18, ZF = 5.5, ZBK = -9.5; // glass box
const RX = 19.8, RZF = 9.2, RZB = -12.2; // roof edges
const JF = '"Jua", "Hiragino Sans", "Noto Sans JP", "Apple SD Gothic Neo", sans-serif';
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
/** Roof underside height: a long wave rising to the middle of the hall, flicking up at the ends. */
const U = (x, z) => {
  const t = (z - RZB) / (RZF - RZB);
  const base = z < -1.5 ? lerp(6.2, 7.4, Math.sin(((z - RZB) / (-1.5 - RZB)) * PI / 2)) : lerp(7.4, 6.0, 1 - Math.cos(((z + 1.5) / (RZF + 1.5)) * PI / 2));
  void t;
  return base + 0.55 * sstep(18.2, RX, Math.abs(x));
};
const TH = (z) => 0.32 + 0.8 * Math.sin(((z - RZB) / (RZF - RZB)) * PI);

function airportAtlas(name, japan, accent) {
  return cached('airportAtlas' + name + japan, () => {
    const G = new Atlas(2560);
    const ac = accent, sub = japan ? 'さくら空港  SAKURA AIRPORT' : 'SEONN INTERNATIONAL AIRPORT';
    const J = (ko, ja, en) => (japan ? `${ko} ${ja}` : `${ko} ${en}`);
    const T = (c, s, x, y, px, col, al = 'left') => { c.font = `${px}px ${JF}`; c.fillStyle = col; c.textAlign = al; c.textBaseline = 'alphabetic'; c.fillText(s, x, y); };
    const plane = (c, x, y, s, col) => { c.save(); c.translate(x, y); c.rotate(-0.5); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s, s * 0.16, 0, 0, PI * 2); c.fill(); c.beginPath(); c.moveTo(-s * 0.15, 0); c.lineTo(-s * 0.45, -s * 0.75); c.lineTo(-s * 0.2, -s * 0.75); c.lineTo(s * 0.3, 0); c.lineTo(-s * 0.2, s * 0.75); c.lineTo(-s * 0.45, s * 0.75); c.fill(); c.beginPath(); c.moveTo(-s * 0.8, 0); c.lineTo(-s * 1.0, -s * 0.35); c.lineTo(-s * 0.85, -s * 0.35); c.lineTo(-s * 0.6, 0); c.fill(); c.restore(); };
    G.add('name', 1900, 230, (c, w, h) => {
      c.font = `128px ${JF}`; const nw = c.measureText(name).width;
      const x0 = (w - nw) / 2 + 70;
      plane(c, x0 - 110, 92, 70, ac);
      T(c, name, x0, 136, 128, '#ffffff');
      T(c, sub, w / 2, 212, 54, '#cfeaf0', 'center');
    });
    G.add('portal', 900, 110, (c, w, h) => { c.fillStyle = '#1b2430'; c.fillRect(0, 0, w, h); plane(c, 70, 55, 34, '#ffd04a'); T(c, J('출발', '出発', 'Departures'), 130, 76, 58, '#ffd04a'); T(c, '→', w - 40, 76, 58, '#ffffff', 'right'); });
    const flights = japan
      ? [['10:30', '세온 セオン', 'SA703', '3', '탑승중 搭乗中', '#5be08a'], ['11:20', '오사카 大阪', 'SA731', '1', '정시 定刻', '#ffffff'], ['12:05', '삿포로 札幌', 'SA761', '2', '정시 定刻', '#ffffff'], ['13:40', '후쿠오카 福岡', 'SA745', '4', '지연 遅延', '#ffb347'], ['14:15', '부산 釜山', 'SA119', '1', '정시 定刻', '#ffffff'], ['15:50', '제주 済州', 'SA216', '2', '정시 定刻', '#ffffff']]
      : [['10:30', '도쿄 TOKYO', 'SA702', '3', '탑승중', '#5be08a'], ['11:15', '제주 JEJU', 'SA215', '1', '정시', '#ffffff'], ['12:40', '오사카 OSAKA', 'SA730', '2', '정시', '#ffffff'], ['13:05', '부산 BUSAN', 'SA118', '4', '지연', '#ffb347'], ['14:20', '삿포로 SAPPORO', 'SA760', '1', '정시', '#ffffff'], ['15:50', '타이베이 TAIPEI', 'SA680', '3', '정시', '#ffffff']];
    const board = (title, list) => (c, w, h) => {
      c.fillStyle = '#0d1520'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#16365a'; c.fillRect(0, 0, w, 74);
      plane(c, 46, 38, 26, '#ffd04a');
      T(c, title, 90, 56, 46, '#ffd04a');
      T(c, '10:12', w - 30, 56, 44, '#ffffff', 'right');
      const cols = [[30, '시각'], [200, japan ? '목적지 行先' : '목적지'], [720, '편명'], [900, '탑승구'], [1080, japan ? '상태 状況' : '상태']];
      for (const [x, s] of cols) T(c, s, x, 112, 28, '#8fb3d9');
      list.forEach((f, i) => {
        const y = 170 + i * 52;
        if (i % 2 === 0) { c.fillStyle = '#132131'; c.fillRect(0, y - 38, w, 52); }
        T(c, f[0], 30, y, 38, '#ffd04a'); T(c, f[1], 200, y, 38, '#ffffff'); T(c, f[2], 720, y, 36, '#cfe3ff'); T(c, f[3], 945, y, 38, '#ffffff', 'center'); T(c, f[4], 1080, y, 36, f[5]);
      });
    };
    G.add('board', 1400, 480, board(J('출발', '出発', 'DEPARTURES'), flights));
    G.add('board2', 1400, 480, board(J('도착', '到着', 'ARRIVALS'), flights.map((f, i) => [f[0].replace(/^1/, i % 2 ? '0' : '1'), f[1], f[2].replace(/\d$/, (d) => String((+d + 1) % 10)), String(1 + (i % 4)), i === 0 ? (japan ? '도착 到着' : '도착') : (japan ? '예정 予定' : '예정'), i === 0 ? '#5be08a' : '#ffffff'])));
    for (let i = 0; i < 4; i++) G.add('hdr' + i, 520, 130, (c, w, h) => {
      c.fillStyle = '#0d1520'; c.fillRect(0, 0, w, h);
      c.fillStyle = ac; c.fillRect(0, 0, 130, h); T(c, 'A0' + (i + 1), 65, 84, 54, '#ffffff', 'center');
      drawMark(c, 175, 48, 26, '#3cc4bd', '#ffb34d'); T(c, 'SEONN AIR', 214, 62, 40, '#ffffff');
      T(c, i < 2 ? (japan ? '세온 セオン SA703' : '도쿄 TOKYO SA702') : (japan ? '오사카 大阪 SA731' : '제주 JEJU SA215'), 160, 112, 30, '#ffd04a');
    });
    G.add('cust', 256, 150, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = ac; c.fillRect(0, 0, w, 40); T(c, 'SEONN AIR', 14, 30, 26, '#ffffff'); T(c, japan ? '수하물 手荷物' : '수하물 BAGGAGE', 14, 84, 26, '#1d3557'); T(c, '23 kg', 14, 130, 40, '#2a9d8f'); });
    G.add('gate', 720, 400, (c, w, h) => {
      c.fillStyle = '#0d1520'; c.fillRect(0, 0, w, h);
      c.fillStyle = ac; c.fillRect(0, 0, w, 90); T(c, japan ? '탑승구 搭乗口 3' : '탑승구 GATE 3', 30, 66, 52, '#ffffff');
      drawMark(c, w - 60, 46, 30, '#ffffff', '#ffd04a');
      T(c, japan ? 'SA703  세온 セオン' : 'SA702  도쿄 TOKYO', 30, 170, 56, '#ffffff');
      T(c, '10:30', 30, 250, 60, '#ffd04a');
      rr(c, 260, 196, 400, 74, 14, '#1f8f4e'); T(c, japan ? '탑승중 搭乗中' : '탑승중 BOARDING', 460, 248, 44, '#ffffff', 'center');
      T(c, japan ? '여권과 탑승권을 보여 주세요' : '여권과 탑승권을 보여 주세요', 30, 350, 32, '#9fc3e8');
    });
    G.add('gateNum', 300, 300, (c, w, h) => { rr(c, 0, 0, w, h, 30, '#ffd04a'); T(c, '3', w / 2, h * 0.78, 230, '#14202e', 'center'); });
    const sign = (s, arrow, icon) => (c, w, h) => {
      c.fillStyle = '#1b2430'; c.fillRect(0, 0, w, h);
      if (icon === 'plane') plane(c, 60, h / 2, 32, '#ffd04a');
      else if (icon === 'cup') { c.fillStyle = '#ffd04a'; c.fillRect(36, 44, 46, 50); c.beginPath(); c.arc(86, 66, 14, -PI / 2, PI / 2); c.lineWidth = 7; c.strokeStyle = '#ffd04a'; c.stroke(); }
      else if (icon === 'wc') { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(46, 40, 11, 0, PI * 2); c.arc(92, 40, 11, 0, PI * 2); c.fill(); c.fillRect(35, 56, 22, 50); c.beginPath(); c.moveTo(92, 54); c.lineTo(110, 106); c.lineTo(74, 106); c.fill(); }
      else if (icon === 'bag') { c.fillStyle = '#ffd04a'; c.fillRect(34, 46, 60, 56); c.fillRect(52, 34, 24, 12); }
      T(c, s, 132, h * 0.66, 54, '#ffd04a');
      if (arrow) T(c, arrow, w - 34, h * 0.68, 64, '#ffffff', 'right');
    };
    G.add('sCheck', 820, 140, sign(J('체크인', 'チェックイン', 'Check-in A'), '←', 'bag'));
    G.add('sGate', 820, 140, sign(J('탑승구', '搭乗口', 'Gates 1-4'), '↓', 'plane'));
    G.add('sCafe', 820, 140, sign(J('구름 카페', 'カフェ', 'Café'), '→', 'cup'));
    G.add('sWc', 820, 140, sign(J('화장실', 'トイレ', 'Toilets'), '→', 'wc'));
    G.add('menu', 640, 400, (c, w, h) => {
      c.fillStyle = '#26282c'; c.fillRect(0, 0, w, h);
      T(c, japan ? '구름 카페 雲カフェ' : '구름 카페 CLOUD CAFÉ', 30, 64, 46, '#ffd27a');
      [['아메리카노', '4,500'], ['카페라테', '5,000'], [japan ? '말차라테 抹茶' : '바닐라라테', '5,500'], ['크루아상', '3,800'], ['샌드위치', '6,500']].forEach(([s, p], i) => {
        T(c, s, 40, 130 + i * 52, 34, '#f4f1ea'); T(c, p, w - 40, 130 + i * 52, 34, '#9fe0d8', 'right');
      });
    });
    G.add('kiosk', 240, 340, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = ac; c.fillRect(0, 0, w, 70); T(c, '셀프 체크인', w / 2, 46, 30, '#ffffff', 'center'); T(c, japan ? 'セルフチェックイン' : 'SELF CHECK-IN', w / 2, 112, 20, '#1d3557', 'center'); rr(c, 30, 150, w - 60, 54, 12, ac); T(c, '시작하기', w / 2, 186, 28, '#ffffff', 'center'); rr(c, 30, 220, w - 60, 54, 12, '#eef1f3'); T(c, '여권 스캔', w / 2, 256, 26, '#33393f', 'center'); });
    G.add('adA', 360, 576, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7cc6f2'); g.addColorStop(0.6, '#d8f1ff'); g.addColorStop(0.61, '#2f8fc0'); g.addColorStop(1, '#1d6a96');
      c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(300, 180, 56, 0, PI * 2); c.fill();
      c.fillStyle = '#3e7a4a'; c.beginPath(); c.moveTo(0, 390); c.quadraticCurveTo(140, 250, 260, 390); c.fill();
      T(c, japan ? '다시 만나요' : '제주로 떠나요', w / 2, 90, 50, '#13405a', 'center'); T(c, 'SEONN AIR', w / 2, 590, 44, '#ffffff', 'center');
    });
    G.add('adB', 360, 576, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffd9e2'); g.addColorStop(1, '#f6a6b8');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(60, 420); c.lineTo(200, 200); c.lineTo(340, 420); c.fill();
      c.fillStyle = '#6f8fb8'; c.beginPath(); c.moveTo(20, 470); c.lineTo(200, 230); c.lineTo(380, 470); c.closePath(); c.globalCompositeOperation = 'destination-over'; c.fill(); c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 26; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#f28aa3'; c.beginPath(); c.arc(30 + (i * 53) % 340, 520 + (i * 37) % 90, 8, 0, PI * 2); c.fill(); }
      T(c, japan ? '사쿠라 마을' : '일본 여행', w / 2, 100, 54, '#8a2a44', 'center'); T(c, japan ? 'さくら' : '벚꽃 마을로', w / 2, 160, 36, '#8a2a44', 'center');
    });
    G.add('mono', 900, 300, (c, w, h) => { c.fillStyle = '#1b2430'; c.fillRect(0, 0, w, h); plane(c, 120, 150, 70, ac); T(c, name, 230, 150, 84, '#ffffff'); T(c, japan ? 'さくら空港' : 'SEONN AIRPORT', 234, 225, 46, '#bfe6ee'); });
    G.add('staff', 300, 90, (c, w, h) => { rr(c, 0, 0, w, h, 10, '#2f3a45'); T(c, japan ? '직원 전용 関係者' : '직원 전용', w / 2, 60, 38, '#ffffff', 'center'); });
    G.add('wcDoor', 180, 180, (c, w, h) => { rr(c, 0, 0, w, h, 16, '#2f3a45'); c.fillStyle = '#fff'; c.beginPath(); c.arc(56, 50, 14, 0, PI * 2); c.arc(124, 50, 14, 0, PI * 2); c.fill(); c.fillRect(42, 70, 28, 52); c.beginPath(); c.moveTo(124, 68); c.lineTo(146, 122); c.lineTo(102, 122); c.fill(); T(c, japan ? '화장실 トイレ' : '화장실', 90, 162, 28, '#ffffff', 'center'); });
    for (let i = 0; i < 3; i++) G.add('scr' + i, 384, 216, drawScreen(['dash', 'mail', 'sheet'][i], 20 + i));
    G.build();
    G.mat = G.lit(1.0);
    G.signMat = G.lit(2.2, 0xffffff); G.signMat.name = 'airportSignGlow';
    return G;
  });
}

function airportMats(japan) {
  return cached('airportMats' + japan, () => ({
    floor: textured('tiles', { color: 0xe4e0d8, grout: 0xb8b3a9, count: 1, marble: true, rough: 0.22, groutWidth: 0.006 }, 1.2, { normal: 0.4 }),
    roofTop: textured('siding', { color: 0xd7dadd, count: 12 }, 4, { normal: 0.6, roughness: 0.55, metalness: 0.35 }),
    lime: textured('concrete', { color: 0xd9d0c0, seed: 12 }, 3, { normal: 0.3 }),
    soffit: paint(0x3b3631, 0.8),
    glass: mat('glass'),
    mullion: paint(0x3a3f45, 0.35, 0.7),
    alu: paint(0xc5cad0, 0.3, 0.85),
    white: frameWhite(),
    quartz: paint(0xece9e3, 0.22, 0),
    carpet: japan ? mat('carpetWarm') : mat('carpet'),
    ceilGlow: (() => { const m = mat('lampGlow').clone(); m.name = 'airportCeilGlow'; return m; })(),
  }));
}

/** Airport bench: n seats on a beam, sitters face -Z. Returns seat centres. */
function beamSeats(g, site, x, z, n, accent, ry = 0) {
  const b = group(g, x, F, z, ry);
  const w = n * 0.62;
  put(b, RB(w, 0.08, 0.1, 0.02, 1), mat('darkSteel'), 0, 0.3, 0.05);
  for (const s of [-1, 1]) { put(b, RB(0.08, 0.3, 0.5, 0.02, 1), mat('darkSteel'), s * (w / 2 - 0.2), 0.15, 0.05); put(b, RB(0.1, 0.02, 0.6, 0.01, 1), mat('steel'), s * (w / 2 - 0.2), 0.01, 0.05); }
  const spots = [];
  for (let i = 0; i < n; i++) {
    const sx = -w / 2 + 0.31 + i * 0.62;
    V(b, RB(0.54, 0.08, 0.5, 0.035, 2), accent, sx, 0.42, 0.0, 0, 0, 0, vcGloss());
    const bk = group(b, sx, 0.46, 0.26, 0); bk.rotation.x = 0.16;
    V(bk, RB(0.54, 0.5, 0.07, 0.035, 2), accent, 0, 0.27, 0, 0, 0, 0, vcGloss());
    put(bk, RB(0.5, 0.46, 0.02, 0.01, 1), mat('darkSteel'), 0, 0.27, 0.045);
    if (i < n - 1) { put(b, RB(0.05, 0.04, 0.4, 0.015, 1), mat('chrome'), sx + 0.31, 0.64, 0.02); put(b, RB(0.03, 0.22, 0.03, 0.01, 1), mat('chrome'), sx + 0.31, 0.53, 0.14); }
    const c = Math.cos(ry), s = Math.sin(ry);
    spots.push([x + sx * c, z - sx * s]);
  }
  const hw = Math.abs(Math.cos(ry)) > 0.5 ? [w, 0.75] : [0.75, w];
  solid(site, x, F + 0.4, z + 0.05, hw[0], 0.8, hw[1]);
  return spots;
}

function suitcase(p, x, y, z, ry, col, h = 0.6) {
  const g = group(p, x, y, z, ry);
  V(g, RB(0.42, h, 0.26, 0.05, 2), col, 0, h / 2 + 0.04, 0, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) V(g, RB(0.03, h - 0.06, 0.01, 0.005, 1), 0x00000, s * 0.1, h / 2 + 0.04, 0.131, 0, 0, 0, vcGloss());
  V(g, RB(0.2, 0.03, 0.04, 0.012, 1), 0x2b2d31, 0, h + 0.07, 0, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) V(g, CY(0.025, 0.025, 0.03, 10), 0x1a1a1c, s * 0.16, 0.025, -0.1, 0, 0, PI / 2);
  return g;
}

export function buildAirport({ name = '세온 국제공항', japan = false } = {}) {
  const site = makeSite('airport', 40, 26);
  const g = site.group;
  const M = airportMats(japan);
  const ACC = japan ? 0xd9607a : 0x2a9d8f;
  const accCss = japan ? '#d9607a' : '#2a9d8f';
  const G = airportAtlas(name, japan, accCss);
  const R = rng(japan ? 77 : 33);

  /* ---------------------------------------------------------------- ground */
  put(g, box(40, 0.05, 22.5), mat('pavers2'), 0, 0.025, 1.75);
  put(g, box(40, 0.04, 3.5), mat('concrete'), 0, 0.02, -11.25);
  V(g, box(36, 0.006, 0.15), 0xf2c230, 0, 0.043, -11.6);
  put(g, RB(40, 0.16, 0.3, 0.03, 1), mat('stone'), 0, 0.08, 12.85);
  /* ---------------------------------------------------------------- slab, floor, carpet */
  put(g, box(36.4, F, 15.4), mat('concrete'), 0, F / 2, (ZF + ZBK) / 2);
  solid(site, 0, F / 2, (ZF + ZBK) / 2, 36.4, F, 15.4);
  put(g, plane(36, 15), M.floor, 0, F + 0.001, (ZF + ZBK) / 2);
  put(g, plane(35.6, 4.8), M.carpet, 0, F + 0.004, -7.0);
  V(g, box(35.6, 0.006, 0.08), ACC, 0, F + 0.004, -4.56);
  V(g, RB(3.4, 0.012, 1.8, 0.004, 1), 0x2b2f35, 0, F + 0.006, 4.4, 0, 0, 0, vcSoft());
  site.indoor.push(aabb(X0 + 0.2, 0, ZBK + 0.1, X1 - 0.2, 7.2, ZF - 0.1));

  /* ---------------------------------------------------------------- roof */
  const nx = 50, nz = 44;
  const xs = []; for (let i = 0; i <= nx; i++) xs.push(-RX + (2 * RX * i) / nx);
  const zs = []; for (let k = 0; k <= nz; k++) zs.push(RZB + ((RZF - RZB) * k) / nz);
  const top = xs.map((x) => zs.map((z) => [x, U(x, z) + TH(z), z]));
  const bot = xs.map((x) => zs.map((z) => [x, U(x, z), z]));
  const grid = (rows, flip) => {
    const nr = rows.length, nc = rows[0].length, pos = new Float32Array(nr * nc * 3), idx = [];
    rows.forEach((r, i) => r.forEach((p, k) => pos.set(p, (i * nc + k) * 3)));
    for (let i = 0; i < nr - 1; i++) for (let k = 0; k < nc - 1; k++) { const a = i * nc + k, b = (i + 1) * nc + k, c = b + 1, d = a + 1; if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return prep(geo);
  };
  put(g, grid(top, false), M.roofTop);
  put(g, grid(bot, true), M.soffit);
  put(g, grid([zs.map((z) => [-RX, U(-RX, z), z]), zs.map((z) => [-RX, U(-RX, z) + TH(z), z])], false), M.alu);
  put(g, grid([zs.map((z) => [RX, U(RX, z) + TH(z), z]), zs.map((z) => [RX, U(RX, z), z])], false), M.alu);
  for (const [z, f] of [[RZF, false], [RZB, true]]) put(g, grid([xs.map((x) => [x, U(x, z), z]), xs.map((x) => [x, U(x, z) + TH(z), z])], f), M.alu);
  // oak battens under the roof, running front to back
  const bpos = [];
  for (let x = -RX + 0.2; x <= RX - 0.19; x += 0.34) {
    const w = 0.07, d = 0.16;
    for (let k = 0; k < nz; k++) {
      const z0 = zs[k], z1 = zs[k + 1];
      const y0 = U(x, z0) - 0.002, y1 = U(x, z1) - 0.002;
      const q = (a, b, c, e) => bpos.push(...a, ...b, ...c, ...a, ...c, ...e);
      const L0 = [x - w / 2, y0 - d, z0], R0 = [x + w / 2, y0 - d, z0], L1 = [x - w / 2, y1 - d, z1], R1 = [x + w / 2, y1 - d, z1];
      const LT0 = [x - w / 2, y0, z0], RT0 = [x + w / 2, y0, z0], LT1 = [x - w / 2, y1, z1], RT1 = [x + w / 2, y1, z1];
      q(L0, R0, R1, L1); q(LT0, L0, L1, LT1); q(R0, RT0, RT1, R1);
    }
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); bg.computeVertexNormals();
  put(g, prep(bg), mat('oak'));
  // light slots across the battens
  for (const z of [3.2, -1.5, -6.2]) for (const sx of [-1, 1]) D(g, box(15.5, 0.05, 0.18), M.ceilGlow, sx * 9.2, U(0, z) - 0.2, z);
  site.nightGlow.push(M.ceilGlow);

  /* ---------------------------------------------------------------- tree columns */
  const tree = (x, z, h, spread = 2.0) => {
    put(g, CY(0.22, 0.28, h, 24), M.white, x, h / 2, z);
    put(g, CY(0.36, 0.36, 0.1, 24), M.mullion, x, 0.05 + (z > 6 ? 0.03 : F), z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = x + dx * spread, tz = z + dz * spread * 0.8, ty = U(tx, tz) - 0.16;
      const a = new THREE.Vector3(x, h - 0.1, z), b = new THREE.Vector3(tx, ty, tz), L = a.distanceTo(b);
      const m = put(g, CY(0.07, 0.13, L, 14), M.white, (x + tx) / 2, (h - 0.1 + ty) / 2, (z + tz) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      put(g, CY(0.16, 0.16, 0.06, 16), M.alu, tx, ty + 0.01, tz);
    }
    put(g, SP(0.3, 20, 14), M.white, x, h, z);
    solid(site, x, h / 2, z, 0.6, h, 0.6);
  };
  tree(-4.2, -2.4, 4.6); tree(4.2, -2.4, 4.6);
  for (const x of [-14.5, -5.5, 5.5, 14.5]) tree(x, 7.6, 4.0, 1.6);

  /* ---------------------------------------------------------------- glass walls */
  const glassWall = (z, gaps, faceZ) => {
    const n = 15, bw = (X1 - X0) / n, yTop = U(0, z) - 0.17;
    for (let i = 0; i <= n; i++) {
      const x = X0 + i * bw;
      put(g, RB(0.1, yTop, 0.16, 0.015, 1), M.mullion, x, yTop / 2, z);
      if (i % 3 === 0) put(g, RB(0.07, yTop, 0.5, 0.02, 1), M.alu, x, yTop / 2, z + faceZ * 0.28);
    }
    for (let i = 0; i < n; i++) {
      const a = X0 + i * bw, b = a + bw, cx = (a + b) / 2;
      const gap = gaps.find(([g0, g1]) => cx > g0 && cx < g1);
      if (gap) {
        D(g, quad(bw, yTop - 2.9), M.glass, cx, (yTop + 2.9) / 2, z);
        continue;
      }
      D(g, quad(bw, yTop - F), M.glass, cx, (yTop + F) / 2, z);
      put(g, box(bw, 0.06, 0.12), M.mullion, cx, 3.0, z);
      put(g, RB(bw, 0.12, 0.18, 0.01, 1), M.mullion, cx, F + 0.06, z);
      solid(site, cx, 1.6, z, bw, 3.2, 0.16);
    }
    put(g, RB(X1 - X0, 0.14, 0.2, 0.02, 1), M.mullion, 0, yTop + 0.02, z);
  };
  glassWall(ZF, [[-1.3, 1.3]], 1);
  glassWall(ZBK, [], -1);
  // side walls (stone), following the roof wave
  for (const sx of [-1, 1]) {
    const s = new THREE.Shape();
    const zz = []; for (let k = 0; k <= 30; k++) zz.push(ZBK - 0.1 + ((ZF - ZBK + 0.2) * k) / 30);
    s.moveTo(ZBK - 0.1, 0);
    s.lineTo(ZF + 0.1, 0);
    for (const z of zz.slice().reverse()) s.lineTo(z, U(sx * X1, z) - 0.15);
    const wg = extrude(s, 0.4, 0); wg.rotateY(-PI / 2); wg.translate(0.2, 0, 0);
    put(g, wg, M.lime, sx * (X1 + 0.05), 0, 0);
    for (let k = 0; k < 6; k++) put(g, box(0.42, 0.03, ZF - ZBK + 0.2), M.mullion, sx * (X1 + 0.05), 1.0 + k * 0.95, (ZF + ZBK) / 2);
    solid(site, sx * (X1 + 0.05), 3, (ZF + ZBK) / 2, 0.4, 6, ZF - ZBK + 0.2);
    put(g, box(0.02, 0.1, ZF - ZBK - 0.3), mat('walnut'), sx * (X1 - 0.16), F + 0.05, (ZF + ZBK) / 2);
  }

  /* ---------------------------------------------------------------- entrance: portal, doors, name sign */
  const pz = ZF + 0.05;
  put(g, RB(4.0, 0.35, 1.2, 0.03, 2), M.alu, 0, 3.15, pz + 0.3);
  for (const s of [-1, 1]) put(g, RB(0.3, 3.0, 1.2, 0.03, 2), M.alu, s * 1.85, 1.5 + F / 2, pz + 0.3);
  D(g, G.quad('portal', 3.3, 0.4), G.signMat, 0, 3.15, pz + 0.905);
  D(g, G.quad('portal', 3.3, 0.4), G.signMat, 0, 3.15, pz - 0.305, 0, PI, 0);
  for (const s of [-1, 1]) solid(site, s * 1.85, 1.5, pz + 0.3, 0.3, 3, 1.2);
  for (const s of [-1, 1]) {
    const piv = group(g, s * 0.66, F, ZF, 0);
    piv.userData.dynamic = true;
    D(piv, quad(1.24, 2.62), M.glass, 0, 1.36, 0);
    put(piv, RB(1.32, 0.09, 0.07, 0.01, 1), M.alu, 0, 2.7, 0);
    put(piv, RB(1.32, 0.12, 0.07, 0.01, 1), M.alu, 0, 0.06, 0);
    for (const e of [-1, 1]) put(piv, RB(0.05, 2.74, 0.07, 0.01, 1), M.alu, e * 0.635, 1.37, 0);
    bake(piv);
    site.doors.push({ pivot: piv, openAngle: 0, slide: [s * 1.3, 0, 0], auto: true, collider: aabb(s < 0 ? -1.3 : 0, F, ZF - 0.08, s < 0 ? 0 : 1.3, 2.8, ZF + 0.08) });
  }
  put(g, RB(2.8, 0.03, 0.4, 0.01, 1), M.alu, 0, F + 0.01, ZF);
  // name band on the glass
  put(g, RB(13.0, 1.55, 0.2, 0.04, 2), M.mullion, 0, 5.0, ZF + 0.22);
  D(g, G.quad('name', 12.2, 12.2 * 230 / 1900), G.signMat, 0, 5.0, ZF + 0.325);
  site.nightGlow.push(G.signMat);
  // drop-off canopy
  const cz0 = 9.0, cz1 = 12.5, cy = 4.1;
  put(g, RB(24.4, 0.16, cz1 - cz0, 0.03, 2), M.white, 0, cy, (cz0 + cz1) / 2);
  put(g, RB(24.5, 0.42, 0.18, 0.03, 1), M.mullion, 0, cy - 0.02, cz1);
  V(g, box(24.5, 0.06, 0.01), ACC, 0, cy + 0.08, cz1 + 0.095);
  for (let x = -11; x <= 11.01; x += 2.75) D(g, CY(0.09, 0.09, 0.02, 14), M.ceilGlow, x, cy - 0.085, (cz0 + cz1) / 2);
  for (const x of [-11.6, -5.8, 0, 5.8, 11.6]) { put(g, CY(0.09, 0.11, cy, 16), M.white, x, cy / 2, cz1 - 0.35); solid(site, x, cy / 2, cz1 - 0.35, 0.24, cy, 0.24); }
  for (const s of [-1, 1]) { put(g, RB(3.0, 0.5, 0.1, 0.02, 1), M.mullion, s * 7.5, cy - 0.45, cz1 - 0.05); D(g, G.quad(s < 0 ? 'portal' : 'portal', 2.8, 0.34), G.signMat, s * 7.5, cy - 0.45, cz1 + 0.006); }
  // bollards, planters, benches, monument
  for (let x = -17; x <= 17.01; x += 2.2) if (Math.abs(x) > 1.6) { put(g, CY(0.09, 0.1, 0.8, 14), M.mullion, x, 0.4, 12.2); put(g, CY(0.1, 0.1, 0.05, 14), M.alu, x, 0.82, 12.2); }
  for (const sx of [-1, 1]) {
    for (const x of [8.5, 17.5]) {
      put(g, RB(2.4, 0.55, 1.2, 0.05, 2), M.lime, sx * x, 0.3, 6.6);
      V(g, box(2.28, 0.02, 1.08), 0x4a3726, sx * x, 0.56, 6.6);
      shrub(g, sx * x - 0.5, 0.55, 6.5, 0.45, 5 + x + sx, 8);
      shrub(g, sx * x + 0.55, 0.55, 6.7, 0.38, 9 + x + sx, 5);
      solid(site, sx * x, 0.4, 6.6, 2.4, 0.8, 1.2);
    }
    const bn = group(g, sx * 3.6, 0.05, 7.0, 0);
    for (let i = 0; i < 5; i++) put(bn, RB(1.8, 0.04, 0.08, 0.012, 1), mat('oak'), 0, 0.44, -0.18 + i * 0.09);
    for (const s of [-0.7, 0.7]) put(bn, RB(0.06, 0.42, 0.4, 0.01, 1), M.mullion, s, 0.21, 0);
    solid(site, sx * 3.6, 0.25, 7.0, 1.8, 0.5, 0.45);
  }
  const mo = group(g, 16.0, 0.05, 11.0, -0.3);
  put(mo, RB(3.4, 1.2, 0.6, 0.05, 2), M.lime, 0, 0.6, 0);
  put(mo, RB(3.1, 0.82, 0.04, 0.01, 1), M.mullion, 0, 0.65, 0.3);
  D(mo, G.quad('mono', 2.4, 0.8), G.signMat, 0, 0.65, 0.323);
  solid(site, 16.0, 0.6, 11.0, 3.4, 1.2, 1.4);
  // luggage trolleys outside
  const trolley = (x, z, ry, bags) => {
    const t = group(g, x, F, z, ry);
    put(t, RB(0.55, 0.04, 0.9, 0.01, 1), M.alu, 0, 0.25, 0);
    for (const s of [-1, 1]) { put(t, CY(0.018, 0.018, 1.0, 8), M.alu, s * 0.25, 0.6, 0.42, -0.2, 0, 0); for (const e of [-0.35, 0.35]) V(t, CY(0.06, 0.06, 0.04, 12), 0x1a1a1c, s * 0.22, 0.06, e, 0, 0, PI / 2); }
    put(t, CY(0.02, 0.02, 0.56, 8), mat('chrome'), 0, 1.05, 0.52, 0, 0, PI / 2);
    bags.forEach((c, i) => suitcase(t, 0, 0.27 + i * 0.27, -0.05, PI / 2, c, 0.24));
    solid(site, x, F + 0.5, z, 0.7, 1, 1.0);
  };
  trolley(-6.5, 9.8, 0.3, [0x2a6f97, 0xe76f51]);
  trolley(6.8, 4.0, -0.4, [0xf4a261]);

  /* ---------------------------------------------------------------- departures board (double sided, hanging) */
  const bz = 1.0, by = 4.3;
  put(g, RB(7.4, 2.6, 0.3, 0.05, 2), blackPl(), 0, by, bz);
  D(g, G.quad('board', 7.0, 2.4), G.mat, 0, by, bz + 0.152);
  D(g, G.quad('board2', 7.0, 2.4), G.mat, 0, by, bz - 0.152, 0, PI, 0);
  for (const s of [-1, 1]) put(g, CY(0.025, 0.025, U(s * 3, bz) - by - 1.3, 8), M.alu, s * 3, (U(s * 3, bz) + by + 1.3) / 2, bz);

  /* ---------------------------------------------------------------- hanging signs */
  const hang = (x, z, key, ry = 0, y = 3.4) => {
    const sg = group(g, x, y, z, ry);
    put(sg, RB(3.0, 0.54, 0.14, 0.03, 2), M.mullion, 0, 0, 0);
    D(sg, G.quad(key, 2.9, 0.495), G.mat, 0, 0, 0.072);
    D(sg, G.quad(key, 2.9, 0.495), G.mat, 0, 0, -0.072, 0, PI, 0);
    for (const s of [-1, 1]) put(g, CY(0.015, 0.015, U(x, z) - y - 0.3, 6), M.alu, x + Math.cos(ry) * s * 1.2, (U(x, z) + y + 0.3) / 2, z - Math.sin(ry) * s * 1.2);
  };
  hang(-11, 1.6, 'sCheck');
  hang(7.0, -3.8, 'sGate');
  hang(10.5, 2.4, 'sCafe', 0, 3.6);
  hang(14.5, -3.6, 'sWc', 0, 3.2);

  /* ---------------------------------------------------------------- check-in island (left) */
  const bkZ = -3.6;
  put(g, RB(12.0, 3.3, 0.4, 0.03, 2), M.lime, -11.0, F + 1.65, bkZ);
  V(g, RB(11.6, 1.1, 0.04, 0.02, 1), ACC, -11.0, F + 2.55, bkZ + 0.21, 0, 0, 0, vcGloss());
  solid(site, -11.0, 1.8, bkZ, 12.0, 3.4, 0.4);
  for (let i = 0; i < 4; i++) {
    const cx = -15.0 + i * 2.7;
    // header screen on the backdrop
    put(g, RB(1.7, 0.48, 0.08, 0.02, 1), blackPl(), cx + 0.45, F + 2.55, bkZ + 0.25);
    D(g, G.quad('hdr' + i, 1.6, 0.4), G.mat, cx + 0.45, F + 2.55, bkZ + 0.292);
    // desk
    const d = group(g, cx, F, -2.1, 0);
    put(d, RB(1.5, 1.0, 0.12, 0.02, 2), M.white, 0, 0.5, 0.3);
    V(d, RB(1.52, 0.12, 0.13, 0.02, 1), ACC, 0, 0.75, 0.31, 0, 0, 0, vcGloss());
    put(d, RB(1.6, 0.045, 0.5, 0.015, 2), M.quartz, 0, 1.02, 0.18);
    put(d, RB(1.45, 0.035, 0.6, 0.01, 2), mat('whiteWood'), 0, 0.74, -0.08);
    for (const s of [-1, 1]) put(d, RB(0.08, 1.0, 0.8, 0.02, 2), M.white, s * 0.74, 0.5, 0.0);
    put(d, RB(0.48, 0.3, 0.03, 0.01, 1), blackPl(), -0.25, 1.05, -0.05, -0.1, 0.2, 0);
    D(d, G.quad('scr' + (i % 3), 0.44, 0.26), G.mat, -0.25, 1.05, -0.034, -0.1, 0.2, 0);
    put(d, RB(0.3, 0.2, 0.03, 0.01, 1), blackPl(), 0.45, 1.18, 0.38, -0.2, PI, 0);
    D(d, G.quad('cust', 0.27, 0.16), G.mat, 0.45, 1.18, 0.4, 0.2, 0, 0);
    put(d, RB(0.06, 0.16, 0.04, 0.01, 1), blackPl(), 0.45, 1.06, 0.38);
    mug(d, 0.5, 0.755, -0.2, [0xffffff, 0xf2c14e, 0x2f6f73][i % 3], i);
    solid(site, cx, 0.6, -2.1, 1.6, 1.2, 0.85);
    // baggage belt + scale
    const b = group(g, cx + 1.35, F, -2.3, 0);
    put(b, RB(0.95, 0.3, 1.0, 0.03, 2), mat('steel'), 0, 0.15, 0);
    put(b, RB(0.85, 0.03, 0.96, 0.012, 1), mat('rubber'), 0, 0.31, 0);
    for (const s of [-1, 1]) put(b, RB(0.04, 0.08, 1.0, 0.012, 1), mat('chrome'), s * 0.47, 0.35, 0);
    for (let k = 0; k < 6; k++) V(b, box(0.1, 0.9, 0.012), 0x1f2125, -0.25 + k * 0.1, 0.75, -0.6 + (k % 2) * 0.01);
    if (i === 1) suitcase(b, 0, 0.32, 0.05, 0.2, 0xd94f4f, 0.62);
    if (i === 2) suitcase(b, 0.05, 0.32, 0.1, -0.3, 0x2f6fb0, 0.5);
    solid(site, cx + 1.35, 0.3, -2.3, 0.95, 0.6, 1.0);
    if (i === 0 || i === 2) site.npcSpots.push({ pos: [cx, F, -2.85], yaw: PI, pose: 'stand', role: 'staff' });
  }
  // queue stanchions with belts
  const posts = [];
  for (let x = -15.8; x <= -4.6; x += 1.4) posts.push([x, -0.2]);
  for (let x = -15.8; x <= -4.6; x += 1.4) posts.push([x, 0.8]);
  for (const [x, z] of posts) { put(g, CY(0.03, 0.03, 0.95, 10), mat('chrome'), x, F + 0.48, z); put(g, CY(0.16, 0.18, 0.03, 18), mat('chrome'), x, F + 0.015, z); }
  for (const z of [-0.2, 0.8]) for (let x = -15.8; x < -4.6; x += 1.4) V(g, box(1.34, 0.05, 0.008), ACC, x + 0.7, F + 0.9, z);
  // self check-in kiosks
  for (let i = 0; i < 3; i++) {
    const k = group(g, -7.5 + i * 1.0, F, 3.4, 0);
    put(k, RB(0.62, 1.05, 0.4, 0.04, 2), M.white, 0, 0.53, 0);
    const hd = group(k, 0, 1.25, 0.05, 0); hd.rotation.x = -0.35;
    put(hd, RB(0.6, 0.8, 0.12, 0.04, 2), M.white, 0, 0, 0);
    D(hd, G.quad('kiosk', 0.42, 0.6), G.mat, 0, 0, 0.062);
    V(k, RB(0.64, 0.06, 0.42, 0.02, 1), ACC, 0, 1.0, 0, 0, 0, 0, vcGloss());
    solid(site, -7.5 + i * 1.0, 0.8, 3.4, 0.64, 1.6, 0.5);
  }

  /* ---------------------------------------------------------------- café corner (right front) */
  const cbz = 0.2;
  put(g, RB(6.4, 3.0, 0.3, 0.03, 2), mat('walnut'), 14.8, F + 1.5, cbz - 0.5);
  put(g, RB(1.9, 1.2, 0.06, 0.02, 1), blackPl(), 14.8, F + 2.1, cbz - 0.33);
  D(g, G.quad('menu', 1.8, 1.125), G.mat, 14.8, F + 2.1, cbz - 0.297);
  solid(site, 14.8, 1.6, cbz - 0.5, 6.4, 3.2, 0.3);
  for (let x = 12.2; x < 17.6; x += 0.5) put(g, RB(0.45, 0.025, 0.25, 0.008, 1), mat('oak'), x + 0.2, F + 1.35, cbz - 0.25);
  for (let i = 0; i < 8; i++) mug(g, 12.3 + i * 0.32, F + 1.365, cbz - 0.25, [0xffffff, 0xf2c14e, 0x2f6f73, 0xd9534f][i % 4], i);
  const cc = group(g, 14.6, F, 1.25, 0);
  put(cc, RB(4.6, 1.0, 0.65, 0.03, 2), mat('walnut'), 0, 0.5, 0);
  put(cc, RB(4.7, 0.05, 0.75, 0.015, 2), M.quartz, 0, 1.025, 0);
  V(cc, RB(4.62, 0.08, 0.02, 0.01, 1), ACC, 0, 0.93, 0.33, 0, 0, 0, vcGloss());
  // espresso machine, grinder, pastry case
  put(cc, RB(0.7, 0.42, 0.45, 0.04, 2), mat('steel'), -1.4, 1.26, -0.08);
  V(cc, RB(0.72, 0.06, 0.47, 0.02, 1), 0xb4623e, -1.4, 1.5, -0.08, 0, 0, 0, vcGloss());
  for (const s of [-1, 1]) { put(cc, CY(0.04, 0.04, 0.08, 12), blackPl(), -1.4 + s * 0.18, 1.08, 0.12); mug(cc, -1.4 + s * 0.18, 1.05, 0.15, 0xffffff, 0, false); }
  put(cc, CY(0.08, 0.1, 0.32, 14), blackPl(), -0.8, 1.21, -0.15);
  put(cc, CY(0.09, 0.05, 0.16, 14), mat('glass'), -0.8, 1.45, -0.15).castShadow = false;
  put(cc, RB(1.2, 0.45, 0.5, 0.02, 1), mat('glass'), 0.9, 1.27, 0.0).castShadow = false;
  put(cc, RB(1.2, 0.03, 0.5, 0.01, 1), mat('steel'), 0.9, 1.06, 0.0);
  for (let i = 0; i < 6; i++) V(cc, SP(0.07, 12, 8).scale(1.4, 0.6, 1), [0xd9a35a, 0xc98a4a, 0xf2d6a0][i % 3], 0.5 + (i % 3) * 0.35, 1.11, -0.1 + Math.floor(i / 3) * 0.2, 0, 0, 0, vcSoft());
  put(cc, RB(0.3, 0.2, 0.25, 0.02, 1), blackPl(), 1.9, 1.15, -0.1);
  solid(site, 14.6, 0.6, 1.25, 4.7, 1.2, 0.75);
  site.npcSpots.push({ pos: [6.0, F, -8.25], yaw: PI, pose: 'stand', role: 'staff' });
  for (const x of [13.2, 14.6, 16.0]) pendant(g, x, F + 2.4, 1.25, U(x, 1.25) - 0.16, { r: 0.22, shade: 0x2b2d31 });
  const cafeTables = [[10.6, 3.6], [12.8, 3.9], [15.4, 3.6]];
  for (const [tx, tz] of cafeTables) {
    put(g, CY(0.42, 0.42, 0.035, 28), mat('oak'), tx, F + 0.73, tz);
    put(g, CY(0.035, 0.035, 0.7, 10), blackPl(), tx, F + 0.37, tz);
    put(g, CY(0.24, 0.26, 0.02, 20), blackPl(), tx, F + 0.01, tz);
    cafeChair(g, tx - 0.65, F, tz, PI / 2, 1);
    cafeChair(g, tx + 0.65, F, tz, -PI / 2, 2);
    mug(g, tx + 0.1, F + 0.75, tz - 0.1, 0xffffff, 1);
    solid(site, tx, 0.45, tz, 0.9, 0.9, 0.9);
  }
  V(g, SP(0.05, 10, 8).scale(1.4, 0.6, 1), 0xd9a35a, 12.65, F + 0.77, 4.0, 0, 0, 0, vcSoft());
  suitcase(g, 11.5, F, 4.3, 0.4, 0x7a5cc0, 0.55);

  /* ---------------------------------------------------------------- gate area (back) */
  const seatCol = japan ? 0xc9566e : 0x23788a;
  const spots = [];
  for (const x of [-13.6, -8.6, -3.6, 12.6]) {
    spots.push(...beamSeats(g, site, x, -6.3, 6, seatCol, 0));
    spots.push(...beamSeats(g, site, x, -8.1, 6, seatCol, 0));
  }
  const pick = [0, 4, 9, 14, 20, 27];
  for (const k of pick) { const [sx, sz] = spots[k]; site.npcSpots.push({ pos: [sx, F, sz], yaw: 0, pose: 'sit', role: 'guest' }); }
  // things left on seats: backpack, coffee, newspaper
  V(g, RB(0.32, 0.42, 0.2, 0.08, 2), 0x3d5a80, spots[2][0], F + 0.68, spots[2][1] + 0.05, -0.2, 0, 0, vcSoft());
  mug(g, spots[7][0], F + 0.46, spots[7][1] - 0.1, 0xffffff, 1, true);
  V(g, box(0.4, 0.01, 0.3), 0xeeeae0, spots[17][0], F + 0.465, spots[17][1], 0, 0.3, 0, vcSoft());
  suitcase(g, spots[12][0] + 0.2, F, spots[12][1] - 0.55, 0.2, 0xf2c14e, 0.55);
  suitcase(g, spots[25][0], F, spots[25][1] - 0.55, -0.3, 0x2a9d8f, 0.6);
  // gate desk
  const gd = group(g, 6.0, F, -7.5, 0);
  put(gd, RB(2.2, 1.05, 0.7, 0.03, 2), M.white, 0, 0.525, 0);
  V(gd, RB(2.22, 0.14, 0.72, 0.02, 1), ACC, 0, 0.8, 0, 0, 0, 0, vcGloss());
  put(gd, RB(2.3, 0.045, 0.78, 0.015, 2), M.quartz, 0, 1.07, 0);
  put(gd, RB(0.5, 0.3, 0.03, 0.01, 1), blackPl(), -0.4, 1.27, -0.15, -0.15, 0, 0);
  D(gd, G.quad('scr2', 0.46, 0.26), G.mat, -0.4, 1.27, -0.133, -0.15, 0, 0);
  put(gd, RB(0.22, 0.12, 0.18, 0.03, 1), blackPl(), 0.6, 1.15, 0.15);
  V(gd, box(0.14, 0.01, 0.1), 0x2aff7a, 0.6, 1.215, 0.15);
  put(gd, CY(0.06, 0.06, 1.7, 12), M.alu, 0, 0.85, -0.6);
  put(gd, RB(1.6, 0.92, 0.08, 0.02, 1), blackPl(), 0, 2.2, -0.6);
  D(gd, G.quad('gate', 1.5, 0.833), G.mat, 0, 2.2, -0.555);
  solid(site, 6.0, 0.6, -7.5, 2.3, 1.2, 0.8);
  site.interactables.push({ id: 'board', label: '비행기 타기', pos: [6.0, 1.35, -6.75], radius: 1.8 });
  // e-gate + boarding door in the back glass
  const eg = group(g, 8.6, F, -8.4, 0);
  for (const s of [-1, 1]) put(eg, RB(0.2, 1.0, 0.9, 0.04, 2), M.white, s * 0.45, 0.5, 0);
  for (const s of [-1, 1]) put(eg, RB(0.3, 0.6, 0.03, 0.01, 1), mat('glass'), s * 0.2, 0.75, 0.0, 0, 0, 0).castShadow = false;
  V(eg, box(0.14, 0.01, 0.1), 0x2aff7a, -0.45, 1.01, 0.2);
  solid(site, 8.6, 0.5, -8.4, 1.1, 1.0, 0.9);
  put(g, RB(2.4, 2.9, 0.24, 0.03, 2), M.alu, 9.6, F + 1.45, ZBK + 0.05);
  for (const s of [-1, 1]) {
    D(g, quad(0.92, 2.5), M.glass, 9.6 + s * 0.5, F + 1.3, ZBK + 0.17);
    put(g, RB(0.06, 2.55, 0.07, 0.01, 1), M.mullion, 9.6 + s * 0.97, F + 1.3, ZBK + 0.17);
    put(g, RB(0.03, 0.8, 0.05, 0.01, 1), mat('chrome'), 9.6 + s * 0.12, F + 1.1, ZBK + 0.22);
    V(g, RB(0.92, 0.3, 0.02, 0.01, 1), 0x2b2f35, 9.6 + s * 0.5, F + 0.16, ZBK + 0.17, 0, 0, 0, vcGloss());
  }
  put(g, RB(2.0, 0.08, 0.08, 0.01, 1), M.mullion, 9.6, F + 2.57, ZBK + 0.17);
  put(g, RB(0.7, 0.7, 0.08, 0.04, 1), blackPl(), 9.6, 3.6, ZBK + 0.2);
  D(g, G.quad('gateNum', 0.6, 0.6), G.signMat, 9.6, 3.6, ZBK + 0.245);
  // plants along the glass
  pottedPlant(g, -17.0, F, -8.8, { kind: 'fig', h: 2.2, potR: 0.32, potH: 0.6, pot: 'stone', seed: 3 });
  pottedPlant(g, 17.0, F, -8.8, { kind: 'palm', h: 2.0, potR: 0.32, potH: 0.6, pot: 'stone', seed: 5 });
  pottedPlant(g, -1.2, F, -8.8, { kind: 'snake', h: 1.1, potR: 0.25, potH: 0.5, pot: 'charcoal', seed: 7 });
  pottedPlant(g, 3.0, F, 4.6, { kind: 'fig', h: 2.0, potR: 0.3, potH: 0.6, pot: 'white', seed: 9 });
  pottedPlant(g, -3.0, F, 4.6, { kind: 'palm', h: 1.8, potR: 0.3, potH: 0.6, pot: 'white', seed: 11 });
  pottedPlant(g, 9.2, F, -0.3, { kind: 'bush', h: 0.9, potR: 0.32, potH: 0.5, pot: 'terracotta', seed: 13 });
  for (const [x, z] of [[-17.0, -8.8], [17.0, -8.8], [-1.2, -8.8], [3.0, 4.6], [-3.0, 4.6], [9.2, -0.3]]) solid(site, x, 0.6, z, 0.7, 1.2, 0.7);
  // side walls: ad light boxes, doors
  for (const [sx, key, z] of [[-1, 'adA', 2.8], [1, 'adB', -1.8]]) {
    put(g, RB(0.14, 2.0, 1.3, 0.02, 1), M.alu, sx * (X1 - 0.2), F + 1.4, z);
    D(g, G.quad(key, 1.2, 1.92), G.mat, sx * (X1 - 0.28), F + 1.4, z, 0, -sx * PI / 2, 0);
  }
  staticDoor(g, -(X1 - 0.16), F, -6.8, PI / 2, { w: 1.0, h: 2.2, leaf: paint(0x9aa0a6, 0.4, 0.3), frame: M.mullion });
  D(g, G.quad('staff', 0.7, 0.21), G.mat, -(X1 - 0.21), F + 2.55, -6.8, 0, PI / 2, 0);
  for (const z of [-7.4, -5.8]) staticDoor(g, X1 - 0.16, F, z, -PI / 2, { w: 0.95, h: 2.2, leaf: mat('whiteWood'), frame: mat('walnut') });
  D(g, G.quad('wcDoor', 0.45, 0.45), G.mat, X1 - 0.21, F + 2.65, -6.6, 0, -PI / 2, 0);
  // water fountain
  put(g, RB(0.5, 0.9, 0.4, 0.04, 2), mat('steel'), X1 - 0.45, F + 0.45, -4.8);
  solid(site, X1 - 0.45, 0.5, -4.8, 0.5, 1.0, 0.4);

  /* ---------------------------------------------------------------- apron strip behind: tug, carts, cones */
  const tug = group(g, -6.0, 0.04, -11.6, PI / 2);
  put(tug, RB(1.3, 0.6, 2.2, 0.08, 2), paint(0xf2c230, 0.4, 0.1, { clearcoat: 0.5 }), 0, 0.55, 0);
  put(tug, RB(1.2, 0.08, 0.9, 0.03, 1), blackPl(), 0, 0.9, 0.4);
  for (const s of [-1, 1]) for (const e of [-0.7, 0.7]) put(tug, CY(0.28, 0.28, 0.22, 18), mat('rubber'), s * 0.6, 0.28, e, 0, 0, PI / 2);
  put(tug, CY(0.03, 0.03, 0.9, 8), blackPl(), 0, 1.3, 0.85);
  put(tug, RB(1.3, 0.05, 0.9, 0.02, 1), blackPl(), 0, 1.75, 0.6);
  for (let i = 0; i < 2; i++) {
    const cart = group(g, -3.2 + i * 2.6, 0.04, -11.6, PI / 2);
    put(cart, RB(1.3, 0.08, 2.0, 0.02, 1), mat('darkSteel'), 0, 0.42, 0);
    for (const s of [-1, 1]) for (const e of [-0.75, 0.75]) put(cart, CY(0.18, 0.18, 0.14, 14), mat('rubber'), s * 0.55, 0.18, e, 0, 0, PI / 2);
    for (const s of [-1, 1]) put(cart, RB(0.05, 0.9, 2.0, 0.02, 1), mat('darkSteel'), s * 0.62, 0.9, 0);
    for (let k = 0; k < 4; k++) suitcase(cart, (k % 2 - 0.5) * 0.5, 0.46, -0.6 + Math.floor(k / 2) * 0.8 + (R() - 0.5) * 0.1, PI / 2 + (R() - 0.5) * 0.3, [0x2f6fb0, 0xd94f4f, 0x3a3a3a, 0xf2c14e, 0x7a5cc0, 0x2a9d8f][(R() * 6) | 0], 0.5);
  }
  solid(site, -2.0, 0.6, -11.6, 9.2, 1.2, 1.4);
  for (const x of [3, 4.2, 15, 16.2]) { put(g, CY(0.03, 0.17, 0.5, 14), paint(0xff6a2a, 0.5), x, 0.29, -12.1); put(g, RB(0.36, 0.04, 0.36, 0.01, 1), blackPl(), x, 0.06, -12.1); }

  /* ---------------------------------------------------------------- lamps, extras */
  for (const [x, y, z] of [[-10, 5.4, 0], [0, 5.6, -1.5], [10, 5.4, 0], [-9, 5.2, -7], [6, 5.2, -7], [14, 3.4, 2.5], [0, 4.4, 3.5]]) site.lamps.push({ pos: [x, y, z], color: 0xffe6c0, intensity: 10, range: 13 });
  for (const x of [-7, 0, 7]) site.lamps.push({ pos: [x, 3.7, 10.8], color: 0xffe2b0, intensity: 8, range: 9 });
  site.spawn = { pos: [0, 0.05, 11.0], yaw: 0 };
  site.extra.apron = { pos: [0, 0, -32], yaw: PI };
  site.extra.gate = { pos: [6.0, F, -6.6], door: [9.6, F, ZBK] };
  site.extra.arrival = { pos: [0, F, 4], yaw: PI };
  bake(g);
  return site;
}
