// Accounts, friends and friend chat. 인혁's plan: "1. 로그인을 만들어줘" and
// "10. 닉네임을 찾아 그 사람에게 친구 요청을 보낼 수 있게 해 줘. 친구가 되면 채팅이 되게 해 줘."
// Uses the shared server's Account and Social (@inhyuk/net, copied into ./net-client/),
// see services/net/README.md "계정과 친구".
//
// - One account (nickname + password, no email) for every game on seonn.dev. The login stays in this
//   browser under the key Jelly Tower uses ('inhyuk-net-session'), so the next visit is still logged in.
//   A test server (?net=...) keeps its login under its own key so it never reaches the real server.
// - Friend chat: invite a friend who is online (social.invite). When the friend accepts
//   (social.acceptInvite) both are in a room only the two of them can enter. Typed text goes ONLY
//   through room.chat(text): the server hides swear words, phone numbers and links, and takes 5 lines
//   at once, then one a second. The friend's name on screen comes from the server (friend list, invite, opponent.nickname),
//   never from a message, and every text goes onto the page with textContent. The chat screen has
//   block and report buttons. Nothing asks for real names, age, school or phone numbers.
// - 같이 달리기: inside the friend room, make a room-code race (online.mjs) and send its code as numbers
//   ({t:'race', c:[...]}: strings in a friend room are filtered by the server). The friend presses
//   들어가기 to join, then it is the usual race (the host picks a level and starts).
import {Account, Social, ALPHABET} from './net-client/index.mjs';
import {GAME, server, testServer, offSite, OFF_SITE_MESSAGE} from './net.mjs';

const CHAT_MAX = 100;      // letters in one line (the server cuts at 200)
// The server takes 5 chat lines at once, then one a second. Keep one line under that
// so a slow network never makes the server drop a line that is already on my screen.
const CHAT_BURST = 4;
const CHAT_GAP_MS = 1000;
const LINES_KEEP = 50;     // lines kept on screen; a report sends the typed ones
const INVITE_MS = 60000;   // an invite lasts a minute on the server
const WAIT_MS = 20000;     // after accepting, the friend should be in the room by then
const NICK_RE = /^[가-힣A-Za-z0-9_]{2,10}$/;

const $ = id => document.getElementById(id);
const panel = $('social');
const openButton = $('social-open');
const toastBox = $('toast');

// Where the login is kept: localStorage like Jelly Tower; a test server gets its own key.
function loginStore() {
  const suffix = testServer ? `@${server}` : '';
  let store = null;
  try {
    store = window.localStorage;
  } catch {
    store = null;
  }
  return {
    getItem(key) {
      try {
        return store?.getItem(key + suffix) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        store?.setItem(key + suffix, value);
      } catch {
        // kept for this visit only
      }
    },
    removeItem(key) {
      try {
        store?.removeItem(key + suffix);
      } catch {
        // nothing to remove
      }
    },
  };
}

const account = new Account({server, storage: loginStore()});
let social = null;    // Social while logged in
let view = 'login';   // login | home | chat
let mode = 'login';   // the login form: login | signup
let friends = [];
let incoming = [];
let outgoing = [];
let chat = null;      // {friend: {id, nickname}, state, room, code, lines, sent, unread, race, until, ended}
let invite = null;    // an invite from a friend, waiting for my answer
let inviteTimer = 0;
let callTimer = 0;
let answerAsk = null;
let toastTimer = 0;
let listsAsked = 0;
let busy = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function who(name, note) {
  const box = el('span', 'social-who');
  box.append(el('b', '', name));
  if (note) box.append(el('small', '', note));
  return box;
}

// The Korean particle after a name: a after a final consonant (이, 을, 과, 으로), b otherwise.
// A last digit is read the Korean way (…6 = 육); other letters get both forms, like 이(가).
const DIGIT_FINALS = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0]; // 영 일 이 삼 사 오 육 칠 팔 구
function josa(word, a, b) {
  const text = String(word);
  const last = text.charCodeAt(text.length - 1);
  let final;
  if (last >= 0xac00 && last <= 0xd7a3) final = (last - 0xac00) % 28;
  else if (last >= 48 && last <= 57) final = DIGIT_FINALS[last - 48];
  else return a === '으로' ? `${text}(으)로` : `${text}${a}(${b})`;
  return text + (final && !(a === '으로' && final === 8) ? a : b);
}

