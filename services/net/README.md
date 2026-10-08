# net: 모든 게임이 같이 쓰는 멀티플레이 서버

seonn.dev 게임들이 같이 놀 때 쓰는 서버입니다. Cloudflare Worker 하나, Durable Object 세 종류(`Room`, `Lobby`, `Matchmaker`), D1 데이터베이스 `net` 으로 되어 있고, 주소는 `net.seonn.workers.dev` 입니다. 나중에 seonn.dev DNS를 Cloudflare로 옮기면 `net.seonn.dev` 로 바꿀 수 있습니다. 무엇을 왜 만들었는지는 [`requirements/matchmaking-chat-friends.md`](../../requirements/matchmaking-chat-friends.md).

- 방 하나 = Durable Object `Room` 하나 (`<게임 이름>:<방 코드>`). 다른 게임끼리는 코드가 같아도 다른 방입니다.
- 서버는 게임 내용을 모릅니다. 들어온 사람에게 번호(`p1`, `p2`, ...)를 주고, 들어오고 나간 걸 알리고, 게임이 보낸 JSON을 다른 사람에게 그대로 전합니다. 게임 데이터는 저장하지도, 로그로 남기지도 않습니다.
- 예외는 채팅 글(`data.chat`)입니다. 서버가 욕설, 전화번호, 링크, 메신저 아이디를 가려서 보내고, 신고에 쓰려고 방마다 거른 글 마지막 50줄을 기억합니다(모두 나간 뒤 10분까지).
- 랜덤 매칭과 친구 초대로 만든 방(관계자 방)에서는 `data` 안의 모든 글자열(칸 이름 포함)을 거릅니다. 아래 "관계자 방에서 거르는 것".
- 계정(닉네임+비밀번호, 이메일 없음), 친구, 1:1 대화, 차단, 신고, 게임 저장(클라우드 세이브)은 D1 에 저장합니다. 접속 상태와 알림은 `Lobby`(전체에 하나), 랜덤 매칭 줄은 `Matchmaker`(게임마다 하나)가 맡습니다.

게임별로 이 서버를 어떻게 쓰는지는 저장소 루트 `AGENTS.md` 의 "게임별 지금 상태" 표에 있습니다. 젤리 타워의 기기 계정(친구 코드, 방 코드)만 아직 PeerJS 공용 서버를 씁니다.

## 게임에서 쓰는 법

클라이언트는 `packages/net/index.mjs`(`@inhyuk/net`)입니다. 뿌요 타워의 `PuyoRoom`과 쓰는 법이 같습니다.

```js
import { Room } from '../../packages/net/index.mjs';
const room = new Room({ status: (s, msg) => show(s, msg), join: id => start(id), message: (data, from) => play(data, from) }, { game: 'my-game', maxPlayers: 2 });
await room.open();               // 방장: 새 방을 만들고 room.code 를 친구에게 알려 준다
// 친구 쪽에서는 코드로 들어간다: await room.open('ABC123');
room.send({ t: 'move', x: 3 });  // 모두에게. 한 명에게만은 room.sendTo(peerId, msg)
```

- `status`: `offline` / `connecting` / `waiting`(방에 나 혼자) / `connected`(친구가 1명 이상) / `error`. 두 번째 인자는 아이에게 보여 줄 한국어 문장입니다.
- `join(id)`, `depart(id)`, `host(id)`, `rejoin(id)`(같은 사람이 다른 연결로 다시 들어옴), `error(code)` 훅도 있습니다. `room.peers`(나를 뺀 사람들), `room.id`, `room.host`, `room.maxPlayers`.
- `game` 은 영어 소문자, 숫자, `-` 로 32글자까지. `maxPlayers` 는 2~8(기본 2). 방 코드는 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` 중 6글자.
- 서버 주소는 `options.server` 로 바꿀 수 있습니다(기본 `wss://net.seonn.workers.dev`). 로컬에서는 `ws://127.0.0.1:8787`.

### 정해 둔 규칙

- 한 계정은 방에서 자리 하나만 씁니다. 같은 계정이 표(`?ticket=`)를 가지고 또 들어오면 새 자리를 주지 않고 예전 연결을 바꿔 낍니다. 예전 연결은 `{"t":"error","code":"replaced"}` 를 받고 4409 로 닫히고, 새 연결은 같은 번호(`p1`)와 방장 자리를 그대로 받습니다. 남은 사람은 `{"t":"rejoin","id"}`(클라이언트 `rejoin(id)` 훅)를 받으니, 게임은 이때 상태를 다시 보내 줍니다.
- 방장이 나가면 방은 없어지지 않고, 가장 먼저 들어온 사람이 새 방장이 됩니다(`host` 메시지). 모두 나가면 방이 지워지고 코드는 다시 쓸 수 있습니다.
- 방을 만들고 2분 안에 아무도 안 들어오면 지웁니다. 30초 동안 핑이 없는 사람은 내보냅니다(클라이언트가 4초마다 자동으로 핑을 보냅니다).
- 메시지 하나는 16KB까지. 한 연결은 1초에 평소 30개, 몰아서 60개까지 보낼 수 있고 넘치면 버립니다(`error` 훅에 `too-big`, `rate`).
- 접속은 `https://seonn.dev`, `https://www.seonn.dev`, 아이폰 앱(`capacitor://localhost`, `https://localhost`), `http://localhost`, `http://127.0.0.1` 에서만 됩니다. 목록은 `wrangler.jsonc` 의 `ALLOWED_ORIGINS`.

