# 키캡 타워 · KEYCAP TOWER

키캡을 밟아 스피드를 올리고 네 개 월드의 3D 나선 타워를 올라가는 성장 점프맵. 분석 내용은 [ANALYSIS.md](ANALYSIS.md).

## 실행

```bash
npm run keycap-tower:dev     # http://localhost:5191
npm run keycap-tower:build   # public/play/keycap-tower 로 빌드
npm run test:keycap-tower    # 규칙 테스트
KEYCAP_TOWER_URL=http://localhost:5191/ SHOTS=/tmp/shots node games/keycap-tower/browser-check.mjs
```

## 파일

- `core.mjs` — 월드·스테이지 데이터, 물리, 스피드·레벨·윈·스탯·러닝머신·환생 계산 (화면 없이 테스트 가능)
- `world.mjs` — Babylon.js 3D 화면
- `main.js` — 조작, HUD, 메뉴, 소리, 저장 (`localStorage` 키 `keycap-tower-v1`)

## 조작

- WASD·방향키 이동, Space 점프, 드래그 시점, 휠 확대, E 로비 시설 열기
- 모바일: 조이스틱과 점프 버튼