function setStatus(text) {
  $('social-status').textContent = text;
}

function toast(text) {
  toastBox.textContent = text;
  toastBox.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastBox.hidden = true;
  }, 3000);
}

// A server call. When the login is gone (logged out elsewhere, suspended) go back to the login form.
async function call(work) {
  try {
    return await work();
  } catch (error) {
    if (error?.code === 'login-required' || error?.code === 'suspended') lostLogin(error.code);
    throw error;
  }
}

// ---------- drawing ----------

function paint() {
  if (!panel.hidden) {
    if (!social) view = 'login';
    else if (view === 'login') view = 'home';
    if (view === 'chat' && !chat) view = 'home';
    $('social-login').hidden = view !== 'login';
    $('social-home').hidden = view !== 'home';
    $('social-chat').hidden = view !== 'chat';
    $('social-title').textContent = view === 'chat' ? '💬 친구랑 채팅' : view === 'home' ? '👤 내 계정과 친구' : mode === 'signup' ? '👤 새 계정 만들기' : '👤 로그인';
    if (view === 'login') paintLogin();
    else if (view === 'home') paintHome();
    else paintChat();
  }
  paintHeader();
}

function paintHeader() {
  const name = social ? account.user?.nickname || '' : '';
  $('social-label').textContent = name || '로그인';
  openButton.setAttribute('aria-label', name ? `내 계정과 친구, ${name}` : '로그인');
  openButton.classList.toggle('in', Boolean(name));
  const count = incoming.length + (chat?.unread || 0) + (invite ? 1 : 0);
  const badge = $('social-badge');
  badge.hidden = !count;
  badge.textContent = count > 9 ? '9+' : String(count);
}

function paintLogin() {
  const signup = mode === 'signup';
  $('social-mode-login').setAttribute('aria-pressed', String(!signup));
  $('social-mode-signup').setAttribute('aria-pressed', String(signup));
  for (const node of $('social-login').querySelectorAll('.signup-only')) node.hidden = !signup;
  $('social-pass').autocomplete = signup ? 'new-password' : 'current-password';
  $('social-submit').textContent = signup ? '만들고 들어가기' : '로그인';
  $('social-submit').disabled = busy;
}

function paintHome() {
  const live = social?.status === 'online';
  $('social-live').classList.toggle('on', live);
  $('social-me').textContent = `${josa(account.user?.nickname ?? '', '으로', '로')} 로그인했어${live ? '' : ' · 서버에 연결하는 중…'}`;

  $('social-in-title').hidden = !incoming.length;
  $('social-in').replaceChildren(...incoming.map(request => {
    const row = el('div', 'social-row');
    row.dataset.nick = request.nickname;
    row.append(who(request.nickname, '친구 하재!'),
      button('수락', 'primary', () => answerRequest(request, true)),
      button('거절', '', () => answerRequest(request, false)));
    return row;
  }));

  $('social-out-title').hidden = !outgoing.length;
  $('social-out').replaceChildren(...outgoing.map(request => {
    const row = el('div', 'social-row');
    row.dataset.nick = request.nickname;
    row.append(who(request.nickname, '수락을 기다리는 중'), button('취소', '', () => cancelRequest(request)));
    return row;
  }));

  const list = $('social-friends');
  const sorted = friends.slice().sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)) || a.nickname.localeCompare(b.nickname, 'ko'));
  list.replaceChildren(...sorted.map(friendRow));
  if (!friends.length) list.append(el('p', 'social-empty', '아직 친구가 없어. 위에서 닉네임을 찾아 친구 요청을 보내 봐!'));
}

function friendRow(friend) {
  const row = el('div', 'social-row');
  row.dataset.nick = friend.nickname;
  const talking = Boolean(chat && chat.friend.id === friend.id && chat.state !== 'ended');
  const dot = el('i', `social-dot${friend.online ? ' on' : ''}`);
  dot.setAttribute('aria-hidden', 'true');
  row.append(dot, who(friend.nickname, talking ? '채팅 중' : friend.online ? '접속 중' : '접속 안 함'));
  const reachable = friend.online || talking;
  const talk = button(talking ? '💬 채팅 보기' : '💬 채팅', reachable ? 'primary' : '', () => startChat(friend));
  talk.dataset.action = 'chat';
  talk.disabled = !reachable;
  const race = button('🏁 같이 달리기', '', () => startChat(friend, true));
  race.dataset.action = 'race';
  race.disabled = !reachable;
  row.append(talk, race);
  return row;
}

