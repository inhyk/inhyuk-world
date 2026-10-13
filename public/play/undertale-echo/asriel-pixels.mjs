// 언더테일 팬 게임 · 아스리엘 보스전 픽셀 아트 엔진 (DOM 없음)
// 벡터 도형을 안티앨리어싱 없이 작은 재질 버퍼에 직접 래스터라이즈하고, 재질마다 색·명암·외곽선을 입혀 RGBA로 만든다.
// 매 프레임 다시 그려도 가벼워서 망토·날개·귀가 살아 움직이는 픽셀 아트를 만들 수 있다.

export const TAU = Math.PI * 2;

// ---------- 래스터 ----------
export function createRaster(w, h) { return { w, h, m: new Uint8Array(w * h) }; }
export function clearRaster(R) { R.m.fill(0); }
export function at(R, x, y) { return x < 0 || y < 0 || x >= R.w || y >= R.h ? 0 : R.m[y * R.w + x]; }
export function put(R, x, y, m) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= R.w || y >= R.h) return; R.m[y * R.w + x] = m; }
// 짝홀 규칙 스캔라인 채우기. 픽셀 중심이 다각형 안에 있으면 칠한다.
export function poly(R, pts, m) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(R.h - 1, Math.ceil(maxY)), xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + .5; xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > sy) !== (yj > sy)) xs.push(xi + (sy - yi) / (yj - yi) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - .5)), b = Math.min(R.w - 1, Math.floor(xs[k + 1] - .5));
      for (let x = a; x <= b; x++) R.m[y * R.w + x] = m;
    }
  }
}
export function ellipse(R, cx, cy, rx, ry, m, rot = 0) {
  const n = Math.max(14, Math.round((rx + ry) * 1.6)), c = Math.cos(rot), s = Math.sin(rot), pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pts.push([cx + x * c - y * s, cy + x * s + y * c]); }
  poly(R, pts, m);
}
// 1픽셀 선 (브레젠험)
export function line(R, x0, y0, x1, y1, m) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
  for (;;) { put(R, x0, y0, m); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
// 굵기가 점점 변하는 곡선 획 (뿔, 깃털, 머리카락)
export function stroke(R, pts, w0, w1, m) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const wa = w0 + (w1 - w0) * (i / (n - 1)), wb = w0 + (w1 - w0) * ((i + 1) / (n - 1));
    if (wa < 1.2 && wb < 1.2) { line(R, x0, y0, x1, y1, m); continue; }
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    poly(R, [[x0 + nx * wa / 2, y0 + ny * wa / 2], [x1 + nx * wb / 2, y1 + ny * wb / 2], [x1 - nx * wb / 2, y1 - ny * wb / 2], [x0 - nx * wa / 2, y0 - ny * wa / 2]], m);
    if (wb >= 2.4) ellipse(R, x1, y1, wb / 2, wb / 2, m);
  }
}
export function bezier(p0, p1, p2, p3, n = 14) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
  return out;
}
export const mirror = (pts, cx) => pts.map(([x, y]) => [2 * cx - x - 1, y]);