### 주고받는 메시지 (직접 구현할 때만 필요)

| 방향 | 메시지 |
|---|---|
| 방 만들기 | `POST /rooms/:game` 몸 `{"maxPlayers":4}` → `{"code":"ABC123","maxPlayers":4}` |
| 들어가기 | `GET /rooms/:game/:code` (WebSocket) |
| 서버 → 나 | `{"t":"welcome","id","host","max","peers":[...]}`, `{"t":"join","id"}`, `{"t":"rejoin","id"}`, `{"t":"leave","id"}`, `{"t":"host","id"}`, `{"t":"msg","from","data"}`, `{"t":"error","code"}`, `{"t":"pong"}` |
| 나 → 서버 | `{"t":"send","data"}`, `{"t":"send","to":"p2","data"}`, `{"t":"ping"}`, `{"t":"bye"}` |

거절될 때는 `{"t":"error","code":"not-found"}`(close 4404), `{"t":"error","code":"full","max":2}`(close 4403), `{"t":"error","code":"not-member"}`(close 4401, 랜덤 매칭이나 초대로 만든 방에 표 없이 들어올 때) 를 받고 연결이 닫힙니다. 들어가 있는 동안에는 `replaced`(같은 계정이 다른 곳에서 들어옴, close 4409), `suspended`(계정 정지, close 4403)로 닫힐 수 있습니다.

### 대전 채팅

사람이 쓴 글은 반드시 `data.chat`(문자열)에 넣습니다. `room.chat('안녕')` 이 `send({ chat: '안녕' })` 과 같습니다. 같은 메시지의 다른 칸(`{ chat, emoji: 3 }` 의 `emoji`)과 채팅이 아닌 메시지는 손대지 않고 전합니다. 그래서 게임은 사람이 쓴 글을 다른 칸에 넣으면 안 됩니다(거르지 않고 지나갑니다).

- 200글자까지 자르고, 1초에 1줄(몰아서 5줄)까지. 넘치면 `error` 훅에 `chat-rate`. `chat` 이 문자열이 아니면 `bad`.
- 거르는 것: 욕설(`src/badwords.js` 목록, 띄어쓰기, 숫자, 기호, 자음만 쓰기, 보이지 않는 글자로 피하는 것 포함), 전화번호(010-1234-5678, 띄어 쓴 숫자, +82, "공일공 일이삼사" 같은 한글 숫자), 링크(`http`, `www`, `naver.com`, "닷컴"), 이메일, 메신저 아이디("카톡 아이디 abc", `@abc`, `name#1234`). 가린 글자는 `*` 가 됩니다.
- 찾기 전에 글자를 폅니다: 전각 글자(`ｅｘａｍｐｌｅ．ｃｏｍ`, `ｈｔｔｐｓ://`), `。` 같은 마침표 모양, 안 보이는 글자, 한 글자씩 띄어 쓴 주소(`n a v e r . c o m`), 숫자 옆의 O, I, l(`O1O-I234-5678`), "카톡아이디abc" 처럼 붙여 쓴 아이디. 가리는 자리는 원래 글 기준입니다.
- 한 사람이 번호를 여러 줄로 나눠 보내면(`010` / `1234` / `5678`), 같은 사람이 30초 안에 보낸 앞 2줄과 이어 보아 숫자가 9개 이상 이어지면 이번 줄의 그 부분을 가립니다. 이미 보낸 줄은 고치지 않습니다.
- 목록을 고칠 때는 `src/badwords.js` 를 고치고 `test/filter.test.js` 에 예를 더합니다. 평범한 말이 걸리면 `ALLOWED` 에 넣습니다.

### 관계자 방에서 거르는 것, 상대 이름 보여 주기

랜덤 매칭과 친구 초대로 만든 방에서는 상대가 보낸 `data` 의 모든 글자열과 칸 이름을 `data.chat` 과 같은 거르개로 가립니다(깊이 8까지, 더 깊으면 `bad`). 글자열 안의 숫자 8개 이상은 전화번호로 보고 가리므로, 게임 데이터의 숫자는 글자열(`"12345678"`)이 아니라 숫자나 숫자 배열로 보냅니다. 코드로 만든 공개 방은 예전처럼 `data.chat` 만 거릅니다.

게임 화면에 상대 이름을 보여 줄 때는 상대가 방에서 보낸 이름을 쓰지 말고, 서버가 준 `opponent.nickname`(`matched`, `match`, `room` 알림, `findMatch()`, `invite()`, `acceptInvite()` 의 결과)을 씁니다. 서버가 가입할 때 검사한 닉네임이라 믿을 수 있습니다.

## 계정과 친구 (@inhyuk/net 의 Account, Social)

