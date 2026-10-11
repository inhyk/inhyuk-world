// 터질 때 나오는 효과(상점의 터짐 효과들)와 "N연쇄!" 글자, 화면 흔들림.
// 효과 하나를 더하려면: shop.mjs 의 EFFECTS 에 한 줄, 아래 pop() 에 case 하나 (새 그림이 필요하면 SHAPES 에도).
import { PALETTE } from './skins.mjs';

const TAU = Math.PI * 2;
const RAINBOW = ['#ff4f64', '#ff9f2e', '#ffd84a', '#3fd972', '#3d8bff', '#9b5cff'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[(Math.random() * list.length) | 0];
const MAX_PARTS = 900;

function starPath(ctx, s, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points, r = i % 2 ? s * inner : s;
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}
function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.8);
  ctx.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.6, -s * 1.05, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.6, -s * 1.05, s * 1.3, -s * 0.1, 0, s * 0.8);
}
function sparklePath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
}

// 알갱이 그림들 (2026-10-11 요청: "터짐 효과를 더 많이 엄청 많이 더 만들어줘").
// 알갱이 자리로 옮기고 돌려 둔 뒤에 부른다. 칠하는 색은 알갱이 색으로 맞춰져 있다. s: 크기, p: 알갱이.
const SHAPES = {
  leaf(ctx, s) { // 나뭇잎: 양 끝이 뾰족하고 가운데에 잎맥
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * .9, s, 0); ctx.quadraticCurveTo(0, s * .9, -s, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, s * .12); ctx.beginPath(); ctx.moveTo(-s * .8, 0); ctx.lineTo(s * .8, 0); ctx.stroke();
  },
  clover(ctx, s) { // 네잎클로버: 하트 넷과 줄기
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, s * .14); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * .1, s * .7, s * .5, s * 1.15); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); ctx.translate(0, -s * .5); heartPath(ctx, s * .55); ctx.fill(); ctx.restore(); }
  },
  drop(ctx, s) { // 물방울: 뾰족한 쪽이 뒤 (날아가는 쪽이 둥글다)
    ctx.beginPath(); ctx.moveTo(-s * 2, 0); ctx.lineTo(-s * .34, -s * .94); ctx.arc(0, 0, s, -Math.PI * .61, Math.PI * .61); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(s * .3, -s * .3, s * .28, 0, TAU); ctx.fill();
  },
  candy(ctx, s) { // 사탕: 동그란 알과 양쪽 포장지
    ctx.beginPath(); ctx.moveTo(-s * .8, 0); ctx.lineTo(-s * 1.7, -s * .6); ctx.lineTo(-s * 1.7, s * .6); ctx.closePath(); ctx.moveTo(s * .8, 0); ctx.lineTo(s * 1.7, -s * .6); ctx.lineTo(s * 1.7, s * .6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, s * .22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, s * .55, -2.4, -.4); ctx.stroke();
  },
  balloon(ctx, s) { // 풍선: 길쭉한 공과 매듭, 끈
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, s * .08); ctx.beginPath(); ctx.moveTo(0, s * 1.2); ctx.quadraticCurveTo(s * .4, s * 1.9, -s * .1, s * 2.6); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, s * .9, s * 1.15, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * .2, s * 1.35); ctx.lineTo(0, s * 1.1); ctx.lineTo(s * .2, s * 1.35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-s * .35, -s * .45, s * .16, s * .3, .5, 0, TAU); ctx.fill();
  },
  coin(ctx, s, p) { // 금화: 빙글 도는 것처럼 폭이 줄었다 늘었다 한다
    const w = Math.max(.14, Math.abs(Math.cos(p.t * .28 + (p.seed || 0))));
    ctx.fillStyle = '#c98a00'; ctx.beginPath(); ctx.ellipse(0, s * .1, s * w, s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, s * w, s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.ellipse(0, 0, s * w * .55, s * .55, 0, 0, TAU); ctx.fill();
  },
  gem(ctx, s) { // 보석: 위가 납작한 다이아몬드
    ctx.beginPath(); ctx.moveTo(-s, -s * .25); ctx.lineTo(-s * .5, -s * .8); ctx.lineTo(s * .5, -s * .8); ctx.lineTo(s, -s * .25); ctx.lineTo(0, s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(-s * .5, -s * .8); ctx.lineTo(s * .5, -s * .8); ctx.lineTo(s * .25, -s * .25); ctx.lineTo(-s * .25, -s * .25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,40,.18)'; ctx.beginPath(); ctx.moveTo(s * .25, -s * .25); ctx.lineTo(s, -s * .25); ctx.lineTo(0, s); ctx.closePath(); ctx.fill();
  },
  paw(ctx, s) { // 발자국: 큰 볼록살 하나와 발가락 넷
    ctx.beginPath(); ctx.ellipse(0, s * .35, s * .62, s * .5, 0, 0, TAU); ctx.fill();
    for (const [dx, dy] of [[-.72, -.2], [-.27, -.68], [.27, -.68], [.72, -.2]]) { ctx.beginPath(); ctx.ellipse(dx * s, dy * s, s * .22, s * .28, dx * .5, 0, TAU); ctx.fill(); }
  },
  feather(ctx, s) { // 깃털: 길쭉한 잎 모양에 깃대와 결
    ctx.beginPath(); ctx.moveTo(-s * 1.3, 0); ctx.quadraticCurveTo(-s * .2, -s * .75, s * 1.3, 0); ctx.quadraticCurveTo(-s * .2, s * .75, -s * 1.3, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,170,.7)'; ctx.lineWidth = Math.max(1, s * .1); ctx.beginPath(); ctx.moveTo(-s * 1.7, 0); ctx.lineTo(s * 1.1, 0);
    for (const d of [-.5, 0, .5]) { ctx.moveTo(d * s, 0); ctx.lineTo((d - .3) * s, -s * .32); ctx.moveTo(d * s, 0); ctx.lineTo((d - .3) * s, s * .32); }
    ctx.stroke();
  },
  shard(ctx, s) { // 얼음 조각: 뾰족한 세모, 한쪽 면이 밝다
    ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * .7, s * .8); ctx.lineTo(-s * .6, s * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * .1, s * .2); ctx.lineTo(-s * .6, s * .5); ctx.closePath(); ctx.fill();
  },
  puff(ctx, s) { // 구름·연기: 동그라미 셋
    for (const [dx, dy, r] of [[-.6, .15, .7], [.55, .2, .65], [0, -.25, .85]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, TAU); ctx.fill(); }
  },
  moon(ctx, s) { // 초승달: 큰 원에서 오른쪽으로 비켜 난 작은 원을 뺀 모양
    ctx.beginPath(); ctx.arc(0, 0, s, .896, TAU - .896); ctx.arc(s * .45, 0, s * .8, TAU - 1.351, 1.351, true); ctx.closePath(); ctx.fill();
  },
  beam(ctx, s, p) { // 빛줄기: 길이 len, 굵기 size. 처음 rise 프레임 동안 쭉 뻗는다. mid 면 가운데에서 양쪽으로, 아니면 off 만큼 떨어진 곳에서 앞으로
    const len = p.len * Math.min(1, (p.t + 1) / (p.rise || 5)), from = p.mid ? -len / 2 : (p.off || 0);
    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(from, 0); ctx.lineTo(from + len, 0); ctx.stroke();
    if (p.core) { ctx.strokeStyle = p.core; ctx.lineWidth = Math.max(1, s * .4); ctx.stroke(); }
  },
  shuriken(ctx, s) { // 수리검: 날이 넷인 별과 가운데 구멍
    starPath(ctx, s, 4, .32); ctx.fill();
    ctx.fillStyle = '#39405a'; ctx.beginPath(); ctx.arc(0, 0, s * .22, 0, TAU); ctx.fill();
  },
  ghost(ctx, s) { // 꼬마 유령: 둥근 머리, 물결치는 치맛자락, 눈과 입
    ctx.beginPath(); ctx.arc(0, -s * .2, s * .8, Math.PI, 0); ctx.lineTo(s * .8, s * .8);
    for (let i = 0; i < 3; i++) ctx.quadraticCurveTo(s * (.8 - (i + .5) * .5333), s * .35, s * (.8 - (i + 1) * .5333), s * .8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1640';
    for (const d of [-.3, .3]) { ctx.beginPath(); ctx.ellipse(d * s, -s * .25, s * .12, s * .18, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, s * .15, s * .1, 0, TAU); ctx.fill();
  },
  fish(ctx, s, p) { // 물고기: 헤엄치는 쪽(dir)을 보고 꼬리를 흔든다
    ctx.scale(p.dir || 1, 1);
    const wag = Math.sin(p.t * .5) * s * .25;
    ctx.beginPath(); ctx.moveTo(-s * .8, 0); ctx.lineTo(-s * 1.7, -s * .6 + wag); ctx.lineTo(-s * 1.7, s * .6 + wag); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * .6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s * .5, -s * .12, s * .2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1d1838'; ctx.beginPath(); ctx.arc(s * .55, -s * .12, s * .1, 0, TAU); ctx.fill();
  },
  burst(ctx, s) { // 만화 "펑!" 글자 뒤의 뾰족뾰족한 말풍선
    starPath(ctx, s, 9, .68); ctx.fill();
    ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = Math.max(1, s * .1); ctx.lineJoin = 'round'; ctx.stroke();
  },
  splat(ctx, s, p) { // 물감 얼룩: 큰 방울 둘레에 작은 방울들 (seed 마다 모양이 다르다)
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) { const a = p.seed + i * 1.37, d = s * (1 + (i % 3) * .22); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, s * (.42 - (i % 2) * .14), 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(-s * .3, -s * .3, s * .22, 0, TAU); ctx.fill();
  },
  popcorn(ctx, s) { // 팝콘: 몽글몽글한 흰 덩어리와 노란 속
    for (const [dx, dy, r] of [[-.45, .2, .6], [.45, .25, .55], [0, -.35, .65], [0, .1, .5]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffc95c'; ctx.beginPath(); ctx.arc(0, s * .05, s * .3, 0, TAU); ctx.fill();
  },
  rocket(ctx, s) { // 로켓: 오른쪽(날아가는 쪽)이 머리
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.moveTo(-s * .9, -s * .5); ctx.lineTo(-s * 1.5, -s * 1.05); ctx.lineTo(-s * .3, -s * .5); ctx.closePath(); ctx.moveTo(-s * .9, s * .5); ctx.lineTo(-s * 1.5, s * 1.05); ctx.lineTo(-s * .3, s * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f6ff'; ctx.beginPath(); ctx.moveTo(-s, -s * .5); ctx.lineTo(s * .5, -s * .5); ctx.quadraticCurveTo(s * 1.6, 0, s * .5, s * .5); ctx.lineTo(-s, s * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.moveTo(s * .78, -s * .36); ctx.quadraticCurveTo(s * 1.32, 0, s * .78, s * .36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5ac8ff'; ctx.beginPath(); ctx.arc(s * .1, 0, s * .24, 0, TAU); ctx.fill();
  },
  crown(ctx, s) { // 왕관: 뾰족한 끝 셋에 구슬, 가운데에 빨간 보석
    ctx.beginPath(); ctx.moveTo(-s, s * .6); ctx.lineTo(-s, -s * .5); ctx.lineTo(-s * .5, 0); ctx.lineTo(0, -s * .8); ctx.lineTo(s * .5, 0); ctx.lineTo(s, -s * .5); ctx.lineTo(s, s * .6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.arc(0, s * .2, s * .17, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6c2';
    for (const [dx, dy] of [[-1, -.5], [0, -.8], [1, -.5]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, s * .14, 0, TAU); ctx.fill(); }
  },
  glow(ctx, s) { // 빛 덩어리: 겹쳐 그려서 가장자리가 번진다
    const a0 = ctx.globalAlpha;
    for (const [r, a] of [[1, .22], [.6, .42], [.32, 1]]) { ctx.globalAlpha = a0 * a; ctx.beginPath(); ctx.arc(0, 0, s * r, 0, TAU); ctx.fill(); }
  },
  veil(ctx, s) { // 오로라 자락: 세로로 긴 빛. 겹쳐 그려서 가장자리가 흐리다
    const a0 = ctx.globalAlpha;
    for (const [w, h, a] of [[1, 1, .2], [.62, .82, .28], [.3, .6, .42]]) { ctx.globalAlpha = a0 * a; ctx.beginPath(); ctx.ellipse(0, 0, s * w, s * 3.4 * h, 0, 0, TAU); ctx.fill(); }
  },
  bar(ctx, s, p) { ctx.fillRect(-p.w / 2, -s / 2, p.w, s); }, // 지지직 가로 줄: 폭 w, 높이 size
  smile(ctx, s) { // 웃는 얼굴
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a3200';
    for (const d of [-.35, .35]) { ctx.beginPath(); ctx.ellipse(d * s, -s * .2, s * .12, s * .18, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#4a3200'; ctx.lineWidth = Math.max(1, s * .14); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, s * .05, s * .5, .25, Math.PI - .25); ctx.stroke();
  },
  ball(ctx, s) { // 축구공: 흰 공에 까만 오각형 무늬
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#23263a'; ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.lineTo(Math.cos(a) * s * .42, Math.sin(a) * s * .42); }
    ctx.closePath(); ctx.fill();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * s * .8, Math.sin(a) * s * .8, s * .19, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#23263a'; ctx.lineWidth = Math.max(1, s * .1); ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
  },
  slash(ctx, s) { // 검기: 초승달처럼 휜 칼자국. 색 있는 자국 위에 흰 날
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * .62, s, 0); ctx.quadraticCurveTo(0, -s * .16, -s, 0); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-s * .9, -s * .03); ctx.quadraticCurveTo(0, -s * .5, s * .9, -s * .03); ctx.quadraticCurveTo(0, -s * .28, -s * .9, -s * .03); ctx.fill();
  },
  bat(ctx, s, p) { // 박쥐: 날개를 파닥이고 귀가 뾰족하다
    const flap = Math.sin(p.t * .6) * .35;
    for (const sign of [-1, 1]) {
      ctx.save(); ctx.scale(sign, 1); ctx.rotate(flap);
      ctx.beginPath(); ctx.moveTo(s * .2, -s * .1); ctx.quadraticCurveTo(s * .9, -s * .9, s * 1.6, -s * .2); ctx.quadraticCurveTo(s * 1.3, s * .1, s * 1.15, s * .45); ctx.quadraticCurveTo(s * .9, s * .1, s * .7, s * .4); ctx.quadraticCurveTo(s * .5, s * .15, s * .2, s * .3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, s * .38, s * .5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * .32, -s * .3); ctx.lineTo(-s * .25, -s * .8); ctx.lineTo(-s * .05, -s * .42); ctx.closePath(); ctx.moveTo(s * .32, -s * .3); ctx.lineTo(s * .25, -s * .8); ctx.lineTo(s * .05, -s * .42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe45c';
    for (const d of [-.15, .15]) { ctx.beginPath(); ctx.arc(d * s, -s * .08, s * .07, 0, TAU); ctx.fill(); }
  },
};
// 그릴 수 있는 알갱이 모양 이름 (없는 이름은 기본 반짝으로 그려지니, 잘못 적은 이름을 시험에서 잡는다)
export const PART_SHAPES = [...Object.keys(SHAPES), 'butterfly', 'ribbon', 'flame', 'star', 'heart', 'bubble', 'petal', 'note', 'snow', 'pixel', 'spark', 'orbit', 'comet', 'sparkle'];

export class Effects {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.rings = [];
    this.bolts = [];
    this.shakeT = 0;
    this.shakePower = 0;
    this.flashT = 0;
    this.flashColor = '#fff';
  }

  clear() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; this.bolts.length = 0; this.shakeT = 0; this.flashT = 0; }

  // 알갱이 하나. 꼭 적을 것: kind(움직임과 그림), x, y, size, color. 골라 적는 것:
  //   vx, vy, g(중력), drag, rot, vr, life, floor(튕기는 바닥), trail(꼬리. tail: 길이, trailColor, trailW)
  //   shape(그림만 다르게), delay(늦게 나옴), popIn(몇 프레임 동안 커지며 나옴), grow(프레임마다 커지는 배수)
  //   wob(흔들림. sway: 옆으로, bob: 위아래), face(날아가는 쪽을 봄), blink(깜빡임. seed: 엇박자), dim(반투명)
  add(p) { if (this.parts.length < MAX_PARTS) this.parts.push({ rot: 0, vr: 0, vx: 0, vy: 0, g: 0, drag: 0.98, life: 40, t: 0, ...p }); }

  // 뿌요 하나가 터질 때
  pop(kind, x, y, color, size, chain = 1) {
    const pal = PALETTE[color] || PALETTE[1];
    const c = pal.base, light = pal.light;
    const boost = Math.min(1.6, 1 + chain * 0.06);
    const s = size, u = size / 40;
    switch (kind) {
      case 'butterfly':
        for (let i = 0; i < 5; i++) this.add({ kind: 'butterfly', x, y, vx: rand(-1.8, 1.8), vy: rand(-2.2, -.7), size: s * .18, color: pick(RAINBOW), wob: i, life: 70 });
        break;
      case 'confetti':
        for (let i = 0; i < 16; i++) this.add({ kind: 'ribbon', x, y, vx: rand(-3, 3) * s / 40, vy: rand(-4, -1) * s / 40, g: .12, size: s * .13, color: pick(RAINBOW), vr: rand(-.2, .2), life: 65 });
        break;
      case 'flame':
        for (let i = 0; i < 9; i++) this.add({ kind: 'flame', x: x + rand(-.3, .3) * s, y, vx: rand(-.7, .7), vy: rand(-3.5, -1.3) * s / 40, size: s * rand(.12, .23), color: pick(['#ff6f37', '#ffbd3c', '#fff6aa']), life: 40 });
        break;
      case 'musicbox':
        this.pop('note', x, y, color, size, chain); this.pop('star', x, y, color, size * .7, chain);
        break;
      case 'portal':
        for (const [i, col] of ['#b98bff', '#8effdf'].entries()) this.rings.push({ x, y, r: s * (.7 - i * .4), grow: s * (i ? .045 : -.016), life: 45, t: 0, color: col, width: s * .1, delay: i * 8 });
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; this.add({ kind: 'orbit', cx: x, cy: y, x, y, ang: a, dist: s, size: s * .08, color: i % 2 ? '#d7b8ff' : '#aaffdf', life: 40 }); }
        break;
      case 'nova':
        this.rings.push({ x, y, r: s * .1, grow: s * .09, life: 34, t: 0, color: '#9ffff1', width: s * .09 });
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12; this.add({ kind: 'star', x, y, vx: Math.cos(a) * s * .09, vy: Math.sin(a) * s * .09, size: s * .12, color: i % 2 ? '#fff1a5' : '#c5b7ff', vr: .08, life: 40, trail: [] }); }
        break;
      case 'star':
        for (let i = 0; i < 5; i++) { const a = rand(0, TAU), v = rand(1.5, 3.5) * s / 40 * boost; this.add({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 0.08 * s / 40, size: rand(0.12, 0.2) * s, color: i % 2 ? '#ffe45c' : c, vr: rand(-0.2, 0.2), life: 42 }); }
        break;
      case 'heart':
        for (let i = 0; i < 4; i++) this.add({ kind: 'heart', x: x + rand(-0.3, 0.3) * s, y, vx: rand(-0.5, 0.5), vy: rand(-1.8, -0.9) * s / 40, drag: 0.99, size: rand(0.13, 0.2) * s, color: i % 2 ? '#ff6fa6' : c, wob: rand(0, TAU), life: 55 });
        break;
      case 'bubble':
        for (let i = 0; i < 5; i++) this.add({ kind: 'bubble', x: x + rand(-0.35, 0.35) * s, y: y + rand(-0.2, 0.2) * s, vx: rand(-0.3, 0.3), vy: rand(-1.6, -0.7) * s / 40, drag: 0.995, size: rand(0.1, 0.22) * s, color: light, wob: rand(0, TAU), life: rand(40, 60) });
        break;
      case 'petal':
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU); this.add({ kind: 'petal', x, y, vx: Math.cos(a) * rand(1, 2.5) * s / 40, vy: Math.sin(a) * 2 * s / 40 - 1.5, g: 0.04 * s / 40, drag: 0.96, size: rand(0.1, 0.16) * s, color: i % 2 ? '#ffc7de' : light, vr: rand(-0.15, 0.15), rot: rand(0, TAU), life: 65 }); }
        break;
      case 'note':
        for (let i = 0; i < 3; i++) this.add({ kind: 'note', x: x + rand(-0.3, 0.3) * s, y, vx: rand(-0.6, 0.6), vy: rand(-1.6, -1) * s / 40, drag: 0.985, size: rand(0.22, 0.3) * s, color: pick([c, '#ffffff', '#ffe45c']), wob: rand(0, TAU), glyph: pick(['♪', '♫', '♬']), life: 55 });
        break;
      case 'snow':
        for (let i = 0; i < 5; i++) { const a = rand(0, TAU); this.add({ kind: 'snow', x, y, vx: Math.cos(a) * rand(0.8, 2) * s / 40, vy: Math.sin(a) * 1.5 * s / 40 - 0.6, g: 0.03 * s / 40, drag: 0.97, size: rand(0.12, 0.2) * s, color: i % 2 ? '#e8f6ff' : light, vr: rand(-0.06, 0.06), life: 70 }); }
        break;
      case 'pixel':
        for (let i = 0; i < 10; i++) { const a = rand(0, TAU), v = rand(1, 4) * s / 40 * boost; this.add({ kind: 'pixel', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2 * s / 40, g: 0.22 * s / 40, drag: 0.99, size: rand(0.08, 0.16) * s, color: pick([c, light, pal.dark]), life: 45, floor: y + s * 1.8 }); }
        break;
      case 'firework': {
        const n = 14;
        for (let i = 0; i < n; i++) { const a = i * TAU / n + rand(-0.1, 0.1), v = rand(2.5, 4.5) * s / 40 * boost; this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.07 * s / 40, drag: 0.95, size: rand(0.05, 0.08) * s, color: pick(RAINBOW.concat([c, c])), life: rand(35, 50), trail: [] }); }
        break;
      }
      case 'lightning':
        this.bolts.push({ x, y, s, color: light, life: 16, t: 0, seed: Math.random() * 1000 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * 3 * s / 40, vy: Math.sin(a) * 3 * s / 40, size: rand(0.1, 0.16) * s, color: '#fffbd6', life: 22 }); }
        break;
      case 'rainbow':
        this.rings.push({ x, y, r: s * 0.2, grow: s * 0.05 * boost, life: 34, t: 0, rainbow: true, width: s * 0.12 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * 2 * s / 40, vy: Math.sin(a) * 2 * s / 40, size: rand(0.1, 0.15) * s, color: pick(RAINBOW), life: 34 }); }
        break;
      case 'blackhole':
        for (let i = 0; i < 9; i++) { const a = rand(0, TAU), d = rand(0.8, 1.6) * s; this.add({ kind: 'orbit', cx: x, cy: y, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, ang: a, dist: d, size: rand(0.06, 0.11) * s, color: pick([c, '#c9a8ff', '#ffffff']), life: 30 }); }
        this.rings.push({ x, y, r: s * 0.9, grow: -s * 0.03, life: 26, t: 0, color: '#2a1540', width: s * 0.1, delay: 0 });
        this.rings.push({ x, y, r: s * 0.1, grow: s * 0.09 * boost, life: 20, t: 0, color: '#d9b8ff', width: s * 0.08, delay: 26 });
        break;
      case 'meteor': // 30레벨: 별똥별이 비스듬히 쏟아지고 닿은 자리에 별이 튄다
        for (let i = 0; i < 5; i++) {
          const v = rand(3.2, 4.6) * s / 40;
          this.add({ kind: 'comet', x: x + rand(-1.5, -0.3) * s, y: y - rand(1.1, 2.1) * s, vx: v * 0.62, vy: v, drag: 1, size: rand(0.08, 0.14) * s, color: pick(['#fff1a5', '#ffb36b', '#ffffff', light]), life: rand(20, 30), trail: [] });
        }
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'star', x, y, vx: Math.cos(a) * 2 * s / 40, vy: Math.sin(a) * 2 * s / 40, size: rand(0.1, 0.16) * s, color: i % 2 ? '#ffe45c' : c, vr: 0.15, life: 34 }); }
        break;
      case 'storm': // 50레벨: 무지개 고리가 퍼지고 무지개 알갱이가 회오리치며 밖으로 나간다
        this.rings.push({ x, y, r: s * 0.15, grow: s * 0.07 * boost, life: 30, t: 0, rainbow: true, width: s * 0.1 });
        for (let i = 0; i < 12; i++) this.add({ kind: 'orbit', out: true, cx: x, cy: y, x, y, ang: i * TAU / 12, dist: s * (0.22 + (i % 3) * 0.12), size: s * 0.085, color: RAINBOW[i % RAINBOW.length], life: 38 });
        break;
      case 'comet':
        for (let i = 0; i < 3; i++) { const a = rand(-2.6, -2.1), v = rand(3, 5) * s / 40; this.add({ kind: 'comet', x: x + rand(-0.3, 0.3) * s, y: y + rand(-0.3, 0.3) * s, vx: -Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.985, size: rand(0.1, 0.16) * s, color: pick(['#bff4ff', '#7ad7ff', '#ffffff']), life: 38, trail: [] }); }
        break;
      // ── 2026-10-11 요청 "터짐 효과를 더 많이 엄청 많이 더 만들어줘" — 코인 효과 40가지 ──
      case 'ripple': // 물결: 고리 셋이 차례로 퍼진다
        for (let i = 0; i < 3; i++) this.rings.push({ x, y, r: s * .15, grow: s * .04, life: 30, t: 0, color: i % 2 ? '#ffffff' : light, width: s * .07, delay: i * 7 });
        break;
      case 'leaf':
        for (let i = 0; i < 6; i++) this.add({ kind: 'leaf', x, y, vx: rand(-2.2, 2.2) * u, vy: rand(-2.6, -.8) * u, g: .06 * u, drag: .97, size: rand(.13, .2) * s, color: pick(['#7ddc5a', '#3fae4a', '#ffb347', '#ff7a3c']), rot: rand(0, TAU), vr: rand(-.14, .14), wob: rand(0, TAU), sway: 1.1 * u, life: 62 });
        break;
      case 'drop': // 물방울: 위로 첨벙 튀었다가 떨어진다
        for (let i = 0; i < 8; i++) { const a = rand(-Math.PI * .9, -Math.PI * .1), v = rand(2.2, 4.2) * u; this.add({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .2 * u, drag: .99, size: rand(.06, .11) * s, color: pick(['#7ad7ff', '#bff4ff', light]), face: true, life: 40 }); }
        this.rings.push({ x, y, r: s * .2, grow: s * .04, life: 20, t: 0, color: '#bff4ff', width: s * .06 });
        break;
      case 'clover':
        for (let i = 0; i < 4; i++) this.add({ kind: 'clover', x: x + rand(-.3, .3) * s, y, vx: rand(-1.2, 1.2) * u, vy: rand(-2.2, -1) * u, drag: .98, size: rand(.14, .2) * s, color: pick(['#4fd06a', '#2fb457', '#8be37a']), rot: rand(-.5, .5), vr: rand(-.08, .08), life: 55 });
        for (let i = 0; i < 2; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * 2 * u, vy: Math.sin(a) * 2 * u, size: rand(.09, .13) * s, color: '#fff3a8', life: 28 }); }
        break;
      case 'laugh': // ㅋㅋㅋ: 웃음 글자가 튀어 오른다
        for (let i = 0; i < 4; i++) this.add({ kind: 'note', x: x + rand(-.35, .35) * s, y, vx: rand(-1.4, 1.4) * u, vy: rand(-2.4, -1.2) * u, g: .03 * u, drag: .985, size: rand(.2, .3) * s, color: pick(['#ffe45c', '#ffffff', light]), glyph: pick(['ㅋ', 'ㅋ', 'ㅋ', 'ㅎ']), rot: rand(-.4, .4), vr: rand(-.03, .03), popIn: 5, life: 48 });
        break;
      case 'candy':
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU), v = rand(1.5, 3.6) * u; this.add({ kind: 'candy', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2 * u, g: .2 * u, drag: .99, size: rand(.09, .13) * s, color: pick(RAINBOW), rot: rand(0, TAU), vr: rand(-.2, .2), life: 52, floor: y + s * 1.6 }); }
        break;
      case 'balloon':
        for (let i = 0; i < 4; i++) this.add({ kind: 'balloon', x: x + rand(-.35, .35) * s, y, vx: rand(-.5, .5) * u, vy: rand(-1.2, -.5) * u, g: -.03 * u, drag: .99, size: rand(.14, .19) * s, color: pick(RAINBOW), wob: rand(0, TAU), sway: .5 * u, popIn: 6, life: 66 });
        break;
      case 'coin': // 금화: 위로 튀었다가 바닥에서 통통
        for (let i = 0; i < 7; i++) { const a = rand(-Math.PI * .85, -Math.PI * .15), v = rand(2.4, 4.4) * u; this.add({ kind: 'coin', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .24 * u, drag: .99, size: rand(.11, .15) * s, color: '#ffd23f', seed: rand(0, TAU), life: 56, floor: y + s * 1.7 }); }
        break;
      case 'paw': // 발자국: 왼발 오른발 번갈아 위로 걸어간다
        for (let i = 0; i < 4; i++) this.add({ kind: 'paw', x: x + ((i % 2) - .5) * s * .5 + rand(-.05, .05) * s, y: y + (1 - i) * s * .42, size: s * .2, color: i % 2 ? '#ffb7d0' : '#ffffff', rot: ((i % 2) - .5) * .5, delay: i * 5, popIn: 4, life: 34 });
        break;
      case 'gem':
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU), v = rand(1.6, 3.4) * u * boost; this.add({ kind: 'gem', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5 * u, g: .14 * u, size: rand(.12, .18) * s, color: pick([c, light, '#8ef0ff', '#ff9fe0']), rot: rand(-.4, .4), vr: rand(-.08, .08), life: 46 }); }
        for (let i = 0; i < 2; i++) this.add({ kind: 'sparkle', x: x + rand(-.5, .5) * s, y: y + rand(-.5, .5) * s, size: rand(.14, .2) * s, color: '#ffffff', delay: i * 8, life: 20 });
        break;
      case 'feather':
        for (let i = 0; i < 5; i++) this.add({ kind: 'feather', x: x + rand(-.4, .4) * s, y: y + rand(-.3, .1) * s, vx: rand(-.9, .9) * u, vy: rand(-1.4, -.3) * u, g: .035 * u, drag: .97, size: rand(.13, .19) * s, color: pick(['#ffffff', '#eaf4ff', light]), rot: rand(-.9, .9), vr: rand(-.035, .035), wob: rand(0, TAU), sway: 1.3 * u, life: 72 });
        break;
      case 'popcorn': // 팝콘: 하나씩 팡팡 튀어 올라 바닥에서 통통
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + rand(-.9, .9), v = rand(2.6, 5) * u; this.add({ kind: 'popcorn', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .26 * u, drag: .99, size: rand(.09, .13) * s, color: pick(['#fffaf0', '#fff3d6']), rot: rand(0, TAU), vr: rand(-.25, .25), delay: (i % 3) * 3, life: 50, floor: y + s * 1.6 }); }
        break;
      case 'ice':
        for (let i = 0; i < 9; i++) { const a = rand(0, TAU), v = rand(1.8, 4) * u * boost; this.add({ kind: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.2 * u, g: .18 * u, size: rand(.08, .15) * s, color: pick(['#bfeaff', '#8fd4ff', '#e8f8ff']), rot: rand(0, TAU), vr: rand(-.25, .25), life: 40 }); }
        this.rings.push({ x, y, r: s * .2, grow: s * .05, life: 16, t: 0, color: '#e8f8ff', width: s * .05 });
        break;
      case 'cloud':
        for (let i = 0; i < 5; i++) { const a = rand(0, TAU), v = rand(.5, 1.5) * u; this.add({ kind: 'puff', x: x + Math.cos(a) * s * .2, y: y + Math.sin(a) * s * .2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .5 * u, drag: .96, size: rand(.12, .18) * s, grow: 1.018, color: pick(['#ffffff', '#f1f7ff', '#ffe9f3']), dim: .85, life: 46 }); }
        break;
      case 'smile':
        for (let i = 0; i < 4; i++) { const a = rand(-Math.PI * .85, -Math.PI * .15), v = rand(2.2, 4) * u; this.add({ kind: 'smile', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .2 * u, drag: .99, size: rand(.13, .18) * s, color: '#ffd84a', rot: rand(-.3, .3), vr: rand(-.06, .06), life: 54, floor: y + s * 1.6 }); }
        break;
      case 'moon':
        for (let i = 0; i < 2; i++) this.add({ kind: 'moon', x: x + rand(-.4, .4) * s, y, vx: rand(-.5, .5) * u, vy: rand(-1.5, -.8) * u, drag: .985, size: rand(.18, .25) * s, color: '#fff1a5', rot: rand(-.5, .3), vr: rand(-.02, .02), life: 58 });
        for (let i = 0; i < 4; i++) this.add({ kind: 'star', x: x + rand(-.6, .6) * s, y: y + rand(-.5, .3) * s, vy: rand(-.7, -.2) * u, drag: 1, size: rand(.07, .11) * s, color: i % 2 ? '#ffffff' : '#ffe9a0', blink: .5, seed: rand(0, TAU), life: 50 });
        break;
      case 'sun': // 햇살: 길고 짧은 빛줄기가 번갈아 뻗으며 천천히 돈다
        for (let i = 0; i < 10; i++) this.add({ kind: 'beam', x, y, rot: i * TAU / 10, vr: .02, off: s * .38, len: s * (i % 2 ? .42 : .7), size: s * .08, color: i % 2 ? '#ffe45c' : '#ffb52e', rise: 8, life: 30 });
        this.add({ kind: 'glow', x, y, size: s * .42, color: '#ffe45c', life: 30 });
        break;
      case 'soccer':
        for (let i = 0; i < 4; i++) { const a = rand(-Math.PI * .85, -Math.PI * .15), v = rand(2.4, 4.4) * u; this.add({ kind: 'ball', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .22 * u, drag: .99, size: rand(.13, .17) * s, color: '#ffffff', rot: rand(0, TAU), vr: rand(-.25, .25), life: 56, floor: y + s * 1.6 }); }
        break;
      case 'shuriken': // 수리검: 네 귀퉁이로 빙글빙글 날아간다
        for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2 + rand(-.3, .3), v = rand(3.4, 5) * u; this.add({ kind: 'shuriken', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .97, size: rand(.15, .2) * s, color: '#dfe6f5', vr: .55, life: 34, trail: [], tail: 8, trailColor: 'rgba(223,230,245,.6)', trailW: s * .05 }); }
        break;
      case 'ghost':
        for (let i = 0; i < 3; i++) this.add({ kind: 'ghost', x: x + rand(-.4, .4) * s, y, vx: rand(-.6, .6) * u, vy: rand(-1.6, -.8) * u, drag: .99, size: rand(.17, .24) * s, color: '#ffffff', wob: rand(0, TAU), sway: .9 * u, popIn: 5, dim: .92, life: 58 });
        break;
      case 'paint': // 물감: 얼룩이 철퍼덕 묻어서 천천히 흘러내린다
        for (let i = 0; i < 3; i++) this.add({ kind: 'splat', x: x + rand(-.45, .45) * s, y: y + rand(-.45, .45) * s, g: .012 * u, drag: 1, size: rand(.16, .24) * s, color: i ? pick(RAINBOW) : c, seed: rand(0, TAU), popIn: 4, delay: i * 3, life: 44 });
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU), v = rand(2, 4.2) * u; this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .16 * u, size: rand(.04, .07) * s, color: pick([c, light].concat(RAINBOW)), life: 26 }); }
        break;
      case 'fish': // 물고기 떼: 왼쪽 오른쪽으로 헤엄치고 공기 방울이 올라간다
        for (let i = 0; i < 5; i++) { const dir = i % 2 ? 1 : -1; this.add({ kind: 'fish', x: x + rand(-.3, .3) * s, y: y + rand(-.4, .4) * s, vx: dir * rand(1.4, 3) * u, vy: rand(-.4, .2) * u, drag: .985, dir, size: rand(.1, .15) * s, color: pick([c, '#ffb347', '#7ad7ff', '#ff8fb8']), wob: rand(0, TAU), sway: 0, bob: .7 * u, life: 52 }); }
        for (let i = 0; i < 3; i++) this.add({ kind: 'bubble', x: x + rand(-.4, .4) * s, y, vy: rand(-1.4, -.7) * u, drag: .995, size: rand(.05, .09) * s, color: '#dff6ff', wob: rand(0, TAU), life: 44 });
        break;
      case 'firefly':
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU), v = rand(.5, 1.4) * u; this.add({ kind: 'glow', x: x + rand(-.3, .3) * s, y: y + rand(-.3, .3) * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .3 * u, drag: .99, size: rand(.17, .25) * s, color: pick(['#e6ff7a', '#b8ff6a', '#fff59a']), wob: rand(0, TAU), sway: .8 * u, bob: .5 * u, blink: .35, seed: rand(0, TAU), life: rand(56, 78) }); }
        break;
      case 'comic': // 만화 펑!: 뾰족뾰족한 말풍선 위에 글자
        this.add({ kind: 'burst', x, y, size: s * .5, color: '#ffe45c', rot: rand(-.3, .3), popIn: 5, life: 30 });
        this.add({ kind: 'note', x, y, size: s * .27, color: '#ff4f64', glyph: pick(['펑!', '팡!', '뿅!', '퐁!', '톡!']), rot: rand(-.25, .25), popIn: 5, life: 30 });
        break;
      case 'shock': // 충격파: 굵은 흰 고리가 빠르게 퍼지고 줄이 사방으로 튄다
        this.rings.push({ x, y, r: s * .15, grow: s * .11 * boost, life: 16, t: 0, color: '#ffffff', width: s * .16 });
        this.rings.push({ x, y, r: s * .1, grow: s * .07, life: 22, t: 0, color: light, width: s * .06, delay: 4 });
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + rand(-.15, .15), v = rand(3.5, 5) * u; this.add({ kind: 'beam', x: x + Math.cos(a) * s * .4, y: y + Math.sin(a) * s * .4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .92, rot: a, len: s * rand(.25, .45), size: s * .05, color: '#ffffff', rise: 2, life: 18 }); }
        break;
      case 'bomb': // 폭탄: 주황 고리, 까만 연기, 불똥
        this.rings.push({ x, y, r: s * .15, grow: s * .08, life: 14, t: 0, color: '#ffb52e', width: s * .12 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU), v = rand(.6, 1.6) * u; this.add({ kind: 'puff', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .6 * u, drag: .95, size: rand(.13, .18) * s, grow: 1.025, color: pick(['#3b3550', '#57506e', '#77708c']), dim: .8, life: 40 }); }
        for (let i = 0; i < 8; i++) { const a = rand(0, TAU), v = rand(2.5, 4.8) * u * boost; this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .09 * u, drag: .94, size: rand(.045, .075) * s, color: pick(['#ff6f37', '#ffbd3c', '#fff6aa']), life: rand(22, 34), trail: [] }); }
        break;
      case 'bat':
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + rand(-1.2, 1.2), v = rand(1.6, 3.2) * u; this.add({ kind: 'bat', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .985, size: rand(.14, .2) * s, color: pick(['#9b6cff', '#b98bff', '#7a52d6']), wob: rand(0, TAU), sway: .7 * u, bob: .5 * u, life: 52 }); }
        break;
      case 'laser': // 레이저: 빨강과 파랑 빛줄기가 엇갈려 지나간다
        for (const [i, col] of ['#ff4f7a', '#4fd8ff'].entries()) this.add({ kind: 'beam', x, y, rot: i * Math.PI / 2 + rand(-.12, .12), mid: true, len: s * 3.4, size: s * .14, color: col, core: '#ffffff', rise: 4, delay: i * 3, life: 20 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * 2.5 * u, vy: Math.sin(a) * 2.5 * u, size: rand(.09, .14) * s, color: i % 2 ? '#ffd0dc' : '#d0f6ff', life: 22 }); }
        break;
      case 'gold': // 금가루: 깜빡이는 금빛 가루가 천천히 내려앉는다
        for (let i = 0; i < 14; i++) { const a = rand(0, TAU), v = rand(.6, 2.6) * u; this.add({ kind: i % 2 ? 'spark' : 'sparkle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - u, g: .05 * u, drag: .97, size: (i % 2 ? rand(.03, .05) : rand(.12, .19)) * s, color: pick(['#ffd23f', '#fff3a8', '#ffb52e', '#ffffff']), blink: .7, seed: rand(0, TAU), life: rand(44, 62) }); }
        break;
      case 'volcano': // 화산: 용암이 위로 솟았다가 떨어지고 연기가 오른다
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + rand(-.5, .5), v = rand(3.2, 5.6) * u; this.add({ kind: 'spark', x: x + rand(-.15, .15) * s, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .22 * u, drag: .985, size: rand(.06, .11) * s, color: pick(['#ff3d2e', '#ff8a1f', '#ffd23f']), life: rand(36, 48), trail: [], tail: 8 }); }
        for (let i = 0; i < 2; i++) this.add({ kind: 'puff', x: x + rand(-.2, .2) * s, y, vx: rand(-.3, .3) * u, vy: rand(-1.4, -.8) * u, drag: .98, size: rand(.1, .14) * s, grow: 1.02, color: '#6b6480', dim: .6, life: 44 });
        break;
      case 'tornado': // 회오리바람: 아래는 좁고 위는 넓게 빙글빙글 올라간다
        for (let i = 0; i < 12; i++) { const ang = i * 1.1, rad = s * (.14 + i * .028), cy = y + s * .45 - i * s * .03; this.add({ kind: 'helix', shape: 'spark', cx: x, cy, x: x + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad * .3, ang, rad, spin: .42, rise: (1 + i * .12) * u, size: s * rand(.04, .075), color: pick(['#ffffff', '#dfe9f5', '#b9c7dd', light]), life: 40, trail: [], tail: 10 }); }
        break;
      case 'aurora': // 오로라: 세로로 긴 빛 자락 넷이 일렁이며 올라간다
        for (let i = 0; i < 4; i++) this.add({ kind: 'veil', x: x + (i - 1.5) * s * .3 + rand(-.08, .08) * s, y: y - s * .1, vy: rand(-.9, -.4) * u, drag: .99, size: s * rand(.13, .18), grow: 1.008, color: ['#7dffb0', '#6fe8ff', '#b48bff', '#8dffd9'][i], rot: rand(-.12, .12), wob: rand(0, TAU), sway: .5 * u, popIn: 8, life: 52 });
        break;
      case 'disco': // 디스코: 무지개 조명이 빙글 돌고 네모 불빛이 깜빡인다
        for (let i = 0; i < 6; i++) this.add({ kind: 'beam', x, y, rot: i * TAU / 6, vr: .11, len: s * 1.25, size: s * .13, color: RAINBOW[i], dim: .55, rise: 6, life: 34 });
        for (let i = 0; i < 5; i++) this.add({ kind: 'pixel', x: x + rand(-.9, .9) * s, y: y + rand(-.9, .9) * s, size: rand(.08, .13) * s, color: pick(RAINBOW), blink: 1.1, seed: rand(0, TAU), delay: i * 3, life: 24 });
        this.add({ kind: 'glow', x, y, size: s * .22, color: '#ffffff', life: 30 });
        break;
      case 'constellation': { // 별자리: 별 넷이 차례로 켜지고 선으로 이어진다
        const pts = [], a0 = rand(0, TAU);
        for (let i = 0; i < 4; i++) { const a = a0 + i * 1.45 + rand(-.3, .3), d = s * rand(.45, .95); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); }
        for (let i = 0; i < 3; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; this.add({ kind: 'beam', x: x1, y: y1, rot: Math.atan2(y2 - y1, x2 - x1), len: Math.hypot(x2 - x1, y2 - y1), size: s * .03, color: '#cfe4ff', rise: 6, delay: 4 + i * 5, life: 38 - i * 5 }); }
        for (const [i, [px, py]] of pts.entries()) this.add({ kind: 'star', x: px, y: py, size: s * (i % 2 ? .12 : .16), color: i % 2 ? '#ffffff' : '#fff1a5', blink: .45, seed: i, popIn: 4, delay: i * 5, life: 44 - i * 5 });
        break;
      }
      case 'rocket': // 로켓: 연기를 남기고 점점 빨리 날아오른다
        for (let i = 0; i < 2; i++) { const a = -Math.PI / 2 + (i ? 1 : -1) * rand(.15, .6); this.add({ kind: 'rocket', x, y, vx: Math.cos(a) * 1.2 * u, vy: Math.sin(a) * 1.2 * u, drag: 1.06, size: s * rand(.14, .18), color: '#f4f6ff', face: true, delay: i * 6, life: 34, trail: [], tail: 10, trailColor: '#ffe45c' }); }
        for (let i = 0; i < 3; i++) this.add({ kind: 'puff', x: x + rand(-.25, .25) * s, y: y + s * .15, vx: rand(-.7, .7) * u, vy: rand(.1, .5) * u, drag: .95, size: rand(.08, .12) * s, grow: 1.03, color: '#e8ecf6', dim: .7, life: 26 });
        break;
      case 'crown':
        this.add({ kind: 'crown', x, y, vy: -.9 * u, drag: .97, size: s * .3, color: '#ffd23f', rot: rand(-.15, .15), popIn: 6, life: 40 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x: x + Math.cos(a) * s * .5, y: y + Math.sin(a) * s * .5, vx: Math.cos(a) * .8 * u, vy: Math.sin(a) * .8 * u, size: rand(.1, .15) * s, color: '#fff6c2', delay: 3 + i * 3, life: 22 }); }
        break;
      case 'glitch': // 지지직: 가로 줄이 좌우로 덜덜 떨고 네모가 깜빡인다
        for (let i = 0; i < 7; i++) { const bx = x + rand(-.3, .3) * s; this.add({ kind: 'bar', x: bx, x0: bx, y: y + rand(-.55, .55) * s, w: s * rand(.4, 1.3), size: s * rand(.06, .14), color: pick(['#35f4ff', '#ff3df0', '#ffffff', c]), jit: s * .35, delay: (i % 3) * 2, life: rand(12, 24) }); }
        for (let i = 0; i < 4; i++) this.add({ kind: 'pixel', x: x + rand(-.8, .8) * s, y: y + rand(-.8, .8) * s, size: rand(.08, .14) * s, color: pick(['#35f4ff', '#ff3df0', '#ffe45c']), delay: i * 4, life: 10 });
        break;
      case 'galaxy': // 은하수: 별들이 두 갈래 소용돌이로 퍼져 나간다
        for (let i = 0; i < 14; i++) this.add({ kind: 'orbit', shape: i % 3 ? 'sparkle' : 'star', out: true, fade: true, cx: x, cy: y, x, y, ang: (i % 2) * Math.PI + i * .42, dist: s * (.12 + i * .045), spin: .16, pull: 1.04, size: s * rand(.07, .12), color: pick(['#ffffff', '#c5b7ff', '#9fe3ff', '#fff1a5']), life: 44 });
        break;
      case 'code': // 숫자 비: 초록 0과 1이 세 줄로 흘러내린다
        for (let i = 0; i < 6; i++) this.add({ kind: 'note', x: x + ((i % 3) - 1) * s * .34 + rand(-.05, .05) * s, y: y - s * rand(.2, .9), vy: rand(1.6, 3) * u, drag: 1, size: rand(.17, .22) * s, color: pick(['#5dff8a', '#a6ffbf', '#22d45c']), glyph: pick(['0', '1']), delay: (i % 3) * 3 + (i > 2 ? 6 : 0), life: 30 });
        break;
      case 'slash': // 칼바람: 검기 둘이 X 자로 지나가고 불똥이 튄다
        for (let i = 0; i < 2; i++) this.add({ kind: 'slash', x, y, size: s * 1.05, color: i ? '#9fe3ff' : light, rot: (i ? -1 : 1) * Math.PI / 4 + rand(-.15, .15) + i * Math.PI, popIn: 4, delay: i * 5, life: 16 });
        for (let i = 0; i < 5; i++) { const a = rand(0, TAU), v = rand(2.5, 4.5) * u; this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(.08, .13) * s, color: '#ffffff', delay: 5, life: 18 }); }
        break;
      // ── 레벨 효과 6가지 (40·60·70·80·90·99레벨. 교환권으로 받을 수 없다) ──
      case 'blizzard': // 40레벨: 눈보라가 옆으로 몰아치고 얼음 고리가 퍼진다
        this.rings.push({ x, y, r: s * .2, grow: s * .06 * boost, life: 22, t: 0, color: '#dff6ff', width: s * .07 });
        for (let i = 0; i < 6; i++) this.add({ kind: 'snow', x: x + rand(-1.2, -.2) * s, y: y + rand(-.8, .6) * s, vx: rand(2.6, 4.6) * u, vy: rand(.2, 1.2) * u, drag: .985, size: rand(.1, .17) * s, color: i % 2 ? '#ffffff' : '#cfeeff', vr: rand(-.12, .12), wob: rand(0, TAU), sway: 0, bob: .6 * u, life: 46 });
        for (let i = 0; i < 5; i++) this.add({ kind: 'beam', x: x + rand(-1.3, -.3) * s, y: y + rand(-.8, .8) * s, vx: rand(4, 6.5) * u, vy: rand(.4, 1) * u, drag: .97, rot: .16, len: s * rand(.3, .6), size: s * .035, color: '#ffffff', dim: .7, rise: 2, delay: i * 2, life: 22 });
        for (let i = 0; i < 3; i++) { const a = rand(0, TAU); this.add({ kind: 'shard', x, y, vx: Math.cos(a) * 2.6 * u, vy: Math.sin(a) * 2.6 * u - u, g: .15 * u, size: rand(.08, .13) * s, color: '#bfeaff', rot: rand(0, TAU), vr: rand(-.2, .2), life: 34 }); }
        break;
      case 'thunderstorm': // 60레벨: 먹구름에서 번개가 치고 비가 쏟아진다
        for (let i = 0; i < 3; i++) this.add({ kind: 'puff', x: x + (i - 1) * s * .32, y: y - s * .75 + rand(-.06, .06) * s, vx: rand(-.2, .2) * u, drag: .98, size: s * rand(.16, .2), color: i === 1 ? '#8a84a6' : '#655e82', dim: .9, popIn: 5, life: 44 });
        this.bolts.push({ x, y: y - s * .5, s: s * .9, color: light, life: 14, t: 0, seed: Math.random() * 1000 });
        for (let i = 0; i < 7; i++) this.add({ kind: 'drop', x: x + rand(-.55, .55) * s, y: y - s * rand(.4, .7), vx: -.8 * u, vy: rand(3, 4.6) * u, drag: 1, size: rand(.035, .055) * s, color: '#9fdcff', face: true, delay: 4 + i * 2, life: 20 });
        this.rings.push({ x, y, r: s * .15, grow: s * .08, life: 14, t: 0, color: '#fff27a', width: s * .07, delay: 2 });
        break;
      case 'bigbang': // 70레벨: 하얀 빛이 번쩍 커지고, 고리 둘과 별이 사방으로 터진다
        this.add({ kind: 'glow', x, y, size: s * .3, grow: 1.05, color: '#ffffff', life: 14 });
        this.rings.push({ x, y, r: s * .1, grow: s * .12 * boost, life: 20, t: 0, color: '#ffffff', width: s * .12 });
        this.rings.push({ x, y, r: s * .1, grow: s * .07, life: 30, t: 0, rainbow: true, width: s * .06, delay: 5 });
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + rand(-.12, .12), v = rand(3, 5.5) * u * boost; this.add({ kind: i % 3 ? 'spark' : 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .955, size: s * (i % 3 ? rand(.05, .08) : rand(.11, .15)), color: pick(RAINBOW.concat(['#ffffff', '#fff1a5'])), vr: .12, life: rand(36, 48), trail: [], trailW: s * .05 }); }
        break;
      case 'phoenix': // 80레벨: 불꽃 깃털이 양쪽 날개처럼 활짝 펴진다
        for (const sign of [-1, 1]) for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + sign * (.35 + i * .2), v = (2 + i * .35) * u; this.add({ kind: 'flame', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: -.03 * u, drag: .965, size: s * (.2 - i * .018), color: ['#fff6aa', '#ffd23f', '#ffa52e', '#ff7a2e', '#ff5a2e', '#ff3d2e'][i], rot: a + Math.PI / 2, delay: i * 2, life: 40 }); }
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * 2 * u, vy: Math.sin(a) * 2 * u - u, size: rand(.08, .13) * s, color: '#fff3a8', blink: .8, seed: i, life: 36 }); }
        break;
      case 'treasure': // 90레벨: 금화, 보석, 왕관이 한꺼번에 쏟아진다
        this.rings.push({ x, y, r: s * .2, grow: s * .06 * boost, life: 24, t: 0, color: '#ffd23f', width: s * .09 });
        for (let i = 0; i < 4; i++) { const a = rand(-Math.PI * .85, -Math.PI * .15), v = rand(2.4, 4.4) * u; this.add({ kind: 'coin', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .24 * u, drag: .99, size: rand(.11, .15) * s, color: '#ffd23f', seed: rand(0, TAU), life: 56, floor: y + s * 1.7 }); }
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU), v = rand(1.8, 3.6) * u; this.add({ kind: 'gem', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5 * u, g: .14 * u, size: rand(.12, .17) * s, color: ['#ff5a7a', '#5ac8ff', '#7dffb0', '#c59bff'][i], rot: rand(-.4, .4), vr: rand(-.08, .08), life: 46 }); }
        this.add({ kind: 'crown', x, y, vy: -1.1 * u, drag: .97, size: s * .26, color: '#ffd23f', rot: rand(-.15, .15), popIn: 6, life: 40 });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU), v = rand(.8, 2.4) * u; this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - u, g: .05 * u, drag: .97, size: rand(.07, .12) * s, color: pick(['#fff3a8', '#ffffff']), blink: .7, seed: rand(0, TAU), life: 48 }); }
        break;
      case 'legend': // 99레벨: 무지개 빛기둥이 돌고, 고리 둘과 꼬리 달린 별이 터진다
        this.rings.push({ x, y, r: s * .15, grow: s * .07 * boost, life: 34, t: 0, rainbow: true, width: s * .1 });
        this.rings.push({ x, y, r: s * .1, grow: s * .12, life: 18, t: 0, color: '#ffffff', width: s * .08, delay: 6 });
        for (let i = 0; i < 6; i++) this.add({ kind: 'beam', x, y, rot: i * TAU / 6, vr: .07, off: s * .25, len: s * 1.5, size: s * .09, color: RAINBOW[i], core: '#ffffff', dim: .75, rise: 8, life: 38 });
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + rand(-.1, .1), v = rand(3.5, 5) * u; this.add({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .955, size: rand(.11, .15) * s, color: RAINBOW[i % RAINBOW.length], vr: .15, life: 44, trail: [], trailW: s * .05 }); }
        this.add({ kind: 'glow', x, y, size: s * .34, color: '#ffffff', life: 24 });
        break;
      default: // sparkle
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU), v = rand(1.2, 3) * s / 40 * boost; this.add({ kind: 'sparkle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(0.1, 0.2) * s, color: i % 3 ? light : '#ffffff', life: rand(24, 36) }); }
        this.rings.push({ x, y, r: s * 0.3, grow: s * 0.035, life: 18, t: 0, color: 'rgba(255,255,255,.9)', width: s * 0.06 });
    }
  }

  // 방해뿌요가 사라질 때
  crumble(x, y, size) {
    for (let i = 0; i < 4; i++) { const a = rand(0, TAU), v = rand(1, 2.5) * size / 40; this.add({ kind: 'pixel', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.2 * size / 40, size: rand(0.08, 0.14) * size, color: pick(['#dfe6f5', '#aeb8cf']), life: 30 }); }
  }

  // "3연쇄!" 같은 글자
  text(x, y, text, size, style = {}) {
    this.texts.push({ x, y, text, size, t: 0, life: style.life ?? 64, color: style.color, rainbow: style.rainbow, rise: style.rise ?? 0.35, big: style.big });
  }

  shake(power, frames = 16) { this.shakePower = Math.max(this.shakePower, power); this.shakeT = Math.max(this.shakeT, frames); }
  flash(color = '#fff', frames = 10) { this.flashColor = color; this.flashT = frames; this.flashMax = frames; }
  offset() {
    if (this.shakeT <= 0) return [0, 0];
    const k = this.shakePower * (this.shakeT / 16);
    return [rand(-k, k), rand(-k, k)];
  }

  update() {
    for (const p of this.parts) {
      if (p.delay > 0) { p.delay--; continue; } // 아직 나올 차례가 아니다
      p.t++;
      if (p.grow) p.size *= p.grow;
      if (p.kind === 'orbit') {
        const k = p.t / p.life;
        p.ang += p.spin ?? 0.25;
        p.dist *= p.pull ?? (p.out ? 1.06 : 0.9); // out: 밖으로 퍼지는 회오리 (무지개 폭풍), 아니면 안으로 빨려 든다
        p.x = p.cx + Math.cos(p.ang) * p.dist;
        p.y = p.cy + Math.sin(p.ang) * p.dist;
        if (!p.fade) p.alpha = 1 - k * 0.3; // fade: 다른 알갱이처럼 끝에서 스르르 사라진다
        continue;
      }
      if (p.trail) { p.trail.push(p.x, p.y); if (p.trail.length > (p.tail || 6) * 2) p.trail.splice(0, 2); }
      if (p.kind === 'helix') { // 회오리: 누운 동그라미를 그리며 올라가고 위로 갈수록 넓어진다
        p.ang += p.spin; p.cy -= p.rise; p.rad *= 1.03;
        p.x = p.cx + Math.cos(p.ang) * p.rad;
        p.y = p.cy + Math.sin(p.ang) * p.rad * 0.3;
        continue;
      }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      if (p.wob !== undefined) { p.wob += 0.12; p.x += Math.sin(p.wob) * (p.sway ?? 0.6); if (p.bob) p.y += Math.cos(p.wob) * p.bob; }
      if (p.jit && p.t % 3 === 0) p.x = p.x0 + rand(-p.jit, p.jit); // 지지직: 세 프레임마다 옆으로 튄다
      p.x += p.vx; p.y += p.vy;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -0.45; p.vx *= 0.7; }
      if (p.face) p.rot = Math.atan2(p.vy, p.vx);
      p.rot += p.vr;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const r of this.rings) { if (r.delay > 0) { r.delay--; continue; } r.t++; r.r = Math.max(0, r.r + r.grow); }
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const b of this.bolts) b.t++;
    this.bolts = this.bolts.filter(b => b.t < b.life);
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter(t => t.t < t.life);
    if (this.shakeT > 0) this.shakeT--;
    else this.shakePower = 0;
    if (this.flashT > 0) this.flashT--;
  }

  draw(ctx) {
    ctx.save();
    for (const r of this.rings) {
      if (r.delay > 0) continue;
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      if (r.rainbow) {
        RAINBOW.forEach((col, i) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(r.x, r.y, r.r + i * r.width * 0.55, 0, TAU); ctx.stroke(); });
      } else { ctx.strokeStyle = r.color; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
    }
    for (const b of this.bolts) {
      ctx.globalAlpha = 1 - b.t / b.life;
      ctx.strokeStyle = '#fffbd6'; ctx.lineWidth = Math.max(1.5, b.s * 0.06);
      ctx.shadowColor = '#fff27a'; ctx.shadowBlur = b.s * 0.3;
      let seed = b.seed + Math.floor(b.t / 3);
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let k = 0; k < 3; k++) {
        const a = rnd() * TAU;
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        let px = b.x, py = b.y;
        for (let i = 1; i <= 4; i++) { const d = b.s * 0.35 * i; px = b.x + Math.cos(a) * d + (rnd() - 0.5) * b.s * 0.4; py = b.y + Math.sin(a) * d + (rnd() - 0.5) * b.s * 0.4; ctx.lineTo(px, py); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    for (const p of this.parts) {
      if (p.delay > 0) continue;
      const k = p.t / p.life;
      let alpha = p.alpha ?? (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      if (p.blink) alpha *= 0.55 + 0.45 * Math.sin(p.t * p.blink + (p.seed || 0));
      if (p.dim) alpha *= p.dim;
      ctx.globalAlpha = Math.max(0, alpha);
      if (p.trail && p.trail.length > 2) {
        ctx.strokeStyle = p.trailColor || p.color; ctx.lineWidth = p.trailW || p.size * 0.9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.trail[0], p.trail[1]);
        for (let i = 2; i < p.trail.length; i += 2) ctx.lineTo(p.trail[i], p.trail[i + 1]);
        ctx.lineTo(p.x, p.y);
        ctx.globalAlpha = Math.max(0, alpha * 0.5); ctx.stroke(); ctx.globalAlpha = Math.max(0, alpha);
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const s = p.size * (p.kind === 'sparkle' ? 1 - k * 0.5 : 1) * (p.popIn ? Math.min(1, (p.t + 1) / p.popIn) : 1);
      const shape = p.shape || p.kind;
      if (SHAPES[shape]) SHAPES[shape](ctx, s, p);
      else switch (shape) {
        case 'butterfly':
          for (const sign of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sign * s * .5, 0, s * (.3 + .3 * Math.abs(Math.sin(p.t * .3))), s * .85, sign * .4, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#fff6ca'; ctx.fillRect(-s * .08, -s * .7, s * .16, s * 1.4); break;
        case 'ribbon': ctx.fillRect(-s * .7, -s * .2, s * 1.4, s * .4); break;
        case 'flame':
          ctx.beginPath(); ctx.moveTo(0, -s * 1.5); ctx.quadraticCurveTo(s * 1.4, s, 0, s); ctx.quadraticCurveTo(-s * 1.2, s, 0, -s * 1.5); ctx.fill(); break;
        case 'star': starPath(ctx, s); ctx.fill(); break;
        case 'heart': heartPath(ctx, s); ctx.fill(); break;
        case 'bubble':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.18); ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.25, 0, TAU); ctx.fill();
          break;
        case 'petal': ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, TAU); ctx.fill(); break;
        case 'note':
          ctx.font = `bold ${Math.round(s * 1.6)}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = Math.max(1, s * 0.2); ctx.strokeStyle = 'rgba(30,20,60,.6)'; ctx.strokeText(p.glyph, 0, 0); ctx.fillText(p.glyph, 0, 0);
          break;
        case 'snow':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.15); ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(s * 0.55, 0); ctx.lineTo(s * 0.8, -s * 0.25); ctx.moveTo(s * 0.55, 0); ctx.lineTo(s * 0.8, s * 0.25); ctx.stroke(); }
          break;
        case 'pixel': ctx.fillRect(-s / 2, -s / 2, s, s); break;
        case 'spark': case 'orbit': case 'comet': ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); break;
        default: sparklePath(ctx, s); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // 글자
    for (const t of this.texts) {
      const k = t.t / t.life;
      const pop = t.t < 8 ? 0.4 + (t.t / 8) * 0.8 : t.t < 14 ? 1.2 - ((t.t - 8) / 6) * 0.2 : 1;
      const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const y = t.y - t.t * t.rise * t.size * 0.04;
      ctx.save();
      ctx.translate(t.x, y);
      ctx.scale(pop, pop);
      ctx.globalAlpha = alpha;
      ctx.font = `${Math.round(t.size)}px Jua, 'Noto Sans KR', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.size * 0.22; ctx.strokeStyle = '#2a1640'; ctx.strokeText(t.text, 0, 0);
      let fill = t.color || '#ffe45c';
      if (t.rainbow) {
        const w = ctx.measureText(t.text).width;
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        RAINBOW.forEach((col, i) => g.addColorStop(((i + t.t * 0.05) % RAINBOW.length) / RAINBOW.length, col));
        fill = g;
      } else if (!t.color) {
        const g = ctx.createLinearGradient(0, -t.size / 2, 0, t.size / 2);
        g.addColorStop(0, '#fff6a8'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#ff8a1f');
        fill = g;
      }
      ctx.fillStyle = fill; ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  drawFlash(ctx, w, h) {
    if (this.flashT <= 0) return;
    ctx.save();
    ctx.globalAlpha = (this.flashT / (this.flashMax || 10)) * 0.45;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
