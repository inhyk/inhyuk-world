# net: 모든 게임이 같이 쓰는 멀티플레이 서버

seonn.dev 게임들이 같이 놀 때 쓰는 서버입니다. Cloudflare Worker 하나, Durable Object 세 종류(`Room`, `Lobby`, `Matchmaker`), D1 데이터베이스 `net` 으로 되어 있고, 주소는 `net.seonn.workers.dev` 입니다. 나중에 seonn.dev DNS를 Cloudflare로 옮기면 `net.seonn.dev` 로 바꿀 수 있습니다. 무엇을 왜 만들었는지는 [`requirements/matchmaking-chat-friends.md`](../../requirements/matchmaking-chat-friends.md).

- 방 하나 = Durable Object `Room` 하나 (`<게임 이름>:<방 코드>`). 다른 게임끼리는 코드가 같아도 다른 방입니다.
- 서버는 게임 내용을 모릅니다. 들어온 사람에게 번호(`p1`, `p2`, ...)를 주고, 들어오고 나간 걸 알리고, 게임이 보낸 JSON을 다른 사람에게 그대로 전합니다. 게임 데이터는 저장하지도, 로그로 남기지도 않습니다.
- 예외는 채팅 글(`data.chat`)입니다. 서버가 욕설, 전화번호, 링크, 메신저 아이디를 가려서 보내고, 신고에 쓰려고 방마다 거른 글 마지막 50줄을 기억합니다(모두 나간 뒤 10분까지).
- 계정(닉네임+비밀번호, 이메일 없음), 친구, 1:1 대화, 차단, 신고는 D1 에 저장합니다. 접속 상태와 알림은 `Lobby`(전체에 하나), 랜덤 매칭 줄은 `Matchmaker`(게임마다 하나)가 맡습니다.

예전 게임들(뿌요 타워, 프리 드라이브, 미네랄 밸리, 스노우플로우)은 아직 PeerJS 공용 서버를 씁니다. 이 PR은 서버와 클라이언트만 추가하고 게임은 바꾸지 않습니다.

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
- `join(id)`, `depart(id)`, `host(id)`, `error(code)` 훅도 있습니다. `room.peers`(나를 뺀 사람들), `room.id`, `room.host`, `room.maxPlayers`.
- `game` 은 영어 소문자, 숫자, `-` 로 32글자까지. `maxPlayers` 는 2~8(기본 2). 방 코드는 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` 중 6글자.
- 서버 주소는 `options.server` 로 바꿀 수 있습니다(기본 `wss://net.seonn.workers.dev`). 로컬에서는 `ws://127.0.0.1:8787`.

### 정해 둔 규칙

- 방장이 나가면 방은 없어지지 않고, 가장 먼저 들어온 사람이 새 방장이 됩니다(`host` 메시지). 모두 나가면 방이 지워지고 코드는 다시 쓸 수 있습니다.
- 방을 만들고 2분 안에 아무도 안 들어오면 지웁니다. 30초 동안 핑이 없는 사람은 내보냅니다(클라이언트가 4초마다 자동으로 핑을 보냅니다).
- 메시지 하나는 16KB까지. 한 연결은 1초에 평소 30개, 몰아서 60개까지 보낼 수 있고 넘치면 버립니다(`error` 훅에 `too-big`, `rate`).
- 접속은 `https://seonn.dev`, `https://www.seonn.dev`, 아이폰 앱(`capacitor://localhost`, `https://localhost`), `http://localhost`, `http://127.0.0.1` 에서만 됩니다. 목록은 `wrangler.jsonc` 의 `ALLOWED_ORIGINS`.

### 주고받는 메시지 (직접 구현할 때만 필요)

