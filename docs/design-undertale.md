# UNDERTALE 팬 게임 — 작은 기억들

시각적 방향은 오래된 지하 세계에 남은 온기다. 검정과 흰색을 중심으로 한 전투의 가독성을 유지하고, 탐험에서는 지역별 색과 생활의 흔적을 더했다.

## 적용한 디테일

- 폐허의 덩굴·낙엽·빛줄기, 토리엘의 창문·벽난로·침대·러그, 설원의 눈·나무·가게·불빛, 폭포의 물줄기·광물·메아리 꽃, 연구소의 모니터와 용암, 성의 창문과 기둥을 직접 그린 Canvas 픽셀 아트로 구성했다.
- 22개 소품에 처음 조사할 때와 다시 방문할 때의 대사를 썼다. 토리엘과 관련된 소품 및 심판의 회랑은 플레이어의 선택에도 반응한다. 최초의 기억은 수첩에 보존하고, 이후의 조사는 현재 상황을 반영한다.
- `C → 탐험 수첩`에서 좌우로 기억을 넘긴다. 수첩은 기존 세이브에 포함되며 별에서 저장한다. 이전 버전 세이브는 빈 수첩으로 호환한다.
- 발자국은 실제 이동 거리에 따라 생기며 시간 경과와 방 이동으로 지워진다. 시각 효과용 난수는 전투·인카운터 난수와 분리한다.
- 대화 초상화, 말하는 동안의 작은 움직임, 캐릭터마다 다른 합성 말소리와 지면별 발소리를 추가했다.
- 전투에는 영혼 잔상, 적의 소멸 및 자비 연출, 피해 수치와 체력 감소 연출, 타이밍 표시, 무피격 메시지를 넣었다. 높은 레벨에서도 HP 표시가 화면을 넘지 않는다.
- 도움말은 게임 전체와 소리를 잠시 멈춘다. 닫을 때는 이전 전투 정지 상태와 키보드 초점을 복원한다. 전투에서 `C`로 잠시 쉬고, `C`, `X`, `ESC`로 계속할 수 있다.
- 터치 화면에서 이름 입력을 완료할 수 있고, 손가락이 버튼을 벗어나도 입력 해제를 추적한다. 시스템의 동작 줄이기 설정에서는 장식 애니메이션과 잔상을 정지한다.

## 파일

- `public/play/undertale/scenery.mjs`: 지역 아트, 소품, 빛, 입자, 타이틀 배경
- `public/play/undertale/details.mjs`: 환경 이야기와 수첩
- `world.mjs`: 충돌, 조사 대상, 발자국, 세이브 호환
- `render.mjs`: 대화, 수첩, 전투, HUD
- `game.mjs`, `audio.mjs`: 입력, 모달, 현재 위치 안내, 말소리와 발소리

`public/play/undertale`가 실제로 서비스되는 게임 소스다. `games/undertale`에는 검증 도구만 있다.

## 글꼴

[Galmuri](https://github.com/quiple/galmuri)의 `Galmuri11.woff2`, `Galmuri11-Bold.woff2`를 자체 호스팅한다. 출처는 원저장소 `main/dist`이며 파일과 함께 `fonts/OFL.md`를 보관한다. 게임 실행 중 외부 글꼴 CDN에 접근하지 않는다.

## 검증

```sh
npm run test:undertale
node games/undertale/browser-check.mjs
node games/undertale/details-browser-check.mjs
npx eslint public/play/undertale/*.mjs games/undertale/details.test.mjs games/undertale/details-browser-check.mjs
npx next build
```

핵심 테스트 40개, 기존 브라우저 흐름(도입부·ACT/MERCY·저장·사망 복원·세 결말·영혼 계약), 디테일 브라우저 흐름(수첩·대화 전환·모달·정지 상태 보존·모든 방·화면 크기 7개·터치 이름 입력·동작 줄이기)을 확인한다.

새 미리보기 이미지 갱신은 `node games/undertale/details-browser-check.mjs --shots`로 한다. 타이틀, 토리엘의 집, 언다인 전투의 실제 Canvas 화면을 캡처한다.
