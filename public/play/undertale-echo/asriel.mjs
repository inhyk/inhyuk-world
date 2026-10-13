// 언더테일 팬 게임 · 아스리엘 드리무르 보스전 흐름 (DOM 없음)
// 세 막으로 이루어진다.
//  1막 절대신   : 스타 블레이징 → 카오스 세이버 → 쇼커 브레이커 → 카오스 버스터 → 하이퍼 고너
//  (변신)       : 모든 영혼의 힘을 끌어올려 최후의 형태가 된다.
//  2막 최후의 형태: 갤럭타 블레이징 → 카오스 슬라이서 → 쇼커 브레이커 II → 진짜 마지막 공격
//  (거부)       : HP가 0이 되지만 영혼이 사라지기를 거부한다. 자비 버튼이 "구하기"로 바뀐다.
//  3막 구원     : 잃어버린 영혼 셋을 구하고, 마지막으로 아스리엘을 구한다.
// HP가 0이 되어도 이 전투에서는 죽지 않는다. 대신 친구들의 목소리가 영혼을 붙잡는다.
import { say, enemyTurn, heal, BOX_DEFAULT, BOX_CENTER } from './core.mjs';

export const GOD_SEQUENCE = ['asStarBlazing', 'asChaosSaber', 'asShockerBreaker', 'asChaosBuster', 'asHyperGoner'];
export const FINAL_SEQUENCE = ['asGalactaBlazing', 'asChaosSlicer', 'asShockerBreaker2', 'asFinalBeam'];
export const ASRIEL_SEQUENCE = ['asDesperate1', 'asDesperate2', 'asTears'];
export const ATTACK_NAMES = { asStarBlazing: '스타 블레이징', asChaosSaber: '카오스 세이버', asShockerBreaker: '쇼커 브레이커', asChaosBuster: '카오스 버스터', asHyperGoner: '하이퍼 고너',
  asGalactaBlazing: '갤럭타 블레이징', asChaosSlicer: '카오스 슬라이서', asShockerBreaker2: '쇼커 브레이커 II', asFinalBeam: '진짜 마지막 공격' };

// 잃어버린 영혼: 두 사람씩, 각자의 기억이 담긴 탄막과 행동을 갖는다.
export const LOST_SOULS = [
  { id: 'waterfall', names: ['언다인', '알피스'], sprites: ['undyne', 'alphys'], pattern: 'lsUndyneAlphys', colors: ['#2fd86a', '#ffe14a'],
    encounter: ['* 잃어버린 영혼들이 앞을 막아선다.', '* 언다인: "인간은… 없애야 해… 그게… 내 일이었나…?"', '* 알피스: "모, 몰라… 아무것도 기억이 안 나…"'],
    speech: ['언다인: "비켜… 아니, 넌… 누구지…?"', '알피스: "이, 이 느낌… 어디서…"', '언다인: "왜 도망치지 않는 거야…"'],
    acts: [{ id: 'water', name: '물 한 잔', text: ['* 언다인에게 차가운 물 한 잔을 건넸다.', '* 언다인의 눈빛이 크게 흔들린다.'] },
      { id: 'anime', name: '만화 이야기', text: ['* 알피스가 좋아하던 만화의 결말 이야기를 꺼냈다.', '* 알피스가 작게, 아주 작게 웃었다.'] }],
    memory: ['* 언다인: "…이 기분, 기억나! 너는 내 부엌을 홀랑 태워 먹은 녀석이잖아!"', '* 알피스: "그, 그리고 우리… 같이 만화 보기로 했잖아요…!"'] },
  { id: 'snowdin', names: ['파피루스', '샌즈'], sprites: ['papyrus', 'sans'], pattern: 'lsPapyrusSans', colors: ['#ff8c1a', '#3b6bff'],
    encounter: ['* 잃어버린 영혼들이 앞을 막아선다.', '* 파피루스: "위대한… 음… 위대한 누구였지…?"', '* 샌즈: "…뭐, 아무래도 상관없잖아."'],
    speech: ['파피루스: "퍼즐… 퍼즐을 풀어야 하는데…"', '샌즈: "…이상하네. 너, 어디서 봤더라."', '파피루스: "인간…? 인간은… 잡아야… 친구…?"'],
    acts: [{ id: 'spaghetti', name: '스파게티', text: ['* 파피루스의 스파게티 맛을 떠올렸다.', '* 차갑고, 딱딱하고, 이상하게 따뜻한 맛이었다.'] },
      { id: 'joke', name: '뼈 있는 농담', text: ['* 샌즈에게 해골 농담을 했다. 정말로 뼈 있는 농담이었다.', '* 샌즈의 입꼬리가 아주 조금 올라간다.'] }],
    memory: ['* 파피루스: "인간!! 내 친구!!! 이 위대한 파피루스가 어떻게 너를 잊을 수 있었지!!"', '* 샌즈: "…헤. 넌 참 이상한 녀석이야. 물론, 좋은 쪽으로."'] },
  { id: 'ruins', names: ['토리엘', '아스고어'], sprites: ['toriel', 'asgore'], pattern: 'lsTorielAsgore', colors: ['#b26bff', '#ff4d5e'],
    encounter: ['* 잃어버린 영혼들이 앞을 막아선다.', '* 토리엘: "…나의 아이…? 아니야. 모르는 아이구나."', '* 아스고어: "…싸우고 싶지 않다… 그런데 왜…"'],
    speech: ['토리엘: "여긴 위험하단다… 돌아가렴…"', '아스고어: "…미안하구나. 이유는 모르겠지만…"', '토리엘: "그 눈… 어디선가…"'],
    acts: [{ id: 'hug', name: '안아 주기', text: ['* 토리엘을 꼭 안았다.', '* 버터스카치 파이 냄새가 났다.'] },
      { id: 'tea', name: '차 한잔', text: ['* 아스고어가 아끼던 황금꽃 차 이야기를 했다.', '* 커다란 손이 떨린다.'] }],
    memory: ['* 토리엘: "…그래, 기억나. 폐허에서 날 안아 준 바로 그 아이구나."', '* 아스고어: "…인간이여. 이번에는 꼭 차를 대접하고 싶구나."'] },
];

