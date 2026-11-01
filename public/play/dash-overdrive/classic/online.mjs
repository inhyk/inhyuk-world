// Online race: friends join one room with a code and run the same level at the
// same time, each seeing the others as see-through cubes. Uses the shared room
// server (@inhyuk/net Room, copied into ./net-client/ by
// games/dash-overdrive/classic/sync-net.mjs). No login, no chat, no names.
//
// Messages carry numbers only:
//   {t:'hi', s}                              my skin, sent when someone joins
//   {t:'start', l}                           the host picks a level and everyone starts it
//   {t:'pos', l, x, y, r, m, g, d, p, s}     15 times a second while playing
//   {t:'done', l}                            reached the end of the level
import {Room, DEFAULT_SERVER, normaliseCode} from './net-client/index.mjs';

const GAME = 'dash-classic';
const MAX_PLAYERS = 4;
const SEND_MS = 66;
const RACE_LEVELS = 15; // secret levels stay single player: not everyone has them open
const PIXELS_PER_MS = 20.772 * 60 / 1000;
const COLORS = ['#bfff59', '#59d8ff', '#ff7ad9', '#ffd23d'];
const LEVEL_NAMES = ['Neon Start', 'Pixel Hop', 'Blue Ladder', 'Desert Wind', 'Iron Gate', 'Night Rail', 'Sky Rocket',
  'Crystal Cave', 'Thunder Road', 'Lava Lift', 'Star Factory', 'Frost Bite', 'Laser Maze', 'Black Hole', 'Overdrive'];
// Tests point the page at a server on this computer with ?net=http://127.0.0.1:8787.
const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
const asked = new URLSearchParams(location.search).get('net');
const server = asked && LOOPBACK.test(asked) ? asked.replace(/\/+$/, '') : DEFAULT_SERVER;

const $ = id => document.getElementById(id);
const panel = $('online');
const joinBox = $('online-join');
const roomBox = $('online-room');
const statusLine = $('online-status');
const codeInput = $('online-code');
const levelSelect = $('online-level');
const race = $('race');

let room = null;
let racing = -1; // level of the current race, -1 when none
let sentDone = false;
const players = new Map(); // peer id -> {slot, skin, pos, at, shown, done}

LEVEL_NAMES.forEach((name, index) => levelSelect.add(new Option(`${index + 1}. ${name}`, String(index))));

const engineReady = () => Boolean(window.Module?._classic_state) && window.render_classic_status && JSON.parse(window.render_classic_status()).ready;
const playing = () => engineReady() && Module._classic_state() === 2;
const label = id => (id === room?.id ? '나' : `${String(id).replace(/\D/g, '')}P`);

function setStatus(text) {
  statusLine.textContent = text;
}

function freeSlot() {
  const used = new Set([...players.values()].map(player => player.slot));
  for (let slot = 0; slot < 3; slot++) if (!used.has(slot)) return slot;
  return -1;
}

function addPlayer(id) {
  if (!players.has(id)) players.set(id, {slot: freeSlot(), skin: 0, pos: null, at: 0, shown: null, done: false});
  return players.get(id);
}

function removePlayer(id) {
  const player = players.get(id);
  if (player && player.slot >= 0 && engineReady()) Module._classic_set_ghost(player.slot, 0, 0, 0, 0, 0, 1, 0);
  players.delete(id);
}

function hideGhosts() {
  if (!engineReady()) return;
  for (let slot = 0; slot < 3; slot++) Module._classic_set_ghost(slot, 0, 0, 0, 0, 0, 1, 0);
}

function render() {
  const inRoom = Boolean(room && (room.status === 'waiting' || room.status === 'connected'));
  joinBox.hidden = inRoom;
  roomBox.hidden = !inRoom;
  if (!inRoom) return;
  $('online-room-code').textContent = room.code;
  const list = $('online-players');
  list.textContent = '';
  const ids = [room.id, ...room.peers];
  ids.forEach((id, index) => {
    const item = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'online-dot';
    dot.style.background = COLORS[index % COLORS.length];
    item.append(dot, document.createTextNode(`${label(id)}${id === room.hostId ? ' (방장)' : ''}`));
    list.append(item);
  });
  $('online-host').hidden = !room.host;
  $('online-wait').hidden = room.host;
  $('online-go').disabled = room.peers.length === 0;
}

