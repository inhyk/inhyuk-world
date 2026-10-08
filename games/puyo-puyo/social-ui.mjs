// 온라인 계정으로 하는 것들의 화면: 온라인 대전(게임 찾기, 친구 초대), 닉네임 친구, 1:1 대화, 초대 알림,
// 차단과 신고, 결과 화면의 "친구 요청", 저장 충돌 고르기 창. 게임 규칙과 계정 관리는 main.js 에 있다.
// 대전 채팅 창(빠른 말, 뿌요 이모티콘, 이모지)과 이 기기 계정의 친구 코드 친구도 main.js 에 있다.
// 상대 이름은 서버가 준 닉네임만 보여 주고, 사람이 쓴 글은 모두 textContent 로 넣는다.
import { NET_GAME } from './net.mjs';
import { QUICK, STICKERS, EMOJIS, validSticker, bigEmoji } from './chat.mjs';
import { GIFT_COINS, giftable, giftBody, giftCost, giftText, parseGift, looksLikeGift } from './gifts.mjs';
import { SKINS, EFFECTS } from './shop.mjs';

// 1:1 대화의 뿌요 이모티콘: 서버는 글만 받으므로 [[st:번호]] 로 보내고, 받는 쪽이 그림으로 바꾼다
export const stickerBody = n => `[[st:${n}]]`;
export function bodySticker(body) {
  const m = /^\[\[st:(\d{1,2})\]\]$/.exec(String(body ?? '').trim());
  return m && validSticker(Number(m[1])) ? Number(m[1]) : null;
}

