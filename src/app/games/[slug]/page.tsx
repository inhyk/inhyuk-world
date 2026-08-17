import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { games, getGameBySlug, getAdjacentGames } from "@/data/games";
import { GameDetail } from "@/components/games/GameDetail";
import { JsonLd } from "@/components/seo/JsonLd";
import { searchRobots, siteConfig } from "@/lib/site";
import { createGameJsonLd } from "@/lib/structured-data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return games.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) {
    return {
      title: "게임을 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }

  const pagePath = `/games/${game.slug}`;
  const socialImage = game.thumbnail || "/opengraph-image";
  const socialImageAlt = game.thumbnail
    ? `${game.title} 웹 게임 대표 화면`
    : "인혁이의 게임 월드 - 초등학생 게임 개발자 웹 게임 포트폴리오";

  return {
    title: `${game.title} | ${game.category} 웹 게임`,
    description: game.description,
    robots: searchRobots,
    alternates: { canonical: pagePath },
    openGraph: {
      title: `${game.title} | ${siteConfig.name}`,
      description: game.description,
      url: pagePath,
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      images: [{ url: socialImage, alt: socialImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.title} | ${siteConfig.name}`,
      description: game.description,
      images: [{ url: socialImage, alt: socialImageAlt }],
    },
  };
}

export default async function GamePage({ params }: PageProps) {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) notFound();

  const { prev, next } = getAdjacentGames(slug);

  return (
    <>
      <JsonLd data={createGameJsonLd(game)} />
      <GameDetail game={game} prevGame={prev} nextGame={next} />
    </>
  );
}
