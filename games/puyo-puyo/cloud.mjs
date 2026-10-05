// 온라인 계정의 게임 저장 (클라우드 세이브). 레벨, 코인, 상점, 타워, 미션 등 progress 전체를 서버에 둔다.
// - 로그인하면 서버 저장을 읽고, 바뀐 뒤 3초 조용하면 올린다(판이 끝날 때와 화면을 떠날 때는 바로).
// - 올릴 때는 항상 baseRevision(마지막으로 읽거나 쓴 번호)을 붙인다.
// - 다른 기기가 먼저 써서 409 가 오면 합치지 않는다. 코인을 큰 쪽으로 고르지도 않는다.
//   onConflict 로 "이 기기 / 서버" 를 보여 주고 고른 쪽을 서버 revision 으로 다시 쓴다.
// - 인터넷이 안 되면 이 기기에 적어 두고(dirty) 나중에 다시 올린다.
// - 서버가 너무 크다고(413 too-big) 하면 올라간 것으로 치지 않는다: 이 기기에 그대로 두고 'too-big' 으로 알린 뒤
//   tooBigRetryMs 마다(그리고 바뀔 때마다) 다시 해 본다 (서버 한도를 올려 배포하면 그때 올라간다).
// client 는 @inhyuk/net 의 Account (loadSave, putSave) 와 같은 모양이면 된다 (테스트는 가짜를 쓴다).

import { sanitize } from './profile.mjs';
import { emptySocial } from './chat.mjs';

export const GAME = 'jelly-tower';

// 서버에 올리는 기록. 친구 코드 기록(progress.social: 우체통 열쇠, 친구 대화)은 이 기기에만 둔다.
// (친구 30명 대화를 끝까지 채우면 2MB 가 넘어 서버 한도 32KB 에 들어가지도 않는다. save-size.fixture.mjs)
export function cloudPayload(progress) { return { ...sanitize(progress), social: emptySocial() }; }
export const CACHE_KEY = 'jelly-cloud-v1';
const MAX_CONFLICT_ROUNDS = 3;

// 옮기기(importLocal)처럼 "올라갔는지"를 꼭 알아야 하는 곳에서 던지는 오류.
// code: 'conflict-exhausted' (계속 다른 기기가 먼저 씀), 'stopped' (옮기는 중에 멈춤)
export class CloudError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

// 충돌 창에 보여 줄 요약
export function saveSummary(data, updated = null) {
  return { level: Number(data?.level) || 1, coins: Number(data?.coins) || 0, updated: updated ?? null };
}

// 기기 저장소 안의 { [사용자 번호]: { data, revision, dirty, updated } }
export function readCache(storage, uid) {
  try { return JSON.parse(storage?.getItem(CACHE_KEY) || '{}')[uid] ?? null; } catch { return null; }
}
export function writeCache(storage, uid, entry) {
  if (!storage) return false;
  try {
    const all = JSON.parse(storage?.getItem(CACHE_KEY) || '{}');
    if (entry) all[uid] = entry; else delete all[uid];
    // localStorage 는 실패하면 던지고, net.mjs 의 scopedStorage 는 false 를 돌려준다. 둘 다 실패로 친다.
    return storage?.setItem(CACHE_KEY, JSON.stringify(all)) !== false;
  } catch { return false; }
}

const offline = error => !error?.code || error.code === 'network' || error.code === 'server' || error.code === 'rate';
const tooBig = error => error?.code === 'too-big' || error?.status === 413;

export class CloudSave {
  // options: client, uid, storage, initial() → 새 progress, apply(data) 서버 것을 게임에 넣기,
  //          onConflict({ local, server }) → 'local' | 'server', onStatus(state) 'synced'|'pending'|'offline'|'conflict'|'too-big',
  //          onAuthLost() 로그인이 풀림(토큰이 지워짐), onPersistError(state) 기기에 못 적음, onPersistOk() 다시 적음,
  //          delay(ms, 기본 3000), retryMs(기본 20000), tooBigRetryMs(기본 5분),
  //          timers({ setTimeout, clearTimeout }), now()
  constructor(options) {
    this.o = { delay: 3000, retryMs: 20000, tooBigRetryMs: 5 * 60 * 1000, now: () => Date.now(), timers: globalThis, ...options };
    const cache = readCache(this.o.storage, this.o.uid);
    this.data = cache?.data ?? null;
    this.revision = Number.isInteger(cache?.revision) ? cache.revision : null; // null: 서버 번호를 아직 모름
    this.dirty = !!cache?.dirty;
    this.updated = cache?.updated ?? null;
    this.state = 'idle';
    this.busy = null; this.timer = null; this.retryTimer = null; this.stopped = false;
  }
  get hasCache() { return !!this.data; }