// ---------- 재질 ----------
// 번호마다 { c 기본색, s 그늘, l 밝음, rainbow 무지개 순환, flat 명암 없음, noOutline 외곽선 없음, glow 발광 }
export const M = {
  FUR: 1, FUR_S: 2, FUR_D: 3, EAR: 4, HORN: 5, HORN_S: 6, EYE: 7, PUPIL: 8, MARK: 9,
  ROBE: 10, ROBE_L: 11, ROBE_D: 12, GOLD: 13, GOLD_S: 14, ARMOR: 15, ARMOR_L: 16, CAPE: 17, CAPE_L: 18,
  RAINBOW: 19, RAINBOW_D: 20, HEART: 21, WHITE: 22, SHIRT: 23, STRIPE: 24, TEAR: 25, NOSE: 26,
  BONE: 27, BONE_S: 28, BONE_D: 29, SOCKET: 30, LIZ: 31, LIZ_S: 32, COAT: 33, COAT_S: 34, GLASS: 35, SPIKE: 36, VOID: 37, BLUSH: 38, SHIRT_S: 39,
  FEATHER: 40, // 40~59: 깃털마다 색상환에서 다른 자리
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const T = (c, s, l, extra = {}) => ({ c: hex(c), s: hex(s || c), l: hex(l || c), ...extra });
export const MAT = [];
MAT[M.FUR] = T('#f3efe6', '#cfc8d6', '#ffffff');
MAT[M.FUR_S] = T('#c9c1d3', '#a39bb4', '#dcd5e2');
MAT[M.FUR_D] = T('#8c84a3', '#6e6788', '#a49dba');
MAT[M.EAR] = T('#e8c3cf', '#c99aac', '#f6dbe3');
MAT[M.HORN] = T('#efe1bf', '#c9b48a', '#fff4d9');
MAT[M.HORN_S] = T('#b89c70', '#8f7550', '#cdb58c');
MAT[M.EYE] = T('#07060c', null, null, { flat: true });
MAT[M.PUPIL] = T('#ffffff', null, null, { flat: true, glow: true });
MAT[M.MARK] = T('#15101f', null, null, { flat: true });
MAT[M.ROBE] = T('#231c33', '#150f22', '#3b3152');
MAT[M.ROBE_L] = T('#40365a', '#2c2442', '#5a4f7a');
MAT[M.ROBE_D] = T('#120c1c', '#0a0612', '#1d1629');
MAT[M.GOLD] = T('#f0c75e', '#b88a2e', '#fff0a8');
MAT[M.GOLD_S] = T('#a97a2a', '#7c561a', '#c79a45');
MAT[M.ARMOR] = T('#2e2744', '#1c1630', '#4c4368');
MAT[M.ARMOR_L] = T('#6a5f8f', '#4c4368', '#9489bb');
MAT[M.CAPE] = T('#19122a', '#0e0918', '#2c2244');
MAT[M.CAPE_L] = T('#2d2346', '#1f1834', '#43386a');
MAT[M.RAINBOW] = { rainbow: { sat: .9, lit: .62, k: 3.2, off: 0 }, noOutline: false };
MAT[M.RAINBOW_D] = { rainbow: { sat: .75, lit: .4, k: 3.2, off: 40 } };
MAT[M.HEART] = { rainbow: { sat: 1, lit: .66, k: 9, off: 0 }, glow: true };
MAT[M.WHITE] = T('#ffffff', '#dfe6ff', '#ffffff', { flat: true });
MAT[M.SHIRT] = T('#3aa655', '#27803e', '#62c877');
MAT[M.SHIRT_S] = T('#257a39', '#1a5c2a', '#39994f');
MAT[M.STRIPE] = T('#f2cf3c', '#c8a21f', '#fde27a');
MAT[M.TEAR] = T('#8fe3ff', null, null, { flat: true, glow: true });
MAT[M.NOSE] = T('#3b2c40', null, null, { flat: true });
MAT[M.BONE] = T('#f4f1e4', '#cfc9b5', '#ffffff');
MAT[M.BONE_S] = T('#c7bfa6', '#a39a80', '#ddd6bf');
MAT[M.BONE_D] = T('#8a826c', '#6a634f', '#a49c84');
MAT[M.SOCKET] = T('#050408', null, null, { flat: true });
MAT[M.LIZ] = T('#f2d64b', '#cfae2a', '#fff08a');
MAT[M.LIZ_S] = T('#c9a52b', '#a3831c', '#dcbd4a');
MAT[M.COAT] = T('#f4f4f8', '#cfd2de', '#ffffff');
MAT[M.COAT_S] = T('#c2c6d4', '#a0a5b8', '#d8dbe5');
MAT[M.GLASS] = T('#cfeaff', '#9fc4e0', '#ffffff', { flat: true });
MAT[M.SPIKE] = T('#3d3458', '#262040', '#766aa0');
MAT[M.VOID] = { rainbow: { sat: .95, lit: .72, k: 2, off: 180 }, glow: true, noOutline: true };
MAT[M.BLUSH] = T('#f2a3b8', null, null, { flat: true });
for (let i = 0; i < 20; i++) MAT[M.FEATHER + i] = { rainbow: { sat: .92, lit: .64, k: .6, off: i * 18 }, feather: true };

// ---------- 색 ----------
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// 재질 버퍼 → RGBA. 빛은 왼쪽 위에서 온다.
// 1) 실루엣 바깥 1픽셀은 외곽선  2) 아래·오른쪽이 비면 그늘  3) 위·왼쪽이 비면 밝음
// 4) 위나 왼쪽에 다른 재질이 겹치면 그 경계에 옅은 구분선  5) 무지개 재질은 좌표와 시간으로 색상환을 돈다
export function colorize(R, { t = 0, outline = [7, 6, 12], hue = 0, tint = null, alpha = 255, out = null } = {}) {
  const { w, h, m } = R;
  if (out) out.fill(0); else out = new Uint8ClampedArray(w * h * 4);
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : m[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4, k = m[i];
    if (!k) {
      const n = A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1);
      if (n && !MAT[n]?.noOutline) { out[o] = outline[0]; out[o + 1] = outline[1]; out[o + 2] = outline[2]; out[o + 3] = alpha; }
      continue;
    }
    const mat = MAT[k] || MAT[M.WHITE];
    let base, shade, light;
    if (mat.rainbow) {
      const r = mat.rainbow, hh = hue + r.off + (x * r.k + y * r.k * .5) + t * 140;
      base = hsl(hh, r.sat, r.lit); shade = hsl(hh + 12, r.sat, r.lit * .68); light = hsl(hh - 8, r.sat, Math.min(.92, r.lit + .2));
    } else { base = mat.c; shade = mat.s; light = mat.l; }
    let col = base;
    if (!mat.flat) {
      const d = A(x, y + 1), rr = A(x + 1, y), u = A(x, y - 1), l = A(x - 1, y);
      if (d === 0 || rr === 0) col = shade;
      else if (u === 0 || l === 0) col = light;
      else if ((u && u !== k && !MAT[u]?.flat && !MAT[u]?.rainbow) || (l && l !== k && !MAT[l]?.flat && !MAT[l]?.rainbow)) col = mix(base, shade, .7);
      else if (mat.feather && (x * 2 + y) % 13 === 0) col = light;
    }
    if (tint) col = mix(col, tint.c, tint.k);
    out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = alpha;
  }
  return out;
}