const GOD_SPEECH = ['아스리엘: "이게 뭔지 알아? 모든 영혼의 힘이야. 이제 나는 신이라고!"', '아스리엘: "넌 날 못 이겨. 나는 이 세계의 결말을 전부 봤거든."', '아스리엘: "몇 번이고 다시 해도 괜찮아. 난 영원히 기다릴 수 있으니까."', '아스리엘: "왜 아직도 서 있는 거야? 그냥 포기해!"', '아스리엘: "좋아. 그럼 진짜 힘을 보여 줄게."'];
const FINAL_SPEECH = ['아스리엘: "이 모습 어때? 이제 뭐든지 할 수 있어!"', '아스리엘: "전부 리셋할 거야. 네 기억도, 네가 만난 친구들도!"', '아스리엘: "그러면 우린 영원히 같이 놀 수 있어. 영원히!"', '아스리엘: "…이제 끝이야. 잘 가, 차라."'];
const DESPERATE_SPEECH = ['아스리엘: "가까이 오지 마…! 난… 난 널 이길 거야!"', '아스리엘: "제발… 그냥 싸워 줘… 부탁이야…!"', '아스리엘: "…흑… 흐윽…"'];
const SAVE_STAR_SPEECH = ['아스리엘: "그 녀석들은 이제 아무것도 기억 못 해!"', '아스리엘: "헛수고야. 전부 내 안에 있다고!"', '아스리엘: "…왜 날 보지 않는 거야?"'];
const REFUSE_VOICES = ['* 토리엘의 목소리가 들린다. "일어나렴, 나의 아이. 아직 끝나지 않았단다."', '* 파피루스의 목소리가 들린다. "인간!! 넌 할 수 있어!! 이 몸이 보장한다!!"', '* 언다인의 목소리가 들린다. "쓰러지지 마! 끝까지 버텨!"', '* 샌즈의 목소리가 들린다. "…헤. 아직 포기하기엔 이르잖아."', '* 알피스의 목소리가 들린다. "제, 제발… 결의를 잃지 말아요!"', '* 모두의 목소리가 들린다. "결의를 잃지 마!"'];
const FLAVOR = {
  god: ['* 아스리엘이 모든 영혼의 힘을 두르고 떠 있다.', '* 별빛이 부서져 내린다.', '* 아스리엘이 웃고 있다. 어딘가 슬픈 웃음이다.', '* 공기가 무지개빛으로 떨린다.'],
  final: ['* 무지개빛 날개가 세계를 덮는다.', '* 아스리엘의 눈동자가 하얗게 타오른다.', '* 시간과 공간이 비명을 지른다.'],
  save: ['* 당신의 영혼이 아직 여기에 있다.', '* 어둠 속에서 잃어버린 영혼들이 떠돈다.', '* 구할 수 있는 누군가가 있다.'],
  lost: ['* 잃어버린 영혼들이 앞을 막아선다.', '* 그들의 눈에는 아무것도 비치지 않는다.', '* 희미한 기억이 흔들린다.'],
  asriel: ['* 아스리엘이 떨고 있다.', '* 무지개빛이 조금씩 흐려진다.', '* 날개 끝이 부서져 흩날린다.'],
};
// 연출 길이 (초)
export const CINE = { intro: 5.6, transform: 6.6, refuseSmall: 2.8, refuse: 7.2, soulFocus: 1.4, soulSaved: 3, finale: 9 };