function chatStateText(mine) {
  const name = mine.friend.nickname;
  if (mine.state === 'calling') {
    const left = Math.max(0, Math.ceil((mine.until - Date.now()) / 1000));
    return `${josa(name, '을', '를')} 부르는 중… ${left}초 안에 친구가 "좋아!"를 누르면 시작해.`;
  }
  if (mine.state === 'joining') return '채팅방에 들어가는 중…';
  if (mine.state === 'waiting') return `${josa(name, '이', '가')} 들어오기를 기다리는 중…`;
  if (mine.state === 'open') return `${josa(name, '과', '와')} 채팅하는 중이야.`;
  return mine.ended || '채팅이 끝났어.';
}

// named: the first line in a row from the same person shows who said it
function lineNode(line, friendName, named) {
  if (line.who === 'note') return el('p', 'social-note', line.text);
  if (line.who === 'race') {
    const row = el('div', 'social-note social-offer');
    row.append(el('span', '', line.text), button('🏁 들어가기', 'primary', () => joinRace(line.code)));
    return row;
  }
  const row = el('div', `social-line ${line.who === 'me' ? 'me' : 'them'}`);
  if (named) row.append(el('b', '', line.who === 'me' ? '나' : friendName));
  row.append(el('span', '', line.text));
  return row;
}

function paintChat() {
  const mine = chat;
  $('social-with').textContent = mine.friend.nickname;
  $('social-chat-state').textContent = chatStateText(mine);
  // redraw the lines only when one was added, so reading old lines is not scrolled away
  const lines = $('social-lines');
  const drawn = `${mine.id}:${mine.seq}`;
  if (lines.dataset.drawn !== drawn) {
    lines.dataset.drawn = drawn;
    lines.replaceChildren(...mine.lines.map((line, index) => lineNode(line, mine.friend.nickname, mine.lines[index - 1]?.who !== line.who)));
    lines.scrollTop = lines.scrollHeight;
  }
  const open = mine.state === 'open';
  $('social-say').disabled = !open;
  $('social-send').disabled = !open;
  $('social-race').disabled = mine.state === 'ended';
  $('social-report').disabled = !mine.code;
  $('social-hangup').textContent = mine.state === 'calling' ? '✋ 그만 부르기' : mine.state === 'ended' ? '← 친구 목록' : '👋 나가기';
  mine.unread = 0;
}

// ---------- panel ----------

function show(next) {
  if (next) view = next;
  if (window.classicOnline?.isOpen()) window.classicOnline.close();
  panel.hidden = false;
  setStatus('');
  if (view === 'home') loadLists();
  paint();
  // a mouse and keyboard player can type right away; a phone keeps its keyboard down
  if (matchMedia('(pointer: fine)').matches) {
    const field = view === 'login' ? $('social-nick') : view === 'chat' ? $('social-say') : null;
    if (field && !field.disabled) field.focus({preventScroll: true});
  }
}

function close(focusGame = true) {
  answerAsk?.({ok: false});
  panel.hidden = true;
  if (focusGame) $('canvas').focus();
}

// Asks before blocking, reporting or logging out. reason: show a box to say what was wrong.
function confirmBox({text, ok, reason = false}) {
  answerAsk?.({ok: false});
  return new Promise(resolve => {
    $('social-ask-text').textContent = text;
    $('social-ask-ok').textContent = ok;
    const field = $('social-ask-reason');
    field.hidden = !reason;
    field.value = '';
    $('social-ask').hidden = false;
    answerAsk = value => {
      answerAsk = null;
      $('social-ask').hidden = true;
      resolve(value);
    };
    $('social-ask-no').focus({preventScroll: true});
  });
}

// ---------- logging in ----------

function startSocial() {
  stopSocial();
  social = new Social(account, socialHooks);
  social.live().catch(() => {});
  loadLists();
}

function stopSocial() {
  endChat();
  hideInvite();
  social?.close();
  social = null;
  friends = [];
  incoming = [];
  outgoing = [];
  $('social-results').textContent = '';
  $('social-q').value = '';
}

function lostLogin(reason) {
  if (!social) return;
  stopSocial();
  view = 'login';
  mode = 'login';
  toast(reason === 'suspended' ? '이 계정은 정지됐어.' : '로그인이 풀렸어. 다시 로그인해 줘.');
  paint();
}

