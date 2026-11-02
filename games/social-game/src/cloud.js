// Login with the shared seonn account (nickname + password, same account as every game) and a
// cloud save so the game continues on another computer.
// - Server address is the shared default. Only for local tests: ?net=http://127.0.0.1:8787 (loopback only).
// - Every upload sends baseRevision. If another computer saved first (409), nothing is merged: the
//   player picks "이 컴퓨터" or "서버" in a dialog.
// - Offline: the save stays here (dirty) and is uploaded later.
import { Account, DEFAULT_SERVER } from '../../../packages/net/index.mjs';
import { weekday } from '../core.mjs';

export const GAME = 'social-game';
const CACHE_KEY = 'social-game-cloud-v1';
const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
const MAX_BYTES = 30000;

export function serverUrl(search = location.search) {
  let q = null;
  try { q = new URLSearchParams(search).get('net'); } catch { /* bad address: default */ }
  if (q && LOOPBACK.test(q)) return q.replace(/\/+$/, '');
  return DEFAULT_SERVER;
}

/** Keys get the server appended when it is not the real one, so a local token never goes to the real server. */
function scopedStorage(server) {
  const suffix = server === DEFAULT_SERVER ? '' : `@${server}`;
  const k = (key) => `${key}${suffix}`;
  return {
    getItem: (key) => { try { return localStorage.getItem(k(key)); } catch { return null; } },
    setItem: (key, v) => { try { localStorage.setItem(k(key), v); return true; } catch { return false; } },
    removeItem: (key) => { try { localStorage.removeItem(k(key)); return true; } catch { return false; } },
  };
}

/** Is this save still the very start (nothing worth keeping)? */
export function isFresh(s) { return !s || ((s.day ?? 1) <= 1 && (s.step ?? 0) <= 1 && !(s.placed?.length)); }
/** The parts of a save a person would care about (the clock is left out: it always moves). */
export function sameProgress(a, b) {
  const pick = (s) => JSON.stringify([s?.day, s?.step, s?.money, s?.inventory, s?.placed, s?.outfit, s?.counts, s?.souvenirs ?? 0, s?.wakeAt ?? 'home']);
  return pick(a) === pick(b);
}
export function summary(s, updated) {
  const t = updated ? new Date(updated) : null;
  const when = t && !Number.isNaN(t.getTime()) ? ` · ${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} 저장` : '';
  return `${s?.day ?? 1}일차 (${weekday(s?.day ?? 1)}) · ${(s?.money ?? 0).toLocaleString('ko-KR')}원 · 블럭 ${s?.placed?.length ?? 0}개${when}`;
}

export class Cloud {
  /** getState() → plain save object; applyState(data) replaces the local save (the game reloads). */
  constructor({ getState, applyState, toast, choose }) {
    this.server = serverUrl();
    this.storage = scopedStorage(this.server);
    this.account = new Account({ server: this.server, storage: this.storage });
    this.getState = getState;
    this.applyState = applyState;
    this.toast = toast;
    this.choose = choose; // async (localText, serverText) → 'local' | 'server'
    this.status = 'idle';
    this.timer = null;
    this.onStatus = null;
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
    } catch { /* storage blocked: we just sync again next time */ }
  }
  setStatus(s, text) { this.status = s; this.statusText = text; this.onStatus?.(s, text); }

  deviceId() {
    let id = '';
    try { id = localStorage.getItem('social-game-device') || ''; } catch { /* none */ }
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); try { localStorage.setItem('social-game-device', id); } catch { /* none */ } }
    return id;
  }

  async login(nickname, password) { await this.account.login(nickname.trim(), password); await this.sync(true); }
  async signup(nickname, password) { await this.account.signup(nickname.trim(), password); await this.sync(true); }
  async logout() { clearTimeout(this.timer); await this.account.logout().catch(() => {}); this.setStatus('idle', ''); }

  payload() {
    const data = this.getState();
    const size = JSON.stringify(data).length;
    if (size > MAX_BYTES) return null;
    return data;
  }

  /** Read the server save and settle which one wins. */
  async sync(justLoggedIn = false) {
    if (!this.loggedIn) return;
    this.setStatus('busy', '서버 확인 중…');
    let server;
    try { server = await this.account.loadSave(GAME); } catch (e) {
      if (e?.status === 401 || e?.code === 'login-required') { this.setStatus('idle', '다시 로그인해 줘'); return; }
      this.setStatus('offline', '인터넷이 안 돼서 이 컴퓨터에만 저장 중'); return;
    }
    const local = this.getState(), c = this.cache();
    if (!server) { await this.upload({ base: 0, importId: this.deviceId() }); return; }
    if (c && c.revision === server.revision) {
      if (c.dirty) await this.upload(); else this.setStatus('ok', '서버에 저장됨');
      return;
    }
    // the server has something this computer has not seen
    if (sameProgress(local, server.data)) { this.setCache({ revision: server.revision, dirty: false }); this.setStatus('ok', '서버에 저장됨'); return; }
    if (isFresh(local)) {
      this.setCache({ revision: server.revision, dirty: false });
      this.toast?.('서버 기록을 불러왔어요!');
      this.applyState(server.data);
      return;
    }
    const pick = await this.choose(summary(local), summary(server.data, server.updated), justLoggedIn);
    if (pick === 'server') { this.setCache({ revision: server.revision, dirty: false }); this.applyState(server.data); }
    else await this.upload({ base: server.revision });
  }

  /** Called whenever the game saved locally; uploads after 3 quiet seconds. */
  queue() {
    if (!this.loggedIn) return;
    const c = this.cache() ?? { revision: 0 };
    this.setCache({ ...c, dirty: true });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.upload(), 3000);
  }

  async upload({ base, importId } = {}) {
    if (!this.loggedIn) return;
    clearTimeout(this.timer);
    const data = this.payload();
    if (!data) { this.setStatus('big', '블럭이 너무 많아서 서버에 못 올려요 (이 컴퓨터에는 저장돼요)'); return; }
    const c = this.cache() ?? { revision: 0 };
    const baseRevision = base ?? c.revision ?? 0;
    this.setStatus('busy', '서버에 저장 중…');
    let r;
    try { r = await this.account.putSave(GAME, data, baseRevision, importId ? { importId } : {}); } catch (e) {
      this.setCache({ ...c, dirty: true });
      if (e?.status === 401) { this.setStatus('idle', '로그인이 풀렸어. 다시 로그인해 줘'); return; }
      this.setStatus('offline', '인터넷이 안 돼서 이 컴퓨터에만 저장 중');
      this.timer = setTimeout(() => this.upload(), 30000);
      return;
    }
    if (r.ok) { this.setCache({ revision: r.revision, dirty: false }); this.setStatus('ok', '서버에 저장됨'); return; }
    // another computer saved first: ask, never merge
    const s = r.server;
    if (sameProgress(data, s.data)) { await this.upload({ base: s.revision }); return; }
    const pick = await this.choose(summary(data), summary(s.data, s.updated), false);
    if (pick === 'server') { this.setCache({ revision: s.revision, dirty: false }); this.applyState(s.data); }
    else await this.upload({ base: s.revision });
  }
}
