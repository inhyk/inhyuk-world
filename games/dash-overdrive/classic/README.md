# DASH / OVERDRIVE · CLASSIC

`/play/dash-overdrive/classic` (Next.js) 또는 `/play/dash-overdrive/classic/index.html`에서 실행합니다.

## 게임

- 시작 화면은 인혁이가 손으로 그린 설계대로 SKINS, PLAY, CREATE 세 버튼이고, 뒤에서 모든 스킨의 큐브가 지나갑니다.
- 1~15단계는 모두 새로 만든 맵입니다. 큐브 점프, 점프 패드, 점프 링, 비행선, 중력 뒤집기가 나오고 뒤로 갈수록 어려워집니다. 노래가 신나지는 부분에서 비행선이, 조용해지는 부분에서 중력 뒤집기가 나옵니다.
- 단계마다 코인이 3개 있고, 단계를 끝까지 깨야 저장됩니다. 코인을 10개, 20개, 30개 모으면 비밀 단계 16 Golden Key, 17 Secret Core, 18 Last Dash가 하나씩 열립니다.
- 비행선에서 큐브로 돌아가는 포털은 위아래가 블록으로 막혀 있고, 큐브는 포털 높이의 블록 발판에 내립니다. 비행선과 중력 구간이 끝나면 천장이 위로 밀려 올라갑니다.
- 스킨 12가지 중 하나를 고르면 이 브라우저에 저장됩니다. 단계별 최고 기록도 저장됩니다.
- CREATE(맵 만들기)에서 블록, 반 블록, 가시, 작은 가시, 점프 패드, 점프 링, 포털을 놓고 노래와 색을 고른 뒤 바로 해 볼 수 있습니다. 만든 맵은 이 브라우저에 저장됩니다.
- Space / 클릭 / 터치로 점프하고, 비행선은 누르고 있으면 올라갑니다. Esc로 일시정지하고, 연습 모드에서는 Z로 체크포인트를 놓고 X로 지웁니다.

## 폴더

- `engine/`: 게임 엔진(C++, SDL2). Vincent Li의 [Bad-GD-Clone](https://github.com/VinkentLi/Bad-GD-Clone)(MIT)을 고쳐서 씁니다. 충돌 판정, 비행선과 중력 구간의 바닥과 천장, 시작 화면, 스킨 화면, 노래 내려받기, 기록 저장, 맵 검사용 함수를 바꾸거나 더했습니다.
- `res/`: 엔진에 들어가는 그림(`gfx`), 효과음(`sfx`), 맵(`leveldata`), 글꼴(`fonts`). 모두 아래 스크립트로 만듭니다.
- `art/art.mjs`: 그림을 SVG로 그려서 PNG로 만듭니다.
- `music/music.mjs`: 노래와 효과음을 코드로 합성합니다. 단계 노래는 `public/play/dash-overdrive/classic/music/`에 저장되고, 단계를 시작할 때 내려받습니다.
- `levels/generate.mjs`: 18단계 맵(비밀 단계 3개 포함)과 코인 자리를 만듭니다. `levels/physics.mjs`는 엔진의 움직임과 충돌 코드를 그대로 옮긴 것이라, 맵을 만들 때 모든 점프 시점을 실제로 해 보고 충분히 여유가 있는 장애물만 남깁니다. 비행선 구간은 늦게 반응하거나 조금 빗나가게 조종해도 통과해야 남습니다.
- `levels/verify.mjs`: 만든 맵을 처음부터 끝까지 60, 90, 120, 144Hz 화면 시간으로 다시 깨 보고, 코인 3개를 모두 먹는지 확인합니다. `--engine`을 붙이면 빌드한 WebAssembly 엔진에서도 확인합니다.
- `build.sh`: emsdk로 엔진을 빌드해 `public/play/dash-overdrive/classic/engine/`에 넣습니다.

## 다시 만드는 순서

```bash
node games/dash-overdrive/classic/art/art.mjs
node games/dash-overdrive/classic/music/music.mjs
node games/dash-overdrive/classic/levels/generate.mjs
games/dash-overdrive/classic/build.sh
node games/dash-overdrive/classic/levels/verify.mjs --engine
```

## 출처

- 엔진: Bad-GD-Clone, MIT License, Copyright 2023 Vincent Li. 라이선스 전문은 `engine/LICENSE`와 배포 폴더의 `engine/LICENSE.txt`에 있습니다.
- 글꼴: Lilita One, SIL Open Font License 1.1 (`res/fonts/OFL.txt`).
- 맵, 그림, 노래, 효과음은 이 저장소의 스크립트로 새로 만들었습니다. 다른 게임의 맵, 그림, 음악 파일은 넣지 않습니다.
