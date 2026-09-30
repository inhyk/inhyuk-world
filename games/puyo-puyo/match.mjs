// 한 판(라운드)과 여러 판(선취)을 진행한다. 두 필드 사이의 방해뿌요를 주고받고,
// 누가 먼저 쓰러졌는지 판정한다. 화면·소리·네트워크와는 분리되어 있어서 테스트에서도 그대로 돈다.
import { Player, makeSequence, targetPoints, TIMING } from './core.mjs';
import { AIController } from './ai.mjs';

export const COUNTDOWN = 150;   // 준비 → 3 → 2 → 1 → 시작
export const ROUND_PAUSE = 180; // 한 판이 끝나고 다음 판까지

// spec: { kind: 'human' | 'ai' | 'remote', level, name }
export class Match {
  constructor({ seed = 1, colors = 4, specs, firstTo = 1, solo = false, timing = {}, random = Math.random, online = null, makeRemote = null, brain = null } = {}) {
    this.online = online;         // 'host' | 'guest' | null
    this.makeRemote = makeRemote; // 온라인 상대 화면을 만드는 함수
    this.seed = seed >>> 0;
    this.colors = colors;
    this.specs = specs;
    this.firstTo = firstTo;
    this.solo = solo || specs.length === 1;
    this.timing = timing;
    this.random = random;
    this.wins = specs.map(() => 0);
    this.round = 0;
    this.events = [];
    this.ai = specs.map(s => (s.kind === 'ai' ? new AIController(s.level, random, brain) : null));
    this.history = specs.map(() => emptyTotals());
    this.startRound();
  }

  startRound(seed) {
    this.round++;
    this.roundSeed = seed ?? ((this.seed + this.round * 7919) >>> 0);
    const seq = makeSequence(this.roundSeed, this.colors);
    this.seq = seq;
    this.players = this.specs.map((s, i) => (s.kind === 'remote' && this.makeRemote ? this.makeRemote(seq) : new Player({ seq, seed: this.roundSeed + i * 101 + 1, timing: this.timing })));
    this.phase = 'countdown';
    this.timer = COUNTDOWN;
    this.frame = 0;
    this.result = null;
    this.remoteChaining = false;
    this.emit(-1, 'round', { round: this.round });
  }

  emit(p, type, data = {}) { this.events.push({ p, type, ...data }); }
  get over() { return this.phase === 'over'; }
  get target() { return targetPoints(this.frame); }
  // 끝없이 모드는 시간이 갈수록 빨라진다
  gravity() {
    if (!this.solo) return TIMING.gravity * (this.frame > 180 * 60 ? 1.6 : this.frame > 120 * 60 ? 1.3 : 1);
    const level = Math.min(15, Math.floor(this.players[0].stats.pieces / 25));
    return TIMING.gravity * (1 + level * 0.28);
  }

  // inputs[i]: 사람 입력 (AI·원격은 무시)
  step(inputs = []) {
    if (this.phase === 'countdown') {
      this.timer--;
      if (this.timer === 120 || this.timer === 80 || this.timer === 40) this.emit(-1, 'count', { n: this.timer / 40 });
      if (this.timer <= 0) {
        this.phase = 'play';
        this.players.forEach((p, i) => { if (this.specs[i].kind !== 'remote') p.start(); });
        this.emit(-1, 'go');
      }
      return;
    }
    if (this.phase === 'roundEnd') {
      if (this.online === 'guest') return;   // 손님은 방장이 다음 판을 알려 줄 때까지 기다린다
      if (--this.timer <= 0) {
        if (this.wins.some(w => w >= this.firstTo) || this.solo) { this.phase = 'over'; this.emit(-1, 'matchEnd', { wins: this.wins.slice() }); }
        else this.startRound();
      }
      return;
    }
    if (this.phase !== 'play') return;
    this.frame++;
    const target = this.target, gravity = this.gravity();
    this.players.forEach((me, i) => {
      if (this.specs[i].kind === 'remote') return;
      const opp = this.players[1 - i];
      const oppRemote = this.specs[1 - i]?.kind === 'remote';
      const oppChaining = opp ? (oppRemote ? this.remoteChaining : opp.chaining) : false;
      let input = inputs[i] || {};
      if (this.ai[i]) input = this.ai[i].input(me, { target, oppHeights: opp?.h, oppBusy: oppChaining });
      me.step(input, { target, gravity, canReceive: !oppChaining });
    });
    // 방해뿌요 전달과 이벤트 모으기
    this.players.forEach((me, i) => {
      for (const e of me.events) {
        if (e.type === 'send' && !this.solo) {
          const opp = this.players[1 - i];
          if (this.specs[1 - i].kind === 'remote') this.emit(i, 'remoteSend', { amount: e.amount });
          else opp.receive(e.amount);
        }
        this.events.push({ p: i, ...e });
      }
      me.events.length = 0;
    });
    const dead = this.players.map(p => p.dead);
    if (!dead.some(Boolean)) return;
    if (this.online === 'guest') {
      // 손님은 스스로 판정하지 않고 방장의 결과를 기다린다
      if (dead[0] && !this.waiting) { this.waiting = true; this.emit(0, 'waitResult'); }
      return;
    }
    if (this.online === 'host' && !dead[0]) return;  // 방장은 상대가 쓰러진 소식(remoteDead)으로 판정
    this.endRound(dead);
  }

