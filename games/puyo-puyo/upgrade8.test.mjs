// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-11)의 규칙.
// 3번 직접 놓아 보는 배우기: "예를 들어 파랑뿌요랑 빨강 뿌요 등을 놓아 연쇄할 수 있게 놓고 실행하면 하나씩 터지며 연쇄가 되면서 배우는 거야!"
//   놓는 동안에는 터지지 않고(hold), 실행(fire)하면 그때 연쇄가 시작된다. 꽉 차도 지지 않는다(sandbox).
// 2번 뿌요 동영상: "빠르고 쉽게 배울 수 있는 뿌요 동영상을 넣어줘" (대본대로 진짜 필드에서 놓아 보인다)
// 1번 스킨: "스킨 많~~~이 넣어줘야" (30가지)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, parseField, fieldRows, idx, SPAWN_X, SPAWN_Y, TIMING } from './core.mjs';
import { Match } from './match.mjs';
import { computeLayout } from './render.mjs';
import { VIDEOS, VideoRun, playVideo, videoSeconds, lengthText, clock, readFrames, getVideo, VIDEO_TIMING, VIDEO_GRAVITY, VIDEO_SEED } from './videos.mjs';
import { SKINS, canBuy, canRedeem } from './shop.mjs';
import { SKIN_IDS, SKIN_STYLE } from './skins.mjs';
import { newProgress, sanitize, MAP_SETTINGS } from './profile.mjs';
import { MAPS, getMap } from './maps.mjs';
import { cloudPayload } from './cloud.mjs';
import { maxProgress, bytes } from './save-size.fixture.mjs';
import { SAVE_MAX_BYTES } from '../../services/net/src/saves.js';

const seqOf = (...pairs) => ({ seed: 0, colors: 4, palette: [1, 2, 3, 4], puyos: pairs.flat() });
function run(p, until, max = 4000, input = {}, ctx = {}) {
  for (let i = 0; i < max; i++) {
    if (until(p)) return i;
    p.step(typeof input === 'function' ? input(p) : input, ctx);
  }
  throw new Error(`시간 초과: ${p.state}`);
}
const events = (p, type) => p.events.filter(e => e.type === type);
// 손에 든 짝을 고른 색으로 바꿔 x 번째 줄에 세워서 떨어뜨린다 (화면에서 색을 고르는 것과 같다)
function place(p, x, bottom, top) {
  run(p, q => q.state === 'control');
  p.piece.a = bottom; p.piece.c = top; p.piece.x = x;
  p.step({ drop: true });
  run(p, q => q.state === 'control' || q.state === 'full');
}
function lab() {
  const p = new Player({ seq: seqOf([1, 1], [2, 2]), timing: { popFrames: 58, chainPause: 26 } });
  p.sandbox = true; p.hold = true;
  p.start();
  return p;
}
const R = 1, G = 2, B = 3;

test('놓는 동안에는 같은 색이 4개 넘게 붙어도 터지지 않는다', () => {
  const p = lab();
  place(p, 0, R, R); place(p, 0, R, R); place(p, 1, R, R);
  assert.deepEqual(fieldRows(p.cells, 3), ['R.....', 'R.....', 'RR....', 'RR....']);
  assert.equal(events(p, 'pop').length, 0);
  assert.equal(events(p, 'chainEnd').length, 0);
  assert.equal(p.hold, true);
  assert.equal(p.score > 0, true); // 떨어뜨린 점수는 그대로
});