async function logout() {
  const answer = await confirmBox({text: '로그아웃할까? 다시 들어오려면 닉네임과 비밀번호가 필요해.', ok: '로그아웃'});
  if (!answer.ok) return;
  stopSocial();
  await account.logout().catch(() => {});
  view = 'login';
  mode = 'login';
  paint();
  setStatus('로그아웃했어.');
}

async function submitLogin(event) {
  event.preventDefault();
  if (busy) return;
  const signup = mode === 'signup';
  const nickname = $('social-nick').value.trim();
  const password = $('social-pass').value;
  if (!nickname || !password) return setStatus('닉네임과 비밀번호를 적어 줘.');
  if (signup && !NICK_RE.test(nickname)) return setStatus('닉네임은 2~10글자, 한글, 영어, 숫자, _ 만 쓸 수 있어.');
  if (signup && (password.length < 4 || password.length > 16)) return setStatus('비밀번호는 4~16글자로 해 줘.');
  if (signup && password !== $('social-pass2').value) return setStatus('비밀번호 두 개가 달라. 똑같이 적어 줘.');
  busy = true;
  paint();
  setStatus(signup ? '계정을 만드는 중…' : '로그인하는 중…');
  try {
    const user = signup ? await account.signup(nickname, password) : await account.login(nickname, password);
    $('social-pass').value = '';
    $('social-pass2').value = '';
    startSocial();
    view = 'home';
    setStatus('');
    toast(signup ? `환영해, ${user.nickname}! 이제 친구를 찾아 봐.` : `다시 왔구나, ${user.nickname}!`);
  } catch (error) {
    setStatus(offSite ? OFF_SITE_MESSAGE : error?.message || '서버에 연결하지 못했어. 인터넷을 확인해 줘.');
  }
  busy = false;
  paint();
}

function setMode(next) {
  mode = next;
  setStatus('');
  paint();
}

// ---------- friends ----------

async function loadLists() {
  const s = social;
  if (!s) return;
  const asked = ++listsAsked;
  try {
    const [list, requests] = await call(() => Promise.all([s.friends(), s.requests()]));
    if (s !== social || asked !== listsAsked) return;
    friends = list;
    incoming = requests.incoming ?? [];
    outgoing = requests.outgoing ?? [];
  } catch (error) {
    if (s === social && view === 'home' && !panel.hidden) setStatus(error?.message || '친구 목록을 불러오지 못했어.');
  }
  paint();
}

async function search(event) {
  event.preventDefault();
  const s = social;
  const box = $('social-results');
  const query = $('social-q').value.trim();
  box.replaceChildren();
  if (!s) return;
  if (query.length < 2) {
    box.append(el('p', 'social-empty', '닉네임을 두 글자 이상 적어 줘.'));
    return;
  }
  box.append(el('p', 'social-empty', '찾는 중…'));
  try {
    const users = await call(() => s.search(query));
    if (s !== social) return;
    box.replaceChildren(...users.map(resultRow));
    if (!users.length) box.append(el('p', 'social-empty', '그런 닉네임을 찾지 못했어.'));
  } catch (error) {
    if (s === social) box.replaceChildren(el('p', 'social-empty', error?.message || '찾지 못했어.'));
  }
}

// Search again when someone in the results became a friend, so no row says "요청을 보냈어" any more.
function refreshSearch() {
  if (social && $('social-results').childElementCount && $('social-q').value.trim().length >= 2) $('social-search').requestSubmit();
}

function resultRow(user) {
  const row = el('div', 'social-row');
  row.dataset.nick = user.nickname;
  const note = user.friend ? '✔ 이미 친구야' : user.requested ? '친구 요청을 보냈어' : user.requestedMe ? '나한테 친구 요청을 보냈어' : '';
  row.append(who(user.nickname, note));
  if (!user.friend && !user.requested) {
    const ask = button(user.requestedMe ? '수락' : '🤝 친구 요청', 'primary', async () => {
      const s = social;
      if (!s) return;
      ask.disabled = true;
      try {
        const result = await call(() => s.requestFriend(user.id));
        toast(result.status === 'friends' ? `🤝 ${josa(user.nickname, '과', '와')} 친구가 됐어!` : `🤝 ${user.nickname}에게 친구 요청을 보냈어. 수락하면 친구가 돼!`);
      } catch (error) {
        setStatus(error?.message || '친구 요청을 보내지 못했어.');
      }
      refreshSearch();
      loadLists();
    });
    ask.dataset.action = 'request';
    row.append(ask);
  }
  return row;
}

