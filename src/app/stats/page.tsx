import { Suspense } from "react";
import type { Metadata } from "next";
import {
  AnalyticsDashboard,
  AnalyticsDashboardFallback,
} from "@/components/analytics/AnalyticsDashboard";
import { searchRobots, siteConfig } from "@/lib/site";

const description =
  "인혁이의 게임 월드와 각 웹 게임의 일별 방문자, 페이지뷰, 최근 접속 추이를 확인하세요.";

export const metadata: Metadata = {
  title: { absolute: `방문 통계 | ${siteConfig.name}` },
  description,
  robots: searchRobots,
  alternates: { canonical: "/stats" },
  openGraph: {
    title: `방문 통계 | ${siteConfig.name}`,
    description,
    url: "/stats",
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
  },
};

export const revalidate = 3600;

export default function StatsPage() {
  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden border-b border-border">
        <div className="mesh absolute inset-0 opacity-75" />
        <div className="absolute inset-0 bg-[#08080b]/35" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background" />

        <div className="relative mx-auto max-w-7xl px-5 pt-24 pb-14 md:px-8 md:pt-28 md:pb-16">
          <p className="text-xs font-medium tracking-[0.14em] text-white/75 uppercase">
            방문 통계
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-inter-tight)] text-[34px] leading-[1.08] font-extrabold tracking-[-0.035em] text-white md:text-[52px]">
            매일 쌓이는
            <br />
            인혁 월드의 기록
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-white/80">
            사이트와 게임에 찾아온 방문자를 익명으로 집계합니다. 최근 30일
            흐름과 게임별 접속 현황을 매시간 새로 보여줍니다.
          </p>
        </div>
      </header>

      <Suspense fallback={<AnalyticsDashboardFallback />}>
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}
