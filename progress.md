Original prompt: 최근에 수정한 게임이 제일 위로 올라오도록 해줘.

- DONE: `games`가 `order` 오름차순으로 노출되고, 기존 게임 재발행 시 `order`를 보존하는 흐름 확인
- DONE: `order`를 마지막 발행 순번으로 사용해 목록·상세 탐색·구조화 데이터를 내림차순으로 통일
- DONE: 기존 게임 재발행 시 새 최댓값을 부여해 목록 맨 위로 이동하도록 발행 도구 수정
- DONE: ESLint 통과(기존 미사용 import 경고 3건), Next.js 프로덕션 빌드 및 발행 스크립트 문법 검사 통과
- DONE: Playwright에서 목록 첫 4개, 검색, 샌드박스 필터, 홈 첫 카드, 상세 페이지 이동, JSON-LD 순서 검증
- DONE: 목록·상세 스크린샷을 직접 확인했고 브라우저 콘솔 오류 없음

- Remaining TODO: 없음
