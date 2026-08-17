import type { Metadata } from "next";
import { GameExplorer } from "@/components/home/GameExplorer";
import { MediaFeature } from "@/components/home/MediaFeature";
import { CreatorStrip } from "@/components/home/CreatorStrip";
import { searchRobots, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  robots: searchRobots,
  alternates: { canonical: `${siteConfig.url}/` },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: `${siteConfig.url}/`,
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "인혁이의 게임 월드 - 초등학생 게임 개발자 웹 게임 포트폴리오",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: "/twitter-image",
        alt: "인혁이의 게임 월드 - 초등학생 게임 개발자 웹 게임 포트폴리오",
      },
    ],
  },
};

export default function HomePage() {
  return (
    <>
      <GameExplorer />
      <MediaFeature />
      <CreatorStrip />
    </>
  );
}
