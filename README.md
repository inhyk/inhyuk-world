This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