test('실행하면 그때 터진다: 빨강이 터지고 떨어진 파랑이 붙어서 2연쇄, 끝나면 다시 잡아 둔다', () => {
  const p = lab();
  // 맨 왼쪽 줄에 아래부터 파랑 파랑 / 파랑 빨강 / 빨강 빨강 / 빨강 파랑
  for (const [bottom, top] of [[B, B], [B, R], [R, R], [R, B]]) place(p, 0, bottom, top);
  assert.deepEqual(fieldRows(p.cells, 7).map(r => r[0]).join(''), 'BRRRRBBB');
  assert.equal(p.fire(), true);
  assert.equal(p.piece, null); // 손에 든 짝은 내려놓지 않고 치운다
  assert.equal(p.hold, false); assert.equal(p.fired, true);
  const frames = run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'pop').map(e => [e.chain, e.colors, e.puyos]), [[1, [R], 4], [2, [B], 4]]);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 2 }]);
  assert.deepEqual(events(p, 'chainEnd').map(e => e.chain), [2]);
  assert.equal(p.cells.some(Boolean), false);
  assert.equal(p.hold, true); assert.equal(p.fired, false);
  // 하나씩 터지는 것이 보이게 천천히: 한 번 터지는 데 58프레임, 다음 연쇄까지 26프레임을 더 쉰다
  assert.ok(frames >= 58 * 2 + 26, `${frames}프레임`);
  assert.ok(TIMING.popFrames < 58 && TIMING.chainPause < 26);
  // 그 뒤에 다시 놓는 것도 터지지 않는다
  p.events.length = 0;
  for (let i = 0; i < 2; i++) place(p, 4, G, G);
  assert.equal(events(p, 'pop').length, 0);
  assert.deepEqual(fieldRows(p.cells, 3).map(r => r[4]).join(''), 'GGGG');
});

test('터질 것이 없을 때 실행하면 0연쇄로 끝나고 필드는 그대로', () => {
  const p = lab();
  place(p, 0, R, G); place(p, 1, B, R);
  const before = p.cells.slice();
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 0 }]);
  assert.deepEqual(p.cells, before);
  assert.equal(events(p, 'pop').length, 0);
  assert.equal(p.hold, true);
  run(p, q => q.state === 'control'); // 새 짝이 나온다
});

test('실행은 짝을 들고 있을 때(또는 꽉 찼을 때)만 된다', () => {
  const p = lab();
  assert.equal(p.fire(), false); // 아직 짝이 나오기 전
  run(p, q => q.state === 'control');
  p.piece.x = 0; p.step({ drop: true }); // 떨어지는 중
  assert.notEqual(p.state, 'control');
  assert.equal(p.fire(), false);
  run(p, q => q.state === 'control');
  assert.equal(p.fire(), true);
  assert.equal(p.fire(), false); // 터지는 중에 또 누름
});

test('필드가 꽉 차도 지지 않고 기다린다. 그대로 실행하면 터지고 다시 놓을 수 있다', () => {
  const p = lab();
  // 뿌요가 나오는 셋째 줄을 꼭대기까지 채운다 (같은 색 4개가 이어지지 않게 두 색을 번갈아)
  for (let i = 0; i < 6; i++) place(p, SPAWN_X, i % 2 ? G : R, i % 2 ? G : R);
  assert.equal(p.state, 'full');
  assert.equal(p.dead, false);
  assert.equal(events(p, 'dead').length, 0);
  assert.equal(events(p, 'full').length, 1);
  assert.notEqual(p.cells[idx(SPAWN_X, SPAWN_Y)], 0);
  for (let i = 0; i < 30; i++) p.step({ drop: true, left: true }); // 기다리는 동안에는 아무것도 움직이지 않는다
  assert.equal(p.state, 'full');
  // 보통 판(sandbox 가 아님)에서는 예전처럼 진다
  const normal = new Player({ seq: seqOf([1, 2]) });
  normal.cells.set(p.cells); normal.refreshHeights(); normal.start();
  run(normal, q => q.dead);
  assert.equal(events(normal, 'dead').length, 1);
  // 꽉 찬 채로 실행: 터질 것이 없으면 그대로 꽉 차 있다
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  run(p, q => q.state === 'full' || q.state === 'control');
  assert.equal(p.state, 'full');
});

