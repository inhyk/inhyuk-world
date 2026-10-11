# PULSE RUSH · 펄스 러시

4키 리듬게임. 실행: `/play/pulse-rush` (Next.js) 또는 `python3 -m http.server 5298 --directory public` 후 `http://localhost:5298/play/pulse-rush/index.html`.

- 첫 번째 빛, 솜사탕 구름, 파도 위로, 별빛 산책, 네온 시티, 픽셀 어드벤처, 달빛 질주, 슈가 러시, 전기 폭풍, 마지막 초신성: 100–174 BPM의 서로 다른 오리지널 24마디 연주곡.
- Web Audio로 멜로디·코드·베이스·킥·스네어·하이햇을 합성합니다. 다운로드할 음악 파일 없이 재생하며, 음악과 타일은 같은 악보와 AudioContext 시계를 사용합니다.
- 각 곡에 HOLD 타일을 추가했습니다. 긴 몸통의 시작을 맞춰 누른 뒤 끝까지 유지하세요. 시작 판정은 완료 시 한 번 점수에 반영하고, 중간에 놓으면 BAD로 콤보가 끊깁니다. 같은 줄의 다른 타일이 HOLD와 겹치지 않도록 배치합니다.
- D/F/J/K 또는 멀티터치 패드. Esc로 일시정지. 창을 떠나면 자동 일시정지.
- ±45ms PERFECT / ±90ms GREAT / ±140ms GOOD / ±200ms BAD / 놓친 타일 MISS.
- 판정 점수 1000/750/450/100/0. BAD/MISS는 콤보를 끊습니다. 정확도는 가능한 만점 대비 점수이며 결과는 전체 타일을 기준으로 합니다.
- 음량과 ±200ms 타이밍 보정. 양수는 늦게 누르는 입력을 보정합니다.
- 일시정지 중에는 HOLD가 멈추며, 재개 후 0.6초 안에 같은 키나 패드를 다시 누르면 이어집니다.
- 곡별 최고 정확도는 브라우저에 저장. HOLD 추가 전 기록은 보존하고 새 채보의 기록은 별도 저장합니다. 재도전·다음 곡·전체 화면 지원.

검증: `node --test games/pulse-rush/core.test.mjs`, `node games/pulse-rush/browser-check.mjs` (기본 포트 5298), `node games/pulse-rush/hold-browser-check.mjs` (기본 포트 3020, 실제 키보드·터치 HOLD 검증).
