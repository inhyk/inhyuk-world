# inhyuk-world 작업 지침

seonn.dev 게임 허브입니다. 게임은 `games/<이름>/`, 아이폰과 안드로이드 앱은 `apps/`, 사이트는 `src/` 에 있습니다. 게임을 만드는 사람은 초등, 중등학생(인혁)이니, 인혁이에게는 한국어로 짧고 쉽게 말하고 영어 에러는 뜻을 풀어서 알려 줍니다.

## 멀티플레이: 공용 서버 하나를 모든 게임이 같이 씁니다

- 서버: `services/net` (Cloudflare Worker, 주소 `https://net.seonn.workers.dev`, WebSocket `wss://net.seonn.workers.dev`). 게임마다 서버를 새로 만들지 않습니다.
- 게임 쪽 코드: `packages/net/index.mjs`(`Room`, 방)와 `packages/net/social.mjs`(`Account`, `Social`, 계정과 친구와 매칭과 저장). 쓰는 법은 `services/net/README.md` 의 "게임에서 쓰는 법", "계정과 친구", "게임 저장".
- PeerJS 로 새 온라인 기능을 만들지 않습니다. 예전 게임의 `room.mjs` 를 복사하지 않습니다.
- 잘 만든 예: 젤리 타워 `games/puyo-puyo/` (`online.mjs` 방과 매칭, `net.mjs` 서버 주소 바꾸기, `cloud.mjs` 클라우드 저장, `social-ui.mjs` 친구 화면).

### 새 멀티플레이 게임을 만들 때 고르는 법

| 원하는 것 | 쓰는 것 | 로그인 필요 |
|---|---|---|
| 옆에 있는 친구와 방 코드로 같이 하기 | `new Room(hooks, { game, maxPlayers })` → `room.open()` / `room.open(code)` | 아니요 |
| 모르는 사람과 바로 붙기 (게임 찾기) | `social.findMatch(game)` | 예 |
| 친구 목록에서 초대하기 | `social.invite(friendId, game)` | 예 |
| 다른 기기에서 이어 하기 (클라우드 저장) | `account.loadSave(game)`, `account.putSave(game, data, baseRevision)` | 예 |

- `game` 이름은 영어 소문자, 숫자, `-` 로 짓습니다(예 `free-drive`). 게임마다 하나씩 정해 두고 바꾸지 않습니다.
- 계정은 닉네임+비밀번호이고 모든 게임이 같은 계정을 씁니다. 이메일은 받지 않고, 비밀번호를 잊으면 되찾을 수 없습니다.
- 매칭이나 초대로 만든 방에서는 상대 이름을 상대가 보낸 글이 아니라 서버가 준 `opponent.nickname` 으로 보여 줍니다.

### 꼭 지킬 규칙

- 한 연결은 1초에 메시지 30개까지, 메시지 하나는 16KB까지입니다. 넘치면 서버가 버립니다. 위치처럼 계속 바뀌는 것은 1초에 10~20번 정도로 묶어서 보내고, 부딪힘이나 판 끝 같은 한 번뿐인 일은 따로 보내 빠지지 않게 합니다.
- 사람이 쓴 채팅은 반드시 `room.chat(text)` 로 보냅니다(서버가 욕설, 전화번호, 링크를 가림). 사람이 쓴 글을 다른 칸에 넣지 않습니다. 채팅이 있는 화면에는 차단과 신고 버튼을 같이 둡니다.
- 이름(닉네임 말고), 나이, 사진, 전화번호, 학교 같은 개인정보를 묻거나 보내지 않습니다.
- 매칭, 초대 방에서는 글자열 속 숫자 8개 이상을 전화번호로 보고 가립니다. 게임 데이터의 숫자는 숫자나 숫자 배열로 보냅니다.
- 클라우드 저장은 32KB까지이고, 항상 `baseRevision` 을 같이 보냅니다. 다른 기기가 먼저 저장했으면 충돌(409)이 오니 어느 기록을 쓸지 사람에게 고르게 하고, 코인을 큰 쪽으로 고르는 식으로 몰래 합치지 않습니다.

### 시험해 보기 (내 컴퓨터에서)

```bash
# 1) 로컬 서버 (빈 DB로 새로 띄움)
cd services/net && npm ci
ST=$(mktemp -d) && CI=1 npx wrangler d1 migrations apply net --local --persist-to $ST && CI=1 npx wrangler dev --port 8787 --ip 127.0.0.1 --persist-to $ST
# 2) 게임 개발 서버를 띄우고, 게임 주소 뒤에 ?net=http://127.0.0.1:8787 을 붙이면 로컬 서버를 씁니다 (젤리 타워 net.mjs 방식)
# 3) 서버 테스트
cd services/net && npx vitest run
# 4) 전체 테스트
npm test
```

- 같은 로컬 서버에서 가입은 IP 하나당 1시간에 10번까지라, 시험을 여러 번 하면 막힐 수 있습니다. 그때는 1)을 새로 띄웁니다.
- 방 코드만 쓰는 시험은 진짜 서버(`https://net.seonn.workers.dev`)에서 해도 됩니다(아무것도 저장하지 않음). 계정을 만드는 시험은 진짜 서버에서 하지 않습니다.

### 에이전트가 하지 않는 일 (부모님께 부탁)

- 서버 배포(`npx wrangler deploy`), 진짜 DB 고치기(`wrangler d1 ... --remote`), 비밀값(`wrangler secret put`)은 Cloudflare 계정(부모님) 로그인이 있어야 하고, 모든 게임과 사용자에게 바로 영향을 줍니다. 에이전트가 직접 하지 않고 "서버를 다시 배포해 주세요"라고 부모님께 알립니다. 배포 순서는 `services/net/README.md` 의 "처음 한 번 배포하기".
- `services/net` 를 고쳤으면 테스트(`npx vitest run`)를 통과시키고, 배포가 필요하다는 것을 커밋과 PR 설명에 적습니다. 서버가 배포되기 전에는 게임이 새 서버 기능에 기대지 않게 합니다.
- 관리 페이지(`https://net.seonn.workers.dev/admin`, 신고 확인과 계정 정지)의 비밀번호는 부모님만 압니다. 에이전트는 비밀번호를 묻거나 파일에 적지 않습니다.
- 젤리 타워의 예전 친구 우체통(`/api/jelly-mail`, `src/lib/jelly-mail/`)은 예전 버전 앱이 쓰므로 지우거나 바꾸지 않습니다.

### 게임별 지금 상태

| 게임 | 온라인 방식 |
|---|---|
| 젤리 타워 `puyo-puyo` | 온라인 계정: 게임 찾기, 친구, 채팅, 클라우드 저장. 기기 계정: 예전 친구 코드와 PeerJS 방 코드 |
| Free Drive `free-drive` | 공용 서버 방 코드(`Room`, 2명). 계정, 게임 찾기, 채팅 없음 |
| 미네랄 밸리 `mineral-valley` | 공용 서버 방 코드(`Room`, 2명). 계정, 게임 찾기, 채팅 없음 |
| SNOWFLOW `snowflow` | 공용 서버 방 코드(`Room`, 4명까지). 계정, 게임 찾기, 채팅 없음. 플레이어가 쓴 이름(10글자)이 친구끼리 오감 |

방 코드로 옮긴 게임에 게임 찾기나 친구 초대를 더하려면 위 표의 `Social` 을 쓰고, 젤리 타워의 `online.mjs` 와 `social-ui.mjs` 를 보고 만듭니다. 결정 근거는 `requirements/matchmaking-chat-friends.md`.
