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

## CLASSIC 01–15

[클래식 모드](classic/README.md)는 `/play/dash-overdrive/classic`에서 실행합니다. 큐브, 비행선, 중력 뒤집기로 달리는 새 15단계와 스킨, 맵 만들기가 있습니다. 맵, 그림, 노래는 모두 이 게임을 위해 새로 만들었고, MIT 라이선스 엔진을 고쳐서 씁니다.
