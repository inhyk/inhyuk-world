// SANS · 심판의 회랑 — 픽셀 그림 (DOM 없음)
// 도형을 작은 색 번호 버퍼에 계단 그대로 그려 넣는다. 표정·팔·땀을 인자로 바꿀 수 있어서 한 장씩 손으로 찍지 않아도 된다.
// 원작 캐릭터: Toby Fox. 그림은 이 게임을 위해 새로 그렸다.

export const PALETTE = [
  null, '#0b0b12', '#ffffff', '#c6cbdb', '#000000', '#3f73e0', '#2a4ca6', '#7aa4f5', '#e6e9f2', '#aab0c4',
  '#f4f4f8', '#bfc4d3', '#232534', '#50546e', '#eef0f6', '#f29ac2', '#c66793', '#39d5ff', '#ffe94a', '#8fd4ff',
  '#e0242f', '#8f1320', '#8a90a8', '#5d6278',
];
const OUT = 1, BONE = 2, BONE_SHADE = 3, BLACK = 4, HOOD = 5, HOOD_SHADE = 6, HOOD_LIGHT = 7, FUR = 8, FUR_SHADE = 9, SHIRT = 10, SHIRT_SHADE = 11,
  SHORTS = 12, SHORTS_EDGE = 13, STRIPE = 14, SLIPPER = 15, SLIPPER_SHADE = 16, CYAN = 17, YELLOW = 18, SWEAT = 19, RED = 20, RED_DARK = 21, GREY = 22, GREY_DARK = 23;

// ---------- 래스터 ----------
export function raster(w, h) { return { w, h, px: new Uint8Array(w * h) }; }
const get = (R, x, y) => x < 0 || y < 0 || x >= R.w || y >= R.h ? 0 : R.px[y * R.w + x];
function put(R, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < R.w && y < R.h) R.px[y * R.w + x] = c; }
function rect(R, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(R, x + i, y + j, c); }
// 픽셀 중심이 안에 들면 칠한다.
function shape(R, inside, c, x0 = 0, y0 = 0, x1 = R.w, y1 = R.h) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(R.h, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(R.w, Math.ceil(x1)); x++) if (inside(x + .5, y + .5)) R.px[y * R.w + x] = c;
}
// 모서리가 둥근 네모에 가까운 타원 (n 이 클수록 네모)
const squircle = (R, cx, cy, rx, ry, n, c) => shape(R, (x, y) => Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n <= 1, c, cx - rx, cy - ry, cx + rx, cy + ry);
const ellipse = (R, cx, cy, rx, ry, c) => squircle(R, cx, cy, rx, ry, 2, c);
function polygon(R, points, c) {
  shape(R, (x, y) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }, c);
}
function line(R, x0, y0, x1, y1, c, thick = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let i = 0; i <= steps; i++) { const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps; if (thick <= 1) put(R, Math.floor(x), Math.floor(y), c); else rect(R, Math.floor(x - thick / 2 + .5), Math.floor(y - thick / 2 + .5), thick, thick, c); }
}
// 한 부분을 따로 그린 뒤, 오른쪽·아래 가장자리에 그늘을 넣고 바깥 외곽선과 함께 올린다.
function part(R, draw, { shade = null, edge = OUT } = {}) {
  const T = raster(R.w, R.h); draw(T);
  if (shade) for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) { const c = get(T, x, y); if (shade[c] && (!get(T, x + 1, y) || !get(T, x, y + 1))) T.px[y * T.w + x] = shade[c] + 100; }
  for (let i = 0; i < T.px.length; i++) if (T.px[i] > 100) T.px[i] -= 100;
  for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
    const c = get(T, x, y);
    if (c) R.px[y * R.w + x] = c;
    else if (edge && (get(T, x - 1, y) || get(T, x + 1, y) || get(T, x, y - 1) || get(T, x, y + 1))) R.px[y * R.w + x] = edge;
  }
}