```js
import { Account, Social } from '../../packages/net/index.mjs';

const account = new Account();                 // 로그인 토큰은 localStorage 에 저장 (options.storage 로 바꿀 수 있음)
await account.signup('인혁', '1234');            // 또는 account.login(...). 다음에 앱을 열면 account.loggedIn 이 true
const social = new Social(account, {
  status: s => showLive(s),                      // offline | connecting | online
  online: id => mark(id, true), offline: id => mark(id, false),
  friendRequest: from => toast(`${from.nickname} 님이 친구 요청`),
  friendAccepted: friend => refreshFriends(),
  dm: ({ message, from }) => showDm(from, message.body),
  invite: inv => askToAccept(inv),               // { id, from: { id, nickname }, game, expires }
});
await social.live();                             // 접속 상태와 알림. 끊기면 1, 2, 4 ... 30초 간격으로 다시 붙는다

await social.search('철');                       // [{ id, nickname, friend, requested, requestedMe }]
await social.requestFriend('철수');              // 또는 번호로: requestFriend(7) (매칭 결과 화면의 "친구 요청")
await social.acceptFriend(7);
const friends = await social.friends();          // [{ id, nickname, online, since }]
await social.sendDm(7, '같이 하자');               // 친구에게만. 거른 글이 돌아온다
const { messages, more } = await social.history(7); // 오래된 것부터 50개, 더 보려면 history(7, messages[0].id)
await social.markRead(7);
await social.block(7);                            // 친구 사이와 요청도 지운다
await social.report({ target: 7, context: { kind: 'room', game: 'puyo-tower', room: room.code }, messages: recentLines });

// 코드 없이 같이 하기: 둘 다 같은 방(Room)에 들어간 채로 돌아온다
const { room, opponent } = await social.findMatch('puyo-tower', roomHooks);  // 랜덤 매칭. social.cancelMatch() 하면 null
const { room, opponent } = await social.invite(friendId, 'puyo-tower', roomHooks); // 친구가 수락하면. 거절하면 NetError('declined')
const { room, opponent } = await social.acceptInvite(inv.id, roomHooks);           // 받은 초대 수락. 거절은 declineInvite(id)
```

- 실패하면 `NetError` 를 던집니다. `error.code` 는 서버 오류 코드, `error.message` 는 아이에게 보여 줄 한국어 문장(`SOCIAL_MESSAGES`).
- 닉네임은 2~10글자 한글, 영어, 숫자, `_`. 영어 대소문자를 가리지 않고 전체에서 하나뿐이고, 욕, 전화번호, 링크, 메신저 아이디("카톡abc"), 숫자 7개 이상이 들어가면 안 됩니다(`bad-nickname-word`). 비밀번호는 4~16글자. 이메일은 받지 않고, 비밀번호를 잊으면 되찾을 수 없습니다.
- 방 코드는 사람에게 보여 주지 않습니다. 매칭이나 초대로 만든 방은 그 두 사람만(한 번짜리 표로) 들어갈 수 있습니다.

### HTTP API

로그인이 필요한 곳(🔑)은 `Authorization: Bearer <token>` 을 붙입니다. 모든 곳이 `ALLOWED_ORIGINS` 의 주소에서만 됩니다. 오류는 `{ "error": "코드" }`. 보내는 몸은 실제로 읽은 바이트로 64KB 까지입니다(넘으면 413 `too-big`). `POST /rooms/:game` 은 IP 하나에서 1분에 60번까지(429).

