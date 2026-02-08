import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { games, getGameBySlug, getAdjacentGames } from "@/data/games";
import { GameDetail } from "@/components/games/GameDetail";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return games.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) return { title: "게임을 찾을 수 없습니다" };

  return {
    title: `${game.title} | 인혁이의 게임 월드`,
    description: game.description,
  };
}

export default async function GamePage({ params }: PageProps) {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) notFound();

  const { prev, next } = getAdjacentGames(slug);

  return <GameDetail game={game} prevGame={prev} nextGame={next} />;
}
