// Online race: friends join one room with a code and run the same level at the
// same time, each seeing the others as see-through cubes. Uses the shared room
// server (@inhyuk/net Room, copied into ./net-client/ by
// games/dash-overdrive/classic/sync-net.mjs). No login, no chat, no names.
//
// Messages carry numbers only:
//   {t:'hi', s}                              my skin, sent when someone joins
//   {t:'start', l}                           the host picks a level and everyone starts it
//   {t:'pos', l, x, y, r, m, g, d, p, s, v}  15 times a second while playing
//                                            (m mode 0 cube 1 ship 2 ball 3 UFO 4 wave, v speed gate 0-3)
//   {t:'done', l}                            reached the end of the level
//   {t:'map', i, n, c, s, k}                 the host's own map, in parts: cells [col, row, id, ...]
// After dying in a race you watch the friend who is furthest ahead until you
// press "다시 달리기" (the designer's plan: 죽으면 상대를 관전).
import {Room, normaliseCode} from './net-client/index.mjs';
import {GAME, server, offSite, OFF_SITE_MESSAGE} from './net.mjs';

const MAX_PLAYERS = 4;
const SEND_MS = 66;
const RACE_LEVELS = 15; // secret levels stay single player: not everyone has them open
const CUSTOM_LEVEL = 21; // the map maker's slot in the engine
const MAP_PART = 1500; // numbers per map message, well under the 16 KB limit
const PIXELS_PER_MS = 20.772 * 60 / 1000;
// speed gates: slow, normal, fast, very fast (engine SPEED_MULTIPLIERS)
const SPEEDS = [0.8, 1, 1.25, 1.5];
const MODE_COUNT = 5;
const COLORS = ['#bfff59', '#59d8ff', '#ff7ad9', '#ffd23d'];
const LEVEL_NAMES = ['Neon Start', 'Pixel Hop', 'Blue Ladder', 'Desert Wind', 'Iron Gate', 'Night Rail', 'Sky Rocket',
  'Crystal Cave', 'Thunder Road', 'Lava Lift', 'Star Factory', 'Frost Bite', 'Laser Maze', 'Black Hole', 'Overdrive'];

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
let watching = null; // peer id being watched after dying
let waitForRespawn = false; // after "다시 달리기", until the cube is back
let mapParts = []; // a map arriving from the host
const players = new Map(); // peer id -> {slot, skin, pos, at, shown, done}

LEVEL_NAMES.forEach((name, index) => levelSelect.add(new Option(`${index + 1}. ${name}`, String(index))));
levelSelect.add(new Option('🛠️ 내가 만든 맵', 'custom'));

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
  stopWatching(false);
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
      player.skin = Math.max(0, Math.min(23, number(data.s) | 0));
    } else if (data.t === 'map' && from === room.hostId) {
      const part = number(data.i, -1) | 0;
      const total = number(data.n, 0) | 0;
      if (part === 0) mapParts = [];
      if (part >= 0 && part < total && total <= 40 && Array.isArray(data.c)) mapParts[part] = {cells: data.c, song: number(data.s), colors: number(data.k)};
    } else if (data.t === 'start' && from === room.hostId) {
      const level = number(data.l, -1) | 0;
      if (level >= 0 && level < RACE_LEVELS) startRace(level);
      else if (level === CUSTOM_LEVEL && loadReceivedMap()) startRace(CUSTOM_LEVEL);
    } else if (data.t === 'pos') {
      player.skin = Math.max(0, Math.min(23, number(data.s) | 0));
      player.pos = {
        level: number(data.l, -1) | 0, x: number(data.x), y: number(data.y), rotation: number(data.r),
        mode: Math.max(0, Math.min(MODE_COUNT - 1, number(data.m) | 0)), speed: Math.max(0, Math.min(SPEEDS.length - 1, number(data.v, 1) | 0)),
        gravity: data.g === -1 ? -1 : 1, dead: data.d === 1, percent: Math.max(0, Math.min(10000, number(data.p) | 0)),
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
    setStatus(offSite ? OFF_SITE_MESSAGE : error.message || '방에 들어가지 못했어. 다시 해 볼래?');
    room = null;
  }
  render();
}

