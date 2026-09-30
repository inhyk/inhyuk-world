// 두 사람을 잇는 방. PeerJS로 브라우저끼리 직접 연결한다 (미네랄 밸리와 같은 방식).
const PREFIX = 'puyo-tower-v1-', ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normaliseCode = value => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export function roomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map(n => ALPHABET[n % ALPHABET.length]).join('');
}

export class PuyoRoom {
  constructor(hooks = {}, options = {}) {
    this.hooks = hooks; this.options = options;
    this.generation = 0; this.role = ''; this.code = ''; this.status = 'offline';
    this.peer = null; this.connection = null; this.ready = false; this.lastSeen = 0; this.started = 0;
  }
  get host() { return this.role === 'host'; }
  get guest() { return this.role === 'guest'; }
  get active() { return !!this.role; }
  statusChanged(status, message = '') { this.status = status; this.hooks.status?.(status, message); }
  async open(code) {
    this.leave();
    const generation = this.generation;
    this.role = code ? 'guest' : 'host';
    this.code = code ? normaliseCode(code) : roomCode();
    if (this.code.length !== 6) { this.leave(); throw Error('방 코드 여섯 글자를 적어 줘.'); }
    this.statusChanged('connecting');
    try {
      const { Peer } = await import('peerjs');
      if (generation !== this.generation) return;
      this.peer = new Peer(this.host ? PREFIX + this.code : undefined, { debug: 0, ...this.options });
      const peer = this.peer;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('연결 시간이 너무 오래 걸려. 인터넷을 확인해 줘.')), 15000);
        peer.on('open', () => { clearTimeout(timer); resolve(); });
        peer.on('error', error => {
          clearTimeout(timer);
          reject(Error(error.type === 'peer-unavailable' ? '그 코드의 방을 찾을 수 없어.' : error.type === 'unavailable-id' ? '같은 코드의 방이 이미 있어. 다시 만들어 줘.' : '방에 연결하지 못했어. 다시 해 볼래?'));
        });
      });
      if (generation !== this.generation) { peer.destroy(); return; }
      peer.on('error', () => this.fail('연결에 문제가 생겼어. 방을 다시 만들어 줘.'));
      peer.on('disconnected', () => { if (!this.ready) this.fail('방 서버와 연결이 끊겼어. 다시 해 볼래?'); });
      if (this.host) { peer.on('connection', connection => this.accept(connection)); this.statusChanged('waiting'); }
      else this.attach(peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' }));
      this.started = Date.now();
      this.timer = setInterval(() => {
        if (this.ready) {
          if (Date.now() - this.lastSeen > 12000) { this.fail('친구와 연결이 끊겼어.'); return; }
          this.send({ t: 'ping' });
        } else if (this.guest && Date.now() - this.started > 18000) this.fail('방이 대답하지 않아. 코드를 확인하고 다시 해 봐.');
      }, 1000);
    } catch (error) {
      if (generation === this.generation) { this.leave(); this.statusChanged('error', error.message); }
      throw error;
    }
  }
  accept(connection) {
    if (this.connection) { connection.on('open', () => { connection.send({ t: 'full' }); setTimeout(() => connection.close(), 300); }); return; }
    this.attach(connection);
  }
  attach(connection) {
    this.connection = connection;
    this.lastSeen = Date.now();
    const reservation = setTimeout(() => { if (this.connection === connection && !this.ready) { connection.close(); this.dropped(); } }, 15000);
    connection.on('open', () => { if (this.guest) this.send({ t: 'knock' }); });
    connection.on('data', message => {
      if (this.connection !== connection || !message || typeof message !== 'object') return;
      this.lastSeen = Date.now();
      if (message.t === 'full') { this.fail('이 방은 벌써 2명이야. 다른 방을 만들어 줘.'); return; }
      if (message.t === 'bye') { this.dropped(); return; }
      if (message.t === 'knock' && this.host && !this.ready) { this.ready = true; clearTimeout(reservation); this.send({ t: 'welcome' }); this.statusChanged('connected'); this.hooks.join?.(); return; }
      if (message.t === 'welcome' && this.guest) { this.ready = true; clearTimeout(reservation); this.statusChanged('connected'); this.hooks.join?.(); return; }
      if (this.ready && message.t !== 'ping') this.hooks.message?.(message);
    });
    connection.on('close', () => { clearTimeout(reservation); if (this.connection === connection) this.dropped(); });
    connection.on('error', () => { clearTimeout(reservation); if (this.connection === connection) this.dropped(); });
  }
  send(message) { if (this.connection?.open) { try { this.connection.send(message); } catch { this.dropped(); } } }
  dropped() {
    const connection = this.connection;
    this.connection = null; this.ready = false;
    connection?.close();
    this.hooks.depart?.();
    if (this.host) this.statusChanged('waiting', '친구가 나갔어. 새 친구가 같은 코드로 들어올 수 있어.');
    else this.fail('방장과 연결이 끊겼어.');
  }
  fail(message) { this.leave(); this.statusChanged('error', message); }
  leave() {
    this.generation++;
    clearInterval(this.timer);
    const peer = this.peer, connection = this.connection;
    this.send({ t: 'bye' });
    this.peer = null; this.connection = null; this.ready = false;
    const wasActive = this.active;
    this.role = ''; this.code = '';
    connection?.close(); peer?.destroy();
    if (wasActive) this.hooks.depart?.();
    this.statusChanged('offline');
  }
}