function startRace(level) {
  racing = level;
  sentDone = false;
  for (const player of players.values()) {
    player.done = false;
    player.pos = null;
  }
  close();
  window.classicStartLevel?.(level);
}

const hooks = {
  status(status, message) {
    if (message) setStatus(message);
    else if (status === 'waiting') setStatus('친구를 기다리는 중이야. 방 코드를 알려 줘!');
    else if (status === 'connected') setStatus('친구가 들어왔어!');
    render();
  },
  join(id) {
    addPlayer(id);
    if (engineReady()) room.send({t: 'hi', s: Module._classic_player_skin()});
    render();
  },
  rejoin(id) {
    addPlayer(id);
    if (engineReady()) room.send({t: 'hi', s: Module._classic_player_skin()});
  },
  depart(id) {
    removePlayer(id);
    render();
  },
  host() {
    render();
  },
  message(data, from) {
    if (!data || typeof data !== 'object') return;
    const player = addPlayer(from);
    const number = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
    if (data.t === 'hi') {
      player.skin = Math.max(0, Math.min(11, number(data.s) | 0));
    } else if (data.t === 'start' && from === room.hostId) {
      const level = number(data.l, -1) | 0;
      if (level >= 0 && level < RACE_LEVELS) startRace(level);
    } else if (data.t === 'pos') {
      player.skin = Math.max(0, Math.min(11, number(data.s) | 0));
      player.pos = {
        level: number(data.l, -1) | 0, x: number(data.x), y: number(data.y), rotation: number(data.r),
        ship: data.m === 1, gravity: data.g === -1 ? -1 : 1, dead: data.d === 1, percent: Math.max(0, Math.min(10000, number(data.p) | 0)),
      };
      player.at = performance.now();
    } else if (data.t === 'done' && (number(data.l, -1) | 0) === racing) {
      player.done = true;
    }
    render();
  },
  error(code) {
    if (code === 'rate' || code === 'too-big') setStatus('잠깐 연결이 바빠. 계속 달려도 돼.');
  },
};

async function open(code) {
  leave();
  room = new Room(hooks, {game: GAME, maxPlayers: MAX_PLAYERS, server});
  setStatus(code ? '방에 들어가는 중…' : '방을 만드는 중…');
  try {
    await room.open(code);
    if (room.host) setStatus('방을 만들었어. 친구에게 방 코드를 알려 줘!');
  } catch (error) {
    setStatus(error.message || '방에 들어가지 못했어. 다시 해 볼래?');
    room = null;
  }
  render();
}

function leave() {
  if (room) room.leave();
  room = null;
  racing = -1;
  for (const id of [...players.keys()]) removePlayer(id);
  hideGhosts();
  race.hidden = true;
  render();
}

// Send my place 15 times a second while a level runs.
setInterval(() => {
  if (!room?.active || room.peers.length === 0 || !playing()) return;
  const percent = Module._classic_percent();
  room.send({
    t: 'pos', l: Module._classic_level(), x: Math.round(Module._sim_x() * 10) / 10, y: Math.round(Module._sim_y() * 10) / 10,
    r: Math.round(Module._classic_player_rotation()), m: Module._sim_mode(), g: Module._sim_gravity(),
    d: Module._classic_player_dead(), p: percent, s: Module._classic_player_skin(),
  });
  if (percent >= 10000 && !sentDone && racing === Module._classic_level()) {
    sentDone = true;
    room.send({t: 'done', l: racing});
  }
}, SEND_MS);

