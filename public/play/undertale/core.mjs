// 언더테일 팬 게임 · 순수 게임 로직 (DOM 없음)
// 플레이어 스탯, 루트 판정, 전투 상태 기계, 영혼 이동, 탄막 충돌.
import { EXP_TABLE, ITEMS, MONSTERS, AREAS, AREA_ORDER, levelFor, maxHpFor, baseAttack, baseDefense } from './data.mjs';
import { PATTERNS } from './patterns.mjs';

export { EXP_TABLE, ITEMS, MONSTERS, AREAS, AREA_ORDER, levelFor, maxHpFor, baseAttack, baseDefense };

// ---------- 난수 ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- 플레이어 ----------
export function createPlayer(name = '프리스크') {
  return { name, exp: 0, lv: 1, hp: 20, maxHp: 20, gold: 0, weapon: 'stick', armor: 'bandage', items: ['candy'],
    kills: 0, areaKills: { ruins: 0, snowdin: 0, waterfall: 0, hotland: 0 }, bossFate: {}, flags: {}, deaths: 0 };
}
export function attackStat(p) { return baseAttack(p.lv) + (ITEMS[p.weapon]?.weapon || 0); }
export function defenseStat(p) { return baseDefense(p.lv) + (ITEMS[p.armor]?.armor || 0); }
export function gainExp(p, exp) {
  p.exp += exp; const lv = levelFor(p.exp);
  if (lv > p.lv) { const grow = maxHpFor(lv) - p.maxHp; p.lv = lv; p.maxHp = maxHpFor(lv); p.hp = Math.min(p.maxHp, p.hp + grow); return true; }
  return false;
}
export function heal(p, amount) { const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + amount); return p.hp - before; }
export function recordKill(p, enemyId) {
  const def = MONSTERS[enemyId]; if (!def || def.dummy) return;
  p.kills++;
  if (def.boss) p.bossFate[enemyId] = 'killed'; else if (p.areaKills[def.area] !== undefined) p.areaKills[def.area]++;
}
export function quotaMet(p, area) { const q = AREAS[area]?.genocideQuota || 0; return q > 0 && (p.areaKills[area] || 0) >= q; }

// 현재까지의 행동으로 루트를 판정한다.
// 몰살: 지금까지 지나온 모든 지역의 할당량을 채우고 모든 보스를 죽였다. (파피루스를 살려보내면 즉시 깨진다)
// 불살: 아무도 죽이지 않았다.  그 외: 중립.
export function routeFor(p, upToArea = null) {
  if (p.kills === 0 && !Object.values(p.bossFate).includes('killed')) return 'pacifist';
  const areas = ['ruins', 'snowdin', 'waterfall', 'hotland'];
  const known = areas.includes(upToArea); const limit = known ? areas.indexOf(upToArea) : areas.length - 1;
  let genocide = true;
  for (let i = 0; i <= limit; i++) {
    const a = areas[i];
    if (!quotaMet(p, a)) genocide = false;
    const boss = AREAS[a].boss, fate = p.bossFate[boss] || (boss === 'undyne' ? p.bossFate.undying : null) || (boss === 'mettaton' ? p.bossFate.neo : null);
    // 지나온 지역의 보스는 반드시 죽였어야 한다. 현재 지역의 보스는 아직 싸우기 전일 수 있다.
    if ((i < limit || !known) && fate !== 'killed') genocide = false;
  }
  if (p.flags.genocideBroken) genocide = false;
  return genocide ? 'genocide' : 'neutral';
}

// ---------- 전투 ----------
export const SOUL_SPEED = 150, SOUL_SLOW = 75, SOUL_RADIUS = 5, BOX_DEFAULT = { w: 565, h: 140 }, BOX_CENTER = { x: 320, y: 320 };

export function createBattle(player, enemyIds, opts = {}) {
  const rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 1e9));
  const b = {
    player, rng, area: opts.area || MONSTERS[enemyIds[0]].area, route: opts.route || routeFor(player, opts.area || MONSTERS[enemyIds[0]].area),
    enemies: enemyIds.map(id => ({ id, def: MONSTERS[id], hp: MONSTERS[id].hp, maxHp: MONSTERS[id].hp, stage: 0, acted: {}, spareable: !!MONSTERS[id].dummy,
      dead: false, spared: false, fled: false, angry: false, mercyCount: 0, fleeCount: 0, ratings: 0, soulHelp: 0, saved: [], dodges: 0, turnsSurvived: 0 })),
    mode: 'text', menu: 0, submenu: null, sub: 0, target: 0, text: null, turn: 0, playerTurns: 0,
    soul: { x: BOX_CENTER.x, y: BOX_CENTER.y, mode: 'red', vx: 0, vy: 0, facing: 'up', grounded: false, invincible: 0, moving: false, gravity: 'down', lastX: 0, lastY: 0 },
    box: { ...BOX_CENTER, ...BOX_DEFAULT, tw: BOX_DEFAULT.w, th: BOX_DEFAULT.h, tx: BOX_CENTER.x, ty: BOX_CENTER.y },
    bullets: [], effects: [], attack: null, bar: null, pending: null, ended: null, result: null, log: [], hits: 0, karma: 0, karmaTime: 0,
    lastDamage: null, flavorIndex: 0, apronTurns: 0, time: 0, sansOffer: false, sansAsleep: false, sansSpared: false, endLine: null,
  };
  b.enemy = b.enemies[0];
  b.text = { lines: [opts.intro || introLine(b)], index: 0, shown: 0, done: false };
  return b;
}
function introLine(b) {
  const names = b.enemies.filter(e => !e.dead).map(e => e.def.name);
  if (b.enemy.def.boss) return b.enemy.def.flavor[0];
  return `* ${names.join('와(과) ')}이(가) 나타났다!`;
}
export function alive(b) { return b.enemies.filter(e => !e.dead && !e.spared && !e.fled); }
export function battleOver(b) { return alive(b).length === 0; }