// ---------- 샌즈 ----------
export const SANS = { w: 76, h: 68, cx: 38, feet: 67 };
// pose: { face, arm: null|'left'|'right'|'up'|'down', sweat: 0~3, gash, flicker: 0|1, breath: 0|1 }
export function drawSans(pose = {}) {
  const R = raster(SANS.w, SANS.h), cx = SANS.cx, face = pose.face || 'idle', lift = pose.breath ? 1 : 0;
  const head = face === 'sleep' ? 1 : 0;
  // 슬리퍼와 다리
  part(R, T => { ellipse(T, cx - 9, 64.2, 6.6, 2.9, SLIPPER); ellipse(T, cx + 9, 64.2, 6.6, 2.9, SLIPPER); }, { shade: { [SLIPPER]: SLIPPER_SHADE } });
  part(R, T => { rect(T, cx - 11, 57, 4, 6, BONE); rect(T, cx + 7, 57, 4, 6, BONE); }, { shade: { [BONE]: BONE_SHADE } });
  // 반바지 (어두운 배경에서도 보이도록 테두리를 밝게)
  part(R, T => {
    polygon(T, [[cx - 14, 49], [cx + 14, 49], [cx + 14, 58], [cx + 2, 58], [cx + 1, 54], [cx - 1, 54], [cx - 2, 58], [cx - 14, 58]], SHORTS);
    rect(T, cx - 13, 50, 1, 8, STRIPE); rect(T, cx + 12, 50, 1, 8, STRIPE);
  }, { edge: SHORTS_EDGE });
  // 후드 몸통
  part(R, T => {
    squircle(T, cx, 40.5 - lift * .5, 20, 10.8, 3, HOOD);
    polygon(T, [[cx - 6, 30], [cx + 6, 30], [cx + 4, 51], [cx - 4, 51]], SHIRT);
    for (let y = 31; y < 51; y++) { put(T, cx - 6 + (y - 30) * .1, y, HOOD_SHADE); put(T, cx + 5 - (y - 30) * .1, y, HOOD_SHADE); }
    if (!pose.arm || pose.arm === 'right') { line(T, cx - 15, 41, cx - 10, 46, HOOD_SHADE); put(T, cx - 16, 40, HOOD_LIGHT); }
    if (!pose.arm || pose.arm !== 'right') { line(T, cx + 14, 41, cx + 9, 46, HOOD_SHADE); put(T, cx + 15, 40, HOOD_LIGHT); }
    rect(T, cx - 17, 34, 1, 4, HOOD_LIGHT); rect(T, cx + 16, 34, 1, 4, HOOD_LIGHT);
    if (pose.gash) { line(T, cx - 10, 33, cx + 9, 47, RED, 2); line(T, cx - 9, 34, cx + 8, 46, RED_DARK); for (const [x, y, n] of [[cx - 4, 40, 4], [cx + 3, 45, 5], [cx + 7, 48, 2]]) rect(T, x, y, 1, n, RED); }
  }, { shade: { [HOOD]: HOOD_SHADE, [SHIRT]: SHIRT_SHADE } });
  // 뻗은 팔 (영혼을 내던질 때)
  if (pose.arm) {
    const reach = { left: [-34, 0], right: [34, 0], up: [-16, -22], down: [-14, 20] }[pose.arm], side = pose.arm === 'right' ? 1 : -1;
    const sx = cx + side * 16, sy = 36, ex = cx + reach[0], ey = sy + reach[1];
    part(R, T => { line(T, sx, sy, ex - Math.sign(reach[0]) * 3, ey - Math.sign(reach[1]) * 3, HOOD, 6); ellipse(T, ex + .5, ey + .5, 3.4, 3.4, BONE); }, { shade: { [HOOD]: HOOD_SHADE, [BONE]: BONE_SHADE } });
  }
  // 후드의 털 깃
  part(R, T => { for (const [x, y, rx] of [[-13, 31, 5.2], [-7.5, 32.6, 4.6], [7.5, 32.6, 4.6], [13, 31, 5.2]]) ellipse(T, cx + x, y - lift * .5, rx, 3.5, FUR); }, { shade: { [FUR]: FUR_SHADE } });
  // 머리
  const hy = head - lift;
  part(R, T => { squircle(T, cx, 15 + hy, 15.6, 10.8, 2.7, BONE); squircle(T, cx, 21.5 + hy, 13.6, 8.2, 2.5, BONE); }, { shade: { [BONE]: BONE_SHADE } });
  drawFace(R, face, cx, hy, pose.flicker ? 1 : 0);
  // 땀
  const drops = [[cx - 19, 9], [cx + 18, 13], [cx - 15, 3], [cx + 20, 6]];
  for (let i = 0; i < Math.min(drops.length, (pose.sweat || 0) + (pose.sweat >= 3 ? 1 : 0)); i++) { const [x, y] = drops[i]; put(R, x, y + hy, SWEAT); rect(R, x - 1, y + 1 + hy, 3, 2, SWEAT); put(R, x - 1, y + 1 + hy, BONE); }
  return R;
}
function drawFace(R, face, cx, hy, flicker) {
  const ey = 15.5 + hy, eyes = [cx - 7, cx + 7];
  const socket = x => ellipse(R, x, ey, 4.7, 4.9, BLACK);
  const pupil = (x, dx = 0, dy = 0, size = 2) => rect(R, Math.round(x - size / 2 + dx), Math.round(ey - size / 2 + .6 + dy), size, size, BONE);
  const arc = (x, up) => { for (let i = -4; i <= 4; i++) { const y = ey + (up ? -1 : 1) * (1.6 - 1.6 * (i / 4) ** 2) + (up ? 1 : -.5); put(R, Math.floor(x + i), Math.floor(y), BLACK); put(R, Math.floor(x + i), Math.floor(y) + 1, BLACK); } };
  if (face === 'closed') { arc(eyes[0], true); arc(eyes[1], true); }
  else if (face === 'sleep') { arc(eyes[0], false); arc(eyes[1], false); }
  else if (face === 'wink') { socket(eyes[0]); pupil(eyes[0]); arc(eyes[1], true); }
  else {
    socket(eyes[0]); socket(eyes[1]);
    if (face === 'idle') { pupil(eyes[0]); pupil(eyes[1]); }
    else if (face === 'look') { pupil(eyes[0], 2, 0); pupil(eyes[1], 2, 0); }
    else if (face === 'hurt') { pupil(eyes[0], 0, 0, 1); pupil(eyes[1], 0, 0, 1); }
    else if (face === 'tired') {
      for (const x of eyes) { rect(R, Math.floor(x - 5), Math.floor(ey - 5), 11, 4, BONE); rect(R, Math.floor(x - 4), Math.floor(ey - 2), 9, 1, OUT); pupil(x, 0, 1.4); }
    } else if (face === 'glow') {
      // 왼눈(화면에서는 오른쪽)에만 불이 켜진다. 푸른빛과 노란빛이 번갈아 깜빡인다.
      const c = flicker ? YELLOW : CYAN, x = eyes[1];
      ellipse(R, x, ey + .3, 2.9, 2.9, c); rect(R, Math.round(x - 1), Math.round(ey - .7), 2, 2, flicker ? CYAN : BLACK);
    }
  }
  // 코
  const ny = Math.round(20 + hy); rect(R, cx - 1, ny, 3, 1, BLACK); put(R, cx, ny + 1, BLACK); put(R, cx - 1, ny - 1, BLACK); put(R, cx + 1, ny - 1, BLACK);
  // 입: 늘 웃고 있다. 이 사이사이에 선.
  const wide = face === 'sleep' ? 8 : 11.5, depth = face === 'hurt' ? 1.2 : face === 'sleep' ? 1.6 : 2.6, base = 23.4 + hy;
  for (let i = -Math.floor(wide); i <= Math.floor(wide); i++) {
    const u = i / wide, top = base + depth * .55 * (1 - u * u), bottom = base + 1 + depth * 1.35 * (1 - u * u), x = cx + i;
    for (let y = Math.floor(top); y <= Math.floor(bottom); y++) put(R, x, y, y === Math.floor(top) || y === Math.floor(bottom) || (i + 300) % 3 === 0 ? BLACK : BONE);
  }
  put(R, cx - Math.floor(wide) - 1, Math.floor(base) - 1, BLACK); put(R, cx + Math.floor(wide) + 1, Math.floor(base) - 1, BLACK);
}