// ---------- 형태 1 · 절대신 (180x116) ----------
export const GOD_SIZE = { w: 180, h: 116, cx: 90 };
export function drawGod(R, f = 0, o = {}) {
  const cx = 90, W = Math.sin(f * TAU), lift = Math.round(W * 1.2), shake = o.shake || 0;
  const S = (pts, m) => { poly(R, pts, m); poly(R, mirror(pts, cx), m); };
  const off = (pts, dx = 0, dy = 0) => pts.map(([x, y]) => [x + dx, y + dy]);
  const jit = (pts) => shake ? pts.map(([x, y], i) => [x + Math.sin(f * 90 + i) * shake, y + Math.cos(f * 77 + i * 2) * shake]) : pts;

  // 1. 망토 날개: 무지개 테두리를 조금 크게 먼저 칠하고, 그 안을 검은 망토로 덮는다.
  const capeBase = [[78, 46], [60, 38], [40, 38], [22, 45], [9, 56], [3, 69], [14, 69], [5, 84], [18, 81], [10, 98], [25, 91], [22, 110], [37, 99], [43, 114], [53, 101], [61, 113], [70, 100], [78, 110], [85, 99], [90, 101]];
  const cape = capeBase.map(([x, y], i) => i === 0 || i === capeBase.length - 1 ? [x, y] : [x + Math.sin(f * TAU + i * .7) * (1 + (90 - x) / 45), y + Math.cos(f * TAU + i * .55) * 1.4]);
  const edge = cape.map(([x, y]) => [cx + (x - cx) * 1.045 - .5, 44 + (y - 44) * 1.035 + 1]);
  S(jit(edge), M.RAINBOW);
  S(jit(cape), M.CAPE);
  // 망토 안쪽 주름: 어깨에서 밑단으로 뻗는 밝은 결
  for (const [x1, y1] of [[20, 88], [34, 104], [50, 106], [66, 104]]) {
    const pts = bezier([76, 50], [66, 60], [x1 + 8, y1 - 20], [x1, y1], 10);
    S(pts.map(([x, y], i) => [x - .9 + i * .04, y]).concat(pts.slice().reverse().map(([x, y]) => [x + .9, y])), M.CAPE_L);
  }

  // 2. 등 뒤로 흘러내리는 갈기
  S(off([[80, 20], [72, 34], [66, 50], [64, 62], [70, 58], [72, 66], [78, 58], [82, 64], [86, 56], [90, 60], [90, 20]], 0, lift), M.FUR_S);

  // 3. 로브 몸통
  const robe = [[77, 45], [70, 60], [64, 78], [58, 98], [65, 94], [66, 106], [74, 98], [79, 110], [85, 100], [90, 110]];
  S(off(robe, 0, lift), M.ROBE);
  S(off([[80, 50], [77, 66], [74, 90], [79, 88], [81, 70], [85, 54]], 0, lift), M.ROBE_L);         // 앞섶 밝은 면
  S(off([[62, 88], [58, 98], [65, 94], [66, 106], [74, 98], [79, 110], [85, 100], [90, 110], [90, 93], [76, 90]], 0, lift), M.ROBE_D); // 밑단 어둠
  // 금빛 옷깃 V와 가운데 여밈선
  S(off([[76, 45], [89, 64], [90, 64], [90, 58], [81, 45]], 0, lift), M.GOLD);
  poly(R, off([[89, 64], [91, 64], [91, 97], [89, 97]], 0, lift), M.GOLD_S);
  // 밑단 금빛 룬 삼각형
  for (const x of [70, 78, 86]) S(off([[x, 92], [x + 4, 92], [x + 2, 88]], 0, lift), M.GOLD);
  // 가슴의 무지개 심장
  const hy = 72 + lift;
  poly(R, [[90, hy + 9], [83, hy + 2], [83, hy - 2], [86, hy - 4], [90, hy - 1], [94, hy - 4], [97, hy - 2], [97, hy + 2]], M.HEART);
  // 심장을 받치는 날개 문양 (금)
  S([[82, hy - 1], [74, hy - 5], [70, hy - 3], [76, hy], [72, hy + 2], [81, hy + 3]], M.GOLD);

  // 4. 소매와 앞발: 두 팔을 벌려 힘을 끌어올리는 자세
  const arm = o.arms ?? (.5 + W * .5);
  const ay = -arm * 8;
  const armL = [[74, 47], [62, 52], [50, 64 + ay * .7], [38, 72 + ay], [41, 82 + ay], [50, 80 + ay], [60, 70 + ay * .4], [72, 60]];
  S(armL, M.ROBE);
  S([[72, 50], [62, 55], [51, 66 + ay * .7], [54, 69 + ay * .7], [64, 60]], M.ROBE_L);
  S([[38, 72 + ay], [41, 82 + ay], [44, 81 + ay], [42, 71 + ay]], M.GOLD); // 소매 끝단
  // 앞발: 소매 끝에서 나와 손바닥을 펼친다
  for (const side of [0, 1]) {
    const px = side ? 2 * cx - 1 - 38 : 38, py = 80 + ay, dir = side ? 1 : -1;
    ellipse(R, px + dir * 1, py, 4.4, 4, M.FUR);
    for (const k of [-1, 0, 1]) line(R, px + dir * 3, py + k * 2.5, px + dir * 6, py + k * 3.2, M.FUR);
    put(R, px + dir * 2, py + 2, M.FUR_S); put(R, px, py + 3, M.FUR_S);
  }

  // 5. 가시 달린 어깨 갑주
  const pad = [[82, 44], [72, 38], [60, 30], [63, 38], [50, 34], [56, 42], [42, 42], [53, 48], [44, 54], [58, 53], [66, 57], [79, 52]];
  S(off(pad, 0, lift), M.ARMOR);
  S(off([[80, 44], [72, 40], [62, 36], [58, 42], [66, 44], [76, 46]], 0, lift), M.ARMOR_L);
  for (const [x, y] of [[60, 30], [50, 34], [42, 42], [44, 54]]) { put(R, x, y + lift, M.RAINBOW); put(R, mirror([[x, 0]], cx)[0][0], y + lift, M.RAINBOW); }

  // 6. 목의 털 목도리
  S(off([[76, 38], [78, 44], [82, 42], [84, 47], [88, 43], [90, 48], [90, 34], [80, 34]], 0, lift), M.FUR);

  // 7. 머리
  const hl = lift;
  const ear = [[80, 20], [72, 22], [64, 30], [58, 42], [56, 52], [60, 54], [64, 46], [70, 36], [78, 29]];
  const earSwing = Math.round(W * 1.5);
  S(off(ear.map(([x, y], i) => [x - (i > 2 && i < 7 ? earSwing * (i - 2) / 4 : 0), y]), 0, hl), M.FUR);
  S(off([[76, 26], [70, 30], [64, 38], [62, 46], [66, 44], [70, 36], [76, 30]].map(([x, y], i) => [x - (i > 1 && i < 5 ? earSwing * (i - 1) / 4 : 0), y]), 0, hl), M.EAR);
  ellipse(R, 90 - .5, 26 + hl, 12.5, 13, M.FUR);
  ellipse(R, 90 - .5, 34 + hl, 8, 6.5, M.FUR);
  S(off([[80, 36], [84, 40], [90, 41], [90, 38], [84, 37]], 0, hl), M.FUR_S);   // 주둥이 아래 그늘
  // 정수리 털 뭉치
  S(off([[79, 17], [82, 8], [85, 13], [88, 5], [90, 12], [90, 18]], 0, hl), M.FUR);
  // 뿔: 머리 옆에서 바깥으로 휘어 올라간다
  const horn = bezier([81, 17 + hl], [74, 8 + hl], [64, 10 + hl], [57, 1 + hl], 12);
  stroke(R, horn, 7, 1.4, M.HORN); stroke(R, mirror(horn, cx), 7, 1.4, M.HORN);
  const hornIn = bezier([81, 18 + hl], [75, 11 + hl], [66, 12 + hl], [60, 5 + hl], 8);
  stroke(R, hornIn, 2, .8, M.HORN_S); stroke(R, mirror(hornIn, cx), 2, .8, M.HORN_S);
  // 눈: 검은 흰자에 하얀 눈동자, 눈 밑으로 흘러내린 검은 무늬
  const eyeL = [[80, 24], [86, 23], [88, 26], [82, 27]];
  S(off(eyeL, 0, hl), M.EYE);
  const blink = o.blink ? 1 : 0;
  if (!blink) { put(R, 85, 25 + hl, M.PUPIL); put(R, mirror([[85, 0]], cx)[0][0], 25 + hl, M.PUPIL); }
  line(R, 81, 28 + hl, 79, 33 + hl, M.MARK); line(R, 2 * cx - 82, 28 + hl, 2 * cx - 80, 33 + hl, M.MARK);
  line(R, 79, 21 + hl, 86, 22 + hl, M.MARK); line(R, mirror([[79, 0]], cx)[0][0], 21 + hl, mirror([[86, 0]], cx)[0][0], 22 + hl, M.MARK);
  // 코와 입, 송곳니
  poly(R, off([[87, 30], [92, 30], [91, 32], [88, 32]], 0, hl), M.NOSE);
  line(R, 85, 37 + hl, 94, 37 + hl, M.MARK); line(R, 84, 36 + hl, 85, 37 + hl, M.MARK); line(R, 94, 37 + hl, 95, 36 + hl, M.MARK);
  put(R, 86, 38 + hl, M.WHITE); put(R, 93, 38 + hl, M.WHITE);
  return R;
}

