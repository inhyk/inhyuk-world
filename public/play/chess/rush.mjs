// 퍼즐 러시 규칙: 점점 어려워지는 퍼즐을 시간 안에 많이 푼다. 틀리면 ✕, ✕ 3개면 끝.
export const RUSH = {
  180: { label: '3분', time: 180 },
  300: { label: '5분', time: 300 },
  survival: { label: '서바이벌', time: 0 },
};
export const STRIKES = 3;

// k 번째(0부터) 퍼즐의 목표 점수
export function targetRating(k) {
  return Math.min(2900, 550 + k * 60 + Math.floor(k / 10) * 40);
}

export class RushRun {
  constructor(mode, now = Date.now()) {
    if (!RUSH[mode]) throw Error('bad rush mode');
    this.mode = mode;
    this.limit = RUSH[mode].time * 1000;
    this.startedAt = now;
    this.results = [];     // { ok, rating, id }
    this.over = false;
    this.reason = '';
  }
  get score() { return this.results.filter(r => r.ok).length; }
  get strikes() { return this.results.filter(r => !r.ok).length; }
  get next() { return this.results.length; }
  timeLeft(now = Date.now()) {
    if (!this.limit) return Infinity;
    return Math.max(0, this.limit - (now - this.startedAt));
  }
  // 시간이 끝났는지 확인한다. 끝났으면 true
  check(now = Date.now()) {
    if (!this.over && this.limit && this.timeLeft(now) <= 0) { this.over = true; this.reason = 'time'; }
    return this.over;
  }
  record(puzzle, ok, now = Date.now()) {
    if (this.check(now)) return false;
    this.results.push({ ok: !!ok, rating: puzzle.rating ?? 0, id: puzzle.id });
    if (this.strikes >= STRIKES) { this.over = true; this.reason = 'strikes'; }
    return true;
  }
  stop() { if (!this.over) { this.over = true; this.reason = 'quit'; } }
}
