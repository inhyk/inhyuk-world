// 언더테일 팬 게임 · 픽셀 스프라이트 (문자 격자로 그린 원본 픽셀 아트)
// '.' 은 투명. 팔레트 글자는 각 스프라이트의 palette에서 색으로 바뀐다.
const P = { k: '#101010', w: '#ffffff', g: '#9a9a9a', d: '#4a4a4a', s: '#f2cfa8', h: '#5b3a1f', b: '#3b4fd0', p: '#a24fd8', t: '#7a4a2a', y: '#f4d34a', o: '#f08a24', r: '#e8302a', n: '#f7a8c8', c: '#4ec8ff', l: '#7bd76b', v: '#3e2a7e', m: '#ff7ad0', e: '#1c1c2e', q: '#c9c9ff', i: '#ffd6e0', u: '#5e6bff', a: '#c88b58', z: '#2c9c3e', f: '#ffe680', x: '#8d6ac7' };

const mirror = rows => rows.map(r => r.split('').reverse().join(''));

// ---------- 고해상도 정제 파이프라인 ----------
// 모든 스프라이트는 밑그림(rows)과 함께 2배 해상도의 정제본(hd)을 갖는다.
// 정제본은 외곽선, 재질별 그늘·밝음 톤, 둥근 모서리를 자동으로 입힌 것이고, bake()가 짝수 배율이면 정제본을 쓴다.
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = v => '#' + v.map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
const mixColor = (c, target, k) => toHex(hex(c).map((v, i) => v + (target[i] - v) * k));
const luma = c => { const [r, g, b] = hex(c); return (r * .299 + g * .587 + b * .114) / 255; };
const POOL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()-_=+[]{};:<>?/~|`"\',';
// 재질 글자마다 그늘·밝음·외곽선 글자를 배정하고 팔레트를 만든다. 아주 어두운 색(눈, 검정)은 평평하게 둔다.
function toneTable(rows, palette, custom = {}, extra = []) {
  const used = new Set(); rows.forEach(r => { for (const c of r) if (c !== '.') used.add(c); }); extra.forEach(c => used.add(c));
  const pool = [...POOL].filter(c => !used.has(c)); let n = 0;
  const pal = {}, tones = {};
  for (const c of used) {
    const color = palette[c] || '#ff00ff'; pal[c] = color;
    if (c === 'k' || luma(color) < .16) { tones[c] = { shade: c, light: c, line: c }; continue; }
    const t = custom[c] || {}, shade = pool[n++], light = pool[n++], line = pool[n++];
    pal[shade] = t.shade || mixColor(color, [0, 0, 0], .3); pal[light] = t.light || mixColor(color, [255, 255, 255], .24); pal[line] = t.line || mixColor(color, [0, 0, 0], .6);
    tones[c] = { shade, light, line };
  }
  return { pal, tones };
}
// 밑그림을 2배로 키우면서 톤을 입힌다. opts.face 는 프리스크·차라 전용 얼굴 처리(가는 눈·입, 지그재그 앞머리, 홍조, 머리 윤기, 줄무늬 입체감).
function refine(base, tones, opts = {}) {
  const face = !!opts.face;
  const H = base.length * 2, W = base[0].length * 2;
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => base[y >> 1][x >> 1]));
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? '.' : g[y][x];
  const group = face ? (c => c === 'm' ? 'b' : (c === 'k' || c === 'r') ? 's' : c) : (c => c);
  let eyeRow = -1, sheen = new Set();
  if (face) {
    // 눈과 입은 두 줄이 아니라 한 줄의 가는 선으로, 입은 가운데 2px만
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'k' && at(x, y - 1) === 'k') g[y][x] = 's';
    eyeRow = g.findIndex(r => r.includes('k'));
    for (let y = eyeRow + 1; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'k' && at(x - 1, y) !== 'k') { let n = 0; while (at(x + n, y) === 'k') n++; if (n >= 4) { g[y][x] = 's'; g[y][x + n - 1] = 's'; } x += n; }
    // 앞머리 끝을 지그재그로 (머리와 피부가 만나는 줄에서 2px 폭의 머리끝을 한 칸 내린다)
    const bang = g.map(r => r.slice());
    for (let y = 0; y < H - 2; y++) for (let x = 0; x < W; x++) if (bang[y][x] === 'h' && bang[y + 1][x] === 's' && bang[y + 2][x] === 's' && (x % 4 === 1 || x % 4 === 2)) g[y + 1][x] = 'h';
    // 볼에 은은한 홍조 (눈 바깥쪽 끝에서 세 줄 아래)
    for (let x = 0; x < W; x++) if (at(x, eyeRow) === 'k') {
      if (at(x - 1, eyeRow) !== 'k' && x < W / 2) for (const dx of [-2, -1]) if (at(x + dx, eyeRow + 3) === 's') g[eyeRow + 3][x + dx] = 'r';
      if (at(x + 1, eyeRow) !== 'k' && x >= W / 2) for (const dx of [1, 2]) if (at(x + dx, eyeRow + 3) === 's') g[eyeRow + 3][x + dx] = 'r';
    }
  }
  // 실루엣의 계단 모서리를 둥글게 (충분히 넓은 덩어리의 볼록 모서리만 깎는다)
  if (opts.round !== false) {
    const snap = g.map(r => r.slice()), sa = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? '.' : snap[y][x];
    const run = (x, y, dx, dy) => { let n = 0; for (let i = 1; sa(x + dx * i, y + dy * i) !== '.'; i++) n++; return n; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (sa(x, y) === '.') continue;
      const u = sa(x, y - 1) === '.', d = sa(x, y + 1) === '.', l = sa(x - 1, y) === '.', r = sa(x + 1, y) === '.';
      const wide = run(x, y, 1, 0) + run(x, y, -1, 0) + 1 >= 4, tall = run(x, y, 0, 1) + run(x, y, 0, -1) + 1 >= 4;
      if (((u && l) || (u && r) || (d && l) || (d && r)) && wide && tall) g[y][x] = '.';
    }
  }
  if (face) {
    // 머리 윤기: 머리 덩어리의 왼쪽 위에 짧은 광택 줄기
    let top = H, left = W, right = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'h') { top = Math.min(top, y); left = Math.min(left, x); right = Math.max(right, x); }
    if (right >= 0) { const w = right - left + 1; for (let i = 0; i < 4; i++) { sheen.add(`${left + Math.round(w * .28) + i},${top + 3}`); sheen.add(`${left + Math.round(w * .28) + i + 2},${top + 4}`); } for (let i = 0; i < 3; i++) sheen.add(`${left + Math.round(w * .15)},${top + 5 + i}`); }
  }
  // 톤 입히기: 외곽선 → 그늘 → 밝음 → 기본 (빛은 왼쪽 위에서 온다)
  const out = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      const T = tones[c];
      if (c === '.' || !T || T.shade === c) { row += c; continue; }
      const gc = group(c), same = (dx, dy) => group(at(x + dx, y + dy)) === gc, outer = (dx, dy) => at(x + dx, y + dy) === '.';
      let tone = c;
      if (outer(0, -1) || outer(0, 1) || outer(-1, 0) || outer(1, 0)) tone = T.line;
      else if (face && c === 'm') tone = at(x, y + 1) !== 'm' ? T.shade : at(x, y - 1) !== 'm' ? T.light : c;
      else if (!same(0, 1) || !same(0, 2) || !same(1, 0)) tone = T.shade;
      else if (face && gc === 's' && group(at(x, y - 1)) === 'h') tone = T.shade;                                                    // 앞머리 그늘
      else if (face && gc === 'b' && (group(at(x, y - 1)) === 's' || group(at(x, y - 2)) === 's' || group(at(x, y - 1)) === 'h')) tone = T.shade; // 옷깃 그늘
      else if (face && gc === 'p' && !same(0, -1)) tone = T.shade;                                                                    // 셔츠 밑단 그늘
      else if (face && gc === 'o' && !same(0, -1)) tone = T.light;                                                                    // 신발 윗면
      else if (face && gc === 'h' && sheen.has(`${x},${y}`)) tone = T.light;
      else if (outer(0, -2) || outer(-2, 0)) tone = T.light;
      row += tone;
    }
    out.push(row);
  }
  return out;
}
// 스프라이트 정의: rows 밑그림, palette 색 덮어쓰기, opts { face, round, tones: { 글자: { shade, light, line } } }
export const def = (rows, palette = {}, opts = {}) => {
  const full = { ...P, ...palette };
  const { pal, tones } = toneTable(rows, full, opts.tones, opts.face ? ['r'] : []);
  return { rows, palette: full, w: rows[0].length, h: rows.length, hd: { rows: refine(rows, tones, opts), palette: pal } };
};
export { P, mirror };

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
// 프리스크 톤: 재질별로 손수 고른 그늘·밝음·외곽선 색
const FRISK_TONES = {
  h: { shade: '#3f2716', light: '#7d5637', line: '#241408' },
  s: { shade: '#d8ae6c', light: '#fce8b8', line: '#7d5030' },
  b: { shade: '#3647aa', light: '#7a8cee', line: '#1f2a6e' },
  m: { shade: '#a2378f', light: '#ec82d8', line: '#5e1f55' },
  p: { shade: '#3a2a1e', light: '#705744', line: '#1c1109' },
  o: { shade: '#170e08', light: '#4a3527', line: '#0a0504' },
};
const FRISK_PAL = { ...FRISK, r: '#efb39a' };
const frisk = rows => def(rows, FRISK_PAL, { face: true, tones: FRISK_TONES });
export const HUMAN = { down: friskDown.map(frisk), up: friskUp.map(frisk), left: friskLeft.map(frisk), right: friskLeft.map(rows => frisk(mirror(rows))) };
// 차라 (몰살 결말용): 초록 셔츠에 노란 줄무늬 하나, 분홍빛 피부, 붉은 눈
const CHARA_PAL = { ...FRISK_PAL, s: '#ffd9dc', b: '#2f9a3e', m: '#f2cf3c', k: '#5a1418', r: '#f28c9a' };
const CHARA_TONES = { ...FRISK_TONES, s: { shade: '#e8aeb4', light: '#fff0f0', line: '#8a4a52' }, b: { shade: '#1f6c2b', light: '#5cc46a', line: '#123f19' }, m: { shade: '#c49f1e', light: '#fbe37a', line: '#6e5410' } };
let stripe = 0;
export const CHARA = def(friskDown[0].map(r => /^\.+m+\.+$/.test(r) && stripe++ > 0 ? r.replace(/m/g, 'b') : r), CHARA_PAL, { face: true, tones: CHARA_TONES });

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
// ---------- 머펫 36x42 · 거미 소녀 보스 (얼굴, 리본, 여섯 팔, 드레스) ----------
// 메타톤 실루엣을 재활용하지 않고, 머펫의 원작형 거미 실루엣을 별도로 유지한다.
export const MUPPET = def([
  '..........kkkkkkkk..........',
  '.......kkkkkkkkkkkkkk.......',
  '.....kkkkkkkkkkkkkkkkkk.....',
  '....kkkkksssssssssssskkkkk....',
  '...kkkksssssssssssssssskkkk...',
  '..kkkkssssskksssskkssssskkkk..',
  '..kkksssssskksssskksssssskkk..',
  '..kkksssssssssssssssssssskkk..',
  '..kkkssssssskkkkkkksssssskkk..',
  '...kkksssssssssssssssssskkk...',
  '....kkkksssssssssssssskkkk....',
  '.......kkkkkkkkkkkkkkk.......',
  '..........kkkwwkkk..........',
  '........kkkkwwwwkkkk........',
  '......kkkkkwwwwwwkkkkk......',
  '.....kkkkkkwwwwwwkkkkkk.....',
  '....kkkkkkkkwwwwkkkkkkkk....',
  '...kkkkkkkkkwwkkkkkkkkkkk...',
  '..kkks......mmmm......s kk..',
  '.kkksss....mmmmmm....sss kk.',
  'kkkssss...mmmmmmmm...sssskkk',
  '..kkkssssmmmmmmmmmmsssskkk..',
  '....kkkmmmmmmmmmmmmmmkkk....',
  '.....kkmmmmmmmmmmmmmmkk.....',
  '....kkkkppppppppppkkkk....',
  '...kkkkppppppppppppkkkk...',
  '..kkkkppppppppppppppkkkk..',
  '..kkkppppppppppppppppkkk..',
  '.kkkkppppppppppppppppppkkkk.',
  '.kkkppppppppppppppppppppkkk.',
  '..kkkppppppppppppppppppkkk..',
  '...kkkppppppppppppppppkkk...',
  '....kkkppppppppppppppkkk....',
  '.....kkkppppppppppppkkk.....',
  '....kkkppppppppppppppkkk....',
  '...kkkppppppppppppppppkkk...',
  '..kkkppppppppppppppppppkkk..',
  '.kkkppppppppppppppppppppkkk.',
  'kkkppppppppppppppppppppppkkk',
  '..kkkppppppppppppppppppkkk..',
  '...kkkppppppppppppppppkkk...',
  '....kkkppppppppppppppkkk....',
  '...kk..kkppppppppppppkk..kk...',
  '..kk....kkppppppppppkk....kk..',
  '.kk......kkppppppppkk......kk.',
  'kk........kkppppkk........kk',
  '..........kkppppkk..........',
  '...........kkkk............',
  '..........kk..kk...........'
].map(r => r.replace(/ /g, '.').padStart(36, '.').padEnd(36, '.')), { k: '#241631', s: '#f7e7b6', w: '#fff2fb', m: '#d85caf', p: '#9a4bc4' });

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
// 아스리엘: 대화창 초상은 보스전 픽셀 엔진이 그린 울고 있는 아이 얼굴을 쓴다
import { childPortraitRows } from './asriel-pixels.mjs';
export const ASRIEL_CHILD = def(childPortraitRows(), { w: '#f3efe6', g: '#c9c1d3', n: '#e8c3cf', f: '#efe1bf', a: '#b89c70', k: '#15101f', i: '#f2a3b8', c: '#8fe3ff', z: '#3aa655', y: '#f2cf3c' });
// 아스리엘 24x44 (옛 전투 스프라이트, 목록 호환용)
export const ASRIEL = def([
  '..kk................kk..', '.kkk................kkk.', 'kkkk.....wwwwww.....kkkk', 'kkk....wwwwwwwwww....kkk', 'kk....wwwwwwwwwwww....kk', '......wwwwwwwwwwww......', '......wwkkwwwwkkww......', '......wwkkwwwwkkww......', '......wwwwwwwwwwww......', '.......wwwkkkkwww.......', '........wwwwwwww........', '........wwwwwwww........', '.....eeeeeeeeeeeeee.....', '....eeeeeeeeeeeeeeee....', '...eeeeeeexxxxeeeeeee...', '..eeeeeeeexxxxeeeeeeee..', '..eeeeeeeeexxeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..'], { e: '#2a1a4e', x: '#e8e8ff' });

export const OVERWORLD = { flowey: FLOWEY, toriel: TORIEL, sans: SANS, papyrus: PAPYRUS, undyne: UNDYNE, kid: KID, rabbit: RABBIT, temmie: TEMMIE, blook: BLOOK, echo: ECHO, froggit: FROGGIT, vending: VENDING, asgore: ASGORE, mettaton: METTATON, dummy: DUMMY, chara: CHARA, asriel: ASRIEL_CHILD };
export const BATTLE = { dummy: DUMMY, froggit: FROGGIT, whimsun: WHIMSUN, moldsmal: MOLDSMAL, snowdrake: SNOWDRAKE, icecap: ICECAP, lesserdog: LESSERDOG, aaron: AARON, woshua: WOSHUA, temmie: TEMMIE, vulkin: VULKIN, tsunderplane: TSUNDERPLANE, pyrope: PYROPE,
  toriel: TORIEL, papyrus: PAPYRUS, undyne: UNDYNE, undying: UNDYING, mettaton: METTATON, neo: NEO, asgore: ASGORE, flowey: FLOWEY_EVIL, floweyIntro: FLOWEY, asriel: ASRIEL, sans: SANS };
export const BATTLE_SCALE = { dummy: 4, froggit: 4, whimsun: 4, moldsmal: 4, snowdrake: 4, icecap: 4, lesserdog: 4, aaron: 4, woshua: 4, temmie: 4, vulkin: 4, tsunderplane: 4, pyrope: 4, toriel: 4, papyrus: 4, undyne: 4, undying: 4, mettaton: 4, neo: 4, asgore: 4, flowey: 4, floweyIntro: 4, asriel: 4, sans: 4 };
// 스프라이트를 오프스크린 캔버스로 굽는다 (매 프레임 픽셀 단위로 그리지 않기 위해).
// 짝수 배율이면 2배 해상도 정제본을 절반 배율로 그려서 같은 크기에 더 많은 디테일을 담는다.
const cache = new Map();
export function bake(sprite, scale = 2, tint = null) {
  const hd = sprite.hd && scale % 2 === 0 && !tint;
  const rows = hd ? sprite.hd.rows : sprite.rows, palette = hd ? sprite.hd.palette : sprite.palette, s = hd ? scale / 2 : scale;
  const key = `${rows.join('')}|${Object.values(palette).join('')}|${s}|${tint}`;
  if (cache.has(key)) return cache.get(key);
  const w = rows[0].length * s, h = rows.length * s;
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = row[x]; if (c === '.') continue; ctx.fillStyle = tint || palette[c] || '#ff00ff'; ctx.fillRect(x * s, y * s, s, s); } });
  cache.set(key, canvas); return canvas;
}