async function answerRequest(request, yes) {
  const s = social;
  if (!s) return;
  try {
    if (yes) {
      await call(() => s.acceptFriend(request.id));
      toast(`🤝 ${josa(request.nickname, '과', '와')} 친구가 됐어!`);
    } else {
      await call(() => s.declineFriend(request.id));
    }
  } catch (error) {
    setStatus(error?.message || '대답하지 못했어.');
  }
  incoming = incoming.filter(item => item.id !== request.id);
  refreshSearch();
  loadLists();
}

async function cancelRequest(request) {
  const s = social;
  if (!s) return;
  try {
    await call(() => s.cancelRequest(request.id));
  } catch (error) {
    setStatus(error?.message || '취소하지 못했어.');
  }
  loadLists();
}

// ---------- friend chat ----------

let chats = 0;
const newChat = (friend, state) => ({
  id: ++chats, friend: {id: Number(friend?.id) || 0, nickname: String(friend?.nickname || '친구')},
  state, room: null, code: '', lines: [], seq: 0, unread: 0, race: false, until: 0, ended: '', waitTimer: 0,
  tokens: CHAT_BURST, filled: Date.now(), // lines I may send now (see CHAT_BURST)
});

function roomHooks(mine) {
  return {
    status(state, message) {
      if (state === 'error' && chat === mine && mine.room) finish(mine, message || '채팅 서버와 연결이 끊겼어.');
    },
    join() {
      if (chat !== mine || !mine.room || mine.state === 'open') return;
      mine.state = 'open';
      arrived(mine);
      paint();
    },
    depart(id) {
      if (id && chat === mine) finish(mine, `${josa(mine.friend.nickname, '이', '가')} 채팅에서 나갔어.`);
    },
    message(data) {
      if (chat === mine) received(mine, data);
    },
    error(code) {
      if (chat !== mine || code !== 'chat-rate') return;
      setStatus('천천히! 1초에 한 줄씩 보낼 수 있어.');
      addLine(mine, {who: 'note', text: '방금 한 말은 너무 빨라서 친구한테 안 갔어.'});
    },
  };
}

// Invite a friend. The chat starts when the friend presses 좋아!.
async function startChat(friend, race = false) {
  const s = social;
  if (!s) return;
  if (chat && chat.friend.id === friend.id && chat.state !== 'ended') {
    view = 'chat';
    paint();
    if (race) offerRace();
    return;
  }
  endChat();
  const mine = chat = newChat(friend, 'calling');
  mine.race = race;
  mine.until = Date.now() + INVITE_MS;
  view = 'chat';
  setStatus('');
  paint();
  clearInterval(callTimer);
  callTimer = setInterval(() => {
    if (chat !== mine || mine.state !== 'calling') clearInterval(callTimer);
    else if (!panel.hidden && view === 'chat') $('social-chat-state').textContent = chatStateText(mine);
  }, 500);
  try {
    const result = await call(() => s.invite(mine.friend.id, GAME, roomHooks(mine)));
    if (chat !== mine) {
      result.room.leave();
      return;
    }
    enter(mine, result);
  } catch (error) {
    if (chat !== mine) return;
    const name = mine.friend.nickname;
    finish(mine, error?.code === 'declined' ? `${josa(name, '이', '가')} 지금은 어렵대. 나중에 다시 불러 봐.`
      : error?.code === 'expired' ? `${josa(name, '이', '가')} 대답하지 않았어. 나중에 다시 불러 봐.`
        : error?.message || '친구를 부르지 못했어.');
  }
}

async function acceptInvite() {
  const inv = invite;
  const s = social;
  if (!inv || !s) return;
  hideInvite();
  endChat();
  const mine = chat = newChat(inv.from, 'joining');
  show('chat');
  try {
    const result = await call(() => s.acceptInvite(inv.id, roomHooks(mine)));
    if (chat !== mine) {
      result.room.leave();
      return;
    }
    enter(mine, result);
  } catch (error) {
    if (chat === mine) finish(mine, error?.code === 'not-found' || error?.code === 'expired' ? '부르기가 벌써 끝났어.' : error?.message || '채팅방에 들어가지 못했어.');
  }
}

async function declineInvite() {
  const inv = invite;
  hideInvite();
  if (!inv) return;
  try {
    await social?.declineInvite(inv.id);
  } catch {
    // the invite is already over
  }
}

