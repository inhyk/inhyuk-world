# Geometry Dash · Neon Run

Geometry Dash에서 영감을 받은 독자적인 네온 점프 게임. 현재 HELL EDITION 난이도입니다. 외부 이미지·폰트·음악 없이 Canvas 2D와 Web Audio로 실행합니다.

- `http://localhost:3000/play/geometry-dash` (Next.js) 또는 아래 독립 서버.
- `python3 -m http.server 5193 --bind 127.0.0.1 --directory public/play/geometry-dash`
- 스페이스 / 위쪽 방향키 / W / 클릭 / 터치: 점프. 짧게 눌렀다 떼면 낮은 점프, 길게 누르면 높은 점프. 누르고 있으면 착지 후 연속 점프. 천장 아래에서는 낮은 점프가 필수입니다.
- R: 재도전. P / Esc: 일시정지. 탭 전환 시 자동 일시정지.
- 세 스테이지: First Light (HELL, 초당 500) / Neon Rush (ABYSS, 초당 590) / Solar Flare (NIGHTMARE, 초당 680). 3~7연속 높은 가시, 넓은 블록과 변칙 간격으로 정확한 점프가 필요합니다. 천장 가시 아래로 짧게 점프하는 구간이 추가됩니다. 일반 모드는 약 42 / 49 / 56초를 실수 없이 완주해야 합니다. 누르기 유지로는 완주할 수 없습니다.
- 연습 모드: 장애물 앞 안전한 지점에 자동 체크포인트. 일반 최고 기록과 분리됩니다.
- 최고 진행률은 스테이지별로 브라우저에 저장. 이전 쉬운 버전·극한 버전과 HELL 버전의 기록은 별도 키로 보관합니다. 저장소가 막혀도 플레이 가능.
- 소리는 버튼으로 활성화. 전체 화면 버튼 지원. 모바일 가로·세로 지원.

검증: `node --test games/geometry-dash/core.test.mjs`
브라우저 검증: 독립 서버 실행 후 `node games/geometry-dash/browser-check.mjs`.
`window.render_game_to_text()`는 상태를 읽기만 하는 검증용 인터페이스입니다.