test('방해 뿌요도 놓을 수 있다: 저희끼리는 안 터지고, 옆에서 같은 색 4개를 터뜨리면 같이 사라진다', () => {
  const p = lab(), O = 6;
  // 방해 뿌요만 여덟 개를 붙여 놓아도 터질 것이 없다
  place(p, 4, O, O); place(p, 4, O, O); place(p, 5, O, O); place(p, 5, O, O);
  assert.deepEqual(fieldRows(p.cells, 3), ['....OO', '....OO', '....OO', '....OO']);
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 0 }]);
  assert.equal(p.cells.filter(v => v === O).length, 8);
  // 맨 왼쪽 줄에 아래부터 방해, 빨강 넷, 방해: 실행하면 빨강 4개와 위아래의 방해 뿌요 2개가 같이 사라진다
  p.events.length = 0;
  place(p, 0, O, R); place(p, 0, R, R); place(p, 0, R, O);
  assert.deepEqual(fieldRows(p.cells, 5).map(r => r[0]).join(''), 'ORRRRO');
  assert.equal(events(p, 'pop').length, 0);
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'pop').map(e => [e.chain, e.colors, e.puyos, e.garbage]), [[1, [R], 4, 2]]);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 1 }]);
  assert.deepEqual(fieldRows(p.cells, 3), ['....OO', '....OO', '....OO', '....OO']); // 멀리 있는 방해 뿌요는 그대로
});

test('맵을 고를 수 있다: 고른 맵은 저장되고, 쫀득 연구소에서는 같은 색 6개가 붙어야 터진다', () => {
  assert.ok(MAP_SETTINGS.includes('labMap'));
  assert.equal(newProgress().settings.labMap, 'garden');
  const old = newProgress(); delete old.settings.labMap;
  assert.equal(sanitize(old).settings.labMap, 'garden');            // 예전 저장
  const odd = newProgress(); odd.settings.labMap = '없는맵';
  assert.equal(sanitize(odd).settings.labMap, 'garden');
  const mine = newProgress(); mine.settings.labMap = 'six';
  assert.equal(sanitize(JSON.parse(JSON.stringify(mine))).settings.labMap, 'six');
  assert.deepEqual(MAPS.map(map => map.minGroup), [4, 4, 4, 4, 4, 6]);
  assert.equal(getMap('six').name, '쫀득 연구소');
  // 쫀득 연구소: 빨강 4개, 5개로는 실행해도 터지지 않고 6개가 되면 터진다
  const p = lab();
  p.minGroup = getMap('six').minGroup;
  place(p, 0, R, R); place(p, 0, R, R);
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 0 }]);
  place(p, 1, R, G);
  p.events.length = 0;
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 0 }]); // 5개
  place(p, 1, G, R); // 둘째 줄이 아래부터 빨강, 초록, 초록, 빨강: 맨 위 빨강이 맨 왼쪽 줄의 빨강과 붙어서 6개
  p.events.length = 0;
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'pop').map(e => [e.chain, e.puyos]), [[1, 6]]);
  // 맵을 뿌요 정원으로 바꾸면(4개) 놓아 둔 것이 그대로 4개 규칙으로 터진다
  const q = lab();
  q.minGroup = 6;
  place(q, 3, B, B); place(q, 3, B, B);
  q.minGroup = getMap('garden').minGroup;
  assert.equal(q.fire(), true);
  run(q, x => events(x, 'fireEnd').length > 0);
  assert.deepEqual(events(q, 'fireEnd'), [{ type: 'fireEnd', chain: 1 }]);
});

test('보통 판은 그대로: hold 가 아니면 놓자마자 터진다', () => {
  const p = new Player({ seq: seqOf([1, 1], [1, 1], [2, 2]) });
  p.start();
  for (let i = 0; i < 2; i++) { run(p, q => q.state === 'control'); p.piece.x = 0; p.step({ drop: true }); }
  run(p, q => q.state === 'control');
  assert.equal(events(p, 'pop').length, 1);
  assert.equal(events(p, 'fireEnd').length, 0);
  assert.equal(p.cells.some(Boolean), false);
});