  // 기기에 적는다. 못 적으면 onPersistError 로 알린다 (기기에 남았다고 안내하면 안 되므로).
  // localFailed: 마지막으로 적으려던 것이 기기에 없다는 뜻. 다시 적는 데 성공하면 onPersistOk.
  persist() {
    const ok = writeCache(this.o.storage, this.o.uid, { data: this.data, revision: this.revision, dirty: this.dirty, updated: this.updated });
    if (!ok) { this.localFailed = true; this.o.onPersistError?.(this.state); }
    else if (this.localFailed) { this.localFailed = false; this.o.onPersistOk?.(); }
    return ok;
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
      if (tooBig(error)) { this.refused(() => this.start()); return this.data; }
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
      if (tooBig(error)) { this.refused(() => this.flush()); return; }
      if (!offline(error)) { this.setState('offline'); this.lost(error); throw error; }
      this.setState('offline');
      this.scheduleRetry(() => this.flush());
    }
  }

  // 서버가 크기 때문에 받지 않음: 기기 기록(dirty)은 그대로, 오래 기다렸다 다시
  refused(retry) {
    this.dirty = true;
    this.persist();
    this.setState('too-big');
    this.scheduleRetry(retry, this.o.tooBigRetryMs);
  }

  // 409: 이 기기와 서버 중 하나를 고른다. 고른 쪽을 서버 번호로 다시 쓴다.
  // options.importId: 기기 계정을 옮기다 생긴 충돌이면 다시 쓸 때도 같이 보내, 다시 옮겨도 두 번 쓰지 않게 한다.
  // strict: 옮기기 중이면 끝내 못 쓴 경우 던진다 (평소 자동 저장은 pending 으로 두고 다음 flush 에 다시 한다).
  async resolve(server, round = 0, options = {}, strict = false) {
    // 서버에 저장이 없으면 고를 것 없이 이 기기 것을 쓴다.
    let choice = 'local';
    if (server.data) {
      this.setState('conflict');
      choice = await this.o.onConflict({
        local: saveSummary(this.data, this.updated),
        server: saveSummary(server.data, server.updated),
      });
    }
    if (this.stopped) { if (strict) throw new CloudError('stopped'); return; }
    if (choice === 'server' && server.data) { this.adopt(server); this.setState('synced'); return; }
    // 이 기기 것 (서버에 저장이 없었으면 고를 것도 없이 이 기기 것)
    this.revision = server.revision ?? 0;
    this.dirty = true;
    this.persist();
    const sent = this.data;
    const result = await this.o.client.putSave(GAME, sent, this.revision, options);
    if (this.stopped) { if (strict) throw new CloudError('stopped'); return; }
    if (result.conflict) {
      if (round + 1 >= MAX_CONFLICT_ROUNDS) {
        this.setState('pending');
        if (strict) throw new CloudError('conflict-exhausted', '다른 기기가 계속 먼저 저장해서 기록을 올리지 못했어. 잠시 뒤에 다시 해 줘.');
        return;
      }
      await this.resolve(result.server, round + 1, options, strict);
      return;
    }
    this.revision = result.revision;
    // 쓰는 동안 게임이 또 바꿨으면(change) 그건 아직 안 올라갔다. dirty 로 두고 다음 flush 가 새 revision 으로 올린다.
    if (this.data === sent) { this.dirty = false; this.updated = result.updated ?? this.updated; }
    this.persist();
    this.setState(this.dirty ? 'pending' : 'synced');
  }

  // 기기에만 있던 계정을 처음 올린다. baseRevision 0 으로 보내므로 서버에 이미 저장이 있으면 409 → 고르기 창.
  // importId 가 같으면 다시 보내도 두 번 쓰지 않는다. 연결이 안 되거나, 충돌이 끝나지 않거나, 중간에 멈추면 던진다
  // (옮기기 실패, 기기 계정은 그대로). 돌아오면 서버에 저장된 것이다.
  async importLocal(data, importId) {
    const result = await this.o.client.putSave(GAME, data, 0, { importId });
    if (this.stopped) throw new CloudError('stopped');
    this.data = data;
    this.updated = new Date(this.o.now()).toISOString();
    if (result.conflict) { this.revision = null; this.dirty = true; await this.resolve(result.server, 0, { importId }, true); return this.data; }
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

  scheduleRetry(fn, ms = this.o.retryMs) {
    if (this.stopped) return;
    this.o.timers.clearTimeout(this.retryTimer);
    this.retryTimer = this.o.timers.setTimeout(() => { this.retryTimer = null; fn().catch(() => {}); }, ms);
  }
  // 인터넷이 돌아왔을 때 (online 이벤트)
  retryNow() {
    if (this.stopped || !this.retryTimer) return;
    this.o.timers.clearTimeout(this.retryTimer); this.retryTimer = null;
    (this.revision === null ? this.start() : this.flush()).catch(() => {});
  }
  stop() { this.stopped = true; this.clearTimers(); }
}