// ---------- 형태 2 · 최후의 형태 (240x124) ----------
export const FINAL_SIZE = { w: 240, h: 124, cx: 120 };
export function drawFinal(R, f = 0, o = {}) {
  const cx = 120, W = Math.sin(f * TAU), spread = o.spread ?? 1, shatter = o.shatter || 0;
  const S = (pts, m) => { poly(R, pts, m); poly(R, mirror(pts, cx), m); };
  const lift = Math.round(W * 1.5);
  // 1. 무지개 날개: 한쪽에 깃털 열 개. 어깨 뒤에서 부채처럼 펼쳐지고 천천히 퍼덕인다.
  const root = [104, 50 + lift];
  for (let i = 0; i < 10; i++) {
    if (shatter && (i * 37 % 10) / 10 < shatter) continue;
    const k = i / 9, flap = W * (4 + k * 6) * Math.PI / 180;
    const a = (205 - 118 * k * spread) * Math.PI / 180 + flap * (1 - k * .3) - (1 - spread) * .9;
    const len = (58 + Math.sin(k * Math.PI) * 42) * (.35 + spread * .65);
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    const w = 5.5 + Math.sin(k * Math.PI) * 3;
    const tip = [root[0] + ca * len, root[1] + sa * len];
    const pts = [[root[0] + nx * 2, root[1] + ny * 2], [root[0] + ca * len * .45 + nx * w, root[1] + sa * len * .45 + ny * w], [root[0] + ca * len * .8 + nx * w * .7, root[1] + sa * len * .8 + ny * w * .7], tip, [root[0] + ca * len * .8 - nx * w * .5, root[1] + sa * len * .8 - ny * w * .5], [root[0] + ca * len * .45 - nx * w * .8, root[1] + sa * len * .45 - ny * w * .8], [root[0] - nx * 2, root[1] - ny * 2]];
    S(pts, M.FEATHER + i);
    // 깃대: 밝은 무지개 선
    const shaft = [[root[0] + ca * 6, root[1] + sa * 6], [root[0] + ca * len * .82, root[1] + sa * len * .82]];
    line(R, shaft[0][0], shaft[0][1], shaft[1][0], shaft[1][1], M.WHITE); line(R, 2 * cx - 1 - shaft[0][0], shaft[0][1], 2 * cx - 1 - shaft[1][0], shaft[1][1], M.WHITE);
  }
  // 2. 아래로 소용돌이치는 별빛 꼬리
  const tail = []; for (let i = 0; i <= 12; i++) { const k = i / 12; tail.push([cx - 1 - (1 - k) * 16 + Math.sin(k * 7 + f * TAU) * 3 * k, 72 + k * 50]); }
  const tailR = tail.slice().reverse().map(([x, y], i) => [2 * cx - 1 - x + Math.sin((1 - i / 12) * 7 + f * TAU) * 2, y]);
  poly(R, tail.concat(tailR), M.ROBE);
  poly(R, tail.map(([x, y]) => [x + 5, y]).concat(tailR.map(([x, y]) => [x - 5, y])), M.VOID);
  // 3. 몸통: 좁은 허리, 가운데로 모이는 무지개 줄기
  S([[108, 46 + lift], [104, 60 + lift], [106, 74 + lift], [112, 86 + lift], [120, 90 + lift]], M.ROBE);
  S([[112, 52 + lift], [110, 66 + lift], [114, 80 + lift], [120, 84 + lift], [120, 52 + lift]], M.ROBE_L);
  for (let i = 0; i < 4; i++) S([[119 - i * 3, 56 + i * 7 + lift], [114 - i * 3, 60 + i * 7 + lift], [119 - i * 3, 59 + i * 7 + lift]], M.RAINBOW);
  // 가슴 심장 핵
  const hy = 62 + lift;
  poly(R, [[120, hy + 12], [110, hy + 2], [110, hy - 3], [114, hy - 6], [120, hy - 2], [126, hy - 6], [130, hy - 3], [130, hy + 2]], M.HEART);
  poly(R, [[120, hy + 7], [115, hy + 1], [115, hy - 2], [117, hy - 3], [120, hy], [123, hy - 3], [125, hy - 2], [125, hy + 1]], M.WHITE);
  // 4. 팔: 양옆으로 크게 벌린다
  const arm = [[106, 50 + lift], [92, 54 + lift], [78, 60 + lift + W * 3], [70, 58 + lift + W * 3], [74, 66 + lift + W * 3], [86, 64 + lift], [100, 60 + lift]];
  S(arm, M.ROBE); S([[104, 51 + lift], [92, 55 + lift], [80, 60 + lift + W * 3], [90, 58 + lift]], M.ROBE_L);
  ellipse(R, 69, 62 + lift + W * 3, 4.5, 4, M.FUR); ellipse(R, 2 * cx - 70, 62 + lift + W * 3, 4.5, 4, M.FUR);
  S([[72, 58 + lift + W * 3], [76, 58 + lift + W * 3], [78, 66 + lift + W * 3], [74, 66 + lift + W * 3]], M.RAINBOW); // 소매 끝 무지개
  // 5. 가시 목깃
  S([[120, 38 + lift], [110, 40 + lift], [98, 34 + lift], [102, 42 + lift], [92, 42 + lift], [100, 48 + lift], [96, 54 + lift], [108, 50 + lift], [120, 52 + lift]], M.SPIKE);
  S([[118, 40 + lift], [108, 42 + lift], [102, 40 + lift], [106, 46 + lift], [118, 46 + lift]], M.ARMOR_L);
  // 6. 머리 (절대신보다 뿔이 크고, 눈은 완전히 검다)
  const hl = lift - 2;
  const ear = [[110, 20], [101, 23], [94, 32], [90, 44], [89, 54], [93, 55], [97, 46], [102, 36], [109, 29]];
  S(ear.map(([x, y]) => [x, y + hl]), M.FUR);
  S([[106, 26], [100, 31], [95, 40], [94, 48], [98, 44], [102, 36], [107, 30]].map(([x, y]) => [x, y + hl]), M.EAR);
  ellipse(R, 119.5, 26 + hl, 12.5, 13, M.FUR); ellipse(R, 119.5, 34 + hl, 8, 6.5, M.FUR);
  S([[110, 36 + hl], [114, 40 + hl], [120, 41 + hl], [120, 38 + hl], [114, 37 + hl]], M.FUR_S);
  S([[109, 17 + hl], [112, 7 + hl], [115, 13 + hl], [118, 3 + hl], [120, 11 + hl], [120, 18 + hl]], M.FUR);
  const horn = bezier([111, 16 + hl], [100, 2 + hl], [86, 12 + hl], [82, 0 + hl], 14);
  stroke(R, horn, 6.5, 1.2, M.HORN); stroke(R, mirror(horn, cx), 6.5, 1.2, M.HORN);
  const hornIn = bezier([111, 17 + hl], [102, 6 + hl], [90, 14 + hl], [86, 5 + hl], 8);
  stroke(R, hornIn, 2, .8, M.HORN_S); stroke(R, mirror(hornIn, cx), 2, .8, M.HORN_S);
  // 검은 공막의 둥근 눈, 하얀 눈동자가 가늘게 빛난다
  S([[109, 23 + hl], [116, 22 + hl], [118, 26 + hl], [116, 29 + hl], [110, 28 + hl]], M.EYE);
  if (!o.blink) { put(R, 114, 25 + hl, M.PUPIL); put(R, 114, 26 + hl, M.PUPIL); put(R, 2 * cx - 115, 25 + hl, M.PUPIL); put(R, 2 * cx - 115, 26 + hl, M.PUPIL); }
  line(R, 110, 29 + hl, 107, 36 + hl, M.MARK); line(R, 111, 29 + hl, 108, 36 + hl, M.MARK); line(R, 2 * cx - 111, 29 + hl, 2 * cx - 108, 36 + hl, M.MARK); line(R, 2 * cx - 112, 29 + hl, 2 * cx - 109, 36 + hl, M.MARK);
  line(R, 108, 20 + hl, 116, 21 + hl, M.MARK); line(R, 2 * cx - 109, 20 + hl, 2 * cx - 117, 21 + hl, M.MARK);
  poly(R, [[117, 30 + hl], [122, 30 + hl], [121, 32 + hl], [118, 32 + hl]], M.NOSE);
  line(R, 114, 37 + hl, 125, 37 + hl, M.MARK); put(R, 116, 38 + hl, M.WHITE); put(R, 123, 38 + hl, M.WHITE);
  return R;
}