const ev = (b, type, name) => b.asr.events.push({ type, name });
// "언다인과 알피스", "파피루스와 샌즈": 앞 이름의 받침에 맞춰 조사를 고른다.
export const pairName = ([a, b]) => { const code = a.charCodeAt(a.length - 1) - 0xAC00; return `${a}${code >= 0 && code < 11172 && code % 28 ? '과' : '와'} ${b}`; };
export const allSaved = b => b.asr.souls.every(s => s.saved);

export function init(b) {
  b.asr = { phase: 'god', t: 0, round: 0, hope: 0, dreams: 3, refusals: 0, struggles: 0, calls: 0,
    souls: LOST_SOULS.map(s => ({ ...s, progress: 0, saved: false })), focus: null, asrielSave: 0,
    events: [], cine: null, morph: 0, lastPattern: null, saveFlash: 0 };
  b.text = null;
  ev(b, 'music', null);
  startCine(b, 'intro', () => {
    ev(b, 'music', 'asriel');
    say(b, ['* 아스리엘 드리무르가 모든 영혼의 힘을 두르고 내려앉는다.', '* 아스리엘: "자, 시작하자. 우리 둘만의 마지막 놀이를."'], () => { b.mode = 'menu'; });
  });
}

// ---------- 연출 ----------
export function startCine(b, kind, onDone, data = {}) {
  b.asr.cine = { kind, t: 0, duration: CINE[kind], onDone, fired: {}, ...data };
  b.mode = 'cine'; b.submenu = null;
}
const cueAt = (c, key, time, fn) => { if (!c.fired[key] && c.t >= time) { c.fired[key] = true; fn(); } };
function cues(b, c) {
  const e = type => name => () => ev(b, type, name);
  switch (c.kind) {
    case 'intro': cueAt(c, 'rise', .2, e('sfx')('charge')); cueAt(c, 'flash', 1.5, () => { ev(b, 'sfx', 'transform'); ev(b, 'shake'); }); cueAt(c, 'title', 3.1, e('sfx')('shine')); break;
    case 'transform': cueAt(c, 'crack', .3, e('sfx')('crack')); cueAt(c, 'crack2', 1, e('sfx')('crack')); cueAt(c, 'white', 2.3, () => { ev(b, 'sfx', 'transform'); ev(b, 'shake'); }); cueAt(c, 'music', 3, e('music')('asriel_final')); cueAt(c, 'title', 3.7, e('sfx')('shine')); break;
    case 'refuse': cueAt(c, 'crack', .7, e('sfx')('crack')); cueAt(c, 'break', 1.3, () => { ev(b, 'sfx', 'shatter'); ev(b, 'music', null); }); cueAt(c, 'text', 2.8, e('sfx')('refuse')); cueAt(c, 'mend', 4.3, () => { ev(b, 'sfx', 'mend'); ev(b, 'shake'); }); cueAt(c, 'save', 5.5, () => { ev(b, 'sfx', 'shine'); ev(b, 'music', 'asriel_save'); }); break;
    case 'refuseSmall': cueAt(c, 'crack', .25, e('sfx')('crack')); cueAt(c, 'mend', 1.3, e('sfx')('mend')); break;
    case 'soulFocus': cueAt(c, 'in', .1, e('sfx')('lost')); break;
    case 'soulSaved': cueAt(c, 'color', .5, e('sfx')('shine')); cueAt(c, 'rise', 1.4, e('sfx')('soulSave')); break;
    case 'finale': cueAt(c, 'shake', .2, () => { ev(b, 'shake'); ev(b, 'sfx', 'crack'); }); cueAt(c, 'shatter', 1.6, () => { ev(b, 'sfx', 'shatter'); ev(b, 'music', null); }); cueAt(c, 'white', 2.6, e('sfx')('transform')); cueAt(c, 'child', 3.6, e('music')('asriel_tears')); break;
  }
}
export function tick(b, dt) {
  const A = b.asr; A.t += dt; if (A.morph > 0 && A.morph < 1 && A.phase === 'save') A.morph = Math.min(1, A.morph + dt / 1.4);
  if (A.saveFlash > 0) A.saveFlash = Math.max(0, A.saveFlash - dt);
  if (b.mode !== 'cine' || !A.cine) return;
  const c = A.cine; c.t += dt; cues(b, c);
  if (c.t >= c.duration) { const done = c.onDone; A.cine = null; if (done) done(); }
}
// Z로 연출을 넘긴다. 남은 효과음은 생략하고 음악 전환만 반영한다.
export function skipCine(b) {
  const A = b.asr, c = A?.cine; if (!c || c.t < .9) return false;
  const before = A.events.length; c.t = c.duration; cues(b, c);
  const fresh = A.events.splice(before).filter(e => e.type === 'music'); A.events.push(...fresh);
  tick(b, 0); return true;
}

