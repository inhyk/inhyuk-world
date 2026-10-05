# inhyuk-world 작업 지침

seonn.dev 게임 허브입니다. 게임은 `games/<이름>/`, 아이폰 앱은 `apps/`, 사이트는 `src/` 에 있습니다.

## 멀티플레이

- 새로 만드는 멀티플레이(온라인 대전, 같이 하기) 게임은 `@inhyuk/net`(`packages/net/index.mjs`)을 씁니다. 예전 게임의 PeerJS `room.mjs` 를 복사하지 않습니다.
- 서버는 모든 게임이 같이 쓰는 `services/net`(Cloudflare Worker, `wss://net.seonn.workers.dev`) 하나입니다. 게임마다 서버를 새로 만들지 않습니다. 쓰는 법과 배포 방법은 `services/net/README.md`.
- 같이 할 사람은 두 가지로 찾습니다. 모르는 사람과는 랜덤 매칭(`social.findMatch(game)`, 먼저 기다린 사람과 바로), 아는 사람과는 친구 초대(`social.invite(friendId, game)`). 방 코드는 사람에게 보여 주지 않습니다. 결정 근거는 `requirements/matchmaking-chat-friends.md`.
- 계정은 서버의 닉네임+비밀번호입니다. 이메일은 받지 않고 비밀번호를 잊으면 되찾을 수 없습니다. 친구는 닉네임 검색이나 판이 끝난 뒤 "친구 요청"으로 맺고, 상대가 수락해야 합니다.
- 자유 채팅(대전 중 채팅, 친구 1:1 대화)은 서버 거르개를 거칠 때만 넣습니다. 대전 채팅은 반드시 `room.chat(text)`(`data.chat`)으로 보내고, 사람이 쓴 글을 다른 칸에 넣지 않습니다(거르지 않고 지나감). 채팅을 넣는 화면에는 차단과 신고 버튼을 같이 둡니다.
- 이름(닉네임 말고), 나이, 사진, 전화번호, 학교 같은 개인정보를 묻거나 메시지로 보내지 않습니다. 메시지 하나는 16KB 이하, 1초에 30개 이하로 보냅니다.