const fmt = n => Number(n || 0).toLocaleString('ko-KR');
const when = v => {
  if (v === null || v === undefined || v === '') return '모름';
  const d = new Date(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v);
  return Number.isNaN(d.getTime()) ? '모름' : d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(label, cls, onclick) {
  const b = el('button', cls, label);
  b.type = 'button';
  b.onclick = onclick;
  return b;
}

// deps: $, toast, sound, show(name), screen() → 지금 화면, online, social() → Social | null, user() → { id, nickname } | null,
//       P() → 내 기록, leaveOnline() → 온라인 판/방을 접는다, stopGame() → 다른 판을 하고 있으면 접는다,
//       chatOn() → 설정에서 채팅을 켰는지, stickerImg(n) → 뿌요 이모티콘 <img> 의 src,
//       watch(entry) → 그 대전을 관전한다 (entry: 관전 목록의 한 줄),
//       friendsChanged(n) → 서버에서 받아 온 친구 수 (친구 배수),
//       gifts: { pay(gift) → 값을 치렀나, refund(gift), sent(gift, nickname), receive(gift, { from, nickname, id }) } 친구 선물 (gifts.mjs)
export function createSocialUI(deps) {
  const { $, toast, sound, online } = deps;
  let friends = [], incoming = [], outgoing = [], unread = new Map(), dmWith = null, dmLines = [], invite = null, inviteTimer = null;
  let live = new Map(); // 친구 번호 → 지금 하는 대전 (관전하기)
  let giftTo = null, giftTab = 'coins', giftBusy = false; // 선물하기 창: 받을 친구, 고른 종류, 보내는 중

  // ---------- 알림 개수 (메뉴, 온라인 화면의 친구 단추) ----------
  function counts() {
    // 메뉴의 친구 단추(friend-badge)는 이 기기 계정이면 main.js 가 친구 코드 친구 수로 센다
    const user = deps.user(), n = user ? incoming.length + [...unread.values()].reduce((a, b) => a + b, 0) : 0;
    for (const id of user ? ['online-badge', 'friends-badge', 'friend-badge'] : ['online-badge', 'friends-badge']) { const b = $(id); if (b) { b.hidden = !n; b.textContent = n; } }
  }
  async function refreshCounts() {
    const s = deps.social();
    if (!s) { incoming = []; unread.clear(); counts(); return; }
    try {
      const [reqs, list, mine] = await Promise.all([s.requests(), s.unread(), s.friends()]);
      incoming = reqs.incoming; outgoing = reqs.outgoing; friends = mine;
      unread = new Map(list.map(u => [u.id, u.count]));
      deps.friendsChanged?.(friends.length);
      collectGifts(list); // 꺼 둔 동안 온 선물을 받는다
    } catch { /* 다음에 다시 */ }
    counts();
  }

  // ---------- 친구 선물 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 7번): 코인, 스킨, 터짐 효과 ----------
  // 선물은 1:1 대화에 정해진 모양의 글로 오간다 (gifts.mjs). 받은 글이 나에게 온 선물이면 기록에 넣는다.
  // 같은 메시지를 여러 번 봐도 메시지 번호로 한 번만 받는다.
  function takeGift(message, from) {
    if (!message || !from?.id || message.from !== from.id || message.to !== deps.user()?.id) return false;
    const gift = parseGift(message.body);
    if (!gift) return false;
    deps.gifts?.receive(gift, { from: from.id, nickname: from.nickname, id: message.id });
    return true;
  }
  // 안 읽은 메시지가 있는 친구들의 대화를 훑어서 선물을 받는다
  async function collectGifts(list) {
    const s = deps.social();
    for (const u of list.slice(0, 20)) {
      if (!s || s !== deps.social()) return;
      try { for (const m of (await s.history(u.id)).messages) takeGift(m, u); } catch { /* 다음에 다시 */ }
    }
  }
  function giftNote(text) { $('gift-note').textContent = text; }
  function openGift(friend) {
    if (!deps.social() || !friend?.id) return;
    giftTo = { id: friend.id, nickname: friend.nickname };
    giftTab = 'coins';
    $('gift-pop').hidden = false;
    giftNote('');
    paintGift();
  }
  function closeGift() { giftTo = null; $('gift-pop').hidden = true; }
  function paintGift() {
    if (!giftTo) return;
    const coins = deps.P().coins;
    $('gift-title').textContent = `🎁 ${giftTo.nickname}에게 선물하기`;
    $('gift-coins').textContent = fmt(coins);
    $('gift-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === giftTab));
    const gifts = giftTab === 'coins' ? GIFT_COINS.map(amount => ({ kind: 'coins', amount }))
      : (giftTab === 'skin' ? SKINS : EFFECTS).filter(item => giftable(giftTab, item.id)).map(item => ({ kind: giftTab, id: item.id, name: item.name }));
    $('gift-list').replaceChildren(...gifts.map(gift => {
      const cost = giftCost(gift);
      const b = button('', 'gift-item', () => { sound.sfx('click'); sendGift(gift); });
      b.disabled = giftBusy || coins < cost;
      b.dataset.gift = gift.kind === 'coins' ? `coins-${gift.amount}` : `${gift.kind}-${gift.id}`;
      b.append(el('span', 'ico', gift.kind === 'coins' ? '🪙' : gift.kind === 'skin' ? '🟢' : '✨'),
        el('b', '', gift.kind === 'coins' ? `코인 ${fmt(gift.amount)}개` : gift.name), el('small', '', `내 코인 🪙 ${fmt(cost)}`));
      return b;
    }));
  }
  async function sendGift(gift) {
    const s = deps.social(), to = giftTo;
    if (!s || !to || giftBusy) return;
    const a = await ask({ title: '🎁 선물할까?', text: `${to.nickname}에게 ${giftText(gift)}을(를) 선물할까? 내 코인 🪙 ${fmt(giftCost(gift))}개가 들어. 보낸 선물은 되돌릴 수 없어.`, ok: '선물하기' });
    if (!a.ok || giftTo !== to) return;
    if (!deps.gifts?.pay(gift)) { giftNote('코인이 모자라서 선물하지 못했어.'); paintGift(); return; }
    giftBusy = true; paintGift();
    try {
      const message = await s.sendDm(to.id, giftBody(gift));
      if (!parseGift(message?.body)) throw new Error('선물을 보내지 못했어. 다시 해 볼래?');
      deps.gifts.sent(gift, to.nickname);
      giftNote(`✔ ${to.nickname}에게 ${giftText(gift)}을(를) 보냈어!`);
      if (deps.screen() === 'dm' && dmWith?.id === to.id) { dmLines.push(message); paintDm(); }
    } catch (error) {
      deps.gifts.refund(gift); // 보내지 못했으면 코인을 돌려준다
      giftNote(error.message || '선물을 보내지 못했어. 코인은 그대로야.');
      toast(error.message || '선물을 보내지 못했어.');
    }
    giftBusy = false;
    paintGift();
  }
  $('gift-close').onclick = () => { sound.sfx('click'); closeGift(); };
  $('gift-tabs').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    giftTab = b.dataset.v; giftNote(''); paintGift();
  });
  $('dm-gift').onclick = () => { sound.sfx('click'); if (dmWith) openGift(dmWith); };

  // ---------- 묻는 창 (차단, 신고) ----------
  function ask({ title, text, ok = '확인', reason = false }) {
    return new Promise(resolve => {
      $('ask').hidden = false;
      $('ask-title').textContent = title;
      $('ask-text').textContent = text;
      $('ask-reason').hidden = !reason;
      $('ask-reason').value = '';
      $('ask-ok').textContent = ok;
      const done = value => { $('ask').hidden = true; $('ask-ok').onclick = $('ask-cancel').onclick = null; resolve(value); };
      $('ask-ok').onclick = () => { sound.sfx('click'); done({ ok: true, reason: $('ask-reason').value.trim().slice(0, 200) }); };
      $('ask-cancel').onclick = () => { sound.sfx('click'); done({ ok: false }); };
    });
  }
  async function blockUser(who) {
    const s = deps.social();
    if (!s || !who?.id) return false;
    const a = await ask({ title: '🚫 차단할까?', text: `${who.nickname}을(를) 차단하면 친구에서 빠지고, 서로 메시지를 보낼 수 없고, 다시 같이 매칭되지 않아. 상대에게는 알리지 않아.`, ok: '차단하기' });
    if (!a.ok) return false;
    try {
      await s.block(who.id);
      toast(`🚫 ${who.nickname}을(를) 차단했어.`);
      if (online.active && online.opponent?.id === who.id) deps.leaveOnline();
      friends = friends.filter(f => f.id !== who.id);
      unread.delete(who.id); counts();
      return true;
    } catch (error) { toast(error.message); return false; }
  }
  async function reportUser(payload, who) {
    const s = deps.social();
    if (!s || !payload) return;
    const a = await ask({ title: '🚨 신고할까?', text: `${who.nickname}이(가) 한 말과 행동을 어른이 확인해. 무엇이 싫었는지 짧게 적어 줘 (안 적어도 돼). 대화 기록이 같이 보내져.`, ok: '신고하기', reason: true });
    if (!a.ok) return;
    try { await s.report({ ...payload, reason: a.reason }); toast('🚨 신고했어. 알려 줘서 고마워!'); } catch (error) { toast(error.message); }
  }

  // ---------- 저장 충돌: 이 기기 / 서버 고르기 ----------
  function chooseSave({ local, server }) {
    return new Promise(resolve => {
      const box = $('cloud-conflict');
      box.hidden = false;
      const card = (id, summary) => {
        $(id).querySelector('.lv').textContent = `Lv.${summary.level}`;
        $(id).querySelector('.cn').textContent = `🪙 ${fmt(summary.coins)}`;
        $(id).querySelector('.at').textContent = `마지막 저장: ${when(summary.updated)}`;
      };
      card('conflict-local', local);
      card('conflict-server', server);
      const pick = choice => { sound.sfx('click'); box.hidden = true; resolve(choice); };
      $('conflict-local').onclick = () => pick('local');
      $('conflict-server').onclick = () => pick('server');
    });
  }
  // localFailed: 이 기기에 적지 못했다 (저장 공간이 꽉 참 등). 그때는 "이 기기에 있음"이라고 하지 않는다.
  function cloudStatus(state, localFailed = false) {
    const b = $('cloud-badge');
    if (!b) return;
    b.hidden = !deps.user();
    if (localFailed) {
      b.textContent = state === 'synced' ? '⚠️ 서버에는 저장됨, 이 기기에는 못 함' : '⚠️ 이 기기에도 서버에도 저장 못 함, 창을 닫지 마';
      return;
    }
    b.textContent = { synced: '☁️ 저장됨', pending: '☁️ 저장 중…', offline: '☁️ 인터넷 기다리는 중', conflict: '☁️ 골라 줘!', 'too-big': '⚠️ 너무 커서 서버에 못 올림 (이 기기에는 있음)' }[state] || '☁️';
  }

  // ---------- 온라인 대전 화면 ----------
  function renderOnline() {
    const user = deps.user();
    const s = online.state();
    // 이 기기 계정과 손님은 방 코드 대전(online-peer.mjs)이 화면을 그린다
    $('online-room-box').hidden = !!user;
    $('online-need-login').hidden = !!user;
    $('online-leave').hidden = !user;
    $('go-friends').hidden = !user;
    $('online-find-box').hidden = !user || s.active;
    if (!user) return;
    $('online-find').hidden = s.searching || !!s.inviting;
    $('online-searching').hidden = !s.searching;
    $('online-inviting').hidden = !s.inviting;
    if (s.inviting) $('online-inviting-text').textContent = `${s.inviting}에게 초대를 보냈어. 기다리는 중…`;
    $('online-lobby').hidden = !s.active;
    $('online-status').textContent = s.searching ? '상대를 찾는 중이야…'
        : s.active ? (s.peer ? `${s.opponent?.nickname}와 만났어!` : `${s.opponent?.nickname}와 연결하는 중…`)
          : '게임 찾기를 누르면 먼저 기다리던 사람과 바로 붙어!';
    if (s.active) {
      const p = deps.P();
      $('lobby-me').textContent = `${user?.nickname ?? '나'} Lv.${p.level}`;
      $('lobby-you').textContent = s.peer ? `${s.opponent?.nickname} Lv.${s.peer.level}` : `${s.opponent?.nickname ?? ''} …`;
      $('online-first-row').hidden = !s.host;
      $('online-first').querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === s.firstTo));
      $('online-start').hidden = !s.host;
      $('online-start').disabled = !s.peer;
      $('online-wait').hidden = s.host;
      if (!s.host) $('online-wait').textContent = `${s.opponent?.nickname}이(가) 시작하기를 기다리는 중… (${s.firstTo}판 먼저 이기면 승리)`;
    }
    counts();
  }

  // ---------- 온라인 화면 단추 ----------
  $('online-find').onclick = () => { sound.sfx('click'); online.find(); };
  $('online-cancel').onclick = () => { sound.sfx('click'); online.cancelFind(); };
  $('online-invite-cancel').onclick = () => { sound.sfx('click'); online.cancelInvite(); };
  $('online-leave').onclick = () => { sound.sfx('click'); online.leave(); toast('방에서 나왔어.'); };
  $('online-login').onclick = () => { sound.sfx('click'); deps.show('login'); };
  // (시작 단추는 main.js 가 계정 종류에 맞는 대전에 잇는다)
  $('go-friends').onclick = () => { sound.sfx('click'); deps.show('friends'); };

  // ---------- 친구 ----------
  function friendRow(f) {
    const row = el('div', 'friend');
    row.dataset.id = f.id;
    const dot = el('i', `dot${f.online ? ' on' : ''}`);
    dot.title = f.online ? '접속 중' : '접속 안 함';
    const game = live.get(f.id);
    row.append(dot, el('b', '', f.nickname), el('small', '', game ? '대전 중' : f.online ? '접속 중' : ''));
    const inv = button('🎮 초대', f.online ? 'primary' : '', () => { sound.sfx('click'); deps.show('online'); online.invite(f); });
    inv.disabled = !f.online || online.active || !!online.inviting || online.searching;
    const talk = button('💬 대화', 'ghost', () => { sound.sfx('click'); openDm(f); });
    const n = unread.get(f.id);
    if (n) talk.append(el('i', 'badge', String(n)));
    const gift = button('🎁 선물', 'ghost gift-btn', () => { sound.sfx('click'); openGift(f); });
    row.append(inv, talk, gift);
    // 친구가 지금 온라인 대전 중이면 보러 갈 수 있다 (인혁이 기획서 4번)
    if (game) row.append(button('👀 관전', 'ghost watch-btn', () => deps.watch(game)));
    return row;
  }
  function paintFriends() {
    const list = $('net-friend-list');
    list.replaceChildren(...friends.slice().sort((a, b) => Number(b.online) - Number(a.online) || a.nickname.localeCompare(b.nickname)).map(friendRow));
    if (!friends.length) list.append(el('p', 'fine', '아직 친구가 없어. 닉네임으로 찾거나, 게임이 끝난 뒤 “친구 요청”을 눌러 봐!'));
    $('req-in-title').hidden = !incoming.length;
    $('req-in').replaceChildren(...incoming.map(r => {
      const row = el('div', 'friend');
      row.append(el('b', '', r.nickname), el('small', '', '친구 하재!'),
        button('수락', 'primary', () => answer(r, true)), button('거절', 'ghost', () => answer(r, false)));
      return row;
    }));
    $('req-out-title').hidden = !outgoing.length;
    $('req-out').replaceChildren(...outgoing.map(r => {
      const row = el('div', 'friend');
      row.append(el('b', '', r.nickname), el('small', '', '수락을 기다리는 중'), button('취소', 'ghost', async () => {
        try { await deps.social().cancelRequest(r.id); } catch (error) { toast(error.message); }
        renderFriends();
      }));
      return row;
    }));
    $('live-dot').classList.toggle('on', deps.social()?.status === 'online');
    counts();
  }
  async function answer(r, yes) {
    sound.sfx('click');
    const s = deps.social();
    try {
      if (yes) { await s.acceptFriend(r.id); toast(`🤝 ${r.nickname}와 친구가 됐어!`, true); } else await s.declineFriend(r.id);
    } catch (error) { toast(error.message); }
    renderFriends();
  }
  async function renderFriends() {
    const s = deps.social();
    if (!s) return; // 온라인 계정이 아니면 main.js 의 친구 코드 화면
    paintFriends();
    try {
      const [list, reqs, un, matches] = await Promise.all([s.friends(), s.requests(), s.unread(), s.matches(NET_GAME).catch(() => [])]);
      friends = list; incoming = reqs.incoming; outgoing = reqs.outgoing;
      unread = new Map(un.map(u => [u.id, u.count]));
      deps.friendsChanged?.(friends.length);
      live = new Map();
      for (const m of matches) for (const p of m.players) live.set(p.id, m);
    } catch (error) { toast(error.message); }
    if (deps.screen() === 'friends') paintFriends();
  }
  $('friend-search').onsubmit = async e => {
    e.preventDefault();
    const s = deps.social();
    const q = $('friend-q').value.trim();
    const box = $('friend-results');
    box.replaceChildren();
    if (!s || q.length < 2) { box.append(el('p', 'fine', '닉네임을 두 글자 이상 적어 줘.')); return; }
    try {
      const users = await s.search(q);
      if (!users.length) box.append(el('p', 'fine', '그런 닉네임을 찾지 못했어.'));
      for (const u of users) {
        const row = el('div', 'friend');
        row.append(el('b', '', u.nickname));
        if (u.friend) row.append(el('small', '', '✔ 이미 친구'));
        else if (u.requested) row.append(el('small', '', '요청을 보냈어'));
        else row.append(button(u.requestedMe ? '수락' : '친구 요청', 'primary', async () => {
          try {
            const r = await s.requestFriend(u.id);
            toast(r.status === 'friends' ? `🤝 ${u.nickname}와 친구가 됐어!` : `🤝 ${u.nickname}에게 친구 요청을 보냈어.`);
          } catch (error) { toast(error.message); }
          $('friend-search').requestSubmit();
          renderFriends();
        }));
        box.append(row);
      }
    } catch (error) { box.append(el('p', 'fine', error.message)); }
  };

  // ---------- 1:1 대화 ----------
  function openDm(friend) {
    if (!deps.chatOn()) { toast('설정에서 채팅이 꺼져 있어. 내 정보 → 설정에서 켤 수 있어.'); return; }
    dmWith = { id: friend.id, nickname: friend.nickname };
    deps.show('dm');
  }
  function dmRow(m) {
    const mine = m.from === deps.user()?.id;
    const sticker = bodySticker(m.body), gift = parseGift(m.body);
    const row = el('div', `line ${mine ? 'me' : 'them'}${gift ? ' gift' : sticker !== null ? ' sticker' : bigEmoji(m.body) ? ' emoji-big' : ''}`);
    let body;
    if (gift) body = el('span', '', `🎁 ${giftText(gift)} 선물${mine ? '을 보냈어!' : '을 받았어!'}`);
    else if (sticker !== null) {
      body = el('img', 'dm-sticker');
      body.src = deps.stickerImg(sticker);
      body.alt = `뿌요 이모티콘 ${STICKERS[sticker].text}`;
    } else body = el('span', '', m.body);
    row.append(el('b', '', mine ? '나' : dmWith.nickname), body, el('small', '', when(m.created)));
    return row;
  }
  function paintDm() {
    const list = $('dm-list');
    list.replaceChildren(...dmLines.map(dmRow));
    if (!dmLines.length) list.append(el('p', 'fine', '아직 나눈 말이 없어. 먼저 인사해 볼까?'));
    list.scrollTop = list.scrollHeight;
  }
  async function renderDm() {
    const s = deps.social();
    if (!s || !dmWith) { deps.show('friends'); return; }
    paintDmTools();
    $('dm-title').textContent = `💬 ${dmWith.nickname}`;
    dmLines = [];
    paintDm();
    try {
      const { messages } = await s.history(dmWith.id);
      dmLines = messages;
      for (const m of messages) takeGift(m, dmWith);
      paintDm();
      if (unread.get(dmWith.id)) { await s.markRead(dmWith.id); unread.delete(dmWith.id); counts(); }
    } catch (error) { toast(error.message); }
  }
  // 보내기: 직접 쓴 말, 빠른 말(그대로 글), 뿌요 이모티콘([[st:번호]]). 서버가 모두 거른다.
  async function sendDm(body, { clear = false } = {}) {
    const s = deps.social();
    if (!s || !dmWith || !body || !deps.chatOn()) return;
    if (looksLikeGift(body)) { toast('선물은 🎁 선물하기 단추로 보내 줘.'); return; }
    try {
      const message = await s.sendDm(dmWith.id, body);
      if (clear) $('dm-input').value = '';
      dmLines.push(message);
      paintDm();
    } catch (error) { toast(error.message); }
  }
  $('dm-form').onsubmit = e => {
    e.preventDefault();
    sendDm($('dm-input').value.trim(), { clear: true });
  };
  function paintDmTools() {
    $('dm-quick').replaceChildren(...QUICK.map((q, i) => { const b = button(q, '', () => { sound.sfx('click'); sendDm(QUICK[i]); }); b.dataset.q = i; return b; }));
    dmEmoji(false);
  }
  function dmEmoji(open = $('dm-emoji').hidden) {
    if (open && !$('dm-stickers').childElementCount) {
      $('dm-stickers').replaceChildren(...STICKERS.map((st, i) => {
        const b = button('', '', () => { sound.sfx('click'); sendDm(stickerBody(i)); dmEmoji(false); });
        b.dataset.sticker = i;
        b.setAttribute('aria-label', `뿌요 이모티콘 ${st.text}`);
        const img = el('img'); img.src = deps.stickerImg(i); img.alt = ''; img.draggable = false;
        b.append(img);
        return b;
      }));
      $('dm-emojis').replaceChildren(...EMOJIS.map(e => {
        const b = button(e, '', () => {
          const input = $('dm-input'), at = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? at;
          input.value = (input.value.slice(0, at) + e + input.value.slice(end)).slice(0, 300);
          sound.sfx('click');
        });
        b.dataset.emoji = e;
        return b;
      }));
    }
    $('dm-emoji').hidden = !open;
    $('dm-emoji-toggle').setAttribute('aria-expanded', String(open));
    $('dm-emoji-toggle').classList.toggle('on', open);
  }
  $('dm-emoji-toggle').onclick = () => { sound.sfx('click'); dmEmoji(); };
  $('dm-block').onclick = async () => { if (await blockUser(dmWith)) deps.show('friends'); };
  $('dm-report').onclick = () => reportUser({ target: dmWith?.id, context: { kind: 'dm' }, messages: dmLines.slice(-50).map(m => ({ text: `${m.from === deps.user()?.id ? '나' : '상대'}: ${m.body}` })) }, dmWith);

  // ---------- 초대 받기 ----------
  function showInvite(inv) {
    if (!inv || inv.game !== NET_GAME) return;
    invite = inv;
    $('invite-pop').hidden = false;
    $('invite-text').textContent = `🎮 ${inv.from?.nickname ?? '친구'}이(가) 같이 하재!`;
    sound.sfx('coin');
    clearInterval(inviteTimer);
    const tick = () => {
      const left = Math.ceil((inv.expires - Date.now()) / 1000);
      if (left <= 0 || invite !== inv) { if (invite === inv) hideInvite(); return; }
      $('invite-left').textContent = `${left}초 안에 골라 줘`;
    };
    tick();
    inviteTimer = setInterval(tick, 500);
  }
  function hideInvite() { invite = null; clearInterval(inviteTimer); $('invite-pop').hidden = true; }
  $('invite-yes').onclick = async () => {
    const inv = invite;
    if (!inv) return;
    sound.sfx('click');
    hideInvite();
    deps.stopGame();
    if (await online.accept(inv)) deps.show('online');
  };
  $('invite-no').onclick = async () => {
    const inv = invite;
    sound.sfx('click');
    hideInvite();
    try { await deps.social()?.declineInvite(inv.id); } catch { /* 이미 끝남 */ }
  };

  // ---------- 결과 화면: 친구 요청, 차단, 신고 ----------
  function resultSocial(mode) {
    const box = $('result-social');
    const who = online.recent;
    box.hidden = mode !== 'online' || !who?.id || !deps.social();
    if (box.hidden) return;
    const friend = friends.some(f => f.id === who.id);
    const sent = outgoing.some(r => r.id === who.id);
    const req = $('result-friend');
    req.disabled = friend || sent;
    req.textContent = friend ? '✔ 이미 친구' : sent ? '✔ 친구 요청 보냄' : `🤝 ${who.nickname}에게 친구 요청`;
  }
  $('result-friend').onclick = async () => {
    const who = online.recent, s = deps.social();
    if (!who?.id || !s) return;
    sound.sfx('click');
    try {
      const r = await s.requestFriend(who.id);
      $('result-friend').disabled = true;
      $('result-friend').textContent = r.status === 'friends' ? '✔ 친구가 됐어!' : '✔ 친구 요청 보냄';
      if (r.status !== 'friends') outgoing.push({ id: who.id, nickname: who.nickname });
      toast(r.status === 'friends' ? `🤝 ${who.nickname}와 친구가 됐어!` : `🤝 ${who.nickname}에게 친구 요청을 보냈어. 수락하면 친구가 돼!`);
    } catch (error) { toast(error.message); }
  };
  $('result-block').onclick = () => blockUser(online.recent);
  $('result-report').onclick = () => reportUser(online.reportPayload(''), online.recent);

  // ---------- 서버 알림 (Social hooks) ----------
  const socialHooks = {
    status() { if (deps.screen() === 'friends') $('live-dot').classList.toggle('on', deps.social()?.status === 'online'); },
    hello(msg) {
      for (const f of friends) f.online = (msg.online ?? []).includes(f.id);
      const inv = (msg.invites ?? []).filter(i => i.game === NET_GAME).at(-1);
      if (inv) showInvite(inv);
      refreshCounts();
    },
    online(id) { const f = friends.find(x => x.id === id); if (f) { f.online = true; if (deps.screen() === 'friends') paintFriends(); } },
    offline(id) { const f = friends.find(x => x.id === id); if (f) { f.online = false; if (deps.screen() === 'friends') paintFriends(); } },
    friendRequest(from) {
      toast(`🤝 ${from.nickname}이(가) 친구 요청을 보냈어!`);
      if (!incoming.some(r => r.id === from.id)) incoming.push(from);
      counts();
      if (deps.screen() === 'friends') renderFriends();
    },
    friendAccepted(friend) {
      toast(`🤝 ${friend.nickname}와 친구가 됐어!`, true);
      outgoing = outgoing.filter(r => r.id !== friend.id);
      if (!friends.some(f => f.id === friend.id)) friends.push(friend);
      deps.friendsChanged?.(friends.length);
      if (deps.screen() === 'friends') renderFriends();
    },
    friendRemoved(id) { friends = friends.filter(f => f.id !== id); deps.friendsChanged?.(friends.length); if (deps.screen() === 'friends') paintFriends(); },
    dm({ message, from }) {
      const gift = takeGift(message, from); // 선물이면 바로 받는다 (알림은 받는 쪽에서 띄운다)
      if (deps.screen() === 'dm' && dmWith?.id === from.id) {
        dmLines.push(message); paintDm();
        deps.social()?.markRead(from.id).catch(() => {});
        return;
      }
      unread.set(from.id, (unread.get(from.id) ?? 0) + 1);
      counts();
      if (deps.chatOn() && !gift) toast(`💬 ${from.nickname}이(가) 말을 걸었어. 친구 화면에서 볼 수 있어.`);
      if (deps.screen() === 'friends') paintFriends();
    },
    invite: showInvite,
    inviteCanceled(msg) { if (invite?.id === msg.invite) { hideInvite(); toast('초대가 취소됐어.'); } },
    kicked(reason) { deps.lost(reason); },
  };

  return {
    socialHooks, chooseSave, cloudStatus, refreshCounts, resultSocial,
    refreshBadges: counts,
    // 대전 채팅 창의 차단, 신고 (온라인 계정 방)
    blockOpponent: () => blockUser(online.recent),
    reportOpponent: () => reportUser(online.reportPayload(''), online.recent),
    // 관전 채팅을 한 사람을 차단, 신고 (who: { id, nickname })
    blockUser, reportUser,
    render(name) {
      if (name === 'online') renderOnline();
      if (name === 'friends') renderFriends();
      if (name === 'dm') renderDm();
    },
    onlineChanged() { if (deps.screen() === 'online') renderOnline(); },
    reset() { friends = []; incoming = []; outgoing = []; unread.clear(); live = new Map(); dmWith = null; hideInvite(); closeGift(); counts(); },
    get friends() { return friends.slice(); },
  };
}