| 방법 | 길 | 🔑 | 보내는 것 | 받는 것 |
|---|---|---|---|---|
| POST | `/auth/signup` | | `{nickname, password}` | 201 `{token, user:{id,nickname}}`. 409 `nickname-taken`, 400 `bad-nickname`/`bad-nickname-word`/`bad-password`, 429 |
| POST | `/auth/login` | | `{nickname, password}` | `{token, user}`. 401 `wrong-login`, 403 `{error:'suspended', reason}`, 429 `rate` |
| POST | `/auth/logout` | 🔑 | | `{ok}` (이 기기 토큰만 지움) |
| POST | `/auth/ticket` | 🔑 | | `{ticket, expires}` WebSocket 용 한 번짜리 표 (60초) |
| GET | `/me` | 🔑 | | `{user:{id,nickname,created}}` |
| GET | `/users/search?q=` | 🔑 | | `{users:[{id,nickname,friend,requested,requestedMe}]}` 앞부분이 같은 20명. 나, 차단한 사람, 나를 차단한 사람, 정지된 사람은 빠짐. `q` 가 한 글자면 빈 목록. 1분에 30번(429) |
| GET | `/friends` | 🔑 | | `{friends:[{id,nickname,since,online}]}` |
| DELETE | `/friends/:id` | 🔑 | | `{ok}` |
| GET | `/friends/requests` | 🔑 | | `{incoming:[{id,nickname,created}], outgoing:[...]}` |
| POST | `/friends/requests` | 🔑 | `{nickname}` 또는 `{id}` | 201 `{status:'requested', to}` 또는 `{status:'friends', friend}` (상대가 먼저 요청했으면 바로 친구). 404 `not-found`(없음, 정지, 차단 모두) |
| POST | `/friends/requests/:id/accept` | 🔑 | | `{status:'friends', friend:{id,nickname,online}}` |
| POST | `/friends/requests/:id/decline` | 🔑 | | `{ok}` |
| DELETE | `/friends/requests/:id` | 🔑 | | `{ok}` 내가 보낸 요청 취소 |
| GET | `/blocks` | 🔑 | | `{blocks:[{id,nickname,created}]}` |
| POST | `/blocks/:id` | 🔑 | | `{ok}` 친구 사이와 요청도 지움. 상대에게 알리지 않음 |
| DELETE | `/blocks/:id` | 🔑 | | `{ok}` |
| GET | `/dm` | 🔑 | | `{unread:[{id,nickname,count}]}` 안 읽은 메시지가 있는 사람 |
| GET | `/dm/:id?before=` | 🔑 | | `{messages:[{id,from,to,body,created,read}], more}` 오래된 것부터 50개 |
| POST | `/dm/:id` | 🔑 | `{body}` | 201 `{message, filtered:[...]}`. 친구에게만(403 `not-friends`), 내가 차단한 사람에게는 403 `blocked`, 나를 차단한 사람에게는 `not-friends`(차단 사실을 알리지 않음), 300글자(400 `too-long`), 1분에 20개(429) |
| POST | `/dm/:id/read` | 🔑 | | `{ok, count}` |
| POST | `/invites` | 🔑 | `{to, game}` | 201 `{invite:{id,to,game,expires}}`. 접속 중인 친구만(409 `offline`), 60초 |
| POST | `/invites/:id/accept` | 🔑 | | `{code, game, opponent}` (둘 다 `/live` 로 `room` 알림도 받음). 404, 409 `expired`/`offline` |
| POST | `/invites/:id/decline` | 🔑 | | `{ok}` |
| DELETE | `/invites/:id` | 🔑 | | `{ok}` 보낸 사람이 취소 |
| POST | `/reports` | 🔑 | `{target, context:{kind:'dm'|'room'|'profile', game, room}, reason, messages}` | 201 `{id}`. 1시간에 10번 |

신고 증거는 서버가 직접 모읍니다. `dm` 은 두 사람 사이 마지막 50개, `room` 은 그 방이 기억하는 거른 채팅 50줄(신고한 사람이 그 방에 있었을 때만). 신고한 사람이 보낸 `messages` 는 글자만 `{text}` 로(마지막 50개, 한 줄 300글자) 따로 저장합니다. `reason` 은 관리자만 보므로 거르지 않고 200글자까지 그대로 저장합니다.

### WebSocket

**내 계정 지우기** `POST /auth/delete` (🔑, 몸 `{password}`): 앱 안에서 계정을 지울 수 있어야 해서(앱스토어 5.1.1) 2026-10-07 에 더했습니다. 클라이언트는 `account.deleteAccount(password)`.

- 비밀번호를 한 번 더 확인하고 `{ok: true}` 를 돌려줍니다. 틀리면 403 `wrong-password` (401 이 아닙니다. 401 은 클라이언트가 "로그인이 풀림"으로 보고 토큰을 버립니다). 비밀번호가 없으면 400 `bad-login`, 10분에 5번을 넘으면 429 `rate`.
- 지우는 것: 그 계정의 로그인(모든 기기), 표, 친구, 친구 요청, 차단, 1:1 대화(양쪽이 주고받은 것 모두), 신고(한 것과 받은 것), 모든 게임의 저장과 랭킹 기록, 관전 목록. 되돌릴 수 없고 닉네임은 다시 쓸 수 있게 됩니다.
- 다른 기기에서 접속 중이면 `/live`, 방, 매칭 줄을 바로 끊습니다 (`kicked`, 이유 `deleted`).
- 정지된 계정은 🔑 길이 403 이라 지울 수 없습니다 (지우고 같은 닉네임으로 다시 만들어 정지를 피하지 못하게).
- 그 계정에 걸린 신고도 같이 지워지므로, `admin_actions` 에 `self-delete` (누구, 언제, 열려 있던 신고 수)를 남깁니다.
- D1 을 고치는 것(마이그레이션)은 없습니다. 서버만 다시 배포하면 됩니다. 시험은 `test/auth.test.js` 의 "deleting my account".

브라우저 WebSocket 에는 머리글을 붙일 수 없어서, `POST /auth/ticket` 으로 받은 한 번짜리 표를 주소에 붙입니다(`?ticket=`). 토큰 자체는 주소에 넣지 않습니다(로그에 남지 않게). 클라이언트 라이브러리가 알아서 합니다.

| 길 | 하는 일 | 서버 → 나 |
|---|---|---|
| `/live?ticket=` | 접속 상태와 알림. 25초마다 `{"t":"ping"}` | `hello {user, online:[친구 번호], invites:[...]}`, `online {id}`, `offline {id}`, `friend-request {from}`, `friend-accepted {friend}`, `friend-removed {id}`, `dm {message, from}`, `invite {invite}`, `invite-declined {invite, by}`, `invite-canceled {invite}`, `room {via:'invite', invite, code, game, opponent}`, `match {code, game, opponent}`, `kicked {reason}` (정지, close 4403) |
| `/match/:game?ticket=` | 랜덤 매칭 줄. 10초마다 핑, `{"t":"cancel"}` 로 빠짐 | `queued`, `matched {code, game, opponent:{id,nickname}}` 뒤 닫힘, `canceled`, `replaced`(다른 기기에서 또 줄 섬), `error {code}` |
| `/rooms/:game/:code?ticket=` | 방 (위 "주고받는 메시지"). 표는 매칭, 초대 방에서만 필요 | |

