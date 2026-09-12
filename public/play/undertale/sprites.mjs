// 언더테일 팬 게임 · 픽셀 스프라이트 (문자 격자로 그린 원본 픽셀 아트)
// '.' 은 투명. 팔레트 글자는 각 스프라이트의 palette에서 색으로 바뀐다.
const P = { k: '#101010', w: '#ffffff', g: '#9a9a9a', d: '#4a4a4a', s: '#f2cfa8', h: '#5b3a1f', b: '#3b4fd0', p: '#a24fd8', t: '#7a4a2a', y: '#f4d34a', o: '#f08a24', r: '#e8302a', n: '#f7a8c8', c: '#4ec8ff', l: '#7bd76b', v: '#3e2a7e', m: '#ff7ad0', e: '#1c1c2e', q: '#c9c9ff', i: '#ffd6e0', u: '#5e6bff', a: '#c88b58', z: '#2c9c3e', f: '#ffe680', x: '#8d6ac7' };

const mirror = rows => rows.map(r => r.split('').reverse().join(''));
const def = (rows, palette = {}) => ({ rows, palette: { ...P, ...palette }, w: rows[0].length, h: rows.length });

// ---------- 인간 (프리스크) 20x30 · 원작 비율의 갈색 단발, 파랑·자홍 줄무늬 셔츠 ----------
// 걷기 4프레임: [서기, 왼발, 서기, 오른발] (원작과 같은 순서)
const FRISK = { h: '#5a3a22', k: '#2a1a10', s: '#f4d494', b: '#4f66dc', m: '#d84fc4', p: '#55402e', o: '#2b1c13' };
const friskDown = [
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhsssssssshhh...', '..hhhsssssssssshhh..', '..hhhskksssskkshhh..', '..hhhsssssssssshhh..', '.hhhhsssssssssshhhh.', '.hhhhsssskksssshhhh.', '....hssssssssssh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..ss.bbbbbbbbbb.ss..', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '.....ssss..ssss.....', '....ooooo..ooooo....', '....ooooo..ooooo....'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhsssssssshhh...', '..hhhsssssssssshhh..', '..hhhskksssskkshhh..', '..hhhsssssssssshhh..', '.hhhhsssssssssshhhh.', '.hhhhsssskksssshhhh.', '....hssssssssssh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bb.bbbbbbbbbb.ss..', '..ss.bbbbbbbbbb.....', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '.....ssss..ooooo....', '....ooooo..ooooo....', '....ooooo...........'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhsssssssshhh...', '..hhhsssssssssshhh..', '..hhhskksssskkshhh..', '..hhhsssssssssshhh..', '.hhhhsssssssssshhhh.', '.hhhhsssskksssshhhh.', '....hssssssssssh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..ss.bbbbbbbbbb.ss..', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '.....ssss..ssss.....', '....ooooo..ooooo....', '....ooooo..ooooo....'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhsssssssshhh...', '..hhhsssssssssshhh..', '..hhhskksssskkshhh..', '..hhhsssssssssshhh..', '.hhhhsssssssssshhhh.', '.hhhhsssskksssshhhh.', '....hssssssssssh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..ss.bbbbbbbbbb.bb..', '.....bbbbbbbbbb.ss..', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '....ooooo..ssss.....', '....ooooo..ooooo....', '...........ooooo....']
];
const friskUp = [
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '.hhhhhhhhhhhhhhhhhh.', '.hhhhhhhhhhhhhhhhhh.', '....hhhhhhhhhhhh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..ss.bbbbbbbbbb.ss..', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '.....ssss..ssss.....', '....ooooo..ooooo....', '....ooooo..ooooo....'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '.hhhhhhhhhhhhhhhhhh.', '.hhhhhhhhhhhhhhhhhh.', '....hhhhhhhhhhhh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bb.bbbbbbbbbb.ss..', '..ss.bbbbbbbbbb.....', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '.....ssss..ooooo....', '....ooooo..ooooo....', '....ooooo...........'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '.hhhhhhhhhhhhhhhhhh.', '.hhhhhhhhhhhhhhhhhh.', '....hhhhhhhhhhhh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..ss.bbbbbbbbbb.ss..', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '.....ssss..ssss.....', '....ooooo..ooooo....', '....ooooo..ooooo....'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '..hhhhhhhhhhhhhhhh..', '.hhhhhhhhhhhhhhhhhh.', '.hhhhhhhhhhhhhhhhhh.', '....hhhhhhhhhhhh....', '.....bbbbbbbbbb.....', '....bbbbbbbbbbbb....', '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..bbbbbbbbbbbbbbbb..', '..bbbbbbbbbbbbbbbb..', '..mmmmmmmmmmmmmmmm..', '..ss.bbbbbbbbbb.bb..', '.....bbbbbbbbbb.ss..', '.....pppppppppp.....', '.....pppppppppp.....', '.....pppp..pppp.....', '....ooooo..ssss.....', '....ooooo..ooooo....', '...........ooooo....']
];
const friskLeft = [
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...sssshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..skksshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..sssshhhhhhhhhhhh..', '..sksshhhhhhhhhhhh..', '....ssshhhhhhhh.....', '......bbbbbbbb......', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bbsssbbbbb.....', '......pppppppp......', '......pppppppp......', '......pppppppp......', '.......ssssss.......', '.....ooooooooo......', '.....ooooooooo......'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...sssshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..skksshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..sssshhhhhhhhhhhh..', '..sksshhhhhhhhhhhh..', '....ssshhhhhhhh.....', '......bbbbbbbb......', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bbbsssbbbb.....', '......pppppppp......', '......pppppppp......', '.....pppp.pppp......', '....ssss..ssss......', '...ooooo...oooo.....', '...ooooo...oooo.....'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...sssshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..skksshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..sssshhhhhhhhhhhh..', '..sksshhhhhhhhhhhh..', '....ssshhhhhhhh.....', '......bbbbbbbb......', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bbsssbbbbb.....', '......pppppppp......', '......pppppppp......', '......pppppppp......', '.......ssssss.......', '.....ooooooooo......', '.....ooooooooo......'],
  ['......hhhhhhhh......', '.....hhhhhhhhhh.....', '....hhhhhhhhhhhh....', '....hhhhhhhhhhhh....', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...hhhhhhhhhhhhhh...', '...sssshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..skksshhhhhhhhhh...', '..ssssshhhhhhhhhh...', '..sssshhhhhhhhhhhh..', '..sksshhhhhhhhhhhh..', '....ssshhhhhhhh.....', '......bbbbbbbb......', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bbbbbbbbbb.....', '.....mmmmmmmmmm.....', '.....bbbbbbbbbb.....', '.....bsssbbbbbb.....', '......pppppppp......', '......pppppppp......', '......pppp.pppp.....', '......ssss..ssss....', '.....oooo...ooooo...', '.....oooo...ooooo...']
];
// ---------- 고해상도 정제: 20x30 밑그림 → 40x60 · 외곽선, 명암, 하이라이트, 앞머리 결, 옷 주름 ----------
// 밑그림은 재질 글자(h 머리, s 피부, b 셔츠, m 줄무늬, p 반바지, o 신발, k 눈·입)만 담고,
// refine()이 2배로 키우면서 재질마다 4단계 톤(기본·그늘·밝음·외곽선)을 자동으로 입힌다.
const FRISK_TONES = {
  h: ['#5a3a22', '#3f2716', '#7d5637', '#241408'],
  s: ['#f4d494', '#d8ae6c', '#fce8b8', '#7d5030'],
  b: ['#4f66dc', '#3647aa', '#7a8cee', '#1f2a6e'],
  m: ['#d84fc4', '#a2378f', '#ec82d8', '#5e1f55'],
  p: ['#55402e', '#3a2a1e', '#705744', '#1c1109'],
  o: ['#2b1c13', '#170e08', '#4a3527', '#0a0504'],
};
const CHARA_TONES = { ...FRISK_TONES, k: '#5a1418', r: '#f28c9a',
  s: ['#ffd9dc', '#e8aeb4', '#fff0f0', '#8a4a52'],
  b: ['#2f9a3e', '#1f6c2b', '#5cc46a', '#123f19'],
  m: ['#f2cf3c', '#c49f1e', '#fbe37a', '#6e5410'],
};
const LIGHT = { h: '1', s: '2', b: '3', m: '4', p: '5', o: '6' }, LINE = { h: '!', s: '@', b: '$', m: '%', p: '^', o: '&' };
function tonePalette(tones) {
  const pal = { k: tones.k || '#2a1a10', r: tones.r || '#efb39a' };
  for (const c in tones) { const [base, shade, light, line] = tones[c]; pal[c] = base; pal[c.toUpperCase()] = shade; pal[LIGHT[c]] = light; pal[LINE[c]] = line; }
  return pal;
}
function refine(base) {
  const H = base.length * 2, W = base[0].length * 2;
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => base[y >> 1][x >> 1]));
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? '.' : g[y][x];
  const group = c => c === 'm' ? 'b' : (c === 'k' || c === 'r') ? 's' : c;
  // 1. 눈과 입은 두 줄이 아니라 한 줄의 가는 선으로
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'k' && at(x, y - 1) === 'k') g[y][x] = 's';
  const eyeRow = g.findIndex(r => r.includes('k'));
  for (let y = eyeRow + 1; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'k' && at(x - 1, y) !== 'k') { let n = 0; while (at(x + n, y) === 'k') n++; if (n >= 4) { g[y][x] = 's'; g[y][x + n - 1] = 's'; } x += n; }
  // 2. 앞머리 끝을 지그재그로 (머리와 피부가 만나는 줄마다 2px 폭의 머리끝을 한 칸 내린다)
  const bang = g.map(r => r.slice());
  for (let y = 0; y < H - 2; y++) for (let x = 0; x < W; x++) if (bang[y][x] === 'h' && bang[y + 1][x] === 's' && bang[y + 2][x] === 's' && (x % 4 === 1 || x % 4 === 2)) g[y + 1][x] = 'h';
  // 3. 볼에 은은한 홍조 (눈 바깥쪽 끝에서 세 줄 아래)
  for (let x = 0; x < W; x++) if (at(x, eyeRow) === 'k') {
    if (at(x - 1, eyeRow) !== 'k' && x < W / 2) for (const dx of [-2, -1]) if (at(x + dx, eyeRow + 3) === 's') g[eyeRow + 3][x + dx] = 'r';
    if (at(x + 1, eyeRow) !== 'k' && x >= W / 2) for (const dx of [1, 2]) if (at(x + dx, eyeRow + 3) === 's') g[eyeRow + 3][x + dx] = 'r';
  }
  // 4. 실루엣의 계단 모서리를 둥글게 (충분히 넓은 덩어리의 볼록 모서리만 깎는다)
  const snap = g.map(r => r.slice()), sa = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? '.' : snap[y][x];
  const run = (x, y, dx, dy) => { let n = 0; for (let i = 1; sa(x + dx * i, y + dy * i) !== '.'; i++) n++; return n; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (sa(x, y) === '.') continue;
    const u = sa(x, y - 1) === '.', d = sa(x, y + 1) === '.', l = sa(x - 1, y) === '.', r = sa(x + 1, y) === '.';
    const wide = run(x, y, 1, 0) + run(x, y, -1, 0) + 1 >= 4, tall = run(x, y, 0, 1) + run(x, y, 0, -1) + 1 >= 4;
    if (((u && l) || (u && r) || (d && l) || (d && r)) && wide && tall) g[y][x] = '.';
  }
  // 5. 머리 윤기: 머리 덩어리의 왼쪽 위에 짧은 광택 줄기 두 개
  let top = H, left = W, right = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'h') { top = Math.min(top, y); left = Math.min(left, x); right = Math.max(right, x); }
  const sheen = new Set();
  if (right >= 0) { const w = right - left + 1; for (let i = 0; i < 4; i++) { sheen.add(`${left + Math.round(w * .28) + i},${top + 3}`); sheen.add(`${left + Math.round(w * .28) + i + 2},${top + 4}`); } for (let i = 0; i < 3; i++) sheen.add(`${left + Math.round(w * .15)},${top + 5 + i}`); }
  // 6. 톤 입히기: 외곽선 → 그늘 → 밝음 → 기본
  const out = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if (c === '.' || c === 'k' || c === 'r') { row += c; continue; }
      const gc = group(c), same = (dx, dy) => group(at(x + dx, y + dy)) === gc, outer = (dx, dy) => at(x + dx, y + dy) === '.';
      let tone = c;
      if (outer(0, -1) || outer(0, 1) || outer(-1, 0) || outer(1, 0)) tone = LINE[c];
      else if (c === 'm') tone = at(x, y + 1) !== 'm' ? 'M' : at(x, y - 1) !== 'm' ? LIGHT.m : 'm';
      else if (!same(0, 1) || !same(0, 2) || !same(1, 0)) tone = c.toUpperCase();
      else if (gc === 's' && group(at(x, y - 1)) === 'h') tone = 'S';                                              // 앞머리 그늘
      else if (gc === 'b' && (group(at(x, y - 1)) === 's' || group(at(x, y - 2)) === 's' || group(at(x, y - 1)) === 'h')) tone = 'B';  // 턱 아래 옷깃 그늘
      else if (gc === 'p' && !same(0, -1)) tone = 'P';                                                          // 셔츠 밑단 그늘
      else if (gc === 'o' && !same(0, -1)) tone = LIGHT.o;                                                      // 신발 윗면
      else if (gc === 'h' && sheen.has(`${x},${y}`)) tone = LIGHT.h;
      else if (outer(0, -2) || outer(-2, 0)) tone = LIGHT[c];
      row += tone;
    }
    out.push(row);
  }
  return out;
}
const FRISK_PAL = tonePalette(FRISK_TONES), CHARA_PAL = tonePalette(CHARA_TONES);
const frisk = rows => def(refine(rows), FRISK_PAL);
export const HUMAN_SCALE = 1; // 정제된 스프라이트는 이미 2배 해상도라 1배로 그린다
export const HUMAN = { down: friskDown.map(frisk), up: friskUp.map(frisk), left: friskLeft.map(frisk), right: friskLeft.map(rows => frisk(mirror(rows))) };
// 차라 (몰살 결말용): 초록 셔츠에 노란 줄무늬 하나, 분홍빛 피부
let stripe = 0;
export const CHARA = def(refine(friskDown[0].map(r => /^\.+m+\.+$/.test(r) && stripe++ > 0 ? r.replace(/m/g, 'b') : r)), CHARA_PAL);