| 방향 | 메시지 |
|---|---|
| 방 만들기 | `POST /rooms/:game` 몸 `{"maxPlayers":4}` → `{"code":"ABC123","maxPlayers":4}` |
| 들어가기 | `GET /rooms/:game/:code` (WebSocket) |
| 서버 → 나 | `{"t":"welcome","id","host","max","peers":[...]}`, `{"t":"join","id"}`, `{"t":"leave","id"}`, `{"t":"host","id"}`, `{"t":"msg","from","data"}`, `{"t":"error","code"}`, `{"t":"pong"}` |
| 나 → 서버 | `{"t":"send","data"}`, `{"t":"send","to":"p2","data"}`, `{"t":"ping"}`, `{"t":"bye"}` |

거절될 때는 `{"t":"error","code":"not-found"}`(close 4404), `{"t":"error","code":"full","max":2}`(close 4403), `{"t":"error","code":"not-member"}`(close 4401, 랜덤 매칭이나 초대로 만든 방에 표 없이 들어올 때) 를 받고 연결이 닫힙니다.

### 대전 채팅

사람이 쓴 글은 반드시 `data.chat`(문자열)에 넣습니다. `room.chat('안녕')` 이 `send({ chat: '안녕' })` 과 같습니다. 같은 메시지의 다른 칸(`{ chat, emoji: 3 }` 의 `emoji`)과 채팅이 아닌 메시지는 손대지 않고 전합니다. 그래서 게임은 사람이 쓴 글을 다른 칸에 넣으면 안 됩니다(거르지 않고 지나갑니다).

- 200글자까지 자르고, 1초에 1줄(몰아서 5줄)까지. 넘치면 `error` 훅에 `chat-rate`. `chat` 이 문자열이 아니면 `bad`.
- 거르는 것: 욕설(`src/badwords.js` 목록, 띄어쓰기, 숫자, 기호, 자음만 쓰기, 보이지 않는 글자로 피하는 것 포함), 전화번호(010-1234-5678, 띄어 쓴 숫자, +82, "공일공 일이삼사" 같은 한글 숫자), 링크(`http`, `www`, `naver.com`, "닷컴"), 이메일, 메신저 아이디("카톡 아이디 abc", `@abc`, `name#1234`). 가린 글자는 `*` 가 됩니다.
- 목록을 고칠 때는 `src/badwords.js` 를 고치고 `test/filter.test.js` 에 예를 더합니다. 평범한 말이 걸리면 `ALLOWED` 에 넣습니다.

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
- 닉네임은 2~10글자 한글, 영어, 숫자, `_`. 영어 대소문자를 가리지 않고 전체에서 하나뿐이고, 욕이 들어가면 안 됩니다. 비밀번호는 4~16글자. 이메일은 받지 않고, 비밀번호를 잊으면 되찾을 수 없습니다.
- 방 코드는 사람에게 보여 주지 않습니다. 매칭이나 초대로 만든 방은 그 두 사람만(한 번짜리 표로) 들어갈 수 있습니다.

### HTTP API

로그인이 필요한 곳(🔑)은 `Authorization: Bearer <token>` 을 붙입니다. 모든 곳이 `ALLOWED_ORIGINS` 의 주소에서만 됩니다. 오류는 `{ "error": "코드" }`.

