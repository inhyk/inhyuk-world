// 그린 체스: 홈, 대전(온라인, 컴퓨터 캐릭터, 같은 기기), 게임 리뷰, 퍼즐, 퍼즐 러시.
import { Chess } from './vendor/chess.mjs';
import { boardHTML, promotionHTML, uciOf, parseUci, positionKey } from './board.mjs';
import { PuzzleUI } from './puzzle-ui.mjs';
import { PuzzleBank } from './puzzle-bank.mjs';
import { RushUI } from './rush-ui.mjs';
import { BOTS, botById } from './bots.mjs';
import { loadRatings, saveRatings, applyResult, recordRush, signed, START } from './rating.mjs';
import { GAME, MATCH_TIME, QUICK, OnlineMatch, createNet, other } from './online.mjs';
import { Room, normaliseCode } from './net-client/index.mjs';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SAVE_KEY = 'green-chess-v2';
const idx = c => (c === 'w' ? 0 : 1);
const colorName = c => (c === 'w' ? '백' : '흑');
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const game = new Chess();
const ratings = loadRatings();
const bank = new PuzzleBank();
const net = createNet(location.search);

let view = 'home';
let mode = 'ai';              // ai | local | online
let botId = 'pumpkin';
let colorChoice = 'w';        // 컴퓨터 대전에서 고른 색: w | b | random
let myColor = 'w';
let flipped = false;
let selected = null, hints = [], lastMove = null, promote = null;
let reviewIndex = 0, rows = [], analysisDone = false, analysisRunning = false;
let thinking = false, botStartedAt = 0;
let ended = null;             // { winner: 'w'|'b'|'draw'|'none', text }
let clock = [600, 600], started = false, lastTick = performance.now(), timeControl = 600;
let assisted = false;         // 무르기나 힌트를 쓴 판 (점수 안 바뀜)
let finishedOnce = false;     // 판 끝 처리를 했나
let resultNote = null;        // 결과 카드
let sound = true, audio = null, worker = null, job = 0;
let match = null;             // OnlineMatch
let onlineStage = 'idle';     // idle | searching | inviting | room | joining
let invitingName = '';
let social = null, liveStatus = 'offline';
let friends = [], incoming = [];
let lastSay = 0, toastTimer = 0;
const speechTimers = {};

// ---------- 소리 ----------
function play(kind) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const tunes = {
      move: [[520, 180, 0.09]], capture: [[260, 150, 0.12]], check: [[660, 440, 0.13]], wrong: [[220, 140, 0.2]],
      win: [[523, 523, 0.1], [659, 659, 0.1], [784, 784, 0.2]], end: [[392, 294, 0.24]], notify: [[880, 700, 0.08], [1046, 900, 0.1]],
    };
    let t = audio.currentTime;
    for (const [f1, f2, d] of tunes[kind] ?? tunes.move) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.connect(g); g.connect(audio.destination); o.type = 'sine';
      o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d * 0.8);
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d + 0.02); t += d * 0.9;
    }
  } catch { /* 소리 없이 */ }
}

// ---------- 생각하는 일 (worker) ----------
function stopWorker() { job++; worker?.terminate(); worker = null; thinking = false; analysisRunning = false; }
function run(data) {
  stopWorker();
  worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  const id = job;
  worker.onmessage = ({ data: d }) => { if (d.id === job) workerMessage(d, id); };
  worker.onerror = () => { thinking = false; analysisRunning = false; $('#status-sub').textContent = '엔진을 불러오지 못했어요. 새로고침해 주세요.'; render(); };
  worker.postMessage({ ...data, id });
}
function workerMessage(d, id) {
  if (d.type === 'bot') {
    const wait = Math.max(0, botStartedAt + 450 + Math.random() * 400 - performance.now());
    setTimeout(() => {
      if (id !== job) return;
      thinking = false;
      if (d.uci && mode === 'ai' && game.turn() !== myColor && !result()) { if (doMove(parseUci(d.uci))) afterMove(); else render(); } else render();
    }, wait);
  }
  if (d.type === 'hint') {
    thinking = false;
    if (d.uci) {
      const m = parseUci(d.uci);
      hints = [m.from, m.to];
      const san = new Chess(game.fen()).move(m)?.san;
      render();
      $('#status-sub').textContent = `추천 수: ${san} · 표시된 기물을 움직여 보세요.`;
    } else render();
  }
  if (d.type === 'reviewRow') { rows[d.index] = d.row; renderReview(); }
  if (d.type === 'reviewDone') { analysisRunning = false; analysisDone = true; renderReview(); }
  if (d.type === 'error') { thinking = false; analysisRunning = false; console.error(d.message); $('#analyze').disabled = false; $('#analyze').textContent = '분석 다시 시도'; render(); }
}

function positionKeys() {
  const keys = [positionKey(new Chess().fen())];
  for (const m of game.history({ verbose: true })) keys.push(positionKey(m.after));
  return keys.slice(-40);
}

// ---------- 저장 (컴퓨터, 같은 기기 대전만) ----------
function save() {
  if (mode === 'online') return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ moves: game.history(), mode, botId, myColor, colorChoice, time: timeControl, clock, started, ended, flipped, assisted, finished: finishedOnce })); } catch { /* 저장 공간 */ }
}
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s) return;
    mode = s.mode === 'local' ? 'local' : 'ai';
    botId = botById(s.botId).id;
    myColor = s.myColor === 'b' ? 'b' : 'w';
    colorChoice = ['w', 'b', 'random'].includes(s.colorChoice) ? s.colorChoice : 'w';
    timeControl = [0, 60, 180, 300, 600].includes(s.time) ? s.time : 600;
    for (const m of s.moves) game.move(m);
    clock = Array.isArray(s.clock) && s.clock.length === 2 ? s.clock.map(n => Number(n) || 0) : [timeControl, timeControl];
    started = !!s.started;
    ended = s.ended && typeof s.ended === 'object' && typeof s.ended.text === 'string' ? s.ended : null;
    flipped = !!s.flipped; assisted = !!s.assisted; finishedOnce = !!s.finished;
    lastMove = game.history({ verbose: true }).at(-1) ?? null;
    $('#time').value = String(timeControl); $('#time-local').value = String(timeControl);
  } catch { game.reset(); }
}

// ---------- 판 상태 ----------
function result() {
  if (ended) return ended;
  if (game.isCheckmate()) { const w = game.turn() === 'w' ? 'b' : 'w'; return { winner: w, text: `${colorName(w)} 승리! 체크메이트` }; }
  if (game.isStalemate()) return { winner: 'draw', text: '스테일메이트 · 무승부' };
  if (game.isThreefoldRepetition()) return { winner: 'draw', text: '같은 위치 3번 · 무승부' };
  if (game.isInsufficientMaterial()) return { winner: 'draw', text: '기물 부족 · 무승부' };
  if (game.isDraw()) return { winner: 'draw', text: '50수 규칙 · 무승부' };
  return null;
}
const inProgress = () => started && !result() && (mode !== 'online' || !!match?.playing);
const onlineBusy = () => !!match?.playing;

function clearBoardState() {
  stopWorker();
  game.reset();
  ended = null; selected = null; hints = []; lastMove = null; promote = null; hidePromotion();
  rows = []; analysisDone = false; assisted = false; finishedOnce = false; resultNote = null;
}

