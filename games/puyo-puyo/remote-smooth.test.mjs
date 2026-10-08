// 온라인 상대 필드를 부드럽게 잇기 (remote-smooth.mjs, 인혁이 기획서 「뿌요뿌요 (업그레이드)」 4번)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from './match.mjs';
import { W, H, TIMING } from './core.mjs';
import { RemoteView, snapshot } from './online.mjs';
import { RemoteView as PeerView } from './online-peer.mjs';

const empty = () => Array(W * H).fill(0);
const shot = (y, extra = {}) => ({ t: 's', c: empty(), p: [2, y, 0, 1, 2], n: [1, 1, 2, 2], sc: 0, in: 0, st: 'control', pt: 0, pop: 0, pg: 0, fl: 0, ch: 0, d: 0, ...extra });

test('같은 짝이면 새로 만들지 않고 자리만 고친다 (그리는 쪽이 옆 움직임과 돌리기를 부드럽게 잇는다)', () => {
  const view = new RemoteView(null);
  view.apply(shot(11, { f: 3 }));
  const piece = view.piece;
  view.apply({ ...shot(10.9, { f: 6 }), p: [3, 10.9, 1, 1, 2] });
  assert.equal(view.piece, piece, '같은 객체');
  assert.equal(piece.x, 3);
  assert.equal(piece.rot, 1);
  // 다음 짝(위에서 다시 나옴)은 새 짝
  view.apply({ ...shot(4, { f: 9 }) });
  view.apply({ ...shot(11, { f: 60 }) });
  assert.notEqual(view.piece, piece);
  assert.equal(view.piece.y, 11);
});

test('받은 모습 사이에도 매 프레임 조금씩 내려온다 (뚝뚝 끊기지 않는다)', () => {
  const view = new RemoteView(null);
  const speed = TIMING.gravity; // 보내는 쪽은 한 프레임에 이만큼 내려온다
  let y = 11, frame = 0, biggest = 0, moved = 0;
  view.apply(shot(y, { f: frame }));
  let before = view.piece.y;
  for (let i = 1; i <= 90; i++) {
    y -= speed; frame++;
    if (i % 3 === 0) view.apply(shot(Math.round(y * 100) / 100, { f: frame })); // 3프레임마다 한 번 온다
    view.tick();
    const step = before - view.piece.y;
    if (i > 12) { // 빠르기를 잰 뒤부터
      assert.ok(step > -0.001, `${i}프레임: 뒤로 올라가지 않는다 (${step})`);
      biggest = Math.max(biggest, step);
      if (step > 0.004) moved++;
    }
    before = view.piece.y;
  }
  assert.ok(moved >= 70, `거의 모든 프레임에서 움직인다 (${moved}/78)`);
  assert.ok(biggest < speed * 2.5, `한 번에 크게 뛰지 않는다 (${biggest})`);
  assert.ok(Math.abs(view.piece.y - y) < 0.12, '보낸 자리에서 멀어지지 않는다');
});

test('소식이 끊겨도 바닥 아래로 내려가지 않고, 잠깐만 더 내려오다가 멈춘다', () => {
  const view = new RemoteView(null);
  view.apply(shot(3, { f: 0 }));
  view.apply(shot(2.5, { f: 1 })); // 아래 키로 빠르게 내리는 중
  for (let i = 0; i < 60; i++) view.tick();
  assert.equal(view.piece.y, 0, '빈 필드의 바닥');
  const high = new RemoteView(null);
  high.apply(shot(11, { f: 0 }));
  high.apply(shot(10.9, { f: 3 }));
  for (let i = 0; i < 200; i++) high.tick();
  assert.ok(high.piece.y > 10.5, '소식 없이 끝까지 내려가지 않는다');
});

test('연쇄로 떨어지는 뿌요와 터지는 반짝임도 매 프레임 움직이고, 뒤로 돌아가지 않는다', () => {
  const view = new RemoteView(null);
  view.apply(shot(11, { p: 0, st: 'settle', fl: [[1, 0, 5, 3]] }));
  view.tick(); view.tick();
  const y = view.falling[0].y;
  assert.ok(y < 5);
  view.apply(shot(11, { p: 0, st: 'settle', fl: [[1, 0, 4.9, 3]] })); // 늦게 온 모습
  assert.equal(view.falling[0].y, y, '이미 더 내려간 뿌요는 그대로');
  for (let i = 0; i < 60; i++) view.tick();
  assert.equal(view.falling[0].y, 0);
  view.apply(shot(11, { p: 0, st: 'pop', pt: 30, pop: [0, 1, 2, 3] }));
  view.tick(); view.tick(); view.tick();
  assert.equal(view.timer, 27);
  view.apply(shot(11, { p: 0, st: 'pop', pt: 29, pop: [0, 1, 2, 3] }));
  assert.equal(view.timer, 27);
});

test('방 코드 대전(PeerJS)의 상대 필드도 같이 부드럽다', () => {
  const view = new PeerView(null);
  const cells = '0'.repeat(W * H);
  view.apply({ ...shot(11, { f: 0 }), c: cells });
  const piece = view.piece;
  view.apply({ ...shot(10.9, { f: 3 }), c: cells });
  assert.equal(view.piece, piece);
  view.tick();
  assert.ok(view.piece.y < 11);
});

test('대전(Match)이 상대 필드를 매 프레임 움직인다', () => {
  let remote = null;
  const m = new Match({ seed: 5, specs: [{ kind: 'human' }, { kind: 'remote' }], firstTo: 1, online: 'host', makeRemote: seq => (remote = new RemoteView(seq)) });
  while (m.phase !== 'play') m.step([{}, {}]);
  remote.apply(shot(11, { f: 0 }));
  remote.apply(shot(10.7, { f: 3 }));
  const before = remote.piece.y;
  m.step([{}, {}]);
  assert.ok(remote.piece.y < before);
  // 보내는 쪽 모습에는 예전과 같은 칸만 있다 (프레임 번호 f 는 보낼 때 붙인다)
  assert.equal('f' in snapshot(m.players[0]), false);
});