| 방법 | 길 | 🔑 | 보내는 것 | 받는 것 |
|---|---|---|---|---|
| POST | `/auth/signup` | | `{nickname, password}` | 201 `{token, user:{id,nickname}}`. 409 `nickname-taken`, 400 `bad-nickname`/`bad-nickname-word`/`bad-password`, 429 |
| POST | `/auth/login` | | `{nickname, password}` | `{token, user}`. 401 `wrong-login`, 403 `{error:'suspended', reason}`, 429 `rate` |
| POST | `/auth/logout` | 🔑 | | `{ok}` (이 기기 토큰만 지움) |
| POST | `/auth/ticket` | 🔑 | | `{ticket, expires}` WebSocket 용 한 번짜리 표 (60초) |
| GET | `/me` | 🔑 | | `{user:{id,nickname,created}}` |
| GET | `/users/search?q=` | 🔑 | | `{users:[{id,nickname,friend,requested,requestedMe}]}` 앞부분이 같은 20명. 나, 차단한 사람, 나를 차단한 사람, 정지된 사람은 빠짐 |
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
| POST | `/dm/:id` | 🔑 | `{body}` | 201 `{message, filtered:[...]}`. 친구에게만(403 `not-friends`/`blocked`), 300글자(400 `too-long`), 1분에 20개(429) |
| POST | `/dm/:id/read` | 🔑 | | `{ok, count}` |
| POST | `/invites` | 🔑 | `{to, game}` | 201 `{invite:{id,to,game,expires}}`. 접속 중인 친구만(409 `offline`), 60초 |
| POST | `/invites/:id/accept` | 🔑 | | `{code, game, opponent}` (둘 다 `/live` 로 `room` 알림도 받음). 404, 409 `expired`/`offline` |
| POST | `/invites/:id/decline` | 🔑 | | `{ok}` |
| DELETE | `/invites/:id` | 🔑 | | `{ok}` 보낸 사람이 취소 |
| POST | `/reports` | 🔑 | `{target, context:{kind:'dm'|'room'|'profile', game, room}, reason, messages}` | 201 `{id}`. 1시간에 10번 |

신고 증거는 서버가 직접 모읍니다. `dm` 은 두 사람 사이 마지막 50개, `room` 은 그 방이 기억하는 거른 채팅 50줄(신고한 사람이 그 방에 있었을 때만). 신고한 사람이 보낸 `messages` 는 따로 저장합니다.

### WebSocket

브라우저 WebSocket 에는 머리글을 붙일 수 없어서, `POST /auth/ticket` 으로 받은 한 번짜리 표를 주소에 붙입니다(`?ticket=`). 토큰 자체는 주소에 넣지 않습니다(로그에 남지 않게). 클라이언트 라이브러리가 알아서 합니다.

| 길 | 하는 일 | 서버 → 나 |
|---|---|---|
| `/live?ticket=` | 접속 상태와 알림. 25초마다 `{"t":"ping"}` | `hello {user, online:[친구 번호], invites:[...]}`, `online {id}`, `offline {id}`, `friend-request {from}`, `friend-accepted {friend}`, `friend-removed {id}`, `dm {message, from}`, `invite {invite}`, `invite-declined {invite, by}`, `invite-canceled {invite}`, `room {via:'invite', invite, code, game, opponent}`, `match {code, game, opponent}`, `kicked {reason}` (정지, close 4403) |
| `/match/:game?ticket=` | 랜덤 매칭 줄. 10초마다 핑, `{"t":"cancel"}` 로 빠짐 | `queued`, `matched {code, game, opponent:{id,nickname}}` 뒤 닫힘, `canceled`, `replaced`(다른 기기에서 또 줄 섬), `error {code}` |
| `/rooms/:game/:code?ticket=` | 방 (위 "주고받는 메시지"). 표는 매칭, 초대 방에서만 필요 | |

랜덤 매칭은 먼저 기다린 사람부터 봅니다. 서로 차단한 사이, 정지된 사람, 30초 넘게 소식 없는 사람은 건너뜁니다. 연결이 끊기면 줄에서 빠집니다.

## 관리 페이지

`https://net.seonn.workers.dev/admin` 에서 신고(서버가 모은 기록과 신고자가 보낸 기록)를 보고 계정을 정지하거나 풀고, 신고를 무시하고, 닉네임으로 사용자를 찾습니다. 정지하면 그 계정의 로그인이 모두 풀리고 `/live` 연결이 끊기며, 로그인과 매칭이 거부됩니다. 관리 동작은 `admin_actions` 표에 남습니다.