// Move friends' cubes smoothly between messages.
function drawGhosts() {
  requestAnimationFrame(drawGhosts);
  if (!engineReady()) return;
  const now = performance.now();
  const myLevel = playing() ? Module._classic_level() : -1;
  for (const player of players.values()) {
    if (player.slot < 0) continue;
    const pos = player.pos;
    const fresh = pos && now - player.at < 1500;
    if (!fresh || pos.dead || pos.level !== myLevel) {
      Module._classic_set_ghost(player.slot, 0, 0, 0, 0, 0, 1, 0);
      player.shown = null;
      continue;
    }
    const ahead = Math.min(now - player.at, 200) * PIXELS_PER_MS;
    const target = {x: pos.x + ahead, y: pos.y, rotation: pos.rotation};
    // a jump back (respawn) snaps instead of sliding
    if (!player.shown || Math.abs(player.shown.x - target.x) > 600) player.shown = {...target};
    else {
      player.shown.x += (target.x - player.shown.x) * 0.5;
      player.shown.y += (target.y - player.shown.y) * 0.45;
      player.shown.rotation = target.rotation;
    }
    Module._classic_set_ghost(player.slot, 1, player.shown.x, player.shown.y, player.shown.rotation, pos.ship ? 1 : 0, pos.gravity, player.skin);
  }
}
requestAnimationFrame(drawGhosts);

// Who is how far: a small board over the game while racing.
setInterval(() => {
  if (!room?.active || racing < 0 || !playing() || Module._classic_level() !== racing) {
    race.hidden = true;
    return;
  }
  const rows = [{id: room.id, percent: Module._classic_percent(), done: sentDone}];
  for (const [id, player] of players) {
    if (player.pos?.level === racing) rows.push({id, percent: player.pos.percent, done: player.done});
    else rows.push({id, percent: 0, done: player.done});
  }
  rows.sort((a, b) => Number(b.done) - Number(a.done) || b.percent - a.percent);
  race.textContent = '';
  const order = [room.id, ...room.peers];
  for (const row of rows) {
    const line = document.createElement('div');
    line.className = 'race-row';
    const dot = document.createElement('span');
    dot.className = 'online-dot';
    dot.style.background = COLORS[Math.max(0, order.indexOf(row.id)) % COLORS.length];
    const name = document.createElement('b');
    name.textContent = label(row.id);
    const bar = document.createElement('span');
    bar.className = 'race-bar';
    const fill = document.createElement('i');
    fill.style.width = `${Math.min(100, row.percent / 100)}%`;
    bar.append(fill);
    const value = document.createElement('small');
    value.textContent = row.done ? '완주!' : `${Math.floor(row.percent / 100)}%`;
    line.append(dot, name, bar, value);
    race.append(line);
  }
  race.hidden = false;
}, 200);

function show() {
  panel.hidden = false;
  render();
  if (!room) setStatus('');
  levelSelect.value = String(Math.min(RACE_LEVELS - 1, Math.max(0, (window.render_classic_status ? JSON.parse(window.render_classic_status()).level : 1) - 1)));
}

function close() {
  panel.hidden = true;
  $('canvas').focus();
}

$('online-open').addEventListener('click', () => (panel.hidden ? show() : close()));
$('online-close').addEventListener('click', close);
$('online-create').addEventListener('click', () => open());
$('online-enter').addEventListener('click', () => {
  const code = normaliseCode(codeInput.value);
  if (code.length !== 6) {
    setStatus('방 코드 여섯 글자를 적어 줘.');
    return;
  }
  open(code);
});
$('online-leave').addEventListener('click', () => {
  leave();
  setStatus('방에서 나왔어.');
});
$('online-go').addEventListener('click', () => {
  if (!room?.host || room.peers.length === 0) return;
  const level = Number(levelSelect.value) | 0;
  room.send({t: 'start', l: level});
  startRace(level);
});
// Typing in the code box must not reach the game behind it.
for (const type of ['keydown', 'keyup', 'keypress']) {
  codeInput.addEventListener(type, event => {
    event.stopPropagation();
    if (type === 'keydown' && event.key === 'Enter') $('online-enter').click();
  });
}
codeInput.addEventListener('input', () => {
  codeInput.value = normaliseCode(codeInput.value);
});
window.addEventListener('pagehide', leave);

window.classicOnline = {
  isOpen: () => !panel.hidden,
  close,
  status: () => ({room: room?.code || '', host: Boolean(room?.host), peers: room?.peers.length || 0, racing, ghosts: engineReady() ? Module._classic_ghost_count() : 0}),
};
