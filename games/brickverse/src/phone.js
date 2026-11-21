// 핸드폰: P (휴대폰은 📱 버튼) 를 누르면 가로 핸드폰이 나온다. 위에 카메라, 앱 4개.
// seonn.dev (사이트 게임 하기) · 기록 (지금까지 한 것) · 설정 · 계정 (2026-11-21 인혁 그림)
import seonnGames from 'virtual:seonn-games';
import { OBBY_STAGES, TYCOON, PETS, HATS, FACES, EMBLEMS, HAIRS } from '../core.mjs';

const APPS = [
  { id: 'seonn', name: 'seonn.dev', icon: '🎮', bg: 'linear-gradient(135deg,#1e2235,#3a3f63)' },
  { id: 'record', name: '기록', icon: '📊', bg: 'linear-gradient(135deg,#ffb347,#ff7a59)' },
  { id: 'settings', name: '설정', icon: '⚙️', bg: 'linear-gradient(135deg,#9aa3b5,#5f6779)' },
  { id: 'account', name: '계정', icon: '👤', bg: 'linear-gradient(135deg,#4cc3ff,#3f7dff)' },
];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = ms => { const s = ms / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const sec = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const money = n => `$${Math.floor(n).toLocaleString('ko-KR')}`;

// 사이트 안 게임 주소: seonn.dev 에서 열었으면 같은 사이트, 내 컴퓨터 시험 서버면 진짜 사이트
export function gameUrl(u, host = location.hostname) {
  if (/^https?:\/\//.test(u)) return u;
  const here = host === 'seonn.dev' || host.endsWith('.seonn.dev');
  return here ? u : `https://seonn.dev${u}`;
}

export class Phone {
  constructor(game) {
    this.game = game;
    this.app = '';
    this.playing = null;
    const el = document.createElement('section');
    el.id = 'phone';
    el.hidden = true;
    el.setAttribute('aria-label', '핸드폰');
    el.innerHTML = `<div class="phone-body">
      <div class="phone-cam" title="카메라"><i></i></div>
      <div class="phone-screen">
        <div class="phone-status"><b class="clock"></b><span>📶 🔋</span></div>
        <div class="phone-page"></div>
      </div>
      <button class="phone-home" aria-label="홈">●</button>
    </div>`;
    document.body.append(el);
    this.el = el;
    this.page = el.querySelector('.phone-page');
    el.querySelector('.phone-home').addEventListener('click', () => { game.sfx('click'); if (this.app) this.go(''); else this.close(); });
    el.addEventListener('click', e => { if (e.target === el) this.close(); });
    this.page.addEventListener('click', e => this.onClick(e));
    this.clockTimer = 0;
  }
  get open() { return !this.el.hidden; }
  toggle() { if (this.open) this.close(); else this.show(); }
  show() {
    const g = this.game;
    g.setShiftLock(false);
    g.ui.closeWardrobe(); g.ui.closeFriends(); g.ui.togglePanel(null);
    this.el.hidden = false;
    g.controlsOff(true);
    g.sfx('pop');
    this.go(this.app || '');
    this.tick();
    clearInterval(this.clockTimer);
    this.clockTimer = setInterval(() => this.tick(), 10000);
  }
  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.el.classList.remove('big');
    this.stopGame();
    clearInterval(this.clockTimer);
    this.game.controlsOff(false);
    this.game.canvas.focus();
    this.afterClose();
  }
  tick() {
    const d = new Date();
    this.el.querySelector('.clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  stopGame() {
    this.playing = null;
    this.el.querySelector('iframe')?.remove();
  }

  go(app) {
    this.stopGame();
    this.app = app;
    this.el.classList.remove('big');
    const head = title => `<div class="ph-head"><button data-go="" aria-label="뒤로">◀</button><b>${title}</b><span></span></div>`;
    let html = '';
    if (!app) {
      html = `<div class="ph-home">${APPS.map(a => `<button class="ph-app" data-go="${a.id}"><i style="background:${a.bg}">${a.icon}</i><span>${a.name}</span></button>`).join('')}</div>`;
    } else if (app === 'seonn') {
      html = `${head('seonn.dev')}<p class="ph-lead">seonn.dev 에 있는 게임 ${seonnGames.length}개! 누르면 핸드폰에서 바로 해.</p><div class="ph-games">${seonnGames.map((x, i) => `<button data-game="${i}"><i>${esc(x.e || '🎮')}</i><span>${esc(x.t)}</span></button>`).join('')}</div>`;
    } else if (app === 'record') html = head('기록') + this.recordHtml();
    else if (app === 'settings') html = head('설정') + this.settingsHtml();
    else if (app === 'account') html = head('계정') + this.accountHtml();
    this.page.innerHTML = html;
    this.page.scrollTop = 0;
  }

  play(i) {
    const x = seonnGames[i];
    if (!x) return;
    const url = gameUrl(x.u);
    this.playing = x;
    this.page.innerHTML = `<div class="ph-head"><button data-go="seonn" aria-label="게임 목록">◀</button><b>${esc(x.e || '')} ${esc(x.t)}</b><span><button data-act="big" title="크게 보기">⛶</button><a href="${esc(url)}" target="_blank" rel="noopener" title="새 창으로">↗</a></span></div>
      <iframe class="ph-frame" src="${esc(url)}" title="${esc(x.t)}" allow="autoplay; fullscreen; gamepad" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  }

  recordHtml() {
    const s = this.game.save;
    const o = s.obby, b = s.battle, t = s.tag ?? { wins: 0, hideWins: 0, seekWins: 0 };
    const rows = [
      ['🪙', '코인', `${s.coins.toLocaleString('ko-KR')}개`],
      ['🌈', '무지개 점프 탑', `최고 ${o.top}/${OBBY_STAGES} 스테이지 · 꼭대기 ${o.clears}번${o.best ? ` · 최고 기록 ${mmss(o.best)}` : ''}`],
      ['🏭', '블록 공장 타이쿤', `지은 것 ${s.tycoon.items.length}/${TYCOON.length}개 · 지금 돈 ${money(s.tycoon.cash)}`],
      ['🔥', '바닥이 사라져요', `우승 ${s.survival.wins}번 · 최고 ${sec(s.survival.best)} 버팀`],
      ['🏗️', '하늘 타워 짓기', `블록 ${s.tower.blocks.length}개 · 최고 ${s.tower.best}층`],
      ['🎯', '블록 배틀 로얄', `우승 ${b.wins}번 · 처치 ${b.kills} · 최고 ${b.best ? `${b.best}등` : '-'}`],
      ['🏰', '팀전 성 지키기', `성공 ${b.teamWins}번 · 최고 웨이브 ${b.teamBest}`],
      ['🏃', '술래잡기', `살아남기 ${t.wins}번`],
      ['🙈', '숨바꼭질', `끝까지 숨기 ${t.hideWins}번 · 술래로 다 찾기 ${t.seekWins}번`],
      ['🐾', '펫', PETS.some(p => s.pets[p.id] > 0) ? PETS.filter(p => s.pets[p.id] > 0).map(p => `${p.icon}×${s.pets[p.id]}`).join(' ') : '아직 없음'],
      ['👕', '꾸미기', `모자 ${s.owned.hat.length}/${HATS.length} · 얼굴 ${s.owned.face.length}/${FACES.length} · 무늬 ${s.owned.emblem.length}/${EMBLEMS.length} · 머리 ${s.owned.hair.length}/${HAIRS.length}`],
    ];
    return `<div class="ph-list">${rows.map(([i, n, v]) => `<div class="ph-row"><i>${i}</i><b>${n}</b><span>${v}</span></div>`).join('')}</div>`;
  }

  settingsHtml() {
    const s = this.game.save, ctl = this.game.controls;
    const sw = (act, label, on) => `<button class="ph-switch ${on ? 'on' : ''}" data-act="${act}"><b>${label}</b><i>${on ? '켜짐' : '꺼짐'}</i></button>`;
    return `<div class="ph-list">
      ${sw('sound', '🔊 효과음', s.sound)}
      ${sw('music', '🎵 배경 음악', s.music)}
      ${sw('pet', `🐾 펫 데리고 다니기${s.pet ? '' : ' (펫 없음)'}`, !!s.pet)}
      ${sw('lock', '🔒 쉬프트락 (닫으면 켜져)', !!this.wantLock || !!ctl.shiftLock)}
      <button class="ph-btn" data-act="obby">🌈 점프 탑 처음부터</button>
      <button class="ph-btn danger" data-act="reset">🗑 모든 기록 지우기</button>
    </div>`;
  }

  accountHtml() {
    const g = this.game, c = g.cloud;
    const net = g.net;
    return `<div class="ph-list">
      <div class="ph-row"><i>🏷️</i><b>내 별명</b><span>${esc(g.myName())}</span></div>
      ${c.loggedIn
        ? `<div class="ph-row"><i>☁️</i><b>seonn 계정</b><span>${esc(c.nickname)} 님으로 로그인했어 · ${esc(c.statusText || '저장됨')}</span></div>
           <button class="ph-btn" data-act="save">☁️ 지금 저장</button><button class="ph-btn" data-act="logout">로그아웃</button>`
        : `<div class="ph-row"><i>☁️</i><b>seonn 계정</b><span>로그인 안 했어. 로그인하면 기록이 서버에 저장돼서 다른 기기에서 이어서 해.</span></div>
           <button class="ph-btn primary" data-act="login">👤 로그인 · 새 계정 만들기</button>`}
      <div class="ph-row"><i>👥</i><b>친구 방</b><span>${net.active ? `방 코드 ${esc(net.code ?? '')} · 친구 ${g.remotes.size}명` : '방에 없어'}</span></div>
      <button class="ph-btn" data-act="friends">👥 친구랑 같이 하기</button>
      <button class="ph-btn" data-act="wardrobe">👕 별명과 꾸미기 바꾸기</button>
    </div>`;
  }

  onClick(e) {
    const g = this.game;
    const go = e.target.closest('[data-go]');
    if (go) { g.sfx('click'); this.go(go.dataset.go); return; }
    const gm = e.target.closest('[data-game]');
    if (gm) { g.sfx('click'); this.play(Number(gm.dataset.game)); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    g.sfx('click');
    switch (a.dataset.act) {
      case 'big': this.el.classList.toggle('big'); break;
      case 'sound': g.toggleSound(); this.go('settings'); break;
      case 'music': g.toggleMusic(); this.go('settings'); break;
      case 'pet': {
        if (g.save.pet) { this.lastPet = g.save.pet; g.setPet(''); }
        else {
          const id = (this.lastPet && g.save.pets[this.lastPet] > 0) ? this.lastPet : [...PETS].reverse().find(p => g.save.pets[p.id] > 0)?.id;
          if (id) g.setPet(id); else g.ui.toast('광장의 🥚 알 판매에서 알을 까 봐!');
        }
        this.go('settings');
        break;
      }
      case 'lock': this.wantLock = !(this.wantLock || g.controls.shiftLock); if (!this.wantLock) g.setShiftLock(false); this.go('settings'); break;
      case 'obby': g.restartObby(); g.ui.toast('점프 탑 체크포인트를 처음으로 돌렸어!'); break;
      case 'reset': this.close(); document.getElementById('confirm-reset')?.showModal(); break;
      case 'login': this.close(); g.ui.openLogin(); break;
      case 'logout': g.cloud.logout().then(() => { g.ui.renderLogin(); g.ui.toast('로그아웃했어. 이 기기에는 그대로 저장돼.'); this.go('account'); }); break;
      case 'save': g.cloud.upload(); break;
      case 'friends': this.close(); g.ui.openFriends(); break;
      case 'wardrobe': this.close(); g.ui.openWardrobe(); break;
      default: break;
    }
  }
  // 닫을 때 쉬프트락을 켜 달라고 했으면 켠다
  afterClose() { if (this.wantLock) { this.wantLock = false; this.game.setShiftLock(true); } }
}
