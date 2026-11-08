// 화면 위 글자와 버튼: 코인, 세계 이름, 알림, 옷장, 친구 방, 메뉴, 말하기와 감정 표현.
import { SKINS, COLORS, HATS, FACES, EMBLEMS, ADJECTIVES, ANIMALS, PHRASES, EMOTES, displayName, GIFT_AMOUNTS, halfOf } from '../core.mjs';
import { faceTexture, emblemTexture } from './avatar.js';

const $ = id => document.getElementById(id);
const HAT_ICON = { none: '🚫', cap: '🧢', beanie: '🧶', party: '🥳', flower: '🌸', antenna: '👽', bunny: '🐰', cat: '🐱', chef: '👨‍🍳', headphones: '🎧', tophat: '🎩', horns: '🐲', viking: '⛑️', crown: '👑', wizard: '🧙', halo: '😇' };

export class UI {
  constructor(game) {
    this.game = game;
    this.toastTimer = 0;
    this.tab = 'skin';
    this.el = {
      coins: $('coins'), worldIcon: $('world-icon'), worldName: $('world-name'), info: $('world-info'),
      toast: $('toast'), big: $('big'), players: $('players'), fade: $('fade'),
      title: $('title'), wardrobe: $('wardrobe'), friends: $('friends'), menu: $('menu'),
      chatPanel: $('chat-panel'), emotePanel: $('emote-panel'), log: $('log'),
    };
    const click = (id, fn) => $(id)?.addEventListener('click', e => { game.sfx('click'); fn(e); });
    click('play', () => game.start());
    click('title-wardrobe', () => { game.start(); this.openWardrobe(); });
    click('btn-home', () => game.goHome());
    click('btn-wardrobe', () => this.openWardrobe());
    click('btn-friends', () => this.openFriends());
    click('btn-sound', () => game.toggleSound());
    click('btn-menu', () => this.openMenu());
    click('btn-chat', () => this.togglePanel('chat'));
    click('btn-emote', () => this.togglePanel('emote'));
    click('wardrobe-done', () => this.closeWardrobe());
    click('friends-close', () => this.closeFriends());
    click('gift-close', () => this.closeGift());
    click('gift-send', () => { if (this.giftTo && this.giftAmt && game.giveMoney(this.giftTo, this.giftAmt)) this.closeGift(); else this.renderGift(); });
    // 타이쿤 돈 칸 안의 버튼 (돈 칸 글자는 자주 다시 그려서 여기서 받는다)
    this.el.info.addEventListener('click', e => { if (e.target.closest('[data-act="gift"]')) { game.sfx('click'); this.openGift(); } });
    click('room-create', () => game.net.create());
    click('room-join', () => game.net.join($('room-code').value));
    click('room-leave', () => game.net.leave());
    click('menu-close', () => this.el.menu.close());
    click('menu-music', () => { game.toggleMusic(); this.syncMenu(); });
    click('menu-sound', () => { game.toggleSound(); this.syncMenu(); });
    click('menu-reset', () => { $('confirm-reset').showModal(); });
    click('menu-obby', () => { this.el.menu.close(); game.restartObby(); if (game.worldId !== 1) this.toast('점프 탑 체크포인트를 처음으로 돌렸어!'); });
    click('reset-cancel', () => $('confirm-reset').close());
    click('reset-ok', () => { $('confirm-reset').close(); this.el.menu.close(); game.resetAll(); });
    click('btn-login', () => this.openLogin());
    click('user-chip', () => this.openLogin());
    click('title-login', () => { game.start(); this.openLogin(); });
    click('login-close', () => this.closeLogin());
    click('do-signup', () => this.submitLogin('signup'));
    click('do-save', () => game.cloud.upload());
    click('do-logout', async () => { await game.cloud.logout(); this.renderLogin(); this.toast('로그아웃했어. 이 기기에는 그대로 저장돼.'); });
    $('login-out').addEventListener('submit', e => { e.preventDefault(); game.sfx('click'); this.submitLogin('login'); });
    $('choose').addEventListener('cancel', e => e.preventDefault());
    $('room-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
    $('room-code').addEventListener('keydown', e => { if (e.key === 'Enter') game.net.join(e.target.value); });
    document.querySelectorAll('#wardrobe .tabs button').forEach(b => b.addEventListener('click', () => { game.sfx('click'); this.tab = b.dataset.tab; this.renderWardrobe(); }));

    // 말하기, 감정 표현
    const chatGrid = $('chat-grid');
    PHRASES.forEach((p, i) => {
      const b = document.createElement('button'); b.textContent = p;
      b.addEventListener('click', () => { game.say(i); this.togglePanel(null); });
      chatGrid.append(b);
    });
    const emoteGrid = $('emote-grid');
    EMOTES.forEach((e, i) => {
      if (!i) return;
      const b = document.createElement('button'); b.textContent = e.name;
      b.addEventListener('click', () => { game.emote(i); this.togglePanel(null); });
      emoteGrid.append(b);
    });
  }

  setCoins(n) { this.el.coins.textContent = n.toLocaleString('ko-KR'); }
  bumpCoins() { this.el.coins.parentElement.classList.remove('bump'); void this.el.coins.offsetWidth; this.el.coins.parentElement.classList.add('bump'); }
  setWorld(icon, name) { this.el.worldIcon.textContent = icon; this.el.worldName.textContent = name; }
  setInfo(html) { if (this.el.info.innerHTML !== html) this.el.info.innerHTML = html; this.el.info.hidden = !html; }

  toast(text, ms = 2600) {
    const t = this.el.toast;
    t.textContent = text; t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  big(text, ms = 1400, kind = '') {
    const b = this.el.big;
    b.textContent = text; b.className = `show ${kind}`;
    clearTimeout(this.bigTimer);
    if (ms) this.bigTimer = setTimeout(() => { b.className = ''; }, ms);
  }
  hideBig() { this.el.big.className = ''; }

  log(text) {
    const line = document.createElement('div');
    line.textContent = text;
    this.el.log.append(line);
    while (this.el.log.children.length > 5) this.el.log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), 8000);
  }