// 메뉴 문구
export function flavor(b) {
  const e = b.enemy, d = e.def;
  if (d.karma && b.sansAsleep) return '* 샌즈가 잠들었다…';
  if (e.id === 'toriel' && e.hp <= e.maxHp * .25 && b.route !== 'genocide') return d.lowHpLine;
  if (d.ratingsGoal) return `* 시청률: ${e.ratings} / ${d.ratingsGoal}`;
  const list = d.flavor; return list[b.flavorIndex % list.length];
}

// ---------- 텍스트 ----------
export function say(b, lines, after) { b.text = { lines: Array.isArray(lines) ? lines : [lines], index: 0, shown: 0, done: false }; b.pending = after || null; b.mode = 'text'; }
export function advanceText(b) {
  const t = b.text; if (!t) return false;
  const line = t.lines[t.index];
  if (t.shown < line.length) { t.shown = line.length; return true; }
  if (t.index < t.lines.length - 1) { t.index++; t.shown = 0; return true; }
  t.done = true; const next = b.pending; b.pending = null;
  if (next) next(); else b.mode = 'menu';
  return true;
}

// ---------- 플레이어 행동 ----------
export function menuItems() { return ['fight', 'act', 'item', 'mercy']; }
export function chooseAction(b, action) {
  if (b.mode !== 'menu') return false;
  const targets = alive(b);
  if (action === 'fight') { b.submenu = { kind: 'target', items: targets.map(e => ({ id: e.id, name: e.def.name, enemy: e })) }; b.sub = 0; b.mode = 'submenu'; }
  else if (action === 'act') { b.submenu = { kind: 'acttarget', items: targets.map(e => ({ id: e.id, name: e.def.name, enemy: e })) }; b.sub = 0; b.mode = 'submenu'; }
  else if (action === 'item') {
    if (!b.player.items.length) { say(b, '* 가방이 비어 있다.'); return true; }
    b.submenu = { kind: 'item', items: b.player.items.map((id, i) => ({ id, index: i, name: ITEMS[id].name })) }; b.sub = 0; b.mode = 'submenu';
  } else if (action === 'mercy') {
    const e = b.enemy, d = e.def;
    if (d.noMercy && !b.asgoreLow) { say(b, '* 아스고어가 자비 버튼을 삼지창으로 부숴 버렸다.'); return true; }
    const items = [{ id: 'spare', name: e.spareable || spareReady(b, e) ? '살려주기' : '살려주기' }];
    if (!d.boss || (d.fleeTurns && e.fleeCount >= d.fleeTurns)) items.push({ id: 'flee', name: '도망치기' });
    b.submenu = { kind: 'mercy', items }; b.sub = 0; b.mode = 'submenu';
  }
  return true;
}
export function cancel(b) { if (b.mode === 'submenu') { if (b.submenu.kind === 'act' || b.submenu.kind === 'souls') { b.submenu = { kind: 'acttarget', items: alive(b).map(e => ({ id: e.id, name: e.def.name, enemy: e })) }; b.sub = 0; } else { b.submenu = null; b.mode = 'menu'; } return true; } return false; }
export function chooseSub(b, index) {
  if (b.mode !== 'submenu') return false;
  const item = b.submenu.items[index]; if (!item) return false;
  const kind = b.submenu.kind;
  if (kind === 'target') { b.target = b.enemies.indexOf(item.enemy); b.submenu = null; b.mode = 'fightbar'; b.bar = { t: 0, duration: 1.1, struck: false }; return true; }
  if (kind === 'acttarget') { b.target = b.enemies.indexOf(item.enemy); const e = item.enemy; b.submenu = { kind: 'act', items: e.def.acts.filter(a => !a.needStage || e.stage >= a.needStage).map(a => ({ id: a.id, name: a.name, act: a })) }; b.sub = 0; return true; }
  if (kind === 'act') { b.submenu = null; doAct(b, b.enemies[b.target], item.act); return true; }
  if (kind === 'souls') { b.submenu = null; doSave(b, item.index); return true; }
  if (kind === 'item') { b.submenu = null; consumeItem(b, item.index); return true; }
  if (kind === 'mercy') { b.submenu = null; if (item.id === 'spare') doSpare(b); else doFlee(b); return true; }
  return false;
}