function resetIdle() {
  clearBoardState();
  started = false; myColor = 'w'; flipped = false;
  timeControl = mode === 'online' ? MATCH_TIME : Number((mode === 'local' ? $('#time-local') : $('#time')).value);
  clock = [timeControl, timeControl]; lastTick = performance.now();
}

function newGame() {
  clearBoardState();
  timeControl = Number((mode === 'local' ? $('#time-local') : $('#time')).value);
  clock = [timeControl, timeControl]; lastTick = performance.now();
  if (mode === 'ai') {
    myColor = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    flipped = myColor === 'b';
    showSpeech(botById(botId).lines.greet, 'opponent', 4500);
  } else { myColor = 'w'; flipped = false; }
  started = true;
  render();
  maybeBotMove();
}

function maybeBotMove() {
  if (view !== 'play' || mode !== 'ai' || !started || result() || game.turn() === myColor || thinking) return;
  run({ type: 'bot', fen: game.fen(), history: positionKeys(), engine: { timeMs: 1500, ...botById(botId).engine } });
  thinking = true; botStartedAt = performance.now();
  render();
}

function canHumanMove() {
  if (view !== 'play' || thinking || promote || result()) return false;
  if (mode === 'ai') return game.turn() === myColor;
  if (mode === 'online') return onlineBusy() && game.turn() === myColor;
  return true;
}

function doMove(move) {
  tick();
  if (result()) return null;
  let m;
  try { m = game.move(move); } catch { return null; }
  selected = null; hints = []; lastMove = m; started = true; rows = []; analysisDone = false;
  play(game.isCheck() ? 'check' : m.captured ? 'capture' : 'move');
  if (mode === 'ai' && m.captured && m.color === myColor && Math.random() < 0.35) showSpeech(botById(botId).lines.capture, 'opponent');
  return m;
}

function humanMove(move) {
  const ply = game.history().length;
  const m = doMove(move);
  if (!m) return;
  if (mode === 'online' && match) match.move(uciOf(m), ply, clock[idx(m.color)] * 1000);
  afterMove();
}

function afterMove() { checkEnd(); render(); maybeBotMove(); }

function checkEnd() {
  const r = result();
  if (!r || finishedOnce) return;
  finishedOnce = true;
  if (thinking) stopWorker();
  gameOver(r);
}

function gameOver(r) {
  let change = null, note = '';
  const score = r.winner === 'draw' ? 0.5 : r.winner === myColor ? 1 : 0;
  const longEnough = game.history().length >= 2;
  if (mode === 'ai') {
    const bot = botById(botId);
    if (assisted) note = '무르기나 힌트를 써서 점수는 그대로야.';
    else if (!longEnough) note = '판이 너무 짧아서 점수는 그대로야.';
    else { change = applyResult(ratings, 'bot', bot.rating, score); saveRatings(ratings); }
    showSpeech(score === 1 ? bot.lines.lose : score === 0 ? bot.lines.win : bot.lines.draw, 'opponent', 7000);
  } else if (mode === 'online' && match) {
    match.finished(r.winner);
    if (r.winner === 'none') note = '연결이 끊겨서 점수는 그대로야.';
    else if (!match.rated) note = '친선전이라 점수는 그대로야.';
    else if (!longEnough) note = '판이 너무 짧아서 점수는 그대로야.';
    else { change = applyResult(ratings, 'online', match.peerRating ?? START, score); saveRatings(ratings); }
  }
  resultNote = { r, score, change, note, kind: mode };
  play(mode === 'local' || score === 1 ? 'win' : 'end');
  renderRatings();
}

function resign() {
  if (!started || result()) return;
  const loser = mode === 'local' ? game.turn() : myColor, winner = other(loser);
  ended = { winner, text: `${colorName(winner)} 승리 · ${colorName(loser)} 기권` };
  if (mode === 'online') match?.resign();
  stopWorker(); checkEnd(); render();
}

// ---------- 시계 ----------
function tick() {
  const now = performance.now(), delta = (now - lastTick) / 1000;
  lastTick = now;
  if (!started || !timeControl || result()) return;
  if (mode === 'online') { if (!onlineBusy()) return; } else if (view !== 'play') return;
  const turn = game.turn(), i = idx(turn);
  clock[i] -= delta;
  if (mode === 'online') {
    if (turn === myColor && clock[i] <= 0) {
      clock[i] = 0; ended = { winner: other(myColor), text: `${colorName(other(myColor))} 승리! 시간 초과` };
      match.timeout(); checkEnd(); render(); return;
    }
    if (turn !== myColor && clock[i] <= -3) {
      ended = { winner: myColor, text: `${colorName(myColor)} 승리! 상대 시간 초과` };
      match.flag(); checkEnd(); render(); return;
    }
  } else if (clock[i] <= 0) {
    clock[i] = 0; ended = { winner: other(turn), text: `${colorName(other(turn))} 승리! 시간 초과` };
    stopWorker(); checkEnd(); render(); return;
  }
  if (view === 'play' || view === 'review') updateClocks();
}
setInterval(tick, 200);
setInterval(() => { if (started && !result()) save(); }, 3000);

function updateClocks() {
  const top = flipped ? 'w' : 'b';
  for (const [el, c] of [[$('#clock-top'), top], [$('#clock-bottom'), other(top)]]) {
    const t = Math.max(0, Math.ceil(clock[idx(c)]));
    el.textContent = timeControl ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : '∞';
    const active = started && !result() && game.turn() === c && (mode !== 'online' || onlineBusy());
    el.classList.toggle('active', active);
    el.classList.toggle('low', active && !!timeControl && t <= 20);
  }
}

// ---------- 그리기 ----------
function displayGame() {
  if (view !== 'review') return game;
  const g = new Chess();
  for (const m of game.history().slice(0, reviewIndex)) g.move(m);
  return g;
}

function renderBoard() {
  const g = displayGame(), reviewing = view === 'review';
  const legal = !reviewing && selected ? game.moves({ square: selected, verbose: true }) : [];
  const last = reviewing ? g.history({ verbose: true }).at(-1) : lastMove;
  $('#board').innerHTML = boardHTML(g, { flipped, selected: reviewing ? null : selected, legal, last, hints: reviewing ? [] : hints });
  const captured = { w: [], b: [] }, glyph = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
  for (const m of g.history({ verbose: true })) if (m.captured) captured[m.color].push(m.captured);
  const top = flipped ? 'w' : 'b';
  $('#captured-top').textContent = captured[top].map(p => glyph[p]).join('');
  $('#captured-bottom').textContent = captured[other(top)].map(p => glyph[p]).join('');
}

