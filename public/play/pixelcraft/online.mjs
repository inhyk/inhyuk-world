import { Room, DEFAULT_SERVER, normaliseCode } from './net-client/index.mjs';
import { encodePackets, SnapshotReader, cleanInput } from './online-codec.mjs';

export function onlineServer(search = '') {
  const value = new URLSearchParams(search).get('net');
  return value && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/.test(value) ? value.replace(/\/+$/, '') : DEFAULT_SERVER;
}
export function createOnline(api, options = {}) {
  const $ = id => document.getElementById(id);
  let room = null, role = '', peer = '', queue = [], generation = 0, encoding = false, ready = false, needsFull = false;
  let nextPacket = 0, lastSend = 0, lastState = 0, lastInput = 0, lastReceived = 0, receiving = Promise.resolve();
  const reader = new SnapshotReader();
  const server = options.server ?? onlineServer(location.search);
  function status(text) { $('onlineStatus').textContent = text; $('onlineBadge').textContent = role ? `온라인 · ${room?.code || '연결 중'} · ${peer ? '2/2명' : '1/2명'}` : ''; $('onlineBadge').hidden = !role; }
  function show(message = '') {
    api.clearInput?.();
    $('onlineDialog').hidden = false; $('onlineStatus').textContent = message || (role ? `${room.code} · ${role === 'host' ? '방장' : '친구'} · ${peer ? '함께 플레이 중' : '친구를 기다리는 중'}` : '로그인 없이 방 코드로 둘이 함께 놀 수 있어.');
    $('onlineHost').hidden = !!role || !api.canHost(); $('onlineJoinRow').hidden = !!role;
    $('onlineCodeRow').hidden = !role; $('onlineCode').textContent = room?.code || '';
    $('onlineLeave').hidden = !role;
    $('onlineHelp').textContent = '방장: 세계에 들어가서 방 열기 → 코드 알려 주기. 친구: 코드 입력 → 입장. 각자 가방·장비를 쓰며 세계와 친구 자리는 방장 브라우저에 저장돼. 방장이 나가면 함께 나가게 돼.';
  }
  function enqueue(data, to = peer, replace = '') {
    if (!room?.ready || !to) return false;
    if (replace) { const item = queue.find(x => x.replace === replace); if (item) { item.data = data; return true; } }
    if (queue.length > 520) { end('보낼 동작이 너무 많이 쌓였어. 방에 다시 들어와 줘.'); return false; }
    queue.push({ data, to, replace }); return true;
  }
  async function snapshot(full = false) {
    if (role !== 'host' || !peer || encoding || queue.length || (!ready && !full)) return;
    const gen = generation, recipient = peer;
    encoding = true;
    if(full)needsFull=false;
    try {
      const value = api.snapshot(full);
      if (!value) return;
      if (value.full) ready = false;
      const packets = await encodePackets(value, ++nextPacket);
      if (gen !== generation || recipient !== peer) return;
      for (const packet of packets) enqueue(packet, recipient);
    } catch (e) { if (gen === generation) end(e.message); }
    finally { if (gen === generation) encoding = false; }
  }
  function end(message = '', announce = true) {
    const previous = role, old = room;
    generation++; room = null; role = ''; peer = ''; queue = []; ready = false; encoding = false; needsFull=false; reader.reset(); receiving = Promise.resolve();
    if (old) { old.hooks = {}; old.leave(); }
    if (previous) api.end(previous);
    status('');
    if (announce) show(message || '온라인 방에서 나왔어.');
  }
  async function open(code) {
    if (role) return;
    if(typeof CompressionStream!=='function'||typeof DecompressionStream!=='function'){show('온라인 세계를 읽을 수 있게 브라우저를 최신 버전으로 업데이트해 줘.');return;}
    const host = !code;
    if (host && !api.canHost()) { show('먼저 플레이할 세계에 들어가 줘.'); return; }
    const gen = ++generation;
    role = host ? 'host' : 'guest'; peer = ''; ready = false; queue = []; reader.reset(); lastReceived = performance.now();
    $('onlineHost').disabled = $('onlineJoin').disabled = true;
    status('방 서버에 연결 중…');
    const hooks = {
      status(s, message) {
        if (gen !== generation) return;
        if (s === 'error') { end(message || '연결이 끊겼어. 다시 입장해 줘.'); return; }
        if (s === 'waiting' && role === 'host') status('친구를 기다리는 중… 코드를 알려 줘!');
      },
      join(id) {
        if (gen !== generation) return;
        peer = id; lastReceived = performance.now();
        if (role === 'host') { api.attachPeer(); needsFull=true; snapshot(true); status('친구에게 세계를 보내는 중…'); }
      },
      depart(id) {
        if (gen !== generation || !id) return;
        if (role === 'guest') { end('방장이 나가서 온라인 플레이가 끝났어. 방장이 다시 열면 같은 세계에서 이어 할 수 있어.'); return; }
        peer = ''; queue = []; ready = false; api.detachPeer(); status('친구가 나갔어. 같은 코드로 다시 들어올 수 있어.');
      },
      host() { if (gen === generation && role === 'guest') end('방장이 나가서 온라인 플레이가 끝났어.'); },
      rejoin() { if (role === 'host') { queue = []; ready = false; needsFull=true; snapshot(true); } },
      message(m, from) {
        if (gen !== generation || from !== peer || !m || typeof m !== 'object') return;
        lastReceived = performance.now();
        if (role === 'host') {
          if (m.t === 'pc-ready') { ready = true; status('친구와 함께 플레이 중!'); return; }
          if (!ready) return;
          if (m.t === 'pc-input') { const input = cleanInput(m); if (input) api.input(input); }
          if (m.t === 'pc-action' && m.action && typeof m.action === 'object') api.action(m.action);
        } else if (m.t === 'pc-snapshot') {
          receiving = receiving.then(async () => {
            if (gen !== generation) return;
            const value = await reader.push(m);
            if (!value || gen !== generation) return;
            api.apply(value); ready = true;
            if (value.full) { enqueue({ t: 'pc-ready' }); $('onlineDialog').hidden = true; }
            status('친구와 함께 플레이 중!');
          }).catch(() => { if (gen === generation) end('세계 정보를 받지 못했어. 같은 코드로 다시 들어와 줘.'); });
        } else if (m.t === 'pc-note' && typeof m.text === 'string') api.note(m.text.slice(0, 180));
      },
      error(code) { if (gen === generation && ['rate','too-big','bad'].includes(code)) end('세계 전송이 잠깐 막혔어. 방에 다시 들어와 줘.'); },
    };
    room = options.makeRoom ? options.makeRoom(hooks) : new Room(hooks, { game: 'pixelcraft', maxPlayers: 2, server });
    try {
      if (host) api.beginHost(); else api.beginGuest();
      await room.open(code);
      if (gen !== generation) return;
      if (!host) peer = room.hostId;
      show(host ? '방을 열었어! 아래 코드를 친구에게 알려 줘.' : '방장의 세계를 받는 중…');
    } catch (e) { if (gen === generation) end(e.message); }
    finally { $('onlineHost').disabled = $('onlineJoin').disabled = false; }
  }
  function tick(now = performance.now()) {
    if (!role || !room?.ready) return;
    if (queue.length && now - lastSend >= 60) {
      const item = queue.shift();
      if (!room.sendTo(item.to, item.data)) { end('연결이 끊겼어. 방에 다시 들어와 줘.'); return; }
      lastSend = now;
    }
    if (role === 'guest' && ready && now - lastInput >= 100) { lastInput = now; enqueue({ t: 'pc-input', ...api.localInput() }, peer, 'input'); }
    if(role==='host'&&peer&&needsFull&&!encoding&&!queue.length)snapshot(true);
    if (role === 'host' && peer && ready && now - lastState >= 150) { lastState = now; snapshot(); }
    if (peer && now - lastReceived > (ready?20000:120000)) end('친구와의 연결이 오래 끊겼어. 같은 코드로 다시 들어와 줘.');
  }
  const timer = setInterval(() => { tick(); api.background?.(); }, 30);
  $('onlineButton').onclick = () => show(); $('btnOnline').onclick = () => show();
  $('onlineClose').onclick = () => { $('onlineDialog').hidden = true; };
  $('onlineHost').onclick = () => open();
  $('onlineJoinForm').onsubmit = e => { e.preventDefault(); const code = normaliseCode($('onlineInput').value); if (code.length !== 6) { status('방 코드 여섯 글자를 적어 줘.'); return; } open(code); };
  $('onlineLeave').onclick = () => end();
  $('onlineCopy').onclick = async () => { try { await navigator.clipboard.writeText(room.code); status('코드를 복사했어! 친구에게 알려 줘.'); } catch { status(`방 코드: ${room?.code || ''} · 직접 적어 줘.`); } };
  $('onlineDialog').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') $('onlineDialog').hidden = true; });
  window.addEventListener('pagehide', () => { if (role) end('', false); });
  return {
    get host() { return role === 'host'; }, get guest() { return role === 'guest'; }, get active() { return !!role; }, get ready() { return ready; }, get code() { return room?.code || ''; }, get peer() { return peer; },
    inputNow() { if(role==='guest'&&ready)enqueue({t:'pc-input',...api.localInput()}); },
    action(action) { if (role !== 'guest') return false; if (ready) enqueue({ t: 'pc-action', action }); return true; },
    note(text) { if (role === 'host' && peer) enqueue({ t: 'pc-note', text }); },
    open, show, end, tick, destroy() { clearInterval(timer); end('', false); },
  };
}