// ---------- 가스터 블래스터 ----------
// 주둥이가 아래를 향한 그림. open 0(닫힘) ~ 1(활짝). charge 는 눈빛.
export const BLASTER = { w: 30, h: 38, cx: 15, cy: 17 };
export function drawBlaster(open = 0, charge = 0) {
  const R = raster(BLASTER.w, BLASTER.h), cx = BLASTER.cx, spread = Math.round(open * 4), drop = Math.round(open * 2);
  // 아래턱 두 쪽: 열리면 양옆으로 벌어진다
  for (const side of [-1, 1]) part(R, T => {
    polygon(T, [[cx + side * (1 + spread), 24 + drop], [cx + side * (8 + spread), 22 + drop], [cx + side * (9 + spread), 29 + drop], [cx + side * (5 + spread), 35 + drop], [cx + side * (2 + spread), 33 + drop]], GREY);
    put(T, cx + side * (3 + spread), 27 + drop, BONE); put(T, cx + side * (5 + spread), 26 + drop, BONE);
  }, { shade: { [GREY]: GREY_DARK } });
  // 머리뼈와 주둥이
  part(R, T => {
    polygon(T, [[cx - 12, 6], [cx - 14, 0], [cx - 8, 4]], BONE); polygon(T, [[cx + 12, 6], [cx + 14, 0], [cx + 8, 4]], BONE);
    squircle(T, cx, 11.5, 12.4, 9.6, 2.4, BONE);
    polygon(T, [[cx - 10, 15], [cx + 10, 15], [cx + 7, 28], [cx - 7, 28]], BONE);
    for (let i = -3; i <= 3; i += 2) polygon(T, [[cx + i * 2 - 1.4, 27.5], [cx + i * 2 + 1.4, 27.5], [cx + i * 2, 31]], BONE);
  }, { shade: { [BONE]: BONE_SHADE } });
  for (const side of [-1, 1]) {
    shape(R, (x, y) => { const u = (x - (cx + side * 5.6)) * .94 - side * (y - 11.5) * .34, v = (y - 11.5); return (u / 3.4) ** 2 + (v / 4.4) ** 2 <= 1; }, BLACK);
    const glow = charge > .66 ? BONE : charge > .33 ? CYAN : BONE;
    if (charge > 0) rect(R, Math.round(cx + side * 5.6 - 1), 11, 2, 2, glow); else put(R, Math.round(cx + side * 5.6 - .5), 12, BONE);
    rect(R, cx + side * 2 - (side > 0 ? 0 : 1), 21, 1, 3, BLACK);
  }
  line(R, cx - 3, 4, cx - 5, 7, BONE_SHADE); line(R, cx + 4, 4, cx + 6, 7, BONE_SHADE);
  return R;
}

// ---------- 색 입히기 ----------
// 래스터를 RGBA 바이트로 바꾼다. tint 를 주면 모든 칸을 그 색으로 채운다(잔상·실루엣).
export function toRGBA(R, tint = null) {
  const out = new Uint8ClampedArray(R.w * R.h * 4);
  for (let i = 0; i < R.px.length; i++) {
    const c = R.px[i]; if (!c) continue;
    const hex = tint || PALETTE[c];
    out[i * 4] = parseInt(hex.slice(1, 3), 16); out[i * 4 + 1] = parseInt(hex.slice(3, 5), 16); out[i * 4 + 2] = parseInt(hex.slice(5, 7), 16); out[i * 4 + 3] = 255;
  }
  return out;
}