function labelFor(c) {
  if (mode === 'ai') {
    if (c === myColor) return { avatar: '♔', cls: 'human', name: '나', sub: `${colorName(c)} · 대전 점수 ${ratings.bot.r}` };
    const bot = botById(botId);
    return { avatar: bot.face, cls: 'bot face', name: bot.name, sub: `${bot.rating}점 · 컴퓨터 · ${colorName(c)}` };
  }
  if (mode === 'local') return { avatar: c === 'w' ? '♔' : '♚', cls: c === 'w' ? 'human' : 'bot', name: `${colorName(c)} 플레이어`, sub: '같은 기기에서 함께' };
  if (c === myColor) {
    const me = net.account.user?.nickname ?? '나';
    return { avatar: '♔', cls: 'human', name: me, sub: `${colorName(c)} · ${match?.rated || !match ? `온라인 점수 ${ratings.online.r}` : '친선전'}` };
  }
  if (!match || !match.peer) return { avatar: '?', cls: 'bot', name: '상대를 기다리는 중', sub: onlineStage === 'searching' ? '게임 찾는 중…' : '게임 찾기나 방 코드로 시작해' };
  const name = match.opponent?.nickname ?? '친구';
  return { avatar: '♞', cls: 'bot', name, sub: `${colorName(c)} · ${match.peerRating ? `${match.peerRating}점` : '점수 ?'}${match.peerGone ? ' · 연결 끊김' : ''}` };
}

function paintPlayer(prefix, l) {
  const a = $(`#${prefix}-avatar`);
  a.className = `avatar ${l.cls}`;
  a.innerHTML = l.cls.includes('face') ? l.avatar : esc(l.avatar);
  $(`#${prefix}-name`).textContent = l.name;
  $(`#${prefix}-sub`).textContent = l.sub;
}

function renderPlayers() {
  const top = flipped ? 'w' : 'b';
  paintPlayer('opponent', labelFor(top));
  paintPlayer('my', labelFor(other(top)));
}

function showSpeech(text, who = 'opponent', ms = 3500) {
  const top = flipped ? 'w' : 'b';
  const opponentColor = mode === 'local' ? top : other(myColor);
  const onTop = (who === 'opponent') === (opponentColor === top);
  const el = $(onTop ? '#speech' : '#my-speech');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(speechTimers[el.id]);
  speechTimers[el.id] = setTimeout(() => { el.hidden = true; }, ms);
}
function hideSpeech() { $('#speech').hidden = true; $('#my-speech').hidden = true; }

function statusText() {
  const r = result();
  if (r) return [r.text, resultNote?.note || (view === 'play' ? '리뷰에서 멋진 수와 실수를 확인해 보세요.' : '')];
  if (mode === 'online') {
    if (onlineBusy()) {
      const mine = game.turn() === myColor;
      if (match.peerGone) return ['상대 연결이 끊겼어', '30초 안에 돌아오지 않으면 네가 이겨.'];
      return [mine ? `내 차례야 (${colorName(myColor)})${game.isCheck() ? ' · 체크!' : ''}` : `상대 차례야${game.isCheck() ? ' · 체크!' : ''}`, mine ? '천천히, 하지만 시계를 봐!' : '상대가 생각하고 있어…'];
    }
    if (onlineStage === 'searching') return ['게임 찾는 중…', '비슷한 때 들어온 사람과 붙어.'];
    if (onlineStage === 'inviting') return [`${invitingName} 님에게 초대를 보냈어`, '60초 안에 대답이 오면 시작해.'];
    if (onlineStage === 'room' || onlineStage === 'joining') return ['방에서 기다리는 중', '두 사람이 모이면 바로 시작해.'];
    return ['온라인 대전', '게임 찾기, 방 코드, 친구 초대 중에서 골라.'];
  }
  if (!started) return mode === 'ai' ? ['한 판 해 볼까?', '캐릭터를 고르고 대전 시작을 눌러.'] : ['같은 기기 대전', '새 게임 시작을 누르거나 바로 첫 수를 둬.'];
  const turn = game.turn();
  if (mode === 'ai' && thinking) return [`${botById(botId).name} 차례`, `${botById(botId).name}이(가) 다음 수를 생각하고 있어…`];
  return [`${colorName(turn)}의 차례예요${game.isCheck() ? ' · 체크!' : ''}`, game.isCheck() ? '왕을 안전하게 지켜 주세요.' : '중앙을 차지하며 기물을 전개해 보세요.'];
}

function renderResultCard() {
  const card = $('#result-card');
  if (!resultNote || !result()) { card.hidden = true; return; }
  const { r, score, change, kind } = resultNote;
  const head = kind === 'local' ? (r.winner === 'draw' ? '무승부' : `${colorName(r.winner)} 승리!`) : r.winner === 'none' ? '게임 중단' : score === 1 ? '승리!' : score === 0 ? '패배' : '무승부';
  const ratingLine = change ? `<div class="rating-change ${change.delta >= 0 ? 'up' : 'down'}">${kind === 'online' ? '온라인' : '대전'} 점수 <b>${change.after}</b> <span>${signed(change.delta)}</span></div>` : '';
  card.className = `result-card ${kind === 'local' ? 'neutral' : score === 1 ? 'win' : score === 0 ? 'lose' : 'neutral'}`;
  card.innerHTML = `<strong>${head}</strong><small>${esc(r.text)}</small>${ratingLine}`;
  card.hidden = false;
}

function renderPanel() {
  for (const b of $$('#mode-switch [data-mode]')) b.classList.toggle('selected', b.dataset.mode === mode);
  const busy = inProgress();
  $('#setup-ai').hidden = mode !== 'ai' || busy;
  $('#setup-local').hidden = mode !== 'local' || busy;
  $('#setup-online').hidden = mode !== 'online' || busy || (match?.over && !!match.peer && !match.peerGone);
  if (mode === 'ai') renderBotSetup();
  if (mode === 'online') renderOnlineSetup();
  const [status, sub] = statusText();
  $('#status').textContent = status;
  $('#status-sub').textContent = sub;
  renderResultCard();
  const online = mode === 'online' && !!match && !!match.peer;
  $('#online-live').hidden = !online;
  if (online) renderOnlineLive();
  const history = game.history();
  $('#history').innerHTML = history.length
    ? Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => `<div class="move-row"><span>${i + 1}.</span><b>${history[i * 2]}</b><b>${history[i * 2 + 1] || ''}</b></div>`).join('')
    : '<div class="empty-history"><span>♙</span><p>첫 수를 기다리고 있어요.</p><small>모든 멋진 경기는 한 수에서 시작돼요.</small></div>';
  $('#history').scrollTop = $('#history').scrollHeight;
  const r = result();
  $('#actions-offline').hidden = mode === 'online';
  $('#actions-online').hidden = mode !== 'online' || !onlineBusy();
  $('#actions-after').hidden = mode !== 'online' || !match?.over;
  $('#undo').disabled = !history.length || mode === 'online' || thinking;
  $('#hint').disabled = !!r || thinking || !started || (mode === 'ai' && game.turn() !== myColor);
  $('#resign').disabled = !!r || !started || !history.length;
  $('#offer-draw').disabled = !onlineBusy() || match?.drawSent || history.length < 2;
  $('#offer-draw').textContent = match?.drawSent ? '½ 제안 보냄' : '½ 무승부 제안';
  if (match?.over) {
    $('#rematch').disabled = match.peerGone || match.wantRematch;
    $('#rematch').textContent = match.wantRematch ? '↻ 대답 기다리는 중' : match.peerRematch ? '↻ 좋아, 한 판 더!' : '↻ 한 판 더';
    const friendable = match.kind !== 'code' && match.opponent && net.account.loggedIn && !friends.some(f => f.id === match.opponent.id);
    $('#add-opponent').hidden = !friendable;
  }
  $('#start-review').hidden = !history.length;
}