// ---------- 형태 3 · 울고 있는 아이 (72x60) ----------
export const CHILD_SIZE = { w: 72, h: 60, cx: 36 };
export function drawChild(R, f = 0, o = {}) {
  const sob = Math.round(Math.max(0, Math.sin(f * TAU * 2)) * 1.2), cx = 36, y = sob;
  const S = (pts, m) => { poly(R, pts, m); poly(R, mirror(pts, cx), m); };
  // 앞으로 모은 두 무릎
  ellipse(R, 27, 55, 8, 3.6, M.FUR); ellipse(R, 2 * cx - 28, 55, 8, 3.6, M.FUR);
  S([[22, 56], [21, 58], [30, 58], [30, 56]], M.FUR_S);
  // 웅크린 몸: 초록 바탕에 노란 줄무늬 두 줄
  S([[26, 31 + y], [21, 42 + y], [19, 53], [36, 53], [36, 31 + y]], M.SHIRT);
  S([[22, 40 + y], [21, 43 + y], [36, 43 + y], [36, 40 + y]], M.STRIPE);
  S([[20, 47], [20, 50], [36, 50], [36, 47]], M.STRIPE);
  S([[20, 51], [19, 53], [36, 53], [36, 51]], M.SHIRT_S);
  // 머리: 고개를 떨군다
  ellipse(R, 35.5, 18 + y, 12, 11, M.FUR);
  ellipse(R, 35.5, 24 + y, 7.5, 5, M.FUR);
  S([[26, 12 + y], [20, 15 + y], [14, 23 + y], [13, 32 + y], [17, 34 + y], [21, 26 + y], [26, 19 + y]], M.FUR);
  S([[24, 16 + y], [19, 21 + y], [16, 29 + y], [19, 28 + y], [23, 21 + y]], M.EAR);
  put(R, 32, 8 + y, M.HORN); put(R, 39, 8 + y, M.HORN); put(R, 32, 9 + y, M.HORN_S); put(R, 39, 9 + y, M.HORN_S);
  // 꼭 감은 눈, 붉어진 볼, 떨리는 입
  line(R, 31, 19 + y, 34, 20 + y, M.MARK); line(R, 37, 20 + y, 40, 19 + y, M.MARK);
  put(R, 30, 23 + y, M.BLUSH); put(R, 41, 23 + y, M.BLUSH);
  line(R, 34, 27 + y, 37, 27 + y, M.MARK); put(R, 33, 28 + y, M.MARK); put(R, 38, 28 + y, M.MARK);
  // 두 손: 소매가 가슴 앞으로 모이고, 앞발이 턱 아래에서 떨린다
  S([[23, 36 + y], [21, 41 + y], [25, 44 + y], [31, 36 + y], [30, 32 + y]], M.SHIRT);
  S([[22, 40 + y], [21, 41 + y], [25, 44 + y], [26, 42 + y]], M.SHIRT_S);
  ellipse(R, 31, 31 + y, 3.4, 3, M.FUR_S); ellipse(R, 2 * cx - 32, 31 + y, 3.4, 3, M.FUR_S);
  put(R, 30, 30 + y, M.FUR); put(R, 2 * cx - 31, 30 + y, M.FUR);
  // 눈물: 볼을 타고 한 방울씩 흘러내린다
  if (o.tears !== false) {
    const drop = Math.floor(f * 10) % 10;
    put(R, 31, 21 + y + Math.min(drop, 7), M.TEAR); put(R, 40, 21 + y + Math.min((drop + 5) % 10, 7), M.TEAR);
    put(R, 31, 21 + y, M.TEAR); put(R, 40, 21 + y, M.TEAR);
  }
  return R;
}

