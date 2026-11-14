// 퍼즐 화면: 직접 만든 퍼즐 10개 + Lichess 공개 퍼즐 10만 개.
// 처음 보는 Lichess 퍼즐을 힌트 없이 한 번에 풀면 퍼즐 점수가 오르고, 틀리거나 힌트를 쓰면 내려간다.
import { puzzles, PuzzleSession } from './puzzles.mjs';
import { boardHTML, promotionHTML } from './board.mjs';
import { indexForRating } from './puzzle-bank.mjs';

const $ = s => document.querySelector(s);
const STORE = 'green-chess-puzzles-v1';
const setFrom = value => new Set(Array.isArray(value) ? value : []);

export class PuzzleUI {
  // bank: PuzzleBank, rating(): 지금 퍼즐 점수, onRated(puzzle, solvedClean): 점수 바꾸기
  constructor({ bank, rating, onRated, sound }) {
    this.bank = bank; this.rating = rating; this.onRated = onRated; this.sound = sound;
    this.active = false; this.index = 0; this.filter = 'all';
    this.selected = null; this.hints = []; this.flipped = false; this.promote = null;
    this.total = puzzles.length; this.manifest = null; this.range = [0, puzzles.length - 1];
    this.progress = new Set(); this.unassisted = new Set(); this.requestId = 0;
    this.message = ''; this.messageKind = '';
    try {
      const data = JSON.parse(localStorage.getItem(STORE));
      if (data && typeof data === 'object' && !Array.isArray(data)) { this.progress = setFrom(data.s); this.unassisted = setFrom(data.a); }
    } catch { /* 처음 */ }
    $('#puzzle-next').onclick = () => this.next();
    $('#puzzle-retry').onclick = () => this.load(this.index);
    $('#puzzle-hint').onclick = () => this.hint();
    $('#puzzle-answer').onclick = () => this.answer();
    $('#puzzle-filter').onchange = e => { this.filter = e.target.value; this.setRange(); this.load(this.range[0]); };
    $('#puzzle-picker').onclick = e => { const b = e.target.closest('[data-puzzle]'); if (b) this.load(Number(b.dataset.puzzle)); };
    $('#puzzle-daily').onclick = () => this.daily();
    $('#puzzle-mine').onclick = () => this.mine();
  }

  async enter(start) {
    this.active = true;
    this.setRange();
    this.render();
    if (!this.manifest) {
      try {
        this.manifest = await this.bank.manifest();
        this.total = puzzles.length + this.manifest.count;
        this.setRange();
      } catch {
        this.message = '추가 퍼즐 자료를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'; this.messageKind = 'wrong';
      }
    }
    if (!this.active) return;
    if (start === 'daily') this.daily();
    else if (start === 'mine') this.mine();
    else this.load(this.index);
  }

  exit() {
    this.requestId++;
    this.active = false; this.selected = null; this.promote = null;
    $('#promotion').classList.add('hidden');
  }

  setRange() {
    const band = (a, b) => (this.manifest ? this.manifest.ratingBands.slice(a, b + 1).reduce((s, x) => s + x.count, 0) : 0);
    const base = puzzles.length;
    if (this.filter === 'easy') this.range = [0, base + band(0, 3) - 1];
    else if (this.filter === 'medium') this.range = [base + band(0, 3), base + band(0, 6) - 1];
    else if (this.filter === 'hard') this.range = [base + band(0, 6), this.total - 1];
    else this.range = [0, this.total - 1];
  }

  daily() {
    this.filter = 'all'; $('#puzzle-filter').value = 'all'; this.setRange();
    const now = new Date(), day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    this.load(day % this.total);
  }

  // 내 퍼즐 점수 근처의 처음 보는 퍼즐
  mine() {
    if (!this.manifest) { this.load(this.index); return; }
    this.filter = 'all'; $('#puzzle-filter').value = 'all'; this.setRange();
    let index = 0;
    for (let tries = 0; tries < 6; tries++) {
      index = puzzles.length + indexForRating(this.manifest.ratingBands, this.rating());
      if (!this.progress.has(this.idAt(index))) break;
    }
    this.load(index);
  }