// Both of us are in the room (or I am, waiting for the friend).
function enter(mine, {room, opponent}) {
  clearInterval(callTimer);
  mine.room = room;
  mine.code = room.code;
  // the name the server checked when the friend signed up
  mine.friend = {id: Number(opponent?.id) || mine.friend.id, nickname: String(opponent?.nickname || mine.friend.nickname)};
  if (room.peers.length) {
    mine.state = 'open';
    arrived(mine);
  } else {
    mine.state = 'waiting';
    mine.waitTimer = setTimeout(() => {
      if (chat === mine && mine.state === 'waiting') finish(mine, `${josa(mine.friend.nickname, '이', '가')} 들어오지 못했어. 다시 불러 봐.`);
    }, WAIT_MS);
  }
  paint();
}

function arrived(mine) {
  clearTimeout(mine.waitTimer);
  addLine(mine, {who: 'note', text: `${josa(mine.friend.nickname, '과', '와')} 연결됐어! 이제 말할 수 있어.`});
  if (mine.race) offerRace();
}

// The chat is over (friend left, connection lost, no answer). The screen stays so it can still be reported.
function finish(mine, text) {
  if (mine.state === 'ended') return;
  mine.state = 'ended';
  mine.ended = text;
  clearInterval(callTimer);
  clearTimeout(mine.waitTimer);
  const room = mine.room;
  mine.room = null;
  try {
    room?.leave();
  } catch {
    // already closed
  }
  paint();
}

// Leave the chat without a word (another chat, logging out).
function endChat() {
  const mine = chat;
  if (!mine) return;
  chat = null;
  clearInterval(callTimer);
  clearTimeout(mine.waitTimer);
  if (mine.state === 'calling') social?.cancelInvite().catch(() => {});
  try {
    mine.room?.leave();
  } catch {
    // already closed
  }
}

function received(mine, data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.chat === 'string') {
    const text = data.chat.trim().slice(0, 200);
    if (text) addLine(mine, {who: 'them', text});
    return;
  }
  if (data.t === 'race') {
    const code = codeFromNumbers(data.c);
    if (code) addLine(mine, {who: 'race', text: `🏁 ${josa(mine.friend.nickname, '이', '가')} 같이 달리재!`, code});
  }
}

function addLine(mine, line) {
  mine.lines.push(line);
  mine.seq++;
  if (mine.lines.length > LINES_KEEP) mine.lines.shift();
  const seen = !panel.hidden && view === 'chat';
  if (!seen && (line.who === 'them' || line.who === 'race')) {
    mine.unread++;
    toast(line.who === 'race' ? `${line.text} 위의 👤 단추를 눌러 들어가 봐.` : `💬 ${mine.friend.nickname}: ${line.text.slice(0, 40)}`);
  }
  paint();
}

function sendLine(event) {
  event.preventDefault();
  const mine = chat;
  const input = $('social-say');
  const text = input.value.trim().slice(0, CHAT_MAX);
  if (!mine || !text) return;
  if (mine.state !== 'open' || !mine.room?.ready) {
    setStatus('친구가 들어와야 말할 수 있어.');
    return;
  }
  const now = Date.now();
  mine.tokens = Math.min(CHAT_BURST, mine.tokens + (now - mine.filled) / CHAT_GAP_MS);
  mine.filled = now;
  if (mine.tokens < 1) {
    setStatus('천천히! 1초에 한 줄씩 보낼 수 있어.');
    return;
  }
  // typed text goes only through room.chat: the server filters it before the friend sees it
  if (!mine.room.chat(text)) {
    setStatus('보내지 못했어. 다시 해 볼래?');
    return;
  }
  mine.tokens -= 1;
  input.value = '';
  setStatus('');
  addLine(mine, {who: 'me', text});
}

async function blockFriend() {
  const mine = chat;
  const s = social;
  if (!mine || !s) return;
  const friend = mine.friend;
  const answer = await confirmBox({
    text: `🚫 ${josa(friend.nickname, '을', '를')} 차단할까? 친구에서 빠지고, 서로 채팅하거나 부를 수 없어. 상대에게는 알리지 않아.`,
    ok: '차단하기',
  });
  if (!answer.ok || social !== s) return;
  try {
    await call(() => s.block(friend.id));
  } catch (error) {
    setStatus(error?.message || '차단하지 못했어.');
    return;
  }
  if (chat === mine) endChat();
  friends = friends.filter(item => item.id !== friend.id);
  view = 'home';
  paint();
  setStatus(`🚫 ${josa(friend.nickname, '을', '를')} 차단했어.`);
  loadLists();
}