// ---------- 하이퍼 고너 · 염소 해골 (120x96) ----------
export const SKULL_SIZE = { w: 120, h: 96, cx: 60 };
export function drawSkull(R, f = 0, o = {}) {
  void f; // 해골은 입 벌림(o.open)만 움직인다
  const cx = 60, open = Math.max(0, Math.min(1, o.open ?? 1)), jaw = Math.round(open * 16);
  const S = (pts, m) => { poly(R, pts, m); poly(R, mirror(pts, cx), m); };
  // 뿔
  const horn = bezier([46, 20], [30, 2], [12, 10], [6, 30], 16);
  stroke(R, horn, 9, 2, M.BONE_S); stroke(R, mirror(horn, cx), 9, 2, M.BONE_S);
  const rings = bezier([46, 20], [30, 2], [12, 10], [6, 30], 16);
  for (let i = 2; i < 14; i += 2) { const [x, y] = rings[i]; put(R, x, y, M.BONE_D); put(R, 2 * cx - 1 - x, y, M.BONE_D); }
  // 두개골과 긴 주둥이
  ellipse(R, 59.5, 30, 22, 20, M.BONE);
  S([[40, 36], [44, 52], [50, 64], [54, 70], [60, 71], [60, 36]], M.BONE);
  S([[42, 42], [46, 54], [52, 64], [56, 60], [50, 48]], M.BONE_S);
  // 이마 금과 콧구멍
  line(R, 60, 12, 58, 20, M.BONE_D); line(R, 58, 20, 61, 26, M.BONE_D);
  S([[55, 60], [58, 58], [59, 64], [56, 64]], M.SOCKET);
  // 눈구멍: 커다란 검은 구멍 속 하얀 눈동자
  S([[40, 26], [50, 24], [54, 32], [50, 40], [42, 38]], M.SOCKET);
  if (!o.blind) { ellipse(R, 47, 32, 2, 2.2, M.PUPIL); ellipse(R, 2 * cx - 48, 32, 2, 2.2, M.PUPIL); }
  // 윗니
  for (let x = 46; x <= 72; x += 4) S([[x, 70], [x + 3, 70], [x + 1.5, 74]].map(([a, b]) => [a > 60 ? a : a, b]), M.WHITE);
  // 아래턱: 벌어지면 입 속 공허가 보인다
  if (open > .05) { S([[47, 70], [50, 72 + jaw], [60, 73 + jaw], [60, 70]], M.SOCKET); S([[52, 72], [55, 70 + jaw], [60, 71 + jaw], [60, 72]], M.VOID); }
  S([[38, 50], [42, 50], [46, 74 + jaw], [42, 76 + jaw]], M.BONE_S); // 턱 경첩 뼈
  S([[44, 72 + jaw], [48, 84 + jaw], [54, 90 + jaw], [60, 91 + jaw], [60, 80 + jaw], [52, 76 + jaw], [48, 72 + jaw]], M.BONE);
  S([[48, 78 + jaw], [52, 86 + jaw], [58, 88 + jaw], [58, 84 + jaw], [52, 81 + jaw]], M.BONE_S);
  for (let x = 48; x <= 70; x += 4) poly(R, [[x, 76 + jaw], [x + 3, 76 + jaw], [x + 1.5, 72 + jaw]], M.WHITE);
  return R;
}