// ---------- 메뉴 ----------
export function flavor(b) {
  const A = b.asr, i = b.flavorIndex;
  if (A.phase === 'save') { const pool = A.focus !== null ? FLAVOR.lost : allSaved(b) ? FLAVOR.asriel : FLAVOR.save; return pool[i % pool.length]; }
  const pool = FLAVOR[A.phase] || FLAVOR.god; return pool[i % pool.length];
}
export function buttons(b) {
  const A = b.asr;
  if (A.phase === 'save' || A.phase === 'end') return [{ id: 'fight', label: '발버둥', en: 'STRUGGLE', dim: true }, { id: 'act', label: '행동', en: 'ACT' }, { id: 'item', label: '아이템', en: 'ITEM' }, { id: 'mercy', label: '구하기', en: 'SAVE', glow: true, morph: A.morph }];
  return [{ id: 'fight', label: '공격', en: 'FIGHT' }, { id: 'act', label: '행동', en: 'ACT' }, { id: 'item', label: '아이템', en: 'ITEM' }, { id: 'mercy', label: '자비', en: 'MERCY' }];
}
export function chooseAction(b, action) {
  const A = b.asr;
  if (A.phase === 'save') {
    if (action === 'fight') {
      A.struggles++;
      say(b, A.struggles === 1 ? ['* 당신은 발버둥쳤다.', '* …이 싸움은 싸워서 끝나는 게 아니다.'] : ['* 당신은 발버둥쳤다.', '* 아무 일도 일어나지 않았다.'], () => enemyTurn(b));
      return true;
    }
    if (action === 'act') { b.submenu = { kind: 'asAct', items: actItems(b) }; b.sub = 0; b.mode = 'submenu'; return true; }
    if (action === 'mercy') {
      const items = A.souls.map((s, i) => ({ id: s.id, index: i, name: s.saved ? pairName(s.names) : A.focus === i ? '잃어버린 영혼 (기억이 흔들린다)' : '잃어버린 영혼', done: s.saved, color: s.saved ? null : A.focus === i ? '#ffe9a8' : null }));
      if (allSaved(b)) items.push({ id: 'asriel', index: -1, name: '다른 누군가', color: '#ffe000' });
      b.submenu = { kind: 'asSave', items }; b.sub = allSaved(b) ? items.length - 1 : Math.max(0, A.souls.findIndex(s => !s.saved)); b.mode = 'submenu';
      return true;
    }
    return false; // 아이템은 평소처럼
  }
  if (action === 'act') { b.submenu = { kind: 'asAct', items: actItems(b) }; b.sub = 0; b.mode = 'submenu'; return true; }
  if (action === 'mercy') { say(b, A.phase === 'final' ? ['* 자비를 베풀려 했다.', '* 아스리엘: "자비? 하하! 이제 와서?"'] : ['* 자비를 베풀려 했다.', '* 아스리엘은 받아들이지 않는다. …아직은.'], () => enemyTurn(b)); return true; }
  return false; // 공격·아이템은 기본 흐름
}
function actItems(b) {
  const A = b.asr;
  if (A.phase === 'save' && A.focus !== null) { const s = A.souls[A.focus]; return [{ id: 'checkSoul', name: '조사' }, ...s.acts.map(a => ({ id: a.id, name: a.name }))]; }
  if (A.phase === 'save') return [{ id: 'check', name: '조사' }, { id: 'call', name: '이름 부르기' }];
  return [{ id: 'check', name: '조사' }, { id: 'hope', name: '희망' }, { id: 'dream', name: A.dreams > 0 ? `꿈 (${A.dreams})` : '꿈' }];
}
export function chooseSub(b, item, kind) {
  if (kind === 'asAct') { b.submenu = null; doAct(b, item.id); return true; }
  if (kind === 'asSave') { if (item.done) return true; b.submenu = null; if (item.index < 0) saveAsriel(b); else saveSoul(b, item.index); return true; }
  return false;
}
function doAct(b, id) {
  const A = b.asr, p = b.player;
  if (id === 'check') {
    const lines = A.phase === 'god' ? ['* 아스리엘 드리무르 - AT ∞ DF ∞', '* 모든 영혼의 힘을 가진 절대신. …그리고 겁먹은 아이.'] : A.phase === 'final' ? ['* 아스리엘 드리무르 - 최후의 형태.', '* 무지개빛 날개 뒤로 무언가를 숨기고 있다.'] : allSaved(b) ? ['* 아스리엘 드리무르.', '* 날개가 부서지고 있다. 이제 그의 힘은 무섭지 않다.'] : ['* 아스리엘 드리무르.', '* 그의 안에서 잃어버린 영혼들이 잠들어 있다.'];
    say(b, lines, () => enemyTurn(b)); return;
  }
  if (id === 'hope') { A.hope = 1; ev(b, 'sfx', 'shine'); say(b, ['* 당신은 희망을 굳게 붙잡았다.', '* 영혼이 금빛으로 빛난다. 이번 공격의 피해가 절반이 된다.'], () => enemyTurn(b)); return; }
  if (id === 'dream') {
    let lines;
    if (A.dreams > 0) { A.dreams--; heal(p, p.maxHp); lines = ['* 당신은 꿈을 꾸었다. 모두와 함께 햇살 아래 서 있는 꿈.', '* HP가 가득 찼다.']; }
    else { const h = heal(p, Math.max(6, Math.round(p.maxHp * .3))); lines = ['* 꿈이 조금 흐릿해졌다. 그래도 아직 따뜻하다.', `* HP를 ${h} 회복했다.`]; }
    ev(b, 'sfx', 'heal'); say(b, lines, () => enemyTurn(b)); return;
  }
  if (id === 'call') {
    A.calls++;
    say(b, allSaved(b) ? ['* 아스리엘의 이름을 불렀다.', '* 아스리엘의 어깨가 움찔한다. 구하기 메뉴를 보자.'] : ['* 아스리엘의 이름을 불렀다.', '* 대답 대신 별빛이 쏟아진다. 먼저 잃어버린 영혼들을 찾아야 한다.'], () => enemyTurn(b));
    return;
  }
  if (id === 'checkSoul') { const s = A.souls[A.focus]; say(b, [`* ${pairName(s.names)} - 잃어버린 영혼.`, '* 기억 깊은 곳에 당신의 이름이 남아 있다.'], () => enemyTurn(b)); return; }
  const s = A.souls[A.focus], act = s?.acts.find(a => a.id === id);
  if (act) { completeSoul(b, A.focus, act.text); return; }
  say(b, '* 아무 일도 일어나지 않았다.', () => enemyTurn(b));
}
function saveSoul(b, i) {
  const A = b.asr, s = A.souls[i];
  if (s.progress >= 1 && A.focus === i) { completeSoul(b, i, ['* 당신은 두 영혼에게 손을 내밀었다.', '* 흐릿한 기억 너머로 따뜻한 무언가가 번진다.']); return; }
  A.focus = i; s.progress = Math.max(1, s.progress);
  startCine(b, 'soulFocus', () => say(b, ['* 당신은 잃어버린 영혼에게 손을 내밀었다.', ...s.encounter], () => enemyTurn(b)));
}
function completeSoul(b, i, lead) {
  const A = b.asr, s = A.souls[i], p = b.player;
  s.saved = true; s.progress = 2; A.focus = null; heal(p, p.maxHp);
  startCine(b, 'soulSaved', () => {
    const lines = [...lead, ...s.memory, '* 두 영혼이 기억을 되찾았다. HP가 가득 찼다.'];
    if (allSaved(b)) lines.push('* 모두의 마음이 돌아왔다.', '* 아스리엘: "…그만… 그만해… 다들 왜 그 녀석 편인 거야…!"', '* 이제 남은 건… 아스리엘뿐이다.');
    say(b, lines, () => enemyTurn(b));
  }, { soul: i });
}
function saveAsriel(b) {
  const A = b.asr; A.asrielSave++;
  const lines = [
    ['* 당신은 아스리엘에게 손을 뻗었다.', '* 아스리엘: "…뭐 하는 거야? 친구들은 다 돌려받았잖아. 날 구할 필요는 없어!"'],
    ['* 당신은 멈추지 않았다. 아스리엘의 공격이 흐트러진다.', '* 아스리엘: "…왜? 왜 날 포기하지 않는 거야? 난 모두를 없애려고 했는데."'],
    ['* 당신은 아스리엘을 구하려 한다.', '* 아스리엘의 눈에 눈물이 고인다.', '* 아스리엘: "…나… 사실 무서웠어. 다시 꽃이 되면, 아무것도 느낄 수 없으니까."'],
  ][Math.min(2, A.asrielSave - 1)];
  A.saveFlash = 1; ev(b, 'sfx', 'shine');
  say(b, lines, () => enemyTurn(b));
}
export function afterStrike(b) {
  const d = b.lastDamage, A = b.asr;
  const lines = d?.label === 'MISS' ? ['* 공격이 빗나갔다.'] : A.phase === 'final' ? ['* 공격이 날개에 닿았다.', '* 아스리엘: "간지러워. 하하하!"'] : ['* 공격이 닿았다. …흠집 하나 나지 않는다.', '* 아스리엘: "그게 다야?"'];
  say(b, lines, () => enemyTurn(b));
}