function renderBotSetup() {
  $('#bot-grid').innerHTML = BOTS.map(b => `<button class="bot-pick ${b.id === botId ? 'selected' : ''}" data-bot="${b.id}" aria-label="${b.name} ${b.rating}점" title="${b.name} · ${b.rating}">${b.face}<small>${b.rating}</small></button>`).join('');
  const bot = botById(botId);
  $('#bot-card').innerHTML = `<div class="bot-card-face">${bot.face}</div><div><strong>${bot.name} <span>${bot.rating}</span></strong><small>${bot.title}</small><p>“${bot.lines.greet}”</p></div>`;
  for (const b of $$('#color-pick [data-color]')) b.classList.toggle('selected', b.dataset.color === colorChoice);
}

function setTitle() {
  const titles = {
    home: ['GREEN CHESS CLUB', '어서 와, 체스 한 판 할까', '?'],
    play: mode === 'online' ? ['ONLINE', '온라인 대전', '.'] : mode === 'ai' ? ['VS COMPUTER', '숲속 캐릭터와 대전', '.'] : ['PASS & PLAY', '같은 기기에서 대전', '.'],
    review: ['GAME REVIEW', '게임 리뷰', '.'], puzzle: ['PUZZLES', '한 수의 발견', '.'], rush: ['PUZZLE RUSH', '퍼즐 러시', '!'],
  }[view];
  $('#view-eyebrow').textContent = titles[0];
  $('#view-title').innerHTML = `${titles[1]}<span>${titles[2]}</span>`;
}

function render() {
  document.body.dataset.mode = mode;
  document.body.classList.toggle('in-game', inProgress());
  setTitle();
  renderLive();
  if (view === 'home') { renderHome(); return; }
  if (view === 'puzzle') { puzzleUI.render(); return; }
  if (view === 'rush') { rushUI.render(); return; }
  renderBoard(); renderPlayers(); renderPanel(); updateClocks(); save();
  if (view === 'review') renderReview();
  $('#board-caption').textContent = view === 'review' ? '복기 모드 · 화살표로 한 수씩 돌아보세요.' : mode === 'online' && !onlineBusy() && !match?.over ? '게임이 시작되면 여기서 둬요.' : '기물을 선택하면 갈 수 있는 칸이 보여요.';
}

// ---------- 홈 ----------
function renderRatings() {
  const rushBest = Math.max(...Object.values(ratings.rush));
  const items = [
    ['♞', '컴퓨터 대전', ratings.bot.r, `${ratings.bot.games}판 · 최고 ${ratings.bot.best}`],
    ['⚡', '온라인', ratings.online.r, `${ratings.online.games}판 · 최고 ${ratings.online.best}`],
    ['◈', '퍼즐', ratings.puzzle.r, `${ratings.puzzle.games}문제 · 최고 ${ratings.puzzle.best}`],
    ['⏱', '퍼즐 러시', rushBest, '최고 기록'],
  ];
  $('#rating-cards').innerHTML = items.map(([icon, label, value, sub]) => `<div class="rating-card"><span>${icon}</span><div><small>${label}</small><strong>${value}</strong><em>${sub}</em></div></div>`).join('');
  $('#rail-ratings').innerHTML = items.map(([icon, label, value]) => `<span title="${label}">${icon} ${value}</span>`).join('');
}

const heroGame = new Chess('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5');
function renderHome() {
  $('#hero-board').innerHTML = `<div class="mini-board">${boardHTML(heroGame, { interactive: false, coords: false, last: { from: 'f8', to: 'c5' } })}</div>`;
  $('#home-bots').innerHTML = BOTS.map(b => `<button class="bot-chip" data-bot-go="${b.id}">${b.face}<b>${b.name}</b><small>${b.rating}</small></button>`).join('');
  renderRatings();
}

// ---------- 화면 바꾸기 ----------
function showView(next, arg) {
  if (onlineBusy() && next !== 'play') { toast('온라인 대전 중이야. 끝나거나 기권하면 다른 곳에 갈 수 있어.'); return; }
  if (next === view && !arg && next !== 'play' && next !== 'review') return;
  tick();
  const prev = view;
  if (prev === 'puzzle' && next !== 'puzzle') puzzleUI.exit();
  if (prev === 'rush' && next !== 'rush') rushUI.exit();
  if (next !== 'play' && (thinking || analysisRunning) && !(next === 'review' && analysisRunning)) stopWorker();
  view = next;
  document.body.dataset.view = next;
  $('#home-view').hidden = next !== 'home';
  $('#game-view').hidden = next === 'home';
  for (const [id, v] of [['#play-panel', 'play'], ['#review-panel', 'review'], ['#puzzle-panel', 'puzzle'], ['#rush-panel', 'rush']]) $(id).classList.toggle('hidden', v !== next);
  for (const b of $$('.nav[data-view]')) b.classList.toggle('active', b.dataset.view === next);
  for (const b of $$('.tabs [data-view]')) b.classList.toggle('selected', b.dataset.view === next);
  selected = null; hints = []; promote = null; hidePromotion(); hideSpeech();
  lastTick = performance.now();
  if (next === 'review') reviewIndex = game.history().length;
  if (next === 'puzzle' || next === 'rush') {
    $('#opponent-avatar').className = 'avatar bot'; $('#opponent-avatar').textContent = next === 'rush' ? '⚡' : '◈';
    $('#my-avatar').className = 'avatar human'; $('#my-avatar').textContent = '♔';
    $('#captured-top').textContent = ''; $('#captured-bottom').textContent = '';
    for (const id of ['#clock-top', '#clock-bottom']) { $(id).textContent = '∞'; $(id).classList.remove('active', 'low'); }
  }
  setTitle();
  if (next === 'puzzle') puzzleUI.enter(arg);
  else if (next === 'rush') rushUI.enter();
  else render();
  if (next === 'play') maybeBotMove();
  if (next !== prev) window.scrollTo({ top: 0 });
}

function setMode(next) {
  if (next === mode) return true;
  if (inProgress()) { toast('대전 중이야. 끝나거나 기권하면 바꿀 수 있어.'); return false; }
  if (mode === 'online') { cancelOnline(); dropMatch(); }
  mode = next;
  resetIdle();
  if (mode === 'online') { startSocial(); loadFriends(); }
  render();
  return true;
}

function hidePromotion() { $('#promotion').classList.add('hidden'); }