// 공격 타이밍 바. 중앙에 가까울수록 배율이 높다. 놓치면 MISS.
export function strike(b) {
  if (b.mode !== 'fightbar' || b.bar.struck) return false;
  const pos = b.bar.t / b.bar.duration, offset = Math.abs(pos - .5) * 2; b.bar.struck = true; b.bar.pos = pos;
  const e = b.enemies[b.target], d = e.def, p = b.player;
  let dmg, label;
  if (d.dodges && !b.sansAsleep) { dmg = 0; label = 'MISS'; e.dodges++; }
  else if ((d.exec || d.id === 'neo' || e.id === 'neo') && b.route === 'genocide' && d.boss) { dmg = e.hp; label = `${dmg}`; }
  else {
    const mult = offset < .1 ? 2.2 : 2 - offset;
    dmg = Math.max(1, Math.round((attackStat(p) - d.df + Math.floor(b.rng() * 3)) * mult));
    if (b.route === 'genocide' && d.boss && !d.karma && e.id !== 'undying') dmg *= 8;
    if (d.karma) dmg = Math.max(1, e.hp);
    label = offset < .1 ? `${dmg}!` : `${dmg}`;
  }
  if (d.immortal) dmg = Math.min(dmg, 0);
  e.hpBefore = e.hp; e.hp = Math.max(0, e.hp - dmg); b.lastDamage = { enemy: e, dmg, label, t: 0, pos };
  b.effects.push({ kind: 'slash', x: 320, y: 150, t: 0 });
  b.mode = 'strikeanim'; b.animT = 0;
  return true;
}
function afterStrike(b) {
  const e = b.enemies[b.target], d = e.def;
  if (e.hp <= 0 && !d.immortal) { killEnemy(b, e); return; }
  if (d.dodges) { say(b, e.dodges === 1 ? '* 샌즈가 여유롭게 피했다. "뭐야, 그게 다야?"' : '* 샌즈가 피했다.', () => enemyTurn(b)); return; }
  if (d.noMercy && e.hp <= e.maxHp * .2 && !b.asgoreLow) { b.asgoreLow = true; say(b, ['* 아스고어가 무릎을 꿇는다.', '* "…이렇게 될 줄 알았다. 그래, 인간이여."', '* "내 영혼을 가져가거라. 아니면… 나를 살려두고 여기 남거라."', '* 자비 버튼이 다시 생겼다.']); return; }
  if (d.ratingsGoal) { e.ratings += 300; }
  endPlayerTurn(b, '* 공격했다.');
}
// 언다인·메타톤을 한 방에 쓰러뜨리면 결의로 되살아나 언다인 더 언다잉·메타톤 NEO가 된다.
const TRANSFORMS = { undyne: { into: 'undying', lines: ['* 언다인이 먼지가 되려는 순간… 몸이 결의로 떨린다.', '* 언다인: "아직… 아직이야! 모두가 나를 믿고 있어!"', '* 언다인 더 언다잉이 되었다!'] },
  mettaton: { into: 'neo', lines: ['* 메타톤의 전원이 꺼지려는 순간… 알피스의 목소리가 들린다.', '* 메타톤: "달링… 아직 쇼는 끝나지 않았어."', '* 메타톤 NEO로 변형했다!'] } };
function transform(b, e) {
  const t = TRANSFORMS[e.id]; const def = MONSTERS[t.into];
  e.id = t.into; e.def = def; e.hp = def.hp; e.maxHp = def.hp; e.dead = false; e.turnsSurvived = 0; e.spareable = false; e.ratings = 0; e.acted = {}; e.transformed = true;
  b.enemy = e; b.lastDamage = null; b.flavorIndex = 0;
  say(b, t.lines, () => enemyTurn(b));
}
function killEnemy(b, e) {
  const d = e.def;
  if (TRANSFORMS[e.id] && e.hpBefore === e.maxHp && !e.transformed) { transform(b, e); return; }
  e.dead = true; e.hp = 0; recordKill(b.player, e.id);
  const p = b.player, gotExp = d.exp, gotGold = d.gold; const leveled = gainExp(p, gotExp); p.gold += gotGold;
  b.log.push({ kill: e.id });
  const lines = [];
  if (d.dummy) lines.push('* 인형이 산산조각 났다.', '* 토리엘이 잠시 말을 잃었다.');
  else if (d.karma) { b.ended = 'kill'; b.result = { exp: 0, gold: 0 }; say(b, ['* 샌즈의 갈비뼈 사이로 붉은 선이 그어졌다.', '* "…이런. 제법이네."', '* "파피루스… 핫도그 먹고 싶니…"', '* 샌즈가 어둠 속으로 사라졌다.'], () => { b.mode = 'end'; }); return; }
  else if (d.boss) lines.push(bossDeathLine(e.id, b), `* EXP ${gotExp}, ${gotGold} G를 얻었다.`);
  else lines.push(`* ${d.name}을(를) 쓰러뜨렸다.`);
  if (leveled && !d.dummy) lines.push(`* LV가 올랐다! LV ${p.lv}, HP ${p.maxHp}`);
  if (battleOver(b)) { b.ended = 'kill'; b.result = { exp: gotExp, gold: gotGold }; if (!d.boss && !d.dummy) lines.push(`* 승리했다! EXP ${gotExp}, ${gotGold} G를 얻었다.`); say(b, lines, () => { b.mode = 'end'; }); }
  else say(b, lines, () => enemyTurn(b));
}
function bossDeathLine(id, b) {
  const g = b.route === 'genocide';
  return { toriel: g ? '* 토리엘: "…그래. 이럴 줄 알았어야 했는데. 너는… 나의 아이가 아니구나."' : '* 토리엘: "…하하. 그렇지. 네가 강해서 다행이야. 부디 무사히…" 토리엘이 먼지가 되었다.',
    papyrus: g ? '* 파피루스: "…그래도… 난 널 믿어. 넌 좋은 사람이 될 수 있어…" 파피루스의 머리가 먼지가 되었다.' : '* 파피루스: "이… 이럴 수가. 하지만 넌 좋은 사람이 될 수 있다고… 믿어…"',
    undyne: '* 언다인: "이… 이럴 리가… 아스고어… 알피스… 미안…" 언다인이 먼지가 되었다.',
    undying: '* 언다인: "…이렇게 끝나는군. 하지만 알피스가… 모두를 대피시켰을 거야. 너는… 절대 이길 수…" 언다인이 녹아내렸다.',
    mettaton: '* 메타톤: "달링… 시청률은… 최고였어." 메타톤의 전원이 꺼졌다.',
    neo: '* 메타톤 NEO: "…그래도… 알피스가…" 메타톤 NEO가 쓰러졌다.',
    asgore: '* 아스고어: "…미안하구나, 토리엘." 아스고어가 먼지가 되었다.',
    flowey: '* 플라위: "…너 정말… 하하… 그래…" 여섯 영혼이 흩어졌다.',
  }[id] || `* ${MONSTERS[id].name}이(가) 쓰러졌다.`;
}

