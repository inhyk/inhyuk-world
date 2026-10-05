// 온라인 계정의 게임 저장 (클라우드 세이브). 레벨, 코인, 상점, 타워, 미션 등 progress 전체를 서버에 둔다.
// - 로그인하면 서버 저장을 읽고, 바뀐 뒤 3초 조용하면 올린다(판이 끝날 때와 화면을 떠날 때는 바로).
// - 올릴 때는 항상 baseRevision(마지막으로 읽거나 쓴 번호)을 붙인다.
// - 다른 기기가 먼저 써서 409 가 오면 합치지 않는다. 코인을 큰 쪽으로 고르지도 않는다.
//   onConflict 로 "이 기기 / 서버" 를 보여 주고 고른 쪽을 서버 revision 으로 다시 쓴다.
// - 인터넷이 안 되면 이 기기에 적어 두고(dirty) 나중에 다시 올린다.
// client 는 @inhyuk/net 의 Account (loadSave, putSave) 와 같은 모양이면 된다 (테스트는 가짜를 쓴다).

export const GAME = 'jelly-tower';
export const CACHE_KEY = 'jelly-cloud-v1';
const MAX_CONFLICT_ROUNDS = 3;

// 충돌 창에 보여 줄 요약
export function saveSummary(data, updated = null) {
  return { level: Number(data?.level) || 1, coins: Number(data?.coins) || 0, updated: updated ?? null };
}