// ---------- 리뷰 ----------
function analyze() {
  if (!game.history().length) return;
  rows = []; analysisDone = false;
  run({ type: 'review', moves: game.history() });
  analysisRunning = true;
  renderReview();
}
function setReviewIndex(i) { reviewIndex = Math.max(0, Math.min(game.history().length, i)); renderBoard(); renderReview(); }
function renderReview() {
  if (view !== 'review') return;
  const count = game.history().length;
  $('#analyze').disabled = !count || analysisRunning || analysisDone;
  $('#analyze').textContent = analysisRunning ? `분석 중… ${rows.filter(Boolean).length} / ${count}수` : analysisDone ? '✓ 경기 분석 완료' : '✦ 경기 분석 시작';
  $('#export').disabled = !count;
  $('#first').disabled = $('#prev').disabled = reviewIndex === 0;
  $('#next').disabled = $('#last').disabled = reviewIndex === count;
  $('#review-position').textContent = reviewIndex ? `${Math.ceil(reviewIndex / 2)}.${reviewIndex % 2 ? '' : '..'} ${game.history()[reviewIndex - 1]}` : '시작 위치';
  const acc = c => { const list = rows.filter((r, i) => r && i % 2 === c); return list.length ? Math.round(list.reduce((s, r) => s + Math.max(0, 100 - r.loss / 12), 0) / list.length) : '—'; };
  $('#review-summary').innerHTML = `<div class="accuracy"><div><small>백 · 추정 정확도</small><strong>${acc(0)}<span>%</span></strong></div><div><small>흑 · 추정 정확도</small><strong>${acc(1)}<span>%</span></strong></div></div>`;
  if (rows.length) {
    const points = ['0,45', ...rows.map((r, i) => r ? `${(i + 1) / Math.max(count, 1) * 300},${45 - Math.max(-800, Math.min(800, r.score)) / 800 * 40}` : null).filter(Boolean)].join(' ');
    const x = reviewIndex / Math.max(count, 1) * 300;
    $('#chart').innerHTML = `<svg class="chart" viewBox="0 0 300 90" preserveAspectRatio="none" aria-label="백 기준 평가 그래프"><line x1="0" y1="45" x2="300" y2="45" stroke="#56644a" stroke-dasharray="3 4"/><polyline points="${points}" fill="none" stroke="#accf7f" stroke-width="2"/><line x1="${x}" y1="0" x2="${x}" y2="90" stroke="#e7efcf" opacity=".6"/></svg>`;
  } else $('#chart').innerHTML = '';
  const r = rows[reviewIndex - 1];
  $('#review-detail').innerHTML = r
    ? `<strong class="grade-${r.kind}">${r.icon} ${r.san} · ${r.label}</strong><br><small>${r.best === r.san ? '엔진이 추천한 최선의 수를 두었어요.' : `추천 수는 <b>${r.best}</b>예요. 이 수를 비교해 보세요.`}<br>백 기준 평가 ${(r.score / 100).toFixed(2)} · 손실 ${(r.loss / 100).toFixed(2)}</small>`
    : reviewIndex === 0 ? '처음 위치예요. → 버튼으로 한 수씩 살펴보세요.' : !count ? '먼저 한 판을 두면 여기에 리뷰가 생겨요.' : '분석을 시작하면 이 수의 평가와 추천 수를 볼 수 있어요.';
  $('#review-list').innerHTML = rows.map((row, i) => row ? `<button class="review-row ${reviewIndex === i + 1 ? 'current' : ''}" data-review="${i + 1}"><span>${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}</span><b>${row.san}</b><span class="grade-${row.kind}">${row.icon} ${row.label}</span><span>${(row.score / 100).toFixed(1)}</span></button>` : '').join('');
}

// ---------- 온라인 ----------
const matchEvents = {
  status: (s, message) => {
    if (s === 'error') {
      if (onlineBusy()) { ended = { winner: 'none', text: '연결이 끊겼어' }; checkEnd(); }
      onlineMessage(message || '연결이 끊겼어.');
      dropMatch(); onlineStage = 'idle'; render();
    }
  },
  peer: () => render(),
  start: ({ color, time }) => {
    onlineStage = 'idle';
    if (mode !== 'online') { mode = 'online'; }
    clearBoardState();
    myColor = color; flipped = color === 'b'; timeControl = time; clock = [time, time]; started = true; lastTick = performance.now();
    if (view !== 'play') showView('play');
    play('notify');
    render();
    showSpeech(`${colorName(color)}이야. 잘해 보자!`, 'me', 2500);
  },
  move: ({ uci, ply, ms }) => {
    if (mode !== 'online' || ply !== game.history().length || game.turn() === myColor) return;
    const m = doMove(parseUci(uci));
    if (!m) return;
    clock[idx(m.color)] = ms / 1000;
    lastTick = performance.now();
    afterMove();
  },
  end: ({ winner, reason }) => {
    if (mode !== 'online' || result()) return;
    const text = reason === 'resign' ? `${colorName(winner)} 승리 · 상대 기권` : reason === 'timeout' ? `${colorName(winner)} 승리! 상대 시간 초과`
      : reason === 'agreed' ? '합의 무승부' : reason === 'abandon' ? `${colorName(winner)} 승리 · 상대가 나갔어` : '게임 끝';
    ended = { winner, text }; checkEnd(); render();
  },
  flag: () => {
    if (game.turn() === myColor && clock[idx(myColor)] <= 1.5 && !result()) {
      ended = { winner: other(myColor), text: `${colorName(other(myColor))} 승리! 시간 초과` }; checkEnd(); render();
    }
  },
  offer: kind => {
    if (kind === 'draw-no') toast('상대가 무승부를 거절했어.');
    if (kind === 'draw' || kind === 'rematch') play('notify');
    render();
  },
  say: k => showSpeech(QUICK[k], 'opponent'),
  left: () => { render(); if (match?.over) onlineMessage('상대가 방을 나갔어.'); },
  back: () => { render(); toast('상대가 돌아왔어!'); },
  error: code => { if (code === 'rate') onlineMessage('너무 빨리 보내고 있어. 잠깐 쉬었다 해 줘.'); },
};

function newMatch(kind, time = MATCH_TIME) {
  dropMatch();
  match = new OnlineMatch(matchEvents, { kind, myRating: ratings.online.r, time });
  return match;
}
function dropMatch() { match?.close(); match = null; }
function onlineMessage(text) { $('#online-msg').textContent = text; }

function cancelOnline() {
  if (onlineStage === 'searching') social?.cancelMatch();
  if (onlineStage === 'inviting') social?.cancelInvite().catch(() => {});
  onlineStage = 'idle';
}

async function findMatch() {
  if (!net.account.loggedIn) { openAccount('login', '게임 찾기는 로그인이 필요해.'); return; }
  if (onlineStage !== 'idle' || onlineBusy()) return;
  startSocial();
  const m = newMatch('match', MATCH_TIME);
  onlineStage = 'searching'; onlineMessage(''); render();
  $('#match-wait-sub').textContent = '비슷한 때 들어온 사람과 붙어.';
  try {
    const res = await social.findMatch(GAME, m.hooks(), {}, { onQueued: () => { $('#match-wait-sub').textContent = '줄을 섰어. 조금만 기다려 줘.'; } });
    if (match !== m) { res?.room.leave(); return; }
    if (!res) { dropMatch(); onlineStage = 'idle'; render(); return; }
    onlineStage = 'room';
    m.attach(res.room, res.opponent);
    render();
  } catch (error) {
    if (match === m) dropMatch();
    onlineStage = 'idle'; onlineMessage(error.message || '게임 찾기에 실패했어.'); render();
  }
}

async function createRoom() {
  if (onlineStage !== 'idle' || onlineBusy()) return;
  const m = newMatch('code', Number($('#time-online').value));
  const room = new Room(m.hooks(), { game: GAME, maxPlayers: 2, server: net.server });
  onlineStage = 'joining'; onlineMessage(''); render();
  try {
    await room.open();
    if (match !== m) { room.leave(); return; }
    onlineStage = 'room'; m.attach(room); render();
  } catch (error) {
    if (match === m) dropMatch();
    onlineStage = 'idle'; onlineMessage(error.message || '방을 만들지 못했어.'); render();
  }
}