// ---------- 잃어버린 영혼 · 알피스 (32x40) ----------
export const ALPHYS_SIZE = { w: 32, h: 40, cx: 16 };
export function drawAlphys(R) {
  const cx = 16, S = (pts, m) => { poly(R, pts, m); poly(R, mirror(pts, cx), m); };
  S([[10, 22], [7, 36], [10, 39], [16, 39], [16, 22]], M.COAT);
  S([[8, 30], [7, 36], [10, 39], [12, 30]], M.COAT_S);
  S([[11, 36], [11, 40], [15, 40], [15, 36]], M.LIZ_S);
  ellipse(R, 15.5, 14, 9, 8.5, M.LIZ); ellipse(R, 15.5, 19, 6.5, 4, M.LIZ);
  S([[10, 7], [8, 4], [12, 6]], M.LIZ);
  S([[8, 12], [14, 12], [14, 16], [8, 16]], M.GLASS); line(R, 8, 12, 14, 12, M.MARK); line(R, 8, 16, 14, 16, M.MARK); line(R, 8, 12, 8, 16, M.MARK); line(R, 14, 12, 14, 16, M.MARK);
  line(R, 15, 14, 16, 14, M.MARK);
  put(R, 11, 14, M.EYE); put(R, 20, 14, M.EYE);
  line(R, 12, 21, 19, 21, M.MARK); put(R, 14, 22, M.WHITE); put(R, 17, 22, M.WHITE);
  S([[6, 24], [3, 32], [6, 33], [9, 26]], M.LIZ);
  return R;
}

// ---------- 오버월드 초상용: 아이 얼굴을 기존 스프라이트 문자열 형식으로 ----------
// sprites.mjs 의 def(rows, palette) 가 받을 수 있게 재질 번호를 글자로 바꾼다. (명암은 def 의 정제 파이프라인이 입힌다)
export function childPortraitRows() {
  const R = createRaster(CHILD_SIZE.w, CHILD_SIZE.h); drawChild(R, .08, { tears: true });
  const map = { [M.FUR]: 'w', [M.FUR_S]: 'g', [M.EAR]: 'n', [M.HORN]: 'f', [M.HORN_S]: 'a', [M.MARK]: 'k', [M.BLUSH]: 'i', [M.TEAR]: 'c', [M.SHIRT]: 'z', [M.SHIRT_S]: 'z', [M.STRIPE]: 'y', [M.EYE]: 'k', [M.WHITE]: 'w' };
  let top = R.h, bottom = 0, left = R.w, right = 0;
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) if (R.m[y * R.w + x]) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  const rows = [];
  for (let y = top; y <= bottom; y++) { let row = ''; for (let x = left; x <= right; x++) row += map[R.m[y * R.w + x]] || '.'; rows.push(row); }
  return rows;
}