test('직접 놓아 보는 배우기는 많이 놓아도 떨어지는 속도가 빨라지지 않는다', () => {
  const steady = new Match({ specs: [{ kind: 'human' }], solo: true, gravityScale: 0.6, steady: true });
  const endless = new Match({ specs: [{ kind: 'human' }], solo: true, gravityScale: 0.6 });
  const base = steady.gravity();
  assert.equal(endless.gravity(), base);
  steady.players[0].stats.pieces = 200; endless.players[0].stats.pieces = 200;
  assert.equal(steady.gravity(), base);
  assert.ok(endless.gravity() > base * 2);
});

test('필드 옆 칸(놓을 뿌요, 단추)이 들어갈 자리: 혼자 하는 배치의 오른쪽 3.9칸이 화면 안에 있다', () => {
  for (const [w, h, top, bottom] of [[1280, 720, 150, 8], [390, 844, 140, 104], [844, 390, 110, 6], [768, 1024, 150, 104]]) {
    const l = computeLayout(w, h, { solo: true, insets: { top, bottom, left: 8, right: 8 } });
    const f = l.fields[0], c = f.cell;
    assert.ok(f.x + c * 6.4 + c * 3.9 <= w - 4, `${w}x${h} 오른쪽`);
    assert.ok(f.y - c * 0.3 >= top - c, `${w}x${h} 위`);
  }
});

test('parseField 로 만든 모양도 실행하면 연쇄 수가 맞다 (3연쇄 계단)', () => {
  const p = lab();
  run(p, q => q.state === 'control');
  p.cells.set(parseField(['GB....', 'RGB...', 'RGB...', 'RRGB..']));
  p.refreshHeights();
  assert.equal(p.fire(), true);
  run(p, q => events(q, 'fireEnd').length > 0);
  assert.deepEqual(events(p, 'fireEnd'), [{ type: 'fireEnd', chain: 3 }]);
  assert.deepEqual(events(p, 'pop').map(e => e.chain), [1, 2, 3]);
  assert.equal(events(p, 'allClear').length, 1);
});

// ---------- 2번: 뿌요 동영상 ----------
test('동영상 여섯 편: 그림처럼 첫 편은 「연쇄 잘하는 법」, 목록에는 「연쇄 잘하는 법은?」과 「대전 방법」', () => {
  assert.equal(VIDEOS.length, 6);
  assert.equal(new Set(VIDEOS.map(v => v.id)).size, 6);
  assert.deepEqual(VIDEOS.slice(0, 2).map(v => [v.title, v.ask]), [['연쇄 잘하는 법', '연쇄 잘하는 법은?'], ['대전 방법', '대전 방법']]);
  for (const v of VIDEOS) {
    assert.ok(v.title && v.ask && v.desc && v.emoji, v.id);
    assert.ok(v.keep.length >= 3 && v.keep.length <= 4, `${v.id} 외울 것`);
    assert.ok(v.scenes.length >= 5, v.id);
    assert.ok(v.scenes[0].say && v.scenes.at(-1).say && !v.scenes.at(-1).put, `${v.id} 시작과 끝은 말로`);
    for (const scene of v.scenes) {
      if (scene.say) assert.ok([...scene.say].length <= 72, `${v.id} 자막이 너무 길다: ${scene.say}`);
      if (scene.put) { assert.equal(scene.put.length, 2); assert.ok(scene.put.every(c => c >= 1 && c <= 5)); assert.ok(scene.at[0] >= 0 && scene.at[0] <= 5 && [0, 1, 2, 3].includes(scene.at[1])); }
    }
    assert.equal(getVideo(v.id), v);
  }
  assert.equal(getVideo('없는영상'), null);
});

