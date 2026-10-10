// 방해 뿌요 힘겨루기 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2026-10-10 2번):
// "방해뿌요가 저와 상대와 왔다 갔다 하면 위에서 누구 뿌요가 센지 겨루는 싸움을 하게 해줘 이렇게" + 그림(위쪽 막대 「나 ⚡ 상대」).
// 한 판 내내 이어지는 줄다리기: 두 사람이 만든 방해 뿌요(보낸 것 + 상쇄한 것)를 세어서, 더 많이 만든 만큼
// 막대 가운데 번개 금이 약한 쪽으로 밀려간다. 조금 앞서면 조금만 움직이고, 운석 하나만큼 앞서야 끝까지 간다.
// (처음에는 주고받기 한 번이 끝날 때마다 승패를 말했는데, 인혁이가 "상대한테 조금이라도 방해뿌요가 가면 나 승!이라고 나와"라고 해서 바꿨다.)
// 화면·소리와 떨어져 있어서 테스트에서도 그대로 돈다.
export const CLASH_MIN = 0.14, CLASH_MAX = 0.86; // 금이 끝까지 밀려도 두 이름은 보이게
export const CLASH_FULL = 30;  // 이만큼(운석 하나) 앞서면 금이 끝까지 간다
export const CLASH_HOLD = 45;  // 끝까지 민 채로 방해 뿌요가 다 떨어지고 이만큼(프레임) 지나면 이긴 것
export const CLASH_HOT = 180;  // 방해 뿌요를 만든 뒤 이만큼(프레임) 동안은 "밀고 있는 중"

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
  // 판이 시작할 때
  reset() {
    this.power = [0, 0]; // 이번 판에서 두 사람이 만든 방해 뿌요
    this.pos = 0.5;      // 번개 금의 자리 (0 = 맨 왼쪽, 1 = 맨 오른쪽). 내가 앞서면 오른쪽(상대 쪽)으로 밀린다
    this.hot = [0, 0];   // 방금 방해 뿌요를 만들었는지 (남은 프레임)
    this.idle = 0; this.bump = 0;
    this.won = -1;       // 마지막으로 「승!」을 알린 쪽 (다시 팽팽해지면 -1)
    this.ended = null;   // 방금 난 승부 { winner: 0 | 1, lead } (한 번 읽으면 지운다)
  }
  add(side, amount) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n || (side !== 0 && side !== 1)) return;
    this.power[side] += n;
    this.hot[side] = CLASH_HOT; this.bump = 14;
    this.idle = 0; // 방금 만든 방해 뿌요가 떨어질 때까지는 승부를 미룬다
  }
  // 내가 상대보다 얼마나 더 만들었는지 (상대가 앞서면 음수)
  get lead() { return this.power[0] - this.power[1]; }
  // 지금 누가 앞서는지 (같으면 -1)
  get leader() { return this.lead === 0 ? -1 : this.lead > 0 ? 0 : 1; }
  // 두 사람 모두 방금 방해 뿌요를 만들어서 서로 밀고 있는 중
  get fighting() { return this.hot[0] > 0 && this.hot[1] > 0; }
  get target() { return 0.5 + (CLASH_MAX - 0.5) * Math.max(-1, Math.min(1, this.lead / CLASH_FULL)); }
  // 매 프레임. busy: 아직 떨어지지 않은 방해 뿌요가 있거나 누가 연쇄 중
  step(busy) {
    this.pos += (this.target - this.pos) * 0.14;
    if (Math.abs(this.target - this.pos) < 0.002) this.pos = this.target;
    if (this.bump > 0) this.bump--;
    for (const i of [0, 1]) if (this.hot[i] > 0) this.hot[i]--;
    const lead = Math.abs(this.lead);
    if (lead < CLASH_FULL * 0.75) this.won = -1; // 다시 팽팽해졌다
    this.idle = busy ? 0 : this.idle + 1;
    // 끝까지 밀었고, 받아칠 방해 뿌요도 연쇄도 남지 않았을 때만 이긴 것 (떨어지기 전에 상대가 받아치면 금이 돌아온다)
    if (lead >= CLASH_FULL && this.idle >= CLASH_HOLD && this.won !== this.leader) {
      this.won = this.leader;
      this.ended = { winner: this.leader, lead };
    }
  }
  // 방금 난 승부를 한 번만 돌려준다
  takeEnded() { const e = this.ended; this.ended = null; return e; }
}