// ---------- 적의 턴 ----------
export function pickPattern(b) {
  const A = b.asr;
  if (A.phase === 'god') return GOD_SEQUENCE[Math.min(A.round, GOD_SEQUENCE.length - 1)];
  if (A.phase === 'final') return FINAL_SEQUENCE[Math.min(A.round, FINAL_SEQUENCE.length - 1)];
  if (A.focus !== null) return A.souls[A.focus].pattern;
  if (allSaved(b) && A.asrielSave > 0) return ASRIEL_SEQUENCE[Math.min(A.asrielSave, 3) - 1];
  return 'asSaveStars';
}
export function speech(b) {
  const A = b.asr, n = b.turn;
  if (A.phase === 'god') return GOD_SPEECH[Math.min(A.round, GOD_SPEECH.length - 1)];
  if (A.phase === 'final') return FINAL_SPEECH[Math.min(A.round, FINAL_SPEECH.length - 1)];
  if (A.focus !== null) { const s = A.souls[A.focus]; return s.speech[n % s.speech.length]; }
  if (allSaved(b) && A.asrielSave > 0) return DESPERATE_SPEECH[Math.min(A.asrielSave, 3) - 1];
  return SAVE_STAR_SPEECH[n % SAVE_STAR_SPEECH.length];
}
export function roundStarted(b) {
  const A = b.asr; A.lastPattern = b.attack?.name;
  const def = b.attack?.def;
  if (def?.finalBeam) ev(b, 'music', null);
}
// finishRound 뒤에 불린다. 막 전환과 결말을 여기서 결정한다.
export function afterRound(b, name) {
  const A = b.asr; A.hope = 0;
  const lost = A.souls.find(s => s.pattern === name); if (lost) lost.calm = true; // 한 번 공격을 버텨 주면 다음부터는 탄막이 머뭇거린다
  if (A.phase === 'god') {
    A.round++;
    if (name === 'asHyperGoner') {
      startCine(b, 'transform', () => {
        A.phase = 'final'; A.round = 0; b.flavorIndex = 0;
        say(b, ['* 아스리엘이 모든 영혼의 힘을 끌어올렸다.', '* 아스리엘: "하하… 하하하! 이게 내 진짜 모습이야!"', '* 아스리엘: "이 힘이라면… 모든 걸 처음부터 다시 할 수 있어!"'], () => { b.mode = 'menu'; });
      });
    }
    return;
  }
  if (A.phase === 'final') {
    A.round++;
    if (name === 'asFinalBeam') bigRefusal(b); // 이론상 버틸 수 없지만, 버티더라도 이야기는 이어진다
    return;
  }
  if (A.phase === 'save' && name === 'asTears') {
    startCine(b, 'finale', () => {
      A.phase = 'end';
      say(b, ['* 무지개빛 날개가 부서져 흩어졌다.', '* 그곳에는 울고 있는 작은 아이 하나만이 남았다.', '* 아스리엘: "…미안해. 정말… 정말 미안해."', '* 아스리엘: "난 그냥… 다시 혼자가 되는 게 무서웠어."'], () => { b.ended = 'special'; b.result = { exp: 0, gold: 0 }; b.mode = 'end'; });
    });
  }
}