// 기기 저장소 안의 { [사용자 번호]: { data, revision, dirty, updated } }
export function readCache(storage, uid) {
  try { return JSON.parse(storage?.getItem(CACHE_KEY) || '{}')[uid] ?? null; } catch { return null; }
}
export function writeCache(storage, uid, entry) {
  try {
    const all = JSON.parse(storage?.getItem(CACHE_KEY) || '{}');
    if (entry) all[uid] = entry; else delete all[uid];
    storage?.setItem(CACHE_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}

const offline = error => !error?.code || error.code === 'network' || error.code === 'server' || error.code === 'rate';

export class CloudSave {
  // options: client, uid, storage, initial() → 새 progress, apply(data) 서버 것을 게임에 넣기,
  //          onConflict({ local, server }) → 'local' | 'server', onStatus(state) 'synced'|'pending'|'offline'|'conflict',
  //          onAuthLost() 로그인이 풀림(토큰이 지워짐), delay(ms, 기본 3000), retryMs(기본 20000),
  //          timers({ setTimeout, clearTimeout }), now()
  constructor(options) {
    this.o = { delay: 3000, retryMs: 20000, now: () => Date.now(), timers: globalThis, ...options };
    const cache = readCache(this.o.storage, this.o.uid);
    this.data = cache?.data ?? null;
    this.revision = Number.isInteger(cache?.revision) ? cache.revision : null; // null: 서버 번호를 아직 모름
    this.dirty = !!cache?.dirty;
    this.updated = cache?.updated ?? null;
    this.state = 'idle';
    this.busy = null; this.timer = null; this.retryTimer = null; this.stopped = false;
  }
  get hasCache() { return !!this.data; }

  persist() {
    writeCache(this.o.storage, this.o.uid, { data: this.data, revision: this.revision, dirty: this.dirty, updated: this.updated });
  }
  setState(state) { if (this.state !== state) { this.state = state; this.o.onStatus?.(state); } }
  clearTimers() { this.o.timers.clearTimeout(this.timer); this.o.timers.clearTimeout(this.retryTimer); this.timer = this.retryTimer = null; }

  // 로그인 직후 (또는 다시 연결될 때). 게임이 쓸 progress 를 돌려준다.
  start() { return this.run(() => this.load()); }
  async load() {
    try {
      const server = await this.o.client.loadSave(GAME);
      if (this.stopped) return this.data;
      if (!server) {
        // 서버에 아직 저장이 없다: 이 기기에 적어 둔 게 있으면 올린다.
        if (!this.data) { this.data = this.o.initial(); this.persist(); }
        this.revision = 0;
        if (this.dirty) await this.upload(); else this.setState('synced');
        return this.data;
      }
      if (this.dirty && this.data) {
        // 인터넷이 없을 때 바꾼 것이 있다. 같은 번호에서 시작했으면 그대로 올리고, 아니면 고르게 한다.
        if (this.revision === server.revision) { await this.upload(); return this.data; }
        await this.resolve(server);
        return this.data;
      }
      this.adopt(server);
      this.setState('synced');
      return this.data;
    } catch (error) {
      if (!offline(error)) { this.lost(error); throw error; }
      if (!this.data) { this.data = this.o.initial(); this.persist(); }
      this.setState('offline');
      this.scheduleRetry(() => this.start());
      return this.data;
    }
  }

  adopt(server) {
    this.data = server.data;
    this.revision = server.revision;
    this.updated = server.updated ?? null;
    this.dirty = false;
    this.persist();
    this.o.apply?.(server.data);
  }

  // 게임 기록이 바뀜: 바로 기기에 적고, 조용해지면 올린다.
  // data 는 복사해서 들고 있는다 (올리는 동안 게임이 같은 객체를 또 바꿔도 무엇을 보냈는지 알 수 있게).
  change(data) {
    if (this.stopped) return;
    this.data = JSON.parse(JSON.stringify(data));
    this.dirty = true;
    this.updated = new Date(this.o.now()).toISOString();
    this.persist();
    this.setState('pending');
    this.o.timers.clearTimeout(this.timer);
    this.timer = this.o.timers.setTimeout(() => { this.timer = null; this.flush().catch(() => {}); }, this.o.delay);
  }

  // 지금 올린다. 이미 읽거나 올리는 중이면 그게 끝난 뒤 한 번 더.
  flush() {
    if (this.stopped) return Promise.resolve();
    this.o.timers.clearTimeout(this.timer); this.timer = null;
    if (this.busy) { this.again = true; return this.busy; }
    if (!this.dirty) return Promise.resolve();
    return this.run(() => this.upload());
  }
  // 서버와 주고받는 일은 한 번에 하나씩 (고르기 창이 떠 있는 동안 또 올리지 않게)
  run(fn) {
    if (this.busy) { const next = () => this.run(fn); return this.busy.then(next, next); }
    this.busy = fn().finally(() => {
      this.busy = null;
      const again = this.again; this.again = false;
      if (again && this.dirty && !this.stopped) this.flush().catch(() => {});
    });
    return this.busy;
  }

  async upload(options = {}) {
    const sent = this.data;
    try {
      const result = await this.o.client.putSave(GAME, sent, this.revision ?? 0, options);
      if (this.stopped) return;
      if (result.conflict) { await this.resolve(result.server); return; }
      if (result.duplicate) {
        // 이 기기 기록은 예전에 이미 올라갔다 (응답을 못 받았던 경우). 서버 것을 읽어 맞춘다.
        const server = await this.o.client.loadSave(GAME);
        if (server) this.adopt(server);
        this.setState('synced');
        return;
      }
      this.revision = result.revision;
      if (this.data === sent) { this.dirty = false; this.updated = result.updated ?? this.updated; }
      this.persist();
      this.setState(this.dirty ? 'pending' : 'synced');
    } catch (error) {
      if (!offline(error)) { this.setState('offline'); this.lost(error); throw error; }
      this.setState('offline');
      this.scheduleRetry(() => this.flush());
    }
  }

  // 409: 이 기기와 서버 중 하나를 고른다. 고른 쪽을 서버 번호로 다시 쓴다.
  // options.importId: 기기 계정을 옮기다 생긴 충돌이면 다시 쓸 때도 같이 보내, 다시 옮겨도 두 번 쓰지 않게 한다.
  async resolve(server, round = 0, options = {}) {
    // 서버에 저장이 없으면 고를 것 없이 이 기기 것을 쓴다.
    let choice = 'local';
    if (server.data) {
      this.setState('conflict');
      choice = await this.o.onConflict({
        local: saveSummary(this.data, this.updated),
        server: saveSummary(server.data, server.updated),
      });
    }
    if (this.stopped) return;
    if (choice === 'server' && server.data) { this.adopt(server); this.setState('synced'); return; }
    // 이 기기 것 (서버에 저장이 없었으면 고를 것도 없이 이 기기 것)
    this.revision = server.revision ?? 0;
    this.dirty = true;
    this.persist();
    const sent = this.data;
    const result = await this.o.client.putSave(GAME, sent, this.revision, options);
    if (this.stopped) return;
    if (result.conflict) {
      if (round + 1 >= MAX_CONFLICT_ROUNDS) { this.setState('pending'); return; }
      await this.resolve(result.server, round + 1, options);
      return;
    }
    this.revision = result.revision;
    // 쓰는 동안 게임이 또 바꿨으면(change) 그건 아직 안 올라갔다. dirty 로 두고 다음 flush 가 새 revision 으로 올린다.
    if (this.data === sent) { this.dirty = false; this.updated = result.updated ?? this.updated; }
    this.persist();
    this.setState(this.dirty ? 'pending' : 'synced');
  }

  // 기기에만 있던 계정을 처음 올린다. baseRevision 0 으로 보내므로 서버에 이미 저장이 있으면 409 → 고르기 창.
  // importId 가 같으면 다시 보내도 두 번 쓰지 않는다. 연결이 안 되면 던진다 (옮기기 실패, 기기 계정은 그대로).
  async importLocal(data, importId) {
    const result = await this.o.client.putSave(GAME, data, 0, { importId });
    this.data = data;
    this.updated = new Date(this.o.now()).toISOString();
    if (result.conflict) { this.revision = null; this.dirty = true; await this.resolve(result.server, 0, { importId }); return this.data; }
    if (result.duplicate) {
      const latest = await this.o.client.loadSave(GAME);
      if (latest) this.adopt(latest);
      this.setState('synced');
      return this.data;
    }
    this.revision = result.revision;
    this.dirty = false;
    this.updated = result.updated ?? this.updated;
    this.persist();
    this.setState('synced');
    return this.data;
  }

  lost(error) { if (error?.code === 'login-required' || error?.code === 'suspended') this.o.onAuthLost?.(error.code); }

  scheduleRetry(fn) {
    if (this.stopped) return;
    this.o.timers.clearTimeout(this.retryTimer);
    this.retryTimer = this.o.timers.setTimeout(() => { this.retryTimer = null; fn().catch(() => {}); }, this.o.retryMs);
  }
  // 인터넷이 돌아왔을 때 (online 이벤트)
  retryNow() {
    if (this.stopped || !this.retryTimer) return;
    this.o.timers.clearTimeout(this.retryTimer); this.retryTimer = null;
    (this.revision === null ? this.start() : this.flush()).catch(() => {});
  }
  stop() { this.stopped = true; this.clearTimers(); }
}
