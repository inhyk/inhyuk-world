// 방해 뿌요 힘겨루기 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2026-10-10 2번):
// "방해뿌요가 저와 상대와 왔다 갔다 하면 위에서 누구 뿌요가 센지 겨루는 싸움을 하게 해줘 이렇게" + 그림(위쪽 막대 「나 ⚡ 상대」).
// 두 사람이 만든 방해 뿌요(보낸 것 + 상쇄한 것)를 세어서, 막대 가운데 번개 금이 센 쪽에서 약한 쪽으로 밀려간다.
// 화면·소리와 떨어져 있어서 테스트에서도 그대로 돈다.
export const CLASH_MIN = 0.14, CLASH_MAX = 0.86; // 금이 끝까지 밀려도 두 이름은 보이게
export const CLASH_HOLD = 80;                     // 방해 뿌요가 다 떨어진 뒤 이만큼(프레임) 더 보여 주고 끝낸다

// 판 이벤트 → [누구 힘, 얼마]. 힘겨루기와 상관없는 이벤트는 null.
// 온라인 상대가 보낸 방해 뿌요는 send 가 아니라 내 쪽의 incoming 으로만 온다.
export function clashGain(e, specs = []) {
  const amount = Math.max(0, Math.floor(Number(e?.amount) || 0));
  if (!amount || (e.p !== 0 && e.p !== 1)) return null;
  if (e.type === 'send' || e.type === 'offset') return [e.p, amount];
  if (e.type === 'incoming' && specs[1 - e.p]?.kind === 'remote') return [1 - e.p, amount];
  return null;
}

export class Clash {
  constructor() { this.reset(); }
  reset() {
    this.power = [0, 0]; // 이번 힘겨루기에서 두 사람이 만든 방해 뿌요
    this.pos = 0.5;      // 번개 금의 자리 (0 = 맨 왼쪽, 1 = 맨 오른쪽). 내 힘이 세면 오른쪽(상대 쪽)으로 밀린다
    this.live = false; this.idle = 0; this.bump = 0; this.fought = false;
    this.ended = null;   // 방금 끝난 힘겨루기 { winner: 0 | 1 | -1, power } (한 번 읽으면 지운다)
  }
  add(side, amount) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n || (side !== 0 && side !== 1)) return;
    this.power[side] += n;
    this.live = true; this.idle = 0; this.bump = 14;
    if (this.power[0] > 0 && this.power[1] > 0) this.fought = true;
  }
  // 둘 다 방해 뿌요를 만들어서 서로 밀고 있는 중
  get fighting() { return this.live && this.fought; }
  // 지금 누가 더 센지 (같으면 -1)
  get leader() { return this.power[0] === this.power[1] ? -1 : this.power[0] > this.power[1] ? 0 : 1; }
  get target() {
    const sum = this.power[0] + this.power[1];
    return sum ? Math.max(CLASH_MIN, Math.min(CLASH_MAX, this.power[0] / sum)) : 0.5;
  }
  // 매 프레임. busy: 아직 떨어지지 않은 방해 뿌요가 있거나 누가 연쇄 중
  step(busy) {
    this.pos += (this.target - this.pos) * 0.14;
    if (Math.abs(this.target - this.pos) < 0.002) this.pos = this.target;
    if (this.bump > 0) this.bump--;
    if (!this.live) return;
    if (busy) { this.idle = 0; return; }
    if (++this.idle < CLASH_HOLD) return;
    if (this.fought) this.ended = { winner: this.leader, power: this.power.slice() };
    this.power = [0, 0]; this.live = false; this.fought = false; this.idle = 0;
  }
  // 방금 끝난 힘겨루기를 한 번만 돌려준다
  takeEnded() { const e = this.ended; this.ended = null; return e; }
}
