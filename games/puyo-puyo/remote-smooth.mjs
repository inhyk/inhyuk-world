// 온라인 상대 필드를 부드럽게 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 4번: "온라인대전에서 상대방 움직임이 느려, 부드럽고 빠르게 해줘").
// 상대 필드 모습은 1초에 20번만 온다. 예전에는 올 때마다 짝을 새로 그려서 뚝뚝 끊겨 보였다.
// 이제는 같은 짝이면 그대로 두고 자리만 고쳐서, 받은 모습 사이를 매 프레임(1초에 60번) 이어서 그린다.
// - 옆으로 옮기기와 돌리기: 같은 짝(piece 객체)이면 그리는 쪽(render.mjs)이 부드럽게 잇는다.
// - 내려오기: 지난번 모습과 견줘 한 프레임에 내려오는 빠르기를 재고, 소식이 올 때까지 그 빠르기로 계속 내려 보낸다.
// - 연쇄로 떨어지는 뿌요와 터지는 반짝임: 자기 필드와 같은 빠르기로 매 프레임 움직인다.
// 관전(watch.mjs)과 방 코드 대전(online-peer.mjs)의 상대 필드도 같이 쓴다.
import { TIMING, restY, W } from './core.mjs';

const LEAD = 8;        // 소식이 늦어도 이만큼(프레임)까지는 같은 빠르기로 내려 보낸다
const FOLLOW = 0.5;    // 예상 자리를 한 프레임에 이만큼씩 따라간다
const KICK = 1.05;     // 돌리다가 한 칸 올라탄 것까지는 같은 짝으로 본다

// 받은 짝(next, 없으면 null)을 상대 필드(view)에 넣는다. frame: 보낸 쪽의 프레임 번호 (없으면 받은 간격으로 잰다)
export function setPiece(view, next, frame) {
  const old = view.piece, pace = view.pace;
  if (!next) { view.piece = null; view.pace = null; return; }
  const same = old && pace && old.a === next.a && old.c === next.c && next.y <= pace.to + KICK;
  if (!same) {
    view.piece = next;
    view.pace = { to: next.y, speed: 0, age: 0, frame: Number.isFinite(frame) ? frame : null };
    return;
  }
  const sent = Number.isFinite(frame) && pace.frame !== null ? frame - pace.frame : 0;
  const frames = sent > 0 && sent < 120 ? sent : Math.max(1, pace.age);
  pace.speed = Math.max(0, Math.min(TIMING.softDrop, (pace.to - next.y) / frames));
  pace.to = next.y; pace.age = 0; pace.frame = Number.isFinite(frame) ? frame : null;
  old.x = next.x; old.rot = next.rot;
  if (next.y > old.y + 0.5) old.y = next.y; // 위로 올라탔으면 바로 맞춘다
}

// 받은 "떨어지는 뿌요"를 넣는다. 화면에서 이미 더 내려간 뿌요는 뒤로 돌아가지 않게 한다.
export function setFalling(view, list) {
  const before = view.falling;
  view.falling = list.map(f => {
    const old = before.find(o => o.x === f.x && o.to === f.to && o.color === f.color);
    return old ? { ...f, y: Math.min(old.y, f.y), v: old.v } : { ...f, v: 0.12 };
  });
}

// 매 프레임 한 번: 받은 모습 사이를 이어서 움직인다
export function tickView(view) {
  const p = view.piece, pace = view.pace;
  if (p && pace && view.state === 'control') {
    pace.age++;
    const floor = p.x >= 0 && p.x < W ? restY(view.h, p.x, p.rot) : 0;
    const expected = Math.max(Number.isFinite(floor) ? floor : 0, pace.to - pace.speed * Math.min(pace.age, LEAD));
    p.y += (expected - p.y) * FOLLOW;
    if (Math.abs(expected - p.y) < 0.004) p.y = expected;
  }
  for (const f of view.falling) {
    if (f.y <= f.to) continue;
    f.v = Math.min(0.75, (f.v ?? 0.12) + 0.045);
    f.y = Math.max(f.to, f.y - f.v);
  }
  if (view.state === 'pop' && view.timer > 0) view.timer--;
}