async function reportFriend() {
  const mine = chat;
  const s = social;
  if (!mine?.code || !s) return;
  const friend = mine.friend;
  const answer = await confirmBox({
    text: `🚨 ${josa(friend.nickname, '을', '를')} 신고할까? 어른이 이 채팅 기록을 보고 확인해.`,
    ok: '신고하기',
    reason: true,
  });
  if (!answer.ok || social !== s) return;
  // the server collects this room's filtered lines itself; these are what I saw on my screen
  const messages = mine.lines.filter(line => line.who === 'me' || line.who === 'them')
    .map(line => ({text: `${line.who === 'me' ? '나' : '상대'}: ${line.text}`}));
  try {
    await call(() => s.report({target: friend.id, context: {kind: 'room', game: GAME, room: mine.code}, reason: answer.reason, messages}));
    setStatus('🚨 신고했어. 알려 줘서 고마워!');
  } catch (error) {
    setStatus(error?.message || '신고하지 못했어.');
  }
}

// ---------- 같이 달리기 ----------

function codeFromNumbers(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== 6) return '';
  if (!numbers.every(n => Number.isInteger(n) && n >= 0 && n < ALPHABET.length)) return '';
  return numbers.map(n => ALPHABET[n]).join('');
}

async function offerRace() {
  const mine = chat;
  if (!mine || mine.state === 'ended') return;
  if (mine.state !== 'open' || !mine.room?.ready) {
    mine.race = true;
    setStatus(`${josa(mine.friend.nickname, '이', '가')} 들어오면 같이 달리기 방을 만들게.`);
    return;
  }
  mine.race = false;
  const online = window.classicOnline;
  if (!online?.host) {
    setStatus('같이 하기를 아직 불러오지 못했어.');
    return;
  }
  close(false);
  const code = await online.host();
  if (chat !== mine || mine.state !== 'open' || !mine.room?.ready) return;
  if (!code) {
    addLine(mine, {who: 'note', text: '같이 달리기 방을 만들지 못했어. 다시 해 볼래?'});
    return;
  }
  // room codes go as numbers: the server would filter a string in a friend room
  mine.room.send({t: 'race', c: [...code].map(letter => ALPHABET.indexOf(letter))});
  addLine(mine, {who: 'note', text: `🏁 같이 달리기 방을 만들었어. ${josa(mine.friend.nickname, '이', '가')} 들어오면 단계를 골라 시작해!`});
}

async function joinRace(code) {
  const online = window.classicOnline;
  if (!online?.join) {
    setStatus('같이 하기를 아직 불러오지 못했어.');
    return;
  }
  close(false);
  await online.join(code);
}

// ---------- invites ----------

function showInvite(inv) {
  if (!inv || inv.game !== GAME || !inv.id) return;
  invite = inv;
  $('social-invite-text').textContent = `👋 ${josa(String(inv.from?.nickname || '친구'), '이', '가')} 같이 놀재!`;
  $('social-invite').hidden = false;
  clearInterval(inviteTimer);
  const tick = () => {
    if (invite !== inv) return;
    const left = Math.ceil((Number(inv.expires) - Date.now()) / 1000);
    if (!(left > 0)) {
      hideInvite();
      return;
    }
    $('social-invite-left').textContent = `채팅하고 같이 달릴 수 있어 · ${left}초`;
  };
  tick();
  inviteTimer = setInterval(tick, 500);
  paintHeader();
}

function hideInvite() {
  invite = null;
  clearInterval(inviteTimer);
  $('social-invite').hidden = true;
  paintHeader();
}

// ---------- what the server tells us (Social hooks) ----------

function setOnline(id, online) {
  const friend = friends.find(item => item.id === id);
  if (friend) friend.online = online;
  paint();
}

