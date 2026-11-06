// 로그인과 클라우드 저장: seonn 공용 계정(닉네임 + 비밀번호, 모든 게임이 같은 계정)으로 로그인하면
// 코인, 산 옷, 점프 탑, 공장 기록을 서버에도 저장해서 다른 기기에서 이어 한다.
// - 서버 주소는 기본값. 내 컴퓨터 시험에서만 ?net=http://127.0.0.1:8787 (내 컴퓨터 주소만 받는다)
// - 올릴 때마다 baseRevision 을 보낸다. 다른 기기가 먼저 저장했으면(409) 몰래 합치지 않고 사람이 고른다.
// - 인터넷이 안 되면 이 기기에만 저장해 두었다가 나중에 올린다.
import { Account, DEFAULT_SERVER } from '../../../packages/net/index.mjs';
import { GAME, TYCOON, OBBY_STAGES } from '../core.mjs';
import { serverUrl } from './net.js';

const CACHE_KEY = 'brickverse-cloud-v1';
const DEVICE_KEY = 'brickverse-device';
const MAX_BYTES = 30000;

// 로컬 서버의 로그인 표가 진짜 서버로 가지 않게, 기본 서버가 아니면 저장 이름 뒤에 서버를 붙인다.
function scopedStorage(server) {
  const suffix = server === DEFAULT_SERVER ? '' : `@${server}`;
  const k = key => `${key}${suffix}`;
  return {
    getItem: key => { try { return localStorage.getItem(k(key)); } catch { return null; } },
    setItem: (key, v) => { try { localStorage.setItem(k(key), v); return true; } catch { return false; } },
    removeItem: key => { try { localStorage.removeItem(k(key)); return true; } catch { return false; } },
  };
}

// 아직 아무것도 안 한 저장인가 (그러면 서버 기록을 물어보지 않고 바로 불러온다)
export function isFresh(s) {
  return !s || (s.coins === 0 && (s.obby?.top ?? 0) === 0 && !(s.tycoon?.items?.length) && !(s.tycoon?.cash) && !(s.survival?.wins)
    && ['hat', 'face', 'emblem'].every(k => (s.owned?.[k]?.length ?? 3) <= 3));
}
// 사람이 신경 쓰는 부분이 같은가 (공장에 쌓이는 돈처럼 계속 바뀌는 건 뺀다)
export function sameProgress(a, b) {
  const pick = s => JSON.stringify([s?.coins, s?.owned, s?.look, s?.name, s?.obby?.top, s?.obby?.cp, s?.obby?.clears, s?.tycoon?.items, s?.survival]);
  return pick(a) === pick(b);
}
export function summary(s, updated) {
  const t = updated ? new Date(updated) : null;
  const when = t && !Number.isNaN(t.getTime()) ? ` · ${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} 저장` : '';
  const owned = ['hat', 'face', 'emblem'].reduce((n, k) => n + Math.max(0, (s?.owned?.[k]?.length ?? 3) - 3), 0);
  return `🪙 ${(s?.coins ?? 0).toLocaleString('ko-KR')} · 산 꾸미기 ${owned}개 · 점프 탑 ${s?.obby?.top ?? 0}/${OBBY_STAGES} · 공장 ${s?.tycoon?.items?.length ?? 0}/${TYCOON.length}${when}`;
}

export class Cloud {
  // getState() → 저장 객체, applyState(data) → 이 기기 저장을 바꾼다, choose(local, server, first) → 'local' | 'server'
  constructor({ getState, applyState, toast, choose }) {
    this.server = serverUrl();
    this.storage = scopedStorage(this.server);
    this.account = new Account({ server: this.server, storage: this.storage });
    Object.assign(this, { getState, applyState, toast, choose });
    this.status = 'idle'; this.statusText = '';
    this.timer = null; this.onStatus = null; this.busy = false;
  }
  get loggedIn() { return this.account.loggedIn; }
  get nickname() { return this.account.user?.nickname ?? ''; }
  get uid() { return this.account.user?.id ?? 0; }

  cache() { try { return JSON.parse(this.storage.getItem(CACHE_KEY) || '{}')[this.uid] ?? null; } catch { return null; } }
  setCache(entry) {
    try {
      const all = JSON.parse(this.storage.getItem(CACHE_KEY) || '{}');
      all[this.uid] = entry;
      this.storage.setItem(CACHE_KEY, JSON.stringify(all));
    } catch { /* 저장소가 막혀 있으면 다음에 다시 맞춘다 */ }
  }
  setStatus(s, text) { this.status = s; this.statusText = text; this.onStatus?.(s, text); }

