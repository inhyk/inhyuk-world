# 게임 발행 도구 (publish-game)

인혁이가 만든 게임을 **seonn.dev**에 올리는 도구입니다.

## 게임 올리는 법

게임 폴더에서 Claude Code를 켜고 이렇게만 치면 됩니다.

```
/publish-game
```

그러면 이 순서로 알아서 다 해줍니다.

1. 게임 정보(제목, 설명, 이모지)를 물어보고 `game.json`을 만듭니다
2. 게임을 빌드해서 잘 돌아가는지 확인합니다
3. GitHub에 올립니다
4. Vercel에 배포해서 인터넷 주소를 만듭니다
5. 게임 화면 사진을 3장 찍습니다
6. seonn.dev에 카드로 등록합니다

다 되면 이렇게 알려줍니다.

```
🎉 올라갔어!
  게임 페이지 : https://seonn.dev/games/hotel-tycoon
  바로 플레이 : https://hotel-tycoon.vercel.app
```

## 게임을 고쳐서 다시 올릴 때

똑같이 `/publish-game` 하면 됩니다. 새로 추가되는 게 아니라 **원래 카드가 바뀝니다.**

## 사진이 마음에 안 들 때

자동으로 찍은 사진이 시작 화면만 나오거나 까맣게 나올 수 있습니다.
그럴 땐 직접 예쁜 장면을 찍어서 게임 폴더 안에 `screenshots` 폴더를 만들고 넣어주세요.

```
내-게임/
├── screenshots/
│   ├── 1.png
│   ├── 2.png
│   └── 3.png
└── game.json
```

그리고 다시 `/publish-game` 하면 직접 찍은 사진으로 바뀝니다.

## 처음 한 번만 하는 설치

```bash
cd ~/inhyuk/inhyuk-world/tools
./install.sh
```

GitHub 로그인도 한 번 필요합니다.

```bash
gh auth login    # 인혁이 GitHub 계정(inhyk)으로 로그인
```

## GitHub 계정이 두 개인 것에 대해

이 맥에는 GitHub 계정이 두 개 로그인돼 있습니다 (`inhyk`, `kubony`).
게임을 올릴 때는 반드시 `inhyk` 여야 해서, 스킬이 실행될 때 **자동으로 `inhyk`로 바꿉니다.**
바꾼 뒤에는 그대로 두니, 다른 계정으로 돌아가려면 이렇게 하면 됩니다.

```bash
gh auth switch --user kubony
```

커밋에 찍히는 이름도 게임 저장소마다 `inhyk`로 따로 설정됩니다 (전역 설정은 건드리지 않음).

## 구조

이 도구는 **사이트 레포(`inhyuk-world`) 안에** 같이 삽니다.
카드 데이터(`src/data/games.json`)와 그걸 읽는 사이트 코드가 한 레포에 있어야
한쪽만 고쳐서 사이트가 깨지는 일이 안 생기기 때문입니다.

- `tools/publish-game/` — `/publish-game` 스킬 본체. `install.sh`가 `~/.claude/skills/`로 링크합니다
  - `SKILL.md` — Claude가 따르는 순서
  - `scripts/detect.mjs` — 게임 종류 알아내기 (Vite / 정적 HTML / Node 서버)
  - `scripts/publish.mjs` — 빌드 → GitHub → Vercel
  - `scripts/screenshot.mjs` — 화면 사진 찍기 (Playwright + 크롬)
  - `scripts/register.mjs` — seonn.dev에 카드 등록
- `tools/backfill.mjs` — 예전에 만든 게임들을 한꺼번에 등록한 1회성 스크립트
- `tools/config.json` — 계정·경로 설정
- `tools/package.json` — playwright. **사이트 빌드와는 분리돼 있어서** Vercel은 이 파일을 보지 않습니다
- `tools/requirements/publish-game.md` — 왜 이렇게 만들었는지 정리한 문서

## 사이트 구조

- 허브(포트폴리오 사이트): `github.com/inhyk/inhyuk-world` → Vercel → seonn.dev
- 게임: 게임마다 독립 GitHub 저장소 + 독립 Vercel 프로젝트
- 이어주는 것: 허브의 `src/data/games.json`

게임 목록은 `games.json` 하나만 고치면 사이트가 바뀝니다.
