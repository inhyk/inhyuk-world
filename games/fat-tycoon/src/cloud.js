// 로그인과 클라우드 저장: seonn 공용 계정(닉네임 + 비밀번호, 모든 게임이 같은 계정)으로 로그인하면
// 몸무게, 코인, 업그레이드, 스킨, 발전과제를 서버에도 저장해서 다른 기기에서 이어 한다.
// - 서버 주소는 기본값. 내 컴퓨터 시험에서만 ?net=http://127.0.0.1:8787
// - 올릴 때마다 baseRevision 을 보낸다. 다른 기기가 먼저 저장했으면(409) 몰래 합치지 않고 사람이 고른다.
// - 인터넷이 안 되면 이 기기에만 저장해 두었다가 나중에 올린다.
import { Account, DEFAULT_SERVER } from '../../../packages/net/index.mjs';
import { GAME, cloudFresh, cloudSame, cloudSummary } from '../core.mjs';
import { serverUrl } from './net.js';

const CACHE_KEY = 'fat-tycoon-cloud-v1';
const DEVICE_KEY = 'fat-tycoon-device';
const MAX_BYTES = 30000;
const EVERY = 15000; // 서버에는 15초에 한 번까지만 올린다

// 로컬 서버의 로그인 표가 진짜 서버로 가지 않게, 기본 서버가 아니면 저장 이름 뒤에 서버를 붙인다.
function scopedStorage(server) {
  const suffix = server === DEFAULT_SERVER ? '' : `@${server}`;
  const k = (key) => `${key}${suffix}`;
  return {
    getItem: (key) => { try { return localStorage.getItem(k(key)); } catch { return null; } },
    setItem: (key, v) => { try { localStorage.setItem(k(key), v); return true; } catch { return false; } },
    removeItem: (key) => { try { localStorage.removeItem(k(key)); return true; } catch { return false; } },
  };
}

export class Cloud {
  // getState() → 저장 객체, applyState(data) → 이 기기 저장을 바꾼다, choose(local, server) → 'local' | 'server'
  constructor({ getState, applyState, toast, choose }) {
    this.server = serverUrl();
    this.storage = scopedStorage(this.server);
    this.account = new Account({ server: this.server, storage: this.storage });
    Object.assign(this, { getState, applyState, toast, choose });
    this.status = 'idle'; this.statusText = ''; this.timer = null; this.onStatus = null; this.busy = false;
  }
  get loggedIn() { return this.account.loggedIn; }
  get nickname() { return this.account.user?.nickname ?? ''; }
  get uid() { return this.account.user?.id ?? 0; }

  cache() { try { return JSON.parse(this.storage.getItem(CACHE_KEY) || '{}')[this.uid] ?? null; } catch { return null; } }
  setCache(entry) {
    try { const all = JSON.parse(this.storage.getItem(CACHE_KEY) || '{}'); all[this.uid] = entry; this.storage.setItem(CACHE_KEY, JSON.stringify(all)); } catch { /* 다음에 다시 맞춘다 */ }
  }
  setStatus(s, text) { this.status = s; this.statusText = text; this.onStatus?.(s, text); }
  stopTimer() { clearTimeout(this.timer); this.timer = null; }
  later(ms) { this.stopTimer(); this.timer = setTimeout(() => { this.timer = null; this.upload(); }, ms); }
  deviceId() {
    let id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch { /* 없음 */ }
    if (!id) { id = `dev-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`; try { localStorage.setItem(DEVICE_KEY, id); } catch { /* 없음 */ } }
    return id;
  }

  async login(nickname, password) { await this.account.login(nickname.trim(), password); this.setStatus('busy', '로그인했어!'); await this.sync(); }
  async signup(nickname, password) { await this.account.signup(nickname.trim(), password); this.setStatus('busy', '계정을 만들었어!'); await this.sync(); }
  async logout() { this.stopTimer(); await this.account.logout().catch(() => {}); this.setStatus('idle', ''); }

  // 서버 저장을 읽고 어느 쪽을 쓸지 정한다
  async sync() {
    if (!this.loggedIn) return;
    this.setStatus('busy', '서버 확인 중…');
    let server;
    try { server = await this.account.loadSave(GAME); } catch (e) {
      if (e?.status === 401 || e?.code === 'login-required') { this.setStatus('idle', '다시 로그인해 줘'); return; }
      this.setStatus('offline', '인터넷이 안 돼서 이 기기에만 저장 중'); return;
    }
    const local = this.getState(), c = this.cache();
    if (!server) { await this.upload({ base: 0, importId: this.deviceId() }); return; }
    if (c && c.revision === server.revision) { if (c.dirty) await this.upload(); else this.setStatus('ok', '서버에 저장됨 ☁️'); return; }
    if (cloudSame(local, server.data)) { this.setCache({ revision: server.revision, dirty: false }); this.setStatus('ok', '서버에 저장됨 ☁️'); return; }
    if (cloudFresh(local)) { this.useServer(server, '☁️ 서버 기록을 불러왔어!'); return; }
    await this.ask(local, server);
  }
  useServer(server, text) { this.setCache({ revision: server.revision, dirty: false }); this.applyState(server.data); if (text) this.toast?.(text); this.setStatus('ok', '서버에 저장됨 ☁️'); }
  async ask(local, server) {
    const pick = await this.choose(cloudSummary(local), cloudSummary(server.data, server.updated));
    if (pick === 'server') this.useServer(server, '☁️ 서버 기록으로 바꿨어');
    else await this.upload({ base: server.revision });
  }

  // 게임이 이 기기에 저장할 때마다 부른다. 15초에 한 번까지만 올린다.
  queue() {
    if (!this.loggedIn) return;
    const c = this.cache() ?? { revision: 0 };
    if (!c.dirty) this.setCache({ ...c, dirty: true });
    if (!this.timer && !this.busy) this.later(EVERY);
  }

  async upload({ base, importId } = {}) {
    if (!this.loggedIn) return;
    if (this.busy) { if (!this.timer) this.later(EVERY); return; }
    this.stopTimer();
    const data = this.getState();
    if (JSON.stringify(data).length > MAX_BYTES) { this.setStatus('big', '저장할 게 너무 커서 서버에 못 올려 (이 기기에는 저장돼)'); return; }
    const c = this.cache() ?? { revision: 0 };
    this.busy = true; this.setStatus('busy', '서버에 저장 중…');
    let r;
    try { r = await this.account.putSave(GAME, data, base ?? c.revision ?? 0, importId ? { importId } : {}); } catch (e) {
      this.busy = false; this.setCache({ ...c, dirty: true });
      if (e?.status === 401) { this.setStatus('idle', '로그인이 풀렸어. 다시 로그인해 줘'); return; }
      this.setStatus('offline', e?.status === 429 ? '조금 뒤에 다시 저장할게' : '인터넷이 안 돼서 이 기기에만 저장 중');
      this.later(30000); return;
    }
    this.busy = false;
    if (r.ok) { this.setCache({ revision: r.revision, dirty: false }); this.setStatus('ok', '서버에 저장됨 ☁️'); return; }
    // 다른 기기가 먼저 저장함: 합치지 않고 물어본다
    const s = r.server;
    if (!s?.data || cloudSame(data, s.data)) { await this.upload({ base: s?.revision ?? 0 }); return; }
    await this.ask(data, s);
  }
}