  deviceId() {
    let id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch { /* 없음 */ }
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); try { localStorage.setItem(DEVICE_KEY, id); } catch { /* 없음 */ } }
    return id;
  }

  async login(nickname, password) { await this.account.login(nickname.trim(), password); this.setStatus('busy', '로그인했어!'); await this.sync(true); }
  async signup(nickname, password) { await this.account.signup(nickname.trim(), password); this.setStatus('busy', '계정을 만들었어!'); await this.sync(true); }
  async logout() { clearTimeout(this.timer); await this.account.logout().catch(() => {}); this.setStatus('idle', ''); }

  payload() {
    const data = this.getState();
    return JSON.stringify(data).length > MAX_BYTES ? null : data;
  }

  // 서버 저장을 읽고 어느 쪽을 쓸지 정한다
  async sync(justLoggedIn = false) {
    if (!this.loggedIn) return;
    this.setStatus('busy', '서버 확인 중…');
    let server;
    try { server = await this.account.loadSave(GAME); } catch (e) {
      if (e?.status === 401 || e?.code === 'login-required') { this.setStatus('idle', '다시 로그인해 줘'); return; }
      this.setStatus('offline', '인터넷이 안 돼서 이 기기에만 저장 중'); return;
    }
    const local = this.getState(), c = this.cache();
    if (!server) { await this.upload({ base: 0, importId: this.deviceId() }); return; }
    if (c && c.revision === server.revision) {
      if (c.dirty) await this.upload(); else this.setStatus('ok', '서버에 저장됨 ☁️');
      return;
    }
    if (sameProgress(local, server.data)) { this.setCache({ revision: server.revision, dirty: false }); this.setStatus('ok', '서버에 저장됨 ☁️'); return; }
    if (isFresh(local)) {
      this.setCache({ revision: server.revision, dirty: false });
      this.toast?.('☁️ 서버 기록을 불러왔어!');
      this.applyState(server.data);
      this.setStatus('ok', '서버에 저장됨 ☁️');
      return;
    }
    const pick = await this.choose(summary(local), summary(server.data, server.updated), justLoggedIn);
    if (pick === 'server') { this.setCache({ revision: server.revision, dirty: false }); this.applyState(server.data); this.setStatus('ok', '서버 기록으로 바꿨어 ☁️'); }
    else await this.upload({ base: server.revision });
  }

  // 게임이 이 기기에 저장할 때마다 부른다. 4초 동안 조용하면 올린다.
  queue() {
    if (!this.loggedIn) return;
    const c = this.cache() ?? { revision: 0 };
    if (!c.dirty) this.setCache({ ...c, dirty: true });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.upload(), 4000);
  }

  async upload({ base, importId } = {}) {
    if (!this.loggedIn) return;
    if (this.busy) { this.queue(); return; }
    clearTimeout(this.timer);
    const data = this.payload();
    if (!data) { this.setStatus('big', '저장할 게 너무 커서 서버에 못 올려 (이 기기에는 저장돼)'); return; }
    const c = this.cache() ?? { revision: 0 };
    const baseRevision = base ?? c.revision ?? 0;
    this.busy = true;
    this.setStatus('busy', '서버에 저장 중…');
    let r;
    try { r = await this.account.putSave(GAME, data, baseRevision, importId ? { importId } : {}); } catch (e) {
      this.busy = false;
      this.setCache({ ...c, dirty: true });
      if (e?.status === 401) { this.setStatus('idle', '로그인이 풀렸어. 다시 로그인해 줘'); return; }
      if (e?.status === 429) { this.setStatus('offline', '조금 뒤에 다시 저장할게'); this.timer = setTimeout(() => this.upload(), 20000); return; }
      this.setStatus('offline', '인터넷이 안 돼서 이 기기에만 저장 중');
      this.timer = setTimeout(() => this.upload(), 30000);
      return;
    }
    this.busy = false;
    if (r.ok) { this.setCache({ revision: r.revision, dirty: false }); this.setStatus('ok', '서버에 저장됨 ☁️'); return; }
    // 다른 기기가 먼저 저장함: 합치지 않고 물어본다
    const s = r.server;
    if (sameProgress(data, s.data)) { await this.upload({ base: s.revision }); return; }
    const pick = await this.choose(summary(data), summary(s.data, s.updated), false);
    if (pick === 'server') { this.setCache({ revision: s.revision, dirty: false }); this.applyState(s.data); this.setStatus('ok', '서버 기록으로 바꿨어 ☁️'); }
    else await this.upload({ base: s.revision });
  }
}