test('동영상을 끝까지 틀면 대본에 적은 연쇄가 그대로 나온다 (빠르고 쉽게: 한 편에 30초~1분 30초)', () => {
  const chains = {};
  for (const v of VIDEOS) {
    const r = playVideo(v);
    const by = type => r.events.filter(e => e.type === type);
    assert.equal(r.done, true, v.id);
    assert.equal(by('full').length, 0, `${v.id} 꽉 차지 않는다`);
    assert.equal(by('dead').length, 0);
    assert.equal(r.incoming, 0, `${v.id} 예고된 방해 뿌요가 남지 않는다`);
    chains[v.id] = by('chainEnd').map(e => e.chain);
    assert.equal(Math.max(...chains[v.id]), v.chain, `${v.id} 가장 긴 연쇄`);
    // 가장 긴 연쇄는 마지막으로 놓는 장면에서 일어난다
    const lastPut = v.scenes.findLastIndex(scene => scene.put);
    assert.equal(by('chainEnd').at(-1).scene, lastPut, `${v.id} 발화는 마지막 짝`);
    const seconds = videoSeconds(v);
    assert.equal(seconds, Math.ceil(r.frames / 60));
    assert.ok(seconds >= 25 && seconds <= 90, `${v.id} ${seconds}초`);
  }
  assert.deepEqual(chains, { chain: [3], battle: [1, 3], move: [1], stairs: [6], sandwich: [3], allclear: [2] });
});

test('「대전 방법」: 방해 뿌요 6개가 떨어지고, 옆에서 터뜨리면 사라지고, 예고된 12개는 3연쇄로 모두 상쇄된다', () => {
  const v = getVideo('battle'), r = playVideo(v);
  const by = type => r.events.filter(e => e.type === type);
  assert.deepEqual(by('garbage').map(e => e.count), [6]);           // 처음 예고한 6개만 떨어진다
  assert.deepEqual(by('incoming').map(e => e.amount), [6, 12]);
  const first = by('pop')[0];
  assert.equal(first.garbage, 2);                                     // 빨강 4개 옆의 방해 뿌요 2개가 같이 사라진다
  const offsets = by('offset').map(e => e.amount);
  assert.equal(offsets.reduce((a, b) => a + b, 0), 12);               // 12개를 모두 상쇄
  assert.ok(offsets.some(n => n >= 6), '화면에 「상쇄!」가 뜨는 크기');
  assert.equal(r.cells.some(Boolean), false);                         // 끝나면 필드가 비어 있다
});

test('「전소를 노려 봐」는 전소로 끝나고, 「뿌요 움직이는 법」은 눕히기와 뒤집기를 보여 준다', () => {
  const all = playVideo(getVideo('allclear'));
  assert.equal(all.events.filter(e => e.type === 'allClear').length, 1);
  assert.equal(all.cells.some(Boolean), false);
  const move = getVideo('move');
  assert.deepEqual(move.scenes.filter(s => s.put).map(s => s.at[1]), [0, 1, 2, 1]); // 세워서, 눕혀서, 뒤집어서, 눕혀서
  const r = playVideo(move);
  assert.equal(r.events.filter(e => e.type === 'rotate').length >= 4, true);
  assert.equal(r.events.filter(e => e.type === 'move').length >= 4, true);
});

test('동영상은 볼 때마다 똑같고, 자막을 읽는 동안에는 손에 든 짝이 떨어지지 않는다', () => {
  for (const v of VIDEOS.slice(0, 3)) {
    const a = playVideo(v), b = playVideo(v);
    assert.equal(a.frames, b.frames);
    assert.deepEqual(a.events.map(e => `${e.frame}:${e.type}`), b.events.map(e => `${e.frame}:${e.type}`));
  }
  // 화면에서 트는 것과 같은 순서로 한 프레임씩
  const match = new Match({ seed: VIDEO_SEED, specs: [{ kind: 'human' }], solo: true, steady: true, gravityScale: VIDEO_GRAVITY, timing: VIDEO_TIMING });
  const p = match.players[0];
  p.sandbox = true; match.phase = 'play'; match.timer = 0; p.start();
  const run = new VideoRun(VIDEOS[0]);
  let captions = 0, shown = 0, frozenFrames = 0;
  while (!run.done && run.frames < 60 * 300) {
    const input = run.step(p);
    match.gravityScale = run.frozen ? 0 : VIDEO_GRAVITY;
    const before = p.state === 'control' && p.piece ? p.piece.y : null;
    match.step([input]);
    match.events.length = 0;
    if (run.frozen && before !== null && p.state === 'control' && p.piece) { assert.equal(p.piece.y, before); frozenFrames++; }
    if (run.captionNo !== shown) { shown = run.captionNo; captions++; assert.equal(run.caption, VIDEOS[0].scenes[run.index].say); }
  }
  assert.equal(captions, VIDEOS[0].scenes.filter(s => s.say).length);
  assert.ok(frozenFrames > 600);
  assert.deepEqual(run.step(p), {}); // 끝난 뒤에는 아무것도 누르지 않는다
});