  // 온라인 손님: 방장이 보낸 결과를 그대로 적용한다
  applyResult(winner, wins, final) {
    if (this.phase === 'roundEnd' || this.phase === 'over') return;
    this.wins = wins.slice();
    this.players.forEach((p, i) => addTotals(this.history[i], p.stats || {}, p.score || 0));
    this.result = { winner, draw: winner < 0, frame: this.frame };
    this.phase = 'roundEnd';
    this.timer = ROUND_PAUSE;
    this.waiting = false;
    this.emit(-1, 'roundEnd', { winner, wins: this.wins.slice() });
    if (final) { this.phase = 'over'; this.emit(-1, 'matchEnd', { wins: this.wins.slice() }); }
  }
  // 온라인 손님: 방장이 다음 판을 시작하라고 할 때
  nextRound() {
    if (this.phase !== 'roundEnd') return;
    if (this.wins.some(w => w >= this.firstTo)) { this.phase = 'over'; this.emit(-1, 'matchEnd', { wins: this.wins.slice() }); return; }
    this.waiting = false;
    this.startRound();
  }

  endRound(dead) {
    let winner = -1;
    if (this.solo) winner = -1;
    else if (dead[0] && !dead[1]) winner = 1;
    else if (dead[1] && !dead[0]) winner = 0;
    if (winner >= 0) this.wins[winner]++;
    this.players.forEach((p, i) => addTotals(this.history[i], p.stats || {}, p.score || 0));
    this.result = { winner, draw: !this.solo && winner < 0, frame: this.frame };
    this.phase = 'roundEnd';
    this.timer = ROUND_PAUSE;
    this.emit(-1, 'roundEnd', { winner, wins: this.wins.slice() });
  }

  // 온라인 상대가 쓰러졌다고 알려 올 때
  remoteDead() {
    if (this.phase !== 'play') return;
    const i = this.specs.findIndex(s => s.kind === 'remote');
    const dead = this.players.map((p, k) => (k === i ? true : p.dead));
    this.endRound(dead);
  }

  winner() {
    if (this.solo) return -1;
    const best = Math.max(...this.wins);
    return this.wins.filter(w => w === best).length > 1 ? -1 : this.wins.indexOf(best);
  }

  // 여러 판 동안의 기록 합계 (미션·레벨 계산용). 끝나지 않은 판도 더해서 본다.
  totals(i) {
    const t = structuredClone(this.history[i]);
    if (this.phase === 'play' || this.phase === 'countdown') addTotals(t, this.players[i].stats || {}, this.players[i].score || 0);
    return t;
  }
}

export function emptyTotals() {
  return { pieces: 0, maxChain: 0, popped: 0, garbageSent: 0, maxAttack: 0, allClears: 0, offsets: 0, offsetAmount: 0, maxColors: 0, maxGroup: 0, garbageTaken: 0, chains: {}, score: 0, maxScore: 0 };
}
const MAX_KEYS = ['maxChain', 'maxAttack', 'maxColors', 'maxGroup'];
export function addTotals(t, s, score = 0) {
  for (const [k, v] of Object.entries(s)) {
    if (k === 'chains') { for (const [c, n] of Object.entries(v)) t.chains[c] = (t.chains[c] || 0) + n; }
    else if (MAX_KEYS.includes(k)) t[k] = Math.max(t[k] || 0, v);
    else t[k] = (t[k] || 0) + v;
  }
  t.score += score;
  t.maxScore = Math.max(t.maxScore, score);
  return t;
}