function doAct(b, e, act) {
  const d = e.def, p = b.player; e.acted[act.id] = (e.acted[act.id] || 0) + 1;
  let text = act.text; const lines = [text];
  if (act.stage) e.stage = Math.max(e.stage, act.stage);
  if (act.stackable && act.spareAt) { if (e.acted[act.id] >= act.spareAt) e.spareable = true; }
  else if (act.spare) e.spareable = true;
  if (act.flee) { e.fled = true; if (battleOver(b)) { b.ended = 'spare'; b.result = { exp: 0, gold: d.gold }; say(b, [text, `* ${d.gold} G를 얻었다.`], () => { b.mode = 'end'; }); return; } }
  if (act.angry) e.angry = true;
  if (act.fleeCount) { e.fleeCount++; if (e.fleeCount >= d.fleeTurns) lines.push('* 지금이다! 자비 메뉴에서 도망칠 수 있다.'); else lines.push(`* 언다인이 지쳐가고 있다. (${e.fleeCount}/${d.fleeTurns})`); }
  if (act.ratings) { e.ratings += act.ratings; if (e.ratings >= d.ratingsGoal) { e.spareable = true; lines.push('* 시청률이 목표에 도달했다! 메타톤이 만족한 얼굴이다.'); } }
  if (act.heal) { const h = heal(p, act.heal); lines.push(`* HP를 ${h} 회복했다.`); }
  if (act.soulHelp) { e.soulHelp++; if (e.soulHelp >= 3) { lines.push('* 여섯 영혼이 응답했다! 플라위의 방어가 무너지고 HP가 회복되었다.'); p.hp = p.maxHp; e.hp = Math.min(e.hp, 300); } }
  if (act.save) {
    const souls = d.lostSouls || [];
    if (e.saved.length < souls.length) { b.submenu = { kind: 'souls', items: souls.map((pair, i) => ({ id: String(i), index: i, name: e.saved.includes(i) ? `${pair.join('와 ')} (구했다)` : pair.join('와 '), done: e.saved.includes(i) })) }; b.sub = 0; b.mode = 'submenu'; return; }
    e.asrielSave = (e.asrielSave || 0) + 1;
    const asrielLines = [['* 아스리엘을 구하려 한다.', '* 아스리엘: "…뭘 하려는 거야? 날 구할 순 없어!"'], ['* 아스리엘: "…나… 무서워. 다시 꽃이 되고 싶지 않아."', '* 당신은 계속 손을 뻗었다.'], ['* 아스리엘: "…크리스… 아니, 네 이름이 뭐든. 미안해."', '* 아스리엘이 힘을 거두었다.']][Math.min(2, e.asrielSave - 1)];
    if (e.asrielSave >= 3) { b.ended = 'special'; b.result = { exp: 0, gold: 0 }; say(b, asrielLines, () => { b.mode = 'end'; }); return; }
    say(b, asrielLines, () => enemyTurn(b)); return;
  }
  if (d.karma && b.sansAsleep) { lines.push('* 샌즈는 깨지 않는다.'); }
  endPlayerTurn(b, lines);
}
function doSave(b, index) {
  const e = b.enemies[b.target], d = e.def;
  if (e.saved.includes(index)) { endPlayerTurn(b, '* 이미 그들의 마음은 돌아왔다.'); return; }
  e.saved.push(index); b.player.hp = b.player.maxHp;
  const memory = { 0: ['* 언다인: "…뭐야, 이 기분은. 내가… 너를 알고 있었지?"', '* 알피스: "우, 우리 다시 애니 보기로 했었죠…" 두 사람의 기억이 돌아왔다.'],
    1: ['* 파피루스: "이 인간… 나와 스파게티를 먹었던… 그 인간이구나!!"', '* 샌즈: "…아, 그래. 그런 농담이 있었지." 두 사람의 기억이 돌아왔다.'],
    2: ['* 토리엘: "…나의 아이. 네가 나를 안아 준 게 기억나는구나."', '* 아스고어: "…차 한잔 하자꾸나, 언젠가." 두 사람의 기억이 돌아왔다.'] }[index];
  const lines = [...memory, '* HP가 완전히 회복되었다.'];
  if (e.saved.length >= d.lostSouls.length) lines.push('* 모두의 마음이 돌아왔다. 이제 남은 건… 아스리엘뿐이다.');
  say(b, lines, () => enemyTurn(b));
}
export function consumeItem(b, index) {
  const p = b.player, id = p.items[index]; if (!id) return;
  const it = ITEMS[id];
  if (it.heal) { p.items.splice(index, 1); const h = heal(p, it.heal); const full = p.hp === p.maxHp; endPlayerTurn(b, [`* ${it.name}을(를) 먹었다.`, full ? '* HP가 가득 찼다.' : `* HP를 ${h} 회복했다.`]); }
  else if (it.weapon !== undefined) { const old = p.weapon; p.weapon = id; p.items.splice(index, 1); if (old) p.items.push(old); endPlayerTurn(b, `* ${it.name}을(를) 장착했다.`); }
  else if (it.armor !== undefined) { const old = p.armor; p.armor = id; p.items.splice(index, 1); if (old) p.items.push(old); endPlayerTurn(b, `* ${it.name}을(를) 장착했다.`); }
}
export function spareReady(b, e) {
  const d = e.def;
  if (e.spareable) return true;
  if (d.mercyTurns && e.id === 'toriel' && e.mercyCount >= d.mercyTurns) return true;
  if (d.mercyTurns && e.id === 'papyrus' && (b.route === 'genocide' || e.turnsSurvived >= d.mercyTurns)) return true;
  return false;
}
function doSpare(b) {
  const e = b.enemy, d = e.def, p = b.player;
  if (d.karma) {
    if (b.sansOffer && !b.sansAsleep) { b.sansSpared = true; b.ended = 'dead'; say(b, ['* 샌즈: "…정말? 좋아. 손을 잡자."', '* "…"', '* 샌즈: "덩크 슛."', '* 뼈가 당신을 관통했다.'], () => { p.hp = 0; b.mode = 'end'; }); return; }
    endPlayerTurn(b, '* 샌즈는 자비를 원하지 않는다.'); return;
  }
  if (d.noMercy && b.asgoreLow) { e.spared = true; b.ended = 'spare'; b.result = { exp: 0, gold: 0 }; p.bossFate.asgore = 'spared'; say(b, ['* 아스고어: "…정말이냐? 나를 살려 두겠다고?"', '* "…고맙구나, 인간이여. 그렇다면…"'], () => { b.mode = 'end'; }); return; }
  if (e.id === 'toriel' && b.route !== 'genocide') {
    e.mercyCount++;
    if (e.mercyCount >= d.mercyTurns) { e.spared = true; b.ended = 'spare'; b.result = { exp: 0, gold: 0 }; p.bossFate.toriel = 'spared'; say(b, [d.mercyLines[d.mercyLines.length - 1], '* 토리엘이 당신을 꼭 안아 주었다.'], () => { b.mode = 'end'; }); return; }
    const line = d.mercyLines[Math.min(e.mercyCount - 1, d.mercyLines.length - 2)];
    say(b, line, () => enemyTurn(b)); return;
  }
  if (e.id === 'papyrus') {
    if (b.route === 'genocide') { e.spared = true; p.flags.genocideBroken = true; p.bossFate.papyrus = 'spared'; b.ended = 'spare'; b.result = { exp: 0, gold: 0 }; say(b, ['* 파피루스: "봐! 난 네가 좋은 사람이 될 수 있다는 걸 알았어!"', '* "이제 우리 친구다! 스파게티를 만들어 줄게!"'], () => { b.mode = 'end'; }); return; }
    if (e.turnsSurvived >= d.mercyTurns) { e.spared = true; p.bossFate.papyrus = 'spared'; b.ended = 'spare'; b.result = { exp: 0, gold: 0 }; say(b, ['* 파피루스: "…살려 준다고? 나를?"', '* "인간… 너는 정말 좋은 사람이구나. 이제 우린 친구다!!"'], () => { b.mode = 'end'; }); return; }
    say(b, `* 파피루스는 아직 포기하지 않았다. "위대한 파피루스는 물러서지 않는다!"`, () => enemyTurn(b)); return;
  }
  if (e.id === 'undyne' || e.id === 'undying') { endPlayerTurn(b, '* 언다인은 절대 자비를 받아들이지 않는다.'); return; }
  if (e.id === 'mettaton' && !e.spareable) { endPlayerTurn(b, '* 메타톤: "시청률이 아직 부족해, 달링!"'); return; }
  if (e.id === 'flowey') { endPlayerTurn(b, '* 플라위가 비웃는다. "자비? 이 세상에 그런 건 없어!"'); return; }
  if (e.id === 'asriel') { endPlayerTurn(b, '* 아스리엘은 멈추지 않는다. 다른 방법이 필요하다.'); return; }
  if (e.spareable) {
    e.spared = true; if (d.boss) p.bossFate[e.id] = 'spared';
    const spareText = d.spareText || `* ${d.name}을(를) 살려주었다.`;
    if (battleOver(b)) { b.ended = 'spare'; b.result = { exp: 0, gold: d.gold }; p.gold += d.gold; say(b, d.boss ? [spareText] : [spareText, `* 승리했다! ${d.gold} G를 얻었다.`], () => { b.mode = 'end'; }); }
    else say(b, spareText, () => enemyTurn(b));
    return;
  }
  endPlayerTurn(b, `* ${d.name}은(는) 아직 싸울 마음이다.`);
}
function doFlee(b) {
  const e = b.enemy, d = e.def;
  if (e.id === 'undyne') { b.ended = 'flee'; b.result = { exp: 0, gold: 0 }; say(b, ['* 도망쳤다!', '* 언다인: "이봐! 도망치지 마!!"'], () => { b.mode = 'end'; }); return; }
  if (d.boss) { endPlayerTurn(b, '* 도망칠 수 없다!'); return; }
  b.ended = 'flee'; b.result = { exp: 0, gold: 0 }; say(b, ['* 도망쳤다…', '* 다리가 가장 빠르다.'], () => { b.mode = 'end'; });
}