랜덤 매칭은 먼저 기다린 사람부터 봅니다. 서로 차단한 사이, 정지된 사람, 30초 넘게 소식 없는 사람은 건너뜁니다. 연결이 끊기면 줄에서 빠집니다.

## 게임 저장 (클라우드 세이브)

같은 계정으로 다른 기기에서 이어 하려고, 게임 진행(레벨, 코인 등)을 사람마다, 게임마다 하나씩 서버에 저장합니다. 서버는 내용을 모르고, 합치지도 않습니다. 게임별 adapter가 충돌 시 어떤 값을 쓸지 정한다(라이브러리는 정하지 않음).

```js
const save = await account.loadSave('jelly-tower');          // { data, revision, updated } 또는 null (아직 없음)
const result = await account.putSave('jelly-tower', data, save?.revision ?? 0);
if (result.ok) remember(result.revision);                      // 다음 putSave 의 baseRevision
else if (result.conflict) resolve(result.server);              // 다른 기기가 먼저 씀: { data, revision, updated }
// 기기에 있던 저장을 처음 올릴 때는 importId 를 한 번 붙인다. 응답을 못 받고 다시 보내도 두 번 쓰지 않는다.
await account.putSave('jelly-tower', localData, 0, { importId: 'device-1234abcd' });
```

`Social` 에도 같은 `loadSave`, `putSave` 가 있습니다.

| 방법 | 길 | 🔑 | 보내는 것 | 받는 것 |
|---|---|---|---|---|
| GET | `/saves/:game` | 🔑 | | `{data, revision, updated}`. 없으면 404 `no-save` |
| PUT | `/saves/:game` | 🔑 | `{data, baseRevision, importId?}` | `{revision, updated}`. `baseRevision` 이 지금 revision 과 다르면 409 `{error:'conflict', data, revision, updated}`(서버 쪽 저장, 없으면 `data:null, revision:0`). 이미 쓴 `importId` 면 쓰지 않고 `{revision, updated, duplicate:true}` |

- `baseRevision`: 마지막으로 읽거나 쓴 revision. 저장이 없을 때는 `0` 또는 `null`. revision 은 1부터 쓸 때마다 1씩 오릅니다.
- 자동으로 합치지 않습니다. 특히 코인을 큰 값으로 고르는 식의 합치기는 하지 않습니다(두 기기에서 코인을 불릴 수 있음).
- `data` 는 JSON 객체(배열 아님), 32KB 까지(413 `too-big`, 400 `bad-save`). `importId` 는 영어, 숫자, `_`, `-` 8~64글자(400 `bad-import`). `game` 은 방과 같은 규칙(400 `bad-game`).
- 쓰기는 1분에 30번까지(429). 정지된 계정은 다른 🔑 길처럼 403.
- 표: `saves(user_id, game, data, revision, updated_at)`, `save_imports(user_id, game, import_id, created)` (`migrations/0002_saves.sql`).

## 기록, 랭킹, 관전

게임의 레벨·트로피로 온라인 랭킹을 만들고, 지금 하는 대전을 다른 사람이 보게 합니다 (뿌요뿌요 타워 업그레이드 3). 코드는 `src/stats.js`(기록, 랭킹, 지금 하는 대전 목록)와 `src/index.js` 방의 관전 자리, 표는 `migrations/0004_stats.sql`(`player_stats`, `live_rooms`)입니다. **배포하기 전에** `npx wrangler d1 migrations apply net --remote` 를 먼저 합니다. 클라이언트는 `Social` 의 `putStats`, `rankings`, `matches`, `watch` 와 방의 `report`, `watchers` 입니다 (`packages/net`).

### 기록과 랭킹

- `PUT /stats/:game` 🔑 `{level, xp, trophies}` → `{ok}`. 게임이 올리는 값입니다 (범위를 벗어나면 400 `bad-stats`, 1분에 30번을 넘으면 429). 서버가 확인할 수 없는 값이라 레벨과 트로피는 마음먹고 속이면 속일 수 있습니다.
- **온라인 승리**(`online_wins`)는 서버가 직접 셉니다. 랜덤 매칭이나 초대로 만든 방의 두 사람이 대전이 끝나면 `{ t: 'report', n, won }` 을 보내고(`n` 은 그 방의 몇 번째 대전), 둘이 같은 사람을 이겼다고 하면 그 사람에게 1을 더합니다. 서로 다르면 세지 않고, 한 사람만 보냈으면 방이 빌 때 셉니다. 한 번 정한 대전은 다시 보고해도 바뀌지 않습니다.
- `GET /rankings/:game?by=trophies|level|wins` 🔑 → `{ by, list: [{ rank, id, nickname, level, xp, trophies, wins }], me: { rank, ranks: { trophies, level, wins }, level, trophies, wins, top5 } }`. 다른 `by` 는 400 `bad-board`.
  - 50등까지. 트로피 많은 순, 레벨 높은 순(같으면 경험치), 온라인 승리 많은 순. 같은 기록이면 같은 등수입니다 (등수는 나보다 앞선 사람 수 + 1).
  - 정지된 계정은 빠집니다. 갓 만든 계정이 상을 받지 않게 트로피 1개, 온라인 승리 1번, 레벨 2부터 랭킹에 들어갑니다.
  - `me.ranks` 는 세 랭킹의 내 등수(그 랭킹에 들지 못하면 `null`). 하나라도 5등 안이면 `player_stats.top5_at` 에 그때를 적고 `me.top5` 가 참이 됩니다. 한 번 적으면 지우지 않아서 5등 밖으로 밀려나도 계속 참입니다 (게임이 5등 전용 스킨을 주는 근거).

