# Geometry Classics · 06 / 07

- `/play/dash-overdrive/classic` (Next.js) 또는 `/play/dash-overdrive/classic/index.html` (정적 진입점).
- 1~7단계의 실제 맵 데이터와 각 단계 원곡의 YouTube IFrame 재생. 독립적인 OVERDRIVE 세 코스와 별도 실행.
- Space / 클릭 / 터치로 점프, 비행은 누르기 유지. Esc 일시정지, Space 재개. 일시정지 화면 왼쪽 버튼으로 연습 모드, Z 체크포인트 / X 삭제.
- 음악은 각 단계 진입 때 YouTube 공식 플레이어에서 재생됩니다. 인터넷 연결이 필요하고, 브라우저에서 재생이 막히면 상단 ♪ 버튼을 눌러 원곡 영상을 엽니다. 음악 파일은 프로젝트에 포함하지 않습니다.
- 8~10단계 원본 배치 데이터도 보관했지만 이 WebAssembly 엔진이 7단계까지만 컴파일되어 현재 선택·플레이할 수 없습니다.

## 출처와 변경

엔진: [VinkentLi/Bad-GD-Clone](https://github.com/VinkentLi/Bad-GD-Clone), MIT (Copyright 2023 Vincent Li). 원본을 바탕으로 수정해 Emscripten 6.0.13으로 웹 빌드를 다시 만들었습니다. 배포 폴더 `engine/LICENSE.txt` 및 게임의 크레딧에 출처를 표시합니다. 음악은 YouTube IFrame API로 재생합니다.

블록 충돌·착지 보정과 웹 화면 크기 고정은 `engine-collision-fix.patch`에 기록했고, `provenance.json`에 빌드 기준을 남겼습니다. 가시와 블록 충돌은 회전 애니메이션에 따라 판정이 흔들리지 않도록 큐브의 실제 이동 상자를 사용합니다. 블록 착지는 프레임을 놓쳐 표면에 조금 들어간 경우에도 한 번만 보정하며, 착지 중에는 중력을 멈춰 덜컹임을 줄입니다. 비행선이 블록을 통과하는 판정은 내부 충돌 상자를 사용해 좁은 통로에서 겉모양만 스쳐 죽는 문제를 줄였습니다. 레벨 오브젝트를 먼저, 큐브를 나중에 그려 장애물에 가려지지 않게 했습니다. Emscripten 웹 빌드는 화면 크기를 1920×1080으로 고정합니다. 기존 화면비와 무음 OGG 패키지를 유지해 WASM 엔진을 다시 빌드했습니다.

`GDClone.wasm`과 실행용 JavaScript는 충돌·화면 크기 변경을 포함해 함께 다시 빌드했습니다. 모든 OGG 데이터를 생성한 0.25초 무음 클립으로 교체한 뒤 데이터 패키지의 오프셋과 크기도 갱신했습니다. 런타임 외부 요청은 없습니다. 다운로드 출처와 SHA-256은 배포 폴더 `provenance.json`에 기록합니다.

맵은 엔진 패키지 `/res/leveldata/5.level`, `/res/leveldata/6.level`을 변경 없이 사용합니다. [독립 비교 자료 LevelData.plist](https://github.com/GuesterReal/Geometry-Dash-All-In-One/blob/main/Versions%20of%20Geometry%20Dash%20%28except%202.2%20and%20above%29/2nd%20manifest/Resources/LevelData.plist)에서 해당 레벨의 base64/gzip 문자열을 디코딩한 것을 `reference-6.txt.gz`, `reference-7.txt.gz`로 보관했습니다. 오브젝트 ID, X/Y, 좌우·상하 반전, 회전의 중복을 포함한 전체 배치가 일치합니다 (1,704 / 2,813개). 이는 데이터 비교이며 엔진이 모든 요소를 동일하게 렌더링한다는 주장은 아닙니다.

실제 맵 배치는 1~10단계 모두 `maps/`와 압축 기준 자료 `reference-*.txt.gz`에 보관했습니다. 1~7은 엔진 패키지와도 일치하며 플레이 가능합니다. 8~10은 기준 자료와 비교할 수 있지만 현재 엔진에 포함되지 않아 플레이 불가입니다.

## 검증

```
node --test games/dash-overdrive/core.test.mjs games/dash-overdrive/classic/integrity.test.mjs
node games/dash-overdrive/classic/browser-check.mjs
```

브라우저 검증에는 localhost:3000과 `tools/node_modules/playwright` 및 Chrome이 필요합니다. 두 레벨의 실제 FS 로딩 경로, 일시정지·재개, 모바일 두 방향 레이아웃, 터치 키 전달, 런타임 오류를 검사합니다. 전체 코스 완주는 검증하지 않았습니다.
