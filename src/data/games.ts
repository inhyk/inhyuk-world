import gamesData from "./games.json";

export interface Game {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  emoji: string;
  thumbnail: string;
  screenshots: string[];
  techStack: string[];
  category: string;
  playUrl?: string;
  githubUrl?: string;
  createdAt: string;
  featured: boolean;
  order: number;
}

export function compareGamesByRecentUpdate(a: Game, b: Game): number {
  return b.order - a.order;
}

// 게임 목록의 원본은 games.json 입니다.
// seonn-publisher 의 /publish-game 스킬이 이 파일을 자동으로 갱신합니다.
// 직접 손으로 고쳐도 됩니다.
export const games: Game[] = (gamesData as Game[])
  .slice()
  .sort(compareGamesByRecentUpdate);

export function getGameBySlug(slug: string): Game | undefined {
  return games.find((game) => game.slug === slug);
}

export function getAdjacentGames(slug: string): { prev: Game | null; next: Game | null } {
  const sorted = [...games].sort(compareGamesByRecentUpdate);
  const index = sorted.findIndex((game) => game.slug === slug);
  return {
    prev: index > 0 ? sorted[index - 1] : null,
    next: index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}