test('동영상 길이와 시계 글자', () => {
  assert.equal(lengthText(82), '1분 22초'); // 그림의 길이 표시와 같은 모양
  assert.equal(lengthText(60), '1분'); assert.equal(lengthText(48), '48초');
  assert.equal(clock(0), '0:00'); assert.equal(clock(82.9), '1:22'); assert.equal(clock(9), '0:09');
  assert.ok(readFrames('긴 자막은 더 오래 보여 준다') > readFrames('짧게'));
  assert.equal(readFrames(''), 80);
  assert.deepEqual(VIDEOS.map(v => lengthText(videoSeconds(v))).every(t => /^(\d분( \d+초)?|\d+초)$/.test(t)), true);
});

// ---------- 1번: 스킨 많이 ----------
const NEW_COIN = ['balloon', 'hamster', 'mouse', 'duck', 'glasses', 'chef', 'onigiri', 'owl', 'monkey', 'cow', 'sheep', 'cowboy', 'clown', 'lion', 'elephant', 'present',
  'deer', 'princess', 'hedgehog', 'headphone', 'turtle', 'santa', 'crab', 'vampire', 'jellyfish', 'mummy', 'hero', 'dice'];
const NEW_LEVEL = ['ice', 'rainbow'];
test('새 스킨 30가지: 코인 스킨 28가지와 레벨 스킨 2가지(45·65레벨)가 상점에 있고 그림도 있다 (모두 87종)', () => {
  assert.equal(NEW_COIN.length + NEW_LEVEL.length, 30);
  assert.equal(SKINS.length, 87);
  assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length);
  assert.equal(new Set(SKINS.map(s => s.name)).size, SKINS.length);
  for (const id of [...NEW_COIN, ...NEW_LEVEL]) {
    const item = SKINS.find(s => s.id === id);
    assert.ok(item, id);
    assert.ok(SKIN_IDS.includes(id), `${id} 그림`);
    assert.equal(SKIN_STYLE[id].connect, false);
    assert.ok(item.name.endsWith('뿌요') && item.desc.length > 5, id);
  }
  for (const id of NEW_COIN) { const item = SKINS.find(s => s.id === id); assert.ok(item.price >= 500 && item.price <= 4000 && item.level <= 20 && !item.noTicket, id); }
  assert.deepEqual(NEW_LEVEL.map(id => { const item = SKINS.find(s => s.id === id); return [item.level, item.noTicket]; }), [[45, true], [65, true]]);
  for (const item of SKINS) assert.ok(SKIN_IDS.includes(item.id), `${item.id} 그림 없음`);
});

test('새 레벨 스킨(얼음, 무지개)은 그 레벨이 되어야 사고 교환권으로는 못 받는다. 스킨을 다 모아도 저장은 한도의 반 안쪽', () => {
  const p = newProgress();
  Object.assign(p, { level: 44, coins: 999999 }); p.tickets.skin = 5;
  assert.equal(canBuy(p, 'skin', 'ice'), 'level');
  p.level = 45;
  assert.equal(canBuy(p, 'skin', 'ice'), 'ok');
  assert.equal(canRedeem(p, 'skin', 'ice'), false);
  assert.equal(canBuy(p, 'skin', 'rainbow'), 'level');
  assert.equal(canRedeem(p, 'skin', 'lion'), true);
  const full = maxProgress({ social: false });
  for (const s of SKINS) assert.ok(full.owned.skin.includes(s.id), `${s.id} (save-size.fixture)`);
  assert.ok(bytes(cloudPayload(full)) < SAVE_MAX_BYTES / 2, `저장 ${bytes(cloudPayload(full))}바이트`);
});

