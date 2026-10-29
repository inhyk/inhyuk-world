# DASH / OVERDRIVE

기존 Geometry Dash · Neon Run과 파일·화면·물리·코스·저장 기록을 공유하지 않는 새 리듬 러너입니다.

- 주소: http://localhost:3000/play/dash-overdrive
- 실행 파일: `public/play/dash-overdrive/` · Next.js 진입점: `src/app/play/dash-overdrive/page.tsx`
- 스페이스 / 위 방향키 / W / 클릭 / 터치: 큐브 점프. 비행선은 누르면 상승, 떼면 하강.
- 노란 점프 발판, 비행 변신 포털, 보석 수집, 세 테마와 서로 다른 속도의 코스.
- R: 재시작. P / Esc: 일시정지. 창 전환 시 자동 일시정지.
- 연습 모드의 안전 체크포인트, 일반 최고 기록 저장, Web Audio 합성 음악, 전체 화면.
- 원본 Canvas 그림과 Web Audio 합성을 사용하며 외부 이미지·폰트·음원을 요청하지 않습니다.

검증: `node --test games/dash-overdrive/core.test.mjs`
브라우저 검증: 로컬 Next.js 실행 후 `node games/dash-overdrive/browser-check.mjs`.
세 코스의 완주 경로를 입력과 실제 물리로 검증합니다. 브라우저 검증은 실제 시간으로 첫 코스를 완주하며 큐브·비행·완주 화면을 확인합니다.

## HARD EDITION

SKYLINE: HARD / 420, AFTERGLOW: EXPERT / 500, HYPERSPACE: INSANE / 580 속도로 달립니다. 2~5연속 높은 가시, 코스당 10개 비행 장애물 쌍, 180 / 160 / 144 너비의 비행 통로로 난이도를 올렸습니다. 최고 기록은 이전 버전과 별도 저장합니다.

## Geometry Classics 01–15

원작과 같은 맵을 원하는 요청에 따라 [별도 클래식 모드](classic/README.md)를 추가했습니다. `/play/dash-overdrive/classic`에서 1~15단계를 선택합니다. 원작 맵 데이터와 MIT 웹 재현 엔진을 사용하며 원곡은 포함하지 않습니다.