// ---------- 플라위 16x18 ----------
export const FLOWEY = def([
  '.....yyyyyy.....', '...yyyyyyyyyy...', '..yyy......yyy..', '.yy..wwwwww..yy.', '.yy.wwwwwwww.yy.', 'yy..wkwwwwkw..yy', 'yy..wwwwwwww..yy', 'yy..wkwwwwkw..yy', 'yy..wwkkkkww..yy', '.yy..wwwwww..yy.', '.yy..........yy.', '..yyy......yyy..', '...yyyyyyyyyy...', '.....yyzzyy.....', '.......zz.......', '.....zzzz.......', '.......zz..zz...', '.......zzzz.....']);
export const FLOWEY_EVIL = def([
  '.....yyyyyy.....', '...yyyyyyyyyy...', '..yyy......yyy..', '.yy..kkkkkk..yy.', '.yy.kkkkkkkk.yy.', 'yy..krkkkkrk..yy', 'yy..kkkkkkkk..yy', 'yy..kwwwwwwk..yy', 'yy..kwkwkwwk..yy', '.yy..kkkkkk..yy.', '.yy..........yy.', '..yyy......yyy..', '...yyyyyyyyyy...', '.....yyzzyy.....', '.......zz.......', '.....zzzz.......', '.......zz..zz...', '.......zzzz.....']);