async function joinRoom() {
  if (onlineStage !== 'idle' || onlineBusy()) return;
  const code = normaliseCode($('#room-code').value);
  if (code.length !== 6) { onlineMessage('방 코드 6자리를 넣어 줘.'); return; }
  const m = newMatch('code', MATCH_TIME);
  const room = new Room(m.hooks(), { game: GAME, maxPlayers: 2, server: net.server });
  onlineStage = 'joining'; onlineMessage(''); render();
  try {
    await room.open(code);
    if (match !== m) { room.leave(); return; }
    if (onlineStage === 'joining') onlineStage = 'room';
    m.attach(room); render();
  } catch (error) {
    if (match === m) dropMatch();
    onlineStage = 'idle'; onlineMessage(error.message || '방에 들어가지 못했어.'); render();
  }
}

async function inviteFriend(id, nickname) {
  if (onlineStage !== 'idle' || onlineBusy() || !social) return;
  const m = newMatch('invite', MATCH_TIME);
  onlineStage = 'inviting'; invitingName = nickname; onlineMessage(''); render();
  try {
    const res = await social.invite(id, GAME, m.hooks());
    if (match !== m) { res.room.leave(); return; }
    onlineStage = 'room'; m.attach(res.room, res.opponent); render();
  } catch (error) {
    if (match === m) dropMatch();
    onlineStage = 'idle';
    onlineMessage(error.code === 'declined' ? `${nickname} 님이 지금은 어렵대.` : error.code === 'expired' ? `${nickname} 님이 대답하지 않았어.` : error.message || '초대하지 못했어.');
    render();
  }
}

function receiveInvite(inv) {
  if (inv.game !== GAME) return;
  if (onlineBusy() || onlineStage !== 'idle' || (inProgress() && mode !== 'online')) { social.declineInvite(inv.id).catch(() => {}); return; }
  play('notify');
  toast(`${inv.from.nickname} 님이 체스 한 판 하재! (10분)`, [['수락', () => acceptInvite(inv)], ['거절', () => social.declineInvite(inv.id).catch(() => {})]], 55000);
}

async function acceptInvite(inv) {
  if (onlineBusy() || (inProgress() && mode !== 'online')) { toast('지금 하던 대전을 먼저 끝내 줘.'); return; }
  if (view === 'puzzle' || view === 'rush' || view === 'home' || view === 'review') showView('play');
  if (!setMode('online')) return;
  const m = newMatch('invite', MATCH_TIME);
  onlineStage = 'joining'; render();
  try {
    const res = await social.acceptInvite(inv.id, m.hooks());
    if (match !== m) { res.room.leave(); return; }
    if (onlineStage === 'joining') onlineStage = 'room';
    m.attach(res.room, res.opponent); render();
  } catch (error) {
    if (match === m) dropMatch();
    onlineStage = 'idle'; onlineMessage(error.message || '초대가 끝났어.'); render();
  }
}

function renderOnlineSetup() {
  const user = net.account.user, logged = net.account.loggedIn;
  $('#account-name').textContent = logged ? `${user?.nickname ?? '나'} 님` : '손님';
  $('#account-note').textContent = logged ? `온라인 점수 ${ratings.online.r} · ${liveStatus === 'online' ? '접속 중' : '연결 중…'}` : '로그인하면 게임 찾기와 친구 초대를 할 수 있어.';
  $('#account-btn').textContent = logged ? '계정' : '로그인';
  const waiting = onlineStage === 'searching' || onlineStage === 'inviting';
  $('#find-match').hidden = waiting;
  $('#find-match').disabled = onlineStage !== 'idle';
  $('#match-wait').hidden = !waiting;
  if (onlineStage === 'inviting') $('#match-wait').querySelector('b').textContent = `${invitingName} 님의 대답을 기다리는 중…`;
  else $('#match-wait').querySelector('b').textContent = '상대를 찾고 있어…';
  if (onlineStage === 'inviting') $('#match-wait-sub').textContent = '60초 안에 수락하면 바로 시작해.';
  const inRoom = (onlineStage === 'room' || onlineStage === 'joining') && match && !onlineBusy();
  $('#room-wait').hidden = !inRoom;
  if (inRoom) {
    const code = match.room?.code;
    $('#room-code-show').textContent = match.kind === 'code' ? (code || '…') : '';
    $('#room-wait').querySelector('small').textContent = match.kind === 'code'
      ? (match.room?.host ? '친구에게 이 코드를 알려 줘. 친구가 들어오면 바로 시작해.' : '방에 들어왔어. 곧 시작해.')
      : '상대와 연결하고 있어. 곧 시작해.';
  }
  for (const id of ['#room-create', '#room-join']) $(id).disabled = onlineStage !== 'idle';
  renderFriends();
}

function renderOnlineLive() {
  $('#quick-says').innerHTML = QUICK.map((q, k) => `<button data-say="${k}">${q}</button>`).join('');
  const box = $('#offer-box');
  if (onlineBusy() && match.peerDraw) {
    box.innerHTML = '<span>상대가 무승부를 제안했어.</span><button class="pill" data-offer="draw-yes">수락</button><button class="pill" data-offer="draw-no">거절</button>';
    box.hidden = false;
  } else if (match.over && match.peerRematch && !match.wantRematch) {
    box.innerHTML = '<span>상대가 한 판 더 하재!</span><button class="pill" data-offer="rematch">좋아</button>';
    box.hidden = false;
  } else box.hidden = true;
}

// ---------- 계정과 친구 ----------
function renderLive() {
  const logged = net.account.loggedIn, name = net.account.user?.nickname;
  $('#rail-name').textContent = logged ? name ?? '나' : '손님';
  $('#rail-sub').textContent = logged ? (liveStatus === 'online' ? '접속 중' : '연결 중…') : '로그인하기';
  $('#live-dot').className = `online-dot ${logged && liveStatus === 'online' ? '' : 'off'}`;
  $('#live-text').textContent = logged ? (liveStatus === 'online' ? `${name} · 온라인` : '연결 중…') : '손님 · 오프라인';
}

function startSocial() {
  if (social || !net.account.loggedIn) return;
  social = net.social({
    status: s => { liveStatus = s; renderLive(); if (mode === 'online' && view === 'play' && !onlineBusy()) renderOnlineSetup(); },
    online: () => markFriends(), offline: () => markFriends(),
    friendRequest: from => { toast(`${from.nickname} 님이 친구 요청을 보냈어.`); loadFriends(); },
    friendAccepted: friend => { toast(`${friend.nickname} 님과 친구가 됐어!`); loadFriends(); },
    friendRemoved: () => loadFriends(),
    invite: inv => receiveInvite(inv),
    inviteCanceled: () => hideToast(),
    kicked: () => { toast('계정 연결이 끊겼어. 다시 로그인해 줘.'); stopSocial(); renderLive(); },
  });
  social.live().catch(() => {});
}
function stopSocial() { social?.cancelMatch(); social?.close(); social = null; liveStatus = 'offline'; friends = []; incoming = []; }

function markFriends() {
  if (!social) return;
  for (const f of friends) f.online = social.onlineFriends.has(f.id);
  if (mode === 'online' && view === 'play') renderFriends();
}

