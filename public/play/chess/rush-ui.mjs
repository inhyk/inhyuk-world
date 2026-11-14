// 퍼즐 러시 화면. 3분, 5분, 서바이벌(시간 없음). 틀리면 ✕, ✕ 3개면 끝.
import { PuzzleSession } from './puzzles.mjs';
import { boardHTML, promotionHTML } from './board.mjs';
import { RUSH, RushRun, STRIKES, targetRating } from './rush.mjs';

const $ = s => document.querySelector(s);
const clockText = ms => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export class RushUI {
  // best(mode): 최고 기록, record(mode, score): 새 기록이면 true
  constructor({ bank, best, record, sound }) {
    this.bank = bank; this.best = best; this.record = record; this.sound = sound;
    this.active = false; this.mode = '180'; this.run = null; this.session = null;
    this.selected = null; this.promote = null; this.flipped = false; this.busy = false;
    this.used = new Set(); this.preload = null; this.token = 0; this.timer = 0; this.lastRun = null;
    $('#rush-modes').onclick = e => { const b = e.target.closest('[data-rush]'); if (b && !this.running) { this.mode = b.dataset.rush; this.render(); } };
    $('#rush-start').onclick = () => this.start();
    $('#rush-again').onclick = () => this.start();
    $('#rush-menu').onclick = () => { this.lastRun = null; this.render(); };
    $('#rush-quit').onclick = () => this.finish('quit');
  }

  get running() { return !!this.run && !this.run.over; }

  enter() { this.active = true; this.render(); }
  exit() {
    if (this.running) this.finish('quit');
    this.active = false; this.selected = null; this.promote = null;
    $('#promotion').classList.add('hidden');
  }

  async start() {
    this.run = new RushRun(this.mode);
    this.lastRun = null; this.used.clear(); this.preload = null;
    this.message = '첫 퍼즐을 불러오는 중…'; this.messageKind = '';
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 200);
    this.render();
    await this.loadNext();
  }

  fetchPuzzle(k) {
    const pick = async () => {
      for (let tries = 0; tries < 5; tries++) {
        const { puzzle } = await this.bank.near(targetRating(k));
        if (!this.used.has(puzzle.id) || tries === 4) { this.used.add(puzzle.id); return puzzle; }
      }
      return null;
    };
    const promise = pick();
    promise.catch(() => {});
    return promise;
  }

  async loadNext() {
    const run = this.run, k = run.next, token = ++this.token;
    this.session = null; this.selected = null; this.promote = null;
    $('#promotion').classList.add('hidden');
    this.render();
    let puzzle = null;
    try { puzzle = await (this.preload?.k === k ? this.preload.promise : this.fetchPuzzle(k)); } catch { puzzle = null; }
    if (token !== this.token || run !== this.run || run.over) return;
    if (!puzzle) { this.message = '퍼즐을 불러오지 못했어. 인터넷 연결을 확인해 줘.'; this.messageKind = 'wrong'; this.finish('error'); return; }
    this.session = new PuzzleSession(puzzle);
    this.flipped = this.session.player === 'b';
    this.busy = false;
    this.message = `${this.session.player === 'w' ? '백' : '흑'} 차례 · ${puzzle.goal === 'mate' ? '체크메이트를 찾아!' : '가장 좋은 수를 찾아!'}`;
    this.messageKind = '';
    this.preload = { k: k + 1, promise: this.fetchPuzzle(k + 1) };
    this.render();
  }

  tick() {
    if (!this.run) return;
    if (!this.run.over && this.run.check()) { this.finish('time'); return; }
    if (this.active) this.renderTimer();
  }

  finish(reason) {
    const run = this.run;
    if (!run) return;
    clearInterval(this.timer);
    if (!run.over) { if (reason === 'quit' || reason === 'error') run.stop(); }
    this.token++;
    const newBest = run.score > 0 && this.record(run.mode, run.score);
    this.lastRun = { run, newBest, reason: run.reason || reason };
    this.run = null; this.session = null; this.selected = null; this.promote = null;
    $('#promotion').classList.add('hidden');
    this.sound?.(newBest ? 'win' : 'end');
    this.render();
  }

  renderTimer() {
    const run = this.run;
    if (!run) return;
    const left = run.timeLeft();
    $('#rush-timer').textContent = run.limit ? clockText(left) : '∞';
    $('#rush-timer').classList.toggle('low', run.limit && left < 15000);
    $('#clock-bottom').textContent = run.limit ? clockText(left) : '∞';
    $('#clock-bottom').classList.toggle('active', true);
  }

  render() {
    if (!this.active) return;
    const run = this.run, over = this.lastRun;
    for (const b of document.querySelectorAll('#rush-modes [data-rush]')) b.classList.toggle('selected', b.dataset.rush === this.mode);
    $('#rush-best').textContent = this.best(this.mode);
    $('#rush-setup').hidden = !!run || !!over;
    $('#rush-live').hidden = !run;
    $('#rush-over').hidden = !over || !!run;
    const results = (run || over?.run)?.results ?? [];
    const list = results.map(r => `<span class="${r.ok ? 'ok' : 'bad'}" title="${r.rating}점">${r.ok ? '✓' : '✕'}</span>`).join('');
    if (run) {
      $('#rush-score').textContent = run.score;
      $('#rush-strikes').innerHTML = Array.from({ length: STRIKES }, (_, i) => `<span class="${i < run.strikes ? 'hit' : ''}">✕</span>`).join('');
      $('#rush-msg').textContent = this.message;
      $('#rush-msg').className = 'puzzle-feedback ' + (this.messageKind || '');
      $('#rush-results').innerHTML = list;
      this.renderTimer();
    }
    if (over) {
      const r = over.run;
      $('#rush-final').textContent = r.score;
      $('#rush-final-note').textContent = `${RUSH[r.mode].label} · ${over.reason === 'time' ? '시간 끝!' : over.reason === 'strikes' ? '✕ 3개!' : '그만했어'}${over.newBest ? ' · 🎉 새 최고 기록!' : ` · 최고 기록 ${this.best(r.mode)}`}`;
      $('#rush-final-list').innerHTML = list || '<small>푼 퍼즐이 없어.</small>';
      const top = results.filter(x => x.ok).reduce((m, x) => Math.max(m, x.rating), 0);
      $('#rush-final-top').textContent = top ? `가장 어려웠던 정답: ${top}점 퍼즐` : '';
    }
    const p = this.session?.puzzle;
    $('#opponent-name').textContent = `퍼즐 러시 · ${RUSH[run?.mode ?? over?.run.mode ?? this.mode].label}`;
    $('#opponent-sub').textContent = p ? `이번 퍼즐 ${p.rating}점` : run ? '퍼즐 준비 중' : '점점 어려워져요';
    $('#my-name').textContent = this.session ? `${this.session.player === 'w' ? '백' : '흑'}으로 도전` : '나의 도전';
    $('#my-sub').textContent = run ? `점수 ${run.score} · ✕ ${run.strikes}` : `최고 기록 ${this.best(this.mode)}`;
    $('#clock-top').textContent = run ? String(run.score) : '—';
    $('#clock-top').classList.remove('active');
    if (!run) { $('#clock-bottom').textContent = RUSH[this.mode].time ? clockText(RUSH[this.mode].time * 1000) : '∞'; $('#clock-bottom').classList.remove('active'); }
    $('#board-caption').textContent = run ? '틀리면 바로 다음 퍼즐로 넘어가요. 빠르게!' : '시작을 누르면 시간이 흘러요.';
    this.renderBoard();
  }

  renderBoard() {
    const s = this.session;
    if (!s) {
      $('#board').innerHTML = this.run ? '<div class="board-loading">퍼즐 준비 중…</div>' : '<div class="board-loading rush-cover"><b>⚡</b>퍼즐 러시</div>';
      return;
    }
    const g = s.game;
    $('#board').innerHTML = boardHTML(g, { flipped: this.flipped, selected: this.selected, legal: this.selected ? g.moves({ square: this.selected, verbose: true }) : [], last: s.lastMove });
  }

  click(e) {
    const b = e.target.closest('[data-square]'), s = this.session;
    if (!b || !s || this.busy || this.promote || !this.running) return;
    const sq = b.dataset.square;
    if (this.selected) {
      const moves = s.game.moves({ square: this.selected, verbose: true }).filter(m => m.to === sq);
      if (moves.length) {
        if (moves[0].promotion) {
          this.promote = { from: this.selected, to: sq };
          $('#promotion').innerHTML = promotionHTML(s.player);
          $('#promotion').classList.remove('hidden');
        } else this.move({ from: this.selected, to: sq });
        return;
      }
    }
    this.selected = s.game.get(sq)?.color === s.player && this.selected !== sq ? sq : null;
    this.renderBoard();
  }

  choosePromotion(e) {
    const p = e.target.closest('[data-promote]');
    if (!p || !this.promote) return;
    const m = { ...this.promote, promotion: p.dataset.promote };
    this.promote = null;
    $('#promotion').classList.add('hidden');
    this.move(m);
  }

  move(move) {
    const s = this.session, run = this.run;
    const result = s.attempt(move);
    this.selected = null;
    if (result.kind === 'illegal' || result.kind === 'locked') { this.renderBoard(); return; }
    if (result.kind === 'continue') {
      this.message = `좋아! 상대가 ${result.reply}. 계속!`; this.messageKind = 'correct';
      this.sound?.('move'); this.render(); return;
    }
    const ok = result.kind === 'solved';
    if (!ok) s.reveal();
    run.record(s.puzzle, ok);
    this.busy = true;
    this.message = ok ? '정답! ✓' : `✕ 정답은 ${s.puzzle.line.filter((_, i) => i % 2 === 0).join(', ')}`;
    this.messageKind = ok ? 'correct' : 'wrong';
    this.sound?.(ok ? 'move' : 'wrong');
    this.render();
    if (run.over) { setTimeout(() => this.finish(run.reason), ok ? 300 : 900); return; }
    setTimeout(() => { if (this.run === run && !run.over) this.loadNext(); }, ok ? 300 : 900);
  }
}