// ---------- 토리엘 18x30 ----------
export const TORIEL = def([
  '...ww........ww...', '..wwww......wwww..', '..wwwwwwwwwwwwww..', '...wwwwwwwwwwww...', '...wwwwwwwwwwww...', '...wwkwwwwwwkww...', '...wwwwwwwwwwww...', '....wwwwwwwwww....', '....wwwwkkwwww....', '.....wwwwwwww.....',
  '....vvvvvvvvvv....', '...vvvvvvvvvvvv...', '..vvvvvvvvvvvvvv..', '..vvvvxxxxxxvvvv..', '..vvvvxvvvvxvvvv..', '..vvvvvxvvxvvvvv..', '..vvvvvvxxvvvvvv..', 'wwvvvvvvvvvvvvvvww', 'wwvvvvvvvvvvvvvvww', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..']);

// ---------- 샌즈 16x22 ----------
export const SANS = def([
  '....wwwwwwww....', '...wwwwwwwwww...', '..wwwwwwwwwwww..', '..wwkkwwwwkkww..', '..wwkwwwwwwkww..', '..wwwwwwwwwwww..', '..wwkkkkkkkkww..', '...wwkwkwkwkw...', '....wwwwwwww....',
  '...bbbbbbbbbb...', '..bbwwbbbbwwbb..', '..bbbbwwwwbbbb..', '.bbbbwwwwwwbbbb.', '.bbbbwwwwwwbbbb.', '..bbbbwwwwbbbb..', '...bbbbbbbbbb...', '...kkkkkkkkkk...', '...kkkk..kkkk...', '...kkkk..kkkk...', '...kkkk..kkkk...', '..nnnn....nnnn..', '..nnnn....nnnn..']);
export const SANS_DARK = def(SANS.rows.map((r, i) => i === 3 ? '..wwkkwwwwkkww..' : i === 4 ? '..wwkcwwwwkkww..' : r));

// ---------- 파피루스 14x32 ----------
export const PAPYRUS = def([
  '....wwwwww....', '...wwwwwwww...', '...wwwwwwww...', '...wkkwwkkw...', '...wkkwwkkw...', '...wwwwwwww...', '...wwwwwwww...', '...wkkkkkkw...', '...wwkwkwww...', '....wwwwww....',
  '...rrrrrrrr...', '..rrrrrrrrrr..', '.rrrrrrrrrrrr.', '..wwwwwwwwww..', '.wwwwwwwwwwww.', 'wwwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'wwwwrrrrrrwwww', 'wwwwrrrrrrwwww', '.wwwwwwwwwwww.', '.rwwwwwwwwwwr.', '.r.wwwwwwww.r.', '.r.bbbbbbbb.r.', '.r.bbbbbbbb.r.', '.r.bbbbbbbb.r.', '.r.bbbb.bbbb..', '...bbbb.bbbb..', '...bbbb.bbbb..', '...bbbb.bbbb..', '..rrrr...rrrr.', '..rrrr...rrrr.', '..rrrr...rrrr.']);

// ---------- 언다인 16x30 ----------
export const UNDYNE = def([
  '..rrrrrrrrrr....', '.rrrrrrrrrrrr...', 'rrrrrrrrrrrrrr..', 'rrrccccccccrrr..', 'rrccccccccccrr..', 'rrcckcccckccrr..', 'rrcccccccccrr...', 'rrccccccccccrr..', '.rrcckkkkkccrr..', '..rrcccccccrr...', '...rrrrrrrr.....', '....gggggg......', '...gggggggg.....', '..gggggggggg....', '.gggggggggggg...', '.ggg.gggggg.ggg.', '.ggg.gggggg.ggg.', '.ggg.gggggg.ggg.', '.ccc.gggggg.ccc.', '.....gggggg.....', '.....gggggg.....', '.....gggggg.....', '.....ggg.ggg....', '.....ggg.ggg....', '.....ggg.ggg....', '.....ggg.ggg....', '....gggg.gggg...', '....gggg.gggg...', '....kkkk.kkkk...', '....kkkk.kkkk...']);
export const UNDYING = def(UNDYNE.rows.map(r => r.replace(/g/g, 'e')), { e: '#2c2c44', c: '#3aa0ff' });

// ---------- 몬스터 키드 14x20 ----------
export const KID = def([
  '.....yyyy.....', '....yyyyyy....', '...yyyyyyyy...', '...ykyyyyky...', '...yyyyyyyy...', '...yyykkyyy...', '....yyyyyy....', '....oooooo....', '...oooyyyooo..', '...ooooooooo..', '...oooyyyooo..', '...ooooooooo..', '...oooyyyooo..', '....oooooo....', '....yyyyyy....', '....yyyyyy....', '....yy..yy....', '....yy..yy....', '...yyy..yyy...', '...yyy..yyy...']);

// ---------- 상점 토끼 16x24 ----------
export const RABBIT = def([
  '...pp......pp...', '..ppp......ppp..', '..ppp......ppp..', '..ppp......ppp..', '..pppppppppppp..', '.pppppppppppppp.', '.ppkppppppppkpp.', '.pppppppppppppp.', '.pppppppkppppppp', '..pppppppppppp..', '...pppppppppp...', '....ffffffff....', '...ffffffffff...', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '...ffffffffff...', '....pppppppp....', '....ppp..ppp....', '....ppp..ppp....', '....ppp..ppp....'], { p: '#c9a0e8', f: '#f0e0c0' });

// ---------- 템미 18x14 ----------
export const TEMMIE = def([
  '..ww..........ww..', '..www........www..', '..wwwwwwwwwwwwww..', '..wwwwwwwwwwwwww..', '.wwwkwwwwwwwwkwww.', '.wwwwwwwwwwwwwwww.', '.wwwwwkwwwwkwwwww.', '..wwwwwkkkkwwwww..', '...wwwwwwwwwwww...', '....bbbbbbbbbb....', '....bbbbbbbbbb....', '....bbbbbbbbbb....', '....ww..ww..ww....', '....ww..ww..ww....']);

// ---------- 냅스타블룩 14x20 ----------
export const BLOOK = def([
  '.....wwww.....', '...wwwwwwww...', '..wwwwwwwwww..', '..wwwwwwwwww..', '.wwwwwwwwwwww.', '.wwkkwwwwkkww.', '.wwkkwwwwkkww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwkkkkwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '..w.ww..ww.w..', '..w.ww..ww.w..', '.....w..w.....']);

// ---------- 메아리 꽃 12x16 ----------
export const ECHO = def([
  '....cccc....', '...cccccc...', '..cccqqccc..', '..ccqqqqcc..', '..ccqqqqcc..', '..cccqqccc..', '...cccccc...', '....cccc....', '.....zz.....', '.....zz.....', '..zz.zz.....', '...zzzz.....', '.....zz.zz..', '.....zzzz...', '.....zz.....', '.....zz.....']);

// ---------- 자판기 16x24 ----------
export const VENDING = def([
  'mmmmmmmmmmmmmmmm', 'mwwwwwwwwwwwwwwm', 'mwmmmmmmmmmmmmwm', 'mwwwwwwwwwwwwwwm', 'mmmmmmmmmmmmmmmm', 'mkkkkkkkkkkkkmmm', 'mkyykkookkppkmmm', 'mkyykkookkppkmmm', 'mkkkkkkkkkkkkmmm', 'mkccKkllkkyykmwm', 'mkcckkllkkyykmwm', 'mkkkkkkkkkkkkmmm', 'mkmmkkrrkkwwkmmm', 'mkmmkkrrkkwwkmmm', 'mkkkkkkkkkkkkmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmkkkkkkkkkkmmm', 'mmmkkkkkkkkkkmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk'], { K: '#4ec8ff' });

// ---------- 아스고어 22x36 ----------
export const ASGORE = def([
  '..yyy..........yyy....', '.yyyy..........yyyy...', 'yyyy....wwww....yyyy..', 'yyy...wwwwwwww...yyy..', 'yy...wwwwwwwwww...yy..', '.....wwwwwwwwww.......', '.....wwkwwwwkww.......', '.....wwwwwwwwww.......', '.....wwwwwwwwww.......', '......yyyyyyyy........', '......yyyyyyyy........', '......yyyyyyyy........', '....vvvvvvvvvvvv......', '...vvvvvvvvvvvvvv.....', '..vvvvvvvvvvvvvvvv....', '.vvvvvvvxxxxvvvvvvv...', 'vvvvvvvvxxxxvvvvvvvv..', 'vvvvvvvvvxxvvvvvvvvv..', 'vvvvvvvvvvvvvvvvvvvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvwwwvvvvvvvvvwwwvv..', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....'], { v: '#6b3fb5', x: '#f0d060', g: '#8d6ac7' });

// ---------- 메타톤 EX 16x32 ----------
export const METTATON = def([
  '....kkkkkkkk....', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '..kkkkkkkkkkkk..', '..kkkkssssssss..', '..kkkksmsssss...', '..kkkkssssssss..', '...kkksskkssss..', '....kkssssss....', '.....ssssss.....', '....mmmmmmmm....', '...mmmmmmmmmm...', '..mmkkkkkkkkmm..', '..mmkkkkkkkkmm..', '.mmmkkkkkkkkmmm.', '.mmmkkkkkkkkmmm.', '.mmmkkkkkkkkmmm.', '..m.kkkkkkkk.m..', '..m.kkkkkkkk.m..', '..m.kkkkkkkk.m..', '....mmmmmmmm....', '....mmmmmmmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '...mmmm..mmmm...', '...kkkk..kkkk...', '...kkkk..kkkk...'], { m: '#ff5aa0' });
export const NEO = def(METTATON.rows.map((r, i) => (i >= 10 && i < 20) ? r.replace(/m/g, 'c').replace(/k/g, 'y') : r).map(r => r.replace(/^(.{2})/, 'cc')), { c: '#4ec8ff', y: '#ffd040' });

// ---------- 인형 12x20 ----------
export const DUMMY = def([
  '....aaaa....', '...aaaaaa...', '..aaaaaaaa..', '..aakaakaa..', '..aaaaaaaa..', '..aaaaaaaa..', '...aaaaaa...', '....aaaa....', '...aaaaaa...', '..aaaaaaaa..', '..aaaaaaaa..', '..aaaaaaaa..', '..aaaaaaaa..', '...aaaaaa...', '....aaaa....', '.....tt.....', '.....tt.....', '.....tt.....', '...tttttt...', '..tttttttt..'], { a: '#d6b8a8' });

// ---------- 전투용 몬스터 ----------
export const FROGGIT = def([
  '..wwww......wwww..', '.wwkkww....wwkkww.', '.wwkkww....wwkkww.', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwkkkkkkkkwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwwwwwwwwwwwww..', '.wwww........wwww.', 'wwwww........wwwww', 'ww..............ww']);
export const WHIMSUN = def([
  'ww..............ww', 'www............www', 'wwww...wwww...wwww', 'wwwww.wwwwww.wwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwkwwwwkwwwwww', '.wwwwwwwwwwwwwwww.', '..wwwwwwkkwwwwww..', '...wwwwwwwwwwww...', '....wwwwwwwwww....', '....wwwwwwwwww....', '.....wwwwwwww.....', '......wwwwww......', '.......wwww.......']);
export const MOLDSMAL = def([
  '.....wwwwwwwww.....', '...wwwwwwwwwwwww...', '..wwwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwwww.', '.wwwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwwww.', '..wwwwwwwwwwwwwww..']);
export const SNOWDRAKE = def([
  '......wwww........', '.....wwwwww.......', '....wwwwwwww......', '...wwwkwwwwww.....', '..wwwwwwwwwwww....', '.wwwwwwwwwwwwww...', 'wwwwwkkkkkkwwwww..', '.wwwwwwwwwwwwww...', '..wwwwwwwwwwwww...', '...wwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwwwwwwwwwwwww..', '....wwww..wwww....', '....wwww..wwww....']);
export const ICECAP = def([
  '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '....wwwwwwwwww....', '...wwwwwwwwwwww...', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', '..wwwwwwwwwwwwww..', '..wwwwkwwwwkwwww..', '..wwwwwwwwwwwwww..', '..wwwwwwkkwwwwww..', '...wwwwwwwwwwww...', '....wwwwwwwwww....', '.....wwwwwwww.....', '......wwwwww......']);
export const LESSERDOG = def([
  '..ww........ww....', '.wwww......wwww...', '.wwwwwwwwwwwwww...', '.wwwwwwwwwwwwww...', '.wwkkwwwwwwkkww...', '.wwwwwwwwwwwwww...', '.wwwwwwkkwwwwww...', '..wwwwwwwwwwww....', '...wwwwwwwwww.....', '....wwwwwwww......', '....wwwwwwww......', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwww..........wwww', 'wwww..........wwww']);
export const AARON = def([
  '....wwww..........', '...wwwwww.........', '..wwwwwwww........', '..wwkwwwww........', '..wwwwwwww........', '...wwwwww.........', '..wwwwwwwwww......', '.wwwwwwwwwwww.....', 'wwwwwwwwwwwwww....', 'wwwwwwwwwwwwww....', 'wwww.wwwwww.ww....', '.....wwwwwwwww....', '.....wwwwwwwwww...', '.....wwwwwwwwwww..', '......wwwwwwwwwww.', '.......wwwwwwwwwww', '........wwwwwwwwww', '..........wwwwwwww']);
export const WOSHUA = def([
  '.....wwwwwwww.....', '....wwwwwwwwww....', '...wwwwwwwwwwww...', '..wwwwwwwwwwwwww..', '..wwkkwwwwwwkkww..', '..wwwwwwwwwwwwww..', '..wwwwwwkkwwwwww..', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwww......wwww..', '..wwww......wwww..']);
export const VULKIN = def([
  '........ww........', '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '....wwwwwwwwww....', '...wwwwwwwwwwww...', '..wwwkwwwwwwkwww..', '..wwwwwwwwwwwwww..', '.wwwwwwwkkwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwww......wwww..']);
export const TSUNDERPLANE = def([
  '.........ww.......', '........wwww......', 'ww.....wwwwww.....', 'www...wwwwwwww....', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwkwwwwkwwwwww', 'wwwwwwwwwwwwwwwwww', 'www...wwwkkwww....', 'ww.....wwwwww.....', '........wwww......', '.........ww.......']);
export const PYROPE = def([
  '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '.....wkwwwwkw.....', '.....wwwwwwww.....', '......wwkkww......', '.......wwww.......', '.......wwww.......', '......wwwwww......', '......wwwwww......', '.......wwww.......', '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '......wwwwww......', '.......wwww.......']);
// 아스리엘 24x44
export const ASRIEL = def([
  '..kk................kk..', '.kkk................kkk.', 'kkkk.....wwwwww.....kkkk', 'kkk....wwwwwwwwww....kkk', 'kk....wwwwwwwwwwww....kk', '......wwwwwwwwwwww......', '......wwkkwwwwkkww......', '......wwkkwwwwkkww......', '......wwwwwwwwwwww......', '.......wwwkkkkwww.......', '........wwwwwwww........', '........wwwwwwww........', '.....eeeeeeeeeeeeee.....', '....eeeeeeeeeeeeeeee....', '...eeeeeeexxxxeeeeeee...', '..eeeeeeeexxxxeeeeeeee..', '..eeeeeeeeexxeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..'], { e: '#2a1a4e', x: '#e8e8ff' });

export const OVERWORLD = { flowey: FLOWEY, toriel: TORIEL, sans: SANS, papyrus: PAPYRUS, undyne: UNDYNE, kid: KID, rabbit: RABBIT, temmie: TEMMIE, blook: BLOOK, echo: ECHO, froggit: FROGGIT, vending: VENDING, asgore: ASGORE, mettaton: METTATON, dummy: DUMMY, chara: CHARA };
export const BATTLE = { dummy: DUMMY, froggit: FROGGIT, whimsun: WHIMSUN, moldsmal: MOLDSMAL, snowdrake: SNOWDRAKE, icecap: ICECAP, lesserdog: LESSERDOG, aaron: AARON, woshua: WOSHUA, temmie: TEMMIE, vulkin: VULKIN, tsunderplane: TSUNDERPLANE, pyrope: PYROPE,
  toriel: TORIEL, papyrus: PAPYRUS, undyne: UNDYNE, undying: UNDYING, mettaton: METTATON, neo: NEO, asgore: ASGORE, flowey: FLOWEY_EVIL, floweyIntro: FLOWEY, asriel: ASRIEL, sans: SANS };
export const BATTLE_SCALE = { dummy: 4, froggit: 4, whimsun: 4, moldsmal: 4, snowdrake: 4, icecap: 4, lesserdog: 4, aaron: 4, woshua: 4, temmie: 4, vulkin: 4, tsunderplane: 4, pyrope: 4, toriel: 4, papyrus: 4, undyne: 4, undying: 4, mettaton: 4, neo: 4, asgore: 4, flowey: 5, floweyIntro: 5, asriel: 3, sans: 5 };

// 스프라이트를 오프스크린 캔버스로 굽는다 (매 프레임 픽셀 단위로 그리지 않기 위해).
const cache = new Map();
export function bake(sprite, scale = 2, tint = null) {
  const key = `${sprite.rows.join('')}|${scale}|${tint}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(sprite.w * scale, sprite.h * scale) : Object.assign(document.createElement('canvas'), { width: sprite.w * scale, height: sprite.h * scale });
  const ctx = canvas.getContext('2d');
  sprite.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = row[x]; if (c === '.') continue; ctx.fillStyle = tint || sprite.palette[c] || '#ff00ff'; ctx.fillRect(x * scale, y * scale, scale, scale); } });
  cache.set(key, canvas); return canvas;
}