  async fade(fn) {
    this.el.fade.classList.add('on');
    await new Promise(r => setTimeout(r, 280));
    await fn();
    await new Promise(r => setTimeout(r, 60));
    this.el.fade.classList.remove('on');
  }

  togglePanel(which) {
    if (which) this.game.setShiftLock(false);
    const chat = which === 'chat' && this.el.chatPanel.hidden;
    const emote = which === 'emote' && this.el.emotePanel.hidden;
    this.el.chatPanel.hidden = !chat;
    this.el.emotePanel.hidden = !emote;
  }

  // ───── 옷장 ─────
  openWardrobe() {
    this.closeFriends();
    this.el.wardrobe.hidden = false;
    this.game.wardrobe(true);
    this.renderWardrobe();
  }
  closeWardrobe() {
    if (this.el.wardrobe.hidden) return;
    this.el.wardrobe.hidden = true;
    this.game.wardrobe(false);
  }

  renderWardrobe() {
    const g = this.game, save = g.save, look = save.look;
    document.querySelectorAll('#wardrobe .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === this.tab));
    $('wardrobe-name').textContent = displayName(save.name);
    $('wardrobe-coins').textContent = save.coins.toLocaleString('ko-KR');
    const grid = $('wardrobe-grid');
    grid.innerHTML = '';
    grid.className = 'grid';
    const swatches = (list, key) => {
      grid.classList.add('swatches');
      list.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'swatch' + (look[key] === i ? ' on' : '');
        b.style.background = c;
        b.setAttribute('aria-label', `색 ${i + 1}`);
        b.addEventListener('click', () => { g.setLook({ [key]: i }); this.renderWardrobe(); });
        grid.append(b);
      });
    };
    const items = (list, key, icon) => {
      list.forEach((it, i) => {
        const owned = save.owned[key].includes(i);
        const b = document.createElement('button');
        b.className = 'item' + (look[key] === i ? ' on' : '') + (owned ? '' : ' locked');
        const pic = document.createElement('div'); pic.className = 'pic';
        const ic = icon(it);
        if (ic.startsWith('data:')) { const img = new Image(); img.src = ic; img.alt = ''; pic.append(img); } else pic.textContent = ic;
        const name = document.createElement('span'); name.textContent = it.name;
        b.append(pic, name);
        if (!owned) { const p = document.createElement('em'); p.textContent = `🪙 ${it.price}`; b.append(p); }
        b.addEventListener('click', () => {
          if (owned) { g.setLook({ [key]: i }); this.renderWardrobe(); return; }
          if (g.buyLookItem(key, i)) this.renderWardrobe();
        });
        grid.append(b);
      });
    };
    switch (this.tab) {
      case 'skin': swatches(SKINS, 'skin'); break;
      case 'shirt': swatches(COLORS, 'shirt'); break;
      case 'pants': swatches(COLORS, 'pants'); break;
      case 'hat': items(HATS, 'hat', it => HAT_ICON[it.id] ?? '🎩'); break;
      case 'face': items(FACES, 'face', it => faceTexture(it.id).image.toDataURL()); break;
      case 'emblem': items(EMBLEMS, 'emblem', it => (it.id === 'none' ? '🚫' : emblemTexture(it.id).image.toDataURL())); break;
      case 'name': {
        grid.classList.add('names');
        const row = (label, list, idx) => {
          const wrap = document.createElement('label'); wrap.className = 'name-row';
          const span = document.createElement('span'); span.textContent = label;
          const sel = document.createElement('select');
          list.forEach((w, i) => { const o = document.createElement('option'); o.value = i; o.textContent = w; o.selected = save.name[idx] === i; sel.append(o); });
          sel.addEventListener('change', () => { const n = [...save.name]; n[idx] = Number(sel.value); g.setName(n); this.renderWardrobe(); });
          wrap.append(span, sel); grid.append(wrap);
        };
        row('꾸미는 말', ADJECTIVES, 0);
        row('동물', ANIMALS, 1);
        const dice = document.createElement('button'); dice.className = 'dice'; dice.textContent = '🎲 아무 이름이나';
        dice.addEventListener('click', () => { g.setName([Math.floor(Math.random() * ADJECTIVES.length), Math.floor(Math.random() * ANIMALS.length)]); this.renderWardrobe(); });
        const note = document.createElement('p'); note.className = 'note'; note.textContent = '진짜 이름 대신 재미있는 별명을 골라요. 친구에게는 이 별명이 보여요.';
        grid.append(dice, note);
        break;
      }
      default: break;
    }
  }

  // ───── 로그인 ─────
  openLogin() {
    this.game.setShiftLock(false);
    this.closeWardrobe(); this.closeFriends();
    $('login').hidden = false;
    this.game.controlsOff(true);
    $('login-err').textContent = '';
    this.renderLogin();
    if (!this.game.cloud.loggedIn) setTimeout(() => $('login-nick').focus(), 50);
  }
  closeLogin() { $('login').hidden = true; this.game.controlsOff(false); }

  async submitLogin(kind) {
    const nick = $('login-nick').value.trim(), pw = $('login-pw').value;
    const err = $('login-err');
    if (nick.length < 2 || pw.length < 4) { err.textContent = '닉네임은 2글자, 비밀번호는 4글자 넘게 적어 줘.'; return; }
    err.textContent = kind === 'signup' ? '계정 만드는 중…' : '로그인하는 중…';
    for (const id of ['do-login', 'do-signup']) $(id).disabled = true;
    try {
      if (kind === 'signup') await this.game.cloud.signup(nick, pw); else await this.game.cloud.login(nick, pw);
      $('login-pw').value = '';
      err.textContent = '';
      this.toast(`👋 ${this.game.cloud.nickname} 님, 반가워!`);
      this.game.sfx('check');
    } catch (e) {
      err.textContent = e?.message || '로그인하지 못했어. 다시 해 볼래?';
      this.game.sfx('nope');
    } finally {
      for (const id of ['do-login', 'do-signup']) $(id).disabled = false;
      this.renderLogin();
    }
  }

  renderLogin() {
    const c = this.game.cloud;
    const on = c.loggedIn;
    $('login-out').hidden = on;
    $('login-in').hidden = !on;
    $('me-nick').textContent = c.nickname;
    $('cloud-status').textContent = c.statusText || '서버와 맞추는 중…';
    const chip = $('user-chip');
    chip.hidden = !on;
    $('user-name').textContent = c.nickname;
    chip.classList.toggle('ok', c.status === 'ok');
    chip.classList.toggle('busy', c.status === 'busy');
    chip.title = c.statusText || '';
    $('btn-login').textContent = on ? '☁️' : '👤';
  }

  // 이 기기 기록과 서버 기록 중 하나 고르기
  choose(localText, serverText, first) {
    const d = $('choose');
    $('choose-lead').textContent = first
      ? '이 기기에서 하던 기록과 서버에 있던 기록이 달라. 하나를 골라 줘. 고르지 않은 기록은 없어져.'
      : '다른 기기에서 먼저 저장했어. 어느 기록으로 할지 골라 줘. 고르지 않은 기록은 없어져.';
    $('choose-local-text').textContent = localText;
    $('choose-server-text').textContent = serverText;
    return new Promise(resolve => {
      const done = pick => { d.close(); $('choose-local').onclick = $('choose-server').onclick = null; resolve(pick); };
      $('choose-local').onclick = () => done('local');
      $('choose-server').onclick = () => done('server');
      d.showModal();
    });
  }

  // ───── 돈 주기 ─────
  openGift() {
    this.game.setShiftLock(false);
    const friends = [...this.game.remotes.values()].filter(r => r.avatar);
    if (!this.game.net.active || !friends.length) { this.toast('👥 친구랑 같이에서 방을 만들고 친구가 들어오면 돈을 줄 수 있어', 3600); return; }
    this.giftTo = friends.some(r => r.id === this.giftTo) ? this.giftTo : friends.length === 1 ? friends[0].id : null;
    this.giftAmt = 0;
    document.getElementById('gift').hidden = false;
    this.game.controlsOff(true);
    this.renderGift();
  }
  closeGift() { document.getElementById('gift').hidden = true; this.game.controlsOff(false); }

  renderGift() {
    const cash = this.game.save.tycoon.cash;
    const fmt = n => `$${Math.floor(n).toLocaleString('ko-KR')}`;
    document.getElementById('gift-cash').textContent = fmt(cash);
    const people = document.getElementById('gift-people');
    people.innerHTML = '';
    for (const r of this.game.remotes.values()) {
      if (!r.avatar) continue;
      const b = document.createElement('button');
      const old = !(r.v >= 2);
      b.textContent = old ? `${r.name} (새로고침 필요)` : r.name;
      b.className = r.id === this.giftTo ? 'on' : '';
      if (old) b.classList.add('old');
      b.addEventListener('click', () => { this.game.sfx('click'); this.giftTo = r.id; this.renderGift(); });
      people.append(b);
    }
    const amounts = document.getElementById('gift-amounts');
    amounts.innerHTML = '';
    const list = [...GIFT_AMOUNTS.map(v => [v, fmt(v)]), [halfOf(cash), `반 (${fmt(halfOf(cash))})`]];
    for (const [v, label] of list) {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = v < 1 || v > cash;
      b.className = v === this.giftAmt && v > 0 ? 'on' : '';
      b.addEventListener('click', () => { this.game.sfx('click'); this.giftAmt = v; this.renderGift(); });
      amounts.append(b);
    }
    const send = document.getElementById('gift-send');
    const who = this.game.remotes.get(this.giftTo);
    send.disabled = !who || !(this.giftAmt >= 1) || this.giftAmt > cash;
    send.textContent = who && this.giftAmt ? `${who.name} 님에게 ${fmt(this.giftAmt)} 보내기` : '보내기';
  }

  // ───── 친구 방 ─────
  openFriends() {
    this.game.setShiftLock(false);
    this.closeWardrobe();
    this.el.friends.hidden = false;
    this.renderFriends();
  }
  closeFriends() { this.el.friends.hidden = true; }

  renderFriends() {
    const net = this.game.net;
    const inRoom = net.active;
    $('room-idle').hidden = inRoom;
    $('room-live').hidden = !inRoom;
    $('room-code-big').textContent = net.code || '······';
    $('room-status').textContent = net.statusText;
    const list = $('room-people');
    list.innerHTML = '';
    if (inRoom) {
      const me = document.createElement('li'); me.innerHTML = `<b>나</b> ${displayName(this.game.save.name)}`;
      list.append(me);
      for (const r of this.game.remotes.values()) {
        const li = document.createElement('li');
        const name = document.createElement('span'); name.textContent = `${r.name}${r.where ? ` · ${r.where}` : ''}`;
        const mute = document.createElement('button');
        mute.textContent = r.muted ? '🔈 다시 보기' : '🔇 안 보기';
        mute.title = '이 친구의 말풍선과 모습을 나에게만 숨겨요';
        mute.addEventListener('click', () => { this.game.toggleMute(r.id); this.renderFriends(); });
        li.append(name, mute); list.append(li);
      }
    }
  }

  setPlayers(remotes) {
    const box = this.el.players;
    if (!remotes.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '';
    for (const r of remotes) {
      const d = document.createElement('div');
      d.textContent = `${r.name}${r.where ? ` · ${r.where}` : ''}`;
      box.append(d);
    }
  }

  openMenu() { this.game.setShiftLock(false); this.syncMenu(); this.el.menu.showModal(); }
  syncMenu() {
    $('menu-sound').textContent = `효과음: ${this.game.save.sound ? '켜짐 🔊' : '꺼짐 🔇'}`;
    $('menu-music').textContent = `배경 음악: ${this.game.save.music ? '켜짐 🎵' : '꺼짐'}`;
    $('btn-sound').textContent = this.game.save.sound ? '🔊' : '🔇';
  }
}