  idAt(index) { return this.session && index === this.index ? this.session.puzzle.id : puzzles[index]?.id ?? `lichess-${index - puzzles.length}`; }

  async resolve(index) {
    if (index < puzzles.length) return puzzles[index];
    if (!this.manifest) throw Error('퍼즐 목록이 아직 준비되지 않았어요.');
    return this.bank.record(index - puzzles.length);
  }

  async load(index) {
    this.index = Math.max(this.range[0], Math.min(this.range[1], index));
    this.session = null; this.selected = null; this.hints = []; this.promote = null;
    const token = ++this.requestId;
    $('#promotion').classList.add('hidden');
    this.message = '퍼즐을 불러오는 중…'; this.messageKind = '';
    this.render();
    try {
      const puzzle = await this.resolve(this.index);
      if (token !== this.requestId || !this.active) return;
      this.session = new PuzzleSession(puzzle);
      // 점수가 있는 처음 보는 퍼즐만 퍼즐 점수에 들어간다
      this.session.rated = !puzzle.rating || this.progress.has(puzzle.id);
      this.flipped = this.session.player === 'b';
      this.message = this.session.rated || !puzzle.rating ? '기물을 움직여 정답을 찾아보세요.' : `기물을 움직여 정답을 찾아보세요. 이 퍼즐은 ${puzzle.rating}점이에요.`;
    } catch {
      if (token !== this.requestId || !this.active) return;
      this.message = '퍼즐을 불러오지 못했어요. 다른 문제를 골라 주세요.'; this.messageKind = 'wrong';
    }
    this.render();
  }

  next() { this.load(this.index >= this.range[1] ? this.range[0] : this.index + 1); }

  rate(clean) {
    const s = this.session;
    if (!s || s.rated) return '';
    s.rated = true;
    return this.onRated(s.puzzle, clean) || '';
  }

  render() {
    if (!this.active) return;
    const total = this.total.toLocaleString('ko-KR');
    $('#puzzle-filter').value = this.filter;
    $('#puzzle-total').textContent = total;
    $('#puzzle-rating').textContent = this.rating();
    const s = this.session, p = s?.puzzle;
    $('#puzzle-title').textContent = p?.title || '전술을 찾아보세요';
    $('#puzzle-meta').textContent = p ? `${p.level}${p.rating ? ` · ${p.rating}점` : ''} · ${(this.index + 1).toLocaleString('ko-KR')} / ${total}` : `${(this.index + 1).toLocaleString('ko-KR')} / ${total}`;
    $('#puzzle-goal').textContent = p ? `${s.player === 'w' ? '백' : '흑'} 차례 · ${p.goal === 'mate' ? '체크메이트' : p.line.length > 1 ? '전술을 완성하세요' : p.theme === '승격' ? '폰을 승격하세요' : '좋은 수를 찾아보세요'}` : '정답 수순이 있는 퍼즐을 준비하고 있어요.';
    $('#puzzle-feedback').textContent = this.message;
    $('#puzzle-feedback').className = 'puzzle-feedback ' + this.messageKind;
    $('#puzzle-explanation').textContent = s && (s.solved || s.revealed) ? p.explanation : '';
    $('#puzzle-line').textContent = s && (s.solved || s.revealed) ? '정답 기보: ' + p.line.join(' → ') : s?.step ? `상대 응수: ${p.line[s.step - 1]} · 다음 수를 찾아보세요.` : '오답은 되돌려 드려요. 여러 번 시도해도 괜찮아요.';
    $('#puzzle-source').innerHTML = p?.source ? `퍼즐 출처: <a href="${p.source}" target="_blank" rel="noreferrer">Lichess</a> · CC0` : '퍼즐 출처: Lichess 공개 데이터 · CC0';
    $('#puzzle-progress-text').textContent = `${this.progress.size.toLocaleString('ko-KR')}문제 해결`;
    $('#puzzle-progress').max = this.total;
    $('#puzzle-progress').value = Math.min(this.total, this.progress.size);
    const start = Math.max(this.range[0], Math.min(this.index - 4, this.range[1] - 9)), end = Math.min(this.range[1], start + 9);
    $('#puzzle-picker').innerHTML = Array.from({ length: Math.max(0, end - start + 1) }, (_, j) => {
      const i = start + j, done = this.progress.has(this.idAt(i));
      return `<button data-puzzle="${i}" class="${done ? 'done' : ''} ${this.index === i ? 'current' : ''}" aria-label="${(i + 1).toLocaleString('ko-KR')}번 퍼즐" aria-current="${this.index === i}">${done ? '✓' : (i + 1).toLocaleString('ko-KR')}</button>`;
    }).join('');
    const locked = !s || s.solved || s.revealed;
    $('#puzzle-hint').disabled = locked;
    $('#puzzle-answer').disabled = locked;
    $('#puzzle-retry').disabled = !s;
    $('#puzzle-next').textContent = this.index >= this.range[1] ? '처음 문제 →' : '다음 퍼즐 →';
    $('#opponent-name').textContent = p?.source ? 'Lichess 퍼즐' : p ? '체스 퍼즐' : '전술 퍼즐';
    $('#opponent-sub').textContent = p?.theme || '퍼즐 연습';
    $('#my-name').textContent = s ? `${s.player === 'w' ? '백' : '흑'}으로 도전` : '퍼즐 준비';
    $('#my-sub').textContent = `퍼즐 점수 ${this.rating()}`;
    $('#board-caption').textContent = s?.solved ? '정답이에요! 해설을 읽고 다음 문제에 도전하세요.' : '퍼즐 모드 · 진행 중인 대전은 잠시 멈춰요.';
    this.renderBoard();
  }