### 관전

- `GET /matches/:game` 🔑 → `{ matches: [{ code, started, friend, players: [{ id, nickname, level }, { id, nickname, level }] }] }`. 지금 하는 대전(랜덤 매칭이나 초대로 만든 방에 두 사람이 다 들어와 있는 동안)을 최대 30개 보여 줍니다. 친구가 하는 대전이 먼저, 그다음 최근에 시작한 것부터. 내가 하는 대전, 나와 차단한 사이인 사람의 대전, 정지된 사람의 대전은 빠집니다. 방이 비면 목록에서 지우고, 방이 5분마다 소식을 적으며, 12분 넘게 소식이 없으면 뺍니다.
- `/rooms/:game/:code?ticket=…&watch=1` 로 들어가면 **보기만 하는 자리**입니다. 로그인한 사람만(아니면 401 `login-required`), 그 방의 두 사람이 아닐 때만(`not-watchable`), 한 방에 10명까지(`watch-full`, `max`). 관전하는 사람이 보내는 게임 메시지는 막고(`watch-only`. 관전 채팅과 응원만 받습니다, 아래), 두 사람이 주고받는 메시지(필드 모습, 터짐, 판 결과)는 그대로 전해 줍니다. 대전 채팅 글은 관전하는 사람에게 보내지 않습니다.
- 방에 사람이 보고 있으면 두 사람에게 `{ t: 'watchers', n }` 으로 인원 수를 알립니다.

#### 관전 채팅과 응원 (2026-10-08, 뿌요뿌요 타워 「업그레이드」 3번)

관전하는 사람은 두 가지만 보낼 수 있습니다. 그 밖의 메시지(게임 메시지 흉내, `to`, `report`)는 예전처럼 `watch-only` 로 막습니다.

| 관전자 → 서버 | 하는 일 |
|---|---|
| `{"t":"send","data":{"chat":"글"}}` | 관전 채팅. 두 사람의 채팅과 같은 거르개(욕설, 전화번호, 링크, 나눠 보낸 번호)를 거치고, 신고에 쓰려고 방 기록 50줄에 남깁니다. `chat` 말고 다른 칸은 버립니다 |
| `{"t":"send","data":{"t":"cheer","k":1,"to":"p2"}}` | 응원. `k` 는 0~15 정수(무슨 말인지는 게임이 정함), `to` 는 지금 방에 있는 사람의 자리. 아니면 `bad` |

- 서버는 두 사람과 다른 관전자에게 `{"t":"wmsg","from":"w1","user":{"id":7,"nickname":"닉네임"},"data":{...}}` 로 전합니다. 보낸 사람에게는 돌려보내지 않습니다.
- 게임 메시지(`msg`)와 봉투가 달라서 관전자가 방해 뿌요 같은 게임 메시지를 흉내 낼 수 없고, `wmsg` 를 모르는 예전 버전 게임은 그냥 버립니다.
- `user` 는 보낸 사람이 적은 것이 아니라 서버가 표(ticket)로 확인한 사용자 번호와 닉네임입니다.
- 채팅과 응원을 합쳐 1초에 1개, 몰아서 5개까지(`chat-rate`).
- 관전한 사람도 "그 방에 있었던 사람"으로 기억해서, 관전 채팅을 신고하거나(대전하는 사람, 다른 관전자) 신고당할 수 있습니다 (`POST /reports` 의 `context.kind: 'room'`).
- 두 사람끼리의 채팅(`data.chat`)은 여전히 관전하는 사람에게 보내지 않습니다.
- 클라이언트: 관전 방(`social.watch`)의 `room.chat(text)`, `room.cheer(peerId, k)`, 받는 쪽은 `watcherMessage(data, user, fromId)` 훅 (`packages/net/index.mjs`).
- D1 을 고치는 것(마이그레이션)은 없습니다. **서버만 다시 배포하면 됩니다.** 배포 전의 서버는 관전자가 보낸 것을 모두 `watch-only` 로 돌려보내고, 게임은 그때 "게임 서버가 새 버전으로 바뀌면 쓸 수 있어"라고만 안내합니다. 시험은 `test/stats.test.js` 의 "a viewer can chat and cheer".

## 관리 페이지