// 플레이어 턴이 끝나면 결과 문구 → 적의 턴
function endPlayerTurn(b, lines) { say(b, lines, () => enemyTurn(b)); }

// ---------- 적의 턴 ----------
export function enemyTurn(b) {
  b.playerTurns++;
  if (battleOver(b)) { b.mode = 'end'; return; }
  const e = alive(b)[Math.floor(b.rng() * alive(b).length)];
  b.enemy = alive(b).includes(b.enemy) ? b.enemy : e;
  const attacker = b.enemy;
  // 앞치마: 두 턴마다 HP 1 회복
  if (b.player.armor === 'apron' && ++b.apronTurns % 2 === 0) heal(b.player, 1);
  // 살아 있는 몬스터가 여럿이면 모두 함께 공격한다. (보스는 혼자 나온다)
  const attackers = alive(b);
  const parts = attackers.map(en => { const name = pickPattern(b, en); return { enemy: en, name, def: PATTERNS[name] || PATTERNS.none, memo: {} }; });
  const main = parts.find(pt => pt.enemy === attacker) || parts[0];
  const dur = Math.max(...parts.map(pt => pt.def.duration + (pt.enemy.angry ? 1 : 0)));
  const box = parts.reduce((acc, pt) => { const bx = pt.def.box || BOX_DEFAULT; return { w: Math.max(acc.w, bx.w), h: Math.max(acc.h, bx.h), x: bx.x ?? acc.x, y: bx.y ?? acc.y }; }, { w: 0, h: 0, x: undefined, y: undefined });
  const soulMode = parts.map(pt => pt.def.soul).find(m => m && m !== 'red') || 'red';
  const composite = parts.length === 1 ? main.def : {
    duration: dur, box, soul: soulMode,
    setup(ctx) { for (const pt of parts) if (pt.def.setup) pt.def.setup({ ...ctx, memo: pt.memo, enemy: pt.enemy, angry: pt.enemy.angry }); },
    tick(ctx) { for (const pt of parts) if (pt.def.tick && ctx.t < pt.def.duration + (pt.enemy.angry ? 1 : 0)) pt.def.tick({ ...ctx, memo: pt.memo, enemy: pt.enemy, angry: pt.enemy.angry }); },
  };
  b.attack = { name: main.name, names: parts.map(pt => pt.name), t: 0, duration: dur, memo: main.memo, enemy: attacker, def: composite, speech: enemySpeech(b, attacker) };
  b.soul.mode = soulMode; b.soul.gravity = 'down';
  b.box.tw = box.w; b.box.th = box.h; b.box.tx = box.x ?? BOX_CENTER.x; b.box.ty = box.y ?? Math.min(BOX_CENTER.y, 392 - box.h / 2); // 큰 박스는 HP 표시를 가리지 않게 위로
  b.soul.x = b.box.tx; b.soul.y = b.soul.mode === 'blue' ? b.box.ty + box.h / 2 - 8 : b.box.ty; b.soul.vx = 0; b.soul.vy = 0;
  b.bullets = []; b.roundHits = 0;
  b.mode = 'dodge'; b.turn++;
  if (composite.setup) composite.setup(ctxFor(b));
}
function pickPattern(b, e) {
  const d = e.def, list = d.patterns; const p = b.player;
  if (e.id === 'toriel' && e.hp <= e.maxHp * .25 && b.route !== 'genocide') return 'fireLowHp';
  if (e.id === 'papyrus') { const idx = Math.min(e.turnsSurvived, list.length - 1); return list[idx]; }
  if (d.karma) {
    if (b.sansAsleep) return 'nothing';
    const n = e.turnsSurvived;
    if (n >= d.dodgeTurns) { return 'nothing'; }
    return list[n % (list.length - 1)];
  }
  if (e.id === 'undyne') { return list[Math.min(e.turnsSurvived, list.length - 1)]; }
  if (e.id === 'mettaton') return list[e.turnsSurvived % list.length];
  if (e.id === 'asriel') { const n = e.turnsSurvived; return e.saved.length >= 3 ? 'hyperGoner' : list[n % 3]; }
  if (e.id === 'flowey') return list[e.turnsSurvived % list.length];
  if (e.id === 'asgore') return list[e.turnsSurvived % list.length];
  if (p.hp <= 0) return 'none';
  return list[Math.floor(b.rng() * list.length)];
}
function enemySpeech(b, e) {
  const d = e.def, n = e.turnsSurvived;
  if (e.id === 'toriel') return null;
  if (e.id === 'papyrus') return d.mercyLines[Math.min(n, d.mercyLines.length - 1)];
  if (d.karma) { if (n === d.dodgeTurns - 2) { b.sansOffer = true; return d.lines[4]; } if (n === d.dodgeTurns - 1) return d.lines[5]; if (n >= d.dodgeTurns) return d.lines[12]; return d.lines[Math.min(n, 3)] || null; }
  if (d.lines) return d.lines[n % d.lines.length];
  return null;
}
function ctxFor(b) { return { b, t: b.attack.t, dt: 0, box: b.box, soul: b.soul, rng: b.rng, memo: b.attack.memo, enemy: b.attack.enemy, spawn: bullet => spawn(b, bullet), player: b.player, angry: b.attack.enemy.angry }; }
export function spawn(b, bullet) { b.bullets.push({ age: 0, ttl: 12, color: 'white', vx: 0, vy: 0, ax: 0, ay: 0, ...bullet }); return b.bullets[b.bullets.length - 1]; }

