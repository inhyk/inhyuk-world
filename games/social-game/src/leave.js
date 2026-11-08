// 휴가 내기 (인혁 계획 4: "한 달에 휴가가 3개가 생기게 해줘. 그리고 퀘스트 위에 휴가내기 버튼을 만들고 휴가내기 버튼을
// 누르면 오늘 퀘스트가 다 없어지게 해줘."). The button above the quest card, the in-game 네/아니요 question and taking
// the day off. The rules (30-day months, 3 a month, which days, paid leave) are in core.mjs.
import { leaveBlock, leavesLeft, takeLeave, WAGE } from '../core.mjs';

const $ = (id) => document.getElementById(id);

export class Leave {
  /** day: the Day (src/quests.js); more: things that are not on day.g ({ lifts }). */
  constructor(day, more = {}) {
    this.day = day;
    this.more = more;
    this.btn = $('leave-btn');
    this.ask = $('leave-ask');
    this.btn.addEventListener('click', () => this.open());
    $('leave-yes').addEventListener('click', () => this.yes());
    $('leave-no').addEventListener('click', () => this.close(true));
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) this.close(false); });
  }

  get s() { return this.day.s; }
  get kid() { return this.s.mode === 'kid'; }
  get isOpen() { return !this.ask.classList.contains('hidden'); }

  /** Something that must finish first (mini game, flight, seat...). */
  busy() {
    const d = this.day, g = d.g;
    if (g.flight?.active) return '비행기 안에서는 못 해요';
    if (g.driveTest?.active) return '운전면허 시험 중이에요';
    if (g.cinema?.active) return '영화 보는 중이에요';
    if (g.show?.watching) return '공연 보는 중이에요';
    if (g.jobs?.tool || (g.jobs?.ride && g.vehicle?.driving)) return '일하는 차와 장비를 먼저 내려놓아요';
    if (this.more.lifts?.busy) return '엘리베이터가 움직이는 중이에요';
    if (d.busy || d.seat || d._miniFinish || d._ok) return '지금 하는 일을 먼저 끝내요';
    return null;
  }
  /** Why the button is off (null: it is on). */
  reason() { return leaveBlock(this.s, this.day.plan, this.busy()); }

  /** Every frame (from Day.questCard): the button text and on/off. Touches the page only when something changed. */
  render() {
    const left = leavesLeft(this.s), why = this.reason(), kid = this.kid;
    const key = `${left}|${why}|${kid}`;
    if (this._key === key) return;
    this._key = key;
    $('leave-label').textContent = kid ? '🏖️ 하루 쉬기' : '🏖️ 휴가 내기';
    $('leave-n').textContent = `(${left})`;
    $('leave-sub').textContent = why ?? `이번 달 ${kid ? '쉬는 날' : '휴가'} ${left}개 남음`;
    this.btn.disabled = !!why;
    this.btn.title = why ? `${kid ? '하루 쉬기' : '휴가 내기'}: ${why}` : `${kid ? '하루 쉬기' : '휴가 내기'} (O) · 이번 달 ${left}개 남음`;
  }

  /** The button or O: ask first (in the game, not a browser dialog). */
  open() {
    if (this.isOpen) return;
    const why = this.reason();
    if (why) { this.day.g.hud.toast(`🏖️ ${why}`, 2400); this.day.g.sfx('wrong'); return; }
    const left = leavesLeft(this.s), kid = this.kid;
    $('leave-ask-title').textContent = kid ? '🏖️ 하루 쉬기' : '🏖️ 휴가 내기';
    $('leave-ask-text').textContent = kid ? '오늘 학교를 쉴까요?' : '오늘 휴가를 낼까요?';
    $('leave-ask-count').textContent = `이번 달 남은 ${kid ? '쉬는 날' : '휴가'} ${left}개 → ${left - 1}개`;
    $('leave-ask-note').textContent = kid
      ? '오늘 퀘스트가 다 없어지고 마음대로 놀아요. 내일은 다시 학교에 가요.'
      : `오늘 퀘스트가 다 없어지고 마음대로 놀아요. 일당 ${WAGE.toLocaleString('ko-KR')}원은 그대로 받아요 (유급 휴가). 내일은 다시 출근해요.`;
    this.ask.classList.remove('hidden');
    document.exitPointerLock?.();
    this.day.g.sfx('click');
  }
  close(relock) {
    this.ask.classList.add('hidden');
    if (relock) this.day.g.input?.lock();
  }

  /** 네: today's quests all disappear. */
  yes() {
    this.close(true);
    const g = this.day.g, s = this.s;
    const r = takeLeave(s, this.day.plan, this.busy());
    if (!r.ok) { g.hud.toast(`🏖️ ${r.why}`, 2400); g.sfx('wrong'); return; }
    g.jobs?.ensure(); // the job's own things for today (lost child, fire, patrol car) go away
    g.sfx('done');
    g.hud.toast(this.kid ? '🏖️ 오늘은 쉬는 날! 퀘스트가 다 없어졌어요' : '🏖️ 오늘은 휴가! 퀘스트가 다 없어졌어요', 3200);
    if (r.pay) setTimeout(() => { g.sfx('coin'); g.hud.toast(`💰 유급 휴가: 일당 +${r.pay.toLocaleString('ko-KR')}원`, 2800); }, 900);
    this._key = null;
    g.save();
  }
}
