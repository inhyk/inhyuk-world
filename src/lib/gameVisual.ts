import { games } from "@/data/games";

// 썸네일 사진이 아직 없는 게임에 쓰는 대체 배경입니다.
// 목록 순서대로 색을 돌려 쓰기 때문에 옆 카드와 색이 겹치지 않습니다.

const covers = [
  "radial-gradient(at 20% 20%, #60a5fa 0%, transparent 60%), radial-gradient(at 85% 75%, #6366f1 0%, transparent 60%), linear-gradient(135deg, #1e3a8a, #0b1120)",
  "radial-gradient(at 25% 80%, #f472b6 0%, transparent 60%), radial-gradient(at 80% 20%, #a855f7 0%, transparent 60%), linear-gradient(135deg, #4c1d95, #140a24)",
  "radial-gradient(at 75% 25%, #fb7185 0%, transparent 60%), radial-gradient(at 20% 85%, #f59e0b 0%, transparent 60%), linear-gradient(135deg, #7f1d1d, #180a0a)",
  "radial-gradient(at 30% 25%, #34d399 0%, transparent 60%), radial-gradient(at 80% 80%, #06b6d4 0%, transparent 60%), linear-gradient(135deg, #064e3b, #06131a)",
  "radial-gradient(at 80% 20%, #c084fc 0%, transparent 60%), radial-gradient(at 20% 80%, #38bdf8 0%, transparent 60%), linear-gradient(135deg, #312e81, #0a0a16)",
  "radial-gradient(at 25% 25%, #fbbf24 0%, transparent 58%), radial-gradient(at 78% 78%, #ec4899 0%, transparent 60%), linear-gradient(135deg, #7c2d12, #170a06)",
];

export function getGameCover(slug: string): string {
  const index = games.findIndex((game) => game.slug === slug);
  return covers[(index < 0 ? 0 : index) % covers.length];
}