// ---------- 프레임 업데이트 ----------
export function update(b, dt, input = {}) {
  if (b.paused) return; b.time += dt;
  if (b.text && !b.text.done && b.mode === 'text') { b.text.shown = Math.min(b.text.lines[b.text.index].length, b.text.shown + dt * 32); }
  for (const fx of b.effects) fx.t += dt; b.effects = b.effects.filter(fx => fx.t < 1);
  if (b.lastDamage) { b.lastDamage.t += dt; }
  if (b.mode === 'fightbar') { b.bar.t += dt; if (b.bar.t >= b.bar.duration && !b.bar.struck) { b.bar.struck = true; b.bar.pos = 1; b.lastDamage = { enemy: b.enemies[b.target], dmg: 0, label: 'MISS', t: 0, pos: 1 }; b.mode = 'strikeanim'; b.animT = 0; } return; }
  if (b.mode === 'strikeanim') { b.animT += dt; if (b.animT > 1.1) afterStrike(b); return; }
  if (b.mode !== 'dodge') return;
  // 박스 보간
  const bx = b.box; const k = Math.min(1, dt * 10);
  bx.w += (bx.tw - bx.w) * k; bx.h += (bx.th - bx.h) * k; bx.x += (bx.tx - bx.x) * k; bx.y += (bx.ty - bx.y) * k;
  const a = b.attack; a.t += dt; const ctx = ctxFor(b); ctx.dt = dt; ctx.t = a.t;
  if (a.def.tick && a.t < a.duration) a.def.tick(ctx);
  moveSoul(b, dt, input);
  // 탄막 이동
  for (const bl of b.bullets) {
    bl.age += dt; if (bl.update) bl.update(bl, ctx);
    bl.vx += bl.ax * dt; bl.vy += bl.ay * dt; bl.x += bl.vx * dt; bl.y += bl.vy * dt;
  }
  b.bullets = b.bullets.filter(bl => bl.age < bl.ttl && !bl.dead && Math.abs(bl.x - 320) < 900 && Math.abs(bl.y - 300) < 900);
  const s = b.soul; if (s.invincible > 0) s.invincible -= dt;
  if (b.karma > 0) { b.karmaTime += dt; if (b.karmaTime >= .3) { b.karmaTime = 0; b.karma--; b.player.hp = Math.max(1, b.player.hp - 1); } }
  collide(b);
  if (b.player.hp <= 0) { b.mode = 'end'; b.ended = 'dead'; return; }
  if (a.t >= a.duration && (b.bullets.length === 0 || a.t >= a.duration + 1.5)) finishRound(b);
}
export function finishRound(b) {
  const a = b.attack, e = a.enemy, d = e.def; b.bullets = []; b.attack = null; b.soul.mode = 'red';
  const bx = b.box; bx.tw = BOX_DEFAULT.w; bx.th = BOX_DEFAULT.h; bx.tx = BOX_CENTER.x; bx.ty = BOX_CENTER.y; bx.w = bx.tw; bx.h = bx.th; bx.x = bx.tx; bx.y = bx.ty;
  b.soul.x = bx.x; b.soul.y = bx.y; b.flavorIndex++; for (const en of alive(b)) en.turnsSurvived++;
  if (d.ratingsGoal) { e.ratings += b.roundHits === 0 ? 400 : 100; if (e.ratings >= d.ratingsGoal) e.spareable = true; }
  if (d.karma && a.name === 'nothing' && !b.sansAsleep) { b.sansAsleep = true; }
  b.mode = 'menu'; b.menu = 0;
}
function moveSoul(b, dt, input) {
  const s = b.soul, bx = b.box, r = SOUL_RADIUS; s.lastX = s.x; s.lastY = s.y;
  const left = bx.x - bx.w / 2 + r, right = bx.x + bx.w / 2 - r, top = bx.y - bx.h / 2 + r, bottom = bx.y + bx.h / 2 - r;
  const speed = input.slow ? SOUL_SLOW : SOUL_SPEED;
  if (s.mode === 'red') {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    s.x += dx * speed * dt; s.y += dy * speed * dt;
  } else if (s.mode === 'blue') {
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0); s.x += dx * speed * dt;
    const g = s.gravity === 'up' ? -1 : 1, jump = s.gravity === 'up' ? input.down : input.up;
    if (jump && s.grounded) { s.vy = -330 * g; s.grounded = false; s.jumpHold = .18; }
    if (jump && !s.grounded && s.jumpHold > 0) { s.jumpHold -= dt; s.vy -= 500 * g * dt; } else s.jumpHold = 0;
    s.vy += 1200 * g * dt; s.y += s.vy * dt;
    const floor = g > 0 ? bottom : top;
    if ((g > 0 && s.y >= floor) || (g < 0 && s.y <= floor)) { s.y = floor; s.vy = 0; s.grounded = true; } else s.grounded = false;
  } else if (s.mode === 'green') {
    s.x = bx.x; s.y = bx.y;
    if (input.up) s.facing = 'up'; else if (input.down) s.facing = 'down'; else if (input.left) s.facing = 'left'; else if (input.right) s.facing = 'right';
  }
  s.x = Math.max(left, Math.min(right, s.x)); s.y = Math.max(top, Math.min(bottom, s.y));
  s.moving = Math.abs(s.x - s.lastX) > .01 || Math.abs(s.y - s.lastY) > .01;
}
export function canHurt(bullet, moving) { if (bullet.color === 'blue') return moving; if (bullet.color === 'orange') return !moving; if (bullet.color === 'green') return false; return true; }
function collide(b) {
  const s = b.soul, r = SOUL_RADIUS;
  for (const bl of b.bullets) {
    if (bl.dead || bl.warn || bl.passing) continue;
    let hit = false;
    if (bl.kind === 'arrow') {
      const dist = Math.hypot(bl.x - s.x, bl.y - s.y);
      if (dist < 14) { if (s.facing === bl.from) { bl.dead = true; b.effects.push({ kind: 'block', x: bl.x, y: bl.y, t: 0 }); continue; } hit = true; }
    } else if (bl.r !== undefined) hit = Math.hypot(bl.x - s.x, bl.y - s.y) < bl.r + r - 1;
    else { const hw = bl.w / 2, hh = bl.h / 2; const cx = Math.max(bl.x - hw, Math.min(s.x, bl.x + hw)), cy = Math.max(bl.y - hh, Math.min(s.y, bl.y + hh)); hit = Math.hypot(cx - s.x, cy - s.y) < r - 1; }
    if (!hit) continue;
    if (bl.color === 'green') { bl.dead = true; heal(b.player, bl.heal || 1); b.effects.push({ kind: 'heal', x: s.x, y: s.y, t: 0 }); continue; }
    if (!canHurt(bl, s.moving)) continue;
    if (s.invincible > 0) continue;
    hurt(b, bl.dmg || b.attack.enemy.def.at, bl);
    if (bl.once) bl.dead = true;
  }
}
export function hurt(b, at, bullet = {}) {
  const p = b.player, s = b.soul;
  // 원작처럼 방어력이 피해를 조금 줄인다. LV1 기준 토리엘·파피루스 5, 프로깃 2.
  let dmg = Math.max(1, Math.round(at * .7 * (bullet.mult || 1) - Math.floor(defenseStat(p) / 5)));
  p.hp = Math.max(0, p.hp - dmg); s.invincible = bullet.iframes || .8; b.hits++; b.roundHits++;
  if (b.attack?.enemy.def.karma) b.karma = Math.min(b.karma + 6, 20);
  b.effects.push({ kind: 'hurt', x: s.x, y: s.y, t: 0, dmg });
  return dmg;
}

// 자동화/디버그용 상태 요약
export function summarize(b) {
  return { mode: b.mode, turn: b.turn, hp: b.player.hp, maxHp: b.player.maxHp, lv: b.player.lv, enemy: b.enemy.id, enemyHp: b.enemy.hp, soul: { x: Math.round(b.soul.x), y: Math.round(b.soul.y), mode: b.soul.mode }, bullets: b.bullets.length, ended: b.ended, route: b.route, text: b.text ? b.text.lines[b.text.index] : null, attack: b.attack?.name || null };
}