Cloudflare Access 가 이메일 일회용 코드로 막고, 서버도 Access 가 붙여 주는 `Cf-Access-Jwt-Assertion` JWT 를 다시 검사합니다(RS256 서명, `aud`, `iss`, 만료, `ADMIN_EMAILS`). `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` 중 하나라도 비어 있으면 관리 페이지는 항상 403 입니다. 관리 API 는 같은 주소의 페이지에서만 부를 수 있습니다(CORS 없음).

## 비밀번호 저장

PBKDF2-SHA256, 사람마다 다른 16바이트 소금, 100,000번 반복(Workers WebCrypto 가 허용하는 최댓값). 비밀번호 원문과 로그인 토큰 원문은 저장하지 않습니다(토큰은 SHA-256 만). 2026-10-05 에 Apple M4 Pro 의 Node 26 WebCrypto 로 재 보니 한 번에 CPU 8.4ms 였습니다(10,000번 1.1ms, 50,000번 4.3ms). Cloudflare 서버의 실제 시간은 재 보지 못했습니다. 무료 요금제의 요청당 CPU 한도가 10ms 라서, 가입이나 로그인이 `Worker exceeded CPU time limit` 으로 실패하면 `wrangler.jsonc` 의 `vars` 에 `"PBKDF2_ITERATIONS": "50000"` 처럼 낮춥니다. 사람마다 쓴 횟수를 저장하므로 바꿔도 예전 계정은 그대로 로그인됩니다.

로그인 실패는 닉네임+IP 마다 10분에 10번, IP 하나에서 10분에 30번까지, 가입은 IP 하나에서 1시간에 10번까지입니다(429 `rate`).

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
   나중에 `migrations/` 에 파일이 늘면 `migrations apply net --remote` 만 다시 합니다.
4. 배포합니다. 끝나면 `https://net.<계정 서브도메인>.workers.dev` 주소가 나옵니다. 지금 계정의 서브도메인은 `seonn` 이라서 `https://net.seonn.workers.dev` 입니다. 이번 배포에서 Durable Object 마이그레이션 `v2`(`Lobby`, `Matchmaker`)가 같이 적용됩니다.
   ```bash
   npx wrangler deploy
   ```
5. 관리 페이지를 Cloudflare Access 로 막습니다.
   1. 대시보드 Zero Trust 에 처음 들어가면 팀 이름을 정합니다(예: `seonn` → 팀 도메인 `seonn.cloudflareaccess.com`).
   2. Zero Trust → Settings → Authentication → Login methods 에 One-time PIN 이 있는지 봅니다(기본으로 켜져 있음).
   3. Zero Trust → Access → Applications → Add an application → Self-hosted. 이름 `net admin`, 주소는 domain `net.seonn.workers.dev`, path `admin*` (그러면 `/admin` 과 `/admin/api/...` 가 모두 막힘). workers.dev 주소를 도메인으로 고를 수 없으면(확인 필요), 아래 6번 방법 A로 `net.seonn.dev` 를 붙이고 그 주소로 만듭니다. Workers 설정의 workers.dev "Cloudflare Access" 스위치는 Worker 전체를 막아 게임이 못 들어오므로 쓰지 않습니다. Access 를 거치지 않은 주소로 `/admin` 을 열면 JWT 가 없어서 403 입니다.
   4. Policy: Action `Allow`, Include → Emails → `kubony@gmail.com`. 로그인 방법은 One-time PIN.
   5. 저장한 애플리케이션의 Overview 에서 Application Audience (AUD) Tag 를 복사합니다.
   6. `wrangler.jsonc` 의 `vars` 에 `ACCESS_TEAM_DOMAIN`(예 `seonn.cloudflareaccess.com`)과 `ACCESS_AUD` 를 적고 `npx wrangler deploy` 를 다시 합니다. `ADMIN_EMAILS` 는 이미 `kubony@gmail.com` 입니다(쉼표로 여럿).
   7. https://net.seonn.workers.dev/admin 을 열면 이메일 코드를 묻고, 들어가면 신고 목록이 보입니다. 둘 중 하나라도 비어 있으면 403 만 나옵니다.
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