`https://net.seonn.workers.dev/admin` 에서 신고(서버가 모은 기록과 신고자가 보낸 기록)를 보고 계정을 정지하거나 풀고, 신고를 무시하고, 닉네임으로 사용자를 찾습니다. 정지하면 그 계정의 로그인과 아직 안 쓴 표가 모두 지워지고, `/live` 연결, 들어가 있는 방, 매칭 줄이 바로 끊기며, 로그인과 매칭, 표로 방 들어가기가 거부됩니다. 방과 매칭 줄을 찾으려고 `Lobby` 가 사람마다 하루 안에 들어간 방과 줄을 20곳까지 적어 둡니다(방, 매칭 줄에 표로 들어올 때 적음). 코드로 만든 공개 방에 표 없이 들어간 연결은 누구인지 모르므로 끊지 못합니다. 관리 동작은 `admin_actions` 표에 남습니다.

관리자 비밀번호 하나로 들어갑니다. 비밀번호는 코드나 `wrangler.jsonc` 에 적지 않고 Worker secret `ADMIN_PASSWORD` 로 둡니다(아래 "처음 한 번 배포하기" 5번). 비밀번호가 없거나 12글자보다 짧으면 `/admin` 아래는 모두 403 이고 "관리자 비밀번호가 설정되지 않았어요" 만 보입니다.

- 로그인이 맞으면 무작위 32바이트 토큰을 쿠키 `net_admin`(`HttpOnly; Secure; SameSite=Strict; Path=/admin`)으로 주고, 12시간 뒤 끝납니다. D1 `admin_sessions` 표에는 토큰의 SHA-256 만 저장합니다. "나가기" 를 누르면 지웁니다.
- 비밀번호를 바꾸면 예전 로그인은 모두 풀립니다(로그인마다 그때 비밀번호의 지문을 같이 저장해 두고 비교).
- 틀린 비밀번호는 IP 하나에서 10분에 5번, 모든 IP 합쳐 1시간에 20번까지입니다. 넘으면 맞는 비밀번호도 429 입니다. 맞으면 그 IP 의 기록을 지웁니다.
- 비밀번호는 양쪽을 SHA-256 으로 바꾼 뒤 끝까지 비교합니다(걸린 시간으로 짐작하지 못하게).
- 관리 API 와 로그인, 나가기는 같은 주소의 페이지에서만 부를 수 있습니다(Origin 검사, CORS 없음).
- 관리 동작 기록(`admin_actions`)에는 누가(`admin`)와 IP 가 남습니다.

## 비밀번호 저장

PBKDF2-SHA256, 사람마다 다른 16바이트 소금, 100,000번 반복(Workers WebCrypto 가 허용하는 최댓값). 비밀번호 원문과 로그인 토큰 원문은 저장하지 않습니다(토큰은 SHA-256 만). 2026-10-05 에 Apple M4 Pro 의 Node 26 WebCrypto 로 재 보니 한 번에 CPU 8.4ms 였습니다(10,000번 1.1ms, 50,000번 4.3ms). Cloudflare 서버의 실제 시간은 재 보지 못했습니다. 무료 요금제의 요청당 CPU 한도가 10ms 라서, 가입이나 로그인이 `Worker exceeded CPU time limit` 으로 실패하면 `wrangler.jsonc` 의 `vars` 에 `"PBKDF2_ITERATIONS": "50000"` 처럼 낮춥니다. 사람마다 쓴 횟수를 저장하므로 바꿔도 예전 계정은 그대로 로그인됩니다.

로그인 실패는 닉네임+IP 마다 10분에 10번, IP 하나에서 10분에 30번, 닉네임 하나에 (모든 IP 합쳐) 1시간에 30번까지, 가입은 IP 하나에서 1시간에 10번까지입니다(429 `rate`). 닉네임 한도 때문에 누군가 남의 닉네임으로 30번 틀리면 그 사람도 1시간 동안 로그인하지 못합니다(알고 정한 것). 횟수 제한은 비밀번호 계산 전에 시도를 먼저 `throttle` 표에 적고 세므로, 한꺼번에 몰려온 요청도 한도를 넘지 못합니다. 로그인이 맞으면 적은 시도를 지웁니다. 하루 지난 기록은 요청 100번에 한 번쯤 지웁니다.

## 로컬에서 돌리기

```bash
cd services/net
npm install
npm test          # 로컬 Workers 런타임에서 진짜 Worker, Durable Object, D1(migrations 적용)을 띄워 여러 명이 접속해 봄
npx wrangler d1 migrations apply net --local   # npm run dev 전에 한 번
npm run dev       # http://127.0.0.1:8787 에 서버가 뜬다
npm run check     # 배포 없이 빌드만 확인 (wrangler deploy --dry-run)
```

클라이언트 단위 테스트는 저장소 루트의 `npm test` 에 들어 있습니다(`packages/net/*.test.mjs`).

## 처음 한 번 배포하기 (부모님이 할 일)

1. https://dash.cloudflare.com/sign-up 에서 Cloudflare 계정을 만듭니다(무료 요금제로 충분).
2. 터미널에서 로그인합니다.
   ```bash
   cd services/net
   npm install
   npx wrangler login
   ```
