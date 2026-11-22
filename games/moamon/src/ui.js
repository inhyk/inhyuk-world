// 화면 위의 버튼, 메뉴, 알림 (모두 HTML)
import * as C from '../core.mjs';
import { portrait } from './monsters.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const ELCHIP = (e) => `<span class="elchip" style="--c:${C.ELEMENTS[e].color}">${C.ELEMENTS[e].icon} ${C.ELEMENTS[e].name}</span>`;
const itemList = (items) => Object.entries(items).map(([k, n]) => `<div class="loot"><span>${C.ITEMS[k].icon}</span><b>${C.ITEMS[k].name}</b><i>×${n}</i></div>`).join('');
const SORTS = { power: ['힘센 순', (a, b) => C.power(b) - C.power(a)], recent: ['새로 온 순', (a, b) => b.t - a.t], no: ['번호 순', (a, b) => C.species(a.sp).no - C.species(b.sp).no || C.power(b) - C.power(a)], fav: ['즐겨찾기', (a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || C.power(b) - C.power(a)] };

export class UI {
  constructor(game) {
    this.g = game; this.root = document.getElementById('ui'); this.modals = []; this.sort = 'power'; this.panel = null;
    this.root.innerHTML = `
      <div class="hud" id="hud">
        <button class="chip profile" data-a="open" data-p="me"><span class="lvl" id="h-lv">1</span><span class="pcol"><b>탐험가</b><span class="xpbar"><i id="h-xp"></i></span></span></button>
        <div class="topright"><span class="chip" id="h-weather"></span><span class="chip">🪙 <b id="h-coin">0</b></span><span class="chip">✨ <b id="h-dust">0</b></span><span class="chip incense" id="h-inc" hidden></span></div>
        <div class="nearby" id="h-near"></div>
        <button class="chip buddy" id="h-buddy" data-a="open" data-p="bag"></button>
        <button class="round quest" data-a="open" data-p="quests">📋<i id="h-qdot" hidden></i></button>
        <button class="mainbtn" data-a="menu" aria-label="메뉴"><span></span></button>
        <div class="stick" id="stick"><i></i></div>
        <div class="tip" id="h-tip"></div>
      </div>
      <div class="menu" id="menu" hidden>
        ${[['mons', '🐾', '모아몬'], ['dex', '📖', '도감'], ['bag', '🎒', '가방'], ['shop', '🛍️', '상점'], ['quests', '📋', '할 일'], ['me', '⚙️', '내 정보']].map(([p, i, n]) => `<button data-a="open" data-p="${p}"><span>${i}</span><b>${n}</b></button>`).join('')}
        <button class="mclose" data-a="menu">✕</button>
      </div>
      <div class="enc" id="enc" hidden>
        <button class="round run" data-a="run">🏃</button>
        <div class="en-name" id="en-name"></div>
        <div class="en-hint" id="en-hint"></div>
        <div class="en-pop" id="en-pop" hidden></div>
        <button class="round big berry" data-a="berrypop" id="en-berry">🍓</button>
        <button class="round big ballsel" data-a="ballpop" id="en-ball"></button>
      </div>
      <div class="bat" id="bat" hidden></div>
      <div class="sheet" id="sheet" hidden></div>
      <div class="says" id="says"></div>
      <div class="toasts" id="toasts"></div>
      <div class="modal" id="modal" hidden></div>
      <div class="title" id="title" hidden></div>`;
    this.$ = (id) => document.getElementById(id);
    this.root.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; e.stopPropagation(); const f = this['a_' + b.dataset.a]; if (f) f.call(this, b.dataset, b); });
    this.joy = { x: 0, y: 0 }; this.initStick();
  }
  initStick() {
    const s = this.$('stick'), k = s.firstElementChild; let id = null, cx = 0, cy = 0;
    const mv = (e) => { if (e.pointerId !== id) return; const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), m = 44, q = d > m ? m / d : 1; k.style.transform = `translate(${dx * q}px,${dy * q}px)`; this.joy.x = (dx * q) / m; this.joy.y = (-dy * q) / m; };
    const up = (e) => { if (e.pointerId !== id) return; id = null; k.style.transform = ''; this.joy.x = this.joy.y = 0; };
    s.addEventListener('pointerdown', (e) => { id = e.pointerId; s.setPointerCapture(id); const r = s.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mv(e); e.stopPropagation(); });
    s.addEventListener('pointermove', mv); s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
  }
  get save() { return this.g.save; }
  // ---------- 공통 ----------
  setMode(m) { this.$('hud').hidden = m !== 'map'; this.$('enc').hidden = m !== 'encounter'; this.$('bat').hidden = m !== 'battle'; this.$('menu').hidden = true; if (m !== 'map') this.closeSheet(); if (m === 'map') this.refresh(); }
  toast(text, icon = '') { const t = el(`<div class="toast">${icon ? `<span>${icon}</span>` : ''}${text}</div>`); this.$('toasts').append(t); setTimeout(() => t.classList.add('out'), 2400); setTimeout(() => t.remove(), 2900); }
  say(text, kind = 'good1') { const t = el(`<div class="say ${kind}">${text}</div>`); this.$('says').append(t); setTimeout(() => t.remove(), 1300); }
  dmg(n, side, eff) { const t = el(`<div class="dmg ${side}">-${n}${eff > 1 ? '<small>효과 만점!</small>' : eff < 1 ? '<small>효과가 약해</small>' : ''}</div>`); t.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); this.$('says').append(t); setTimeout(() => t.remove(), 900); }
  tip(text) { const t = this.$('h-tip'); t.textContent = text || ''; t.classList.toggle('on', !!text); }
  refresh() {
    const s = this.save; this.$('h-lv').textContent = s.lv; this.$('h-xp').style.width = Math.min(100, (s.xp / C.xpNeed(s.lv)) * 100) + '%'; this.$('h-coin').textContent = fmt(s.coins); this.$('h-dust').textContent = fmt(s.dust);
    const w = C.WEATHERS[this.g.weather]; this.$('h-weather').innerHTML = `${this.g.mood === 'night' ? '🌙' : w.icon} ${w.name}`;
    this.$('h-qdot').hidden = !s.quests.list.some((q) => q.have >= q.need && !q.claimed);
    const b = s.mons.find((m) => m.uid === s.buddy), egg = s.eggs.slice().sort((a, c) => (c.walked / c.need) - (a.walked / a.need))[0];
    this.$('h-buddy').innerHTML = (b ? `<img src="${portrait(b.sp, b.shiny)}" alt="">` : '') + (egg ? `<span class="eggp">🥚<span class="xpbar"><i style="width:${Math.min(100, (egg.walked / egg.need) * 100)}%"></i></span></span>` : b ? `<span class="eggp"><small>단짝</small></span>` : '<span class="eggp">🎒</span>');
    const left = s.incenseUntil - Date.now(); this.$('h-inc').hidden = left <= 0; if (left > 0) this.$('h-inc').textContent = `🎈 ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  }
  nearby(list) { const key = list.map((a) => a.mon.uid + (a.dist > 30 ? 'f' : 'n')).join(); if (key === this.nearKey) return; this.nearKey = key; this.$('h-near').innerHTML = list.slice(0, 4).map((a, i) => `<button data-a="near" data-i="${i}" class="${this.save.dex[a.mon.sp]?.caught ? '' : 'unknown'}"><img src="${portrait(a.mon.sp, a.mon.shiny)}" alt=""></button>`).join(''); this.nearList = list; }
  a_near(d) { const a = this.nearList[+d.i]; if (a) this.g.goTo(a); }
  a_menu() { const m = this.$('menu'); m.hidden = !m.hidden; this.g.sfx(m.hidden ? 'close' : 'open'); }
  a_open(d) { this.$('menu').hidden = true; this.openSheet(d.p, d); this.g.sfx('open'); }
  a_close() { this.closeSheet(); this.g.sfx('close'); }
  a_back() { this.openSheet(this.backTo || 'mons'); this.g.sfx('tap'); }
  closeSheet() { this.$('sheet').hidden = true; this.panel = null; this.pickSlot = null; }
  openSheet(name, arg = {}) { this.panel = name; this.arg = arg; const s = this.$('sheet'), keep = s.querySelector('.body')?.scrollTop || 0, same = s.dataset.p === name + (arg.uid || arg.id || ''); s.dataset.p = name + (arg.uid || arg.id || ''); s.innerHTML = this['p_' + name](arg); s.hidden = false; if (same) s.querySelector('.body').scrollTop = keep; }
  rerender() { if (this.panel) this.openSheet(this.panel, this.arg); this.refresh(); }
  frame(title, body, back) { return `<div class="card"><header>${back ? '<button class="round sm" data-a="back">←</button>' : ''}<h2>${title}</h2><button class="round sm" data-a="close">✕</button></header><div class="body">${body}</div></div>`; }
  monCard(m, extra = '') { const s = C.species(m.sp); return `<button class="mon ${m.shiny ? 'shiny' : ''}" data-a="mon" data-uid="${m.uid}" ${extra}><i class="pw">힘 ${C.power(m)}</i>${m.fav ? '<i class="fav">★</i>' : ''}${this.save.buddy === m.uid ? '<i class="bud">💛</i>' : ''}<img src="${portrait(m.sp, m.shiny)}" alt="" loading="lazy"><b>${s.name}</b><span class="eldot" style="background:${C.ELEMENTS[s.el].color}"></span></button>`; }
  // ---------- 모아몬 목록 ----------
  p_mons() {
    const s = this.save, list = s.mons.slice().sort(SORTS[this.sort][1]);
    const head = this.pickSlot != null ? `<p class="note">도장에 나갈 친구를 골라 줘</p>` : `<div class="tabs">${Object.entries(SORTS).map(([k, v]) => `<button class="${k === this.sort ? 'on' : ''}" data-a="sort" data-k="${k}">${v[0]}</button>`).join('')}</div>`;
    return this.frame(`모아몬 <small>${s.mons.length}/${C.MAX_MONS}</small>`, head + `<div class="grid">${list.map((m) => this.monCard(m)).join('')}</div>` + (list.length ? '' : '<p class="note">아직 친구가 없어. 밖에 나가서 잡아 보자!</p>'));
  }
  a_sort(d) { this.sort = d.k; this.rerender(); this.g.sfx('tap'); }
  a_mon(d) { if (this.pickSlot != null) { const s = this.save, t = s.team.filter((u) => u !== d.uid); t.splice(this.pickSlot, 0, d.uid); s.team = t.slice(0, 3); this.g.persist(); const poi = this.pickPoi; this.pickSlot = null; this.closeSheet(); this.openArena(poi); return; } this.backTo = 'mons'; this.openSheet('detail', { uid: d.uid }); this.g.sfx('tap'); }
  p_detail({ uid }) {
    const s = this.save, m = s.mons.find((x) => x.uid === uid); if (!m) return this.p_mons();
    const sp = C.species(m.sp), st = C.stats(m), fam = C.familyOf(m.sp), candy = s.candy[fam] || 0, cost = C.powerUpCost(m), maxed = m.lv >= C.maxMonLevel(s), famName = C.species(fam).name;
    const bar = (name, v, max) => `<div class="stat"><span>${name}</span><div class="xpbar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div></div>`;
    return this.frame(sp.name, `
      <div class="hero ${m.shiny ? 'shiny' : ''}" style="--c:${C.ELEMENTS[sp.el].color}"><div class="pwbig">힘 <b>${C.power(m)}</b></div><img src="${portrait(m.sp, m.shiny)}" alt=""><button class="favbtn ${m.fav ? 'on' : ''}" data-a="fav" data-uid="${uid}">★</button></div>
      <div class="row center">${ELCHIP(sp.el)}<span class="elchip" style="--c:#8a94a8">레벨 ${m.lv}</span><span class="elchip" style="--c:#f0a81c">${'★'.repeat(C.stars(m)) || '☆'} 재능</span>${m.shiny ? '<span class="elchip" style="--c:#e86ad0">반짝이</span>' : ''}</div>
      <div class="stats">${bar('공격', st.atk, 230)}${bar('방어', st.def, 230)}${bar('체력', st.hp, 210)}</div>
      <div class="row center res"><span>✨ 별가루 <b>${fmt(s.dust)}</b></span><span>🍬 ${famName} 사탕 <b>${candy}</b></span></div>
      <button class="btn" data-a="powerup" data-uid="${uid}" ${maxed ? 'disabled' : ''}><b>강하게 하기</b><small>${maxed ? '탐험가 레벨을 올리면 더 키울 수 있어' : `✨ ${fmt(cost.dust)} · 🍬 ${cost.candy}`}</small></button>
      ${sp.to ? `<button class="btn green" data-a="evolve" data-uid="${uid}" ${candy < sp.need ? 'disabled' : ''}><b>진화시키기 → ${this.save.dex[sp.to]?.caught ? C.species(sp.to).name : '???'}</b><small>🍬 ${sp.need}</small></button>` : ''}
      <div class="row"><button class="btn ghost" data-a="buddy" data-uid="${uid}">${s.buddy === uid ? '💛 단짝이야' : '🤍 단짝 삼기'}</button><button class="btn ghost" data-a="release" data-uid="${uid}">👋 보내 주기</button></div>
      <p class="note">${sp.text}</p><p class="note sm">기술: ${C.ELEMENTS[sp.el].fast} · ${C.ELEMENTS[sp.el].charge} &nbsp;|&nbsp; 단짝과 300m 걸으면 사탕 1개</p>`, true);
  }
  mon(uid) { return this.save.mons.find((x) => x.uid === uid); }
  a_fav(d) { const m = this.mon(d.uid); m.fav = !m.fav; this.g.persist(); this.rerender(); this.g.sfx('tap'); }
  a_buddy(d) { this.save.buddy = this.save.buddy === d.uid ? null : d.uid; this.g.persist(); this.rerender(); this.g.sfx('berry'); this.g.buddyChanged(); }
  a_powerup(d) { const m = this.mon(d.uid), err = C.powerUp(this.save, m); if (err) { this.toast(err); this.g.sfx('no'); return; } C.questEvent(this.save, 'up'); this.g.persist(); this.g.sfx('power'); this.rerender(); const h = this.$('sheet').querySelector('.hero'); if (h) h.classList.add('pulse'); }
  a_evolve(d) {
    const m = this.mon(d.uid), from = m.sp, r = C.evolve(this.save, m); if (typeof r === 'string') { this.toast(r); this.g.sfx('no'); return; }
    this.g.persist(); this.g.sfx('evolve'); this.rerender(); const a = C.species(from), b = C.species(m.sp);
    this.modal(`<div class="evo"><h3>어? ${a.name}의 모습이...!</h3><div class="evobox"><img class="from" src="${portrait(from, m.shiny)}" alt=""><img class="to" src="${portrait(m.sp, m.shiny)}" alt=""></div><h2 class="late">${C.josa(b.name, '으로', '로')} 진화했다!</h2><p class="late">힘 ${C.power(m)}${r.isNew ? ' · 도감에 새로 올랐어' : ''}</p><button class="btn late" data-a="ok">좋아!</button></div>`, () => this.levelUps(r.ups));
  }
  a_release(d) { const m = this.mon(d.uid); this.confirm(`${C.species(m.sp).name}(힘 ${C.power(m)})${C.josa(C.species(m.sp).name, '을', '를').slice(-1)} 자연으로 보내 줄까? 사탕 1개를 받아.`, () => { const err = C.release(this.save, m); if (err) { this.toast(err); this.g.sfx('no'); return; } this.g.persist(); this.g.buddyChanged(); this.openSheet('mons'); this.toast('잘 가! 사탕 1개를 받았어', '🍬'); }); }
  // ---------- 도감 ----------
  p_dex() {
    const s = this.save, got = C.SPECIES.filter((x) => s.dex[x.id]?.caught).length;
    return this.frame(`도감 <small>${got}/${C.SPECIES.length}</small>`, `<div class="grid dex">${C.SPECIES.map((x) => { const d = s.dex[x.id]; return `<button class="mon ${d?.caught ? '' : d?.seen ? 'seen' : 'none'}" data-a="dexone" data-id="${x.id}"><i class="pw">${String(x.no).padStart(3, '0')}</i>${d?.seen ? `<img src="${portrait(x.id)}" alt="" loading="lazy">` : '<span class="q">?</span>'}<b>${d?.seen ? x.name : '???'}</b></button>`; }).join('')}</div>`);
  }
  a_dexone(d) { if (!this.save.dex[d.id]?.seen) { this.g.sfx('no'); return; } this.backTo = 'dex'; this.openSheet('dexone', { id: d.id }); this.g.sfx('tap'); }
  p_dexone({ id }) {
    const x = C.species(id), d = this.save.dex[id] || {}, W = { park: '공원', forest: '숲', house: '주택가', shop: '상점가', lake: '호수', plaza: '광장', night: '밤', legend: '아주 드물게' };
    const chain = []; let c = C.species(C.familyOf(id)); while (c) { chain.push(c); c = C.species(c.to); }
    return this.frame(`${String(x.no).padStart(3, '0')} ${x.name}`, `<div class="hero ${d.caught ? '' : 'seen'}" style="--c:${C.ELEMENTS[x.el].color}"><img src="${portrait(id)}" alt=""></div>
      <div class="row center">${ELCHIP(x.el)}<span class="elchip" style="--c:#8a94a8">${'◆'.repeat(x.rare)} 희귀도</span><span class="elchip" style="--c:#8a94a8">잡은 수 ${d.caught || 0}</span></div>
      <p class="note">${d.caught ? x.text : '아직 잡지 못했어. 잡으면 설명을 볼 수 있어.'}</p><p class="note sm">사는 곳: ${x.where.map((w) => W[w]).join(', ')}</p>
      ${chain.length > 1 ? `<div class="chain">${chain.map((y) => `<span class="${this.save.dex[y.id]?.seen ? '' : 'none'}">${this.save.dex[y.id]?.seen ? `<img src="${portrait(y.id)}" alt="">` : '<span class="q">?</span>'}<b>${this.save.dex[y.id]?.seen ? y.name : '???'}</b></span>`).join('<i>→</i>')}</div>` : ''}
      ${d.shiny ? `<div class="chain"><span><img src="${portrait(id, true)}" alt=""><b>반짝이 모습</b></span></div>` : ''}`, true);
  }
  // ---------- 가방, 상점, 할 일, 내 정보 ----------
  p_bag() {
    const s = this.save;
    return this.frame('가방', `<div class="list">${Object.entries(C.ITEMS).filter(([k]) => k !== 'egg').map(([k, it]) => `<div class="item"><span class="ic">${it.icon}</span><div><b>${it.name}</b><small>${it.text}</small></div><i>×${s.items[k] || 0}</i>${k === 'incense' ? `<button class="btn sm" data-a="incense" ${s.items.incense > 0 ? '' : 'disabled'}>쓰기</button>` : ''}</div>`).join('')}</div>
      <h3>알 <small>${s.eggs.length}/${C.MAX_EGGS}</small></h3><div class="list">${s.eggs.map((e) => `<div class="item"><span class="ic egg t${e.tier}">🥚</span><div><b>${['동글 알', '줄무늬 알', '별무늬 알'][e.tier]}</b><div class="xpbar"><i style="width:${Math.min(100, (e.walked / e.need) * 100)}%"></i></div></div><i>${Math.floor(Math.min(e.walked, e.need))}/${e.need}m</i></div>`).join('') || '<p class="note">알이 없어. 별샘을 돌리면 가끔 나와.</p>'}</div>`);
  }
  a_incense() { if (this.g.useIncense()) { this.closeSheet(); this.toast('향기풍선을 띄웠어! 5분 동안 몬스터가 모여', '🎈'); } }
  p_shop() { const s = this.save; return this.frame('상점', `<p class="note">🪙 코인 <b>${fmt(s.coins)}</b> · 도장에서 이기거나 할 일을 하면 코인을 받아</p><div class="list">${Object.entries(C.ITEMS).map(([k, it]) => `<div class="item"><span class="ic">${it.icon}</span><div><b>${it.name} ×${it.price[0]}</b><small>${it.lv && s.lv < it.lv ? `레벨 ${it.lv}부터` : it.text}</small></div><button class="btn sm" data-a="buy" data-k="${k}" ${s.coins < it.price[1] || (it.lv && s.lv < it.lv) ? 'disabled' : ''}>🪙 ${it.price[1]}</button></div>`).join('')}</div>`); }
  a_buy(d) { const err = C.buy(this.save, d.k); if (err) { this.toast(err); this.g.sfx('no'); return; } this.g.persist(); this.g.sfx('coin'); this.toast(`${C.ITEMS[d.k].name} ×${C.ITEMS[d.k].price[0]} 샀어`, C.ITEMS[d.k].icon); this.rerender(); }
  p_quests() {
    const s = this.save;
    return this.frame('오늘의 할 일', `<div class="list">${s.quests.list.map((q, i) => `<div class="item quest ${q.claimed ? 'done' : ''}"><div><b>${C.questText(q)}</b><div class="xpbar"><i style="width:${(q.have / q.need) * 100}%"></i></div><small>보상: ${Object.entries(q.reward).map(([k, n]) => `${C.ITEMS[k].icon}×${n}`).join(' ')} 🪙${q.coins}</small></div><i>${Math.floor(q.have)}/${q.need}</i>${q.claimed ? '<span class="check">✔</span>' : `<button class="btn sm" data-a="claim" data-i="${i}" ${q.have >= q.need ? '' : 'disabled'}>받기</button>`}</div>`).join('')}</div><p class="note">${s.quests.bonus ? '오늘 할 일을 모두 끝냈어! ✨ 1,500 받음' : '세 가지를 모두 끝내면 별가루 ✨ 1,500을 더 받아. 내일 새 할 일이 생겨.'}</p>`);
  }
  a_claim(d) { const r = C.claimQuest(this.save, +d.i); if (!r) return; this.g.persist(); this.g.sfx('item'); this.toast(`보상을 받았어! 🪙${r.coins}${r.bonusDust ? ' · 모두 완료 ✨1,500' : ''}`, '🎁'); this.rerender(); this.levelUps(r.ups); }
  p_me() {
    const s = this.save, got = C.SPECIES.filter((x) => s.dex[x.id]?.caught).length;
    return this.frame('내 정보', `<div class="mebox"><div class="lvbig">${s.lv}</div><div><b>탐험가 레벨 ${s.lv}</b><div class="xpbar"><i style="width:${Math.min(100, (s.xp / C.xpNeed(s.lv)) * 100)}%"></i></div><small>${fmt(s.xp)} / ${fmt(C.xpNeed(s.lv))}</small></div></div>
      <div class="facts">${[['잡은 수', s.stats.caught], ['도감', `${got}/${C.SPECIES.length}`], ['걸은 거리', `${(s.dist / 1000).toFixed(2)}km`], ['별샘', s.stats.spins], ['도장 승리', s.stats.wins], ['알 부화', s.stats.hatched || 0], ['진화', s.stats.evolved || 0], ['반짝이', s.stats.shiny || 0]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      <div class="row"><button class="btn ghost" data-a="toggle" data-k="sound">${s.settings.sound ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐'}</button><button class="btn ghost" data-a="toggle" data-k="music">${s.settings.music ? '🎵 음악 켜짐' : '🎵 음악 꺼짐'}</button></div>
      <h3>하는 법</h3><p class="note left">🚶 <b>걷기</b>: WASD나 방향키, 땅을 누르기, 손가락 스틱<br>👆 <b>둘러보기</b>: 화면을 끌면 돌아가고, 휠이나 두 손가락으로 크기 조절<br>🫧 <b>잡기</b>: 몬스터를 누르고, 방울을 위로 밀어 던져. 고리가 작을 때 맞히면 더 잘 잡혀<br>💠 <b>별샘</b>: 가까이 가서 누르고 돌리면 방울과 열매가 나와<br>🏯 <b>도장</b>: 지킴이 세 마리와 싸워서 이기면 코인을 받아<br>🥚 <b>알</b>: 걸으면 깨어나</p>
      <button class="btn ghost danger" data-a="reset">처음부터 다시 하기</button>`);
  }
  a_toggle(d) { const s = this.save.settings; s[d.k] = !s[d.k]; this.g.persist(); this.g.applySettings(); this.rerender(); }
  a_reset() { this.confirm('정말 처음부터 다시 할까? 지금까지 모은 친구가 모두 사라져.', () => this.confirm('한 번 더 물어볼게. 되돌릴 수 없어. 정말 지울까?', () => this.g.reset())); }
  // ---------- 별샘 ----------
  openStop(poi) {
    const cd = (this.save.stopCd[poi.key] || 0) - Date.now(), far = this.g.distTo(poi) > 24;
    this.modal(`<div class="stop ${cd > 0 ? 'cool' : ''}"><h3>${poi.name}</h3><div class="disc" id="disc"><span>💠</span></div><div id="stoploot" class="lootbox"><p class="note">${far ? '너무 멀어. 조금 더 가까이 가 보자.' : cd > 0 ? `조금 뒤에 다시 돌릴 수 있어 (${Math.ceil(cd / 1000)}초)` : '돌려서 선물을 받자!'}</p></div><div class="row"><button class="btn" data-a="spin" ${far || cd > 0 ? 'disabled' : ''}>돌리기</button><button class="btn ghost" data-a="ok">닫기</button></div></div>`); this.stopPoi = poi;
  }
  a_spin(d, b) { const r = this.g.spinStop(this.stopPoi); if (!r) return; b.disabled = true; this.$('disc').classList.add('spin'); this.$('modal').querySelector('.stop').classList.add('cool'); setTimeout(() => { const box = this.$('stoploot'); if (box) box.innerHTML = itemList(r.loot) + `<div class="loot"><span>⭐</span><b>경험치</b><i>+${r.xp}</i></div>`; this.g.sfx('item'); }, 650); this.afterModal = () => this.levelUps(r.ups); }
  // ---------- 도장 ----------
  openArena(poi) {
    const s = this.save, wins = s.arenas[poi.key] || 0, a = C.arenaTeam(poi.seed, wins, s.lv), far = this.g.distTo(poi) > 30;
    if (s.team.length < Math.min(3, s.mons.length)) s.team = C.bestTeam(s);
    const mine = s.team.map((u) => this.mon(u)).filter(Boolean);
    const face = (m, i, mineSide) => `<button class="mon mini" ${mineSide ? `data-a="pickteam" data-i="${i}"` : 'disabled'}><i class="pw">힘 ${C.power(m)}</i><img src="${portrait(m.sp, m.shiny)}" alt=""><b>${C.species(m.sp).name}</b></button>`;
    this.arenaPoi = poi; this.arenaFoes = a;
    this.modal(`<div class="arena" style="--c:${C.ELEMENTS[a.el].color}"><h3>🏯 ${poi.name}</h3><div class="row center">${ELCHIP(a.el)}<span class="elchip" style="--c:#f0a81c">🏆 이긴 횟수 ${wins}</span></div><p class="note sm">지킴이</p><div class="team">${a.team.map((m, i) => face(m, i, false)).join('')}</div><p class="note sm">내 친구 (누르면 바꿀 수 있어)</p><div class="team">${mine.map((m, i) => face(m, i, true)).join('') || '<p class="note">먼저 몬스터를 잡아야 해</p>'}</div><div class="row"><button class="btn" data-a="fight" ${far || !mine.length ? 'disabled' : ''}>${far ? '더 가까이 가야 해' : '도전!'}</button><button class="btn ghost" data-a="ok">닫기</button></div></div>`);
  }
  a_pickteam(d) { this.pickSlot = +d.i; this.pickPoi = this.arenaPoi; this.closeModal(true); this.openSheet('mons'); }
  a_fight() { const mine = this.save.team.map((u) => this.mon(u)).filter(Boolean); this.closeModal(true); this.g.startBattle(this.arenaPoi, mine, this.arenaFoes); }
  // ---------- 잡기 화면 ----------
  encRefresh() {
    const e = this.g.enc; if (!e.active) return; const s = this.save, m = e.mon, sp = C.species(m.sp), known = s.dex[m.sp]?.caught;
    this.$('en-name').innerHTML = `<b>${sp.name}${m.shiny ? ' ✨' : ''}</b><span>힘 ${C.power(m)}</span>${ELCHIP(sp.el)}${known ? '' : '<span class="elchip" style="--c:#ff7a3d">새 친구!</span>'}`;
    this.$('en-ball').innerHTML = `${C.ITEMS[e.ballType].icon}<i>${s.items[e.ballType] || 0}</i>`; this.$('en-berry').innerHTML = `${e.gold ? '🍍' : '🍓'}<i>${(s.items.berry || 0) + (s.items.gberry || 0)}</i>`; this.$('en-berry').classList.toggle('on', !!e.berry || e.gold);
    const aim = e.state === 'aim'; this.$('en-ball').disabled = this.$('en-berry').disabled = !aim; this.root.querySelector('.run').hidden = !(aim || e.state === 'intro'); if (!aim) this.$('en-pop').hidden = true;
    this.$('en-hint').textContent = aim && s.stats.caught < 3 ? '방울을 위로 휙 밀어서 던져!' : ''; this.$('en-hint').classList.toggle('on', aim && s.stats.caught < 3);
  }
  a_run() { this.g.runAway(); }
  a_ballpop() { const p = this.$('en-pop'), s = this.save; if (!p.hidden && p.dataset.k === 'ball') { p.hidden = true; return; } p.dataset.k = 'ball'; p.className = 'en-pop right'; p.innerHTML = ['ball', 'ball2', 'ball3'].map((k) => `<button data-a="setball" data-k="${k}" ${s.items[k] > 0 ? '' : 'disabled'}><span>${C.ITEMS[k].icon}</span><b>${C.ITEMS[k].name}</b><i>×${s.items[k] || 0}</i></button>`).join(''); p.hidden = false; this.g.sfx('tap'); }
  a_berrypop() { const p = this.$('en-pop'), s = this.save; if (!p.hidden && p.dataset.k === 'berry') { p.hidden = true; return; } p.dataset.k = 'berry'; p.className = 'en-pop left'; p.innerHTML = ['berry', 'gberry'].map((k) => `<button data-a="feed" data-k="${k}" ${s.items[k] > 0 ? '' : 'disabled'}><span>${C.ITEMS[k].icon}</span><b>${C.ITEMS[k].name}</b><i>×${s.items[k] || 0}</i></button>`).join(''); p.hidden = false; this.g.sfx('tap'); }
  a_setball(d) { this.$('en-pop').hidden = true; this.g.enc.setBall(d.k); this.g.sfx('tap'); }
  a_feed(d) { this.$('en-pop').hidden = true; this.g.feed(d.k); }
  catchResult(m, r, done) {
    const sp = C.species(m.sp);
    this.modal(`<div class="result ${m.shiny ? 'shiny' : ''}" style="--c:${C.ELEMENTS[sp.el].color}">${r.isNew ? '<div class="newtag">도감에 새로 올랐어!</div>' : ''}<div class="hero"><div class="pwbig">힘 <b>${C.power(m)}</b></div><img src="${portrait(m.sp, m.shiny)}" alt=""></div><h2>${sp.name}${m.shiny ? ' ✨' : ''}</h2><div class="row center">${ELCHIP(sp.el)}<span class="elchip" style="--c:#f0a81c">${'★'.repeat(C.stars(m)) || '☆'} 재능</span></div>
      <div class="lines">${r.lines.map((l, i) => `<div style="animation-delay:${0.25 + i * 0.18}s"><span>${l[0]}</span><b>+${l[1]} 경험치</b></div>`).join('')}</div><div class="row center res"><span>🍬 ${C.species(r.fam).name} 사탕 <b>+${r.candy}</b></span><span>✨ <b>+${r.dust}</b></span></div><button class="btn" data-a="ok">좋아!</button></div>`, () => { this.levelUps(r.ups); done && done(); });
  }
  // ---------- 싸움 화면 ----------
  batRefresh() {
    const b = this.g.battle; if (!b.active) return; const v = b.view, key = v.me.i + '|' + v.foe.i + '|' + v.me.team.map((t) => t.hp > 0).join() + v.foe.team.map((t) => t.hp > 0).join();
    if (key !== this.batKey) {
      this.batKey = key; const bar = (s, side) => `<div class="bbar ${side}"><div class="bhead"><b>${s.name}</b>${ELCHIP(Object.keys(C.ELEMENTS).find((k) => C.ELEMENTS[k] === s.el))}<span class="dots">${s.team.map((t) => `<i class="${t.hp > 0 ? 'on' : ''}"></i>`).join('')}</span></div><div class="hpbar"><i id="hp-${side}"></i></div></div>`;
      this.$('bat').innerHTML = `${bar(v.foe, 'foe')}<div class="btime" id="bt-time"></div><div class="bwarn" id="bt-warn" hidden>❗ 피해!</div>${bar(v.me, 'me')}<div class="energy"><i id="bt-en"></i></div><div class="bbtns">${v.me.team.map((t, i) => i === v.me.i ? '' : `<button class="mon mini" data-a="swap" data-i="${i}" ${t.hp > 0 ? '' : 'disabled'}><img src="${portrait(t.mon.sp, t.mon.shiny)}" alt=""></button>`).join('')}<button class="round big" data-a="dodge" id="bt-dodge">💨<small>피하기</small></button><button class="round big charge" data-a="charge" id="bt-charge">${v.me.el.icon}<small>${v.me.el.charge}</small></button></div><div class="en-hint on" id="bt-hint">화면을 톡톡 눌러 공격!</div>`;
    }
    const pct = (s) => Math.max(0, (s.hp / s.max) * 100); for (const side of ['me', 'foe']) { const e = this.$('hp-' + side); e.style.width = pct(v[side]) + '%'; e.className = pct(v[side]) < 25 ? 'low' : pct(v[side]) < 55 ? 'mid' : ''; }
    this.$('bt-en').style.width = v.me.energy + '%'; this.$('bt-charge').classList.toggle('ready', v.me.energy >= 100); this.$('bt-time').textContent = v.time; this.$('bt-warn').hidden = !v.warn; this.$('bt-dodge').classList.toggle('ready', v.warn);
    if (b.t > 6) this.$('bt-hint').classList.remove('on');
  }
  a_swap(d) { this.g.battle.swap(+d.i); } a_dodge() { this.g.battle.dodge(); } a_charge() { this.g.battle.charge(); }
  battleResult(win, r, done) { this.batKey = null; this.modal(win ? `<div class="result" style="--c:#f0a81c"><h2>🏆 이겼다!</h2><p class="note">이 도장에서 ${r.wins}번째 승리야. 다음에는 지킴이가 더 강해져.</p><div class="lootbox"><div class="loot"><span>🪙</span><b>코인</b><i>+${r.coins}</i></div><div class="loot"><span>✨</span><b>별가루</b><i>+${r.dust}</i></div><div class="loot"><span>⭐</span><b>경험치</b><i>+${r.xp}</i></div></div><button class="btn" data-a="ok">좋아!</button></div>` : `<div class="result" style="--c:#8a94a8"><h2>아쉽다...</h2><p class="note">몬스터를 더 강하게 키우거나, 지킴이 속성에 강한 친구를 데려가 보자.<br>(풀 → 물·돌, 불 → 풀·달, 물 → 불·돌, 번개 → 물·바람, 돌 → 불·번개, 바람 → 풀·달, 달 → 번개·물)</p><button class="btn" data-a="ok">알겠어</button></div>`, () => { if (r) this.levelUps(r.ups); done && done(); }); }
  // ---------- 알림 창 ----------
  modal(html, onClose) { this.modals.push([html, onClose]); if (this.modals.length === 1) this.showModal(); }
  showModal() { const m = this.$('modal'); if (!this.modals.length) { m.hidden = true; return; } m.innerHTML = this.modals[0][0]; m.hidden = false; this.afterModal = null; }
  closeModal(silent) { const cur = this.modals.shift(); const after = this.afterModal; this.afterModal = null; this.showModal(); if (!silent) { cur && cur[1] && cur[1](); after && after(); } }
  a_ok() { this.g.sfx('tap'); this.closeModal(); }
  confirm(text, yes) { this.yes = yes; this.modal(`<div class="confirm"><p>${text}</p><div class="row"><button class="btn danger" data-a="yes">응</button><button class="btn ghost" data-a="ok">아니</button></div></div>`); }
  a_yes() { const y = this.yes; this.yes = null; this.closeModal(true); y && y(); }
  get busy() { return this.modals.length > 0 || this.panel != null || !this.$('menu').hidden || !this.$('title').hidden; }
  levelUps(ups) { for (const u of ups || []) { this.g.sfx('level'); this.modal(`<div class="result" style="--c:#3fa7ff"><div class="newtag">레벨 업!</div><div class="lvbig huge">${u.lv}</div><p class="note">탐험가 레벨 ${u.lv}이 되었어!${u.lv === 5 ? '<br>이제 큰방울을 쓸 수 있고, 전설의 몬스터가 아주 드물게 나타나.' : u.lv === 10 ? '<br>이제 별방울을 쓸 수 있어.' : ''}</p><div class="lootbox">${itemList(u.gift)}<div class="loot"><span>🪙</span><b>코인</b><i>+${u.coins}</i></div></div><button class="btn" data-a="ok">좋아!</button></div>`); } this.refresh(); }
  hatched(list) { for (const h of list) { const sp = C.species(h.mon.sp); this.g.sfx('hatch'); this.modal(`<div class="result ${h.mon.shiny ? 'shiny' : ''}" style="--c:${C.ELEMENTS[sp.el].color}"><div class="newtag">알이 깨어났어!</div><div class="hero hatch"><div class="pwbig">힘 <b>${C.power(h.mon)}</b></div><img src="${portrait(h.mon.sp, h.mon.shiny)}" alt=""></div><h2>${sp.name}${h.mon.shiny ? ' ✨' : ''}</h2><div class="row center res"><span>🍬 <b>+${h.candy}</b></span><span>✨ <b>+${h.dust}</b></span></div><button class="btn" data-a="ok">반가워!</button></div>`, () => this.levelUps(h.ups)); } }
  // ---------- 처음 화면 ----------
  title(hasSave, onStart) { const t = this.$('title'); t.hidden = false; t.innerHTML = `<div class="logo"><span class="bub">🫧</span><h1><em>모아몬</em> 탐험대</h1><p>걸어서 찾고, 방울로 잡고, 같이 자라는 모험</p></div><button class="btn start" data-a="start">${hasSave ? '이어서 하기' : '모험 시작'}</button><small class="foot">seonn.dev · 모든 몬스터와 그림, 음악은 직접 만들었어요</small>`; this.onStart = onStart; }
  a_start() { this.$('title').hidden = true; this.onStart(); }
  starters(onPick) { this.onPick = onPick; this.modal(`<div class="result starters"><h2>첫 친구를 골라 줘!</h2><p class="note">세 마리 중 한 마리가 너와 함께 모험을 떠나고 싶어 해.</p><div class="team">${C.STARTERS.map((id) => { const s = C.species(id); return `<button class="mon" data-a="starter" data-id="${id}"><img src="${portrait(id)}" alt=""><b>${s.name}</b>${ELCHIP(s.el)}</button>`; }).join('')}</div></div>`); }
  a_starter(d) { this.closeModal(true); this.onPick(d.id); }
}