async function loadFriends() {
  if (!social) { friends = []; incoming = []; renderFriends(); return; }
  try {
    const [list, requests] = await Promise.all([social.friends(), social.requests()]);
    friends = list; incoming = requests.incoming ?? [];
  } catch (error) { onlineMessage(error.message || '친구 목록을 불러오지 못했어.'); }
  renderFriends();
}

function renderFriends() {
  if (!net.account.loggedIn) {
    $('#friend-requests').innerHTML = '';
    $('#friend-list').innerHTML = '<p class="empty-note">로그인하면 친구 목록이 보여.</p>';
    $('#friend-add').hidden = true;
    return;
  }
  $('#friend-add').hidden = false;
  $('#friend-requests').innerHTML = incoming.map(r => `<div class="friend-row request"><span class="online-dot"></span><b>${esc(r.nickname)}</b><small>친구 요청</small><button class="pill" data-accept="${r.id}">수락</button><button class="pill ghost" data-decline="${r.id}">거절</button></div>`).join('');
  const sorted = [...friends].sort((a, b) => Number(b.online) - Number(a.online));
  const idle = onlineStage === 'idle' && !onlineBusy();
  $('#friend-list').innerHTML = sorted.length
    ? sorted.map(f => `<div class="friend-row"><span class="online-dot ${f.online ? '' : 'off'}"></span><b>${esc(f.nickname)}</b><small>${f.online ? '접속 중' : '오프라인'}</small><button class="pill" data-invite="${f.id}" data-name="${esc(f.nickname)}" ${f.online && idle ? '' : 'disabled'}>초대</button></div>`).join('')
    : '<p class="empty-note">아직 친구가 없어. 아래에 친구 닉네임을 넣어 봐.</p>';
}

let accountMode = 'login';
function openAccount(nextMode = 'login', note = '') {
  const logged = net.account.loggedIn;
  accountMode = nextMode;
  $('#account-heading').textContent = logged ? `${net.account.user?.nickname ?? ''} 님` : accountMode === 'signup' ? '계정 만들기' : '로그인';
  for (const id of ['#account-nickname', '#account-password']) { $(id).closest('form').querySelector(`label[for="${id.slice(1)}"]`).hidden = logged; $(id).hidden = logged; $(id).required = !logged; }
  $('#account-confirm-row').hidden = logged || accountMode !== 'signup';
  $('#account-confirm').required = !logged && accountMode === 'signup';
  $('#account-password').autocomplete = accountMode === 'signup' ? 'new-password' : 'current-password';
  $('#account-submit').hidden = logged;
  $('#account-submit').textContent = accountMode === 'signup' ? '가입하고 시작' : '로그인';
  $('#account-switch').hidden = logged;
  $('#account-switch').textContent = accountMode === 'signup' ? '이미 계정이 있어' : '처음 왔어 · 계정 만들기';
  $('#account-logout').hidden = !logged;
  $('#account-error').textContent = note;
  if (!$('#account-dialog').open) $('#account-dialog').showModal();
  if (!logged) $('#account-nickname').focus();
}

$('#account-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (net.account.loggedIn) return;
  const nickname = $('#account-nickname').value.trim(), password = $('#account-password').value;
  if (accountMode === 'signup' && password !== $('#account-confirm').value) { $('#account-error').textContent = '두 비밀번호가 서로 달라.'; return; }
  const controls = [...$('#account-form').querySelectorAll('button, input')];
  controls.forEach(el => { el.disabled = true; });
  $('#account-error').textContent = '연결하고 있어…';
  try {
    if (accountMode === 'signup') await net.account.signup(nickname, password);
    else await net.account.login(nickname, password);
    $('#account-dialog').close();
    $('#account-form').reset();
    startSocial(); loadFriends(); render();
    toast(`${net.account.user?.nickname ?? ''} 님, 어서 와!`);
  } catch (error) { $('#account-error').textContent = error.message || '로그인하지 못했어.'; }
  finally { controls.forEach(el => { el.disabled = false; }); }
});
$('#account-switch').onclick = () => openAccount(accountMode === 'login' ? 'signup' : 'login');
$('#account-cancel').onclick = () => $('#account-dialog').close();
$('#account-logout').onclick = async () => {
  if (onlineBusy()) { $('#account-error').textContent = '대전이 끝난 뒤에 로그아웃해 줘.'; return; }
  cancelOnline(); dropMatch(); stopSocial();
  try { await net.account.logout(); } catch { /* 이 기기에서는 지워짐 */ }
  $('#account-dialog').close(); render();
};

// ---------- 알림 ----------
function toast(text, actions = [], ms = 4000) {
  $('#toast-text').textContent = text;
  const box = $('#toast-actions');
  box.innerHTML = '';
  for (const [label, fn] of actions) {
    const b = document.createElement('button');
    b.className = 'pill';
    b.textContent = label;
    b.onclick = () => { hideToast(); fn(); };
    box.append(b);
  }
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
}
function hideToast() { $('#toast').hidden = true; }

// ---------- 퍼즐, 러시 ----------
const puzzleUI = new PuzzleUI({
  bank,
  rating: () => ratings.puzzle.r,
  onRated: (puzzle, clean) => {
    const change = applyResult(ratings, 'puzzle', puzzle.rating, clean ? 1 : 0);
    saveRatings(ratings); renderRatings();
    return ` 퍼즐 점수 ${change.after} (${signed(change.delta)})`;
  },
  sound: kind => play(kind),
});
const rushUI = new RushUI({
  bank,
  best: m => ratings.rush[m],
  record: (m, score) => { const best = recordRush(ratings, m, score); if (best) saveRatings(ratings); renderRatings(); return best; },
  sound: kind => play(kind),
});

// ---------- 누르기 ----------
$('#board').onclick = e => {
  if (view === 'puzzle') { puzzleUI.click(e); return; }
  if (view === 'rush') { rushUI.click(e); return; }
  const button = e.target.closest('[data-square]');
  if (!button || !canHumanMove()) return;
  const sq = button.dataset.square;
  if (selected) {
    const moves = game.moves({ square: selected, verbose: true }).filter(m => m.to === sq);
    if (moves.length) {
      if (moves[0].promotion) {
        promote = { from: selected, to: sq };
        $('#promotion').innerHTML = promotionHTML(game.turn());
        $('#promotion').classList.remove('hidden');
      } else humanMove({ from: selected, to: sq });
      return;
    }
  }
  selected = game.get(sq)?.color === game.turn() && selected !== sq ? sq : null;
  hints = hints.length && selected ? hints : [];
  renderBoard();
};
$('#promotion').onclick = e => {
  if (view === 'puzzle') { puzzleUI.choosePromotion(e); return; }
  if (view === 'rush') { rushUI.choosePromotion(e); return; }
  const p = e.target.closest('[data-promote]');
  if (!p || !promote) return;
  const m = { ...promote, promotion: p.dataset.promote };
  promote = null; hidePromotion();
  humanMove(m);
};