  renderBoard() {
    if (!this.session) { $('#board').innerHTML = ''; return; }
    const g = this.session.game;
    $('#board').innerHTML = boardHTML(g, { flipped: this.flipped, selected: this.selected, legal: this.selected ? g.moves({ square: this.selected, verbose: true }) : [], last: this.session.lastMove, hints: this.hints });
  }

  click(e) {
    const b = e.target.closest('[data-square]'), s = this.session;
    if (!b || !s || this.promote || s.solved || s.revealed) return;
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
    const result = this.session.attempt(move);
    this.selected = null; this.hints = [];
    if (result.kind === 'wrong') {
      const note = this.rate(false);
      this.message = `아쉬워요! 다른 수를 찾아보세요. 위치는 그대로예요.${note}`; this.messageKind = 'wrong';
      this.sound?.('wrong');
    }
    if (result.kind === 'continue') {
      this.message = `좋아요! 상대가 ${result.reply}로 응수했어요. 다음 수를 찾아보세요.`; this.messageKind = 'correct';
      this.sound?.('move');
    }
    if (result.kind === 'solved') {
      const clean = !this.session.hintLevel && !this.session.mistakes;
      const note = this.rate(clean);
      this.message = `정답이에요! 멋진 수를 찾았어요.${note}`; this.messageKind = 'correct';
      const id = this.session.puzzle.id;
      this.progress.add(id);
      if (clean) this.unassisted.add(id);
      try { localStorage.setItem(STORE, JSON.stringify({ s: [...this.progress], a: [...this.unassisted] })); } catch { /* 저장 공간 */ }
      this.sound?.('win');
    }
    this.render();
  }

  hint() {
    const s = this.session;
    if (!s || s.solved || s.revealed) return;
    s.hintLevel++;
    const note = this.rate(false);
    this.message = (s.step ? '상대가 응수했어요. 공격 중인 기물과 왕의 안전을 다시 살펴보세요.' : s.puzzle.hint) + note;
    this.messageKind = '';
    if (s.hintLevel >= 2) {
      const move = s.game.moves({ verbose: true }).find(m => m.san === s.expected);
      if (move) { this.hints = [move.from, move.to]; this.message += ` 추천 수: ${move.san}`; }
    }
    this.render();
  }

  answer() {
    if (!this.session || this.session.solved || this.session.revealed) return;
    const note = this.rate(false);
    this.session.reveal();
    this.selected = null; this.hints = []; this.promote = null;
    $('#promotion').classList.add('hidden');
    this.message = `정답을 살펴봤어요. 다시 풀기로 직접 연습해 보세요.${note}`; this.messageKind = '';
    this.render();
  }
}