3. D1 데이터베이스를 만들고 표를 만듭니다. `d1 create` 가 알려 주는 `database_id` 를 `wrangler.jsonc` 의 `d1_databases` 에 적습니다(지금은 0으로 채운 자리표시자).
   ```bash
   npx wrangler d1 create net
   npx wrangler d1 migrations apply net --remote
   ```
   나중에 `migrations/` 에 파일이 늘면 `migrations apply net --remote` 만 다시 합니다. 이미 배포한 뒤 게임 저장(`0002_saves.sql`)이나 관리자 로그인(`0003_admin_sessions.sql`), 랭킹과 관전(`0004_stats.sql`)을 더할 때도 배포 전에 이것만 하면 됩니다(적용 안 된 것만 적용).
   ```bash
   npx wrangler d1 migrations apply net --remote
   ```
4. 배포합니다. 끝나면 `https://net.<계정 서브도메인>.workers.dev` 주소가 나옵니다. 지금 계정의 서브도메인은 `seonn` 이라서 `https://net.seonn.workers.dev` 입니다. 이번 배포에서 Durable Object 마이그레이션 `v2`(`Lobby`, `Matchmaker`)가 같이 적용됩니다.
   ```bash
   npx wrangler deploy
   ```
5. 관리 페이지 비밀번호를 정합니다. 12글자 이상이어야 하고, 쉬운 낱말 3~4개를 이은 것(예: 서로 상관없는 낱말 넷을 `-` 로 이은 것)을 권합니다. 아래 명령을 치면 비밀번호를 묻습니다. 화면에 보이지 않고 Cloudflare 에만 저장됩니다.
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   ```
   그다음 https://net.seonn.workers.dev/admin 을 열어 비밀번호를 넣으면 신고 목록이 보입니다. 비밀번호를 정하기 전에는 "관리자 비밀번호가 설정되지 않았어요" 만 나옵니다.
   - 관리자 로그인 표(`0003_admin_sessions.sql`)가 필요하므로, 이미 배포한 서버라면 먼저 `npx wrangler d1 migrations apply net --remote` 를 한 번 합니다(적용 안 된 것만 적용).
   - 비밀번호를 바꿀 때도 같은 명령(`npx wrangler secret put ADMIN_PASSWORD`)을 다시 칩니다. 바꾸면 들어가 있던 곳은 모두 로그아웃됩니다.
   - 비밀번호를 잊으면 같은 명령으로 새로 정하면 됩니다.
6. 주소를 정합니다. 둘 중 하나를 고릅니다.
   - 방법 A, `net.seonn.dev` 쓰기: seonn.dev 의 DNS(네임서버)가 Cloudflare에 있어야 합니다. 지금 DNS가 다른 곳(도메인 산 곳, Vercel 등)에 있으면 Cloudflare 대시보드에서 "Add a site"로 seonn.dev 를 추가하고, 도메인 산 곳에서 네임서버를 Cloudflare가 알려 준 것으로 바꿉니다. 이때 Vercel로 가는 기존 레코드(A, CNAME)를 Cloudflare에 똑같이 옮겨야 사이트가 안 끊깁니다. 그다음 `wrangler.jsonc` 맨 아래 `routes` 줄의 주석을 풀고 `npx wrangler deploy` 를 다시 합니다.
   - 방법 B, DNS는 그대로 두고 workers.dev 주소 쓰기: 지금 쓰는 방법입니다. 기본값 `wss://net.seonn.workers.dev` 가 이 주소입니다. 나중에 방법 A로 옮기면 `packages/net/index.mjs` 의 `DEFAULT_SERVER` 한 줄만 `wss://net.seonn.dev` 로 바꿉니다.

## 무료 요금제 한도

2026-10-05 에 Cloudflare 문서(https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/workers/platform/limits/)에서 확인한 값입니다.

- Worker 요청: 하루 100,000 건 (UTC 자정에 초기화)
- Durable Object 요청: 하루 100,000 건. 받는 WebSocket 메시지는 20개를 1건으로 셉니다.
- Durable Object 실행 시간: 하루 13,000 GB-s
- SQLite 저장소: 읽기 하루 500만 행, 쓰기 하루 10만 행, 전체 5 GB
- 자동 핑 대답(`setWebSocketAutoResponse`)은 실행 시간 요금이 붙지 않습니다. 요청 건수에 들어가는지는 문서에 없어 확인 필요.
- Worker CPU 시간: 요청당 10ms. 가입과 로그인의 비밀번호 계산이 여기에 가깝습니다("비밀번호 저장").
- D1(무료): 하루 읽기 500만 행, 쓰기 10만 행, 5 GB. 1:1 대화 한 개가 쓰기 몇 행입니다. (D1 한도는 2026-10-05 에 문서를 다시 확인하지 못했음, 확인 필요)
- `Lobby` 는 30초마다, `Matchmaker` 는 줄에 사람이 있는 동안 15초마다 알람이 돕니다.

게임이 1초에 메시지를 많이 보낼수록(예: 위치를 1초에 20번) 요청 한도에 빨리 닿습니다. 꼭 필요한 것만 보내세요.
