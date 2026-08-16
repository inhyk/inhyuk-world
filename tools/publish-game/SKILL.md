---
name: publish-game
description: 인혁이가 만든 게임을 seonn.dev 포트폴리오 사이트에 올립니다. "게임 올려줘", "이거 사이트에 올려", "배포해줘", "seonn.dev에 올려", "publish game" 등의 요청 시 사용.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
---

# publish-game

게임 폴더 하나를 **GitHub 올리기 → Vercel 배포 → 화면 사진 찍기 → seonn.dev에 카드 등록**까지 한 번에 끝냅니다.

## 말투 규칙

사용자는 게임을 만드는 초등·중등학생(서인혁)입니다.

- 항상 한국어로, 짧고 쉬운 말로 이야기합니다
- 영어 에러 메시지를 그대로 보여주지 말고 무슨 뜻인지 풀어서 설명합니다
- 잘 됐으면 축하하고, 사이트 주소를 눌러볼 수 있게 보여줍니다

## 준비물 확인 (실패하면 여기서 멈추고 안내)

```bash
gh auth status 2>&1 | grep -c "account inhyk"   # 1 이상이어야 함
vercel whoami                                    # 인혁이 계정이어야 함
```

`inhyk` 계정이 없으면 이렇게 안내합니다:
> GitHub 로그인이 필요해. 터미널에 `gh auth login` 이라고 치고 인혁이 깃허브 계정으로 로그인해줘.

## 순서

### 1단계 — 어느 게임인지 정하기

인자로 폴더를 받았으면 그걸 쓰고, 없으면 현재 폴더를 씁니다.
현재 폴더가 게임 폴더가 아닌 것 같으면(`index.html`도 `package.json`도 없음)
`~/inhyuk/` 안의 폴더 목록을 보여주고 AskUserQuestion으로 고르게 합니다.

### 2단계 — game.json 준비

게임 폴더에 `game.json`이 있으면 그대로 씁니다. 없으면 **AskUserQuestion으로 한 번에 물어봐서** 만듭니다.
질문은 4개까지 한 번에 묶고, 보기(옵션)를 미리 만들어 고르기 쉽게 합니다.

물어볼 것:
- **제목** — 사이트 카드에 뜰 이름
- **한 줄 설명** — 카드 밑에 뜰 짧은 소개
- **종류(category)** — 플랫포머 / 액션 / 리듬 / 비주얼 노벨 / 시뮬레이션 / 슈팅 / 퍼즐 / 샌드박스 중에서
- **이모지** — 카드에 크게 뜰 그림문자

나머지는 자동으로 채웁니다.
- `slug` — 폴더 이름을 영어 소문자·하이픈으로 (한글 폴더면 제목을 영어로 옮겨서 제안하고 확인받기)
- `techStack` — `package.json` 의존성을 보고 추론 (three → Three.js, pixi.js → PixiJS, phaser → Phaser, vite → Vite, typescript → TypeScript)
- `createdAt` — 오늘 연-월 (`YYYY-MM`)
- `longDescription` — 폴더의 README.md가 있으면 참고해서 3~4문장으로 작성. 없으면 한 줄 설명을 늘려서 작성
- `featured` — 기본 `false`

`game.json` 예시:

```json
{
  "slug": "hotel-tycoon",
  "title": "La Pause",
  "description": "부티크 호텔을 짓고 키우는 3D 경영 게임",
  "longDescription": "...",
  "emoji": "🏨",
  "techStack": ["Three.js", "Vite", "JavaScript"],
  "category": "시뮬레이션",
  "createdAt": "2026-08",
  "featured": false
}
```

만든 뒤 게임 폴더에 저장하고, 인혁이에게 내용을 보여주며 "이렇게 올릴게, 괜찮아?" 하고 확인받습니다.

### 3단계 — 올리고 배포하기

```bash
node ~/inhyuk/inhyuk-world/tools/publish-game/scripts/publish.mjs "<게임폴더>"
```

이 스크립트가 빌드 → GitHub 저장소 만들기/올리기 → Vercel 배포까지 하고
`playUrl`을 `game.json`에 적어 넣습니다. 1~3분 걸립니다.

**실패했을 때**
- 빌드 실패 → 에러의 마지막 줄을 읽고 무슨 파일 몇 번째 줄이 문제인지 쉬운 말로 알려주고, 고칠지 물어봅니다
- Vercel 실패 → `vercel whoami` 확인, 프로젝트 이름 충돌이면 `slug`를 바꿔 다시
- GitHub 실패 → 같은 이름 저장소가 이미 있는지 확인

### 4단계 — 사이트에 등록하기

```bash
node ~/inhyuk/inhyuk-world/tools/publish-game/scripts/register.mjs "<게임폴더>"
```

화면 사진 3장을 자동으로 찍어 허브에 넣고, `games.json`에 카드를 추가한 뒤 사이트를 새로 배포합니다.

게임 폴더에 `screenshots/` 폴더가 있고 그 안에 png/jpg가 있으면 **자동 캡처 대신 그 사진들을 씁니다.**
자동으로 찍은 사진이 검은 화면이거나 시작 화면만 나왔으면 이렇게 안내합니다:
> 사진이 좀 아쉬운데, 직접 예쁜 장면을 찍어서 `<게임폴더>/screenshots/` 안에 넣고 다시 `/publish-game` 하면 그 사진으로 바꿔줄게.

### 5단계 — 확인하고 알려주기

Vercel 재배포에 1~2분 걸립니다. 기다렸다가 확인합니다.

```bash
sleep 90 && curl -s -o /dev/null -w "%{http_code}\n" https://seonn.dev/games/<slug>
```

200이면 이렇게 마무리합니다:

```
🎉 올라갔어!

  게임 페이지 : https://seonn.dev/games/<slug>
  바로 플레이 : <playUrl>
  소스 코드   : https://github.com/inhyk/<slug>
```

## 다시 올릴 때

같은 게임을 다시 `/publish-game` 하면 **새로 추가하지 않고 기존 카드를 갱신합니다.**
게임을 고친 뒤 다시 올릴 때 그냥 같은 명령을 쓰면 됩니다.

## 참고

- 설정은 `~/inhyuk/inhyuk-world/tools/config.json`
- 허브 사이트 소스는 `~/inhyuk/inhyuk-world` (없으면 자동으로 내려받음)
- 카드 데이터는 허브의 `src/data/games.json`
- Node 서버가 필요한 게임(멀티플레이 등)은 Vercel 정적 배포에서 일부 기능이 안 될 수 있음 — 미리 알려주기
