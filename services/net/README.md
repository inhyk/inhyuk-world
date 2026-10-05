# net: 모든 게임이 같이 쓰는 멀티플레이 서버

seonn.dev 게임들이 친구와 같이 놀 때 쓰는 중계 서버입니다. Cloudflare Worker 하나와 Durable Object `Room`으로 되어 있고, 주소는 `net.seonn.workers.dev` 입니다. 나중에 seonn.dev DNS를 Cloudflare로 옮기면 `net.seonn.dev` 로 바꿀 수 있습니다.

- 방 하나 = Durable Object 하나 (`<게임 이름>:<방 코드>`). 다른 게임끼리는 코드가 같아도 다른 방입니다.
- 서버는 게임 내용을 모릅니다. 들어온 사람에게 번호(`p1`, `p2`, ...)를 주고, 들어오고 나간 걸 알리고, 게임이 보낸 JSON을 다른 사람에게 그대로 전합니다.
- 메시지 내용은 저장하지도, 로그로 남기지도 않습니다. 이름, 채팅 같은 개인정보 기능도 없습니다.

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

거절될 때는 `{"t":"error","code":"not-found"}`(close 4404) 또는 `{"t":"error","code":"full","max":2}`(close 4403) 를 받고 연결이 닫힙니다.

## 로컬에서 돌리기

```bash
cd services/net
npm install
npm test          # 로컬 Workers 런타임에서 진짜 Worker와 방을 띄워 여러 명이 접속해 봄
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
3. 배포합니다. 끝나면 `https://net.<계정 서브도메인>.workers.dev` 주소가 나옵니다. 지금 계정의 서브도메인은 `seonn` 이라서 `https://net.seonn.workers.dev` 입니다.
   ```bash
   npx wrangler deploy
   ```
4. 주소를 정합니다. 둘 중 하나를 고릅니다.
   - 방법 A, `net.seonn.dev` 쓰기: seonn.dev 의 DNS(네임서버)가 Cloudflare에 있어야 합니다. 지금 DNS가 다른 곳(도메인 산 곳, Vercel 등)에 있으면 Cloudflare 대시보드에서 "Add a site"로 seonn.dev 를 추가하고, 도메인 산 곳에서 네임서버를 Cloudflare가 알려 준 것으로 바꿉니다. 이때 Vercel로 가는 기존 레코드(A, CNAME)를 Cloudflare에 똑같이 옮겨야 사이트가 안 끊깁니다. 그다음 `wrangler.jsonc` 맨 아래 `routes` 줄의 주석을 풀고 `npx wrangler deploy` 를 다시 합니다.
   - 방법 B, DNS는 그대로 두고 workers.dev 주소 쓰기: 지금 쓰는 방법입니다. 기본값 `wss://net.seonn.workers.dev` 가 이 주소입니다. 나중에 방법 A로 옮기면 `packages/net/index.mjs` 의 `DEFAULT_SERVER` 한 줄만 `wss://net.seonn.dev` 로 바꿉니다.

## 무료 요금제 한도

2026-10-05 에 Cloudflare 문서(https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/workers/platform/limits/)에서 확인한 값입니다.

- Worker 요청: 하루 100,000 건 (UTC 자정에 초기화)
- Durable Object 요청: 하루 100,000 건. 받는 WebSocket 메시지는 20개를 1건으로 셉니다.
- Durable Object 실행 시간: 하루 13,000 GB-s
- SQLite 저장소: 읽기 하루 500만 행, 쓰기 하루 10만 행, 전체 5 GB
- 자동 핑 대답(`setWebSocketAutoResponse`)은 실행 시간 요금이 붙지 않습니다. 요청 건수에 들어가는지는 문서에 없어 확인 필요.

게임이 1초에 메시지를 많이 보낼수록(예: 위치를 1초에 20번) 요청 한도에 빨리 닿습니다. 꼭 필요한 것만 보내세요.