// ---------- HP 0 ----------
// 매 프레임 충돌 뒤에 불린다. 전투를 가로챘으면 true.
export function guard(b) {
  const p = b.player, def = b.attack?.def;
  if (def?.floorHp && p.hp < def.floorHp) p.hp = def.floorHp;
  if (p.hp > 0) return false;
  if (def?.finalBeam) bigRefusal(b); else smallRefusal(b);
  return true;
}
function resetRound(b) {
  b.bullets = []; b.attack = null; b.soul.mode = 'red'; b.soul.invincible = 0; b.trail = [];
  const bx = b.box; bx.tw = BOX_DEFAULT.w; bx.th = BOX_DEFAULT.h; bx.tx = BOX_CENTER.x; bx.ty = BOX_CENTER.y; bx.w = bx.tw; bx.h = bx.th; bx.x = bx.tx; bx.y = bx.ty;
  b.soul.x = bx.x; b.soul.y = bx.y; b.flavorIndex++;
}
function smallRefusal(b) {
  const A = b.asr, soulPos = { x: b.soul.x, y: b.soul.y };
  resetRound(b); A.hope = 0;
  const voice = REFUSE_VOICES[Math.min(A.refusals, REFUSE_VOICES.length - 1)]; A.refusals++;
  startCine(b, 'refuseSmall', () => {
    b.player.hp = b.player.maxHp;
    say(b, ['* 영혼이 금이 가는 순간…', voice, '* 당신은 다시 일어섰다. HP가 가득 찼다.'], () => { b.mode = 'menu'; });
    if (A.phase === 'god' || A.phase === 'final') A.round = Math.min(A.round + 1, A.phase === 'god' ? GOD_SEQUENCE.length - 1 : FINAL_SEQUENCE.length - 1);
  }, { x: soulPos.x, y: soulPos.y });
}
function bigRefusal(b) {
  const A = b.asr; resetRound(b); A.hope = 0; b.player.hp = 0;
  startCine(b, 'refuse', () => {
    A.phase = 'save'; A.morph = 1; b.flavorIndex = 0; b.player.hp = b.player.maxHp;
    say(b, ['* 하지만 영혼이 사라지기를 거부했다.', '* 무언가를 구할 수 있을 것 같다.', '* 자비 버튼이 "구하기"로 바뀌었다.'], () => { b.mode = 'menu'; b.menu = 3; });
  });
}

export function summary(b) {
  const A = b.asr;
  return { phase: A.phase, round: A.round, focus: A.focus, saved: A.souls.filter(s => s.saved).length, asrielSave: A.asrielSave, cine: A.cine?.kind || null, hope: A.hope, dreams: A.dreams, refusals: A.refusals };
}
