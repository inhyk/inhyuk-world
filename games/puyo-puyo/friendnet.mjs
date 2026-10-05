// 친구와 직접 잇기. 친구 코드마다 PeerJS 이름(puyo-tower-v1-f-코드)을 하나씩 쓰고,
// 둘 다 게임을 켜 두었을 때만 이어진다. 대화는 서버에 저장되지 않고 두 기기 사이로만 오간다.
// 누가 보냈는지는 메시지 내용이 아니라 연결의 PeerJS 이름으로 알아내므로 다른 사람인 척할 수 없다.
import { validFriendCode } from './chat.mjs';

const PREFIX = 'puyo-tower-v1-f-';
export const friendPeerId = code => PREFIX + code;
export const codeFromPeer = id => (typeof id === 'string' && id.startsWith(PREFIX) ? id.slice(PREFIX.length) : '');
// 두 사람이 동시에 서로 연결하면, 더 작은 코드 쪽이 건 연결 하나만 남긴다 (양쪽이 같은 답을 낸다)
export const keepLink = (myCode, theirCode, outgoing) => (outgoing ? myCode : theirCode) === (myCode < theirCode ? myCode : theirCode);

export class FriendNet {
  // hooks: status(state, message), hello(code, info), data(code, message), online(code, isOnline), blocked(code) → true면 끊는다
  constructor(hooks = {}, options = {}) {
    this.hooks = hooks; this.options = options;
    this.peer = null; this.code = ''; this.me = null; this.state = 'off'; this.generation = 0;
    this.links = new Map();    // 친구 코드 → 열린 연결
    this.pending = new Map();  // 친구 코드 → 연결을 기다리는 약속
  }
  get on() { return this.state === 'on'; }
  isOnline(code) { return !!this.links.get(code)?.open; }
  set(state, message = '') { this.state = state; this.hooks.status?.(state, message); }

  async start(code, me) {
    if (!validFriendCode(code)) return;
    this.me = me;
    if (this.peer && this.code === code && (this.state === 'on' || this.state === 'connecting')) return;
    this.stop();
    const generation = this.generation;
    this.code = code;
    this.set('connecting');
    try {
      const { Peer } = await import('peerjs');
      if (generation !== this.generation) return;
      const peer = this.peer = new Peer(friendPeerId(code), { debug: 0, ...this.options });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Object.assign(Error('timeout'), { type: 'timeout' })), 15000);
        peer.on('open', () => { clearTimeout(timer); resolve(); });
        peer.on('error', error => { clearTimeout(timer); reject(error); });
      });
      if (generation !== this.generation) { peer.destroy(); return; }
      peer.on('connection', connection => this.attach(connection, false));
      peer.on('error', error => this.peerError(error));
      peer.on('disconnected', () => { if (generation === this.generation && !peer.destroyed) { try { peer.reconnect(); } catch { /* 다음 시작 때 다시 */ } } });
      this.set('on');
    } catch (error) {
      if (generation !== this.generation) return;
      this.peer?.destroy(); this.peer = null;
      this.set('error', error?.type === 'unavailable-id'
        ? '이 계정이 다른 창이나 기기에서도 켜져 있어. 한 곳에서만 켜야 친구와 이어져.'
        : '친구 서버에 연결하지 못했어. 인터넷을 확인해 줘.');
    }
  }

  stop() {
    this.generation++;
    for (const link of this.links.values()) { try { link.send({ t: 'bye' }); link.close(); } catch { /* 이미 닫힘 */ } }
    this.links.clear();
    for (const resolve of this.pending.values()) resolve(false);
    this.pending.clear();
    this.peer?.destroy(); this.peer = null;
    if (this.state !== 'off') this.set('off');
  }

  // 연결할 수 없는 친구(게임을 안 켜 둠)는 PeerJS가 'peer-unavailable'로 알려 준다
  peerError(error) {
    if (error?.type === 'peer-unavailable') {
      const code = codeFromPeer(String(error.message || '').split(' ').pop());
      this.pending.get(code)?.(false);
      return;
    }
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(error?.type)) this.set('error', '친구 서버와 연결이 끊겼어. 잠시 뒤에 다시 해 볼게.');
  }

  // 친구에게 연결해 본다. 이어지면 true, 친구가 없거나 시간이 지나면 false
  connect(code) {
    if (!this.on || !validFriendCode(code) || code === this.code) return Promise.resolve(false);
    if (this.isOnline(code)) return Promise.resolve(true);
    if (this.pending.has(code)) return this.pending.get(code).promise;
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    const done = value => { if (this.pending.get(code) === finish) { this.pending.delete(code); clearTimeout(timer); resolve(value); } };
    const finish = Object.assign(done, { promise });
    this.pending.set(code, finish);
    const timer = setTimeout(() => done(false), 8000);
    const connection = this.peer.connect(friendPeerId(code), { reliable: true, serialization: 'json' });
    this.attach(connection, true, () => done(true));
    connection.on('close', () => done(false));
    connection.on('error', () => done(false));
    return promise;
  }

  attach(connection, outgoing, opened = null) {
    const code = codeFromPeer(connection.peer);
    if (!validFriendCode(code) || code === this.code || this.hooks.blocked?.(code)) { connection.on('open', () => connection.close()); return; }
    connection.on('open', () => {
      const old = this.links.get(code);
      if (old && old !== connection && old.open) {
        // 이미 이어져 있으면 규칙에 맞는 연결 하나만 남긴다
        if (!keepLink(this.code, code, outgoing)) { connection.close(); opened?.(); return; }
        old.close();
      }
      this.links.set(code, connection);
      connection.send({ t: 'hi', name: this.me?.name || '친구', level: this.me?.level || 1 });
      this.hooks.online?.(code, true);
      opened?.();
    });
    connection.on('data', message => {
      if (this.links.get(code) !== connection || !message || typeof message !== 'object' || typeof message.t !== 'string') return;
      if (message.t === 'bye') { connection.close(); return; }
      if (message.t === 'hi') { this.hooks.hello?.(code, message); return; }
      this.hooks.data?.(code, message);
    });
    const gone = () => {
      if (this.links.get(code) !== connection) return;
      this.links.delete(code);
      this.hooks.online?.(code, false);
    };
    connection.on('close', gone);
    connection.on('error', gone);
  }

  send(code, message) {
    const link = this.links.get(code);
    if (!link?.open) return false;
    try { link.send(message); return true; } catch { return false; }
  }
  close(code) {
    const link = this.links.get(code);
    if (!link) return;
    try { link.send({ t: 'bye' }); } catch { /* 이미 닫힘 */ }
    link.close();
  }
}
