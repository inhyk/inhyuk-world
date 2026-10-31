# Geometry Classics · 01–15

- `/play/dash-overdrive/classic` (Next.js) 또는 `/play/dash-overdrive/classic/index.html`에서 실행합니다.
- 1~15단계의 원작 맵 배치 데이터를 포함하고, 각 단계의 원곡은 YouTube IFrame 플레이어에서 재생합니다. 음악 파일은 프로젝트에 포함하지 않습니다.
- 단계 선택 화면에서 맵을 고른 뒤 시작하세요. Space / 클릭 / 터치로 점프하고, 비행선 구간에서는 누르면 상승합니다. Esc로 일시정지하고 Space로 재개합니다.
- 인터넷 연결이 필요합니다. 자동 재생이 차단되면 상단 원곡 버튼을 눌러 재생하거나 YouTube 출처 링크를 여세요.
- 발판과 장애물은 추가 생성하지 않고, 원본 맵에 저장된 위치와 순서를 그대로 사용합니다.
- 중력 반전 구간에는 천장 바닥도 나타나고, 큐브가 그 위에 착지할 수 있습니다.
- 원본 엔진은 기본 큐브와 비행선을 지원합니다. 공 모드·UFO·속도 포털 등은 완전히 재현되지 않아 원작과 동작이 다를 수 있습니다. 충돌 판정, 장식, 숨겨진 요소도 차이가 있을 수 있습니다.

## 출처와 변경

엔진: [VinkentLi/Bad-GD-Clone](https://github.com/VinkentLi/Bad-GD-Clone), MIT (Copyright 2023 Vincent Li). Emscripten 6.0.13으로 웹 빌드를 다시 만들었습니다. 배포 폴더 `engine/LICENSE.txt` 및 크레딧 페이지에 출처를 표시합니다. 충돌 판정·화면 크기·충돌 보정·레벨 수 변경과 빌드 기준은 `provenance.json`에 기록했습니다.

레벨 배치의 원본 비교 자료는 `reference-1.txt.gz`부터 `reference-15.txt.gz`까지 보관하고, 정적 맵 파일은 `public/play/dash-overdrive/classic/maps/`에 있습니다. `provenance.json`에는 각 단계의 파일 해시, 엔진 패키지 해시, YouTube 원곡 링크가 기록돼 있습니다. 원본 데이터 출처는 [LevelData.plist](https://github.com/GuesterReal/Geometry-Dash-All-In-One/blob/main/Versions%20of%20Geometry%20Dash%20%28except%202.2%20and%20above%29/2nd%20manifest/Resources/LevelData.plist)입니다.
