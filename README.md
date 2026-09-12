This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## UNDERTALE · 세 갈래의 결말

`npm run dev` 후 http://localhost:3000/play/undertale 에서 플레이합니다. 폐허에서 왕좌의 방까지 압축한 언더테일 팬 게임으로, 공격·행동·아이템·자비 전투와 빨강·파랑·초록 영혼 모드, 15종 몬스터와 9명의 보스를 갖추고 있습니다. 아무도 죽이지 않으면 불살, 지역마다 아무도 오지 않을 때까지 죽이면 몰살, 그 사이는 중립 결말이며 몰살 뒤에는 세계가 지워집니다. 이름 짓기, 세이브, 상점, 합성 음악, 모바일 터치를 지원합니다. 조작법은 [게임 README](games/undertale/README.md), 원작 시스템 분석은 [ANALYSIS.md](games/undertale/ANALYSIS.md), 전투·월드 검증은 `npm run test:undertale`을 참고하세요.

## VALORANT // PROTOCOL · 전술 슈팅

`npm run dev` 후 http://localhost:3000/play/valorant 에서 플레이합니다. 발로란트에서 영감을 받은 1인칭 3D 팬 게임으로, 항구 전장에서 AI 수비팀과 3선승제 전투를 진행합니다. 밴달·팬텀·권총, 헤드샷, 대시·연막·회복, 스파이크 설치와 해체 저지를 지원합니다. 세 난이도, 모바일 터치, 일시정지와 감도 조절을 제공합니다. [조작법](games/valorant/README.md), 검증은 `npm run test:valorant`, 게임 전용 개발 서버는 `npm run valorant:dev`입니다.

## ORBIT BREAKER · 오비트 브레이커

`npm run dev` 후 http://localhost:3000/play/orbit-breaker 에서 플레이합니다. 10웨이브 우주 슈팅게임으로, 5웨이브에 중간 보스 센티넬, 10웨이브에 최종 보스 이클립스가 등장합니다. 같은 키보드로 2인 협동(WASD / 방향키)이 가능하며, 동료가 다음 웨이브를 돌파하면 격추된 플레이어가 복귀합니다. 세 난이도, 모바일 멀티터치, 인원·난이도별 기록을 지원합니다. [조작법](games/orbit-breaker/README.md), 전투 검증은 `npm run test:orbit-breaker`를 참고하세요.

## 메타톤 EX · GLAMOUR / LIVE

`npm run dev` 후 http://localhost:3000/play/mettaton 에서 플레이합니다. 9가지 탄막 패턴, 세 난이도, 노란 영혼 슈팅과 두 가지 결말을 갖춘 팬 게임입니다. 모바일 터치 조작을 지원하며, 창 전환 시 별도 메뉴 없이 멈췄다가 돌아오면 이어집니다. 조작법은 [게임 README](games/mettaton/README.md), 전투 검증은 `npm run test:mettaton`을 참고하세요.

## SNOWFLOW · 눈과 물의 흐름

Reddit에서 소개된 눈 서핑·물 마법 데모의 한국어 버전을 추가했습니다. 루트에서 `npm install` 후 `npm run snowflow:dev`를 실행하면 http://127.0.0.1:5173 에서 플레이할 수 있습니다. WebGPU를 지원하는 데스크톱 브라우저가 필요합니다.

사이트 안에서는 `/play/snowflow`에서 실행합니다. `npm run dev`와 `npm run build`에 게임 빌드가 연결되어 있습니다. 조작법과 원본 라이선스는 [게임 README](games/snowflow/README.md)를 확인하세요.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 방문 통계

`/stats`는 Vercel Web Analytics API에서 최근 30일의 사이트 및 게임별
방문 데이터를 읽습니다. 배포 환경에는 다음 서버 전용 변수가 필요합니다.

```text
DASHBOARD_VERCEL_TOKEN
DASHBOARD_VERCEL_TEAM_ID
```

토큰에는 팀 프로젝트의 Web Analytics 조회 권한이 필요합니다.
`DASHBOARD_VERCEL_TOKEN`에 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.