// The host's map: flat numbers [col, row, id, ...] split into parts.
function sendMyMap() {
  const data = window.classicEditor?.map();
  if (!data || data.cells.length === 0) return false;
  const flat = data.cells.flat();
  const total = Math.max(1, Math.ceil(flat.length / MAP_PART));
  for (let i = 0; i < total; i++) room.send({t: 'map', i, n: total, c: flat.slice(i * MAP_PART, (i + 1) * MAP_PART), s: data.song, k: data.colors});
  return writeMap(data);
}

function loadReceivedMap() {
  if (!mapParts.length || mapParts.some(part => !part)) return false;
  const flat = mapParts.flatMap(part => part.cells);
  const cells = [];
  for (let i = 0; i + 2 < flat.length; i += 3) cells.push([flat[i], flat[i + 1], flat[i + 2]]);
  return writeMap({cells, song: mapParts[0].song, colors: mapParts[0].colors});
}

function writeMap(data) {
  if (!window.classicEditor || !window.FS) return false;
  FS.writeFile(`/res/leveldata/${CUSTOM_LEVEL}.level`, window.classicEditor.levelTextFor(data));
  Module._classic_set_custom_song(Number.isInteger(data.song) ? data.song : 0);
  return true;
}

// ---- watching a friend after dying -----------------------------------------
const watchBar = $('watch');
function stopWatching(respawn = true) {
  if (watching !== null && engineReady()) Module._classic_spectate(-1);
  waitForRespawn = respawn && watching !== null;
  watching = null;
  watchBar.hidden = true;
  if (respawn) $('canvas').focus();
}

function watchFriend() {
  if (waitForRespawn) {
    if (!engineReady() || !Module._classic_player_dead()) waitForRespawn = false;
    return;
  }
  if (!room?.active || racing < 0 || !playing() || !Module._classic_player_dead()) return;
  const now = performance.now();
  const alive = [...players.entries()].filter(([, p]) => p.slot >= 0 && p.pos && !p.pos.dead && p.pos.level === racing && now - p.at < 1500 && !p.done);
  const current = alive.find(([id]) => id === watching);
  if (watching !== null && !current) {
    // the friend died, finished or left: run again
    stopWatching();
    return;
  }
  if (watching !== null || alive.length === 0) return;
  alive.sort((a, b) => b[1].pos.percent - a[1].pos.percent);
  const [id, friend] = alive[0];
  watching = id;
  Module._classic_spectate(friend.slot);
  $('watch-name').textContent = `${label(id)} 관전 중`;
  watchBar.hidden = false;
}
$('watch-retry').addEventListener('click', () => stopWatching());
window.addEventListener('keydown', event => {
  if (watching !== null && (event.code === 'Space' || event.key === 'Enter')) stopWatching();
}, true);

function leave() {
  if (room) room.leave();
  room = null;
  stopWatching(false);
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
    d: Module._classic_player_dead(), p: percent, s: Module._classic_player_skin(), v: Module._classic_player_speed(),
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
  watchFriend();
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
    const ahead = Math.min(now - player.at, 200) * PIXELS_PER_MS * SPEEDS[pos.speed];
    const target = {x: pos.x + ahead, y: pos.y, rotation: pos.rotation};
    // a jump back (respawn) snaps instead of sliding
    if (!player.shown || Math.abs(player.shown.x - target.x) > 600) player.shown = {...target};
    else {
      player.shown.x += (target.x - player.shown.x) * 0.5;
      player.shown.y += (target.y - player.shown.y) * 0.45;
      player.shown.rotation = target.rotation;
    }
    Module._classic_set_ghost(player.slot, 1, player.shown.x, player.shown.y, player.shown.rotation, pos.mode, pos.gravity, player.skin);
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
  if (levelSelect.value === 'custom') {
    if (!sendMyMap()) {
      setStatus('맵 만들기에서 먼저 맵을 만들어 줘.');
      return;
    }
    room.send({t: 'start', l: CUSTOM_LEVEL});
    startRace(CUSTOM_LEVEL);
    return;
  }
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
  // "같이 달리기" from the friends panel (social-ui.mjs): make a room (or keep the one
  // I am in) and give back its code, or go into a friend's room by its code.
  async host() {
    show();
    if (!room?.active) await open();
    return room?.active ? room.code : '';
  },
  async join(code) {
    const wanted = normaliseCode(code);
    show();
    if (!room?.active || room.code !== wanted) await open(wanted);
    return Boolean(room?.active);
  },
};
