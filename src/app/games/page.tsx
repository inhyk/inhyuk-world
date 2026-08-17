import type { Metadata } from "next";
import { games } from "@/data/games";
import { GameExplorer } from "@/components/home/GameExplorer";
import { JsonLd } from "@/components/seo/JsonLd";
import { searchRobots, siteConfig } from "@/lib/site";
import { createGamesCollectionJsonLd } from "@/lib/structured-data";

const description = `초등학생 게임 개발자 인혁이 만든 ${games.length}개의 웹 게임과 공개된 플레이 버전을 만나보세요.`;

export const metadata: Metadata = {
  title: { absolute: "인혁의 웹 게임 작품 | 게임 포트폴리오" },
  description,
  robots: searchRobots,
  alternates: { canonical: "/games" },
  openGraph: {
    title: `인혁의 웹 게임 작품 | ${siteConfig.name}`,
    description,
    url: "/games",
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "초등학생 게임 개발자 인혁의 웹 게임 작품",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `인혁의 웹 게임 작품 | ${siteConfig.name}`,
    description,
    images: [
      {
        url: "/twitter-image",
        alt: "초등학생 게임 개발자 인혁의 웹 게임 작품",
      },
    ],
  },
};

export default function GamesPage() {
  return (
    <>
      <JsonLd data={createGamesCollectionJsonLd(games)} />
      <GameExplorer
        title="모든 게임"
        description={`${games.length}개의 게임을 검색하고 장르별로 둘러보세요`}
        showVideoHero={false}
      />
    </>
  );
}