const socialHooks = {
  status() {
    paint();
  },
  hello(message) {
    const online = new Set(message.online ?? []);
    for (const friend of friends) friend.online = online.has(friend.id);
    const waiting = (message.invites ?? []).filter(item => item.game === GAME).at(-1);
    if (waiting) showInvite(waiting);
    loadLists();
  },
  online: id => setOnline(id, true),
  offline: id => setOnline(id, false),
  friendRequest(from) {
    if (!from?.id) return;
    toast(`🤝 ${josa(from.nickname, '이', '가')} 친구 요청을 보냈어!`);
    if (!incoming.some(item => item.id === from.id)) incoming.push(from);
    paint();
  },
  friendAccepted(friend) {
    if (!friend?.id) return;
    toast(`🤝 ${josa(friend.nickname, '과', '와')} 친구가 됐어!`);
    outgoing = outgoing.filter(item => item.id !== friend.id);
    if (!friends.some(item => item.id === friend.id)) friends.push({...friend});
    refreshSearch();
    paint();
  },
  friendRemoved(id) {
    friends = friends.filter(item => item.id !== id);
    if (chat?.friend.id === id) finish(chat, '이제 친구가 아니라서 채팅이 끝났어.');
    paint();
  },
  invite: showInvite,
  inviteCanceled(message) {
    if (invite && invite.id === message?.invite) {
      hideInvite();
      toast('친구가 부르기를 그만뒀어.');
    }
  },
  kicked: reason => lostLogin(reason),
};

// ---------- buttons and keys ----------

openButton.addEventListener('click', () => {
  if (!panel.hidden) close();
  else show(!social ? 'login' : chat ? 'chat' : 'home');
});
$('social-close').addEventListener('click', () => close());
$('social-mode-login').addEventListener('click', () => setMode('login'));
$('social-mode-signup').addEventListener('click', () => setMode('signup'));
$('social-login-form').addEventListener('submit', submitLogin);
$('social-logout').addEventListener('click', logout);
$('social-search').addEventListener('submit', search);
$('social-say-form').addEventListener('submit', sendLine);
$('social-race').addEventListener('click', offerRace);
$('social-block').addEventListener('click', blockFriend);
$('social-report').addEventListener('click', reportFriend);
$('social-back').addEventListener('click', () => {
  if (chat?.state === 'ended') endChat();
  view = 'home';
  setStatus('');
  paint();
  loadLists();
});
$('social-hangup').addEventListener('click', () => {
  const mine = chat;
  if (!mine) return;
  endChat();
  view = 'home';
  paint();
  setStatus(mine.state === 'calling' ? '부르기를 그만뒀어.' : mine.state === 'ended' ? '' : '채팅에서 나왔어.');
  loadLists();
});
$('social-ask-ok').addEventListener('click', () => answerAsk?.({ok: true, reason: $('social-ask-reason').value.trim().slice(0, 200)}));
$('social-ask-no').addEventListener('click', () => answerAsk?.({ok: false}));
$('social-invite-yes').addEventListener('click', acceptInvite);
$('social-invite-no').addEventListener('click', declineInvite);
// one panel at a time
$('online-open').addEventListener('click', () => {
  if (!panel.hidden) close(false);
});
$('select').addEventListener('click', () => {
  if (!panel.hidden) close(false);
});

// Typing in these boxes must not reach the game behind the panel (it listens on window).
for (const field of panel.querySelectorAll('input, textarea')) {
  for (const type of ['keydown', 'keyup', 'keypress']) {
    field.addEventListener(type, event => {
      event.stopPropagation();
      if (type !== 'keydown' || event.key !== 'Escape') return;
      event.preventDefault();
      if (answerAsk) answerAsk({ok: false});
      else close();
    });
  }
}

window.addEventListener('pagehide', () => {
  if (!chat) return;
  if (chat.state === 'calling') social?.cancelInvite().catch(() => {});
  finish(chat, '창을 떠나서 채팅이 끝났어.');
});

window.classicSocial = {
  isOpen: () => !panel.hidden,
  close: () => close(),
  status: () => ({
    loggedIn: Boolean(social),
    nickname: social ? account.user?.nickname ?? '' : '',
    live: social?.status ?? 'offline',
    view,
    friends: friends.map(friend => ({nickname: friend.nickname, online: Boolean(friend.online)})),
    incoming: incoming.map(request => request.nickname),
    outgoing: outgoing.map(request => request.nickname),
    invite: invite?.from?.nickname ?? '',
    chat: chat ? {with: chat.friend.nickname, state: chat.state, lines: chat.lines.map(line => ({who: line.who, text: line.text}))} : null,
  }),
};

if (account.loggedIn) {
  startSocial();
  if (!account.user) call(() => account.me()).then(paint, () => {});
}
paint();