for (const b of $$('.nav[data-view], .tabs [data-view]')) b.onclick = () => showView(b.dataset.view);
$('#mode-switch').onclick = e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); };
$('#bot-grid').onclick = e => { const b = e.target.closest('[data-bot]'); if (b && !inProgress()) { botId = b.dataset.bot; showSpeech(botById(botId).lines.greet, 'opponent'); render(); } };
$('#color-pick').onclick = e => { const b = e.target.closest('[data-color]'); if (b) { colorChoice = b.dataset.color; renderBotSetup(); } };
$('#new-game').onclick = newGame;
$('#new-local').onclick = newGame;
$('#undo').onclick = () => {
  if (mode === 'online' || !game.history().length) return;
  stopWorker();
  game.undo();
  if (mode === 'ai' && game.turn() !== myColor && game.history().length) game.undo();
  if (mode === 'ai') assisted = true;
  ended = null; resultNote = null; selected = null; hints = []; rows = []; analysisDone = false;
  lastMove = game.history({ verbose: true }).at(-1) ?? null;
  render(); maybeBotMove();
};
$('#hint').onclick = () => {
  if (result() || !started) return;
  if (mode === 'ai') assisted = true;
  run({ type: 'hint', fen: game.fen(), history: positionKeys() });
  thinking = true;
  render();
  $('#status-sub').textContent = '좋은 수를 찾고 있어…';
};
$('#resign').onclick = resign;
$('#online-resign').onclick = resign;
$('#offer-draw').onclick = () => { if (onlineBusy()) { match.offerDraw(); render(); toast('무승부를 제안했어.'); } };
$('#rematch').onclick = () => { match?.rematch(); render(); };
$('#add-opponent').onclick = async () => {
  if (!social || !match?.opponent) return;
  try { const res = await social.requestFriend(match.opponent.id); toast(res.status === 'friends' ? '친구가 됐어!' : '친구 요청을 보냈어.'); loadFriends(); } catch (error) { toast(error.message || '친구 요청을 보내지 못했어.'); }
};
$('#leave-room').onclick = () => { dropMatch(); onlineStage = 'idle'; render(); };
$('#quick-says').onclick = e => {
  const b = e.target.closest('[data-say]');
  if (!b || !match?.peer) return;
  if (Date.now() - lastSay < 1500) return;
  lastSay = Date.now();
  const k = Number(b.dataset.say);
  match.say(k); showSpeech(QUICK[k], 'me');
};
$('#offer-box').onclick = e => {
  const b = e.target.closest('[data-offer]');
  if (!b || !match) return;
  if (b.dataset.offer === 'draw-yes') { match.answerDraw(true); ended = { winner: 'draw', text: '합의 무승부' }; checkEnd(); }
  if (b.dataset.offer === 'draw-no') match.answerDraw(false);
  if (b.dataset.offer === 'rematch') match.rematch();
  render();
};
$('#find-match').onclick = findMatch;
$('#cancel-match').onclick = () => { cancelOnline(); dropMatch(); render(); };
$('#room-create').onclick = createRoom;
$('#room-join').onclick = joinRoom;
$('#room-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('#room-cancel').onclick = () => { dropMatch(); onlineStage = 'idle'; render(); };
$('#account-btn').onclick = () => openAccount('login');
$('#rail-account').onclick = () => openAccount('login');
$('#friends-refresh').onclick = () => { if (!net.account.loggedIn) openAccount('login'); else loadFriends(); };
$('#friend-list').onclick = e => { const b = e.target.closest('[data-invite]'); if (b) inviteFriend(Number(b.dataset.invite), b.dataset.name); };
$('#friend-requests').onclick = async e => {
  const accept = e.target.closest('[data-accept]'), decline = e.target.closest('[data-decline]');
  try {
    if (accept) { await social.acceptFriend(Number(accept.dataset.accept)); toast('친구가 됐어!'); }
    if (decline) await social.declineFriend(Number(decline.dataset.decline));
  } catch (error) { onlineMessage(error.message); }
  loadFriends();
};
$('#friend-add').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#friend-name').value.trim();
  if (!name || !social) return;
  try {
    const res = await social.requestFriend(name);
    onlineMessage(res.status === 'friends' ? `${name} 님과 친구가 됐어!` : `${name} 님에게 친구 요청을 보냈어.`);
    $('#friend-name').value = '';
    loadFriends();
  } catch (error) { onlineMessage(error.message || '친구 요청을 보내지 못했어.'); }
});
$('#home-view').onclick = e => {
  const go = e.target.closest('[data-go]'), bot = e.target.closest('[data-bot-go]');
  if (bot) { if (setMode('ai')) { botId = bot.dataset.botGo; showView('play'); showSpeech(botById(botId).lines.greet, 'opponent'); } return; }
  if (!go) return;
  const where = go.dataset.go;
  if (where === 'online' || where === 'friends') { if (setMode('online')) { showView('play'); if (where === 'friends') $('#room-code').focus(); } }
  else if (where === 'ai') { if (setMode('ai')) showView('play'); }
  else if (where === 'daily') showView('puzzle', 'daily');
  else showView(where, where === 'puzzle' ? 'mine' : undefined);
};
$('#start-review').onclick = () => { showView('review'); if (!analysisDone && !analysisRunning) analyze(); };
$('#analyze').onclick = analyze;
$('#first').onclick = () => setReviewIndex(0);
$('#prev').onclick = () => setReviewIndex(reviewIndex - 1);
$('#next').onclick = () => setReviewIndex(reviewIndex + 1);
$('#last').onclick = () => setReviewIndex(game.history().length);
$('#review-list').onclick = e => { const el = e.target.closest('[data-review]'); if (el) setReviewIndex(Number(el.dataset.review)); };
document.addEventListener('keydown', e => {
  if (view !== 'review' || ['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); setReviewIndex(reviewIndex - 1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); setReviewIndex(reviewIndex + 1); }
});
$('#export').onclick = () => {
  const r = result();
  const names = { w: labelFor('w').name, b: labelFor('b').name };
  game.header('Event', 'Green Chess', 'White', names.w, 'Black', names.b, 'Result', r ? (r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : r.winner === 'draw' ? '1/2-1/2' : '*') : '*');
  const url = URL.createObjectURL(new Blob([game.pgn()], { type: 'application/x-chess-pgn' })), a = document.createElement('a');
  a.href = url; a.download = 'green-chess.pgn'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('#flip').onclick = () => {
  if (view === 'puzzle') { puzzleUI.flipped = !puzzleUI.flipped; puzzleUI.renderBoard(); return; }
  if (view === 'rush') { rushUI.flipped = !rushUI.flipped; rushUI.renderBoard(); return; }
  flipped = !flipped; render();
};
$('#sound').onclick = () => { sound = !sound; $('#sound').textContent = sound ? '♪' : '♩'; $('#sound').style.opacity = sound ? '1' : '.4'; };
$('#help-nav').onclick = () => $('#help').showModal();
$('#close-help').onclick = () => $('#help').close();
window.addEventListener('pagehide', () => { if (onlineBusy()) match.resign(); dropMatch(); stopSocial(); });

// ---------- 시작 ----------
restore();
if (net.account.loggedIn) {
  startSocial();
  net.account.me().then(() => { renderLive(); loadFriends(); }).catch(error => { if (!net.account.loggedIn) { stopSocial(); toast('로그인이 풀렸어. 다시 로그인해 줘.'); } else console.warn(error); renderLive(); });
}
renderRatings();
const resume = started && !result() && game.history().length > 0;
view = '';
showView(resume ? 'play' : 'home');
